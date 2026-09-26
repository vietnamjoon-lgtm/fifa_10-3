import test from 'node:test';
import assert from 'node:assert/strict';
import {Input} from '../src/input.js';
import {Match} from '../src/match.js';
import {DuelMatch} from '../src/duel.js';
import {defaults} from '../src/settings.js';
import {foul,applyCard,inPenaltyArea,updateAdvantage} from '../src/referee.js';
import {resolveBodyContacts} from '../src/contacts.js';

const idle={axis:{x:0,z:0}};
const advance=(m,s,i=idle)=>{for(let n=0;n<s*120;n++)m.step(1/120,i);};
function inputRig(settings={},context={attack:true}){const events=[];let time=1000;const input=new Input({...defaults,...settings},(action,options)=>events.push({action,options}),()=>context,{now:()=>time,getPads:()=>[]});input.enabled=true;return {input,events,context,tick:n=>time+=n};}
function matchRig(){const events=[];const m=new Match({...defaults},(type,data)=>events.push({type,data}));m.start(false);m.state='playing';m.aiClock=1e6;m.lock=0;for(const p of m.players){p.active=false;p.touchCooldown=0;p.cooldown=0;p.action=null;}const p=m.players[9],q=m.players[17];p.active=q.active=true;p.x=q.x=0;p.z=0;q.z=8;p.yaw=Math.PI/2;q.yaw=-Math.PI/2;p.target={x:p.x,z:p.z};q.target={x:q.x,z:q.z};m.controlled=p;m.owner=p;m.physics.reset(.54,-.11);return {m,p,q,events};}

test('online arrows move, E sprints, and WASD are actions rather than movement',()=>{const {input,events}=inputRig();input.keyDown('ArrowRight');input.keyDown('KeyE');assert.equal(input.axis.x,1);assert.ok(input.sprint);input.keyDown('KeyD');assert.equal(events.at(-1).action,'charge');input.keyUp('KeyD');assert.equal(events.at(-1).action,'shoot');input.keyUp('ArrowRight');assert.equal(input.axis.x,0);});
test('either Shift key sprints in both key orders without a skill or defensive switch',()=>{
 for(const attack of [true,false])for(const key of ['ShiftLeft','ShiftRight'])for(const first of [true,false]){
  const {input,events}=inputRig({}, {attack});for(const code of first?[key,'ArrowRight']:['ArrowRight',key])input.keyDown(code);
  assert.equal(input.sprint,true);assert.equal(input.axis.x,1);assert.equal(events.length,0);
  input.keyUp(key);assert.equal(input.sprint,false);
 }
 const {input,events}=inputRig();input.keyDown('ShiftLeft');input.keyDown('Digit1');assert.equal(events.at(-1).action,'skill');
});
test('holding Shift drives the existing knock-and-run dribble and releasing it stops sprinting',()=>{
 const {m,p}=matchRig();m.players[17].active=false;const {input}=inputRig();input.keyDown('ArrowRight');input.keyDown('ShiftLeft');let gap=0;
 for(let i=0;i<120;i++){m.step(1/120,input.poll());gap=Math.max(gap,Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z));}
 assert.ok(p.sprinting);assert.ok(p.vx>5);assert.ok(gap>1&&gap<2);assert.equal(m.owner,p);
 input.keyUp('ShiftLeft');assert.equal(input.poll().sprint,false);
});
test('attack modifier chords preserve their options through release',()=>{for(const [modifier,button,command,option] of [['KeyZ','KeyD','shoot','curve'],['KeyQ','KeyD','shoot','chip'],['KeyQ','KeyW','through','lob'],['KeyZ','KeyS','pass','driven'],['KeyQ','KeyS','pass','oneTwo'],['KeyQ','KeyA','lob','early']]){const {input,events}=inputRig();input.keyDown(modifier);input.keyDown(button);input.keyUp(modifier);input.keyUp(button);const event=events.findLast(e=>e.action===command);assert.ok(event?.options[option],`${modifier} ${button}`);}});
test('basic and tactical defence map switch, pressing and slide by context',()=>{for(const defence of ['basic','tactical']){const {input,events}=inputRig({defence},{attack:false});input.keyDown(defence==='basic'?'KeyS':'KeyQ');assert.equal(events.at(-1).action,'switch');input.keyDown('KeyD');assert.equal(events.at(-1).action,'tackle');assert.equal(input.charging,false);input.keyDown('KeyA');assert.equal(events.at(-1).action,'slide');input.keyDown(defence==='basic'?'KeyQ':'KeyZ');assert.ok(input.teamPress);input.keyDown('KeyW');assert.ok(input.keeperRush);}});
test('double shot, fake shot, repeated cross and cancel are distinct input sequences',()=>{const a=inputRig();a.input.keyDown('KeyD');a.input.keyUp('KeyD');a.tick(80);a.input.keyDown('KeyD');assert.equal(a.events.at(-1).action,'lowShot');const b=inputRig();b.input.keyDown('KeyD');b.input.keyDown('KeyS');b.input.keyUp('KeyD');assert.equal(b.events.at(-1).action,'fake');assert.ok(!b.events.some(e=>e.action==='shoot'));const c=inputRig();c.input.keyDown('KeyA');c.input.keyUp('KeyA');c.tick(60);c.input.keyDown('KeyA');assert.equal(c.events.at(-1).options.ground,true);c.input.keyDown('KeyC');c.input.keyDown('KeyE');assert.equal(c.events.at(-1).action,'cancel');});
test('paused input and blur cannot fire a stored shot after returning',()=>{const {input,events}=inputRig();input.keyDown('KeyD');input.enabled=false;input.clear();input.keyUp('KeyD');assert.equal(events.filter(e=>e.action==='shoot').length,0);});
test('legacy controls remain available without conflicting online actions',()=>{const {input,events}=inputRig({controls:'legacy'});input.keyDown('KeyD');assert.equal(input.axis.x,1);assert.equal(events.length,0);input.keyDown('KeyJ');assert.equal(events.at(-1).action,'pass');input.keyDown('KeyK');input.keyUp('KeyK');assert.equal(events.at(-1).action,'shoot');});
test('penalty area includes its boundary and follows the half direction',()=>{const {m}=matchRig();assert.ok(inPenaltyArea(m,{x:36,z:20.16},1));assert.equal(inPenaltyArea(m,{x:35.99,z:0},1),false);m.half=2;assert.ok(inPenaltyArea(m,{x:-40,z:0},1));assert.equal(inPenaltyArea(m,{x:40,z:0},1),false);});
test('reckless fouls produce bookings, second yellow dismisses and kickoff cannot restore player',()=>{const {m,p,q}=matchRig();q.x=1;q.z=0;foul(m,p,q,{slide:true,relativeSpeed:6});assert.equal(m.state,'restart');assert.equal(p.yellows,1);m.state='playing';q.down=0;foul(m,p,q,{slide:true,relativeSpeed:6});assert.ok(p.sentOff);assert.equal(m.stats.reds[0],1);m.kickoff(0);assert.equal(p.active,false);assert.notEqual(m.controlled,p);});
test('late foul in penalty area is called after an attacker has kicked',()=>{const {m,p,q}=matchRig();p.x=40;p.z=0;q.x=40.5;q.z=0;m.owner=null;m.lastTouch=p;m.lastKickTime=m.time-3;foul(m,q,p,{relativeSpeed:3});assert.equal(m.restart.kind,'penalty');assert.equal(m.restart.team,0);});
test('advantage preserves an attacking shot and recalls a free kick when possession is lost',()=>{const {m,p,q}=matchRig();p.x=0;q.x=-.6;q.z=0;m.owner=null;m.lastTouch=p;m.lastKickTime=m.time;m.physics.kick({x:1,z:0},22,2);foul(m,q,p,{relativeSpeed:6});assert.equal(m.state,'playing');assert.ok(m.advantage);assert.equal(q.yellows,0);m.owner=q;updateAdvantage(m);assert.equal(m.state,'restart');assert.equal(q.yellows,1);assert.equal(m.restart.team,0);});
test('a goal during advantage is counted and deferred booking is applied',()=>{const {m,p,q}=matchRig();p.x=20;q.x=19.5;q.z=0;m.owner=null;m.lastTouch=p;m.lastKickTime=m.time;m.physics.reset(51,0,.7);m.physics.kick({x:1,z:0},25,0);foul(m,q,p,{relativeSpeed:6});assert.ok(m.advantage);advance(m,.2);assert.equal(m.score[0],1);assert.equal(q.yellows,1);assert.equal(m.advantage,null);});
test('opponent deflection preserves offside while controlled possession clears it',()=>{const {m,p,q}=matchRig();m.owner=null;m.offside=new Set([p.id]);p.x=10;q.x=0;q.z=0;m.physics.reset(-.2,0,1);m.physics.ball.velocity.set(20,0,0);resolveBodyContacts(m,{x:-.5,y:1,z:0});assert.ok(m.offside.has(p.id));m.physics.reset(.2,0);q.touchCooldown=0;m.updatePossession(1/120);assert.equal(m.owner,q);assert.equal(m.offside.size,0);});
test('corner and goal-kick first passes bypass offside then return to normal play',()=>{for(const kind of ['corner','goalkick']){const {m,p,q}=matchRig();p.x=0;q.x=40;q.z=10;m.setPiece={kind,taker:p,team:0};m.queueKick(p,'pass',.5,{x:20,z:0});advance(m,.4);assert.equal(m.setPiece,null);assert.equal(m.offside.size,0);assert.equal(m.restartOrigin.kind,kind);}});
test('throw-ins cannot directly score and restart for the defending team',()=>{const {m,p}=matchRig();p.x=0;m.owner=null;m.restartOrigin={kind:'throw',player:p.id,team:0};m.physics.reset(51,0,.6);m.physics.kick({x:1,z:0},25,0);advance(m,.2);assert.equal(m.score[0],0);assert.equal(m.restart.kind,'goalkick');assert.equal(m.restart.team,1);});
test('goalkeeper cannot catch a deliberate teammate backpass',()=>{const {m,p,q}=matchRig();q.active=false;const keeper=m.players[0];keeper.active=true;keeper.x=-45;keeper.z=0;keeper.touchCooldown=0;m.owner=null;m.lastTouch=p;m.lastTouchTeam=0;m.lastTouchKind='kick';m.physics.reset(-44.7,0);m.updatePossession(1/120);assert.equal(m.heldBy,null);assert.equal(m.owner,keeper);});
test('manual throw-in waits for input and sends the ball back onto the pitch',()=>{const {m}=matchRig();m.beginRestart({kind:'throw',team:0,x:5,z:33.7,label:'스로인'});advance(m,1.8);assert.equal(m.setPiece.kind,'throw');m.action('pass');assert.equal(m.setPiece,null);assert.ok(m.physics.ball.velocity.z<0);assert.equal(m.lastTouchKind,'throw');});
test('extra time is followed by halftime and resets for the second half',()=>{const {m}=matchRig();m.settings.halfSeconds=60;m.stoppageSeconds=10;m.elapsed=59.99;advance(m,.1);assert.equal(m.state,'playing');assert.equal(m.addedTime,4);advance(m,4);assert.equal(m.state,'halftime');advance(m,3.1);assert.equal(m.half,2);assert.equal(m.addedTime,null);});

test('online kick-off selects a sent-off taker replacement for either team without taking the other seat',()=>{
 for(const team of [0,1])for(const half of [1,2])for(const sentOff of [false,true]){
  const m=new DuelMatch({seed:9});m.start(false);m.half=half;
  if(sentOff)m.players[team*11+9].sentOff=true;
  m.kickoff(team);const other=1-team,otherPlayer=m.players[other*11+5];
  m.withSeat(other,()=>{m.controlled=otherPlayer;});
  while(m.state==='kickoff')m.step(1/120);
  const taker=m.setPiece.taker;
  assert.equal(m.selected(team),taker);assert.ok(taker.active);
  assert.equal(m.selected(other),otherPlayer);assert.equal(m.seatTeam,0);
  if(sentOff)assert.notEqual(taker.id,team*11+9);
  m.command(other,'pass');assert.equal(taker.action,null);assert.equal(otherPlayer.action,null);
  m.command(team,'pass');assert.equal(taker.action?.type,'pass');
  assert.equal(m.selected(other),otherPlayer);
  advance(m,.45);assert.ok(m.lastKickTime>0);assert.equal(m.lastTouchTeam,team);
 }
});

test('a direct kick-off goal counts at the opponent end but awards a corner at the own end',()=>{
 for(const team of [0,1])for(const half of [1,2])for(const own of [false,true]){
  const m=new Match({...defaults,seed:9});m.start(false);m.state='playing';m.half=half;m.aiClock=1e6;
  for(const p of m.players)p.active=false;
  m.owner=null;m.lock=0;m.restartOrigin={kind:'kickoff',player:team*11+9,team};
  const end=m.direction(team)*(own?-1:1);m.physics.reset(end*51,0,.6);m.physics.kick({x:end,z:0},25,0);
  advance(m,.15);
  if(own){assert.deepEqual(m.score,[0,0]);assert.equal(m.restart.kind,'corner');assert.equal(m.restart.team,1-team);}
  else{assert.equal(m.score[team],1);assert.equal(m.state,'goal');}
 }
});
