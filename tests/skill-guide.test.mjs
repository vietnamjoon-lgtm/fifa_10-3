import test from 'node:test';
import assert from 'node:assert/strict';
import {MOVES} from '../src/skill-moves.js';
import {howToPress} from '../src/skill-guide.js';
import {skillAction} from '../src/skills.js';
test('every skill move in the guide has spoken key instructions and a playable action',()=>{for(const m of MOVES){const words=howToPress(m);assert.ok(words&&!words.includes('undefined'),m.key);const a=skillAction({id:1,x:0,z:0,yaw:0,foot:'right'},{x:0,z:1},1,m.key);assert.ok(a.move&&a.duration>0,m.key);}});
test('the guide spells out F sweeps and C + Z taps the way the H table writes them',()=>{const step=MOVES.find(m=>m.key==='fco-step-over:right'),juggle=MOVES.find(m=>m.id==='ball-juggle');assert.match(howToPress(step),/F를 누른 채로 방향키를 앞\(→\) → 오른쪽 앞\(↘\) → 오른쪽\(↓\)/);assert.match(howToPress(juggle),/C를 누른 채로 Z를 톡/);});
test('the guide plays each move from the match itself: running moves on the run, the ball never more than 1.5 m from the player',async()=>{
 const {recordMove}=await import('../src/skill-guide.js'),{Match}=await import('../src/match.js'),{defaults}=await import('../src/settings.js');
 for(const m of MOVES)for(const mode of ['run','stand']){if(m.state&&m.state!==mode)continue;const r=recordMove({Match,defaults},m,mode),f=r.frames;
  const gap=Math.max(...f.map(x=>Math.hypot(x.ball.x-x.p.x,x.ball.z-x.p.z))),travel=f.at(-1).p.z-f[0].p.z;
  assert.ok(gap<1.5,`${m.key} ${mode}: ball ${gap.toFixed(2)} m from the player`);
  assert.ok(f.some(x=>x.p.action?.move===m.key),`${m.key} ${mode}: move not played`);
  if(mode==='run')assert.ok(travel>3&&Math.hypot(f[Math.round(r.start*60)].p.vx,f[Math.round(r.start*60)].p.vz)>3,`${m.key}: not running into the move`);}
});
