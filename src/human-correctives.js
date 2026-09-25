import * as THREE from '../vendor/three.module.js';
// Pose-space deltas supplement DQS at compressed joint creases. These are
// original, localized radial/soft-tissue corrections, not copied game shapes.
export function addHumanCorrectives(geometry,rig){
 const m=rig.bodyMetrics,p=geometry.attributes.position,arm=geometry.attributes.wardrobeArm,targets=[];
 for(const side of [-1,1])for(const kind of ['knee','elbow','hip','shoulder']){
  const centerX=side*(kind==='knee'||kind==='hip'?m.hipX:m.shoulderX),centerY=kind==='knee'?m.ankle+m.lowerLeg:kind==='elbow'?m.shoulderY-m.upperArm:kind==='hip'?.835+m.hipOffset:m.shoulderY,data=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),isArm=arm.getX(i),mask=kind==='elbow'||kind==='shoulder'?isArm:1-isArm;
   const w=Math.exp(-Math.pow((y-centerY)/(kind==='hip'?.12:.075),2)-Math.pow((x-centerX)/.11,2))*mask;
   const gain=kind==='knee'?.28:.10;data[i*3]=(x-centerX)*gain*w;data[i*3+2]=z*gain*w;
   if(kind==='hip'&&z<0)data[i*3+2]-=.016*w;
   if(kind==='shoulder')data[i*3+1]=.009*w;
  }targets.push(new THREE.BufferAttribute(data,3));
 }
 geometry.morphTargetsRelative=true;geometry.morphAttributes.position=targets;
}
export function updateHumanCorrectives(rig,meshes){const values=[];for(let i=0;i<2;i++)for(const joint of [rig.legs[i].lower,rig.arms[i].lower,rig.legs[i].upper,rig.arms[i].upper])values.push(Math.sqrt(Math.max(0,1-joint.quaternion.w**2)));for(const mesh of meshes)if(mesh.morphTargetInfluences)for(let i=0;i<values.length;i++)mesh.morphTargetInfluences[i]=values[i];}
