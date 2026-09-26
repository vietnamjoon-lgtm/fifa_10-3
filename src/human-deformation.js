import * as THREE from '../vendor/three.module.js';
import {anatomy} from './anatomy-data.js';
import {bodyPoint} from './body-shape.js';
// Index 0 is the player's right. The game's foot names used to be mirrored ('left' on index 0);
// since the left/right fix they match the anatomical side.
export const FOOT_SIDES=Object.freeze([{index:0,anatomical:'R',legacy:'right',sign:-1},{index:1,anatomical:'L',legacy:'left',sign:1}]);
export const controlBones=rig=>[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(a=>[a.upper,a.lower]),...rig.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
const pos=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Quaternion(),local=new THREE.Matrix4(),goal=new THREE.Matrix4(),inverse=new THREE.Matrix4();
const twistAxis=new THREE.Vector3(0,1,0),twistRotation=new THREE.Quaternion(),fingerRotation=new THREE.Quaternion();
export function createHumanDeformation(rig){
 const group=new THREE.Group();group.name='human-deformation';rig.root.add(group);
 const controls=controlBones(rig),bones=[],specs=anatomy.detail.bones,rest=[];
 for(const spec of specs){const bone=new THREE.Bone();bone.name=spec.name;const p=new THREE.Vector3(...bodyPoint(...spec.position,spec.control,rig.bodyMetrics));rest.push(p);const parent=spec.parent<0?group:bones[spec.parent];parent.add(bone);bone.position.copy(p);if(spec.parent>=0)bone.position.sub(rest[spec.parent]);bones.push(bone);}
 rig.root.updateMatrixWorld(true);
 const controlBind=controls.map(b=>b.matrixWorld.clone().invert()),bind=bones.map(b=>b.matrixWorld.clone()),restLocal=bones.map(b=>b.matrix.clone()),targets=bones.map(()=>new THREE.Matrix4());
 // Bone names and local finger axes never change during animation.
 const operations=specs.map(spec=>{
  const neck=spec.name.startsWith('neck'),spine=spec.name.startsWith('spine'),finger=/finger(\d)-(\d)/.exec(spec.name);
  return {interpolate:neck||spine,neck,a:neck?1:0,b:neck?2:1,weight:neck?Number(spec.name.slice(-2))/4:spine?(6-Number(spec.name.slice(-2)))/5:0,
   twist:/^(upper|lower)(arm|leg)01\./.test(spec.name),hand:/finger|metacarpal/.test(spec.name),finger,
   curlScale:finger&&Number(finger[2])===1?.7:1,relaxedScale:finger&&Number(finger[1])!==1?2.1:1,axis:finger?new THREE.Vector3(0,0,spec.name.endsWith('.R')?1:-1):null};
 });
 const state={group,bones,specs,operations,controls,controlBind,bind,restLocal,targets,deltas:controls.map(()=>new THREE.Matrix4()),translations:controls.map(()=>new THREE.Vector3()),rotations:controls.map(()=>new THREE.Quaternion()),scales:controls.map(()=>new THREE.Vector3())};rig.deformation=state;return state;
}
// Separate deformation hierarchy preserves the original MakeHuman parents while
// the public 13 control aliases retain every existing gameplay/action contract.
export function updateHumanDeformation(rig,p={},time=0){
 const d=rig.deformation;if(!d)return;rig.root.updateWorldMatrix(true,false);d.group.updateWorldMatrix(false,false);for(const control of d.controls)control.updateWorldMatrix(false,false);
 for(let i=0;i<d.controls.length;i++){d.deltas[i].multiplyMatrices(d.controls[i].matrixWorld,d.controlBind[i]);d.deltas[i].decompose(d.translations[i],d.rotations[i],d.scales[i]);}
 const breath=.006*Math.sin(time*2*Math.PI/4.2)*rig.root.scale.y,curl=rig.distant?.13:p.keeperMotion?.kind==='catch'&&time<p.keeperMotion.until?.65:rig.motionState==='celebrate'?.4:.22;
 for(let i=0;i<d.bones.length;i++){
  const spec=d.specs[i],operation=d.operations[i],bone=d.bones[i],parent=bone.parent;
  goal.multiplyMatrices(d.deltas[spec.control],d.bind[i]);
  if(operation.interpolate){
   const {a,b,weight:w}=operation;
   pos.copy(d.translations[a]).lerp(d.translations[b],w);rot.copy(d.rotations[a]).slerp(d.rotations[b],w);scale.copy(d.scales[a]).lerp(d.scales[b],w);goal.compose(pos,rot,scale).multiply(d.bind[i]);
   if(!operation.neck)goal.elements[13]+=breath*w;
  }
  if(operation.twist){
   const q=d.controls[spec.control].quaternion,angle=2*Math.atan2(q.y,q.w),wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));goal.decompose(pos,rot,scale);rot.multiply(twistRotation.setFromAxisAngle(twistAxis,-wrapped*.5));goal.compose(pos,rot,scale);
  }
  // Finger joints have their own bind positions, not a single rigid palm.
  if(operation.hand){
   goal.multiplyMatrices(parent.matrixWorld,d.restLocal[i]);goal.decompose(pos,rot,scale);
   if(operation.finger){rot.multiply(fingerRotation.setFromAxisAngle(operation.axis,curl*operation.curlScale*(curl===.22?operation.relaxedScale:1)));goal.compose(pos,rot,scale);}
  }
  inverse.copy(parent.matrixWorld).invert();local.multiplyMatrices(inverse,goal);local.decompose(bone.position,bone.quaternion,bone.scale);bone.updateMatrix();bone.matrixWorld.multiplyMatrices(parent.matrixWorld,bone.matrix);
 }
}
