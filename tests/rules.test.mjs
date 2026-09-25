import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {boundaryRestart,offsideSnapshot} from '../src/rules.js';
import {resolveBodyContacts} from '../src/contacts.js';
import {Replay} from '../src/replay.js';
test('endline restart changes between corner and goal kick by last touch',()=>{const m=new Match({...defaults});m.start(false);m.physics.reset(53,8);m.lastTouchTeam=1;assert.equal(boundaryRestart(m).kind,'corner');m.lastTouchTeam=0;assert.equal(boundaryRestart(m).kind,'goalkick');});
test('offside is captured at the pass, not recomputed at reception',()=>{const m=new Match({...defaults});m.start(false);const kicker=m.players[9],receiver=m.players[8];kicker.x=20;receiver.x=49;m.physics.reset(20,0);const snapshot=offsideSnapshot(m,kicker);assert.ok(snapshot.has(receiver.id));receiver.x=10;assert.ok(snapshot.has(receiver.id));});
test('airborne ball deflects off a swept player body',()=>{const m=new Match({...defaults});m.start(false);m.state='playing';m.owner=null;for(const p of m.players)p.active=false;const defender=m.players[12];defender.active=true;defender.x=0;defender.z=0;defender.touchCooldown=0;m.physics.reset(-.2,0,1);m.physics.ball.velocity.set(20,0,0);resolveBodyContacts(m,{x:-.5,y:1,z:0});assert.ok(m.physics.ball.velocity.x<0);assert.equal(m.lastTouchTeam,1);});
test('replay stores independent snapshots and never changes live score',()=>{const m=new Match({...defaults});m.start(false);m.state='playing';const replay=new Replay();replay.record(m,.06);replay.begin();const frame=replay.sample(0),old=frame.players[9].x;m.controlled.x+=20;m.score[0]=2;assert.equal(frame.players[9].x,old);assert.equal(m.score[0],2);});
test('unreachable ball cannot be kicked',()=>{const m=new Match({...defaults});m.start(true);m.state='playing';m.physics.reset(40,0);assert.equal(m.queueKick(m.controlled,'shoot',1),false);assert.equal(m.physics.ball.velocity.length(),0);});
test('a goal replay ends with the ball in the net, not before the goal',()=>{const m=new Match({...defaults});m.start(false);m.state='playing';const replay=new Replay();let goalTime=null;
 for(let i=0;i<=6*120;i++){m.time=i/120;m.physics.ball.position.set(30+m.time*4,.3,0);if(m.state==='playing'&&m.physics.ball.position.x>52.6){m.state='goal';goalTime=m.time;replay.begin(goalTime);}replay.record(m,1/120);}
 const first=replay.sample(0),last=replay.sample(5);assert.ok(last.ball.x>52.6,`ends at ${last.ball.x}`);assert.ok(first.ball.x<52.6-3,'starts before the goal');assert.ok(last.time<=goalTime+1.2);
 replay.stop();assert.equal(replay.sample(2),null,'a skipped replay stays skipped');});
