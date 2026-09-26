import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {anatomy} from '../src/anatomy-data.js';
import {BODY_PRESETS,applyBodyPreset,cleanBody,bodyMetrics} from '../src/body-shape.js';
import {cleanProfile,cleanLineup} from '../src/squads.js';
import {createAnatomicalBody} from '../src/anatomical-player.js';
import {FOOT_SIDES} from '../src/human-deformation.js';
import {predictFoot,jointExcursion,bodyCenterOfMass} from '../src/human-kinematics.js';
import {sampleMotion} from '../src/motion.js';
import {stabilizeFeet} from '../src/foot-plant.js';
import {gaitTargets} from '../src/gait.js';
import {locomotionCadence,stanceFraction} from '../src/motion-planner.js';
import {mocap} from '../src/mocap-data.js';
import {fixture} from '../tools/human-fixture.mjs';
test('four requested body types preserve custom proportions and old library values',()=>{
 assert.deepEqual(Object.values(BODY_PRESETS).map(p=>p.label),['마름','보통','건장','고유']);
 const old={height:1.913,weight:88.4,body:cleanBody({waist:87,armLength:107}),face:{assetId:'existing-photo'}};
 const p=cleanProfile(old);assert.equal(p.bodyType,'unique');assert.deepEqual(p.body,old.body);assert.deepEqual(applyBodyPreset(p,'unique').body,p.body);
 for(const type of Object.keys(BODY_PRESETS)){const edited=applyBodyPreset(p,type);assert.equal(cleanProfile(edited).bodyType,type);assert.equal(cleanLineup(Array(11).fill(edited),0,true)[1].bodyType,type);}
 assert.equal(cleanProfile({...old,bodyType:'balanced'}).bodyType,'normal');assert.deepEqual(cleanProfile({...old,bodyType:'power'}).body,old.body);
});
test('neutral bone segment lengths and joint heights match the requested anthropometric ratios',()=>{for(const height of [1.55,1.81,2.1]){const m=bodyMetrics({height});for(const [actual,ratio]of [[m.upperArm,.186],[m.lowerArm,.146],[m.upperLeg,.245],[m.lowerLeg,.246],[m.shoulderY,.818],[m.hipY-.075,.530],[m.ankle+m.lowerLeg,.285]])assert.ok(Math.abs(actual*m.scale-height*ratio)<1e-8);}});
test('deformation weights retain original fingers, twist chains, spine and neck hierarchy',()=>{
 const m=bodyMetrics({height:1.81}),headY=anatomy.head.positions.filter((_,i)=>i%3===1),heads=m.height/((Math.max(...headY)-Math.min(...headY))*m.head*m.scale);assert.ok(heads>=7.5&&heads<=8.5,`${heads} heads tall`);
 const d=anatomy.detail;assert.equal(d.bones.filter(b=>b.name.startsWith('finger')).length,30);assert.equal(d.bones.filter(b=>b.name.startsWith('spine')).length,5);assert.equal(d.bones.filter(b=>b.name.startsWith('neck')).length,3);
 for(const [i,b]of d.bones.entries())assert.ok(b.parent<i);
 for(let i=0;i<d.skinWeights.length;i+=4){assert.ok(Math.abs(d.skinWeights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<3e-6);assert.ok(d.skinIndices.slice(i,i+4).every(n=>n>=0&&n<d.bones.length));}
 assert.equal(d.bones[d.bones.find(b=>b.name==='wrist.R').parent].name,'lowerarm02.R');
});
test('right anatomical leg remains legacy left and prediction is pure in both directions',()=>{
 assert.deepEqual(FOOT_SIDES.map(f=>[f.anatomical,f.legacy]),[['R','right'],['L','left']]);
 for(const yaw of [-Math.PI/2,Math.PI/2])for(const height of [1.55,2.1]){const p={x:5,z:2,height,yaw,vx:Math.sin(yaw)*3,vz:0,body:cleanBody()},before=JSON.stringify(p),left=predictFoot(p,1,'left'),right=predictFoot(p,1,'R');assert.deepEqual(left,right);assert.equal(before,JSON.stringify(p));assert.ok(Object.values(left.surfaces).every(v=>Object.values(v).every(Number.isFinite)));}
});
test('real skin separates garments and distant LOD has the same legacy controls',()=>{
 const r=fixture({height:1.81}),c=new THREE.Color('white'),body=createAnatomicalBody(r,{skin:c,kit:c,shorts:c,sock:c});
 assert.equal(body.skeleton.bones.length,74);assert.equal(body.farSkeleton.bones.length,13);assert.notEqual(body.garment.geometry,body.mesh.geometry);
 assert.ok(body.garment.geometry.index.count>500);r.arms[0].lower.rotation.x=-Math.PI/2;r.root.updateMatrixWorld(true);body.skeleton.update();assert.ok([...body.skeleton.boneMatrices].every(Number.isFinite));
 const center=bodyCenterOfMass(r);assert.ok(center.y>.6&&center.y<1.4);
});
test('swing/twist diagnostics catch hyperextension without changing the source quaternion',()=>{
 const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.25),copy=q.clone(),e=jointExcursion(q);assert.ok(e.twist<-.24);assert.ok(e.swing<1e-6);assert.deepEqual(q,copy);
});
test('captured walking, jogging, stopping and turning are present and running has a flight interval',()=>{
 // CMU clips were captured at 120 Hz, 100STYLE at 60 Hz; both are stored as 60 fps frames.
 for(const name of ['walk','jog','turn','stop']){assert.ok(mocap[name].frames.length>20);assert.ok([60,120].includes(mocap[name].sourceRate));assert.ok(Math.abs(mocap[name].duration-(mocap[name].frames.length-1)/60)<1e-6);}
 for(const i of [0,1]){const ratio=mocap.run.contacts.reduce((n,c)=>n+c[i],0)/mocap.run.contacts.length;assert.ok(ratio>.1&&ratio<.55);}
});
test('stopping gait foot lift approaches zero instead of jumping at the idle threshold',()=>{
 const p={height:1.81,yaw:0,vx:0,vz:.04},a=gaitTargets({...p,vz:.040001},4.8),b=gaitTargets({...p,vz:.039999},4.8);assert.ok(Math.abs(a.feet[0].y-b.feet[0].y)<.001);
});
test('swing enters and leaves contact with continuous velocity',()=>{
 for(const speed of [1.3,3.5,8.5]){const p={height:1.81,yaw:0,vx:0,vz:speed},rate=locomotionCadence(speed,'balanced',p),epsilon=1e-6;
  for(const phase of [0,stanceFraction(speed)*Math.PI*2]){const a=gaitTargets(p,phase-epsilon).feet[0],b=gaitTargets(p,phase).feet[0],c=gaitTargets(p,phase+epsilon).feet[0];
   for(const axis of ['x','y','z']){const before=(b[axis]-a[axis])*rate/epsilon,after=(c[axis]-b[axis])*rate/epsilon;assert.ok(Math.abs(before-after)<.003,`${speed} m/s ${axis}: ${before} / ${after}`);}
  }
 }
});
test('support feet stay fixed and renderer does not mutate the player during direction changes',()=>{
 const p={height:1.81,x:0,z:0,yaw:0,vx:0,vz:3.5},r=fixture(p);let phase=0;const anchors=[null,null];
 for(let frame=0;frame<600;frame++){p.z+=p.vz/960;p.x+=p.vx/960;if(frame===260){p.vx=2.5;p.vz=2.5;}p.yaw=Math.atan2(p.vx,p.vz);phase+=.009;r.phase=phase;r.root.position.set(p.x,0,p.z);r.root.rotation.y=p.yaw;const pose=sampleMotion(p,phase,frame/960),before=JSON.stringify(p);r.hips.position.y=pose.hipY;stabilizeFeet(r,p,pose,1/960);assert.equal(JSON.stringify(p),before);for(let i=0;i<2;i++){const lock=r.plantState.feet[i],pos=r.legs[i].foot.getWorldPosition(new THREE.Vector3());if(lock){if(anchors[i]?.since===lock.since)assert.ok(Math.hypot(pos.x-anchors[i].x,pos.z-anchors[i].z)<.01);anchors[i]={since:lock.since,x:pos.x,z:pos.z};}else anchors[i]=null;}}
});
