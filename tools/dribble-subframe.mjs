// Sub-frame check of sharp direction changes: between physics steps the renderer interpolates the player and ball
// (render-state.js) and poses the body for that exact time. This samples every 0.0001 of a 60 fps frame (1/600000 s,
// 5000 samples per 1/120 s step) and reports discontinuities and speeds of what is drawn.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {sampleMotion} from '../src/motion.js';
import {gaitTargets} from '../src/gait.js';
import {interpolatePlayer} from '../src/render-state.js';
import {captureRender} from '../src/render-state.js';
const deg=Math.PI/180,R=.11;
function drawn(p,ball,time){
 const pose=sampleMotion(p,p.motionPhase||0,time,ball);if(!pose.gaitTargets)return {pose,feet:null};
 const m=gaitTargets(p,p.motionPhase||0).metrics,len=m.upperLeg+m.lowerLeg-.002,s=Math.sin(p.yaw),c=Math.cos(p.yaw),hipY=pose.hipY+m.hipOffset;
 return {pose,feet:pose.gaitTargets.map((t,i)=>{const hx=(i?1:-1)*m.hipX;let dx=t.x-hx,dy=t.y-hipY,dz=t.z;const n=Math.hypot(dx,dy,dz);if(n>len){dx*=len/n;dy*=len/n;dz*=len/n;}
  const ax=hx+dx,ay=hipY+dy,az=dz;return {x:p.x+az*s+ax*c,y:ay,z:p.z+az*c-ax*s,ix:p.x+(az+.15)*s+ax*c,iz:p.z+(az+.15)*c-ax*s,planted:pose.contacts?.[i]>.5};})};
}
export function subframe({team=0,sprint=false,turn=90,window=1,samples=5000,pattern=null}={}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team),id=p.id;
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
 const axisAt=t=>{const a=(pattern?pattern.dirs[Math.floor(Math.max(0,t-2)/pattern.hold)%pattern.dirs.length]:t<2?0:turn)*deg;return {x:Math.cos(a)*d,z:Math.sin(a)};};
 for(let i=0;i<240;i++)m.step(1/120,{axis:axisAt(m.time),sprint});
 let before=captureRender(m),prev=null;
 const r={samples:0,footJump:0,footJumpAt:null,footSpeed:0,skate:0,bodyJump:0,yawRate:0,yawJump:0,ballJump:0,penetrate:0,behind:0};
 const steps=Math.round(window*120);
 for(let k=0;k<steps;k++){
  m.step(1/120,{axis:axisAt(m.time),sprint});const after=captureRender(m),dt=(after.time-before.time)/samples;
  const A=before.players[id],B=after.players[id];
  for(let j=0;j<samples;j++){const t=j/samples,q=interpolatePlayer({...A,sampleTime:0},{...B,sampleTime:after.time-before.time},t),time=before.time+(after.time-before.time)*t;
   const ball={x:before.ball[0]+(after.ball[0]-before.ball[0])*t,y:before.ball[1]+(after.ball[1]-before.ball[1])*t,z:before.ball[2]+(after.ball[2]-before.ball[2])*t};
   const {feet}=drawn(q,ball,time);r.samples++;
   const v=Math.hypot(q.vx,q.vz),h=v>.3?{x:q.vx/v,z:q.vz/v}:{x:Math.sin(q.yaw),z:Math.cos(q.yaw)};if((ball.x-q.x)*h.x+(ball.z-q.z)*h.z<.1)r.behind++;
   if(feet)for(const f of feet){const dist=Math.hypot(f.ix-ball.x,f.y+.03-ball.y,f.iz-ball.z);if(dist<R-.02)r.penetrate++;}
   if(prev){const bj=Math.hypot(q.x-prev.q.x,q.z-prev.q.z);r.bodyJump=Math.max(r.bodyJump,bj);
    const yj=Math.abs(Math.atan2(Math.sin(q.yaw-prev.q.yaw),Math.cos(q.yaw-prev.q.yaw)));r.yawJump=Math.max(r.yawJump,yj);r.yawRate=Math.max(r.yawRate,yj/dt/deg);
    r.ballJump=Math.max(r.ballJump,Math.hypot(ball.x-prev.ball.x,ball.y-prev.ball.y,ball.z-prev.ball.z));
    if(feet&&prev.feet)for(let i=0;i<2;i++){const a=prev.feet[i],b=feet[i],jump=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(jump>r.footJump){r.footJump=jump;r.footJumpAt={time:+time.toFixed(5),foot:i?'R':'L',state:q.dribblePose?JSON.stringify({foot:q.dribblePose.foot,reach:q.dribblePose.reach!==undefined?+(q.dribblePose.reach-time).toFixed(3):null,start:+(q.dribblePose.start-time).toFixed(3)}):'-'};}
     r.footSpeed=Math.max(r.footSpeed,jump/dt);if(a.planted&&b.planted)r.skate=Math.max(r.skate,Math.hypot(b.x-a.x,b.z-a.z)/dt);}}
   prev={q,ball,feet};}
  before=after;}
 return r;
}
if(process.argv[1]?.endsWith('dribble-subframe.mjs')){
 const samples=+(process.argv[2]||5000),rows=[];
 const cases=[...[45,90,135,180,-90].map(turn=>({name:`turn ${turn}`,turn})),{name:'rapid zigzag 0.25s',pattern:{hold:.25,dirs:[45,-45]}},{name:'rapid box 0.35s',pattern:{hold:.35,dirs:[0,90,0,-90]}}];
 console.log(`sub-samples per 1/120 s step: ${samples} (${(1/60/ (2*samples)*1e6).toFixed(2)} µs = ${(1/(2*samples)).toFixed(5)} frame)`);
 console.log('case (both teams)        | foot: max jump per sample / max speed | planted-foot skate | body jump / max yaw rate | ball jump | toe inside ball | ball behind | worst foot jump at');
 for(const sprint of [false,true])for(const c of cases){const rs=[0,1].map(team=>subframe({team,sprint,samples,...c}));const mx=k=>Math.max(...rs.map(r=>r[k]));const worst=rs.reduce((a,b)=>a.footJump>b.footJump?a:b);
  console.log(`${sprint?'S':'J'} ${c.name.padEnd(22)} | ${(mx('footJump')*1000).toFixed(3)} mm / ${mx('footSpeed').toFixed(1)} m/s | ${mx('skate').toFixed(2)} m/s | ${(mx('bodyJump')*1000).toFixed(3)} mm / ${mx('yawRate').toFixed(0)} °/s | ${(mx('ballJump')*1000).toFixed(3)} mm | ${rs.reduce((a,r)=>a+r.penetrate,0)} | ${(rs.reduce((a,r)=>a+r.behind/r.samples,0)/2*100).toFixed(0)}% | ${JSON.stringify(worst.footJumpAt)}`);}
}
