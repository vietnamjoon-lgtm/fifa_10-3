// Isolated feel drills (docs/GAME-FEEL-PLAN.md): each sets up a small scene in a headless Match, drives it through the real
// Input class like a keyboard player, and reports one measurable quantity per line.
// node tools/feel/drills.mjs [--only name,name] [--json out.json]
import {register} from 'node:module';
register('../three-loader.mjs',import.meta.url);
const {Match}=await import('../../src/match.js');
const {defaults}=await import('../../src/settings.js');
const {Input}=await import('../../src/input.js');
const {defaultSquads,lineupProfiles,applyLineups}=await import('../../src/squads.js');
const {distance,sprintSpeed,jogSpeed}=await import('../../src/config.js');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
const only=arg('only',null)?.split(',');
const DT=1/120;
/** A match in play with only the listed player ids active (others parked off the pitch and inactive). */
export function scene({seed=1,active=[9],difficulty='normal',settings={},squads=true}={}){
 const m=new Match({...defaults,...settings,halfSeconds:900,seed,difficulty},()=>{});
 if(squads){const data=defaultSquads();applyLineups(m,[0,1].map(t=>lineupProfiles(data,t)));}
 m.start(false);m.state='playing';m.setPiece=null;m.restartOrigin=null;m.owner=null;m.lock=0;m.time=5;
 for(const p of m.players){p.active=active.includes(p.id);p.cooldown=0;p.touchCooldown=0;if(!p.active){p.x=0;p.z=60;}}
 m.controlled=m.players[active[0]];m.manualSwitchUntil=m.controlLockUntil=0;
 let clock=0;const events=[];m.emit=(type,d)=>events.push({type,d,t:m.time});
 const input=new Input({...defaults,...settings},(a,o)=>{m.input=input;m.action(a,o);},()=>m.controlContext(),{now:()=>clock*1000,target:null,getPads:()=>[]});input.enabled=true;
 const held=new Set();
 const api={m,input,events,
  down(c){if(!held.has(c)){held.add(c);input.keyDown(c);}},up(c){if(held.has(c)){held.delete(c);input.keyUp(c);}},
  arrows(x,z){const want={ArrowRight:x>0,ArrowLeft:x<0,ArrowDown:z>0,ArrowUp:z<0};for(const [c,on] of Object.entries(want))on?api.down(c):api.up(c);},
  step(seconds=DT,each){const n=Math.max(1,Math.round(seconds/DT));for(let i=0;i<n;i++){clock+=DT;input.poll();m.step(DT,input);if(each&&each(m)===false)return false;}return true;},
  place(id,x,z,yaw,vx=0,vz=0){const p=m.players[id];p.x=x;p.z=z;p.yaw=yaw??p.yaw;p.vx=vx;p.vz=vz;p.target={x,z};return p;},
  ball(x,z,vx=0,vz=0,y=.11,vy=0){m.physics.reset(x,z,y);const v=m.physics.ball.velocity;v.x=vx;v.z=vz;v.y=vy;},
  get clock(){return clock;}};
 return api;
}
const results={};const report=(name,value)=>{results[name]=value;console.log(name.padEnd(44),typeof value==='object'?JSON.stringify(value):value);};
const want=n=>!only||only.includes(n);
const mean=a=>a.reduce((x,y)=>x+y,0)/(a.length||1),r2=x=>+x.toFixed(2);

// 1. Sprint: time from a standstill to 90% of top speed, with the ball and without.
if(want('sprint')){for(const withBall of [false,true]){const s=scene();const p=s.place(9,-20,0,Math.PI/2);if(withBall){s.ball(-19.46,-.11);s.m.owner=p;p.possessedAt=s.m.time;}
 s.arrows(1,0);s.down('KeyE');const top=sprintSpeed(p);let t90=null,t=0,lost=0;s.step(4,m=>{t+=DT;const v=Math.hypot(p.vx,p.vz);if(t90===null&&v>=.9*top)t90=t;if(withBall&&m.owner!==p)lost++;});
 report(`sprint.${withBall?'ball':'free'}.t90`,{t90:r2(t90??NaN),top:r2(top),reached:r2(Math.hypot(p.vx,p.vz)),ballAhead:withBall?r2(distance(p,s.m.physics.ball.position)):null,lostFrames:lost});}}
// 2. Turns with the ball at jog and at sprint: time until the velocity points within 20 degrees of the new direction at 70% of the old speed.
if(want('turn')){for(const sprint of [false,true])for(const angle of [45,90,135,180]){const s=scene();const p=s.place(9,-20,0,Math.PI/2);s.ball(-19.46,-.11);s.m.owner=p;if(sprint)s.down('KeyE');s.arrows(1,0);s.step(2.5);
 const v0=Math.hypot(p.vx,p.vz),a=angle*Math.PI/180,dx=Math.cos(a),dz=Math.sin(a);s.arrows(Math.abs(dx)<.3?0:Math.sign(dx),Math.abs(dz)<.3?0:Math.sign(dz));const target=Math.atan2(Math.abs(dz)<.3?0:Math.sign(dz),Math.abs(dx)<.3?0:Math.sign(dx));
 let t=0,done=null,maxGap=0,lost=false;s.step(2.5,m=>{t+=DT;const v=Math.hypot(p.vx,p.vz),h=Math.atan2(p.vz,p.vx),err=Math.abs(Math.atan2(Math.sin(h-target),Math.cos(h-target)));maxGap=Math.max(maxGap,distance(p,m.physics.ball.position));if(m.owner!==p&&distance(p,m.physics.ball.position)>2)lost=true;if(done===null&&err<.35&&v>=.7*v0&&distance(p,m.physics.ball.position)<1.6)done=t;});
 report(`turn.${sprint?'sprint':'jog'}.${angle}`,{time:r2(done??NaN),v0:r2(v0),maxBallGap:r2(maxGap),lost});}}
// 3. Ball distance while dribbling straight: mean and max gap at jog and sprint (the "sticky" feel).
if(want('dribble')){for(const sprint of [false,true]){const s=scene();const p=s.place(9,-30,0,Math.PI/2);s.ball(-29.46,-.11);s.m.owner=p;if(sprint)s.down('KeyE');s.arrows(1,0);s.step(1.5);const gaps=[];let touches=0;const e0=s.events.length;s.step(3,m=>{gaps.push(distance(p,m.physics.ball.position));});
 report(`dribble.${sprint?'sprint':'jog'}.gap`,{mean:r2(mean(gaps)),max:r2(Math.max(...gaps)),speed:r2(Math.hypot(p.vx,p.vz))});}}
// 4. Input latency: key press to ball release for a pass and a shot, standing and running.
if(want('latency')){for(const run of ['stand','jog','sprint'])for(const [key,type,hold] of [['KeyS','pass',0],['KeyD','shoot',.3]]){const lat=[];for(let i=0;i<12;i++){const s=scene({active:[9,8]});const p=s.place(9,-20,0,Math.PI/2);s.place(8,5,-10,0);s.ball(-19.46,-.11);s.m.owner=p;p.possessedAt=4;
 if(run!=='stand'){s.arrows(1,0);if(run==='sprint')s.down('KeyE');s.step(1.2+i*.041);}else s.step(.3+i*.037);s.down(key);const t0=s.clock;s.step(hold);s.up(key);let at=null;s.step(1.5,m=>{if(at===null&&s.events.some(e=>e.type==='kick'))at=s.clock-t0;});lat.push(at??NaN);}
 const sorted=[...lat].filter(x=>!Number.isNaN(x)).sort((a,b)=>a-b);report(`latency.${type}.${run}`,{p50:r2(sorted[Math.floor(sorted.length/2)]??NaN),p90:r2(sorted[Math.floor((sorted.length-1)*.9)]??NaN),fails:lat.filter(Number.isNaN).length});}}
// 5. Pass reception: a 20 m ground pass from 8 to 9; time from release to the receiver owning the ball, and how far the first touch rolls.
if(want('receive')){const times=[],gaps=[];for(let i=0;i<8;i++){const s=scene({active:[8,9]});const a=s.place(8,-15,0,Math.PI/2),b=s.place(9,5,(i-4)*.8,-Math.PI/2);s.ball(-14.46,-.11);s.m.owner=a;a.possessedAt=4;s.m.controlled=a;s.arrows(1,0);s.down('KeyS');s.step(DT);s.up('KeyS');s.arrows(0,0);let rel=null,own=null;s.step(3,m=>{if(rel===null&&s.events.some(e=>e.type==='kick'))rel=s.clock;if(rel!==null&&own===null&&m.owner===b){own=s.clock;return false;}});
 s.step(.6);times.push(own&&rel?own-rel:NaN);gaps.push(distance(b,s.m.physics.ball.position));}
 report('receive.20m.flightToControl',{p50:r2([...times].sort((a,b)=>a-b)[4]),max:r2(Math.max(...times)),touchGapAfter600ms:r2(mean(gaps))});}
// 6. 1v1 defending against the AI dribbler starting 8 m away, four keyboard styles: D held from the start (as FC
// players do), arrows until 6 m then D held, D + E held from 6 m, and a manual chase (arrows + E) with a D tap within 1.2 m.
if(want('defend')){for(const style of ['D','near D','D+E','chase'])for(const half of [1,2]){let won=0,fouls=0,beaten=0;const times=[];for(let i=0;i<20;i++){const s=scene({seed:50+i,active:[13,9],settings:{userTeam:1}});s.m.half=half;const k=s.m.direction(0);s.m.controlled=s.m.players[13];const att=s.place(9,-5*k,(i%5-2)*2,k*Math.PI/2),def=s.place(13,3*k,0,-k*Math.PI/2);s.ball(-4.46*k,(i%5-2)*2-.11*k);s.m.owner=att;att.possessedAt=4;
 let t=0,res=null,tapped=0;s.step(6,m=>{t+=DT;const d=distance(def,att),toward=()=>s.arrows(Math.abs(att.x-def.x)>.4?Math.sign(att.x-def.x):0,Math.abs(att.z-def.z)>.4?Math.sign(att.z-def.z):0);
  if(style==='chase'){toward();s.down('KeyE');if(d<1.2&&t>tapped+.4){s.down('KeyD');tapped=t;}else if(t>tapped+.1)s.up('KeyD');}
  else if(style==='D'||d<6){s.arrows(0,0);s.down('KeyD');if(style==='D+E')s.down('KeyE');}else{s.up('KeyD');toward();}
  if(m.owner===def||m.owner===null&&distance(def,m.physics.ball.position)<.8&&m.lastTouch===def){res='won';return false;}if(m.state==='restart'){res='foul';return false;}if((att.x-def.x)*k>1.5&&distance(att,def)>2.5){res='beaten';return false;}});
 if(res==='won'){won++;times.push(t);}else if(res==='foul')fouls++;else if(res==='beaten')beaten++;}
 report(`defend.1v1.${style}.half${half}`,{won,beaten,fouls,other:20-won-beaten-fouls,meanWinTime:r2(mean(times))});}}
// 7. Keeper: save share of AI-struck shots by distance (shot at a random corner, power .7).
if(want('keeper')){for(const dist of [11,16,22,28]){let goals=0,saves=0,wide=0;for(let i=0;i<30;i++){const s=scene({seed:100+i,active:[9,11]});const p=s.place(9,52.5-dist,(i%7-3)*1.5,Math.PI/2);s.place(11,51.2,0,-Math.PI/2);s.ball(p.x+.54,p.z-.11);s.m.owner=p;p.possessedAt=4;s.m.autoplay=true;
 const z=(i%2?1:-1)*(1.5+(i%3)*.6);s.m.queueKick(p,'shoot',.55+(i%4)*.1,{x:52.5-p.x,z:z-p.z});let res=null;s.step(3,m=>{if(s.events.some(e=>e.type==='save')){res='save';return false;}if(m.state==='goal'||s.events.some(e=>e.type==='goal')){res='goal';return false;}if(m.state==='restart'){res='wide';return false;}});
 if(res==='goal')goals++;else if(res==='save')saves++;else wide++;}
 report(`keeper.${dist}m`,{goals,saves,wide,saveShareOnTarget:r2(saves/Math.max(1,goals+saves))});}}
const j=arg('json',null);if(j)(await import('node:fs')).writeFileSync(j,JSON.stringify(results,null,1));
