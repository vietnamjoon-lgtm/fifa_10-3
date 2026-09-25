// Stick changes during a dribble: straight -> diagonal etc. Prints how fast the run and the ball follow.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const deg=r=>r*180/Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function turn({team=0,from=0,to=45,sprint=true,withBall=true,trace=false,keyLag=0}={}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=q.team===team?-45*d:45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 const dirOf=a=>({x:Math.cos(a*Math.PI/180)*d,z:Math.sin(a*Math.PI/180)});
 const A=dirOf(from),B=dirOf(to);p.x=-20*d-A.x*5;p.z=-A.z*5;p.vx=p.vz=0;p.yaw=Math.atan2(A.x,A.z);
 if(withBall)m.physics.reset(p.x+A.x*.5,p.z+A.z*.5);else{m.owner=null;m.physics.ball.position.set(0,30,0);}
 const touches=[],kick=m.physics.kick.bind(m.physics);m.physics.kick=(...a)=>{touches.push(+(m.time).toFixed(3));return kick(...a)};
 for(let i=0;i<2.5*120;i++)m.step(1/120,{axis:A,sprint});
 const t0=m.time,rows=[];let settle=null,minSpeed=99,owned=true,maxBehind=0,maxSide=0,faceSettle=null;
 const target=Math.atan2(B.x,B.z);
 for(let i=0;i<2.5*120;i++){
  // keyboard diagonal: the second key arrives keyLag seconds after the first
  const axis=keyLag&&m.time-t0<keyLag?{x:Math.sign(B.x)&&Math.abs(B.x)>Math.abs(B.z)-1e-6?Math.sign(B.x):0,z:0}:B;
  m.step(1/120,{axis,sprint});owned&&=(!withBall||m.owner===p);
  const t=m.time-t0,v=Math.hypot(p.vx,p.vz),head=deg(wrap(Math.atan2(p.vx,p.vz)-target)),face=deg(wrap(p.yaw-target));
  const b=m.physics.ball.position,ahead=(b.x-p.x)*B.x+(b.z-p.z)*B.z,side=(b.x-p.x)*B.z-(b.z-p.z)*B.x;
  if(settle===null&&Math.abs(head)<10&&v>3)settle=t;if(faceSettle===null&&Math.abs(face)<10)faceSettle=t;
  if(t<1.5){minSpeed=Math.min(minSpeed,v);maxBehind=Math.min(maxBehind,ahead);maxSide=Math.max(maxSide,Math.abs(side));}
  if(trace&&i%6===0)rows.push(`${t.toFixed(2)} v=${v.toFixed(2)} head=${head.toFixed(0)} face=${face.toFixed(0)} ball ahead=${ahead.toFixed(2)} side=${side.toFixed(2)} bv=${m.physics.ball.velocity.length().toFixed(2)}`);}
 return {settle,faceSettle,minSpeed,maxBehind,maxSide,owned,touches:touches.filter(t=>t>=t0&&t<t0+1.5).map(t=>+(t-t0).toFixed(2)),rows};
}
if(process.argv[1]?.endsWith('dribble-turns.mjs')){
 const f=(x,n=2)=>x==null?'  never':x.toFixed(n).padStart(6);
 console.log('from->to  sprint | settle ball/free | face settle | min speed | ball behind | side max | touches in 1.5 s | owned');
 for(const sprint of [true,false])for(const [a,b] of [[0,45],[0,-45],[0,90],[45,-45],[45,0],[0,135],[0,180],[90,45],[90,135],[45,135],[180,135]]){
  const r=turn({from:a,to:b,sprint}),g=turn({from:a,to:b,sprint,withBall:false});
  console.log(`${String(a).padStart(4)}->${String(b).padEnd(4)} ${sprint?'S':'J'} | ${f(r.settle)} /${f(g.settle)} | ${f(r.faceSettle)} /${f(g.faceSettle)} | ${f(r.minSpeed)} | ${f(r.maxBehind)} | ${f(r.maxSide)} | ${r.touches.join(' ')} | ${r.owned}`);}
}
