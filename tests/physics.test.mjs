import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysics,detectGoal,FIELD,rollAfter,rollDistance,rollLaunchSpeed,curveDrift} from '../src/physics.js';
const advance=(p,n)=>{for(let i=0;i<n;i++)p.step(1/120)};
test('ball rests above the turf without gaining energy',()=>{const p=createPhysics();p.reset(0,0,3);advance(p,1800);assert.ok(Math.abs(p.ball.position.y-.11)<.012);assert.ok(p.ball.velocity.length()<.1);});
test('ground passes slow down and strong kicks travel farther',()=>{const a=createPhysics(),b=createPhysics();a.kick({x:1,z:0},8,.1);b.kick({x:1,z:0},18,.1);advance(a,240);advance(b,240);assert.ok(a.ball.velocity.x<8);assert.ok(b.ball.position.x>a.ball.position.x+5);assert.ok(a.ball.position.y>0);});
test('fast shot hits the thin post without tunnelling',()=>{const p=createPhysics();p.reset(48,3.72,1);p.kick({x:1,z:0},70,0);advance(p,20);assert.ok(p.ball.velocity.x<0,`velocity ${p.ball.velocity.x}`);assert.ok(p.ball.position.x<52.5);assert.ok(p.ball.velocity.length()<71);});
test('ball must cross completely; wide and high shots are not goals',()=>{assert.equal(detectGoal({x:52,y:.5,z:0},{x:52.55,y:.5,z:0}),-1);assert.equal(detectGoal({x:52,y:.5,z:0},{x:53,y:.5,z:0}),0);assert.equal(detectGoal({x:52,y:.5,z:5},{x:53,y:.5,z:5}),-1);assert.equal(detectGoal({x:52,y:3,z:0},{x:53,y:3,z:0}),-1);assert.equal(detectGoal({x:-52,y:.5,z:0},{x:-53,y:.5,z:0}),1);});
test('opposite sidespin produces opposite lateral movement',()=>{const a=createPhysics(),b=createPhysics();a.reset(0,0,2);b.reset(0,0,2);a.kick({x:1,z:0},20,5,25);b.kick({x:1,z:0},20,5,-25);advance(a,80);advance(b,80);assert.ok(a.ball.position.z<-.02);assert.ok(b.ball.position.z>.02);});

test('a fast descending ball never penetrates the pitch or gains impact energy',()=>{const p=createPhysics();p.reset(0,0,.13);p.ball.velocity.set(3,-25,0);p.step(1/120);assert.ok(p.ball.position.y>=FIELD.ballRadius);assert.ok(p.ball.velocity.length()<25.2);});

test('simulated ground roll follows the shared prediction and slow balls stop',()=>{
 for(const speed of [3,8,16]){const p=createPhysics();p.kick({x:1,z:0},speed,0);advance(p,240);const expected=rollAfter(speed,2).travel;assert.ok(Math.abs(p.ball.position.x-expected)<expected*.03,`${speed} m/s: ${p.ball.position.x} vs ${expected}`);}
 const slow=createPhysics();slow.kick({x:1,z:0},1.5,0);advance(slow,240);assert.ok(Math.hypot(slow.ball.velocity.x,slow.ball.velocity.z)<.05);assert.ok(slow.ball.position.x<1.6);
 for(const [distance,arrival] of [[8,8],[20,8],[35,9.5]])assert.ok(Math.abs(rollDistance(rollLaunchSpeed(distance,arrival),arrival)-distance)<.01);
});

test('drop rebound stays in the natural-turf range and a spinless lofted ball checks up on landing',()=>{
 const drop=createPhysics();drop.reset(0,0,2);let falling=true,peak=0;for(let i=0;i<240;i++){drop.step(1/120);if(falling&&drop.ball.velocity.y>0)falling=false;if(!falling)peak=Math.max(peak,drop.ball.position.y);}
 assert.ok(peak>.6&&peak<1,`rebound ${peak}`);
 const lob=createPhysics();lob.kick({x:1,z:0},16,6);let before=null,after=null,previous=lob.ball.velocity.y;
 for(let i=0;i<360&&after===null;i++){const vx=lob.ball.velocity.x;lob.step(1/120);if(previous<-.5&&lob.ball.velocity.y>0){before=vx;after=lob.ball.velocity.x;}previous=lob.ball.velocity.y;}
 assert.ok(after<before*.8&&after>0,`landing ${before} -> ${after}`);
});

test('side spin bends a lofted kick symmetrically and the aim correction returns it to the target',()=>{
 const bend=(curve,correct)=>{const k=correct?Math.sign(curve)*curveDrift(25,curve,22)/22:0,p=createPhysics();p.kick({x:1,z:k},25,3,curve);for(let i=0;i<360&&p.ball.position.x<22;i++)p.step(1/120);return p.ball.position.z;};
 assert.ok(bend(18,false)<-.8);assert.ok(Math.abs(bend(18,false)+bend(-18,false))<1e-6);
 assert.ok(Math.abs(bend(18,true))<.3);assert.ok(Math.abs(bend(-18,true))<.3);
});
