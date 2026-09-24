import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {distance} from '../src/config.js';
import {choosePass} from '../src/ai.js';
import {dribbleTouch} from '../src/assists.js';

const idle={axis:{x:0,z:0}};
function setup(team=0){
 const events={};const m=new Match({...defaults,userTeam:team},type=>events[type]=(events[type]||0)+1);
 m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled;p.x=-20;p.z=0;p.target={x:p.x,z:p.z};
 m.physics.reset(p.x+Math.sin(p.yaw)*.54,-Math.sin(p.yaw)*.11);
 return {m,p,events};
}
const advance=(m,seconds,input=idle)=>{for(let i=0;i<seconds*120;i++)m.step(1/120,input);};
function activate(m,index,x,z){const p=m.players[index];p.active=true;p.x=x;p.z=z;p.target={x,z};p.touchCooldown=0;return p;}

test('sprint turns and braking keep a reachable ball without teleporting it',()=>{
 for(const team of [0,1]){
  const {m,p}=setup(team);let worst=0;
  for(const axis of [{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:1,z:0},{x:0,z:0}]){
   for(let i=0;i<150;i++){m.step(1/120,{axis,sprint:true});worst=Math.max(worst,distance(p,m.physics.ball.position));assert.equal(m.owner,p);}
  }
  // Foot dribbling plays the ball ahead and the player runs onto it; it must stay within possession reach.
  assert.ok(worst<3,`ball separation ${worst}`);
  // A ball knocked ahead at a sprint is chased and trapped, which can take up to one more second.
  for(let i=0;i<120&&m.physics.ball.velocity.length()>=.15;i++){m.step(1/120,idle);assert.equal(m.owner,p);}
  assert.ok(m.physics.ball.velocity.length()<.15);
  const before=m.physics.ball.position.clone();p.touchCooldown=0;dribbleTouch(m,p);
  assert.deepEqual(m.physics.ball.position,before,'a touch changes velocity, never position');
 }
});

test('moving shots and passes make contact after windup in both attack directions',()=>{
 for(const team of [0,1])for(const sprint of [false,true])for(const kind of ['pass','shoot'])for(const turn of [0,.5,-.5,1]){
  const {m,p,events}=setup(team),dir=m.direction(team);
  advance(m,1.2,{axis:{x:dir,z:0},sprint});m.input={axis:{x:dir,z:turn}};
  assert.equal(m.queueKick(p,kind,.6),true);advance(m,.1);assert.equal(events.kick||0,0);
  advance(m,.7);assert.equal(events.kick,1);assert.equal(events.miss||0,0);
 }
});

test('forward diagonal shots cross inside the posts in either half and either team',()=>{
 for(const team of [0,1])for(const half of [1,2])for(const side of [-1,1]){
  const {m,p,events}=setup(team);m.half=half;const dir=m.direction(team);
  p.x=dir*38;p.z=side*10;p.yaw=dir*Math.PI/2;m.physics.reset(p.x+dir*.54,p.z-dir*.11);
  m.input={axis:{x:dir,z:side}};assert.ok(m.queueKick(p,'shoot',.65));
  advance(m,2);assert.equal(events.kick,1);assert.equal(m.score[team],1);
 }
});

test('deliberate backwards shots keep their direction',()=>{
 const {m,p,events}=setup();m.input={axis:{x:-1,z:0}};
 assert.ok(m.queueKick(p,'shoot',.5));advance(m,.9);
 assert.equal(events.kick,1);assert.ok(m.physics.ball.velocity.x<0);
});

test('pass selection respects input, available players and offside',()=>{
 const {m,p}=setup();const forward=activate(m,6,-7,0),back=activate(m,7,-28,0);
 activate(m,8,-20,12);activate(m,10,49,0);
 assert.equal(choosePass(m,p,{x:1,z:0}).player,forward);
 assert.equal(choosePass(m,p,{x:-1,z:0}).player,back);
 forward.active=false;assert.equal(choosePass(m,p,{x:1,z:0}),null);
 p.x=35;m.physics.reset(35.5,0);forward.active=true;forward.x=42;
 activate(m,11,51,0);activate(m,12,45,3);
 assert.equal(choosePass(m,p,{x:1,z:0}).player,forward,'49m teammate is offside');
});

test('assisted ground passes are received at short, medium and long distances',()=>{
 for(const span of [7,15,28,35]){
  const {m,p,events}=setup(),receiver=activate(m,6,p.x+span,2);
  m.input={axis:{x:1,z:0}};assert.ok(m.queueKick(p,'pass',.5));
  advance(m,4);assert.equal(events.kick,1);
  assert.equal(m.owner,receiver,`receiver at ${span}m should control the pass`);
  assert.ok(distance(receiver,m.physics.ball.position)<1);
 }
});

test('released passes retain physical direction when target following is disabled',()=>{
 const {m,p,events}=setup(),q=activate(m,6,-4,0);m.settings.passFollow=false;m.input={axis:{x:1,z:0}};m.queueKick(p,'pass',.5);
 advance(m,.3);assert.equal(events.kick,1);const ball=m.physics.ball,vx=ball.velocity.x,vz=ball.velocity.z;
 q.z=20;q.target={x:q.x,z:q.z};m.receiving=null;advance(m,.25);
 assert.ok(Math.abs(ball.velocity.z/ball.velocity.x-vz/vx)<.02);
});

test('nearest receiver wins independently of roster order and settles an incoming pass',()=>{
 for(const reversed of [false,true]){
  const {m,p}=setup();p.x=-20.85;m.owner=null;
  const q=activate(m,17,-19.8,0);m.physics.reset(-20,0);m.physics.ball.velocity.set(15,0,0);
  if(reversed)m.players.reverse();const before=m.physics.ball.position.clone();m.updatePossession(1/120);
  assert.equal(m.owner,q);assert.ok(m.physics.ball.velocity.length()<4);assert.deepEqual(m.physics.ball.position,before);
 }
});

test('secure possession resists flicker, exposed possession can be intercepted and tackled',()=>{
 const {m,p}=setup(),q=activate(m,17,-19,0);
 m.physics.reset(p.x+.42,0);m.updatePossession(1/120);assert.equal(m.owner,p);
 p.touchCooldown=0;m.physics.reset(p.x+1.05,0);q.x=p.x+1.2;q.touchCooldown=0;
 m.time=1;m.updatePossession(1/120);assert.equal(m.owner,q);
 p.cooldown=0;p.x=q.x-.8;p.yaw=Math.PI/2;m.physics.reset(q.x-.5,0);m.tackle(p);m.updateAction(p,.14);
 assert.equal(m.owner,null);assert.equal(m.lastTouch,p);
});

test('assistance does not collect distant or high balls, or instantly control powerful shots',()=>{
 const {m,p}=setup();m.owner=null;m.physics.reset(p.x+2,0);m.updatePossession(1/120);assert.equal(m.owner,null);
 m.physics.reset(p.x+.5,0,2.5);m.updatePossession(1/120);assert.equal(m.owner,null);assert.equal(m.queueKick(p,'shoot'),false);
 m.physics.reset(p.x+.4,0);m.physics.ball.velocity.set(-32,0,0);m.updatePossession(1/120);
 assert.equal(m.owner,null);assert.ok(m.physics.ball.velocity.length()>10);
});

test('receiver assistance takes the receiver to the ball whatever the stick and resets on kickoff',()=>{
 // The ball is never steered toward a receiver, so reception assistance moves the player instead.
 const {m,p}=setup();m.owner=null;m.physics.reset(p.x+4,0);m.receiving={player:p,expires:5};
 m.step(1/120,{axis:{x:-1,z:0}});assert.equal(m.receiving?.player,p);assert.ok(p.vx>0);
 m.receiving={player:p,expires:5};m.kickoff(0);assert.equal(m.receiving,null);
});
