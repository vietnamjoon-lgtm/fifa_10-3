import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const input={axis:{x:0,z:0},sprint:false};
const advance=(m,seconds,i=input)=>{for(let n=0;n<seconds*120;n++)m.step(1/120,i)};
test('practice movement accelerates and decelerates',()=>{const m=new Match({...defaults});m.start(true);advance(m,1.5);const x=m.controlled.x;advance(m,1,{axis:{x:1,z:0}});assert.ok(m.controlled.x>x+3);const speed=Math.hypot(m.controlled.vx,m.controlled.vz);assert.ok(speed>4);// Releasing the stick: the player first reaches the rolling ball and stops it, then stands.
 advance(m,1.6);assert.ok(Math.hypot(m.controlled.vx,m.controlled.vz)<.1);assert.ok(m.physics.ball.velocity.length()<.1);});
test('shot waits for animation contact and ends its recovery',()=>{let kicks=0;const m=new Match({...defaults},t=>{if(t==='kick')kicks++});m.start(true);advance(m,1.5);m.action('charge');advance(m,.3);m.action('shoot');advance(m,.1);assert.equal(kicks,0);advance(m,.17);assert.equal(kicks,1);assert.ok(m.physics.ball.velocity.x>10);advance(m,.5);assert.equal(m.controlled.action,null);});
test('one goal is counted once and kickoff resumes',()=>{const m=new Match({...defaults});m.start(true);advance(m,1.5);m.owner=null;m.physics.reset(51,0,.6);m.physics.kick({x:1,z:0},25,0);advance(m,.15);assert.equal(m.score[0],1);advance(m,1);assert.equal(m.score[0],1);advance(m,12);assert.equal(m.state,'playing');});
test('touchline exit restarts as a throw-in',()=>{const m=new Match({...defaults});m.start(false);advance(m,1.5);m.owner=null;m.physics.reset(0,33.9,.4);m.physics.kick({x:0,z:1},14,0);advance(m,.1);assert.equal(m.state,'restart');assert.equal(m.restart.kind,'throw');advance(m,2);assert.equal(m.state,'playing');});
test('full match changes ends and finishes, then can restart',()=>{const m=new Match({...defaults,halfSeconds:3});m.start(false);m.autoplay=true;for(let i=0;i<7200&&m.state!=='fulltime';i++)m.step(1/120,input);assert.equal(m.half,2);assert.equal(m.direction(0),-1);assert.equal(m.state,'fulltime');m.start(false);assert.deepEqual(m.score,[0,0]);assert.equal(m.half,1);assert.equal(m.state,'kickoff');});
test('pause freezes the ball, clock and kick intent',()=>{const m=new Match({...defaults});m.start(true);advance(m,1.5);m.state='paused';const before=JSON.stringify(m.physics.ball.position),time=m.time;advance(m,2);assert.equal(JSON.stringify(m.physics.ball.position),before);assert.equal(m.time,time);});

function dribbleRun(team,plan){
 const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
 p.x=d*-20;p.z=0;p.target={x:p.x,z:0};m.physics.reset(p.x+Math.sin(p.yaw)*.54,-Math.sin(p.yaw)*.11);
 const touches=[],kick=m.physics.kick;m.physics.kick=(...a)=>{touches.push(m.time);return kick(...a)};
 let near=Infinity,far=0,owned=true;
 for(const [seconds,x,sprint] of plan)for(let i=0;i<seconds*120;i++){m.step(1/120,{axis:{x:x*d,z:0},sprint});const gap=Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z);if(m.time>1){near=Math.min(near,gap);far=Math.max(far,gap);}owned&&=m.owner===p;}
 return {m,p,touches:touches.filter(t=>t>1),near,far,owned};
}
test('sprint dribbling plays the ball ahead with repeated foot touches in both attack directions',()=>{
 for(const team of [0,1]){const r=dribbleRun(team,[[4,1,true]]);
  // A straight sprint is a knock and run (about 2 m ahead; a jog matches FC reference footage, 0.3-0.8 m), never losing the ball.
  assert.ok(r.owned);assert.ok(r.near>.3&&r.far<2.8,`ball must stay close ahead of the body: ${r.near}-${r.far}`);
  const every=(r.touches.at(-1)-r.touches[0])/(r.touches.length-1);assert.ok(every>.25&&every<2.8,`touch interval ${every}`);}
});
test('a straight sprint dribble knocks the ball well ahead and runs onto it',()=>{
 // Play asked for a knock and run at a sprint: the ball about three times as far ahead as at a jog, the player running onto it.
 for(const team of [0,1]){const gaps={};for(const sprint of [false,true]){const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
   p.x=d*-20;p.z=0;p.target={x:p.x,z:0};m.physics.reset(p.x+d*.54,0);const g=[];
   for(let i=0;i<5*120;i++){m.step(1/120,{axis:{x:d,z:0},sprint});if(m.time>1.5)g.push(Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z));}
   assert.equal(m.owner,p);g.sort((a,b)=>a-b);gaps[sprint]=g[g.length>>1];assert.ok(g.at(-1)<2.8,`ball ran ${g.at(-1)} m ahead`);}
  assert.ok(gaps.true>gaps.false*2,`sprint ${gaps.true} vs jog ${gaps.false}`);}
});
test('releasing the stick after a knock traps the ball instead of letting it run away',()=>{
 for(const team of [0,1]){const r=dribbleRun(team,[[2.5,1,true],[3,0,false]]);
  assert.ok(r.owned);assert.ok(r.m.physics.ball.velocity.length()<.2);assert.ok(Math.hypot(r.m.physics.ball.position.x-r.p.x,r.m.physics.ball.position.z-r.p.z)<1.1);}
});
test('dribbling follows a changing stick without holding the player back or losing the ball sideways',()=>{
 const run=(team,withBall)=>{const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled;if(!withBall){m.owner=null;m.physics.ball.position.set(0,30,0);}
  let angle=team?Math.PI:0,speed=0,n=0,lat=[],owned=true;
  for(let t=0;t<8*120;t++){if(t%72===0)angle+=[.9,-1.1,.6,-.8,1][(t/72)%5];if(Math.abs(p.x)>40||Math.abs(p.z)>25)angle=Math.atan2(-p.z,-p.x);const axis={x:Math.cos(angle),z:Math.sin(angle)};m.step(1/120,{axis,sprint:true});
   if(t>120){speed+=Math.hypot(p.vx,p.vz);n++;if(withBall){const b=m.physics.ball.position;lat.push(Math.abs((b.x-p.x)*axis.z-(b.z-p.z)*axis.x));owned&&=m.owner===p;}}}
  lat.sort((a,b)=>a-b);return {speed:speed/n,lat90:lat[Math.floor(lat.length*.9)],owned};};
 for(const team of [0,1]){const a=run(team,true),b=run(team,false);assert.ok(a.owned);assert.ok(a.speed>b.speed*.85,`${a.speed} vs ${b.speed}`);assert.ok(a.lat90<1.25,`sideways ${a.lat90}`);}
});
test('the keeper reads an angled shot where it crosses the keeper line and dives no further than that point',async()=>{
 const {keeperTarget}=await import('../src/ai.js');
 for(const team of [0,1]){const m=new Match({...defaults,userTeam:team,seed:4});m.start(false);m.state='playing';const g=m.players[(1-team)*11],d=m.direction(team);
  Object.assign(g,{x:d*48.7,z:-1.2,vx:0,vz:0,dive:0,cooldown:0,reflexes:1});m.lastTouchTeam=team;m.lastKickTime=0;m.time=1;
  m.physics.reset(d*42,-3.9,.7);m.physics.ball.velocity.set(d*20,0,9);keeperTarget(m,g);
  const expected=-3.9+9*(6.7/20);assert.ok(Math.abs(g.keeperRead.z-expected)<.25,`read ${g.keeperRead.z} vs ${expected}`);
  g.dive=.5;g.diveDirection=Math.sign(g.keeperRead.z-g.z);for(let i=0;i<60;i++)m.updatePlayer(g,1/120,{axis:{x:0,z:0}});
  assert.ok((g.z-g.keeperRead.z)*g.diveDirection<=1e-9,`dived past the read point: ${g.z}`);}
});
test('setting off with the ball behind or beside the player plays it round and runs at full pace',()=>{
 for(const team of [0,1])for(const angle of [Math.PI,Math.PI/2,-Math.PI/2]){
  const run=withBall=>{const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
   Object.assign(p,{x:-20*d,z:0,vx:0,vz:0,yaw:d*Math.PI/2});m.physics.reset(p.x+Math.cos(angle)*.5*d,Math.sin(angle)*.5);
   if(withBall){m.owner=p;m.lastTouch=p;}else{m.owner=null;m.physics.ball.position.set(0,30,0);}
   const x0=p.x;for(let i=0;i<120;i++)m.step(1/120,{axis:{x:d,z:0},sprint:true});return {run:(p.x-x0)*d,ahead:(m.physics.ball.position.x-p.x)*d,owned:m.owner===p};};
  const a=run(true),b=run(false);
  assert.ok(a.owned);assert.ok(a.run>b.run*.9,`ran ${a.run} of ${b.run}`);assert.ok(a.ahead>.6,`ball still behind: ${a.ahead}`);}
});
test('every dribble touch after a change of direction sends the ball along the stick, not the old run',()=>{
 // Jogging turns stay within 25 degrees of the stick; at a sprint the body's momentum is allowed to bend it more.
 for(const team of [0,1])for(const sprint of [false,true])for(const deg of [45,90,135,180]){
  const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  Object.assign(p,{x:-20*d,z:0});p.target={x:p.x,z:0};m.physics.reset(p.x+.54*d,-.11*d);
  for(let i=0;i<180;i++)m.step(1/120,{axis:{x:d,z:0},sprint});
  const a=deg*Math.PI/180,axis={x:Math.cos(a)*d,z:Math.sin(a)};let first=null;const kick=m.physics.kick;m.physics.kick=(v,s,...r)=>{if(first===null&&s>.05)first=v;return kick(v,s,...r)};
  // A sprint knocks the ball about 2 m ahead, so the player may first have to run onto it.
  for(let i=0;i<(sprint?360:120)&&!first;i++)m.step(1/120,{axis,sprint});
  assert.ok(first,`no touch after a ${deg} degree turn`);const off=Math.acos((first.x*axis.x+first.z*axis.z)/Math.hypot(first.x,first.z))*180/Math.PI;
  assert.ok(off<(sprint?40:25),`touch ${off.toFixed(1)} degrees off the stick after a ${deg} degree turn`);assert.equal(m.owner,p);}
});
test('jog speed follows the pace stat a little and a sprint is never slower than a jog',()=>{
 const run=(pace,sprint)=>{const m=new Match({...defaults,userTeam:0});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled;p.pace=pace;p.x=-30;p.z=0;p.target={x:p.x,z:0};m.owner=null;m.physics.reset(0,30,.11);advance(m,3,{axis:{x:1,z:0},sprint});return Math.hypot(p.vx,p.vz);};
 const slow=run(6,false),mid=run(8.3,false),fast=run(10,false);
 assert.ok(Math.abs(mid-5.8)<.05,`reference pace keeps the 5.8 m/s jog: ${mid}`);assert.ok(slow<mid-.2&&fast>mid+.2,`${slow} ${mid} ${fast}`);assert.ok(fast<6.3);
 assert.ok(run(5,true)>=run(5,false)-.01);
});
test('a shot pressed while a knocked ball runs ahead waits for the player to reach it and never misses',()=>{
 for(const team of [0,1])for(const kind of ['shoot','pass']){const ev={};const m=new Match({...defaults,userTeam:team},t=>{ev[t]=(ev[t]||0)+1});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  p.x=-30*d;p.z=0;p.target={x:p.x,z:0};m.physics.reset(p.x+.54*d,0);advance(m,2.5,{axis:{x:d,z:0},sprint:true});
  assert.ok(Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z)>1.2,'the ball is knocked ahead');
  m.input={axis:{x:d,z:0}};assert.equal(m.queueKick(p,kind,.6),true);advance(m,1.5,{axis:{x:d,z:0},sprint:true});
  assert.equal(ev.kick,1);assert.equal(ev.miss||0,0);}
});
test('from a standstill a sprint knocks the ball about 2 m ahead first, and a faster player knocks it further',()=>{
 const run=(team,pace)=>{const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);p.pace=pace;p.control=.8;
  p.x=-30*d;p.z=0;p.target={x:p.x,z:0};m.physics.reset(p.x+.54*d,0);advance(m,1,{axis:{x:0,z:0}});
  let first=0;const g=[];for(let i=0;i<5*120;i++){m.step(1/120,{axis:{x:d,z:0},sprint:true});const gap=Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z);if(i<90)first=Math.max(first,gap);else g.push(gap);}
  assert.equal(m.owner,p);g.sort((a,b)=>a-b);return {first,median:g[g.length>>1]};};
 for(const team of [0,1]){const slow=run(team,6.5),mid=run(team,8.3),fast=run(team,10);
  assert.ok(mid.first>1.8&&mid.first<2.4,`first knock ${mid.first}`);assert.ok(mid.median>1.4&&mid.median<2,`median ${mid.median}`);
  assert.ok(slow.median<mid.median-.2&&fast.median>mid.median+.1,`${slow.median} ${mid.median} ${fast.median}`);}
});
test('pressing sprint while walking or jogging knocks the very next touch about 2 m ahead',()=>{
 for(const team of [0,1])for(const mag of [.35,1]){const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);p.pace=8.3;p.control=.8;
  p.x=-35*d;p.z=0;p.target={x:p.x,z:0};p.yaw=d>0?Math.PI/2:-Math.PI/2;m.physics.reset(p.x+.54*d,0);advance(m,2,{axis:{x:d*mag,z:0}});
  let touched=null;const kick=m.physics.kick;m.physics.kick=(...a)=>{if(touched===null)touched=m.time;return kick(...a)};const t0=m.time;let peak=0;
  for(let i=0;i<1.5*120;i++){m.step(1/120,{axis:{x:d,z:0},sprint:true});peak=Math.max(peak,Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z));}
  assert.ok(touched!==null&&touched-t0<.4,`first touch ${touched-t0}s after pressing sprint`);assert.ok(peak>1.8&&peak<2.4,`knock ${peak} m`);assert.equal(m.owner,p);}
});
test('a human sprint knocks the ball past a nearby defender and winning the ball with sprint held knocks at once',()=>{
 for(const team of [0,1]){const m=new Match({...defaults,userTeam:team});m.start(false);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  const opp=m.players.find(q=>q.team!==p.team&&q.role!=='GK'&&q.active);Object.assign(opp,{x:-7.5*d,z:1.8,vx:0,vz:0});
  Object.assign(p,{x:-10*d,z:0,vx:0,vz:0,yaw:d>0?Math.PI/2:-Math.PI/2});p.target={x:p.x,z:0};m.owner=null;m.physics.reset(p.x+.54*d,0);
  // The player holds sprint before the ball becomes theirs, as when winning it in a duel.
  advance(m,.05,{axis:{x:d,z:0},sprint:true});m.owner=p;m.lastTouch=p;let peak=0;
  for(let i=0;i<120;i++){opp.target={x:opp.x,z:opp.z};m.step(1/120,{axis:{x:d,z:0},sprint:true});peak=Math.max(peak,Math.hypot(m.physics.ball.position.x-p.x,m.physics.ball.position.z-p.z));}
  assert.ok(peak>1.7,`knock beside a defender ${peak} m`);}
});
