import test from 'node:test';
import assert from 'node:assert/strict';
import {MOVES} from '../src/skill-moves.js';
import {howToPress} from '../src/skill-guide.js';
import {skillAction} from '../src/skills.js';
test('every skill move in the guide has spoken key instructions and a playable action',()=>{for(const m of MOVES){const words=howToPress(m);assert.ok(words&&!words.includes('undefined'),m.key);const a=skillAction({id:1,x:0,z:0,yaw:0,foot:'right'},{x:0,z:1},1,m.key);assert.ok(a.move&&a.duration>0,m.key);}});
test('the guide spells out F sweeps and C + Z taps the way the H table writes them',()=>{const step=MOVES.find(m=>m.key==='fco-step-over:right'),juggle=MOVES.find(m=>m.id==='ball-juggle');assert.match(howToPress(step),/F를 누른 채로 방향키를 앞\(→\) → 오른쪽 앞\(↘\) → 오른쪽\(↓\)/);assert.match(howToPress(juggle),/C를 누른 채로 Z를 톡/);});
