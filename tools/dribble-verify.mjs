// Step-by-step dribble verification (every 1/120 s physics step, twice the 60 fps render rate).
// At every step the drawn foot is rebuilt from the same pose the renderer uses (sampleMotion's gait targets, which the
// foot-plant IK solves to, clamped to leg length), and checked against the ball.
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {sampleMotion} from '../src/motion.js';
import {gaitTargets} from '../src/gait.js';
const deg=Math.PI/180,R=.11;
function feet(p,ball,time){
 const pose=sampleMotion(p,p.motionPhase||0,time,ball);if(!pose.gaitTargets)return null;
 const m=gaitTargets(p,p.motionPhase||0).metrics,len=m.upperLeg+m.lowerLeg-.002,s=Math.sin(p.yaw),c=Math.cos(p.yaw),hipY=pose.hipY+m.hipOffset;
 return pose.gaitTargets.map((t,i)=>{const hx=(i?1:-1)*m.hipX;let dx=t.x-hx,dy=t.y-hipY,dz=t.z;const n=Math.hypot(dx,dy,dz);if(n>len){dx*=len/n;dy*=len/n;dz*=len/n;}
  const ax=hx+dx,ay=hipY+dy,az=dz+.1;return {x:p.x+az*s+ax*c,y:ay,z:p.z+az*c-ax*s,ankle:{x:p.x+(az-.1)*s+ax*c,z:p.z+(az-.1)*c-ax*s}};});
}
export const SCENARIOS={
 'straight':{hold:9,dirs:[0]},'diagonal':{hold:9,dirs:[45]},
 'cut 0/45 0.7s':{hold:.7,dirs:[0,45,0,-45]},'weave 45/-45 0.7s':{hold:.7,dirs:[45,-45]},'box 0/90 1s':{hold:1,dirs:[0,90]},
 'rapid zigzag 0.25s':{hold:.25,dirs:[45,-45]},'rapid right-diag 0.3s':{hold:.3,dirs:[0,45,0,-45]},'rapid box 0.35s':{hold:.35,dirs:[0,90,0,-90]},'rapid wiggle 0.2s':{hold:.2,dirs:[0,30,0,-30]},
};
export function verify({team=0,sprint=false,hold,dirs,seconds=6}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-30*d;p.z=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);
 let kicked=false;const kick=m.physics.kick.bind(m.physics);m.physics.kick=(...a)=>{kicked=true;return kick(...a)};
 const hist=[],touches=[];let steps=0,behind=0,unposed=0,jumps=0,owned=true;
 for(let i=0;i<seconds*120;i++){const a=dirs[Math.floor(i/(hold*120))%dirs.length]*deg;kicked=false;const v0=m.physics.ball.velocity.clone();
  m.step(1/120,{axis:{x:Math.cos(a)*d,z:Math.sin(a)},sprint});owned&&=m.owner===p;
  const b=m.physics.ball.position,ball={x:b.x,y:b.y,z:b.z},f=feet(p,ball,m.time),v=Math.hypot(p.vx,p.vz),h=v>.3?{x:p.vx/v,z:p.vz/v}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
  if(m.time<1)continue;steps++;if(!f)unposed++;
  if((b.x-p.x)*h.x+(b.z-p.z)*h.z<.1)behind++;
  // A drag (assists.js startDrag) moves the ball with the foot on it over a few steps; those steps are touched too.
  const dragging=!!p.ballDrag||p.wasDragging;p.wasDragging=!!p.ballDrag;
  if(!kicked&&!dragging&&m.physics.ball.velocity.distanceTo(v0)>1)jumps++;
  hist.push({f,ball,foot:p.dribblePose?.foot});
  if(kicked){const k=hist.length-1,i2=p.dribblePose?.foot==='left'?0:1,dist=j=>{const r=hist[j];if(!r?.f)return null;const q=r.f[i2];return Math.hypot(q.x-r.ball.x,q.y-r.ball.y,q.z-r.ball.z);};
   // Foot travel of the touching foot per step around the touch (a jump here is a visible snap).
   let snap=0;for(let j=k-3;j<k+2;j++){const A=hist[j]?.f?.[i2],B=hist[j+1]?.f?.[i2];if(A&&B)snap=Math.max(snap,Math.hypot(B.ankle.x-A.ankle.x,B.ankle.z-A.ankle.z));}
   touches.push({at:dist(k),before:dist(k-1),before2:dist(k-2),snap});}
 }
 return {touches,behind:behind/steps,unposed:unposed/steps,jumps,owned};
}
if(process.argv[1]?.endsWith('dribble-verify.mjs')){
 const med=a=>{const b=a.filter(x=>x!=null).sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:NaN},max=a=>Math.max(...a.filter(x=>x!=null));
 console.log('scenario (both teams)       | touches | contact at touch (instep<=0.21 m) | instep-ball median at -2/-1/0 steps | worst | foot snap max per 1/120 s | ball behind | untouched ball jumps | owned');
 for(const sprint of [false,true])for(const [name,sc] of Object.entries(SCENARIOS)){
  const rs=[0,1].map(team=>verify({team,sprint,...sc})),t=rs.flatMap(r=>r.touches),posed=t.filter(x=>x.at!=null);
  console.log(`${sprint?'S':'J'} ${name.padEnd(24)} | ${String(t.length).padStart(3)} | ${(posed.filter(x=>x.at<=.21).length/Math.max(1,posed.length)*100).toFixed(0).padStart(3)}% (${t.length-posed.length} unposed) | ${med(t.map(x=>x.before2)).toFixed(2)} / ${med(t.map(x=>x.before)).toFixed(2)} / ${med(t.map(x=>x.at)).toFixed(2)} | ${max(t.map(x=>x.at)).toFixed(2)} | ${(max(t.map(x=>x.snap))*100).toFixed(1)} cm | ${(rs.reduce((a,r)=>a+r.behind,0)/2*100).toFixed(0)}% | ${rs.reduce((a,r)=>a+r.jumps,0)} | ${rs.every(r=>r.owned)}`);}
}
