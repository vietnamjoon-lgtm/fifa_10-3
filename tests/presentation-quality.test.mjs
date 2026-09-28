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
test('broadcast camera spring never overshoots and pans stay under the turn-rate cap',async()=>{
 const {smoothDamp,BROADCAST}=await import('../src/camera.js');
 const state={x:0,xV:0};let max=0;for(let i=0;i<240;i++){smoothDamp(state,'x',10,.4,1/60);max=Math.max(max,state.x);}assert.ok(max<=10+1e-9&&Math.abs(state.x-10)<1e-3);
 const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera),forward=new THREE.Vector3(),previous=new THREE.Vector3();
 const match={state:'playing',controlled:{id:3,x:-30,z:0},physics:{ball:{position:{x:-30,y:.1,z:0},velocity:{x:0,z:0}}}};
 for(let i=0;i<300;i++)director.update(match,0,1/60,i/60);camera.getWorldDirection(previous);
 // A 60 m switch of play: the view must turn smoothly, never faster than the broadcast cap.
 match.physics.ball.position={x:30,y:.1,z:-20};match.physics.ball.velocity={x:25,z:-5};match.controlled={id:3,x:28,z:-18};let fastest=0;
 for(let i=0;i<240;i++){director.update(match,0,1/60,5+i/60);camera.getWorldDirection(forward);fastest=Math.max(fastest,forward.angleTo(previous)*60*180/Math.PI);previous.copy(forward);}
 assert.ok(fastest<=BROADCAST.maxTurn+.5,String(fastest));
 camera.updateMatrixWorld();const p=new THREE.Vector3(30,.1,-20).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,JSON.stringify(p));
});
test('broadcast camera keeps the ball on screen when the controlled player is on the far touchline',()=>{
 const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera);
 const match={state:'playing',controlled:{id:1,x:-4,z:-26},physics:{ball:{position:{x:-6,y:.1,z:9},velocity:{x:0,z:0}}}};
 for(let i=0;i<400;i++)director.update(match,0,1/60,i/60);camera.updateMatrixWorld();
 const ball=new THREE.Vector3(-6,.1,9).project(camera);assert.ok(Math.abs(ball.x)<.95&&Math.abs(ball.y)<.95,JSON.stringify(ball));
 assert.ok(camera.fov>43,'zooms out for the wide spread');
});
test('shadow frustum is fitted around the action, texel-snapped and bounded',async()=>{
 const {fitShadowToAction}=await import('../src/stadium.js');
 const sun=new THREE.DirectionalLight();sun.shadow.mapSize.set(2048,2048);sun.userData.direction=new THREE.Vector3(-48,29,43).normalize();
 const points=[{x:10,z:5},{x:24,z:-8},{x:18,z:12}];const size=fitShadowToAction(sun,points);
 assert.ok(size>=28&&size<=48&&size%4===0,String(size));
 sun.updateMatrixWorld();sun.shadow.updateMatrices(sun);
 for(const p of points){const v=new THREE.Vector3(p.x,1,p.z).applyMatrix4(sun.shadow.matrix);assert.ok(v.x>0&&v.x<1&&v.y>0&&v.y<1&&v.z>0&&v.z<1,JSON.stringify(v));}
 const moved=fitShadowToAction(sun,points.map(p=>({x:p.x+.013,z:p.z})));assert.equal(moved,size);
});
test('time-of-day setting is sanitised and pitch textures stay inside the 5 MB budget',async()=>{
 const fs=await import('node:fs');globalThis.localStorage={getItem:()=>JSON.stringify({timeOfDay:'<script>'}),setItem(){}};
 const {loadSettings}=await import('../src/settings.js');assert.equal(loadSettings().timeOfDay,'night');delete globalThis.localStorage;
 const dir=new URL('../src/textures/',import.meta.url),total=fs.readdirSync(dir).reduce((n,f)=>n+fs.statSync(new URL(f,dir)).size,0);
 assert.ok(total<5*1024*1024,String(total));
});
test('broadcast camera zoom/height options: 5/5 is the tuned view, steps are clamped and saved sanely',async()=>{
 const {broadcastView}=await import('../src/camera.js');
 assert.deepEqual(broadcastView(5,5),{distance:1,elevation:1});
 assert.deepEqual(broadcastView(-4,99),broadcastView(0,10));assert.ok(broadcastView(10,5).distance<broadcastView(0,5).distance);
 globalThis.localStorage={getItem:()=>JSON.stringify({cameraZoom:'7.6',cameraHeight:-3}),setItem(){}};
 const {loadSettings}=await import('../src/settings.js');const s=loadSettings();assert.equal(s.cameraZoom,8);assert.equal(s.cameraHeight,0);delete globalThis.localStorage;
});
test('closest broadcast zoom still keeps the ball framed with the controlled player on the far touchline',()=>{
 for(const zoom of [0,10]){const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera);director.setView(zoom,5);
  const match={state:'playing',controlled:{id:1,x:-4,z:-26},physics:{ball:{position:{x:-6,y:.1,z:9},velocity:{x:0,z:0}}}};
  for(let i=0;i<400;i++)director.update(match,0,1/60,i/60);camera.updateMatrixWorld();
  const ball=new THREE.Vector3(-6,.1,9).project(camera);assert.ok(Math.abs(ball.x)<.95&&Math.abs(ball.y)<.95,JSON.stringify({zoom,ball}));}
});
test('goal replay cuts between a reverse angle and a behind-goal camera, then cuts back to the broadcast view',async()=>{
 const {REPLAY_CUT}=await import('../src/camera.js');
 for(const side of [-1,1]){const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera),ball={x:side*40,y:.4,z:2};
  assert.equal(director.replayShot(ball,0,side*52.5,1/30),true);assert.equal(director.replayShot(ball,.5,side*52.5,1/30),false);
  // Reverse angle stays in front of the far stand (z > -42) and above the boards.
  assert.ok(camera.position.z>-42&&camera.position.y>3,JSON.stringify(camera.position));
  assert.equal(director.replayShot({x:side*52,y:.5,z:1},REPLAY_CUT+.1,side*52.5,1/30),true);
  // Behind-goal camera sits between the ad board (|x|=58) and the end stand (|x|=62), behind the net.
  assert.ok(Math.abs(camera.position.x)>58&&Math.abs(camera.position.x)<62&&Math.sign(camera.position.x)===side,JSON.stringify(camera.position));
  camera.updateMatrixWorld();const p=new THREE.Vector3(side*52,.5,1).project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1);
  director.endReplay();const match={state:'kickoff',controlled:{id:1,x:0,z:0},physics:{ball:{position:{x:0,y:.1,z:0},velocity:{x:0,z:0}}}};
  director.update(match,0,1/60,0);assert.ok(camera.position.distanceTo(director.position)<1e-6,'first broadcast frame after a replay is a cut');}
});
test('celebration shot cuts to a close view of the scorer and stays inside the stadium bowl',()=>{
 for(const [x,z] of [[40,5],[-50,33],[52,-33]]){const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera),scorer={x,z,yaw:0};
  assert.equal(director.celebrationShot(scorer,0,1/30),true);for(let i=1;i<90;i++)assert.equal(director.celebrationShot(scorer,i/30,1/30),false);
  assert.ok(Math.abs(camera.position.x)<=57&&Math.abs(camera.position.z)<=37&&camera.position.y<3,JSON.stringify(camera.position));
  camera.updateMatrixWorld();const head=new THREE.Vector3(x,1.6,z).project(camera);assert.ok(Math.abs(head.x)<.6&&Math.abs(head.y)<.8,JSON.stringify(head));
  // The replay that follows is a new cut, not a continuation.
  assert.equal(director.replayShot({x,y:.3,z},0,Math.sign(x)*52.5,1/30),true);}
});
