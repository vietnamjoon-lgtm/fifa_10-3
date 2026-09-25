import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {guidePass,followPassEnabled,createPassFlight} from '../src/guided-pass.js';
import {passTarget} from '../src/assists.js';
import {activePass,collectionMovement} from '../src/ball-assistance.js';
import {DuelMatch} from '../src/duel.js';
import {updateTeamAI} from '../src/ai.js';
import {keeperRelease,throwIn} from '../src/commands.js';
const idle={axis:{x:0,z:0}};
function setup(type='pass',team=0,span=18){const m=new Match({...defaults,userTeam:team,seed:42});m.start(true);m.state='playing';m.aiClock=1e6;m.lock=0;const p=m.controlled,d=m.direction(team),q=m.players[team*11+6];Object.assign(p,{x:-20*d,z:0,yaw:d*Math.PI/2,cooldown:0,touchCooldown:0,target:{x:-20*d,z:0},passing:.2,longPass:.2});Object.assign(q,{active:true,x:p.x+span*d,z:4,vx:0,vz:0,cooldown:0,touchCooldown:0,target:{x:p.x+span*d,z:4}});m.physics.reset(p.x+d*.54,-d*.11);m.owner=p;m.input={axis:{x:d,z:0}};assert.ok(m.queueKick(p,type,.6));return {m,p,q};}
function advance(m,seconds,input=idle){for(let i=0;i<seconds*120;i++)m.step(1/120,input);}
test('unobstructed short, through and lofted passes reach stationary feet without moving the receiver',()=>{for(const team of [0,1])for(const type of ['pass','through','lob'])for(const span of [8,18,32]){const {m,q}=setup(type,team,span),position={x:q.x,z:q.z};let received=false;for(let i=0;i<7*120;i++){m.step(1/120,idle);assert.deepEqual({x:q.x,z:q.z},position,`${type}: receiver must stay put`);if(m.owner===q){received=true;break;}}assert.ok(received,`${type} team ${team} span ${span}`);assert.ok(Math.hypot(q.x-m.physics.ball.position.x,q.z-m.physics.ball.position.z)<1);}});
test('the ball follows a receiver changing direction while receiver controls remain untouched',()=>{for(const team of [0,1])for(const type of ['pass','through']){const {m,q}=setup(type,team,28);advance(m,.35);assert.equal(activePass(m)?.follow,true);let received=false;for(let i=0;i<720;i++){const input={axis:{x:0,z:i<65?1:-1},sprint:true};assert.equal(collectionMovement(m,q,input.axis,input),null);m.step(1/120,input);if(m.owner===q){received=true;break;}}assert.ok(received,`${type} team ${team}`);}});
test('guidance changes ball velocity without teleporting the ball or moving the receiver',()=>{const {m,q}=setup();advance(m,.35);const b=m.physics.ball.position.clone(),v=m.physics.ball.velocity.clone();q.z+=4;const changed={x:q.x,z:q.z};guidePass(m,1/120);assert.deepEqual(m.physics.ball.position,b);assert.notDeepEqual(m.physics.ball.velocity,v);assert.deepEqual({x:q.x,z:q.z},changed);});
test('an opponent on the passing lane can intercept and stops target following',()=>{const {m,p,q}=setup('pass',0,24),enemy=m.players[17];Object.assign(enemy,{active:true,x:p.x+12,z:2,vx:0,vz:0,cooldown:0,touchCooldown:0,target:{x:p.x+12,z:2}});let intercepted=false;for(let i=0;i<600;i++){m.step(1/120,idle);if(m.lastTouch?.team===1){intercepted=true;break;}}assert.ok(intercepted);assert.equal(activePass(m),null);assert.notEqual(m.owner,q);const v=m.physics.ball.velocity.clone();guidePass(m,1/120);assert.deepEqual(m.physics.ball.velocity,v);});
test('a teammate standing in the pass path plays the ball like any other player',()=>{const {m,p,q}=setup('pass',0,24),middle=m.players[7];Object.assign(middle,{active:true,x:p.x+12,z:2,cooldown:0,touchCooldown:0,target:{x:p.x+12,z:2}});advance(m,4);assert.notEqual(m.lastTouch,p);assert.notEqual(m.owner,q);});
test('disabling target following restores the physical pass without random changes to shots',()=>{const {m}=setup();m.settings.passFollow=false;advance(m,.35);assert.equal(activePass(m).follow,false);const v=m.physics.ball.velocity.clone();guidePass(m,1/120);assert.deepEqual(m.physics.ball.velocity,v);m.passFlight=null;assert.equal(guidePass(m,1/120),false);});
test('AI receivers hold their position instead of chasing a guided pass',()=>{for(const type of ['pass','through','lob']){const {m,q}=setup(type),position={x:q.x,z:q.z};advance(m,.35);m.autoplay=true;updateTeamAI(m);assert.equal(q.aiState,'HOLD PASS LANE');assert.deepEqual(q.target,position);assert.equal(q.sprinting,false);}});
test('online seats sanitize and retain independent target-following preferences',()=>{const m=new DuelMatch();m.setInput(0,idle,'basic',{passFollow:false});m.setInput(1,idle,'basic',{passFollow:true});assert.equal(m.assistanceForTeam(0).passFollow,false);assert.equal(m.assistanceForTeam(1).passFollow,true);});
test('keeper hand passes and throw-ins reach a stationary receiver',()=>{for(const kind of ['keeper','throw']){const {m,p,q}=setup('pass',0,18),position={x:q.x,z:q.z};p.action=null;m.physics.reset(p.x+.4,p.z,kind==='throw'?1.7:1.05);if(kind==='keeper'){m.heldBy=p;keeperRelease(m,'keeperPass');}else{m.setPiece={kind:'throw',taker:p,team:0};throwIn(m,'pass');}assert.equal(m.passFlight.follow,true);let caught=false;for(let i=0;i<840;i++){m.step(1/120,idle);assert.deepEqual({x:q.x,z:q.z},position);if(m.owner===q){caught=true;break;}}assert.ok(caught,kind);}});

test('assisted targets stay at the receiver instead of adding a several-metre running lead',()=>{
 for(const team of [0,1])for(const type of ['pass','through','lob']){
  const {m,p,q}=setup(type,team,32);q.vx=6*m.direction(team);q.vz=3;
  const target=passTarget(m,p,q,type);assert.equal(target.x,q.x);assert.equal(target.z,q.z);
 }
});
test('guidance preserves airborne height and vertical velocity',()=>{
 const {m}=setup('lob');advance(m,.35);const b=m.physics.ball.position.clone(),vy=m.physics.ball.velocity.y;
 assert.ok(b.y>.55);assert.equal(guidePass(m,1/120),true);assert.deepEqual(m.physics.ball.position,b);assert.equal(m.physics.ball.velocity.y,vy);
});
test('manual modes and online team preferences independently disable pass guidance',()=>{
 const m=new DuelMatch();m.setInput(0,idle,'basic',{passFollow:false});m.setInput(1,idle,'basic',{passFollow:true,passAssist:'auto',throughAssist:'manual',crossAssist:'manual'});
 assert.equal(followPassEnabled(m,0),false);assert.equal(followPassEnabled(m,1),true);
 for(const type of ['through','lob'])assert.equal(followPassEnabled(m,1,type),false);
 const {m:solo,p,q}=setup();assert.equal(createPassFlight(solo,p,{type:'shoot',receiver:q}),null);
});
test('guidance stops when a receiver is inactive, down or the pass expires',()=>{
 for(const reason of ['inactive','down','expired']){
  const {m,q}=setup();advance(m,.35);
  if(reason==='inactive')q.active=false;else if(reason==='down')q.down=1;else m.time=m.passFlight.expires;
  const v=m.physics.ball.velocity.clone();assert.equal(guidePass(m,1/120),false);assert.equal(m.passFlight,null);assert.deepEqual(m.physics.ball.velocity,v);
 }
});
