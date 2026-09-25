import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {cleanGameplay,gameplayDefaults} from '../src/gameplay-settings.js';
import {createPhysics} from '../src/physics.js';
import {resolvePlayerContacts} from '../src/player-contact.js';
import {bodyContactMass} from '../src/body-shape.js';
import {resolveBodyContacts} from '../src/contacts.js';
import {resolveTackle,foul} from '../src/referee.js';
import {boundaryRestart} from '../src/rules.js';
import {cushionFirstTouch,dribbleSteer} from '../src/assists.js';
import {updateTeamAI} from '../src/ai.js';
import {gaitTargets} from '../src/gait.js';
import {locomotionCadence,stanceFraction} from '../src/motion-planner.js';
import {Room} from '../server/room.js';

const idle={axis:{x:0,z:0}},dt=1/120;

test('walking-speed glancing tackles continue without a foul or fall in either direction',()=>{
 for(const dir of [-1,1])for(const type of ['tackle','slide']){
  const {m,a,b}=setup();a.yaw=dir*Math.PI/2;b.x=dir*.65;b.z=type==='slide'?.30:.25;a.vx=dir;
  m.physics.reset(dir*2,0);resolveTackle(m,a,{type});
  assert.equal(m.stats.fouls[0],0);assert.equal(m.state,'playing');assert.equal(b.down,0);
 }
});
test('a clean sliding challenge can knock down a moving opponent without being a foul',()=>{
 for(const dir of [-1,1]){
  const {m,a,b}=setup();a.yaw=dir*Math.PI/2;a.vx=dir*4;b.x=dir*1.05;m.owner=b;b.action={type:'shoot',elapsed:0};
  m.physics.reset(dir*.4,0);resolveTackle(m,a,{type:'slide'});
  assert.equal(m.lastTouch,a);assert.equal(m.stats.fouls[0],0);assert.ok(b.down>.5);assert.equal(b.action,null);assert.equal(m.owner,null);
 }
});
test('light ball-first tackles and minor standing fouls do not automatically knock players down',()=>{
 const clean=setup();clean.b.x=1.05;clean.m.physics.reset(.4,0);resolveTackle(clean.m,clean.a,{type:'tackle'});
 assert.equal(clean.m.lastTouch,clean.a);assert.equal(clean.b.down,0);
 const foulCase=setup();foulCase.b.x=.55;foulCase.m.physics.reset(1.05,0);resolveTackle(foulCase.m,foulCase.a,{type:'tackle'});
 assert.equal(foulCase.m.stats.fouls[0],1);assert.equal(foulCase.b.down,0);
});
test('a late central slide trips the opponent and still awards the foul',()=>{
 const {m,a,b}=setup();b.x=.55;m.owner=b;m.physics.reset(1.05,0);resolveTackle(m,a,{type:'slide'});
 assert.equal(m.stats.fouls[0],1);assert.ok(b.down>.5);assert.equal(m.state,'restart');
});
test('defensive AI closes medium gaps and takes safe tackles without charging through the owner',()=>{
 const far=setup();far.m.autoplay=true;far.m.owner=far.b;far.b.x=6;far.m.physics.reset(5.7,0);updateTeamAI(far.m);assert.equal(far.a.aiState,'PRESS');assert.ok(far.a.sprinting);
 const safe=setup();safe.m.autoplay=true;safe.m.owner=safe.b;safe.b.x=1.3;safe.m.physics.reset(.75,0);updateTeamAI(safe.m);assert.equal(safe.a.action?.type,'tackle');
 const blocked=setup();blocked.m.autoplay=true;blocked.m.owner=blocked.b;blocked.b.x=.4;blocked.m.physics.reset(.85,0);updateTeamAI(blocked.m);assert.equal(blocked.a.action,null);
});
test('dribble steering blends continuously across the former 45 degree switch',()=>{
 const steer=angle=>{const {m,a}=setup();a.vx=4;m.owner=a;m.physics.reset(1.8,0);m.physics.ball.velocity.set(4,0,0);return dribbleSteer(m,a,{x:Math.cos(angle),z:Math.sin(angle)});};
 const before=steer(Math.PI/4-.001),after=steer(Math.PI/4+.001);
 assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<.005);
});
function setup(gameplay={}){const m=new Match({...defaults,gameplay,seed:78});m.start(false);m.state='playing';m.lock=0;m.aiClock=1e6;for(const p of m.players)Object.assign(p,{active:false,x:20,z:20,vx:0,vz:0,down:0,cooldown:0,touchCooldown:0,action:null,target:{x:20,z:20}});const a=m.players[9],b=m.players[20];Object.assign(a,{active:true,x:0,z:0,yaw:Math.PI/2,target:{x:0,z:0}});Object.assign(b,{active:true,x:2,z:0,yaw:-Math.PI/2,target:{x:2,z:0}});m.controlled=a;m.owner=null;m.physics.reset(10,10);m.lastKickTime=-10;return {m,a,b};}
test('gameplay settings migrate safely and reject invalid or unbounded values',()=>{assert.deepEqual(cleanGameplay(null),gameplayDefaults);const c=cleanGameplay({acceleration:NaN,braking:999,ballRoll:-5,firstTouch:'120',referee:'none',admin:true});assert.equal(c.acceleration,100);assert.equal(c.braking,120);assert.equal(c.ballRoll,80);assert.equal(c.firstTouch,100);assert.equal(c.referee,'standard');assert.equal(c.admin,undefined);});
test('movement settings change acceleration, stopping distance and turn response independently',()=>{const run=(key,value)=>{const {m,a}=setup({[key]:value});a.vx=key==='acceleration'?0:6;for(let i=0;i<24;i++)m.move(a,key==='braking'?idle.axis:key==='turnResponse'?{x:-1,z:0}:{x:1,z:0},false,false,dt);return {x:a.x,yaw:a.yaw,speed:Math.hypot(a.vx,a.vz)};};assert.ok(run('acceleration',120).speed>run('acceleration',80).speed);assert.ok(run('braking',120).x<run('braking',80).x);assert.ok(Math.abs(run('turnResponse',120).yaw-Math.PI/2)>Math.abs(run('turnResponse',80).yaw-Math.PI/2));});
test('rolling and bounce settings change physical ball travel without adding energy',()=>{const roll=value=>{const p=createPhysics({ballRoll:value});p.kick({x:1,z:0},10,0);for(let i=0;i<240;i++)p.step(dt);return p.ball.position.x;};assert.ok(roll(120)>roll(80));const bounce=value=>{const p=createPhysics({ballBounce:value});p.reset(0,0,.12);p.ball.velocity.y=-8;let peak=0;for(let i=0;i<150;i++){p.step(dt);peak=Math.max(peak,p.ball.position.y);}return peak;};assert.ok(bounce(120)>bounce(80));assert.ok(bounce(120)<3.4);});
test('first touch stability changes cushioning without moving the ball or editing player ratings',()=>{const run=value=>{const {m,a}=setup({firstTouch:value});m.physics.reset(.6,0);m.physics.ball.velocity.x=-12;const pos=m.physics.ball.position.clone(),rating=a.control;cushionFirstTouch(m,a);assert.deepEqual(m.physics.ball.position,pos);assert.equal(a.control,rating);return m.physics.ball.velocity.length();};assert.ok(run(120)<run(80));});
test('online room fixes the host gameplay for both seats and rejects guest overrides',()=>{let id=0;const room=new Room({code:'TESTAAAA',random:()=>String(++id),gameplay:{braking:112,referee:'strict'}}),host=room.reserve('A',true),guest=room.reserve('B'),messages=[];room.connect(host.token,m=>messages.push(m));room.connect(guest.token,m=>messages.push(m));room.message(0,{type:'ready',ready:true});room.message(1,{type:'ready',ready:true});room.message(0,{type:'start'});room.message(1,{type:'input',seq:1,input:idle,gameplay:{braking:80},assistance:{braking:80}});assert.equal(room.match.gameplay.braking,112);assert.ok(messages.filter(m=>['start','welcome'].includes(m.type)).every(m=>m.gameplay.referee==='strict'));});
test('body collision removes closing velocity while preserving momentum and sideways movement',()=>{const {m,a,b}=setup();a.x=0;b.x=.45;Object.assign(a,{vx:3,vz:2});Object.assign(b,{vx:-3,vz:-1});const ma=bodyContactMass(a),mb=bodyContactMass(b),momentum=ma*a.vx+mb*b.vx,energy=ma*(a.vx*a.vx+a.vz*a.vz)+mb*(b.vx*b.vx+b.vz*b.vz);resolvePlayerContacts(m,dt);assert.ok(Math.abs(ma*a.vx+mb*b.vx-momentum)<1e-9);assert.ok(ma*(a.vx*a.vx+a.vz*a.vz)+mb*(b.vx*b.vx+b.vz*b.vz)<=energy);assert.equal(a.vz,2);assert.equal(b.vz,-1);assert.ok(a.vx-b.vx<1e-9);});
test('exactly overlapping players separate deterministically without invalid coordinates',()=>{const {m,a,b}=setup();a.x=b.x=0;resolvePlayerContacts(m,dt);assert.ok(b.x>a.x);assert.ok([a.x,a.z,b.x,b.z].every(Number.isFinite));});
test('strong rear charge is a foul while a comparable side shoulder challenge can continue',()=>{const rear=setup();rear.m.owner=rear.b;rear.b.x=.48;rear.b.yaw=Math.PI/2;rear.a.vx=6;rear.m.physics.reset(1,0);resolvePlayerContacts(rear.m,dt);assert.equal(rear.m.restart.kind,'free');assert.equal(rear.m.lastDecision.reason,'뒤에서 충돌');const side=setup();side.m.owner=side.b;side.b.x=0;side.b.z=.48;side.b.yaw=Math.PI/2;side.a.vz=6;side.m.physics.reset(.5,.48);resolvePlayerContacts(side.m,dt);assert.equal(side.m.state,'playing');});
test('ball hits the first swept body regardless of player list order',()=>{for(const reverse of [false,true]){const {m,a,b}=setup();a.x=.5;b.x=-.5;a.z=b.z=0;if(reverse)m.players.reverse();m.physics.reset(1,0,1);m.physics.ball.velocity.x=40;resolveBodyContacts(m,{x:-1.5,y:1,z:0});assert.equal(m.lastTouch.id,b.id);assert.ok(m.physics.ball.velocity.x<0);}});
test('a ball passing exactly through a body centre cannot skip the collision',()=>{const {m,a,b}=setup();b.active=false;m.physics.reset(.5,0,1);m.physics.ball.velocity.x=40;resolveBodyContacts(m,{x:-.5,y:1,z:0});assert.equal(m.lastTouch,a);assert.ok(m.physics.ball.position.x<0);});
test('nearby body outside the tackle path does not turn a clean ball tackle into a foul',()=>{const {m,a,b}=setup();b.x=.35;b.z=.5;m.physics.reset(.72,0);resolveTackle(m,a,{type:'tackle'});assert.equal(m.state,'playing');assert.equal(m.lastTouch,a);assert.equal(m.stats.fouls[0],0);});
test('a tackle through the opponent to reach the ball is penalized',()=>{const {m,a,b}=setup();b.x=.55;m.owner=b;m.physics.reset(1.05,0);resolveTackle(m,a,{type:'tackle'});assert.equal(m.restart.kind,'free');assert.equal(m.lastDecision.reason,'공보다 몸에 먼저 접촉');});
test('dangerous sliding remains a red-card foul even if the ball is contacted first',()=>{const {m,a,b}=setup();b.x=1.05;a.vx=10;m.physics.reset(.4,0);resolveTackle(m,a,{type:'slide'});assert.ok(a.sentOff);assert.equal(m.stats.reds[0],1);assert.equal(m.state,'restart');});
test('a low-speed careless slide foul does not automatically give a yellow card',()=>{const {m,a,b}=setup();foul(m,a,b,{slide:true,relativeSpeed:2});assert.equal(m.state,'restart');assert.equal(a.yellows,0);});
test('last defender near goal is not sent off for DOGSO without ball control or forward progress',()=>{const {m,a,b}=setup();a.x=-40;b.x=-40.5;b.yaw=Math.PI/2;m.physics.reset(0,15);foul(m,a,b,{relativeSpeed:2,ballAttempt:false});assert.equal(m.lastDecision.dogso,false);assert.equal(a.sentOff,false);});
test('a genuine goal opportunity foul is yellow inside the box when challenging for the ball',()=>{const {m,a,b}=setup();a.x=-40;b.x=-40.5;b.yaw=-Math.PI/2;m.owner=b;m.physics.reset(-41,0);foul(m,a,b,{relativeSpeed:3,ballAttempt:true});assert.ok(m.lastDecision.dogso);assert.equal(m.restart.kind,'penalty');assert.equal(a.yellows,1);assert.equal(a.sentOff,false);});
test('airborne offside reception is penalized before a chest control can clear the flag',()=>{const {m,a,b}=setup();b.active=false;m.offside.add(a.id);m.physics.reset(.4,0,1.35);m.physics.ball.velocity.set(-3,-1,0);m.updatePossession(dt);assert.equal(m.restart.kind,'indirect');assert.equal(m.lastTouch,null);});
test('deliberate legal chest control clears the previous opponents offside snapshot',()=>{const {m,a,b}=setup();b.active=false;m.offside.add(b.id);m.physics.reset(.4,0,1.35);m.physics.ball.velocity.set(-3,-1,0);m.updatePossession(dt);assert.equal(m.lastTouch,a);assert.equal(m.offside.size,0);});
test('corner exit uses the first boundary crossed instead of always preferring the touchline',()=>{const {m}=setup();m.physics.reset(53,35);m.lastTouchTeam=1;assert.equal(boundaryRestart(m,{x:52.6,y:.3,z:33}).kind,'corner');assert.equal(boundaryRestart(m,{x:50,y:.3,z:34.05}).kind,'throw');});
test('unrealized advantage is recalled when the ball leaves play immediately',()=>{const {m,a,b}=setup();m.advantage={restart:{kind:'free',team:0,x:4,z:2,label:'프리킥'},expires:m.time+2};a.active=b.active=false;m.physics.reset(0,34.05,.3);m.physics.ball.velocity.z=12;m.step(dt,idle);assert.equal(m.restart.kind,'free');assert.equal(m.restart.x,4);});
test('gait stance moves the foot backwards at the players actual world speed',()=>{for(const height of [1.6,1.81,2.05])for(const speed of [1,3,8]){const p={height,vx:0,vz:speed,yaw:0},phase=stanceFraction(speed)*2*Math.PI*.2,g=gaitTargets(p,phase),h=1e-4,next=gaitTargets(p,phase+locomotionCadence(speed,undefined,p)*h),worldTravel=(next.feet[0].z-g.feet[0].z)*g.metrics.scale+speed*h;assert.ok(Math.abs(worldTravel)<.0001,`${height}/${speed}: ${worldTravel}`);}});
test('running has a flight phase and shorter legs increase the required stride cadence',()=>{let flight=false;for(let phase=0;phase<6.28;phase+=.05)if(gaitTargets({height:1.81,vx:0,vz:8},phase).contacts.every(c=>c===0))flight=true;assert.ok(flight);assert.ok(locomotionCadence(8,undefined,{height:1.6,body:{legLength:92}})>locomotionCadence(8,undefined,{height:2.05,body:{legLength:108}}));});
