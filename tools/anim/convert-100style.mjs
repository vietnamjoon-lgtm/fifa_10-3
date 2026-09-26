// Replace the CMU walk, jog, run, turn and stop clips in src/mocap-data.js with 100STYLE Neutral captures.
// The CMU kick is kept: 100STYLE has no kicks.
//
// 1. Download 100STYLE.zip (https://zenodo.org/records/8127870, CC BY 4.0) and extract the Neutral files, e.g.
//      unzip -j 100STYLE.zip '*/Neutral/*' '*Frame_Cuts.csv' -d ~/.cache/100style
//    (or set STYLE100_DIR). Only Neutral_FW.bvh, Neutral_FR.bvh and Neutral_TR1.bvh are read.
// 2. node tools/anim/convert-100style.mjs            -> writes src/mocap-data.js and tools/anim/100style-selection.json
//    node tools/anim/convert-100style.mjs --report   -> only prints the candidate tables
//
// Blender does the BVH import and armature evaluation (tools/anim/bvh-export.py); set BLENDER=/path/to/blender to use
// a Blender install, otherwise the `bpy` module from PyPI runs it through python3.
//
// Conventions (src/sides.js): legs[0]/arms[0] are the player's RIGHT side at x<0, the rig faces +z, game yaw is
// atan2(forward.x, forward.z). Every locomotion loop starts at a LEFT foot touchdown (legs[1]) and the right foot
// touchdown is warped to exactly half a cycle; motion.js samples the clips half a cycle ahead because gait.js plants
// legs[0] at phase 0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Vector3,Quaternion,Euler} from '../../vendor/three.module.js';
import {mocap as current} from '../../src/mocap-data.js';

const DIR=process.env.STYLE100_DIR||path.join(os.homedir(),'.cache','100style'),REPORT_ONLY=process.argv.includes('--report');
const OUT_DATA=process.env.OUT_DATA||'src/mocap-data.js',OUT_REPORT=process.env.OUT_REPORT||'tools/anim/100style-selection.json';
const MAX_TURN=Number(process.env.MAX_TURN||20),FPS=60,up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
// Neutral row of 100STYLE Frame_Cuts.csv: the stylised part of each take, in BVH frames (used if the CSV is absent).
const NEUTRAL_CUTS={FW:[327,7445],FR:[357,4227],TR1:[304,6775]};
function cuts(){
 const file=path.join(DIR,'Frame_Cuts.csv');if(!fs.existsSync(file))return NEUTRAL_CUTS;
 const [header,...rows]=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(l=>l.split(','));const row=rows.find(r=>r[0]==='Neutral');
 return Object.fromEntries(Object.keys(NEUTRAL_CUTS).map(k=>[k,[Number(row[header.indexOf(k+'_START')]),Number(row[header.indexOf(k+'_STOP')])]]));
}
function exported(type,[start,end]){
 const bvh=path.join(DIR,`Neutral_${type}.bvh`),json=path.join(DIR,'export',`Neutral_${type}_${start}_${end}.json`);
 if(!fs.existsSync(json)){
  if(!fs.existsSync(bvh))throw Error(`Missing ${bvh}. See the header of this file.`);
  fs.mkdirSync(path.dirname(json),{recursive:true});const script=new URL('./bvh-export.py',import.meta.url).pathname;
  if(process.env.BLENDER)execFileSync(process.env.BLENDER,['-b','-P',script,'--',bvh,json,String(start),String(end)],{stdio:'inherit'});
  else execFileSync('python3',[script,bvh,json,String(start),String(end)],{stdio:'inherit'});
 }
 const data=JSON.parse(fs.readFileSync(json,'utf8'));data.sha256=hash(bvh);return data;
}
function hash(file){try{return execFileSync('sha256sum',[file]).toString().split(' ')[0];}catch{return null;}}

const V=a=>new Vector3(...a),Q=a=>new Quaternion(...a);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
const smooth=t=>t*t*(3-2*t);

// Per-frame measurements in the source take, before retargeting.
function analyse(take){
 const f=take.frames,n=f.length,P=(i,name)=>V(f[i][name].p);
 const hipYaw=f.map((_,i)=>{const lateral=P(i,'LeftHip').sub(P(i,'RightHip'));return Math.atan2(-lateral.z,lateral.x);});
 const floor={};for(const s of ['Right','Left'])for(const j of ['Ankle','Toe'])floor[s+j]=percentile(f.map(fr=>fr[s+j].p[1]),.05);
 const speedOf=(i,name)=>{const a=P(Math.max(0,i-1),name),b=P(Math.min(n-1,i+1),name);return {h:Math.hypot(b.x-a.x,b.z-a.z)*FPS/2,v:Math.abs(b.y-a.y)*FPS/2};};
 // Contact: ankle (heel) or toe joint within 4 cm of its own floor level and nearly still. Index 0 = right.
 const contacts=f.map((fr,i)=>['Right','Left'].map(s=>{const low=[['Ankle',fr[s+'Ankle'].p[1]-floor[s+'Ankle']],['Toe',fr[s+'Toe'].p[1]-floor[s+'Toe']]].filter(([,h])=>h<.04);return low.some(([j])=>{const v=speedOf(i,s+j);return v.h<1.1&&v.v<.9;})?1:0;}));
 const touchdowns=[0,1].map(side=>{const list=[];let off=0;for(let i=0;i<n;i++){if(!contacts[i][side]){off++;continue;}if(off>=5)list.push(i);off=0;}return list;});
 const root=f.map((_,i)=>P(i,'Hips'));
 return {n,hipYaw,floor,contacts,touchdowns,root,rightTD:touchdowns[0],leftTD:touchdowns[1]};
}
// Heading = circular mean of the pelvis yaw over a window, so the pelvis keeps its own swing around it.
function headings(hipYaw,window){return hipYaw.map((_,i)=>{let s=0,c=0;for(let k=Math.max(0,i-(window>>1));k<=Math.min(hipYaw.length-1,i+(window>>1));k++){s+=Math.sin(hipYaw[k]);c+=Math.cos(hipYaw[k]);}return Math.atan2(s,c);});}

// Retarget one source frame to the 11 local rotations, 2 ankle rotations and the hip height used by motion.js.
function retarget(take,info,i,heading){
 const fr=take.frames[i],rest=take.rest,unheading=new Quaternion().setFromAxisAngle(up,-heading);
 const world=name=>unheading.clone().multiply(Q(fr[name].q));
 const restDir=name=>V(rest[name].tail).sub(V(rest[name].head)).normalize();
 // Limbs: the game's bind pose hangs every limb straight down, the BVH rest has T-pose arms.
 const limb=name=>world(name).multiply(new Quaternion().setFromUnitVectors(down,restDir(name)));
 const hip=world('Hips'),chest=world('Chest4'),head=world('Head');
 const quats=[hip,hip.clone().invert().multiply(chest),chest.clone().invert().multiply(head)],ankles=[],feet=[];
 for(const side of ['Right','Left']){
  const thigh=limb(side+'Hip'),shin=limb(side+'Knee');quats.push(hip.clone().invert().multiply(thigh),thigh.clone().invert().multiply(shin));
  // The foot's rest in the BVH is flat on the ground, like the game's foot bind pose.
  ankles.push(shin.clone().invert().multiply(world(side+'Ankle')));
  feet.push(new Vector3(side==='Right'?-.112:.112,-.075,0).applyQuaternion(hip).add(new Vector3(0,-.35,0).applyQuaternion(thigh)).add(new Vector3(0,-.459,.055).applyQuaternion(shin)));
 }
 for(const side of ['Right','Left']){const upper=limb(side+'Shoulder'),lower=limb(side+'Elbow');quats.push(chest.clone().invert().multiply(upper),upper.clone().invert().multiply(lower));}
 const toe=Math.min(fr.RightToe.p[1]-info.floor.RightToe,fr.LeftToe.p[1]-info.floor.LeftToe),flight=Math.max(0,toe-.018)*.9;
 const hipY=Math.max(.55,Math.min(1.06,-Math.min(...feet.map(v=>v.y))+.025+flight));
 return {hipY,rotations:quats.map(q=>q.normalize()),ankles:ankles.map(q=>q.normalize()),contacts:info.contacts[i],heading,
  source:Object.fromEntries(Object.entries(fr).map(([name,v])=>[name,v.q.map(x=>Math.round(x*1e5)/1e5)]))};
}
const poseError=(a,b)=>a.rotations.reduce((n,q,j)=>n+q.angleTo(b.rotations[j])**2*(j>=7?.5:1),0)+((a.hipY-b.hipY)*10)**2;

// Cycle candidates: every left touchdown to the next left touchdown.
function cycles(take,info){
 const out=[],L=info.leftTD;
 for(let k=0;k+1<L.length;k++){
  const a=L[k],b=L[k+1],len=b-a;if(len<24||len>90)continue;
  const rights=info.rightTD.filter(t=>t>a&&t<b);if(rights.length!==1)continue;
  const travel=Math.hypot(info.root[b].x-info.root[a].x,info.root[b].z-info.root[a].z),speed=travel/(len/FPS);
  const heading=headings(info.hipYaw,len),turn=Math.abs(wrap(heading[b]-heading[a]))*180/Math.PI;
  const neighbours=[k-1,k+1].filter(j=>j>=0&&j+1<L.length).map(j=>Math.hypot(info.root[L[j+1]].x-info.root[L[j]].x,info.root[L[j+1]].z-info.root[L[j]].z)/((L[j+1]-L[j])/FPS));
  const steady=neighbours.length?Math.max(...neighbours.map(s=>Math.abs(s-speed)/speed)):1;
  const first=retarget(take,info,a,heading[a]),last=retarget(take,info,b,heading[b]);
  const flightFrames=info.contacts.slice(a,b).filter(c=>!c[0]&&!c[1]).length;
  out.push({start:a+take.start,end:b+take.start,a,b,frames:len+1,seconds:+(len/FPS).toFixed(3),speed:+speed.toFixed(2),cadence:+(120*FPS/len).toFixed(0),rightAt:+((rights[0]-a)/len).toFixed(3),turnDegrees:+turn.toFixed(1),speedChange:+steady.toFixed(3),loopError:+poseError(first,last).toFixed(4),flight:+(flightFrames/len).toFixed(2),heading});
 }
 return out;
}
function pick(list,target,label){
 const score=c=>Math.abs(c.speed-target)/target*4+c.loopError*6+c.turnDegrees/8+c.speedChange*4+Math.abs(c.rightAt-.5)*4;
 const ranked=list.filter(c=>c.turnDegrees<MAX_TURN&&c.speedChange<.15).map(c=>({...c,score:+score(c).toFixed(3)})).sort((x,y)=>x.score-y.score);
 if(!ranked.length&&!REPORT_ONLY)throw Error('No steady cycle for '+label);
 return ranked;
}

// Build a loop: frames a..b resampled so the right touchdown lands at exactly 0.5, seam corrected on every joint.
function loop(take,info,c){
 const n=c.b-c.a,right=c.rightAt*n,raw=[];for(let i=c.a;i<=c.b;i++)raw.push(retarget(take,info,i,c.heading[i]));
 const at=u=>{const s=u<=.5?u/.5*right:right+(u-.5)/.5*(n-right),i=Math.min(n-1,Math.floor(s)),t=s-i,A=raw[i],B=raw[i+1];
  return {hipY:A.hipY+(B.hipY-A.hipY)*t,rotations:A.rotations.map((q,j)=>q.clone().slerp(B.rotations[j],t)),ankles:A.ankles.map((q,j)=>q.clone().slerp(B.ankles[j],t)),contacts:t<.5?A.contacts:B.contacts,source:t<.5?A.source:B.source,heading:A.heading,index:c.a+(t<.5?i:i+1)};};
 const frames=Array.from({length:n+1},(_,k)=>at(k/n));
 // Distribute the end-to-start mismatch over the whole cycle, then match angular velocity across the seam.
 for(const key of ['rotations','ankles'])for(let j=0;j<frames[0][key].length;j++){
  const first=frames[0][key][j].clone(),correction=frames[n][key][j].clone().invert().multiply(first);
  for(let i=1;i<=n;i++){const t=smooth(i/n);frames[i][key][j]=frames[i][key][j].clone().multiply(new Quaternion().slerp(correction,t)).normalize();}
  frames[n][key][j]=first.clone();const delta=first.clone().invert().multiply(frames[1][key][j]),before=first.clone().multiply(delta.clone().invert());
  for(let i=n-4;i<n;i++)frames[i][key][j]=frames[i][key][j].clone().slerp(before,((i-(n-4))/3)**2).normalize();
 }
 const dy=frames[0].hipY-frames[n].hipY;for(let i=0;i<=n;i++)frames[i].hipY+=dy*smooth(i/n);frames[n-1].hipY=2*frames[0].hipY-frames[1].hipY;
 frames[n].contacts=[...frames[0].contacts];
 return frames;
}
function segment(take,info,a,b,window){const heading=headings(info.hipYaw,window),out=[];for(let i=a;i<=b;i++)out.push({...retarget(take,info,i,heading[i]),index:i});return out;}

function clip(name,type,take,frames,extra){
 const r=v=>Math.round(v*1e4)/1e4,rq=q=>q.clone().normalize().toArray();
 const first=take.frames[frames[0].index].Hips.p,headingStart=frames[0].heading;
 const rootTrajectory=frames.map((f,i)=>{const p=take.frames[f.index].Hips.p,prev=take.frames[Math.max(0,f.index-1)].Hips.p;return {time:+(i/FPS).toFixed(4),position:[r(p[0]-first[0]),r(p[1]),r(p[2]-first[2])],heading:r(wrap(f.heading-headingStart)),velocity:[0,1,2].map(k=>r((p[k]-prev[k])*FPS))};});
 const localRotations=frames.map(f=>f.rotations.map(rq)),data=frames.map((f,i)=>[r(f.hipY),...localRotations[i].flatMap(q=>{const e=new Euler().setFromQuaternion(new Quaternion(...q),'XYZ');return [e.x,e.y,e.z];})]);
 return {id:'100style-neutral-'+type.toLowerCase()+'-'+(frames[0].index+take.start),source:`100STYLE Neutral_${type}.bvh frames ${frames[0].index+take.start}-${frames.at(-1).index+take.start}`,sourceRate:FPS,
  frames:data,localRotations,ankleRotations:frames.map(f=>f.ankles.map(rq)),sourceJointRotations:frames.map(f=>f.source),rootTrajectory,localTranslations:data.map(f=>[0,f[0],0]),contacts:frames.map(f=>[...f.contacts]),
  duration:+((frames.length-1)/FPS).toFixed(6),contact:null,foot:'both',events:[],tags:{action:name,foot:'both',style:'Neutral'},warpLimits:{time:[.75,1.4],translation:.22,rotation:.5},partnerAnchors:[],
  reference:{type:'100STYLE motion capture (Mason, Starke and Komura 2022), CC BY 4.0',ballTracked:false},...extra};
}

const cut=cuts(),takes={},infos={};
for(const type of ['FW','FR','TR1']){takes[type]=exported(type,cut[type]);infos[type]=analyse(takes[type]);}
const summary=c=>{const {heading,a,b,...rest}=c;return rest;};
const walkCandidates=pick(cycles(takes.FW,infos.FW),1.45,'walk'),runCycles=cycles(takes.FR,infos.FR);
const jogCandidates=pick(runCycles,3.1,'jog'),runCandidates=pick(runCycles.filter(c=>c.speed>Number(process.env.RUN_MIN||4.2)),Math.max(0,...runCycles.filter(c=>c.turnDegrees<MAX_TURN&&c.speedChange<.15).map(c=>c.speed)),'run');
// Turn: a left turn (game yaw increasing; motion.js mirrors it for right turns) of 70-150 degrees within 0.5-1.1 s.
function turnCandidates(){const take=takes.TR1,info=infos.TR1,h=headings(info.hipYaw,40),out=[];
 for(let a=0;a+30<info.n;a+=3)for(const len of [30,36,42,48,54,60,66]){const b=a+len;if(b>=info.n)break;const turn=wrap(h[b]-h[a])*180/Math.PI;if(turn<70||turn>150)continue;
  const speed=Math.hypot(info.root[b].x-info.root[a].x,info.root[b].z-info.root[a].z)/(len/FPS),entry=Math.hypot(info.root[a+6].x-info.root[a].x,info.root[a+6].z-info.root[a].z)/(6/FPS);
  out.push({start:a+take.start,end:b+take.start,a,b,seconds:+(len/FPS).toFixed(3),turnDegrees:+turn.toFixed(1),speed:+speed.toFixed(2),entrySpeed:+entry.toFixed(2),score:+(Math.abs(turn-100)/40+Math.abs(len/FPS-.8)+Math.max(0,2-entry)*.3).toFixed(3)});}
 out.sort((x,y)=>x.score-y.score);const distinct=[];for(const c of out)if(distinct.every(d=>Math.abs(d.a-c.a)>60))distinct.push(c);return distinct;}
// Stop: forward running or walking that settles to a stand; motion.js reads the last 0.7 s as speed 8 -> 0 m/s.
function stopCandidates(){const out=[];for(const type of ['FR','FW']){const take=takes[type],info=infos[type],n=info.n,s=[];for(let i=0;i<n;i++){const a=info.root[Math.max(0,i-6)],b=info.root[Math.min(n-1,i+6)];s.push(Math.hypot(b.x-a.x,b.z-a.z)*FPS/12);}
 for(let e=90;e<n-30;e++){if(s[e]>.25||s[e-1]<=.25)continue;let a=e;while(a>0&&s[a-1]>s[a]-.02&&e-a<150)a--;const peak=s[a];if(peak<Number(process.env.STOP_MIN||2))continue;const hold=Math.max(...s.slice(e,e+30));if(hold>.35)continue;
  out.push({type,start:a+take.start,end:e+18+take.start,a,b:Math.min(n-1,e+18),seconds:+((e+18-a)/FPS).toFixed(3),entrySpeed:+peak.toFixed(2),decelSeconds:+((e-a)/FPS).toFixed(3),score:+(Math.abs(peak-4)/2+Math.abs((e-a)/FPS-1.1)+(type==='FW'?1:0)).toFixed(3)});}}
 return out.sort((x,y)=>x.score-y.score);}
const turns=turnCandidates(),stops=stopCandidates();
const tables={walk:walkCandidates.slice(0,6).map(summary),jog:jogCandidates.slice(0,6).map(summary),run:runCandidates.slice(0,6).map(summary),turn:turns.slice(0,6).map(({a,b,...c})=>c),stop:stops.slice(0,6).map(({a,b,...c})=>c),
 all:{walk:cycles(takes.FW,infos.FW).map(c=>[c.start,c.speed,c.turnDegrees,c.speedChange,c.loopError,c.rightAt]),run:runCycles.map(c=>[c.start,c.speed,c.turnDegrees,c.speedChange,c.loopError,c.rightAt])}};
if(REPORT_ONLY){console.log(JSON.stringify(tables,null,1));process.exit(0);}
if(!turns.length||!stops.length)throw Error('No turn or stop candidate');

const output={source:'100STYLE (walk, jog, run, turn, stop) and Carnegie Mellon University Graphics Lab Motion Capture Database (kick)',url:'https://zenodo.org/records/8127870',fps:60,schemaVersion:2,rigVersion:'touchline-2',contactConfidence:'estimated_from_foot_height_and_velocity',phaseConvention:'locomotion loops start at a left-foot (legs[1]) touchdown; right-foot touchdown at 0.5'};
for(const [name,type,c] of [['walk','FW',walkCandidates[0]],['jog','FR',jogCandidates[0]],['run','FR',runCandidates[0]]])
 output[name]=clip(name,type,takes[type],loop(takes[type],infos[type],c),{loop:true,speed:c.speed,cadence:c.cadence,sourceRightTouchdown:c.rightAt});
const t=turns[0],s=stops[0];
output.turn=clip('turn','TR1',takes.TR1,segment(takes.TR1,infos.TR1,t.a,t.b,40),{turnDegrees:t.turnDegrees,turnDirection:'left'});
output.stop=clip('stop',s.type,takes[s.type],segment(takes[s.type],infos[s.type],s.a,s.b,40),{entrySpeed:s.entrySpeed});
output.kick=current.kick;
const order=['source','url','fps','schemaVersion','rigVersion','contactConfidence','phaseConvention','run','kick','walk','jog','turn','stop'];
const ordered=Object.fromEntries(order.map(k=>[k,output[k]]));
fs.writeFileSync(OUT_DATA,'// walk/jog/run/turn/stop: 100STYLE Neutral (Mason, Starke, Komura 2022, CC BY 4.0), converted by tools/anim/convert-100style.mjs.\n// kick: retargeted CMU 10_01 (licenses/CMU-MOCAP.txt). Credits in CREDITS.md.\nexport const mocap='+JSON.stringify(ordered)+';\n');
const report={generated:'tools/anim/convert-100style.mjs',sources:Object.fromEntries(Object.entries(takes).map(([k,v])=>[`Neutral_${k}.bvh`,{cut:cut[k],frames:v.frames.length,fps:v.fps,sha256:v.sha256}])),chosen:{walk:summary(walkCandidates[0]),jog:summary(jogCandidates[0]),run:summary(runCandidates[0]),turn:(({a,b,...c})=>c)(t),stop:(({a,b,...c})=>c)(s)},candidates:tables};
fs.writeFileSync(OUT_REPORT,JSON.stringify(report,null,1));
console.log(JSON.stringify(report.chosen,null,1));
