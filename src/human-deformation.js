import * as THREE from '../vendor/three.module.js';
import {anatomy} from './anatomy-data.js';
import {bodyPoint} from './body-shape.js';
export const FOOT_SIDES=Object.freeze([{index:0,anatomical:'R',legacy:'left',sign:-1},{index:1,anatomical:'L',legacy:'right',sign:1}]);
export const controlBones=rig=>[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(a=>[a.upper,a.lower]),...rig.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
const pos=new THREE.Vector3(),scale=new THREE.Vector3(),rot=new THREE.Quaternion(),local=new THREE.Matrix4(),goal=new THREE.Matrix4(),inverse=new THREE.Matrix4();
const twistAxis=new THREE.Vector3(0,1,0),twistRotation=new THREE.Quaternion();
export function createHumanDeformation(rig){
 const group=new THREE.Group();group.name='human-deformation';rig.root.add(group);
 const controls=controlBones(rig),bones=[],specs=anatomy.detail.bones,rest=[];
 for(const spec of specs){const bone=new THREE.Bone();bone.name=spec.name;const p=new THREE.Vector3(...bodyPoint(...spec.position,spec.control,rig.bodyMetrics));rest.push(p);const parent=spec.parent<0?group:bones[spec.parent];parent.add(bone);bone.position.copy(p);if(spec.parent>=0)bone.position.sub(rest[spec.parent]);bones.push(bone);}
 rig.root.updateMatrixWorld(true);
 const controlBind=controls.map(b=>b.matrixWorld.clone().invert()),bind=bones.map(b=>b.matrixWorld.clone()),restLocal=bones.map(b=>b.matrix.clone()),targets=bones.map(()=>new THREE.Matrix4());
 const state={group,bones,specs,controls,controlBind,bind,restLocal,targets,deltas:controls.map(()=>new THREE.Matrix4()),translations:controls.map(()=>new THREE.Vector3()),rotations:controls.map(()=>new THREE.Quaternion()),scales:controls.map(()=>new THREE.Vector3())};rig.deformation=state;return state;
}
// Separate deformation hierarchy preserves the original MakeHuman parents while
// the public 13 control aliases retain every existing gameplay/action contract.
export function updateHumanDeformation(rig,p={},time=0){
 const d=rig.deformation;if(!d)return;rig.root.updateWorldMatrix(true,false);d.group.updateWorldMatrix(false,false);for(const control of d.controls)control.updateWorldMatrix(true,false);
 for(let i=0;i<d.controls.length;i++){d.deltas[i].multiplyMatrices(d.controls[i].matrixWorld,d.controlBind[i]);d.deltas[i].decompose(d.translations[i],d.rotations[i],d.scales[i]);}
 for(let i=0;i<d.bones.length;i++){
  const spec=d.specs[i],bone=d.bones[i],parent=bone.parent;
  goal.multiplyMatrices(d.deltas[spec.control],d.bind[i]);
  if(/^spine/.test(spec.name)||/^neck/.test(spec.name)){
   const neck=spec.name.startsWith('neck'),a=neck?1:0,b=neck?2:1,w=neck?Number(spec.name.slice(-2))/4:(6-Number(spec.name.slice(-2)))/5;
   pos.copy(d.translations[a]).lerp(d.translations[b],w);rot.copy(d.rotations[a]).slerp(d.rotations[b],w);scale.copy(d.scales[a]).lerp(d.scales[b],w);goal.compose(pos,rot,scale).multiply(d.bind[i]);
   if(!neck)goal.elements[13]+=.006*Math.sin(time*2*Math.PI/4.2)*w*rig.root.scale.y;
  }
  if(/^(upper|lower)(arm|leg)01\./.test(spec.name)){
   const q=d.controls[spec.control].quaternion,angle=2*Math.atan2(q.y,q.w),wrapped=Math.atan2(Math.sin(angle),Math.cos(angle));goal.decompose(pos,rot,scale);rot.multiply(twistRotation.setFromAxisAngle(twistAxis,-wrapped*.5));goal.compose(pos,rot,scale);
  }
  if(/finger|metacarpal|wrist/.test(spec.name)){
   // Finger joints have their own bind positions, not a single rigid palm.
   if(/finger|metacarpal/.test(spec.name)){
    goal.multiplyMatrices(parent.matrixWorld,d.restLocal[i]);goal.decompose(pos,rot,scale);
    const curl=rig.distant?.13:p.keeperMotion?.kind==='catch'&&time<p.keeperMotion.until?.65:rig.motionState==='celebrate'?.4:.22;
    const finger=/finger(\d)-(\d)/.exec(spec.name);
    // A relaxed hand is curled about 25 degrees per joint; the thumb keeps the lighter curl.
    if(finger){const sign=spec.name.endsWith('.R')?1:-1,relaxed=Number(finger[1])===1||curl!==.22?1:2.1,angle=curl*relaxed*(Number(finger[2])===1?.7:1),axis=new THREE.Vector3(0,0,sign);rot.multiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));goal.compose(pos,rot,scale);}
   }
  }
  inverse.copy(parent.matrixWorld).invert();local.multiplyMatrices(inverse,goal);local.decompose(bone.position,bone.quaternion,bone.scale);bone.updateMatrix();bone.matrixWorld.multiplyMatrices(parent.matrixWorld,bone.matrix);
 }
}
