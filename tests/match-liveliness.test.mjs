import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {sampleMotion} from '../src/motion.js';
import {updateTeamAI,supportShape} from '../src/ai.js';
const idle={axis:{x:0,z:0}};
const game=()=>{const m=new Match({...defaults,seed:52});m.start(false);m.state='playing';m.setPiece=null;m.lock=0;return m;};
test('human throw waits for two-handed windup then releases exactly once in either half/direction',()=>{
 for(const half of [1,2])for(const team of [0,1])for(const side of [-1,1]){
  const m=game();m.half=half;m.settings.userTeam=team;m.beginRestart({kind:'throw',team,x:5,z:side*33.7,label:'throw'});m.finishRestart();const p=m.setPiece.taker;
  m.action('pass');assert.equal(p.action.type,'throw');
  for(let i=0;i<40;i++)m.step(1/120,idle);assert.equal(m.setPiece.kind,'throw');assert.equal(m.physics.ball.velocity.length(),0);assert.ok(m.physics.ball.position.y>p.height);
  const pose=sampleMotion(p,0,m.time,m.physics.ball.position);assert.equal(pose.state,'throw');assert.ok(pose.arms.every(a=>a.upper[0]<-2));
  for(let i=0;i<18;i++)m.step(1/120,idle);assert.equal(m.setPiece,null);assert.equal(m.lastTouchKind,'throw');assert.ok(m.physics.ball.velocity.z*side<0);
 }
});
test('both diving arms remain raised instead of being overwritten by clearance correction',()=>{
 for(const yaw of [-Math.PI/2,Math.PI/2])for(const direction of [-1,1]){
  const p={x:0,z:0,vx:0,vz:0,yaw,role:'GK',dive:.3,diveDuration:.6,diveDirection:direction};const pose=sampleMotion(p,0,1);
  assert.ok(pose.arms[0].upper[2]<-2);assert.ok(pose.arms[1].upper[2]>2);assert.equal(Math.sign(pose.rootRoll),direction*Math.sign(Math.sin(yaw)));
 }
});
test('no input does not freeze the simulation or trigger an unsolicited human kick',()=>{
 const m=game(),p=m.controlled;m.owner=p;m.physics.reset(p.x+.5,p.z);const positions=m.players.map(p=>[p.x,p.z]);
 for(let i=0;i<240;i++)m.step(1/120,idle);
 assert.ok(m.time>1.9);assert.equal(m.stats.shots[0],0);assert.equal(m.stats.passes[0],0);
 assert.ok(m.players.filter((p,i)=>Math.hypot(p.x-positions[i][0],p.z-positions[i][1])>.5).length>8);
});
test('support players offer changing passing lanes with a stationary carrier',()=>{
 const m=game(),p=m.controlled;m.owner=p;m.time=4;p.stationarySince=0;updateTeamAI(m);const q=m.players[6],a=supportShape(m,q,p);m.time=7;const b=supportShape(m,q,p);
 assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1);assert.ok(Math.abs(b.z)<=30);
});
test('an expired kick cannot remotely propel a ball several metres away',()=>{
 const m=game(),p=m.controlled;m.owner=p;m.physics.reset(p.x+.5,p.z);p.cooldown=0;m.queueKick(p,'shoot',.5);assert.ok(p.action);m.owner=null;m.physics.reset(p.x+10,p.z);
 m.updateAction(p,.9);assert.equal(p.action,null);assert.equal(m.stats.shots[0],0);assert.equal(m.physics.ball.velocity.length(),0);
});
test('cancel clears both the first-touch intent and a queued kick after a long dribble touch',()=>{
 const m=game(),p=m.controlled;m.owner=p;p.pendingKick={type:'shoot',power:.6,expires:5};p.intent={type:'pass',expires:5};
 m.action('cancel');assert.equal(p.pendingKick,null);assert.equal(p.intent,null);assert.equal(p.action,null);
});
test('a new kickoff does not replay a pending kick from the previous phase',()=>{
 const m=game();m.controlled.pendingKick={type:'shoot',power:.6,expires:50};m.kickoff(0);
 assert.ok(m.players.every(p=>!p.pendingKick));
});
