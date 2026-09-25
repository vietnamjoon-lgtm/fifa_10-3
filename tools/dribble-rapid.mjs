// Rapid keyboard steering: how often the ball trails behind the body, how far it strays, and how long touches are.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const deg=Math.PI/180;
export const PATTERNS={
 'zigzag 45 / 0.25s':{hold:.25,dirs:[45,-45]},
 'right-diag-right / 0.3s':{hold:.3,dirs:[0,45,0,-45]},
 'box 90 / 0.35s':{hold:.35,dirs:[0,90,0,-90]},
 'wiggle 0/30 / 0.2s':{hold:.2,dirs:[0,30,0,-30]},
};
export function rapid({team=0,sprint=false,hold,dirs,seconds=6}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
 const touches=[],kick=m.physics.kick.bind(m.physics);m.physics.kick=(dir,speed,...r)=>{if(m.time>1)touches.push(m.time);return kick(dir,speed,...r)};
 let behind=0,n=0,dist=[],speed=0,owned=true;
 for(let i=0;i<seconds*120;i++){const a=dirs[Math.floor(i/(hold*120))%dirs.length]*deg,axis={x:Math.cos(a)*d,z:Math.sin(a)};m.step(1/120,{axis,sprint});owned&&=m.owner===p;
  if(m.time>1){const b=m.physics.ball.position,v=Math.hypot(p.vx,p.vz),h=v>.3?{x:p.vx/v,z:p.vz/v}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
   const ahead=(b.x-p.x)*h.x+(b.z-p.z)*h.z;if(ahead<.1)behind++;n++;dist.push(Math.hypot(b.x-p.x,b.z-p.z));speed+=v;}}
 dist.sort((a,b)=>a-b);const gaps=touches.slice(1).map((t,i)=>t-touches[i]);
 return {behind:behind/n,dist50:dist[Math.floor(dist.length/2)],dist90:dist[Math.floor(dist.length*.9)],speed:speed/n,touchEvery:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,owned};
}
if(process.argv[1]?.endsWith('dribble-rapid.mjs')){
 for(const sprint of [false,true])for(const [name,pat] of Object.entries(PATTERNS)){const r=[0,1].map(team=>rapid({team,sprint,...pat}));
  const avg=k=>(r.reduce((a,x)=>a+x[k],0)/r.length).toFixed(2);
  console.log(`${sprint?'S':'J'} ${name.padEnd(24)} ball behind body ${(avg('behind')*100).toFixed(0).padStart(3)}% | ball-body median ${avg('dist50')} p90 ${avg('dist90')} m | speed ${avg('speed')} | touch every ${avg('touchEvery')} s | owned ${r.every(x=>x.owned)}`);}
}
