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
 let error=0,locks=0;
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
  const plant=ground&&(!receiving||i!==receiveIndex)&&(!kicking||i!==kickIndex)&&(speed<.2||kicking||(pose.contacts?pose.contacts[i]>.5:cycle<.5));
  if(!plant||teleport||current.y>sole+.20){state.release||=[null,null];if(state.feet[i]&&ground&&!teleport)state.release[i]={offset:state.feet[i].position.clone().sub(current),age:0};state.feet[i]=null;const release=state.release[i];if(release&&ground&&!teleport&&release.age<.16){const t=release.age;solveFoot(rig,i,current.clone().addScaledVector(release.offset,(1+32*t)*Math.exp(-32*t)));release.age+=dt;}else state.release[i]=null;continue;}if(state.release)state.release[i]=null;
  const anchor=state.feet[i];
  if(!anchor){state.feet[i]={position:new THREE.Vector3(current.x,sole,current.z),since:state.time};}
  const goal=state.feet[i].position,hip=leg.upper.getWorldPosition(new THREE.Vector3());
  if(hip.distanceTo(goal)>((rig.bodyMetrics?.upperLeg||.35)+(rig.bodyMetrics?.lowerLeg||.4)-.002)*size||state.time-state.feet[i].since>.65&&speed>.2){state.feet[i]=null;continue;}
  const result=solveFoot(rig,i,goal);error=Math.max(error,result.error);locks++;
 }
 rig.plantError=error;rig.plantLocks=locks;
}
