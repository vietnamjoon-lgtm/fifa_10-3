// Reproducible pre-rebuild measurements. No renderer, storage, or gameplay mutations.
import fs from 'node:fs';
import {register} from 'node:module';
register('./three-loader.mjs',import.meta.url);
const THREE=await import('../vendor/three.module.js');
const {animatePlayer}=await import('../src/player.js');
const {configureBodyRig}=await import('../src/body-rig.js');
const {Match}=await import('../src/match.js');
const {defaults}=await import('../src/settings.js');
const {interpolatePlayer}=await import('../src/render-state.js');
const {jointViolations}=await import('../src/human-kinematics.js');
const {mocap}=await import('../src/mocap-data.js');
const {locomotionCadence,stanceFraction}=await import('../src/motion-planner.js');
import {fixture} from './human-fixture.mjs';
const copy=p=>({...p,action:p.action?{...p.action}:null});
function scenario(team,sprint,seed,kind){
 const m=new Match({...defaults,userTeam:team,seed});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled,dir=m.direction(team);p.x=-dir*18;p.z=0;p.target={x:p.x,z:p.z};p.yaw=dir*Math.PI/2;m.physics.reset(p.x+dir*.54,-dir*.11);m.owner=p;
 for(const other of m.players)other.active=other===p;
 const rig=fixture(p),dt=1/960,previous=[null,null],vel=[null,null],start=[null,null];let maxEvent=null,maxFootSpeed=0,maxFootAcceleration=0,maxPlantTravel=0,violations=0,jointRangeFrames=0,frames=0,crab=0,random=seed,next=0,axis={x:dir,z:0},running=sprint;
 const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296;};
 for(let tick=0;tick<12*120;tick++){
  const t=tick/120;
  if(kind==='random'&&t>=next){const angle=Math.floor(rand()*8)*Math.PI/4;axis=rand()<.1?{x:0,z:0}:{x:Math.cos(angle),z:Math.sin(angle)};if(rand()<.25)running=!running;next=t+.15+rand()*.65;}
  else if(kind!=='random'){const angle=t<3?0:t<6?Math.PI/4:t<9?Math.PI/2:Math.PI;axis={x:dir*Math.cos(angle),z:Math.sin(angle)};}
  if(Math.abs(p.x)>40)axis.x=-Math.sign(p.x);if(Math.abs(p.z)>25)axis.z=-Math.sign(p.z);
  const before=copy(p);m.step(1/120,{axis,sprint:running});const after=copy(p);
  for(let sub=1;sub<=8;sub++){
   const state=interpolatePlayer(before,after,sub/8),speed=Math.hypot(state.vx,state.vz);rig.root.position.x=state.x;rig.root.position.z=state.z;rig.root.rotation.y=state.yaw;
   animatePlayer(rig,speed,dt,t+sub*dt,false,state,m.physics.ball.position);rig.root.updateMatrixWorld(true);
   if(speed>.5&&Math.abs(Math.atan2(Math.sin(Math.atan2(state.vx,state.vz)-state.yaw),Math.cos(Math.atan2(state.vx,state.vz)-state.yaw)))>Math.PI/4)crab++;
   for(let i=0;i<2;i++){const pos=rig.legs[i].foot.getWorldPosition(new THREE.Vector3());if(previous[i]&&t>.5){const v=pos.clone().sub(previous[i]).divideScalar(dt),s=v.length();if(s>maxFootSpeed){maxFootSpeed=s;maxEvent={t,sub,i,speed,state:rig.motionState,match:m.state,before:[before.x,before.z,before.yaw],after:[after.x,after.z,after.yaw],from:previous[i].toArray(),to:pos.toArray(),hipY:rig.hips.position.y,phase:rig.phase,plantError:rig.plantError,feet:structuredClone(rig.plantState?.feet),action:state.action?.type};}if(s>2.2*speed+2)violations++;if(vel[i])maxFootAcceleration=Math.max(maxFootAcceleration,v.distanceTo(vel[i])/dt);vel[i]=v;}
    previous[i]=pos;const lock=rig.plantState?.feet[i];if(lock){if(start[i]?.since!==lock.since)start[i]={since:lock.since,pos:pos.clone()};maxPlantTravel=Math.max(maxPlantTravel,Math.hypot(pos.x-start[i].pos.x,pos.z-start[i].pos.z));}else start[i]=null;
   }if(jointViolations(rig).length)jointRangeFrames++;frames++;
  }
 }
 return {team,sprint,seed,kind,maxEvent,maxFootSpeed,maxFootAcceleration,maxPlantTravel,violations,jointRangeFrames,frames,crabFraction:crab/frames};
}
const results=[];for(const team of [0,1])for(const sprint of [false,true])for(const [kind,seeds]of [['turns',[17]],['random',[17,43,97,113]]]){for(const seed of seeds)results.push(scenario(team,sprint,seed,kind));console.log('Measured',team,sprint,kind);}
const repeat=scenario(0,false,17,'random'),original=results.find(x=>x.team===0&&!x.sprint&&x.seed===17&&x.kind==='random');
const report={revision:process.argv[2]||'working-tree',scope:'Actual animatePlayer on the original 13-bone bind skeleton; Match 120 Hz, bones 960 Hz, fresh rig per scenario. Excludes mesh collision, GPU and subframe target scan.',repeatIdentical:JSON.stringify(repeat)===JSON.stringify(original),results,gait:[1.3,3.5,5.5,8.5].map(speed=>({speed,stepsPerMinute:locomotionCadence(speed,'balanced',{height:1.81})/(2*Math.PI)*120,stance:stanceFraction(speed),contactSeconds:stanceFraction(speed)/(locomotionCadence(speed,'balanced',{height:1.81})/(2*Math.PI))})),capture:Object.fromEntries(Object.entries(mocap).filter(([,clip])=>clip.frames).map(([name,clip])=>[name,{duration:clip.duration,frames:clip.frames.length,contactFraction:clip.contacts?.[0]? [0,1].map(i=>clip.contacts.reduce((n,c)=>n+c[i],0)/clip.contacts.length):null}]))};
fs.writeFileSync(process.argv[3]||'reports/human-baseline.json',JSON.stringify(report,null,2));console.log(JSON.stringify({repeatIdentical:report.repeatIdentical,maxFootSpeed:Math.max(...results.map(r=>r.maxFootSpeed)),maxPlantTravel:Math.max(...results.map(r=>r.maxPlantTravel)),gait:report.gait,capture:report.capture},null,2));
