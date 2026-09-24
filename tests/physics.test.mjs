import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysics,detectGoal,FIELD} from '../src/physics.js';
const advance=(p,n)=>{for(let i=0;i<n;i++)p.step(1/120)};
test('ball rests above the turf without gaining energy',()=>{const p=createPhysics();p.reset(0,0,3);advance(p,1800);assert.ok(Math.abs(p.ball.position.y-.11)<.012);assert.ok(p.ball.velocity.length()<.1);});
test('ground passes slow down and strong kicks travel farther',()=>{const a=createPhysics(),b=createPhysics();a.kick({x:1,z:0},8,.1);b.kick({x:1,z:0},18,.1);advance(a,240);advance(b,240);assert.ok(a.ball.velocity.x<8);assert.ok(b.ball.position.x>a.ball.position.x+5);assert.ok(a.ball.position.y>0);});
test('fast shot hits the thin post without tunnelling',()=>{const p=createPhysics();p.reset(48,3.72,1);p.kick({x:1,z:0},70,0);advance(p,20);assert.ok(p.ball.velocity.x<0,`velocity ${p.ball.velocity.x}`);assert.ok(p.ball.position.x<52.5);assert.ok(p.ball.velocity.length()<71);});
test('ball must cross completely; wide and high shots are not goals',()=>{assert.equal(detectGoal({x:52,y:.5,z:0},{x:52.55,y:.5,z:0}),-1);assert.equal(detectGoal({x:52,y:.5,z:0},{x:53,y:.5,z:0}),0);assert.equal(detectGoal({x:52,y:.5,z:5},{x:53,y:.5,z:5}),-1);assert.equal(detectGoal({x:52,y:3,z:0},{x:53,y:3,z:0}),-1);assert.equal(detectGoal({x:-52,y:.5,z:0},{x:-53,y:.5,z:0}),1);});
test('opposite sidespin produces opposite lateral movement',()=>{const a=createPhysics(),b=createPhysics();a.reset(0,0,2);b.reset(0,0,2);a.kick({x:1,z:0},20,5,25);b.kick({x:1,z:0},20,5,-25);advance(a,80);advance(b,80);assert.ok(a.ball.position.z<-.02);assert.ok(b.ball.position.z>.02);});

test('a fast descending ball never penetrates the pitch or gains impact energy',()=>{const p=createPhysics();p.reset(0,0,.13);p.ball.velocity.set(3,-25,0);p.step(1/120);assert.ok(p.ball.position.y>=FIELD.ballRadius);assert.ok(p.ball.velocity.length()<25.2);});
