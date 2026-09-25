// Measures dribbling per stick direction: speed with/without ball, ball offset from the body
// (ahead / sideways), touch interval, heading error and body facing error.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const deg=r=>r*180/Math.PI;
export function probe({team=0,angle=0,sprint=true,seconds=4,withBall=true,seed=3}={}){
 const m=new Match({...defaults,userTeam:team,seed});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=q.team===team?-40*d:40*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-15*d;p.z=0;p.vx=p.vz=0;p.target={x:p.x,z:0};
 // world stick: angle measured from the attacking direction, positive toward +z
 const ax=Math.cos(angle)*d,az=Math.sin(angle);p.yaw=Math.atan2(ax,az);
 if(withBall)m.physics.reset(p.x+ax*.5,p.z+az*.5);else{m.owner=null;m.physics.ball.position.set(0,30,0);}
 const touches=[],kick=m.physics.kick.bind(m.physics);m.physics.kick=(...a)=>{touches.push(m.time);return kick(...a)};
 const s={speed:[],ahead:[],side:[],head:[],face:[]};let owned=true;const t0=m.time;
 for(let i=0;i<seconds*120;i++){m.step(1/120,{axis:{x:ax,z:az},sprint});owned&&=(!withBall||m.owner===p);
  if(m.time-t0<1.2)continue;const v=Math.hypot(p.vx,p.vz);s.speed.push(v);
  s.head.push(Math.abs(deg(Math.atan2(p.vx*az-p.vz*ax,p.vx*ax+p.vz*az))));
  const fx=Math.sin(p.yaw),fz=Math.cos(p.yaw);s.face.push(Math.abs(deg(Math.atan2(fx*az-fz*ax,fx*ax+fz*az))));
  if(withBall){const b=m.physics.ball.position;s.ahead.push((b.x-p.x)*ax+(b.z-p.z)*az);s.side.push((b.x-p.x)*az-(b.z-p.z)*ax);}}
 const avg=a=>a.reduce((x,y)=>x+y,0)/(a.length||1),q=(a,f)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(f*(b.length-1))]};
 const tt=touches.filter(t=>t-t0>=1.2);
 return {speed:avg(s.speed),head:avg(s.head),face:avg(s.face),face90:q(s.face,.9),aheadMin:q(s.ahead,0),aheadMax:q(s.ahead,1),sideAbs90:q(s.side.map(Math.abs),.9),sideMean:avg(s.side),touchEvery:tt.length>1?(tt.at(-1)-tt[0])/(tt.length-1):null,touches:tt.length,owned,end:{x:p.x,z:p.z}};
}
if(process.argv[1]?.endsWith('dribble-probe.mjs')){
 const f=(x,n=2)=>x==null?'  -  ':x.toFixed(n).padStart(6);
 for(const sprint of [false,true]){console.log(`\n== ${sprint?'SPRINT':'JOG'} ==  angle | team | speed ball/free | head° | face° face90° | ahead min..max | side|90| mean | touch every (n) | owned`);
  for(const team of [0,1])for(const a of [0,45,90,135,180,-45,-90,-135]){const r=probe({team,angle:a*Math.PI/180,sprint}),free=probe({team,angle:a*Math.PI/180,sprint,withBall:false});
   console.log(`${String(a).padStart(5)} | ${team} | ${f(r.speed)} /${f(free.speed)} | ${f(r.head,1)} | ${f(r.face,1)} ${f(r.face90,1)} | ${f(r.aheadMin)}..${f(r.aheadMax)} | ${f(r.sideAbs90)} ${f(r.sideMean)} | ${f(r.touchEvery)} (${r.touches}) | ${r.owned}`);}}
}
