// AI-vs-AI match statistics for the game-feel work (docs/GAME-FEEL-PLAN.md).
// node tools/feel/match-stats.mjs [--seeds 8] [--half 180] [--difficulty normal] [--json out.json]
import {register} from 'node:module';
register('../three-loader.mjs',import.meta.url);
const {Match}=await import('../../src/match.js');
const {defaults}=await import('../../src/settings.js');
const {defaultSquads,lineupProfiles,applyLineups}=await import('../../src/squads.js');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
export function playMatch(seed,{half=180,difficulty='normal',squads=true}={}){
 const s={seed,goals:[0,0],shots:[0,0],onTarget:[0,0],saves:[0,0],passes:[0,0],completed:[0,0],intercepted:[0,0],lobs:[0,0],through:[0,0],tackles:[0,0],fouls:[0,0],restarts:{},turnovers:0,spells:[],deadTime:0,playTime:0,airTime:0,ownerTime:0,looseTime:0,shotDist:[],goalDist:[],passDist:[],kicksPerMin:0};
 let pending=null,spell=null,lastShot=null;
 const m=new Match({...defaults,halfSeconds:half,seed,difficulty},(type,d)=>{
  if(type==='kick'&&d?.player){const p=d.player,t=p.team;
   if(pending&&pending.team===t&&pending.from!==p.id&&pending.type!=='shoot'){/* a kick by a team-mate before any control: first-time pass */}
   if(d.type==='shoot'){if(!p.action?.restartKind){s.shots[t]++;const dist=Math.hypot(m.direction(t)*52.5-p.x,p.z);s.shotDist.push(dist);lastShot={team:t,dist,time:m.time};}}
   else if(!p.action?.restartKind&&p.action){s.passes[t]++;if(d.type==='lob')s.lobs[t]++;if(d.type==='through')s.through[t]++;s.passDist.push(p.action.distance||0);pending={team:t,from:p.id,type:d.type,time:m.time};}
  }
  if(type==='control'&&d?.player){const t=d.player.team;if(pending&&m.time-pending.time<6){if(pending.team===t&&pending.from!==d.player.id)s.completed[t]++;else if(pending.team!==t)s.intercepted[1-t]++;pending=null;}
   if(!spell||spell.team!==t){if(spell){s.spells.push(spell);s.turnovers++;}spell={team:t,start:m.time,passes:0};}else spell.passes++;}
  if(type==='save'&&d?.player){s.saves[d.player.team]++;if(lastShot&&lastShot.team!==d.player.team&&m.time-lastShot.time<3)s.onTarget[lastShot.team]++;lastShot=null;}
  if(type==='goal'){s.goals[d.team]++;if(lastShot&&lastShot.team===d.team&&m.time-lastShot.time<4){s.onTarget[d.team]++;s.goalDist.push(lastShot.dist);}lastShot=null;pending=null;}
  if(type==='restart'){const k=d.kind+(d.label?.startsWith('오프사이드')?'-offside':'');s.restarts[k]=(s.restarts[k]||0)+1;pending=null;}
 });
 if(squads){const data=defaultSquads();applyLineups(m,[0,1].map(t=>lineupProfiles(data,t)));}
 m.start(false);m.autoplay=true;let steps=0;
 while(m.state!=='fulltime'&&steps<120*(half*2+400)){m.step(1/120,{axis:{x:0,z:0}});steps++;const dt=1/120;
  if(m.state==='playing'){s.playTime+=dt;if(m.physics.ball.position.y>.5)s.airTime+=dt;if(m.owner)s.ownerTime+=dt;else s.looseTime+=dt;}else if(!['goal','halftime'].includes(m.state))s.deadTime+=dt;}
 if(spell)s.spells.push(spell);s.fouls=[...m.stats.fouls];s.possession=m.stats.possession.map(v=>+v.toFixed(1));s.state=m.state;s.minutes=(s.playTime+s.deadTime)/60;return s;
}
export function summarize(runs){const n=runs.length,sum=f=>runs.reduce((a,r)=>a+f(r),0),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,both=k=>sum(r=>r[k][0]+r[k][1]);
 const spells=runs.flatMap(r=>r.spells);const minutes=sum(r=>r.playTime)/60;
 return {matches:n,playMinutesPerMatch:+(minutes/n).toFixed(2),
  goalsPerMatch:+(both('goals')/n).toFixed(2),shotsPerMatch:+(both('shots')/n).toFixed(1),onTargetShare:+(both('onTarget')/Math.max(1,both('shots'))).toFixed(2),goalsPerShot:+(both('goals')/Math.max(1,both('shots'))).toFixed(3),
  meanShotDistance:+mean(runs.flatMap(r=>r.shotDist)).toFixed(1),meanGoalDistance:+mean(runs.flatMap(r=>r.goalDist)).toFixed(1),
  passesPerMatch:+(both('passes')/n).toFixed(1),passCompletion:+(both('completed')/Math.max(1,both('passes'))).toFixed(3),interceptShare:+(both('intercepted')/Math.max(1,both('passes'))).toFixed(3),lobShare:+(both('lobs')/Math.max(1,both('passes'))).toFixed(2),throughShare:+(both('through')/Math.max(1,both('passes'))).toFixed(2),meanPassLength:+mean(runs.flatMap(r=>r.passDist)).toFixed(1),
  turnoversPerPlayMinute:+(sum(r=>r.turnovers)/minutes).toFixed(2),meanSpellSeconds:+mean(spells.map((s,i)=>0)).toFixed(1),meanPassesPerSpell:+mean(spells.map(s=>s.passes)).toFixed(2),
  deadShare:+(sum(r=>r.deadTime)/sum(r=>r.deadTime+r.playTime)).toFixed(3),airShare:+(sum(r=>r.airTime)/sum(r=>r.playTime)).toFixed(3),looseShare:+(sum(r=>r.looseTime)/sum(r=>r.playTime)).toFixed(3),
  foulsPerMatch:+(sum(r=>r.fouls[0]+r.fouls[1])/n).toFixed(1),restartsPerMatch:Object.fromEntries(Object.entries(runs.reduce((a,r)=>{for(const[k,v]of Object.entries(r.restarts))a[k]=(a[k]||0)+v;return a;},{})).map(([k,v])=>[k,+(v/n).toFixed(1)])),
  scores:runs.map(r=>r.goals.join('-')).join(' ')};}
if(import.meta.url===`file://${process.argv[1]}`){const seeds=Number(arg('seeds',8)),half=Number(arg('half',180)),difficulty=arg('difficulty','normal'),runs=[];
 for(let i=0;i<seeds;i++){const r=playMatch(2000+i,{half,difficulty});runs.push(r);process.stderr.write(`seed ${r.seed}: ${r.goals.join('-')} shots ${r.shots.join('/')} ${r.state}\n`);}
 const out=summarize(runs);console.log(JSON.stringify(out,null,1));const j=arg('json',null);if(j)(await import('node:fs')).writeFileSync(j,JSON.stringify({summary:out,runs},null,1));}
