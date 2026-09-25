import * as THREE from '../vendor/three.module.js';
const down=new THREE.Vector3(0,-1,0),v=new THREE.Vector3(),q=new THREE.Quaternion();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Analytic two-bone IK in world space. Clamp unreachable targets; never stretch limbs.
export function solveFoot(rig,index,target){
 const leg=rig.legs[index];rig.root.updateMatrixWorld(true);
 const hip=leg.upper.getWorldPosition(new THREE.Vector3()),knee=leg.lower.getWorldPosition(new THREE.Vector3()),ankle=leg.foot.getWorldPosition(new THREE.Vector3());
 const a=hip.distanceTo(knee),b=knee.distanceTo(ankle),direction=target.clone().sub(hip),requested=direction.length(),r=clamp(requested,Math.abs(a-b)+.001,a+b-.001);direction.normalize();
 const forward=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
 const bend=forward.addScaledVector(direction,-forward.dot(direction));if(bend.lengthSq()<.001)bend.set(1,0,0);bend.normalize();
 const projection=(a*a+r*r-b*b)/(2*r),height=Math.sqrt(Math.max(0,a*a-projection*projection));
 const kneeTarget=hip.clone().addScaledVector(direction,projection).addScaledVector(bend,height),end=hip.clone().addScaledVector(direction,r);
 const parentQ=leg.upper.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 leg.upper.quaternion.setFromUnitVectors(down,kneeTarget.clone().sub(hip).normalize().applyQuaternion(parentQ));rig.root.updateMatrixWorld(true);
 const kneeQ=leg.lower.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
 leg.lower.quaternion.setFromUnitVectors(down,end.clone().sub(kneeTarget).normalize().applyQuaternion(kneeQ));rig.root.updateMatrixWorld(true);
 const footQ=leg.foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),rootQ=rig.root.getWorldQuaternion(new THREE.Quaternion());leg.foot.quaternion.copy(footQ.multiply(rootQ));rig.root.updateMatrixWorld(true);
 return {error:leg.foot.getWorldPosition(v).distanceTo(target),clamped:requested>r+.005};
}
export function stabilizeFeet(rig,p,pose,dt){
 // Distant non-contact limbs use the phase-matched capture. Keep exact IK for every kick.
 if(rig.distant&&!rig.contactDetail&&!p.action){rig.plantState=null;rig.plantLocks=0;rig.plantError=0;return;}
 rig.root.updateMatrixWorld(true);const speed=Math.hypot(p.vx||0,p.vz||0),state=rig.plantState||(rig.plantState={feet:[null,null],root:null,time:0});
 const root=rig.root.getWorldPosition(new THREE.Vector3()),teleport=state.root&&state.root.distanceTo(root)>1.2;state.root=root;state.time+=dt;
 const action=p.action,ground=!p.down&&!p.dive&&!action?.aerial&&!['slide','fall','recover','celebrate','feint'].includes(pose.state);
 const size=rig.root.scale.y,sole=.075*size;
 let error=0,locks=0;const jumps=[false,false];
 for(let i=0;i<2;i++){
  const leg=rig.legs[i],cycle=((rig.phase/(Math.PI*2)+i*.5)%1+1)%1;
  if(ground&&pose.gaitTargets){const g=pose.gaitTargets[i],target=rig.root.localToWorld(new THREE.Vector3(g.x,g.y,g.z));solveFoot(rig,i,target);}
  const current=leg.foot.getWorldPosition(new THREE.Vector3());
  const kickIndex=action?.foot==='left'?0:1,kicking=action&&['shoot','pass','through','lob'].includes(action.type),impact=kicking&&i===kickIndex&&Math.abs(action.elapsed-action.contactAt)<.055;
  if(impact&&action.contactTarget){
   state.feet[i]=null;const b=action.contactTarget,f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));
   const target=new THREE.Vector3(b.x,b.y,b.z).addScaledVector(f,-.06*size);target.y=Math.max(sole,b.y-.025*size);
   const solved=solveFoot(rig,i,target);rig.impactError=solved.error;rig.impactClamped=solved.clamped;continue;
  }
  const receiving=pose.state.startsWith('receive'),receive=p.receivePrep||p.receive,receiveIndex=receive?.foot==='left'?0:1;
  if(receiving&&p.receive?.target&&i===(p.receive.foot==='left'?0:1)){
   const r=p.receive,age=(p.sampleTime??r.contactTime??0)-(r.contactTime??0),b=r.target;
   if(b.y<=.65&&age>=0&&age<.16){const target=new THREE.Vector3(b.x,b.y-.025,b.z),f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));target.addScaledVector(f,-.06*size);target.y=Math.max(sole,target.y);const hip=leg.upper.getWorldPosition(new THREE.Vector3());if(hip.distanceTo(target)<.74*size){const upper=leg.upper.quaternion.clone(),lower=leg.lower.quaternion.clone(),foot=leg.foot.quaternion.clone(),weight=.72*(1-age/.16);solveFoot(rig,i,target);leg.upper.quaternion.slerp(upper,1-weight);leg.lower.quaternion.slerp(lower,1-weight);leg.foot.quaternion.slerp(foot,1-weight);state.feet[i]=null;continue;}}
  }
  // A foot the pose lifts (reaching for the ball in a skill move or a touch) is not pinned, even standing still.
  const plant=ground&&(!receiving||i!==receiveIndex)&&(!kicking||i!==kickIndex)&&(kicking||(pose.contacts?pose.contacts[i]>.5:speed<.2||cycle<.5));
  // A foot the pose holds off the ground (lifted over the ball beside it) is pinned only once it is down: pinning it at
  // sole height snapped it down 5 cm in 1 ms.
  if(!plant||teleport||current.y>sole+.02){state.release||=[null,null];if(state.feet[i]&&ground&&!teleport)state.release[i]={offset:state.feet[i].position.clone().sub(current),age:0};state.feet[i]=null;const release=state.release[i];if(release&&ground&&!teleport&&release.age<.16){const t=release.age;solveFoot(rig,i,current.clone().addScaledVector(release.offset,(1+32*t)*Math.exp(-32*t)));release.age+=dt;}else state.release[i]=null;continue;}
  // Put down again while its release blend was still easing it off the old pin, the foot is pinned where it is drawn
  // (the blend's offset included), not where the stride has it: that jumped the foot 5 cm sideways in 1 ms.
  const easing=state.release?.[i];if(easing&&!state.feet[i]){const t=easing.age;current.addScaledVector(easing.offset,(1+32*t)*Math.exp(-32*t));}
  if(state.release)state.release[i]=null;
  const anchor=state.feet[i];
  // A foot is pinned where it touches down and settles onto the sole over ~30 ms: pinning it straight at sole height
  // snapped a foot set down a couple of centimetres up (over a ball beside it) to the ground within 1 ms.
  if(!anchor){state.feet[i]={position:new THREE.Vector3(current.x,Math.max(sole,current.y),current.z),since:state.time};}
  else state.feet[i].position.y=sole+(state.feet[i].position.y-sole)*Math.exp(-dt/.03);
  const goal=state.feet[i].position,hip=leg.upper.getWorldPosition(new THREE.Vector3());
  if(hip.distanceTo(goal)>((rig.bodyMetrics?.upperLeg||.35)+(rig.bodyMetrics?.lowerLeg||.4)-.002)*size||state.time-state.feet[i].since>.65&&speed>.2){state.feet[i]=null;jumps[i]=true;continue;}
  const result=solveFoot(rig,i,goal);error=Math.max(error,result.error);locks++;
 }
 // Switching the stride's foot targets on or off moves where both feet should be at once.
 const targets=!!pose.gaitTargets;if(state.hadTargets!==undefined&&state.hadTargets!==targets)jumps[0]=jumps[1]=true;state.hadTargets=targets;
 for(let i=0;i<2;i++)inertialFoot(rig,state,i,dt,sole,jumps[i]||teleport);
 rig.plantError=error;rig.plantLocks=locks;
}

// Foot inertialization: when where the foot should be jumps (a plant lock dropped without its release blend, the
// stride's targets switched on or off), the drawn foot keeps its position and velocity and eases onto the new place
// over about 0.15 s instead of jumping. Any other departure of more than 6 cm from the foot's path is treated the same.
function inertialFoot(rig,state,i,dt,sole,jump){
 const leg=rig.legs[i],want=leg.foot.getWorldPosition(new THREE.Vector3()),drawn=state.drawn||(state.drawn=[null,null]),d=drawn[i];
 if(!d||dt>.1){drawn[i]={pos:want,vel:new THREE.Vector3(),offset:new THREE.Vector3()};return;}
 const predicted=d.pos.clone().addScaledVector(d.vel,dt);let offset=d.offset.multiplyScalar(Math.exp(-dt*20));
 if(jump||want.clone().add(offset).distanceTo(predicted)>.06+260*dt*dt)offset=predicted.clone().sub(want).clampLength(0,2);
 if(offset.lengthSq()>1e-8){const target=want.clone().add(offset);target.y=Math.max(sole,target.y);solveFoot(rig,i,target);}
 const out=leg.foot.getWorldPosition(new THREE.Vector3());drawn[i]={pos:out,vel:out.clone().sub(d.pos).multiplyScalar(1/dt).clampLength(0,40),offset};
}
