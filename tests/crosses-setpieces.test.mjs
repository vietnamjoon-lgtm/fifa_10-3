import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {createPhysics} from '../src/physics.js';
import {crossFlight,chooseCross} from '../src/crossing.js';
import {setpieceFlight} from '../src/setpiece-styles.js';
import {DuelMatch,matchSnapshot} from '../src/duel.js';
import {secondTouch} from '../src/setpieces.js';
import {bestPassOption} from '../src/ai.js';
const idle={axis:{x:0,z:0}};
function scene(kind,team=0,half=1){const m=new Match({...defaults,userTeam:team,halfSeconds:120,seed:41});m.start(false);m.state='playing';m.half=half;const d=m.direction(team);m.beginRestart({kind,team,x:d*(kind==='corner'?52:27),z:kind==='corner'?33.5:4,label:kind});m.finishRestart();return m;}
function advance(m,t,input=idle){for(let i=0;i<t*120;i++)m.step(1/120,input);}
test('crosses reach a playable descending height under the real drag and spin model',()=>{for(const distance of [12,25,40])for(const foot of ['left','right'])for(const lowCross of [false,true]){const a={distance,foot,lowCross},f=crossFlight(a,{y:.11}),p=createPhysics();p.reset(0,0,.11);p.kick({x:Math.cos(f.aimOffset),z:Math.sin(f.aimOffset)},f.speed,f.lift,f.curve);let peak=0;const dt=f.flightTime/Math.ceil(f.flightTime*240);for(let i=0;i<Math.ceil(f.flightTime*240);i++){p.step(dt);peak=Math.max(peak,p.ball.position.y);}assert.ok(Math.abs(p.ball.position.x-distance)<.35,`${distance}: range ${p.ball.position.x}`);assert.ok(Math.abs(p.ball.position.z)<.25);assert.ok(Math.abs(p.ball.position.y-(lowCross?.55:1.25))<.2);assert.ok(p.ball.velocity.y<0);if(!lowCross&&distance>=25)assert.ok(peak>2.2);}});
test('cross selection from the wing prioritizes an onside penalty-area attacker',()=>{const m=scene('corner'),p=m.setPiece.taker;const target=chooseCross(m,p,null);assert.ok(target);assert.equal(target.player.role,'FWD');assert.ok(Math.abs(target.z)<15);});
test('free kicks form a four-player wall and retain lawful distances for both teams and halves',()=>{for(const team of [0,1])for(const half of [1,2]){const m=scene('free',team,half),s=m.setPiece,b=m.physics.ball.position;assert.equal(s.wall.length,4);for(const q of m.players.filter(q=>q.active&&q.team!==team))assert.ok(Math.hypot(q.x-b.x,q.z-b.z)>=9.15,q.name);for(const q of m.players.filter(q=>q.active&&q.team===team&&q!==s.taker))for(const id of s.wall)assert.ok(Math.hypot(q.x-m.players[id].x,q.z-m.players[id].z)>=1);}});
test('free kicks and penalties stay stationary while aimed and charged',()=>{for(const kind of ['free','penalty']){const m=scene(kind),before=m.physics.ball.position.clone();m.action('charge');advance(m,.5,{axis:{x:1,z:-1}});assert.equal(m.state,'playing');assert.deepEqual(m.physics.ball.position,before);assert.equal(m.physics.ball.velocity.length(),0);assert.ok(m.setPiece.aimZ>.5);assert.ok(m.setPiece.aimHeight>1.2);assert.equal(m.lastKickTime,-10);}});
test('penalty positions put the keeper on the line and everyone else outside the box and arc',()=>{for(const team of [0,1])for(const half of [1,2]){const m=scene('penalty',team,half),s=m.setPiece,b=m.physics.ball.position,d=m.direction(team),g=m.players.find(p=>p.team!==team&&p.role==='GK');assert.equal(b.x,41.5*d);assert.equal(g.x,52.5*d);for(const q of m.players.filter(q=>q.active&&q!==s.taker&&q!==g)){assert.ok(q.x*d<36);assert.ok(q.x*d<b.x*d);assert.ok(Math.hypot(q.x-b.x,q.z-b.z)>=9.15);}advance(m,.4);assert.equal(g.x,52.5*d);}});
test('a human set piece is not forced after the old eight-second timeout',()=>{const m=scene('free');advance(m,9);assert.ok(m.setPiece);assert.equal(m.stats.passes[0],0);});
test('penalty and free-kick shots release on contact and keep player aim instead of auto-picking a corner',()=>{for(const kind of ['free','penalty']){const m=scene(kind);m.setPiece.aimZ=-1.6;m.setPiece.aimHeight=1;const p=m.setPiece.taker;assert.ok(m.queueKick(p,'shoot',.6));assert.equal(p.action.target.z,-1.6);advance(m,.32);assert.equal(m.setPiece,null);assert.equal(m.lastTouch?.id,p.id);assert.equal(m.lastKickType,'shoot');assert.ok(m.physics.ball.velocity.length()>8);assert.ok(m.lastKickTime>0);}});
test('the keeper and opponents cannot kick or switch away from the taker before a restart',()=>{const m=scene('penalty'),p=m.controlled;const opponent=m.players.find(q=>q.team!==p.team);opponent.x=m.physics.ball.position.x;opponent.z=m.physics.ball.position.z;assert.equal(m.queueKick(opponent,'shoot'),false);m.action('switch');assert.equal(m.controlled,p);});
test('a curled free kick clears wall height on its way to the chosen goal position',()=>{const a={distance:25,power:.55,foot:'right',target:{y:1.15}},f=setpieceFlight('inside',{power:.9},a,{y:.11}),p=createPhysics();p.reset(0,0,.11);p.kick({x:Math.cos(f.aimOffset),z:Math.sin(f.aimOffset)},f.speed,f.lift,f.curve);let wallHeight;for(let i=0;i<Math.ceil(f.flightTime*240);i++){p.step(f.flightTime/Math.ceil(f.flightTime*240));if(wallHeight===undefined&&p.ball.position.x>=9.15)wallHeight=p.ball.position.y;}assert.ok(wallHeight>1.85,`wall height ${wallHeight}`);assert.ok(Math.abs(p.ball.position.y-1.15)<.2);assert.ok(Math.abs(p.ball.position.z)<.25);});
test('restart taker cannot play an untouched rebound twice',()=>{const m=scene('free'),p=m.setPiece.taker;m.setPiece=null;m.restartOrigin={kind:'free',team:p.team,player:p.id};assert.equal(secondTouch(m,p),true);assert.equal(m.restart.kind,'indirect');assert.equal(m.restart.team,1-p.team);});
test('penalties are allowed to be taken at the end of the half',()=>{const m=scene('penalty');m.elapsed=121;advance(m,.5);assert.equal(m.state,'playing');assert.ok(m.setPiece);});
test('both network seats keep independent penalty aiming and serialize the target',()=>{const m=new DuelMatch({halfSeconds:120,seed:1});m.start(false);m.state='playing';m.beginRestart({kind:'penalty',team:1,x:-41.5,z:0,label:'PK'});m.finishRestart();m.setInput(0,{axis:{x:1,z:1}});m.setInput(1,{axis:{x:-1,z:-1}});advance(m,.4);const snap=matchSnapshot(m);assert.ok(snap.setPiece.aimZ>.5);assert.ok(snap.setPiece.aimHeight>1.2);assert.equal(snap.controlled[1],m.setPiece.taker.id);});

test('corner kicks release toward the box from either end without a missed stationary contact',()=>{for(const team of [0,1])for(const half of [1,2]){const m=scene('corner',team,half),p=m.setPiece.taker;assert.ok(m.queueKick(p,'lob',.5));advance(m,.9);assert.equal(m.setPiece,null);assert.equal(m.lastKickType,'lob');assert.ok(m.physics.ball.position.y>1);assert.ok(m.physics.ball.position.z<31);assert.equal(m.offside.size,0);}});
test('a penalty played backwards awards an indirect free kick',()=>{const m=scene('penalty'),p=m.setPiece.taker;assert.ok(m.queueKick(p,'pass',.5,{x:-10,z:0}));advance(m,1);assert.equal(m.state,'restart');assert.equal(m.restart.kind,'indirect');assert.equal(m.restart.team,1);});
test('starting a new game clears a previous wall hold',()=>{const m=scene('free');for(const p of m.players)p.wallHoldUntil=50;m.start(false);assert.ok(m.players.every(p=>!p.wallHoldUntil));});

// Wing carry at sprint, then A with the stick toward the box: the planted kick must connect for both teams and halves.
function wingCarry(team,half){const m=new Match({...defaults,userTeam:team,seed:7});m.start(false);m.state='playing';m.half=half;const d=m.direction(team),p=m.controlled;
 for(const q of m.players)if(q!==p&&q.role!=='GK')q.active=false;
 p.x=d*30;p.z=-25;p.yaw=d*Math.PI/2;p.vx=d*7.5;m.owner=p;p.possessedAt=-1;m.physics.reset(p.x+d*.9,p.z,.11);m.physics.ball.velocity.set(d*7.5,0,0);
 advance(m,.3,{axis:{x:d,z:0},sprint:true,sprintAmount:1});return {m,p,d};}
test('a sprinting player kicking across the run plants and strikes the ball instead of missing it',()=>{for(const team of [0,1])for(const half of [1,2])for(const type of ['lob','pass','shoot'])for(const angle of [90,120]){
 const m=new Match({...defaults,userTeam:team,seed:5});m.start(true);m.state='playing';m.half=half;const d=m.direction(team),p=m.controlled;p.x=d*10;p.z=-20;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.54,p.z-.11);m.owner=p;m.lock=.3;
 advance(m,1,{axis:{x:d,z:0},sprint:true,sprintAmount:1});const a=angle*Math.PI/180,misses=[];m.emit=e=>{if(e==='miss')misses.push(e);};
 assert.ok(m.queueKick(p,type,.6,{x:Math.cos(a)*14*d,z:Math.sin(a)*14}));advance(m,1);assert.equal(misses.length,0,`${type} ${angle} team ${team} half ${half}`);assert.ok(m.lastKickTime>0);}});
test('a cross with nobody in the box is aimed into the penalty area, not along the touchline',()=>{for(const team of [0,1])for(const half of [1,2]){
 const {m,p,d}=wingCarry(team,half);const target=chooseCross(m,p,null);assert.ok(target);assert.equal(target.player,null);assert.ok(target.x*d>36&&Math.abs(target.z)<20,JSON.stringify(target));
 assert.equal(chooseCross(m,p,{x:-d,z:0}),null,'a stick pointing back asks for a lofted pass');}});
test('restarts place both teams in a set-piece shape instead of freezing them',()=>{for(const team of [0,1])for(const half of [1,2]){
 const shuffle=m=>{for(const q of m.players){q.x=(m.random()-.5)*100;q.z=(m.random()-.5)*60;}};
 const goal=new Match({...defaults,seed:3});goal.start(false);goal.state='playing';goal.half=half;let d=goal.direction(team);shuffle(goal);goal.beginRestart({kind:'goalkick',team,x:-d*47,z:5,label:'goal kick'});goal.finishRestart();
 assert.equal(goal.setPiece.taker.role,'GK');assert.equal(goal.players.filter(q=>q.active&&q.team!==team&&q.x*d<-35.5&&Math.abs(q.z)<20.5).length,0,'opponents leave the penalty area');
 const corner=new Match({...defaults,seed:3});corner.start(false);corner.state='playing';corner.half=half;d=corner.direction(team);shuffle(corner);corner.beginRestart({kind:'corner',team,x:d*52,z:33.5,label:'corner'});corner.finishRestart();
 const inBox=(t)=>corner.players.filter(q=>q.active&&q.team===t&&q.x*d>36&&Math.abs(q.z)<20.16).length;assert.ok(inBox(team)>=3);assert.ok(inBox(1-team)>=inBox(team));
 for(const a of corner.players)for(const c of corner.players)if(a.id<c.id)assert.ok(Math.hypot(a.x-c.x,a.z-c.z)>=.85,`${a.name} ${c.name}`);}});
test('the human keeps control of the keeper only while he has the ball',()=>{const m=new Match({...defaults,seed:5});m.start(false);m.state='playing';const gk=m.players[0];
 m.heldBy=gk;m.owner=gk;m.holdTime=5;m.updateAutoControl();assert.equal(m.controlled,gk);
 m.action('keeperKick');advance(m,.2);assert.notEqual(m.controlled.role,'GK');});
test('the AI skips a marked teammate and a blocked passing lane',()=>{const m=new Match({...defaults,seed:5});m.start(false);m.state='playing';for(const q of m.players)q.active=false;
 const p=m.players[6],marked=m.players[9],blocked=m.players[8],open=m.players[5],a=m.players[13],c=m.players[14];for(const q of [p,marked,blocked,open,a,c])q.active=true;
 Object.assign(p,{x:0,z:0});Object.assign(marked,{x:14,z:0});Object.assign(a,{x:14.8,z:.5});Object.assign(blocked,{x:10,z:-12});Object.assign(c,{x:5,z:-6});Object.assign(open,{x:-6,z:12});
 m.owner=p;m.physics.reset(.5,0);const option=bestPassOption(m,p,[a,c]);assert.ok(option);assert.equal(option.player,open);
 a.x=40;c.x=40;assert.notEqual(bestPassOption(m,p,[a,c]).player,open,'with the markers gone the forward pass is preferred');});
