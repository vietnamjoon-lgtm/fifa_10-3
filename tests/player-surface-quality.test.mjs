import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import {uniformLabelProjector} from '../src/uniform-labels.js';
import {sculptedHairGeometry} from '../src/sculpted-head.js';
import {createAnatomicalBody} from '../src/anatomical-player.js';
import {applyBodyPreset} from '../src/body-shape.js';
import {fixture} from '../tools/human-fixture.mjs';
register('../tools/three-loader.mjs',import.meta.url);
const {advancePortraitMotion}=await import('../src/player-portrait.js');

test('jersey lettering conforms on both sides and inherits surface weights and corrective motion',()=>{
 const surface=new THREE.BufferGeometry(),position=[],normal=[],index=[],weight=[],skin=[],morph=[];
 for(const side of [1,-1])for(const [x,y]of [[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){position.push(x,y,side*.1);normal.push(0,0,side);skin.push(x<0?1:2,0,0,0);weight.push(1,0,0,0);morph.push(.02*(x+.2),0,0);}
 index.push(0,1,2,1,3,2,4,6,5,5,6,7);surface.setAttribute('position',new THREE.Float32BufferAttribute(position,3));surface.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));surface.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skin,4));surface.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));surface.setIndex(index);surface.morphTargetsRelative=true;surface.morphAttributes.position=[new THREE.Float32BufferAttribute(morph,3)];
 const project=uniformLabelProjector(surface);
 for(const side of [1,-1]){const label=new THREE.PlaneGeometry(.2,.2,2,2);label.rotateY(side<0?Math.PI:0);label.translate(0,0,side*.3);project(label);
  for(let i=0;i<label.attributes.position.count;i++){const source=label.userData.uniformProjection.sourceVertices[i];assert.ok(Math.abs(label.attributes.position.getZ(i)-side*.1015)<1e-7);assert.ok(Math.abs(label.attributes.normal.getZ(i)-side)<1e-7);const w=label.attributes.skinWeight.array.slice(i*4,i*4+4);assert.ok(Math.abs(w.reduce((a,b)=>a+b)-1)<1e-7);assert.equal(label.morphAttributes.position[0].getX(i),surface.morphAttributes.position[0].getX(source));assert.deepEqual(label.attributes.skinIndex.array.slice(i*4,i*4+4),surface.attributes.skinIndex.array.slice(source*4,source*4+4));}
  assert.equal(label.userData.uniformProjection.clamped,0);assert.ok(label.userData.uniformProjection.maxCorrection>.19);assert.equal(label.userData.uniformProjection.sourceTopology,true);
 }
});

test('front and rear uniform lettering stays finite on all four player body types',()=>{
 for(const type of ['slim','normal','sturdy','unique']){const profile=applyBodyPreset({height:1.81,weight:78,body:{waist:82,shoulders:114}},type),rig=fixture(profile),c=new THREE.Color('white'),body=createAnatomicalBody(rig,{skin:c,kit:c,shorts:c,sock:c}),project=uniformLabelProjector(body.garment.geometry);
  for(const [side,y,z,width,height]of [[1,.34,.19,.30,.115],[-1,.31,-.19,.34,.34],[-1,.47,-.16,.31,.09]]){const label=new THREE.PlaneGeometry(width*rig.bodyMetrics.width,height,8,8);label.rotateY(side<0?Math.PI:0);label.translate(0,rig.bodyMetrics.mapY(.91+y),z);project(label);
   assert.ok([...label.attributes.position.array,...label.attributes.normal.array,...label.attributes.skinWeight.array].every(Number.isFinite));assert.equal(label.morphAttributes.position.length,8);assert.ok(label.userData.uniformProjection.maxCorrection>.02);for(let v=0;v<label.attributes.skinWeight.count;v++)assert.ok(Math.abs(label.attributes.skinWeight.array.slice(v*4,v*4+4).reduce((a,b)=>a+b)-1)<3e-6);
  }
 }
});

test('hair styles have different real silhouettes without increasing source vertex or triangle counts',()=>{
 const geometries=['crop','short','crest'].map(style=>sculptedHairGeometry({},style));for(const g of geometries){g.computeBoundingBox();assert.ok([...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite));assert.equal(g.attributes.position.count,geometries[0].attributes.position.count);assert.equal(g.index.count,geometries[0].index.count);}
 assert.ok(geometries[1].boundingBox.max.y>geometries[0].boundingBox.max.y+.006);assert.ok(geometries[2].boundingBox.max.y>geometries[0].boundingBox.max.y+.012);
 geometries.forEach(g=>g.dispose());
});

test('portrait running moves its reported world position by its velocity in every viewing direction',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){const original={x:0,z:0};let state=original;for(let i=0;i<20;i++){const previous=state;state=advancePortraitMotion(state,5.8,.05,yaw);assert.ok(Math.abs(state.x-previous.x-state.vx*.05)<1e-9);assert.ok(Math.abs(state.z-previous.z-state.vz*.05)<1e-9);}assert.ok(Math.abs(Math.hypot(state.x,state.z)-5.8)<1e-9);assert.deepEqual(original,{x:0,z:0});const stopped=advancePortraitMotion(state,0,.05,yaw);assert.equal(stopped.x,state.x);assert.equal(stopped.z,state.z);}
});

test('curved jersey lettering uses the same triangles and weights rather than bridging across folds',()=>{
 const rig=fixture({height:1.81}),c=new THREE.Color('white'),body=createAnatomicalBody(rig,{skin:c,kit:c,shorts:c,sock:c}),surface=body.garment.geometry,label=new THREE.PlaneGeometry(.34,.34,8,8);label.rotateY(Math.PI);label.translate(0,rig.bodyMetrics.mapY(1.22),-.19);uniformLabelProjector(surface)(label);
 const sources=label.userData.uniformProjection.sourceVertices,sourceTriangles=new Set();for(let k=0;k<surface.index.count;k+=3)sourceTriangles.add([surface.index.getX(k),surface.index.getX(k+1),surface.index.getX(k+2)].join(','));
 for(let k=0;k<label.index.count;k+=3)assert.ok(sourceTriangles.has([sources[label.index.getX(k)],sources[label.index.getX(k+1)],sources[label.index.getX(k+2)]].join(',')));
 for(let i=0;i<sources.length;i++){const source=sources[i];for(let axis=0;axis<3;axis++)assert.ok(Math.abs(label.attributes.position.array[i*3+axis]-surface.attributes.position.array[source*3+axis]-surface.attributes.normal.array[source*3+axis]*.0015)<1e-7);for(let j=0;j<4;j++)assert.equal(label.attributes.skinWeight.array[i*4+j],surface.attributes.skinWeight.array[source*4+j]);}
});
