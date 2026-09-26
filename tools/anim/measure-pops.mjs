// Joint pop count for an AI-vs-AI match, rebuilt from the conditions in docs/MOTION-POPS.md.
// Usage: node tools/anim/measure-pops.mjs [out.json] [seconds] [seed,seed,...]
// - Match at 120 Hz, animatePlayer once per step on the 13-bone fixture rig (final rotations, after IK).
// - LOD as in main.js at game camera distance: only the controlled player keeps contactDetail, the rest are distant.
// - Pop: one step (1/120 s) rotates a joint by >= 15 deg and by >= 3x the median of the 3 steps on each side.
import fs from 'node:fs';
import {register} from 'node:module';
register('../three-loader.mjs',import.meta.url);
const THREE=await import('../../vendor/three.module.js');
const {animatePlayer}=await import('../../src/player.js');
const {Match}=await import('../../src/match.js');
const {defaults}=await import('../../src/settings.js');
const {fixture}=await import('../human-fixture.mjs');
const [out='reports/anim-pops.json',secondsArg='60',seedArg='1,2,3,4,5']=process.argv.slice(2);
const SECONDS=Number(secondsArg),SEEDS=seedArg.split(',').map(Number),DT=1/120,LIMIT=15*Math.PI/180;
const JOINTS=['hips','torso','head','rThigh','rShin','rFoot','lThigh','lShin','lFoot','rUpperArm','rForearm','lUpperArm','lForearm'];
const bones=rig=>[rig.hips,rig.torso,rig.head,rig.legs[0].upper,rig.legs[0].lower,rig.legs[0].foot,rig.legs[1].upper,rig.legs[1].lower,rig.legs[1].foot,rig.arms[0].upper,rig.arms[0].lower,rig.arms[1].upper,rig.arms[1].lower];
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[s.length>>1]:0;};
const LOCOMOTION=new Set(['run','sprint','start','stop','turn','close-control','backpedal']);
function measure(seed){
 const m=new Match({...defaults,seed});m.start(false);m.autoplay=true;
 const rigs=new Map(m.players.map(p=>[p.id,fixture(p)]));
 const tracks=new Map(m.players.map(p=>[p.id,{q:[],state:[],speed:[],capture:[]}]));
 for(let step=0;step<SECONDS*120;step++){
  m.step(DT,{axis:{x:0,z:0}});
  for(const p of m.players){
   const rig=rigs.get(p.id),t=tracks.get(p.id);rig.contactDetail=p===m.controlled;rig.distant=!rig.contactDetail;
   rig.root.position.set(p.x,0,p.z);rig.root.rotation.y=p.yaw;
   const speed=Math.hypot(p.vx,p.vz);animatePlayer(rig,speed,DT,m.time,false,p,m.physics.ball.position);
   t.q.push(bones(rig).map(b=>b.quaternion.clone()));t.state.push(p.action?'action-'+p.action.type:rig.motionState);t.speed.push(speed);t.capture.push(rig.motionHistory?.capture??0);
  }
 }
 const pops=[];let locomotionSteps=0,locomotionTurn=0;const captureTurn=new Array(JOINTS.length).fill(0);let captureSteps=0;
 for(const [id,t] of tracks){
  const deltas=JOINTS.map((_,j)=>t.q.map((q,i)=>i?t.q[i-1][j].angleTo(q[j]):0));
  for(let i=1;i<t.q.length;i++){
   const loco=LOCOMOTION.has(t.state[i])&&t.speed[i]>.25;if(loco)locomotionSteps++;
   if(t.capture[i]>.5&&t.speed[i]>1){captureSteps++;for(let j=0;j<JOINTS.length;j++)captureTurn[j]+=deltas[j][i];}
   for(let j=0;j<JOINTS.length;j++){
    const d=deltas[j][i];if(loco)locomotionTurn+=d;if(d<LIMIT)continue;
    const around=[...deltas[j].slice(Math.max(1,i-3),i),...deltas[j].slice(i+1,i+4)];if(d<3*median(around))continue;
    pops.push({player:id,time:+(i*DT).toFixed(4),joint:JOINTS[j],degrees:+(d*180/Math.PI).toFixed(1),state:t.state[i],from:t.state[i-1],speed:+t.speed[i].toFixed(2),capture:+t.capture[i].toFixed(2)});
   }
  }
 }
 const count=(key)=>pops.reduce((n,p)=>(n[p[key]]=(n[p[key]]||0)+1,n),{});
 const inCapture=pops.filter(p=>p.capture>.05&&!p.state.startsWith('action')).length,transition=pops.filter(p=>p.state!==p.from).length;
 return {seed,total:pops.length,inCapture,atStateChange:transition,maxDegrees:Math.max(0,...pops.map(p=>p.degrees)),byJoint:count('joint'),byState:count('state'),
  // Mean rotation per step (deg) of each joint while the captured gait is mostly on: a smoothness reference, not a pop count.
  captureMeanStepDegrees:Object.fromEntries(JOINTS.map((n,j)=>[n,+(captureTurn[j]/Math.max(1,captureSteps)*180/Math.PI).toFixed(3)])),captureSteps,pops};
}
const runs=SEEDS.map(seed=>{const r=measure(seed);console.log('seed',seed,'pops',r.total,'in capture',r.inCapture,'max',r.maxDegrees);return r;});
const mean=f=>+(runs.reduce((n,r)=>n+f(r),0)/runs.length).toFixed(1);
const summary={seconds:SECONDS,seeds:SEEDS,meanTotal:mean(r=>r.total),meanInCapture:mean(r=>r.inCapture),meanAtStateChange:mean(r=>r.atStateChange),meanMax:mean(r=>r.maxDegrees),
 perSeed:runs.map(r=>({seed:r.seed,total:r.total,inCapture:r.inCapture,atStateChange:r.atStateChange,max:r.maxDegrees})),
 meanByJoint:Object.fromEntries(JOINTS.map(j=>[j,mean(r=>r.byJoint[j]||0)]))};
fs.writeFileSync(out,JSON.stringify({summary,runs:runs.map(({pops,...r})=>({...r,pops:pops.slice(0,400)}))},null,1));
console.log(JSON.stringify(summary,null,1));
