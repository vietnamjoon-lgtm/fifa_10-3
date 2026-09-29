import test from 'node:test';
import assert from 'node:assert/strict';
import {MOVE_BY_KEY} from '../src/skill-moves.js';
import {skillAction} from '../src/skills.js';
import {skillFootGoals} from '../src/skill-choreo.js';

// A player at the origin facing +z (his right is -x) with the ball 0.45 m ahead.
const player={x:0,z:0,yaw:0,vx:0,vz:3,foot:'right'},ball={x:0,y:.11,z:.45};
const at=(key,t)=>{const a=skillAction(player,{x:0,z:1},1,key);a.elapsed=t;return {a,goals:skillFootGoals(player,a,ball)};};

test('at each touch the boot is at the ball, on the side away from where the touch sends it',()=>{
 for(const key of ['fco-elastico:right','fco-body-feint:left','fco-feint-exit:right','fco-ball-roll-cut:left']){
  const move=MOVE_BY_KEY[key];move.touches.forEach(([time],k)=>{const {a,goals}=at(key,time),g=goals.find(x=>x.weight>.9);
   assert.ok(g,`${key} touch ${k}: no boot on the ball`);assert.ok(Math.hypot(g.x-ball.x,g.z-ball.z)<.25,`${key} touch ${k}: boot ${Math.hypot(g.x-ball.x,g.z-ball.z).toFixed(2)} m from the ball`);
   assert.equal(a.events.length,move.touches.length);});}
 // The right-hand (reverse) elastico pushes out to the left first, so the boot starts on the ball's right (-x).
 const out=at('fco-elastico:right',.08).goals[0];assert.ok(out.x<ball.x);
});

test('drags and rolls put the sole on top of the ball; a step-over carries the boot over it and lands outside',()=>{
 const drag=at('fco-drag-back',.1).goals[0];assert.ok(drag.y>.25&&Math.hypot(drag.x-ball.x,drag.z-ball.z)<.12,'sole on the ball');
 const key='fco-step-over:right',exit=MOVE_BY_KEY[key].touches[0][0],path=[.1,.2,.3].map(t=>at(key,t).goals.find(g=>g.i===0));
 assert.ok(path.every(Boolean),'stepping boot has a goal');assert.ok(path[1].y>.3,'boot passes over the ball');assert.ok(path[2].x<path[0].x-.3,'boot lands on the far (right) side');
 // The exit is played by the other boot.
 assert.ok(at(key,exit).goals.some(g=>g.i===1&&g.weight>.9));
});

test('no goals outside a skill move, and goals fade in and out rather than switching on',()=>{
 assert.deepEqual(skillFootGoals(player,null,ball),[]);assert.deepEqual(skillFootGoals(player,{type:'shoot'},ball),[]);
 const key='fco-feint-exit:left',touch=MOVE_BY_KEY[key].touches[0][0];let last=0;
 for(let t=touch-.2;t<touch;t+=1/60){const w=at(key,t).goals[0]?.weight||0;assert.ok(w-last<.2,`weight jumped ${last.toFixed(2)} -> ${w.toFixed(2)}`);last=w;}
});
