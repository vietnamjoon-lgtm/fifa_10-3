import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const input={axis:{x:0,z:0},sprint:false};
const advance=(m,seconds,i=input)=>{for(let n=0;n<seconds*120;n++)m.step(1/120,i)};
test('practice movement accelerates and decelerates',()=>{const m=new Match({...defaults});m.start(true);advance(m,1.5);const x=m.controlled.x;advance(m,1,{axis:{x:1,z:0}});assert.ok(m.controlled.x>x+3);const speed=Math.hypot(m.controlled.vx,m.controlled.vz);assert.ok(speed>4);advance(m,.5);assert.ok(Math.hypot(m.controlled.vx,m.controlled.vz)<.1);});
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
test('sprint dribbling knocks the ball ahead and runs onto it in both attack directions',()=>{
 for(const team of [0,1]){const r=dribbleRun(team,[[4,1,true]]);
  assert.ok(r.owned);assert.ok(r.far-r.near>.25,`gap ${r.near}-${r.far}`);assert.ok(r.far<1.25,`far ${r.far}`);
  assert.ok((r.touches.at(-1)-r.touches[0])/(r.touches.length-1)>.45,`touches ${r.touches}`);}
});
test('releasing the stick after a knock traps the ball instead of letting it run away',()=>{
 for(const team of [0,1]){const r=dribbleRun(team,[[2.5,1,true],[1.5,0,false]]);
  assert.ok(r.owned);assert.ok(r.m.physics.ball.velocity.length()<.2);assert.ok(Math.hypot(r.m.physics.ball.position.x-r.p.x,r.m.physics.ball.position.z-r.p.z)<1.1);}
});
