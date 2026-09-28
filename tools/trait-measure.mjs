// AI-vs-AI matches with fixed seeds, with and without player traits and work rates.
// node tools/trait-measure.mjs [--seeds 12] [--half 120] [--out reports/player-traits-measure.json]
// Configurations: neutral (no traits, mid/mid work rates: the pre-trait AI), workrate (position work rates only),
// traits (the shipped defaults: position work rates plus 1-2 traits per built-in player), and two one-sided runs
// (traits for one team, neutral for the other) to check balance in both team directions; only:<trait> and
// work:<attack>/<defence> isolate one trait or one work-rate setting on every eligible player of both teams.
import fs from 'node:fs';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {defaultSquads,lineupProfiles,applyLineups} from '../src/squads.js';
import {TRAITS} from '../src/traits.js';
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i>0?process.argv[i+1]:fallback;};
const SEEDS=Number(arg('seeds',12)),HALF=Number(arg('half',120)),OUT=arg('out',null);
export function lineupsFor(mode){
 const data=defaultSquads(),lineups=[0,1].map(t=>lineupProfiles(data,t));
 const neutral=p=>({...p,traits:[],workRate:{attack:'mid',defence:'mid'}}),rateOnly=p=>({...p,traits:[]});
 // only:<trait> gives every eligible player of both teams just that trait; work:<attack>/<defence> sets every outfield player's work rates.
 if(mode.startsWith('only:')){const id=mode.slice(5),keeper=TRAITS[id].kind==='keeper';return lineups.map(l=>l.map(p=>({...neutral(p),traits:(p.role==='GK')===keeper?[id]:[]})));}
 if(mode.startsWith('work:')){const [attack,defence]=mode.slice(5).split('/');return lineups.map(l=>l.map(p=>({...neutral(p),workRate:p.role==='GK'?{attack:'mid',defence:'mid'}:{attack,defence}})));}
 const pick={neutral:[neutral,neutral],workrate:[rateOnly,rateOnly],traits:[p=>p,p=>p],home:[p=>p,neutral],away:[neutral,p=>p]}[mode];
 return lineups.map((l,t)=>l.map(pick[t]));
}
/** Plays one AI-vs-AI match and returns per-player and team measurements. */
export function playMatch(mode,seed,half=HALF){
 let lastKick=null,farShot=null,offsideCalls=0;const players={},slot=p=>players[p.id]??={id:p.id,team:p.team,role:p.role,shots:[],crosses:[],received:0,dribble:0,dribbleTime:0,run:0,slides:0,fouls:0,sweeps:0,claims:0,runs:0,earlyCrosses:0,headers:[],passLengths:[],goals:0,offsides:0,saves:0,farShots:0,farGoals:0};
 const m=new Match({...defaults,halfSeconds:half,seed},(type,data)=>{
  if(type==='kick'&&data?.player){const p=data.player,dir=m.direction(p.team);lastKick={team:p.team,id:p.id,type:data.type};const restart=!!p.action?.restartKind;
   if(data.type==='shoot'&&!restart)slot(p).shots.push(+(52.5-p.x*dir).toFixed(1));
   if(data.type==='lob'&&Math.abs(p.z)>=9&&p.x*dir>=0&&!restart){slot(p).crosses.push(+(p.x*dir).toFixed(1));if(p.action?.early)slot(p).earlyCrosses++;}
   if(data.type!=='shoot'&&!restart&&p.action?.distance)slot(p).passLengths.push(+p.action.distance.toFixed(1));
   const b=m.physics.ball.position;if(data.contact&&data.contact.target?.y>1.2)slot(p).headers.push(+m.physics.ball.velocity.length().toFixed(2));
   if(data.type==='shoot'&&!restart&&Math.abs(b.z)>=3){const v=m.physics.ball.velocity;if(v.x*dir>.1){const z=b.z+v.z*(dir*52.5-b.x)/v.x;if(Math.sign(z)===-Math.sign(b.z)){slot(p).farShots++;farShot={id:p.id,time:m.time};}}}}
  if(type==='goal'&&data?.scorer){slot(data.scorer).goals++;if(farShot&&farShot.id===data.scorer.id&&m.time-farShot.time<3)slot(data.scorer).farGoals++;}
  if(type==='save'&&data?.player)slot(data.player).saves++;
  if(type==='restart'&&data?.label?.startsWith('오프사이드'))offsideCalls++;
  if(type==='control'&&data?.player&&lastKick&&lastKick.team===data.player.team&&lastKick.id!==data.player.id&&lastKick.type!=='shoot'){slot(data.player).received++;lastKick=null;}
 });
 applyLineups(m,lineupsFor(mode));m.start(false);m.autoplay=true;
 const last=new Map(),actions=new Map();let steps=0,decision=null;
 for(const p of m.players){slot(p);last.set(p.id,{x:p.x,z:p.z});}
 while(m.state!=='fulltime'&&steps<120*(half*2+300)){
  m.step(1/120,{axis:{x:0,z:0}});steps++;
  for(const p of m.players){const s=slot(p),prev=last.get(p.id),d=Math.hypot(p.x-prev.x,p.z-prev.z);
   if(m.state==='playing'&&d<.2){s.run+=d;if(m.owner===p&&!m.heldBy){s.dribble+=d;s.dribbleTime+=1/120;}}
   last.set(p.id,{x:p.x,z:p.z});
   if(p.action&&p.action!==actions.get(p.id)&&p.action.type==='slide')s.slides++;actions.set(p.id,p.action);
   if(p.runUntil>m.time&&!(s.lastRun>m.time-1/120))s.runs++;s.lastRun=p.runUntil;
   if(p.aiState==='SWEEP'&&s.lastState!=='SWEEP')s.sweeps++;if(p.aiState==='CLAIM'&&s.lastState!=='CLAIM')s.claims++;s.lastState=p.aiState;}
  if(m.lastDecision&&m.lastDecision!==decision){decision=m.lastDecision;if(decision.kind==='foul')players[decision.offender].fouls++;}
 }
 for(const s of Object.values(players)){delete s.lastState;delete s.lastRun;}
 return {mode,seed,state:m.state,score:[...m.score],possession:m.stats.possession.map(v=>+v.toFixed(1)),shots:[...m.stats.shots],passes:[...m.stats.passes],fouls:[...m.stats.fouls],offsides:offsideCalls,yellows:[...m.stats.yellows],reds:[...m.stats.reds],staminaEnd:m.players.map(p=>+p.stamina.toFixed(3)),players:Object.values(players),traits:m.players.map(p=>p.traits),workRate:m.players.map(p=>p.workRate)};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const modes=(arg('modes',['neutral','workrate','traits','home','away',...Object.keys(TRAITS).map(t=>'only:'+t),'work:high/mid','work:low/mid','work:mid/high','work:mid/low'].join(','))).split(','),runs=[];const started=performance.now();
 for(const mode of modes)for(let i=0;i<SEEDS;i++){const r=playMatch(mode,1000+i);if(r.state!=='fulltime')throw Error(`${mode} ${r.seed} did not finish`);runs.push(r);process.stderr.write(`${mode} seed ${r.seed}: ${r.score.join('-')}\n`);}
 const out={createdAt:new Date().toISOString(),seeds:SEEDS,halfSeconds:HALF,cpuSeconds:+((performance.now()-started)/1000).toFixed(1),runs};
 if(OUT)fs.writeFileSync(OUT,JSON.stringify(out));else console.log(JSON.stringify(out));
}
