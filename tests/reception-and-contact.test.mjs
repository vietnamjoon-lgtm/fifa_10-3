import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {DuelMatch,matchSnapshot} from '../src/duel.js';
import {defaults} from '../src/settings.js';
import {collectionMovement} from '../src/ball-assistance.js';

const idle={axis:{x:0,z:0}};
const point=p=>({x:p.x,y:p.y,z:p.z});
function match(team=0,onEvent=()=>{}){
 const m=new Match({...defaults,userTeam:team,seed:17},onEvent);m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled,d=m.direction(team);p.x=-20;p.z=0;p.target={x:p.x,z:p.z};m.physics.reset(p.x+d*.54,-d*.11);
 return {m,p,d};
}
const advance=(m,count,input=idle)=>{for(let i=0;i<count;i++)m.step(1/120,input);};

test('receiving assist keeps neutral and approaching input helpful while respecting lateral movement',()=>{
 for(const team of [0,1])for(const half of [1,2]){
  const {m,p}=match(team);m.half=half;const d=m.direction(team);m.owner=null;m.physics.reset(p.x+d*4,0);m.receiving={player:p,expires:5};
  const ball=point(m.physics.ball.position),velocity=point(m.physics.ball.velocity);
  for(const axis of [{x:0,z:0},{x:d,z:0},{x:d*.7,z:.7}])assert.ok(collectionMovement(m,p,axis)?.axis.x*d>0);
  for(const axis of [{x:-d,z:0},{x:0,z:1},{x:0,z:-1}])assert.equal(collectionMovement(m,p,axis),null);
  assert.deepEqual(point(m.physics.ball.position),ball);assert.deepEqual(point(m.physics.ball.velocity),velocity);
  m.settings.receiveAssist=false;assert.equal(collectionMovement(m,p,idle.axis),null);
  m.receiving=null;assert.ok(collectionMovement(m,p,idle.axis),'loose-ball collection remains independently enabled');
  m.settings.looseBallAssist=false;assert.equal(collectionMovement(m,p,idle.axis),null);
 }
});

test('online receiving preferences remain independent for both seats',()=>{
 for(const team of [0,1]){
  const m=new DuelMatch({seed:17});m.start();m.state='playing';m.owner=null;m.lock=0;
  m.setInput(team,idle,'basic',{receiveAssist:true});m.setInput(1-team,idle,'basic',{receiveAssist:false});
  m.withSeat(team,()=>{const p=m.controlled,d=m.direction(team);p.action=null;p.touchCooldown=0;m.physics.reset(p.x+d*4,p.z);m.receiving={player:p,expires:5};
   assert.ok(collectionMovement(m,p,idle.axis));assert.equal(collectionMovement(m,p,{x:-d,z:0}),null);
  });
  m.withSeat(1-team,()=>{const p=m.controlled,d=m.direction(1-team);p.action=null;p.touchCooldown=0;m.physics.reset(p.x+d*4,p.z);m.receiving={player:p,expires:5};assert.equal(collectionMovement(m,p,idle.axis),null);});
  assert.equal(m.assistanceForTeam(team).receiveAssist,true);assert.equal(m.assistanceForTeam(1-team).receiveAssist,false);
 }
});

test('moving passes and shots freeze their visual target at the actual release point in both directions',()=>{
 for(const team of [0,1])for(const sprint of [false,true])for(const type of ['pass','shoot'])for(const turn of [0,.5,-.5,1]){
  let release=null;const {m,p,d}=match(team,(name,event)=>{if(name==='kick')release={ball:point(m.physics.ball.position),target:{...event.player.action.contactTarget},action:event.player.action};});
  advance(m,144,{axis:{x:d,z:0},sprint});m.input={axis:{x:d,z:turn}};assert.ok(m.queueKick(p,type,.6));
  for(let i=0;i<96&&!release;i++)m.step(1/120,idle);
  assert.ok(release,`${team} ${sprint} ${type} ${turn}`);assert.deepEqual(release.target,release.ball);
  assert.deepEqual(m.contacts.at(-1).target,release.ball);assert.equal(m.contacts.at(-1).contactTime,m.contacts.at(-1).ballReleaseTime);
  advance(m,10);assert.deepEqual(release.action.contactTarget,release.ball,'follow-through cannot chase the departed ball');
  assert.ok(Math.hypot(m.physics.ball.position.x-release.ball.x,m.physics.ball.position.z-release.ball.z)>.05);
 }
});

test('refreshing the visual contact location does not reopen a committed aiming direction',()=>{
 const {m,p}=match();m.input={axis:{x:1,z:0}};assert.ok(m.queueKick(p,'shoot',.6));
 const a=p.action;a.elapsed=a.commitAt-.001;m.time=1;m.updateAction(p,.002);assert.equal(a.commitTime,1);
 const aim={...a.aim},committed={...a.committedTarget};m.owner=null;m.physics.ball.position.z+=.14;
 const ball=point(m.physics.ball.position),velocity=point(m.physics.ball.velocity);m.time+=1/120;m.updateAction(p,1/120);
 assert.equal(a.hit,false);assert.deepEqual(a.aim,aim);assert.deepEqual(a.committedTarget,committed);assert.deepEqual(a.contactTarget,ball);
 assert.deepEqual(point(m.physics.ball.position),ball);assert.deepEqual(point(m.physics.ball.velocity),velocity);
});

test('the existing online action snapshot carries the exact released contact target',()=>{
 for(const team of [0,1]){
  let released=null;const m=new DuelMatch({seed:17},(name,event)=>{if(name==='kick')released={id:event.player.id,ball:point(m.physics.ball.position)};});
  m.start();m.state='playing';m.aiClock=1e6;m.lock=0;
  for(const p of m.players){p.active=false;p.action=null;p.cooldown=p.touchCooldown=0;}
  m.withSeat(team,()=>{const p=m.controlled,d=m.direction(team);p.active=true;p.x=p.z=p.vx=p.vz=0;p.yaw=d*Math.PI/2;p.target={x:0,z:0};m.owner=p;m.physics.reset(d*.54,-d*.11);m.input={axis:{x:d,z:0}};assert.ok(m.queueKick(p,'pass',.6));});
  for(let i=0;i<96&&!released;i++)m.step(1/120);
  assert.ok(released);const snapshot=matchSnapshot(m),action=snapshot.players.find(p=>p.id===released.id).action;
  assert.deepEqual(action.contactTarget,released.ball);assert.ok(action.hit);
 }
});
