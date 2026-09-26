import {sideIndex} from './sides.js';
import * as THREE from '../vendor/three.module.js';
import {decayOffset} from './inertial-motion.js';
import {locomotionCadence,stanceFraction} from './motion-planner.js';
const down=new THREE.Vector3(0,-1,0),v=new THREE.Vector3(),q=new THREE.Quaternion();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>t*t*(3-2*t),liftFade=.075,gaitSoft=.04,hipRise=.04;

// Soft IK: near full extension the knee angle changes without bound per millimetre of target
// travel, so a leg reaching for a target just past its length straightened or bent in one
// render step. Within `soft` of full length the reach approaches the limit exponentially.
const softReach=(r,length,soft)=>{const start=length-soft;return soft>0&&r>start?start+soft*(1-Math.exp(-(r-start)/soft)):r;};
// Analytic two-bone IK in world space. Clamp unreachable targets; never stretch limbs.
export function solveFoot(rig,index,target,soft=0){
 const leg=rig.legs[index];rig.root.updateWorldMatrix(true,false);
 const hip=leg.upper.getWorldPosition(new THREE.Vector3()),knee=leg.lower.getWorldPosition(new THREE.Vector3()),ankle=leg.foot.getWorldPosition(new THREE.Vector3());
 const a=hip.distanceTo(knee),b=knee.distanceTo(ankle),direction=target.clone().sub(hip),requested=direction.length(),r=clamp(softReach(requested,a+b,soft),Math.abs(a-b)+.001,a+b-.001);direction.normalize();
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
 const bend=forward.addScaledVector(direction,-forward.dot(direction));if(bend.lengthSq()<.001)bend.set(1,0,0);bend.normalize();
 const projection=(a*a+r*r-b*b)/(2*r),height=Math.sqrt(Math.max(0,a*a-projection*projection));
 const kneeTarget=hip.clone().addScaledVector(direction,projection).addScaledVector(bend,height),end=hip.clone().addScaledVector(direction,r);
 const parentQ=leg.upper.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 leg.upper.quaternion.setFromUnitVectors(down,kneeTarget.clone().sub(hip).normalize().applyQuaternion(parentQ));rig.root.updateWorldMatrix(true,false);
 const kneeQ=leg.lower.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 leg.lower.quaternion.setFromUnitVectors(down,end.clone().sub(kneeTarget).normalize().applyQuaternion(kneeQ));rig.root.updateWorldMatrix(true,false);
 const footQ=leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),rootQ=rig.root.getWorldQuaternion(new THREE.Quaternion());leg.foot.quaternion.copy(footQ.multiply(rootQ));rig.root.updateWorldMatrix(true,false);
 return {error:leg.foot.getWorldPosition(v).distanceTo(target),clamped:requested>r+.005};
}
export function stabilizeFeet(rig,p,pose,dt){
 if(pose.gaitTargets&&!p.action&&!p.down&&!p.dive){stabilizeGait(rig,p,pose,dt);return;}
 // Distant non-contact limbs use the phase-matched capture. Keep exact IK for every kick.
 if(rig.distant&&!rig.contactDetail&&!p.action){rig.plantState=null;rig.plantLocks=0;rig.plantError=0;return;}
 rig.root.updateWorldMatrix(true,false);const speed=Math.hypot(p.vx||0,p.vz||0),state=rig.plantState||(rig.plantState={feet:[null,null],root:null,time:0});
 state.mode='contact';
 const root=rig.root.getWorldPosition(new THREE.Vector3()),teleport=state.root&&state.root.distanceTo(root)>1.2;state.root=root;state.time+=dt;
 const action=p.action,ground=!p.down&&!p.dive&&!action?.aerial&&!['slide','fall','recover','celebrate','feint'].includes(pose.state);
 const size=rig.root.scale.y,sole=.075*size;
 let error=0,locks=0;
 for(let i=0;i<2;i++){
  const leg=rig.legs[i],cycle=((rig.phase/(Math.PI*2)+i*.5)%1+1)%1;
  if(ground&&pose.gaitTargets){const g=pose.gaitTargets[i],target=rig.root.localToWorld(new THREE.Vector3(g.x,g.y,g.z));solveFoot(rig,i,target);}
  const current=leg.foot.getWorldPosition(new THREE.Vector3());
  const kickIndex=sideIndex(action?.foot),kicking=action&&['shoot','pass','through','lob'].includes(action.type),fromContact=kicking?action.elapsed-action.contactAt:0;
  // Raise the ball-contact IK over 0.125 s before the contact window and lower it over
  // 0.18 s after, instead of switching the kicking leg onto the ball in one render step.
  const reach=!kicking||i!==kickIndex?0:fromContact<-.055?smooth(clamp((fromContact+.18)/.125,0,1)):fromContact>.055?1-smooth(clamp((fromContact-.055)/.18,0,1)):1,impact=reach>0;
  if(impact&&action.contactTarget){
   state.feet[i]=null;const b=action.contactTarget,f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));
   const target=new THREE.Vector3(b.x,b.y,b.z).addScaledVector(f,-.06*size);target.y=Math.max(sole,b.y-.025*size);
   // After contact the boot eases out from where it met the ball relative to the body; a
   // world-fixed target left the leg trailing behind a player who kept running.
   if(fromContact<=.055)state.kickLocal={id:action.id,point:rig.root.worldToLocal(target.clone())};
   else if(state.kickLocal?.id===action.id)target.copy(rig.root.localToWorld(state.kickLocal.point.clone()));
   const solved=solveFoot(rig,i,reach<1?current.clone().lerp(target,reach):target);if(Math.abs(fromContact)<.055){rig.impactError=solved.error;rig.impactClamped=solved.clamped;}continue;
  }
  const receiving=pose.state.startsWith('receive'),receive=p.receivePrep||p.receive,receiveIndex=sideIndex(receive?.foot);
  if(receiving&&p.receive?.target&&i===(sideIndex(p.receive.foot))){
   const r=p.receive,age=(p.sampleTime??r.contactTime??0)-(r.contactTime??0),b=r.target;
   if(b.y<=.65&&age>=-.1&&age<.16){const target=new THREE.Vector3(b.x,b.y-.025,b.z),f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));target.addScaledVector(f,-.06*size);target.y=Math.max(sole,target.y);const hip=leg.upper.getWorldPosition(new THREE.Vector3());const inReach=clamp((.74*size-hip.distanceTo(target))/(.06*size),0,1);if(inReach>0){const upper=leg.upper.quaternion.clone(),lower=leg.lower.quaternion.clone(),foot=leg.foot.quaternion.clone(),weight=.72*inReach*(age<0?smooth((age+.1)/.1):1-age/.16);solveFoot(rig,i,target);leg.upper.quaternion.slerp(upper,1-weight);leg.lower.quaternion.slerp(lower,1-weight);leg.foot.quaternion.slerp(foot,1-weight);state.feet[i]=null;continue;}}
  }
  const plant=ground&&(!receiving||i!==receiveIndex)&&(!kicking||i!==kickIndex)&&(kicking||(pose.contacts?pose.contacts[i]>.5:speed<.2||cycle<.5));
  if(!plant||teleport||current.y>sole+.20){state.release||=[null,null];if(state.feet[i]&&ground&&!teleport)state.release[i]={offset:state.feet[i].position.clone().sub(current),age:0};state.feet[i]=null;const release=state.release[i];if(release&&ground&&!teleport&&release.age<.16){const t=release.age;solveFoot(rig,i,current.clone().addScaledVector(release.offset,(1-Math.min(1,t/.16))**3*(1+3*Math.min(1,t/.16))));release.age+=dt;}else state.release[i]=null;continue;}if(state.release)state.release[i]=null;
  const anchor=state.feet[i];
  if(!anchor){state.feet[i]={position:new THREE.Vector3(current.x,sole,current.z),since:state.time};}
  const goal=state.feet[i].position,hip=leg.upper.getWorldPosition(new THREE.Vector3());
  // Keep the same anchor until lift-off. Dropping it at the reach boundary
  // teleported the ankle back to the unrelated swing pose in one render step.
  const result=solveFoot(rig,i,goal);error=Math.max(error,result.error);locks++;
 }
 rig.plantError=error;rig.plantLocks=locks;
}

// Contact state machine. A landing starts at the current swing position, and a
// lift-off starts at the planted position. Neither event switches to an unrelated
// animation pose. Release curves have zero residual at their finite endpoint.
function stabilizeGait(rig,p,pose,dt){
 const state=rig.plantState||(rig.plantState={feet:[null,null],time:0}),size=rig.root.scale.y,sole=.075*size;
 if(state.mode!=='gait'){state.feet=[null,null];state.release=[null,null];state.previous=rig.legs.map(l=>l.foot.getWorldPosition(new THREE.Vector3()));state.previousBase=[null,null];state.earlyLift=[false,false];state.mode='gait';}
 state.time+=dt;state.release||=[null,null];state.previous||=[null,null];state.previousBase||=[null,null];state.earlyLift||=[false,false];
 const targets=[],root=rig.root.getWorldPosition(new THREE.Vector3()),teleport=state.root&&root.distanceTo(state.root)>1.2;state.root=root;
 for(let i=0;i<2;i++){
  const g=pose.gaitTargets[i],base=rig.root.localToWorld(new THREE.Vector3(g.x,g.y,g.z));let planted=pose.contacts[i]>.5;
  if(!planted)state.earlyLift[i]=false;
  const support=state.feet[i];if(planted&&support){const hip=rig.legs[i].upper.getWorldPosition(new THREE.Vector3()),reach=(rig.bodyMetrics.upperLeg+rig.bodyMetrics.lowerLeg)*size;
   const vertical=Math.max(0,hip.y-sole-.045*size),available=Math.sqrt(Math.max(.01,reach*reach-vertical*vertical));
   if(Math.hypot(hip.x-support.position.x,hip.z-support.position.z)>Math.min(.62*reach,.96*available))state.earlyLift[i]=true;
  }
  if(state.earlyLift[i])planted=false;
  if(teleport){state.feet[i]=state.release[i]=state.previous[i]=null;}
  if(!planted&&state.feet[i]){
   const from=state.previous[i]||state.feet[i].position;
   const velocity=state.previousBase[i]?base.clone().sub(state.previousBase[i]).divideScalar(Math.max(dt,.001)):new THREE.Vector3();
   state.release[i]={offset:from.clone().sub(base),velocity:velocity.negate(),age:0};state.feet[i]=null;
  }
  const target=base.clone(),release=state.release[i];
  if(release){const duration=.2,u=Math.min(1,release.age/duration),u2=u*u,u3=u2*u;
   target.addScaledVector(release.offset,1-10*u3+15*u3*u-6*u3*u2).addScaledVector(release.velocity,duration*(u-6*u3+8*u3*u-3*u3*u2));
   release.age+=dt;if(u>=1)state.release[i]=null;
  }
  if(planted){
   if(!state.feet[i]){const from=state.previous[i]||target;state.feet[i]={position:new THREE.Vector3(from.x,sole,from.z),fromY:from.y,since:state.time};state.release[i]=null;}
   const anchor=state.feet[i],u=Math.min(1,(state.time-anchor.since)/.09),weight=u*u*u*(10+u*(-15+6*u));target.copy(anchor.position);target.y=anchor.fromY+(sole-anchor.fromY)*weight;
   // Hand the foot back to the animation over the last 0.075 s of stance instead of holding
   // the anchor until the leg is straight and letting go in one step. Lift-off comes either
   // from the gait cycle or from the reach limit above, whichever is sooner.
   const speed=Math.hypot(p.vx||0,p.vz||0);
   if(speed>.3){const cycle=((rig.phase/(2*Math.PI)+i*.5)%1+1)%1,stance=stanceFraction(speed),cycles=locomotionCadence(speed,p.motionStyle,p)/(2*Math.PI);
    const hip=rig.legs[i].upper.getWorldPosition(new THREE.Vector3()),reach=(rig.bodyMetrics.upperLeg+rig.bodyMetrics.lowerLeg)*size,vertical=Math.max(0,hip.y-sole-.045*size),available=Math.sqrt(Math.max(.01,reach*reach-vertical*vertical));
    const toCycle=cycle<stance&&cycles>0?(stance-cycle)/cycles:Infinity,toReach=(Math.min(.62*reach,.96*available)-Math.hypot(hip.x-anchor.position.x,hip.z-anchor.position.z))/speed;
    const hold=smooth(clamp(Math.min(toCycle,toReach)/liftFade,0,1));if(hold<1)target.lerp(base,1-hold);}
  }
  targets.push(target);state.previousBase[i]=base;
 }
 // Lower the pelvis geometrically when a support foot would otherwise exceed
 // limb reach. This changes the rendered pose only, never player/ball physics.
 let correction=0;for(let i=0;i<2;i++)if(state.feet[i]){const hip=rig.legs[i].upper.getWorldPosition(new THREE.Vector3()),goal=targets[i],reach=(rig.bodyMetrics.upperLeg+rig.bodyMetrics.lowerLeg-.003-gaitSoft*.4)*size,horizontal=(hip.x-goal.x)**2+(hip.z-goal.z)**2,maxY=goal.y+Math.sqrt(Math.max(.04,reach*reach-horizontal));correction=Math.max(correction,hip.y-maxY);}
 const desired=Math.min(.045,Math.max(0,correction/size));
 // Rise on a curve as well as fall: jumping to the full correction on the landing frame dropped
 // the pelvis 5.6 cm in one 1/120 s step and bent the knee of the held foot 7 -> 50 degrees.
 const heldCorrection=state.hipCorrection||0;
 state.hipCorrection=desired>heldCorrection?heldCorrection+(desired-heldCorrection)*(1-Math.exp(-dt/hipRise)):Math.max(desired,heldCorrection*Math.exp(-dt/0.065));
 rig.hips.position.y-=state.hipCorrection;
 let error=0,locks=0;for(let i=0;i<2;i++){const result=solveFoot(rig,i,targets[i],gaitSoft*size);if(state.feet[i]){error=Math.max(error,result.error);locks++;}state.previous[i]=rig.legs[i].foot.getWorldPosition(new THREE.Vector3());}
 rig.plantError=error;rig.plantLocks=locks;
}

// Output inertialization for the drawn feet. The joint rotations are inertialized on a
// state change (InertialJoint), but the foot IK above rewrites the legs afterwards, so a
// switch of contact branch, motion state or action still moved the ankle up to 1 m in one
// render step. Carry the last drawn foot position and velocity across such a switch, and
// across any step faster than a real foot, then decay the offset to the new pose.
const footLimit=22,rawFoot=new THREE.Vector3(),footGoal=new THREE.Vector3();
// Pull a goal that lies past the raw foot's reach back toward the leg length on the same
// exponential as softReach, starting from the raw reach so an unchanged goal stays exact.
function softenBeyond(rig,i,raw,goal,soft){
 const leg=rig.legs[i],hip=leg.upper.getWorldPosition(new THREE.Vector3()),knee=leg.lower.getWorldPosition(new THREE.Vector3()),ankle=leg.foot.getWorldPosition(new THREE.Vector3());
 const length=hip.distanceTo(knee)+knee.distanceTo(ankle),start=Math.max(raw.distanceTo(hip),length-soft),toGoal=goal.clone().sub(hip),r=toGoal.length();
 if(r<=start)return;const room=Math.max(1e-4,length-start);goal.copy(hip).addScaledVector(toGoal.normalize(),start+room*(1-Math.exp(-(r-start)/room)));
}
export function inertializeFeet(rig,p,pose,dt){
 dt=Math.max(.001,Math.min(dt,.1));
 const state=rig.footOutput||(rig.footOutput={key:null,root:null,feet:[null,null]}),action=p.action;
 const key=(action?.id!==undefined?'action-'+action.id:pose.state)+'|'+(rig.plantState?.mode||'free');
 const root=rig.root.getWorldPosition(new THREE.Vector3()),teleport=!state.root||state.root.distanceTo(root)>1.2,switched=key!==state.key;state.root=root;state.key=key;
  const sole=.075*rig.root.scale.y,kicking=['shoot','pass','through','lob'].includes(action?.type),kickIndex=sideIndex(action?.foot);
 for(let i=0;i<2;i++){
  const raw=rig.legs[i].foot.getWorldPosition(rawFoot).clone(),f=state.feet[i];
  // No exemption for the kick: the contact IK is already raised on a curve before impact, and
  // dropping a live offset at the impact window moved the boot up to 0.4 m in one step.
  if(!f||teleport){state.feet[i]={out:raw,raw,vel:new THREE.Vector3(),offset:new THREE.Vector3(),offsetVelocity:new THREE.Vector3(),age:1};continue;}
  const rawVelocity=raw.clone().sub(f.raw).multiplyScalar(1/dt);f.age+=dt;
  let correction=f.age<.5?decayOffset(f.offset,f.offsetVelocity,f.age):null;
  const candidate=correction?raw.clone().add(correction):raw;
  // Re-base from where the foot would be now at its last velocity, not from where it was last
  // frame: holding the old position stopped a swinging foot for one step (6 cm at a sprint) while
  // the pelvis moved on, and the knee bent up to 31 degrees on every state-label change.
  // Only a state switch carries the velocity. A re-base fired by the speed check starts from the
  // last drawn position: carrying velocity there fed itself every frame and a standing player's
  // foot flew off at 14 m/s.
  const carried=switched?f.out.clone().addScaledVector(f.vel.clone().clampLength(0,footLimit),dt):f.out.clone();
  if(switched||candidate.distanceTo(f.out)/dt>footLimit){f.offset=carried.sub(raw);f.offsetVelocity=f.vel.clone().sub(rawVelocity).clampLength(0,footLimit);f.age=0;correction=f.offset.clone();}
  // The kicking boot converges on the contact target: the offset fades out on the same curve that
  // raises the contact IK, so it is zero at impact and nothing is dropped in one step.
  if(correction&&kicking&&i===kickIndex){const fromContact=action.elapsed-action.contactAt,exact=fromContact<-.055?smooth(clamp((fromContact+.18)/.125,0,1)):fromContact>.055?1-smooth(clamp((fromContact-.055)/.18,0,1)):1;correction.multiplyScalar(1-exact);}
  let drawn=raw;
  if(correction&&correction.lengthSq()>4e-6){
   footGoal.copy(raw).add(correction);footGoal.y=Math.max(sole,footGoal.y);
   // raw is already this frame's soft-IK result. Solving the goal with soft IK again shortened an
   // already shortened leg, so near full extension the knee bent up to 31 degrees with the foot in
   // place. Only the part of the goal beyond the raw reach is softened: soft IK applies once.
   if(rig.plantState?.mode==='gait')softenBeyond(rig,i,raw,footGoal,gaitSoft*rig.root.scale.y);
   solveFoot(rig,i,footGoal);drawn=rig.legs[i].foot.getWorldPosition(new THREE.Vector3());}
  f.vel=drawn.clone().sub(f.out).multiplyScalar(1/dt);f.out=drawn.clone();f.raw=raw;
 }
}
