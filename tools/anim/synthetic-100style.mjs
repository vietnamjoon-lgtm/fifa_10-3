// Synthetic stand-ins for the three 100STYLE Neutral takes, to test tools/anim/convert-100style.mjs end to end
// (Blender BVH import, axes, sides, phase rule, loop seam) without the real dataset. Not game data.
// Usage: node tools/anim/synthetic-100style.mjs [dir]   (default $STYLE100_DIR or ~/.cache/100style-synthetic)
//        STYLE100_DIR=<dir> OUT_DATA=<tmp>/mocap-data.js OUT_REPORT=<tmp>/selection.json node tools/anim/convert-100style.mjs
//        node tools/anim/check-clips.mjs <tmp>/mocap-data.js
// Writes Neutral_FW.bvh, Neutral_FR.bvh, Neutral_TR1.bvh, Frame_Cuts.csv and truth.json (the generating parameters).
//
// Skeleton: 100STYLE joint names, BVH frame (Y up, centimetres, facing +z, character's right at -x, T-pose arms).
// Gait: feet are planted flat on the ground for the whole stance and the legs are solved with two-bone IK, so the
// ankles are exactly still during contact. Every take starts with the LEFT foot's touchdown at phase 0 and the
// right foot's at 0.5, so a correct conversion keeps the left leg (legs[1]) as the one landing at clip phase 0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Vector3,Quaternion,Matrix4,Euler} from '../../vendor/three.module.js';

const DIR=process.argv[2]||process.env.STYLE100_DIR||path.join(os.homedir(),'.cache','100style-synthetic'),FPS=60;
const THIGH=.44,SHIN=.43,ANKLE=.08,HIP_X=.09,HIP_DROP=.07,SHOULDER_X=.19,UPPER_ARM=.29,FOREARM=.26;
const smooth=t=>t*t*(3-2*t),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),up=new Vector3(0,1,0);

// name, parent, offset (m), end site offset for leaves
const JOINTS=[
 ['Hips',null,[0,0,0]],['Chest','Hips',[0,.1,0]],['Chest2','Chest',[0,.1,0]],['Chest3','Chest2',[0,.1,0]],['Chest4','Chest3',[0,.1,0]],
 ['Neck','Chest4',[0,.12,0]],['Head','Neck',[0,.1,0],[0,.18,0]],
 ['RightCollar','Chest4',[-.03,.08,0]],['RightShoulder','RightCollar',[-SHOULDER_X+.03,0,0]],['RightElbow','RightShoulder',[-UPPER_ARM,0,0]],['RightWrist','RightElbow',[-FOREARM,0,0],[-.08,0,0]],
 ['LeftCollar','Chest4',[.03,.08,0]],['LeftShoulder','LeftCollar',[SHOULDER_X-.03,0,0]],['LeftElbow','LeftShoulder',[UPPER_ARM,0,0]],['LeftWrist','LeftElbow',[FOREARM,0,0],[.08,0,0]],
 ['RightHip','Hips',[-HIP_X,-HIP_DROP,0]],['RightKnee','RightHip',[0,-THIGH,0]],['RightAnkle','RightKnee',[0,-SHIN,0]],['RightToe','RightAnkle',[0,-ANKLE+.02,.13],[0,0,.06]],
 ['LeftHip','Hips',[HIP_X,-HIP_DROP,0]],['LeftKnee','LeftHip',[0,-THIGH,0]],['LeftAnkle','LeftKnee',[0,-SHIN,0]],['LeftToe','LeftAnkle',[0,-ANKLE+.02,.13],[0,0,.06]],
];
const children=name=>JOINTS.filter(j=>j[1]===name);
function hierarchy(){
 const cm=v=>v.map(x=>(x*100).toFixed(4)).join(' ');
 const write=(j,depth)=>{const pad='  '.repeat(depth),[name,parent,offset,end]=j,kids=children(name);
  let s=`${pad}${parent?'JOINT':'ROOT'} ${name}\n${pad}{\n${pad}  OFFSET ${cm(offset)}\n${pad}  CHANNELS ${parent?'3':'6 Xposition Yposition Zposition'} Zrotation Xrotation Yrotation\n`;
  for(const k of kids)s+=write(k,depth+1);if(end)s+=`${pad}  End Site\n${pad}  {\n${pad}    OFFSET ${cm(end)}\n${pad}  }\n`;return s+`${pad}}\n`;};
 return 'HIERARCHY\n'+write(JOINTS[0],0);
}

// Profiles are functions of time: speed (m/s), yaw rate (rad/s). Root path, gait phase and feet follow from them.
function simulate(seconds,speedAt,yawRateAt){
 const n=Math.round(seconds*FPS),root=[],yaw=[],speed=[],phase=[];let x=0,z=0,h=0,p=0;
 for(let i=0;i<n;i++){const t=i/FPS,v=speedAt(t);root.push(new Vector3(x,0,z));yaw.push(h);speed.push(v);phase.push(p);
  // Cadence rises with speed (walk ~1.0 Hz at 1.45 m/s, run ~1.45 Hz at 4 m/s); a standing player keeps still.
  const cadence=v<.05?0:.62+.26*Math.min(v,2)+.05*Math.max(0,v-2);x+=Math.sin(h)*v/FPS;z+=Math.cos(h)*v/FPS;h+=yawRateAt(t)/FPS;p+=cadence/FPS;}
 const stanceOf=v=>.62-clamp((v-2)/2.2,0,1)*.24;
 const lateral=(i,sign)=>new Vector3(Math.cos(yaw[i]),0,-Math.sin(yaw[i])).multiplyScalar(sign*HIP_X*1.05);
 const feet=[[],[]];// index 0 = right, 1 = left (as src/sides.js)
 for(const side of [0,1]){
  const sign=side===0?-1:1,offset=side===1?0:.5,footPhase=i=>phase[i]-offset;
  // Contact intervals in frames: [touchdown, liftoff).
  const intervals=[];let current=null;
  for(let i=0;i<n;i++){const f=footPhase(i),cycle=Math.floor(f),u=f-cycle,standing=speed[i]<.05,stance=standing||f<0?true:u<stanceOf(speed[i]);
   if(stance&&!current)current={a:i,cycle};if(!stance&&current){current.b=i;intervals.push(current);current=null;}}
  if(current){current.b=n;intervals.push(current);}
  const plant=iv=>{const m=Math.min(n-1,Math.round((iv.a+iv.b)/2));return root[m].clone().add(lateral(m,sign));};
  const points=intervals.map(plant);
  for(let i=0;i<n;i++){
   const k=intervals.findIndex(iv=>i>=iv.a&&i<iv.b);
   if(k>=0){feet[side].push(points[k].clone());continue;}
   const prev=intervals.findLastIndex(iv=>iv.b<=i),next=intervals.findIndex(iv=>iv.a>i);
   const from=prev>=0?points[prev]:root[i].clone().add(lateral(i,sign)),to=next>=0?points[next]:from,a=prev>=0?intervals[prev].b-1:0,b=next>=0?intervals[next].a:n;
   const u=clamp((i-a)/Math.max(1,b-a),0,1),lift=.09+.07*clamp((speed[i]-1.5)/3,0,1);
   feet[side].push(from.clone().lerp(to,smooth(u)).add(new Vector3(0,lift*Math.sin(Math.PI*u),0)));
  }
 }
 return {n,root,yaw,speed,phase,feet};
}

// World rotation whose local -Y points along `dir` with local +X as close as possible to `side`.
function aim(dir,side){const y=dir.clone().negate().normalize(),x=side.clone().addScaledVector(y,-side.dot(y)).normalize(),z=new Vector3().crossVectors(x,y);
 return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));}
// Pelvis height: as high as the feet allow (5 mm short of full reach), capped at standing height, then a running
// minimum and mean over +-5 frames so the pelvis does not jump up in the flight phase of a run.
function heights(sim){
 const {n,root,yaw,feet}=sim,raw=[];
 for(let i=0;i<n;i++){const heading=new Quaternion().setFromAxisAngle(up,yaw[i]);let height=THIGH+SHIN+ANKLE+HIP_DROP-.02;
  for(const side of [0,1]){const hip=root[i].clone().add(new Vector3(side===0?-HIP_X:HIP_X,0,0).applyQuaternion(heading)),ankle=feet[side][i].clone().setY(feet[side][i].y+ANKLE);
   const horizontal=Math.hypot(hip.x-ankle.x,hip.z-ankle.z),reach=THIGH+SHIN-.005;height=Math.min(height,ankle.y+Math.sqrt(Math.max(.01,reach*reach-horizontal*horizontal))+HIP_DROP);}
  raw.push(height);}
 const window=(a,i,f)=>f(a.slice(Math.max(0,i-5),i+6));
 const low=raw.map((_,i)=>window(raw,i,w=>Math.min(...w)));return low.map((_,i)=>window(low,i,w=>w.reduce((x,y)=>x+y,0)/w.length));
}
function frame(sim,i){
 const {root,yaw,feet,speed}=sim,heading=new Quaternion().setFromAxisAngle(up,yaw[i]),right=new Vector3(1,0,0).applyQuaternion(heading);
 const hipsAt=h=>root[i].clone().setY(h),height=sim.height[i];
 const hips=hipsAt(height),world={Hips:heading.clone()},local={};
 for(const side of [0,1]){const name=side===0?'Right':'Left',hip=new Vector3(side===0?-HIP_X:HIP_X,-HIP_DROP,0).applyQuaternion(heading).add(hips);
  const ankle=feet[side][i].clone();ankle.y+=ANKLE;const d=ankle.clone().sub(hip),r=clamp(d.length(),.05,THIGH+SHIN-1e-4);d.normalize();
  const forward=new Vector3(0,0,1).applyQuaternion(heading),bend=forward.addScaledVector(d,-forward.dot(d)).normalize();
  const along=(THIGH*THIGH+r*r-SHIN*SHIN)/(2*r),out=Math.sqrt(Math.max(0,THIGH*THIGH-along*along)),knee=hip.clone().addScaledVector(d,along).addScaledVector(bend,out);
  world[name+'Hip']=aim(knee.clone().sub(hip),right);world[name+'Knee']=aim(hip.clone().addScaledVector(d,r).sub(knee),right);
  world[name+'Ankle']=heading.clone();world[name+'Toe']=heading.clone();}
 // Arms hang and swing against the legs: the right arm forward while the left leg is forward.
 // Rotating a hanging limb by a negative angle about x swings it forward (+z).
 const swing=Math.cos(sim.phase[i]*Math.PI*2)*.35*clamp(speed[i]/2,0,1),pitchX=a=>new Quaternion().setFromAxisAngle(new Vector3(1,0,0),a);
 for(const [name,sign,phaseSign] of [['Right',1,1],['Left',-1,-1]]){
  const hang=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),sign*Math.PI/2*.92);
  world[name+'Shoulder']=heading.clone().multiply(pitchX(-phaseSign*swing)).multiply(hang);world[name+'Elbow']=heading.clone().multiply(pitchX(-phaseSign*swing-.35)).multiply(hang);
  world[name+'Collar']=heading.clone();world[name+'Wrist']=world[name+'Elbow'].clone();}
 for(const name of ['Chest','Chest2','Chest3','Chest4','Neck','Head'])world[name]=heading.clone();
 for(const [name,parent] of JOINTS)local[name]=parent?world[parent].clone().invert().multiply(world[name]):world[name];
 const deg=q=>{const e=new Euler().setFromQuaternion(q,'ZXY');return [e.z,e.x,e.y].map(a=>(a*180/Math.PI).toFixed(4));};
 return [...[hips.x,hips.y,hips.z].map(v=>(v*100).toFixed(4)),...JOINTS.flatMap(([name])=>deg(local[name]))].join(' ');
}
function write(file,sim){sim.height=heights(sim);fs.writeFileSync(file,hierarchy()+`MOTION\nFrames: ${sim.n}\nFrame Time: ${(1/FPS).toFixed(7)}\n`+Array.from({length:sim.n},(_,i)=>frame(sim,i)).join('\n')+'\n');}

// Profiles. FW: steady walks at 1.3-1.6 m/s. FR: a steady jog, a steady run, then a stop to a stand. TR1: a jog
// with alternating left (+yaw) and right turns of about 100 degrees over 0.8 s.
const ramp=(t,a,b,from,to)=>from+(to-from)*smooth(clamp((t-a)/(b-a),0,1));
const takes={
 FW:{seconds:24,speed:t=>t<1?ramp(t,0,1,0,1.3):t<12?1.3+ramp(t,5,6,0,.15):ramp(t,12,13,1.45,1.6),yawRate:()=>0,truth:{walkSpeeds:[1.3,1.45,1.6]}},
 FR:{seconds:22,speed:t=>t<8?ramp(t,0,1.5,0,3.1):t<16?ramp(t,8,9.5,3.1,4.8):ramp(t,16,17.3,4.8,0),yawRate:()=>0,truth:{jogSpeed:3.1,runSpeed:4.8,stopAt:16}},
 TR1:{seconds:20,speed:t=>ramp(t,0,1.5,0,3),yawRate:t=>{const k=Math.floor((t-3)/3),u=(t-3)-3*k;return t<3||u>.8?0:(k%2?-1:1)*(100*Math.PI/180)/.8*Math.sin(u/.8*Math.PI)*Math.PI/2;},truth:{turnDegrees:100,firstTurn:'left',turnSeconds:.8}},
};
fs.mkdirSync(DIR,{recursive:true});const truth={generated:'tools/anim/synthetic-100style.mjs',fps:FPS,leftTouchdownPhase:0,rightTouchdownPhase:.5,takes:{}},cuts={};
for(const [type,take] of Object.entries(takes)){const sim=simulate(take.seconds,take.speed,take.yawRate);write(path.join(DIR,`Neutral_${type}.bvh`),sim);cuts[type]=[0,sim.n];truth.takes[type]={frames:sim.n,...take.truth};}
fs.writeFileSync(path.join(DIR,'Frame_Cuts.csv'),'STYLE_NAME,'+Object.keys(cuts).flatMap(k=>[k+'_START',k+'_STOP']).join(',')+'\nNeutral,'+Object.values(cuts).flat().join(',')+'\n');
fs.writeFileSync(path.join(DIR,'truth.json'),JSON.stringify(truth,null,1));
console.log('wrote',DIR,JSON.stringify(truth.takes));
