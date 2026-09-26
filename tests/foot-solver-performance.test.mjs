import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import {fixture} from '../tools/human-fixture.mjs';
import {solveFoot} from '../src/foot-plant.js';
register('../tools/three-loader.mjs',import.meta.url);
const {animatePlayer}=await import('../src/player.js');

test('reused IK scratch reaches alternating legs without stretching or changing target inputs',()=>{
 for(const height of [1.55,1.81,2.1]){
  const rig=fixture({height});rig.root.position.set(8,0,-3);rig.root.rotation.set(.07,1.2,-.04);
  for(let n=0;n<32;n++){
   const index=n%2,leg=rig.legs[index],hip=leg.upper.getWorldPosition(new THREE.Vector3()),reach=(rig.bodyMetrics.upperLeg+rig.bodyMetrics.lowerLeg)*rig.root.scale.y;
   const target=hip.clone().add(new THREE.Vector3(Math.sin(n)*.22,-.75,Math.cos(n)*.25).multiplyScalar(reach)),saved=target.clone();
   const result=solveFoot(rig,index,target),knee=leg.lower.getWorldPosition(new THREE.Vector3()),foot=leg.foot.getWorldPosition(new THREE.Vector3());
   assert.ok(result.error<1e-7);assert.ok(foot.distanceTo(target)<1e-7);assert.deepEqual(target,saved);
   assert.ok(Math.abs(hip.distanceTo(knee)-rig.bodyMetrics.upperLeg*rig.root.scale.y)<1e-8);
   assert.ok(Math.abs(knee.distanceTo(foot)-rig.bodyMetrics.lowerLeg*rig.root.scale.y)<1e-8);
  }
 }
});

test('distant walking and running retain the same planted feet as the near model',()=>{
 for(const speed of [1.3,3.5,8.5]){
  const p={id:1,height:1.81,x:0,z:0,yaw:0,vx:0,vz:speed},near=fixture(p),far=fixture(p);far.distant=true;
  for(let frame=0;frame<180;frame++){
   const time=frame/60;p.z=speed*time;
   for(const rig of [near,far]){rig.root.position.set(0,0,p.z);animatePlayer(rig,speed,1/60,time,false,p);}
   for(let i=0;i<2;i++)assert.ok(near.legs[i].foot.getWorldPosition(new THREE.Vector3()).distanceTo(far.legs[i].foot.getWorldPosition(new THREE.Vector3()))<1e-9);
  }
 }
});
