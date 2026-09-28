// Shot lab: strikes the same shot many times from one spot in a headless match (keeper moved out of the way)
// and reports launch speed, bend, apex, time to the line and how often it is on target, per shot style.
// Usage: node tools/shot-lab.mjs [--x 24] [--z -8] [--trials 60] [--foot right|left] [--power .9] [--aimz 0|1|-1]
import {register} from 'node:module';
register('./three-loader.mjs',import.meta.url);
const {Match}=await import('../src/match.js');
const {defaults}=await import('../src/settings.js');
const {FIELD}=await import('../src/config.js');
const args=process.argv.slice(2),arg=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1];};
const X=Number(arg('x',24)),Z=Number(arg('z',-8)),TRIALS=Number(arg('trials',60)),FOOT=arg('foot','right'),POWER=Number(arg('power',.9)),AIMZ=Number(arg('aimz',0));
export const STYLES={'D (일반)':{},'ZD (감아차기)':{curve:true},'DZ (늦은 Z)':{curve:true,curveLate:true},'FD (파워슛)':{powerShot:true}};
export function strike(options,{x=X,z=Z,foot=FOOT,power=POWER,seed=1,axis={x:1,z:AIMZ}}={}){
 const m=new Match({...defaults,halfSeconds:600,seed},()=>{});m.start(false);m.state='playing';m.setPiece=null;m.restartOrigin=null;
 const p=m.controlled,d=m.direction(p.team);p.foot=foot;p.x=d*x;p.z=z;p.vx=p.vz=0;p.yaw=d*Math.PI/2;
 for(const q of m.players){if(q===p)continue;q.active=q.team===p.team&&q.role!=='GK'?q.active:false;}
 // Ball on the kicking foot's side (facing +x the shooter's right is +z) so that foot is chosen.
 m.physics.reset(p.x+d*.5,p.z+(foot==='right'?1:-1)*.14*d);m.owner=p;m.lock=0;m.input={axis:{x:axis.x*d,z:axis.z}};
 if(!m.queueKick(p,'shoot',power,null,null,options))return null;
 const b=m.physics.ball;let kickFoot=null,launch=null,apex=0,t0=null,start=null,maxBend=0,crossing=null,windup=null;
 for(let i=0;i<1200;i++){m.step(1/120,{axis:m.input.axis});
  if(!launch&&b.velocity.length()>8){launch=b.velocity.length();t0=m.time;start={x:b.position.x,z:b.position.z,vx:b.velocity.x,vz:b.velocity.z};windup=p.action?.contactAt;kickFoot=p.action?.foot;}
  if(launch){apex=Math.max(apex,b.position.y);const n=Math.hypot(start.vx,start.vz),along=((b.position.x-start.x)*start.vx+(b.position.z-start.z)*start.vz)/n,side=((b.position.z-start.z)*start.vx-(b.position.x-start.x)*start.vz)/n;
   // Bend against the launch line: `side` < 0 is the shooter's left in both attacking directions; reported as +.
   if(Math.abs(side)>Math.abs(maxBend))maxBend=-side;
   if(Math.abs(b.position.x)>=FIELD.halfLength){crossing={z:b.position.z,y:b.position.y,t:m.time-t0};break;}}}
 if(!launch||!crossing)return {launch,apex,windup,crossing:null};
 return {launch,apex,windup,kickFoot,bend:maxBend,crossing,onTarget:Math.abs(crossing.z)<FIELD.goalHalf-FIELD.ballRadius&&crossing.y<FIELD.goalHeight-FIELD.ballRadius};
}
const mean=v=>v.reduce((a,b)=>a+b,0)/(v.length||1);
if(import.meta.url===`file://${process.argv[1]}`){
 console.log(`위치 x=${X} m(골라인까지 ${(FIELD.halfLength-X).toFixed(1)} m), z=${Z}, 조준 z입력 ${AIMZ}, ${FOOT==='left'?'왼발':'오른발'}, 충전 ${POWER}, ${TRIALS}회`);
 console.log('| 슛 | 출발 속도 | 도움닫기(발 닿기까지) | 최고 높이 | 골라인까지 | 휘는 폭(슈터 왼쪽 +) | 찬 발 | 유효 슈팅 |');console.log('|---|---|---|---|---|---|---|---|');
 for(const [name,options] of Object.entries(STYLES)){const r=[];for(let i=0;i<TRIALS;i++){const o=strike(options,{seed:1000+i});if(o?.crossing)r.push(o);}
  console.log(`| ${name} | ${(mean(r.map(o=>o.launch))*3.6).toFixed(0)} km/h | ${mean(r.map(o=>o.windup)).toFixed(2)} s | ${mean(r.map(o=>o.apex)).toFixed(2)} m | ${mean(r.map(o=>o.crossing.t)).toFixed(2)} s | ${mean(r.map(o=>o.bend)).toFixed(2)} m | ${[...new Set(r.map(o=>o.kickFoot))].join('/')} | ${(100*r.filter(o=>o.onTarget).length/(r.length||1)).toFixed(0)}% (${r.length}회) |`);}
}
