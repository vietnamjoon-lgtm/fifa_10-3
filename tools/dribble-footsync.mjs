// At every dribble touch: how far is the ball centre from the instep of the animated foot (gait ankle target + 0.1 m
// forward), and is that foot swinging? Real contact is about 0.2 m or less (ball radius 0.11 m + boot).
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {gaitTargets} from '../src/gait.js';
export function footSync({team=0,angle=0,sprint=true,seconds=6,plan=null}={}){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
 const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=q.team===team?-45*d:45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 const dirOf=a=>({x:Math.cos(a*Math.PI/180)*d,z:Math.sin(a*Math.PI/180)});let A=dirOf(angle);
 p.x=-25*d;p.z=0;p.vx=p.vz=0;p.yaw=Math.atan2(A.x,A.z);m.physics.reset(p.x+A.x*.5,p.z+A.z*.5);
 const rows=[],kick=m.physics.kick.bind(m.physics);
 m.physics.kick=(...a)=>{if(m.time>1.5&&!p.action){const g=gaitTargets(p,p.motionPhase||0),b=m.physics.ball.position,s=Math.sin(p.yaw),c=Math.cos(p.yaw);
   const feet=g.feet.map((f,i)=>{const z=f.z+.1,wx=p.x+z*s+f.x*c,wz=p.z+z*c-f.x*s;return {d:Math.hypot(b.x-wx,b.z-wz),planted:g.contacts[i],fwd:f.z}});
   const ahead=(b.x-p.x)*s+(b.z-p.z)*c;const kind=p.turnPlan?'turn':Math.abs(Math.atan2(p.vx*A.z-p.vz*A.x,p.vx*A.x+p.vz*A.z))>Math.PI/7?'cut':'run';rows.push({kind,t:+m.time.toFixed(2),ahead:+ahead.toFixed(2),footL:+feet[0].d.toFixed(2),footR:+feet[1].d.toFixed(2),near:Math.min(feet[0].d,feet[1].d),nearFwd:+(feet[0].d<feet[1].d?feet[0].fwd:feet[1].fwd).toFixed(2),nearPlanted:feet[0].d<feet[1].d?feet[0].planted:feet[1].planted});}
  return kick(...a)};
 for(let i=0;i<seconds*120;i++){if(plan)A=dirOf(plan(m.time));m.step(1/120,{axis:A,sprint});}
 return rows;
}
if(process.argv[1]?.endsWith('dribble-footsync.mjs')){
 const cases=[['straight 0',{angle:0}],['diagonal 45',{angle:45}],['diagonal -45',{angle:-45}],['side 90',{angle:90}],['team1 diagonal',{team:1,angle:45}],['zigzag +-45 / 0.8s',{plan:t=>Math.floor(t/.8)%2?45:-45}],['zigzag 0/45 / 0.6s',{plan:t=>Math.floor(t/.6)%2?45:0}],['weave 0/90 / 1s',{plan:t=>Math.floor(t)%2?90:0}]];
 for(const sprint of [false,true]){console.log(`\n== ${sprint?'SPRINT':'JOG'} ==   touches | instep-ball median p90 | within 0.21 m | planted`);
  for(const [name,o] of cases){const r=footSync({...o,sprint}),near=r.map(x=>x.near).sort((a,b)=>a-b),q=f=>near.length?near[Math.floor(f*(near.length-1))].toFixed(2):'-';
   console.log(`${name.padEnd(22)} ${String(r.length).padStart(3)} | ${q(.5)} ${q(.9)} | ${r.filter(x=>x.near<=.21).length}/${r.length} | ${r.filter(x=>x.nearPlanted).length}`);}}
}
