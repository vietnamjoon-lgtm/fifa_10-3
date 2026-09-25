// After each touch during stick changes: how fast the ball leaves relative to the player, how high it jumps,
// and how far it runs from the body in the next 0.6 s.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
export function cutPop({sprint=true,team=0,pattern=[0,45,0,-45],hold=.7,seconds=8}={}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
 const touches=[],kick=m.physics.kick.bind(m.physics);let open=null;
 m.physics.kick=(dir,speed,lift,...r)=>{const out=kick(dir,speed,lift,...r);if(m.time>1.5){const v=m.physics.ball.velocity;open={t:m.time,rel:Math.hypot(v.x-p.vx,v.z-p.vz),speed:Math.hypot(v.x,v.z),run:Math.hypot(p.vx,p.vz),lift,maxY:0,maxGap:0};touches.push(open);}return out;};
 for(let i=0;i<seconds*120;i++){const a=pattern[Math.floor(i/(hold*120))%pattern.length]*Math.PI/180;m.step(1/120,{axis:{x:Math.cos(a)*d,z:Math.sin(a)},sprint});
  if(open&&m.time-open.t<.6){const b=m.physics.ball.position;open.maxY=Math.max(open.maxY,b.y-.11);open.maxGap=Math.max(open.maxGap,Math.hypot(b.x-p.x,b.z-p.z));}}
 return touches;
}
if(process.argv[1]?.endsWith('dribble-cutpop.mjs')){
 const med=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]},max=a=>Math.max(...a);
 for(const sprint of [false,true])for(const [name,pattern] of [['straight',[0]],['0/45 cuts',[0,45,0,-45]],['45/-45 cuts',[45,-45]]]){
  const t=cutPop({sprint,pattern});
  console.log(`${sprint?'SPRINT':'JOG   '} ${name.padEnd(12)} touches ${String(t.length).padStart(2)} | ball faster than run by: median ${med(t.map(x=>x.rel)).toFixed(2)} max ${max(t.map(x=>x.rel)).toFixed(2)} m/s | ball speed max ${max(t.map(x=>x.speed)).toFixed(2)} | jump max ${(max(t.map(x=>x.maxY))*100).toFixed(1)} cm | gap in 0.6 s median ${med(t.map(x=>x.maxGap)).toFixed(2)} max ${max(t.map(x=>x.maxGap)).toFixed(2)} m`);}
}
