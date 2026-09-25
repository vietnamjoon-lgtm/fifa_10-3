import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {fixture} from './human-fixture.mjs';
import {createAnatomicalBody} from '../src/anatomical-player.js';
import {BODY_PRESETS,applyBodyPreset} from '../src/body-shape.js';
function deform(mesh,index,dqs){const g=mesh.geometry,p=new T.Vector3().fromBufferAttribute(g.attributes.position,index);if(!dqs)return mesh.applyBoneTransform(index,p);for(let k=0;k<(g.morphAttributes.position?.length||0);k++)p.addScaledVector(new T.Vector3().fromBufferAttribute(g.morphAttributes.position[k],index),mesh.morphTargetInfluences[k]||0);p.applyMatrix4(mesh.bindMatrix);const real=new T.Quaternion(0,0,0,0),dual=new T.Quaternion(0,0,0,0),reference=new T.Quaternion(),m=new T.Matrix4(),translation=new T.Vector3(),scale=new T.Vector3();for(let k=0;k<4;k++){const w=g.attributes.skinWeight.array[index*4+k];if(!w)continue;m.fromArray(mesh.skeleton.boneMatrices,g.attributes.skinIndex.array[index*4+k]*16);const q=new T.Quaternion();m.decompose(translation,q,scale);if(k===0)reference.copy(q);const sign=reference.dot(q)<0?-1:1,d=new T.Quaternion(translation.x,translation.y,translation.z,0).multiply(q);for(const key of ['x','y','z','w']){real[key]+=q[key]*w*sign;dual[key]+=d[key]*w*sign*.5;}}
 const length=real.length();for(const key of ['x','y','z','w']){real[key]/=length;dual[key]/=length;}const move=dual.multiply(real.clone().conjugate());return p.applyQuaternion(real).add(new T.Vector3(move.x,move.y,move.z).multiplyScalar(2)).applyMatrix4(mesh.bindMatrixInverse);
}
const report=[];
for(const type of Object.keys(BODY_PRESETS)){
 const profile=applyBodyPreset({height:1.81,weight:78,build:1},type),rig=fixture(profile),c=new T.Color('white'),body=createAnatomicalBody(rig,{skin:c,kit:c,shorts:c,sock:c}),g=body.mesh.geometry;
 for(const joint of ['knee','elbow']){
  const control=joint==='knee'?rig.legs[0].lower:rig.arms[0].lower,center=joint==='knee'?[-rig.bodyMetrics.hipX,rig.bodyMetrics.ankle+rig.bodyMetrics.lowerLeg]:[-rig.bodyMetrics.shoulderX,rig.bodyMetrics.shoulderY-rig.bodyMetrics.upperArm];
  const ids=[];for(let i=0;i<g.attributes.position.count;i++){const x=g.attributes.position.getX(i),y=g.attributes.position.getY(i),z=g.attributes.position.getZ(i);if(Math.abs(y-center[1])<.018&&Math.abs(x-center[0])<.105)ids.push({i,angle:Math.atan2(z,x-center[0])});}ids.sort((a,b)=>a.angle-b.angle);
  function perimeter(dqs){const points=ids.map(v=>deform(body.mesh,v.i,dqs));return points.reduce((sum,p,i)=>sum+p.distanceTo(points[(i+1)%points.length]),0);}
  control.rotation.x=0;rig.root.updateMatrixWorld(true);body.skeleton.update();const neutral=perimeter(true);
  for(const degrees of [90,140]){control.rotation.x=degrees*Math.PI/180*(joint==='elbow'?-1:1);rig.root.updateMatrixWorld(true);body.skeleton.update();const dq=perimeter(true),lbs=perimeter(false);report.push({type,joint,degrees,vertices:ids.length,dqsPerimeterRatio:dq/neutral,lbsPerimeterRatio:lbs/neutral,pass:dq/neutral>=.9});}control.rotation.x=0;
 }
}
const result={scope:'Material vertex ring perimeter, not anatomical volume or mesh/cloth intersection certification',results:report};fs.writeFileSync('reports/human-skin.json',JSON.stringify(result,null,2));console.log(report);
