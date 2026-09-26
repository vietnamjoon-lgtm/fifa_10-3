// Check the locomotion clip conventions in a mocap-data module (default src/mocap-data.js).
// Usage: node tools/anim/check-clips.mjs [path/to/mocap-data.js]
// - loop seam: first == last pose and equal angular velocity across the seam, on every joint and both ankles
// - phase: left foot (legs[1], src/sides.js) touches down at 0, right foot (legs[0]) at ~0.5
// - sides: at the left touchdown the left thigh is ahead of the right one (more hip flexion)
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Quaternion,Euler} from '../../vendor/three.module.js';
import {RIGHT,LEFT} from '../../src/sides.js';
const file=path.resolve(process.argv[2]||'src/mocap-data.js'),{mocap}=await import(pathToFileURL(file).href);
const log=q=>{const w=Math.min(1,Math.abs(q.w)),s=Math.sqrt(1-w*w),a=2*Math.acos(w)*(q.w<0?-1:1);return s<1e-9?[0,0,0]:[q.x/s*a,q.y/s*a,q.z/s*a];};
const flexion=q=>new Euler().setFromQuaternion(new Quaternion(...q),'XYZ').x;
let failures=0;const report={};
for(const name of ['walk','jog','run']){
 const c=mocap[name],n=c.frames.length,r={frames:n,source:c.source};
 let seam=0,velocity=0;for(const key of ['localRotations','ankleRotations'])for(let j=0;j<c[key][0].length;j++){const q=i=>new Quaternion(...c[key].at(i)[j]);seam=Math.max(seam,q(0).angleTo(q(-1)));const a=log(q(-2).invert().multiply(q(-1))),b=log(q(0).invert().multiply(q(1)));velocity=Math.max(velocity,Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
 r.seamDegrees=+(seam*180/Math.PI).toFixed(6);r.seamVelocityMismatch=+velocity.toExponential(2);
 const onset=side=>{for(let i=1;i<n;i++)if(c.contacts[i][side]&&!c.contacts[i-1][side])return i/(n-1);return c.contacts[0][side]&&!c.contacts[n-2][side]?0:null;};
 r.leftTouchdown=onset(LEFT);r.rightTouchdown=onset(RIGHT)===null?null:+onset(RIGHT).toFixed(3);r.leftContactAt0=c.contacts[0][LEFT];
 // localRotations: 0 hips, 1 torso, 2 head, 3/4 legs[0] thigh/shin, 5/6 legs[1] thigh/shin. Negative x = thigh forward.
 r.leftThighAheadAt0=flexion(c.localRotations[0][5])<flexion(c.localRotations[0][3]);
 const ok=seam<1e-6&&velocity<1e-6&&r.leftContactAt0===1&&(r.leftTouchdown===0||r.leftTouchdown<.03||r.leftTouchdown>.97)&&r.rightTouchdown!==null&&Math.abs(r.rightTouchdown-.5)<.06&&r.leftThighAheadAt0;
 r.ok=ok;if(!ok)failures++;report[name]=r;
}
console.log(JSON.stringify(report,null,1));
if(failures){console.error(failures+' clip(s) break the conventions');process.exitCode=1;}
