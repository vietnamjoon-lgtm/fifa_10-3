import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import {fixture} from '../tools/human-fixture.mjs';
import {bodyCenterOfMass} from '../src/human-kinematics.js';
import {configureBodyRig} from '../src/body-rig.js';
register('../tools/three-loader.mjs',import.meta.url);
const {createFootballBoot,updateBoots}=await import('../src/football-boots.js');
const {animatePlayer}=await import('../src/player.js');

function visibleVertices(root){
 root.updateWorldMatrix(true,true);const points=[];let meshes=0,triangles=0;
 root.traverseVisible(mesh=>{
  if(!mesh.isMesh)return;meshes++;const g=mesh.geometry,p=g.attributes.position,c=g.attributes.color,index=g.index;
  triangles+=(index?.count||p.count)/3;
  for(let i=0;i<(index?.count||p.count);i++){
   const id=index?index.getX(i):i,v=new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(mesh.matrixWorld),color=mesh.material.color.clone();
   if(c)color.multiply(new THREE.Color().fromBufferAttribute(c,id));
   points.push([v.x,v.y,v.z,color.r,color.g,color.b].map(x=>Math.round(x*1e4)).join(','));
  }
 });return {meshes,triangles,points:points.sort()};
}
function setBootLOD(ankle,distant){for(const level of ankle.userData.bootLOD){level.far.visible=distant;for(const mesh of level.near)mesh.visible=!distant;}}

test('batched boots keep all 906 triangles and vertex colours at two draw calls per distant foot',()=>{
 const ankle=new THREE.Bone();createFootballBoot(ankle,'#e3e4dc');
 const near=visibleVertices(ankle);setBootLOD(ankle,true);const far=visibleVertices(ankle);
 assert.equal(near.meshes,7);assert.equal(far.meshes,2);assert.equal(near.triangles,906);assert.equal(far.triangles,906);
 assert.deepEqual(far.points,near.points);
});

test('near and distant boot soles follow the same MTP hinge during push-off and changing foot sizes',()=>{
 for(const size of [.85,1,1.15]){
  const profile={height:1.91,body:{footSize:size*100}},rig=fixture(profile);
  for(const leg of rig.legs)createFootballBoot(leg.foot,'#93bb46');
  configureBodyRig(rig,profile);
  rig.phase=2.7;updateBoots(rig,{gaitTargets:[]},3.5);
  for(const leg of rig.legs){
   const ankle=leg.foot,{boot,toe}=ankle.userData;
   assert.equal(toe.parent,boot);assert.ok(Math.abs(toe.rotation.x+boot.rotation.x)<1e-12);
   const near=visibleVertices(ankle);setBootLOD(ankle,true);const far=visibleVertices(ankle);assert.deepEqual(far.points,near.points);
  }
 }
});

// Independent reference uses public world-position helpers, as before batching.
function referenceCenter(rig){
 const sum=new THREE.Vector3();let mass=0;
 const add=(v,w)=>{sum.addScaledVector(v,w);mass+=w;};
 const segment=(a,b,w,t=.5)=>add(a.getWorldPosition(new THREE.Vector3()).lerp(b.getWorldPosition(new THREE.Vector3()),t),w);
 segment(rig.hips,rig.head,.497);segment(rig.head,rig.head,.081);
 for(let i=0;i<2;i++){
  const arm=rig.arms[i],leg=rig.legs[i],m=rig.bodyMetrics;segment(arm.upper,arm.lower,.028,.436);
  add(arm.lower.localToWorld(new THREE.Vector3(0,-m.lowerArm*.43,0)),.016);
  add(arm.lower.localToWorld(new THREE.Vector3(0,-m.lowerArm-.065*m.body.handSize/100,0)),.006);
  segment(leg.upper,leg.lower,.100,.433);segment(leg.lower,leg.foot,.0465,.433);segment(leg.foot,leg.foot,.0145);
 }
 return sum.multiplyScalar(1/mass);
}
test('COM matrix caching agrees with world-position reference after parent, joint and body changes',()=>{
 for(const height of [1.55,1.81,2.1]){
  const rig=fixture({height,body:{armLength:107,legLength:94,handSize:113}}),parent=new THREE.Group();parent.add(rig.root);
  for(let frame=0;frame<12;frame++){
   parent.position.set(frame*.4,frame*.01,-frame*.2);parent.rotation.y=frame*.13;rig.root.rotation.z=Math.sin(frame)*.12;
   rig.arms[0].upper.rotation.x=frame*.05;rig.arms[1].lower.rotation.x=-frame*.1;rig.legs[0].upper.rotation.x=-frame*.08;rig.legs[0].lower.rotation.x=frame*.12;
   const actual=bodyCenterOfMass(rig),expected=referenceCenter(rig);
   for(const axis of ['x','y','z'])assert.ok(Math.abs(actual[axis]-expected[axis])<1e-10);
  }
 }
});

test('distant faces skip hidden morph work and resume immediately without skipping body animation',()=>{
 const rig=fixture({height:1.81}),calls=[];rig.animateFace=(...args)=>calls.push(args);rig.distant=true;
 const p={id:4,height:1.81,x:0,z:0,yaw:0,vx:0,vz:3.5};
 animatePlayer(rig,3.5,1/60,1,false,p);const phase=rig.phase;
 animatePlayer(rig,3.5,1/60,1+1/60,false,p);assert.equal(calls.length,0);assert.ok(rig.phase>phase);assert.ok(Number.isFinite(rig.centerOfMass.y));
 rig.distant=false;animatePlayer(rig,3.5,1/60,2,false,p);assert.equal(calls.length,1);assert.equal(calls[0][0],2);
});
