import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {fixture} from '../tools/human-fixture.mjs';
import {stabilizeFeet} from '../src/foot-plant.js';

function contact(age,{height=1.81,foot='right',yaw=0,legLength=100}={}){
 const rig=fixture({height,body:{legLength}}),m=rig.bodyMetrics,index=foot==='left'?0:1,size=m.scale;
 rig.root.position.set(5,0,-3);rig.root.rotation.y=yaw;rig.hips.position.y=.80+m.hipOffset;
 for(const leg of rig.legs){leg.upper.rotation.x=-.25;leg.lower.rotation.x=.65;}
 rig.root.updateMatrixWorld(true);
 const ball=rig.root.localToWorld(new THREE.Vector3((index===0?-1:1)*m.hipX,.12,.32));
 const target=ball.clone().addScaledVector(new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),-.06*size);target.y=Math.max(.075*size,ball.y-.025*size);
 const p={x:5,z:-3,yaw,vx:0,vz:0,action:{type:'pass',foot,contactAt:.18,elapsed:.18+age,contactTarget:{x:ball.x,y:ball.y,z:ball.z}}};
 const before=JSON.stringify(p);stabilizeFeet(rig,p,{state:'pass',contacts:[0,0]},1/120);assert.equal(JSON.stringify(p),before);
 rig.root.updateMatrixWorld(true);const leg=rig.legs[index],ankle=leg.foot.getWorldPosition(new THREE.Vector3());
 return {rig,leg,ankle,target};
}

test('contact blending enters and leaves without a position or joint-rotation jump',()=>{
 for(const foot of ['left','right'])for(const height of [1.55,1.81,2.1])for(const boundary of [-.13,.16]){
  const a=contact(boundary-1e-6,{height,foot}),b=contact(boundary+1e-6,{height,foot});
  assert.ok(a.ankle.distanceTo(b.ankle)<1e-6,`${foot} ${height} boundary ${boundary}`);
  for(const name of ['upper','lower','foot'])assert.ok(a.leg[name].quaternion.angleTo(b.leg[name].quaternion)<1e-5);
 }
});

test('both feet reach exact contact across body heights and attack directions without stretching',()=>{
 for(const foot of ['left','right'])for(const height of [1.55,1.81,2.1])for(const yaw of [-Math.PI/2,Math.PI/2])for(const legLength of [92,108]){
  const {rig,leg,ankle,target}=contact(0,{height,foot,yaw,legLength}),m=rig.bodyMetrics;
  assert.ok(ankle.distanceTo(target)<1e-6,`${foot} ${height} ${yaw} ${legLength}`);
  assert.ok(Math.abs(leg.lower.position.length()-m.upperLeg)<1e-9);assert.ok(Math.abs(leg.foot.position.length()-m.lowerLeg)<1e-9);
 }
});

test('blended contact stays finite and within the two-bone reach throughout the contact window',()=>{
 for(const foot of ['left','right'])for(const height of [1.55,2.1])for(const age of [-.14,-.13,-.10,-.065,-.01,0,.01,.08,.159,.16,.17]){
  const {rig,leg,ankle}=contact(age,{height,foot}),hip=leg.upper.getWorldPosition(new THREE.Vector3()),m=rig.bodyMetrics;
  assert.ok(ankle.toArray().every(Number.isFinite));assert.ok(ankle.distanceTo(hip)<=(m.upperLeg+m.lowerLeg)*m.scale+1e-8);
  for(const bone of [leg.upper,leg.lower,leg.foot])assert.ok(bone.quaternion.toArray().every(Number.isFinite));
 }
});

test('contact diagnostics measure the final blended ankle rather than the unblended IK solution',()=>{
 for(const foot of ['left','right'])for(const age of [-.065,0,.08]){
  const {rig,ankle,target}=contact(age,{foot});assert.ok(Math.abs(rig.impactError-ankle.distanceTo(target))<1e-8);
 }
});
