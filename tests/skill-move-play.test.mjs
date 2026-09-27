import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {MOVES} from '../src/skill-moves.js';
import {SKILLS,skillAction} from '../src/skills.js';
// Every skill, from a standstill and from a jog: each touch finds the ball and the player keeps it.
function play(key,mode){const dt=1/120,m=new Match({...defaults,seed:5});m.start(false);m.state='playing';m.aiClock=1e6;m.lock=0;m.time=3;for(const q of m.players){q.active=false;q.action=null;}
 const p=m.controlled,d=m.direction(p.team);p.active=true;p.x=-10*d;p.z=0;p.vx=p.vz=0;p.yaw=d*Math.PI/2;p.skillMoves=5;m.owner=p;p.possessedAt=0;m.physics.reset(p.x+d*.4,0,.11);
 const input=mode==='run'?{axis:{x:d,z:0}}:{axis:{x:0,z:0}};for(let i=0;i<(mode==='run'?240:30);i++)m.step(dt,input);m.input=input;
 const a=p.action=skillAction(p,{x:d,z:0},++m.actionId,key);for(let t=0;t<a.duration+2;t+=dt)m.step(dt,input);
 const b=m.physics.ball.position;return {a,kept:m.owner===p||m.lastTouch===p&&Math.hypot(b.x-p.x,b.z-p.z)<2.5};}
test('every FC Online skill move touches the ball each time and keeps it, standing and running',()=>{for(const move of MOVES)for(const mode of ['stand','run']){if(move.state&&move.state!==mode)continue;const {a,kept}=play(move.key,mode);assert.ok(a.events.every(e=>e.done)&&!a.failed,`${move.key} ${mode} missed a touch`);assert.ok(kept,`${move.key} ${mode} lost the ball`);}});
test('numbered skills (Shift + 1~7) touch the ball each time and keep it, standing and running',()=>{for(const skill of Object.keys(SKILLS))for(const mode of ['stand','run']){const {a,kept}=play(skill,mode);assert.ok(a.events.every(e=>e.done)&&!a.failed,`${skill} ${mode}`);assert.ok(kept,`${skill} ${mode} lost the ball`);}});
