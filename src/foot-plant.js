import * as THREE from '../vendor/three.module.js';
const down=new THREE.Vector3(0,-1,0),v=new THREE.Vector3(),q=new THREE.Quaternion();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// solveFoot is synchronous. Reuse scratch values across players instead of
// creating temporary vectors and quaternions for every rendered leg.
const ik={hip:new THREE.Vector3(),knee:new THREE.Vector3(),ankle:new THREE.Vector3(),direction:new THREE.Vector3(),forward:new THREE.Vector3(),kneeTarget:new THREE.Vector3(),end:new THREE.Vector3(),delta:new THREE.Vector3(),matrixPosition:new THREE.Vector3(),matrixScale:new THREE.Vector3(),parent:new THREE.Quaternion(),root:new THREE.Quaternion()};

// Analytic two-bone IK in world space. Clamp unreachable targets; never stretch limbs.
export function solveFoot(rig,index,target){
 const leg=rig.legs[index];rig.root.updateWorldMatrix(true,false);
 // The rig's leg chain is root -> hips -> upper -> lower -> foot. Refresh only
 // this chain, instead of asking each world getter to revisit every ancestor.
 leg.upper.parent.updateWorldMatrix(false,false);leg.upper.updateWorldMatrix(false,false);leg.lower.updateWorldMatrix(false,false);leg.foot.updateWorldMatrix(false,false);
 const hip=ik.hip.setFromMatrixPosition(leg.upper.matrixWorld),knee=ik.knee.setFromMatrixPosition(leg.lower.matrixWorld),ankle=ik.ankle.setFromMatrixPosition(leg.foot.matrixWorld);
 const a=hip.distanceTo(knee),b=knee.distanceTo(ankle),direction=ik.direction.copy(target).sub(hip),requested=direction.length(),r=clamp(requested,Math.abs(a-b)+.001,a+b-.001);direction.normalize();
 rig.root.matrixWorld.decompose(ik.matrixPosition,ik.root,ik.matrixScale);
 const forward=ik.forward.set(0,0,1).applyQuaternion(ik.root);
 const bend=forward.addScaledVector(direction,-forward.dot(direction));if(bend.lengthSq()<.001)bend.set(1,0,0);bend.normalize();
 const projection=(a*a+r*r-b*b)/(2*r),height=Math.sqrt(Math.max(0,a*a-projection*projection));
 const kneeTarget=ik.kneeTarget.copy(hip).addScaledVector(direction,projection).addScaledVector(bend,height),end=ik.end.copy(hip).addScaledVector(direction,r);
 leg.upper.parent.matrixWorld.decompose(ik.matrixPosition,ik.parent,ik.matrixScale);
 leg.upper.quaternion.setFromUnitVectors(down,ik.delta.copy(kneeTarget).sub(hip).normalize().applyQuaternion(ik.parent.invert()));leg.upper.updateWorldMatrix(false,false);
 leg.upper.matrixWorld.decompose(ik.matrixPosition,ik.parent,ik.matrixScale);
 leg.lower.quaternion.setFromUnitVectors(down,ik.delta.copy(end).sub(kneeTarget).normalize().applyQuaternion(ik.parent.invert()));leg.lower.updateWorldMatrix(false,false);
 leg.lower.matrixWorld.decompose(ik.matrixPosition,ik.parent,ik.matrixScale);leg.foot.quaternion.copy(ik.parent.invert().multiply(ik.root));leg.foot.updateWorldMatrix(false,false);
 return {error:v.setFromMatrixPosition(leg.foot.matrixWorld).distanceTo(target),clamped:requested>r+.005};
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
  const kickIndex=action?.foot==='left'?0:1,kicking=action&&['shoot','pass','through','lob'].includes(action.type),age=action? action.elapsed-action.contactAt:0,impact=kicking&&i===kickIndex&&age>-.13&&age<.16;
  if(impact&&action.contactTarget){
   state.feet[i]=null;if(state.release)state.release[i]=null;const b=action.contactTarget,f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));
   const target=new THREE.Vector3(b.x,b.y,b.z).addScaledVector(f,-.06*size);target.y=Math.max(sole,b.y-.025*size);
   // Ease into exact contact and out into follow-through. The old narrow on/off
   // window replaced the whole joint pose abruptly on its first and last frame.
   const before=[leg.upper.quaternion.clone(),leg.lower.quaternion.clone(),leg.foot.quaternion.clone()];
   const u=clamp(age<0?(age+.13)/.13:1-age/.16,0,1),weight=u*u*(3-2*u);
   const solved=solveFoot(rig,i,target);
   for(const [index,bone]of [leg.upper,leg.lower,leg.foot].entries())bone.quaternion.slerp(before[index],1-weight);
   rig.impactError=leg.foot.getWorldPosition(v).distanceTo(target);rig.impactClamped=solved.clamped;continue;
  }
  const receiving=pose.state.startsWith('receive'),receive=p.receivePrep||p.receive,receiveIndex=receive?.foot==='left'?0:1;
  if(receiving&&p.receive?.target&&i===(p.receive.foot==='left'?0:1)){
   const r=p.receive,age=(p.sampleTime??r.contactTime??0)-(r.contactTime??0),b=r.target;
   if(b.y<=.65&&age>=0&&age<.16){const target=new THREE.Vector3(b.x,b.y-.025,b.z),f=new THREE.Vector3(0,0,1).applyQuaternion(rig.root.getWorldQuaternion(q));target.addScaledVector(f,-.06*size);target.y=Math.max(sole,target.y);const hip=leg.upper.getWorldPosition(new THREE.Vector3());if(hip.distanceTo(target)<.74*size){const upper=leg.upper.quaternion.clone(),lower=leg.lower.quaternion.clone(),foot=leg.foot.quaternion.clone(),weight=.72*(1-age/.16);solveFoot(rig,i,target);leg.upper.quaternion.slerp(upper,1-weight);leg.lower.quaternion.slerp(lower,1-weight);leg.foot.quaternion.slerp(foot,1-weight);state.feet[i]=null;continue;}}
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
  }
  targets.push(target);state.previousBase[i]=base;
 }
 // Lower the pelvis geometrically when a support foot would otherwise exceed
 // limb reach. This changes the rendered pose only, never player/ball physics.
 let correction=0;for(let i=0;i<2;i++)if(state.feet[i]){const hip=rig.legs[i].upper.getWorldPosition(new THREE.Vector3()),goal=targets[i],reach=(rig.bodyMetrics.upperLeg+rig.bodyMetrics.lowerLeg-.003)*size,horizontal=(hip.x-goal.x)**2+(hip.z-goal.z)**2,maxY=goal.y+Math.sqrt(Math.max(.04,reach*reach-horizontal));correction=Math.max(correction,hip.y-maxY);}
 const desired=Math.min(.045,Math.max(0,correction/size));
 state.hipCorrection=Math.max(desired,(state.hipCorrection||0)*Math.exp(-dt/0.065));
 rig.hips.position.y-=state.hipCorrection;
 let error=0,locks=0;for(let i=0;i<2;i++){const result=solveFoot(rig,i,targets[i]);if(state.feet[i]){error=Math.max(error,result.error);locks++;}state.previous[i]=rig.legs[i].foot.getWorldPosition(new THREE.Vector3());}
 rig.plantError=error;rig.plantLocks=locks;
}
