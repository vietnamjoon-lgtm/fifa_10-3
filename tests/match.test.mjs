import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {gaitTargets} from '../src/gait.js';
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
  assert.ok(r.owned);assert.ok(r.near>.6,`ball must stay ahead of the body, not under it: ${r.near}`);assert.ok(r.far-r.near>.2&&r.far<2,`touches must open and close a small gap: ${r.near}-${r.far}`);
  const every=(r.touches.at(-1)-r.touches[0])/(r.touches.length-1);assert.ok(every>.45&&every<1.3,`touch interval ${every}`);}
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
 for(const team of [0,1]){const a=run(team,true),b=run(team,false);assert.ok(a.owned);assert.ok(a.speed>b.speed*.85,`${a.speed} vs ${b.speed}`);assert.ok(a.lat90<1,`sideways ${a.lat90}`);}
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
 for(const team of [0,1])for(const deg of [45,90,135,180]){
  const m=new Match({...defaults,userTeam:team});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  Object.assign(p,{x:-20*d,z:0});p.target={x:p.x,z:0};m.physics.reset(p.x+.54*d,-.11*d);
  for(let i=0;i<180;i++)m.step(1/120,{axis:{x:d,z:0},sprint:true});
  const a=deg*Math.PI/180,axis={x:Math.cos(a)*d,z:Math.sin(a)};let first=null;const kick=m.physics.kick;m.physics.kick=(v,s,...r)=>{if(first===null&&s>.05)first=v;return kick(v,s,...r)};
  // A sharp turn is a drag (the boot turns the ball over a few steps); its touch is the velocity the drag ends on.
  for(let i=0;i<120&&!first;i++){m.step(1/120,{axis,sprint:true});if(!first&&p.ballDrag)first=p.ballDrag.v1;}
  assert.ok(first,`no touch after a ${deg} degree turn`);const off=Math.acos((first.x*axis.x+first.z*axis.z)/Math.hypot(first.x,first.z))*180/Math.PI;
  assert.ok(off<20,`touch ${off.toFixed(1)} degrees off the stick after a ${deg} degree turn`);assert.equal(m.owner,p);}
});
test('a running dribble touch is played by the swinging foot that is on the ball, straight or diagonal',()=>{
 // Instep = the animated ankle target 0.1 m forward. Contact is the ball radius plus about 0.1 m.
 const instep=(p,f)=>{const s=Math.sin(p.yaw),c=Math.cos(p.yaw),z=f.z+.1;return {x:p.x+z*s+f.x*c,z:p.z+z*c-f.x*s};};
 for(const team of [0,1])for(const sprint of [false,true])for(const angle of [0,45,-45]){
  const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  const axis={x:Math.cos(angle*Math.PI/180)*d,z:Math.sin(angle*Math.PI/180)};p.x=-25*d;p.z=0;p.yaw=Math.atan2(axis.x,axis.z);m.physics.reset(p.x+axis.x*.5,p.z+axis.z*.5);
  const gaps=[],kick=m.physics.kick.bind(m.physics);
  m.physics.kick=(...a)=>{if(m.time>1.5){const b=m.physics.ball.position,g=gaitTargets(p,p.motionPhase);gaps.push(Math.min(...g.feet.map((f,i)=>g.contacts[i]?9:Math.hypot(b.x-instep(p,f).x,b.z-instep(p,f).z))));}return kick(...a)};
  for(let i=0;i<5*120;i++)m.step(1/120,{axis,sprint});
  assert.ok(m.owner===p&&gaps.length>=2,`touches ${gaps.length}`);
  assert.ok(Math.max(...gaps)<=.22,`team ${team} ${sprint?'sprint':'jog'} ${angle}: instep to ball at touches ${gaps.map(g=>g.toFixed(2))}`);
 }
});
test('switching between diagonals does not make the ball shoot away from the player',()=>{
 // Keyboard-style stick changes between the two diagonals. No touch may send the ball more than 3 m/s faster than the
 // run (main: up to 3.8 m/s, which reads as the ball popping away on every change of direction).
 for(const team of [0,1])for(const sprint of [false,true]){
  const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
  const excess=[],kick=m.physics.kick.bind(m.physics);m.physics.kick=(dir,speed,...r)=>{if(m.time>1.5)excess.push(speed-Math.hypot(p.vx,p.vz));return kick(dir,speed,...r)};
  for(let i=0;i<8*120;i++){const a=(Math.floor(i/84)%2?-45:45)*Math.PI/180;m.step(1/120,{axis:{x:Math.cos(a)*d,z:Math.sin(a)},sprint});}
  const hardest=Math.max(...excess);assert.equal(m.owner,p);assert.ok(hardest<3,`a touch went ${hardest.toFixed(2)} m/s faster than the run`);}
});
test('quick key taps keep the ball in front instead of dragging it under or behind the body',()=>{
 // Tapping between straight and a diagonal every 0.3 s, and wiggling 30 degrees every 0.2 s, at a jog and a sprint.
 for(const team of [0,1])for(const sprint of [false,true])for(const [hold,dirs] of [[.3,[0,45,0,-45]],[.2,[0,30,0,-30]]]){
  const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
  let behind=0,n=0;
  for(let i=0;i<6*120;i++){const a=dirs[Math.floor(i/(hold*120))%dirs.length]*Math.PI/180;m.step(1/120,{axis:{x:Math.cos(a)*d,z:Math.sin(a)},sprint});
   if(m.time>1){const b=m.physics.ball.position,v=Math.hypot(p.vx,p.vz);if(((b.x-p.x)*p.vx+(b.z-p.z)*p.vz)/(v||1)<.1)behind++;n++;}}
  assert.equal(m.owner,p);assert.ok(behind/n<.2,`ball behind the body ${(behind/n*100).toFixed(0)}% of the time (team ${team}, ${sprint?'sprint':'jog'}, ${hold}s taps)`);}
});
test('dribbling works the same after the match restarts and its clock goes back to zero',()=>{
 const m=new Match({...defaults,seed:3});
 // The first run ends with a sharp change of direction, so a reach for the ball is still pending when the match restarts.
 const run=(seconds,cutAtEnd=false)=>{m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;m.setPiece=null;const p=m.controlled;p.x=-10;p.z=0;p.yaw=Math.PI/2;p.vx=5;p.vz=0;p.cooldown=0;
  for(const q of m.players)if(q!==p){q.x=-45;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  m.physics.reset(p.x+.45,0);m.owner=p;m.lastTouch=p;let touches=0,behind=0;const kick=m.physics.kick;m.physics.kick=(...a)=>{touches++;return kick.apply(m.physics,a)};
  for(let i=0;i<seconds*120;i++){const cut=cutAtEnd&&i>seconds*120-8;m.step(1/120,{axis:cut?{x:-1,z:1}:{x:1,z:0},sprint:false});if(m.physics.ball.position.x<p.x)behind++;}
  m.physics.kick=kick;return {touches,behind,owned:m.owner===p,turned:Math.cos(p.yaw)<0||p.vx<0};};
 run(4,true);assert.ok(m.controlled.touchWindup,'a reach is pending at the restart');
 for(let k=0;k<2;k++){const r=run(2);assert.ok(r.owned&&r.touches>=2&&r.behind<20&&!r.turned,`restart ${k+1}: ${JSON.stringify(r)}`);}
});
test('a keyboard cut sends ball and body along the same new line (FC Online: ball and body share the line after a cut)',()=>{
 // Before: the touch sent the ball along the new line from 0.6 m ahead while the body curved slowly and ran parallel
 // 0.6-0.75 m beside it for half a second, then the ball dropped behind and was popped out at 7.7 m/s.
 for(const team of [0,1])for(const sprint of [false,true])for(const deg of [45,90,-90]){
  const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
  for(let i=0;i<300;i++)m.step(1/120,{axis:{x:d,z:0},sprint});
  const a=deg*Math.PI/180,B={x:Math.cos(a)*d,z:Math.sin(a)};let side=0,behind=0,turned=null,t0=m.time;
  for(let i=0;i<120;i++){m.step(1/120,{axis:B,sprint});const b=m.physics.ball.position,v=Math.hypot(p.vx,p.vz),h={x:p.vx/v,z:p.vz/v};
   if(turned===null&&(p.vx*B.x+p.vz*B.z)/v>Math.cos(10*Math.PI/180))turned=m.time-t0;
   if(turned!==null){side=Math.max(side,Math.abs((b.x-p.x)*h.z-(b.z-p.z)*h.x));if((b.x-p.x)*h.x+(b.z-p.z)*h.z<.1)behind++;}}
  assert.ok(turned!==null&&turned<.6,`team ${team} ${sprint?'sprint':'jog'} ${deg}: run on the new line after ${turned}`);
  assert.ok(side<.4,`team ${team} ${sprint?'sprint':'jog'} ${deg}: ball ${side.toFixed(2)} m off the run's line`);
  assert.equal(behind,0,`team ${team} ${sprint?'sprint':'jog'} ${deg}: ball behind the body`);assert.equal(m.owner,p);}
});
test('a turn back drags the ball round with the boot on it over a few steps, never in one step',()=>{
 // FC Online: the ball's velocity turns over 2-5 ticks of 1/60 s with the foot on it; before, it flipped within one 1/120 s step.
 for(const team of [0,1])for(const sprint of [false,true])for(const deg of [135,180,-135]){
  const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
  for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
  p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
  for(let i=0;i<300;i++)m.step(1/120,{axis:{x:d,z:0},sprint});
  const a=deg*Math.PI/180,B={x:Math.cos(a)*d,z:Math.sin(a)};let maxStep=0,dragged=false,prev=m.physics.ball.velocity.clone();
  for(let i=0;i<120;i++){m.step(1/120,{axis:B,sprint});dragged||=!!p.ballDrag&&!p.ballDrag.pending;const v=m.physics.ball.velocity;maxStep=Math.max(maxStep,Math.hypot(v.x-prev.x,v.z-prev.z));prev=v.clone();}
  assert.ok(dragged,`team ${team} ${sprint?'sprint':'jog'} ${deg}: no drag`);
  assert.ok(maxStep<3,`team ${team} ${sprint?'sprint':'jog'} ${deg}: ball velocity changed ${maxStep.toFixed(2)} m/s in one step`);assert.equal(m.owner,p);}
});
