import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {register} from 'node:module';
import {AdaptiveQuality} from '../src/adaptive-quality.js';
register('../tools/three-loader.mjs',import.meta.url);
const {MatchCamera}=await import('../src/camera.js');
test('adaptive rendering has hysteresis, a lower bound and explicit fixed-quality reset',()=>{
 const quality=new AdaptiveQuality();for(let i=0;i<2000;i++)quality.update(.045);
 assert.equal(quality.scale,.7);for(let i=0;i<30;i++)quality.update(.016);assert.equal(quality.scale,.7);
 for(let i=0;i<4000;i++)quality.update(.016);assert.equal(quality.scale,1);
 for(let i=0;i<2000;i++)quality.update(.05);assert.equal(quality.update(.016,false),true);assert.equal(quality.scale,1);
});

test('all four corners frame the kicker, goal and penalty-area receivers with screen margins',()=>{
 for(const end of [-1,1])for(const side of [-1,1]){
  const camera=new THREE.PerspectiveCamera(43,1292/918,.08,250),director=new MatchCamera(camera);
  const match={state:'playing',setPiece:{kind:'corner'},controlled:{x:end*52,z:side*33.5},physics:{ball:{position:{x:end*52,y:.2,z:side*33.5},velocity:{x:0,z:0}}}};
  for(let i=0;i<600;i++)director.update(match,0,1/60,i/60);camera.updateMatrixWorld();
  for(const point of [[end*52,.2,side*33.5],[end*52.5,1,0],[end*41,1,6],[end*41,1,-6]]){
   const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9,JSON.stringify({end,side,point,p}));
  }
 }
});
test('broadcast framing keeps the ball, controlled player and near goal visible in both directions',()=>{
 for(const sign of [-1,1]){const camera=new THREE.PerspectiveCamera(43,1292/918,.08,250),director=new MatchCamera(camera);
 const match={state:'playing',controlled:{x:sign*38,z:9},physics:{ball:{position:{x:sign*42,y:.2,z:6},velocity:{x:sign*22,z:0}}}};
 for(let i=0;i<600;i++)director.update(match,0,1/60,i/60);camera.updateMatrixWorld();
 for(const point of [[sign*42,.2,6],[sign*38,1,9],[sign*52.5,1,0]]){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,JSON.stringify({sign,point,p}));}
 const previous=camera.position.clone();match.physics.ball.velocity.x=-sign*80;match.controlled.x=-sign*35;director.update(match,0,1/60,10);assert.ok(previous.distanceTo(camera.position)<=28/60+1e-8);
 }
});
