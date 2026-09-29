// A scripted "casual FC Online keyboard player" playing the user team through the real Input class (8-way arrows, S/W/A/D,
// E sprint, D-hold defending, S switch) against the AI, headless. It measures how hard the game is to play:
// input-to-contact latency, ignored presses, pass completion, dispossessions and the score (docs/GAME-FEEL-PLAN.md).
// node tools/feel/human-bot.mjs [--seeds 6] [--half 180] [--difficulty normal] [--json out.json]
import {register} from 'node:module';
register('../three-loader.mjs',import.meta.url);
const {Match}=await import('../../src/match.js');
const {defaults}=await import('../../src/settings.js');
const {Input}=await import('../../src/input.js');
const {defaultSquads,lineupProfiles,applyLineups}=await import('../../src/squads.js');
const {distance}=await import('../../src/config.js');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
const ARROWS={x:['ArrowLeft',null,'ArrowRight'],z:['ArrowUp',null,'ArrowDown']};
export function playHuman(seed,{half=180,difficulty='normal',settings={},react=.12}={}){
 let clock=0;const log=[];
 const st={seed,goals:[0,0],shots:0,onTarget:0,passes:0,completed:0,intercepted:0,presses:{},ignored:{},interrupted:{},latency:{},dispossessed:0,carried:0,oppShots:0,oppPasses:0,oppCompleted:0,wins:0,switches:0,missed:0,defendTime:0,attackTime:0,chaseTime:0};
 let m;const input=new Input({...defaults,...settings},(action,options)=>{m.input=input;m.action(action,options);},()=>m?m.controlContext():{attack:true},{now:()=>clock*1000,target:null,getPads:()=>[]});
 const pending=[];let pass=null,lastShot=null,oppPass=null;
 m=new Match({...defaults,...settings,halfSeconds:half,seed,difficulty},(type,d)=>{
  if(type==='kick'&&d?.player&&d.player.team!==m.settings.userTeam&&!d.player.action?.restartKind){if(d.type==='shoot')st.oppShots++;else if(d.player.action?.aim){st.oppPasses++;oppPass={from:d.player.id,time:m.time};}}
  if(type==='kick'&&d?.player?.team===m.settings.userTeam){const p=d.player;const k=pending.findIndex(q=>q.player===p.id&&q.kind===(d.type==='shoot'?'shoot':'pass'));if(k>=0){const q=pending.splice(k,1)[0];(st.latency[q.key]||=[]).push(clock-q.at);}
   if(!p.action?.restartKind){if(d.type==='shoot'){st.shots++;lastShot=m.time;}else{st.passes++;pass={from:p.id,time:m.time};}}}
  if(type==='control'&&d?.player&&oppPass&&m.time-oppPass.time<6){if(d.player.team!==m.settings.userTeam&&d.player.id!==oppPass.from)st.oppCompleted++;oppPass=null;}
  if(type==='control'&&d?.player){if(pass&&m.time-pass.time<6){if(d.player.team===m.settings.userTeam&&d.player.id!==pass.from)st.completed++;else if(d.player.team!==m.settings.userTeam)st.intercepted++;pass=null;}}
  if(type==='save'&&d?.player?.team!==m.settings.userTeam&&lastShot&&m.time-lastShot<3){st.onTarget++;lastShot=null;}
  if(type==='goal'){st.goals[d.team]++;if(d.team===m.settings.userTeam&&lastShot&&m.time-lastShot<4)st.onTarget++;lastShot=null;pass=null;}
  if(type==='miss'&&d?.player===m.controlled)st.missed++;
 });
 {const data=defaultSquads();applyLineups(m,[0,1].map(t=>lineupProfiles(data,t)));}
 m.start(false);
 const held=new Set(),down=c=>{if(!held.has(c)){held.add(c);input.keyDown(c);}},up=c=>{if(held.has(c)){held.delete(c);input.keyUp(c);}};
 const tap=(c,key)=>{down(c);release.push({code:c,at:clock+.06});if(key&&m.owner===m.controlled&&!m.setPiece&&!m.heldBy){st.presses[key]=(st.presses[key]||0)+1;pending.push({key,kind:key==='shoot'?'shoot':'pass',player:m.controlled.id,at:clock,expires:clock+1.2,team:m.controlled.team});}};
 const release=[];
 function arrows(dx,dz){const n=Math.hypot(dx,dz);let x=0,z=0;if(n>.01){const a=Math.atan2(dz,dx),o=Math.round(a/(Math.PI/4));x=Math.round(Math.cos(o*Math.PI/4));z=Math.round(Math.sin(o*Math.PI/4));}
  for(const [axis,v] of [['x',x],['z',z]])for(const i of [0,2]){const code=ARROWS[axis][i];if(v===i-1)down(code);else up(code);}}
 let nextThink=0,shotRelease=null,switchReady=0,lastOwner=null,carryStart=null,passCooldown=0;
 const team=()=>m.settings.userTeam;
 function think(){
  const p=m.controlled,b=m.physics.ball.position,dir=m.direction(team()),ctx=m.controlContext();
  if(m.state!=='playing'||!p?.active){arrows(0,0);up('KeyE');up('KeyD');return;}
  const opp=m.players.filter(q=>q.active&&q.team!==team()),mates=m.players.filter(q=>q.active&&q.team===team()&&q!==p&&q.role!=='GK');
  if(ctx.keeperHolding){arrows(dir,0);tap('KeyS','pass');return;}
  if(m.setPiece&&m.setPiece.team===team()&&m.setPiece.taker===p){if(p.action)return;const k=m.setPiece.kind;if(k==='penalty'){down('KeyD');shotRelease=clock+.3;return;}arrows(dir,-Math.sign(p.z)*.5);tap(k==='corner'?'KeyA':'KeyS','pass');return;}
  if(m.owner===p){st.attackTime+=.1;up('KeyD');if(shotRelease)return;
   const goal={x:dir*52.5,z:0},gd=distance(p,goal),ahead=opp.filter(q=>q.role!=='GK'&&((q.x-p.x)*dir>-.5)).sort((a,c)=>distance(a,p)-distance(c,p)),near=ahead[0],nd=near?distance(near,p):99;
   if(gd<21&&Math.abs(p.z)<15&&passCooldown<clock){const far=-Math.sign(p.z||1);arrows(dir*.4,far*.6);down('KeyD');st.presses.shoot=(st.presses.shoot||0)+1;pending.push({key:'shoot',kind:'shoot',player:p.id,at:clock,expires:clock+1.6,team:p.team});shotRelease=clock+.38;return;}
   const options=mates.map(q=>{const lane=opp.filter(o=>{const t=((o.x-p.x)*(q.x-p.x)+(o.z-p.z)*(q.z-p.z))/Math.max(1,distance(p,q)**2);if(t<.05||t>.95)return false;return Math.hypot(o.x-p.x-t*(q.x-p.x),o.z-p.z-t*(q.z-p.z))<2;}).length,open=Math.min(...opp.map(o=>distance(o,q)));return {q,forward:(q.x-p.x)*dir,open,lane,d:distance(p,q)};}).filter(o=>o.d>6&&o.d<32&&o.lane===0&&o.open>2.5).sort((a,c)=>(c.forward*.5+c.open)-(a.forward*.5+a.open));
   if(nd<2.6&&options.length&&passCooldown<clock){const o=options[0];arrows(o.q.x-p.x,o.q.z-p.z);tap(o.forward>8&&o.q.role==='FWD'?'KeyW':'KeyS',o.forward>8&&o.q.role==='FWD'?'through':'pass');passCooldown=clock+1;return;}
   if(carryStart!==null&&clock-carryStart>3.5&&options.length&&options[0].forward>5&&passCooldown<clock){const o=options[0];arrows(o.q.x-p.x,o.q.z-p.z);tap('KeyS','pass');passCooldown=clock+1;return;}
   let dx=goal.x-p.x,dz=(goal.z-p.z)*.6;if(near&&nd<5){const side=Math.sign((p.z-near.z)||(p.z>0?-1:1));dz+=side*8;}
   arrows(dx,dz);if(nd>4)down('KeyE');else up('KeyE');return;}
  shotRelease=null;
  if(ctx.attack){up('KeyD');up('KeyE');const v=m.physics.ball.velocity;if(!m.owner&&distance(p,b)<18)arrows(b.x+v.x*.3-p.x,b.z+v.z*.3-p.z);else arrows(dir,0);return;}
  // Defending
  st.defendTime+=.1;const carrier=m.owner,target=carrier||{x:b.x,z:b.z},d=distance(p,target);
  const closer=m.players.filter(q=>q.active&&q.team===team()&&q.role!=='GK'&&q!==p).sort((a,c)=>distance(a,target)-distance(c,target))[0];
  if(closer&&d>9&&distance(closer,target)+5<d&&clock>switchReady){tap('KeyS');st.switches++;switchReady=clock+1.2;return;}
  if(carrier&&d<6){down('KeyD');arrows(0,0);up('KeyE');return;}
  up('KeyD');const v=m.physics.ball.velocity;arrows(target.x+(carrier?carrier.vx:v.x)*.4-p.x,target.z+(carrier?carrier.vz:v.z)*.4-p.z);if(d>5)down('KeyE');else up('KeyE');
 }
 let steps=0;const dt=1/120;
 while(m.state!=='fulltime'&&steps<120*(half*2+400)){
  clock+=dt;steps++;
  for(let i=release.length-1;i>=0;i--)if(release[i].at<=clock){up(release[i].code);release.splice(i,1);}
  if(shotRelease&&clock>=shotRelease){up('KeyD');shotRelease=null;passCooldown=clock+1;}
  input.enabled=m.state==='playing';if(clock>=nextThink){think();nextThink=clock+react;}
  input.poll();m.step(dt,input);
  for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(m.lastTouch&&m.lastTouch.team!==q.team)q.interrupted=true;if(clock>q.expires){const bucket=q.interrupted?st.interrupted:st.ignored;bucket[q.key]=(bucket[q.key]||0)+1;if(!q.interrupted&&process.env.FEEL_DEBUG){const p=m.players[q.player],b=m.physics.ball.position;console.error('ignored',q.key,'t',m.time.toFixed(2),'owner',m.owner?.id,'p',q.player,'ctrl',m.controlled.id,'act',p.action?.type,'pend',!!p.pendingKick,'intent',!!p.intent,'gap',Math.hypot(p.x-b.x,p.z-b.z).toFixed(2),'by',b.y.toFixed(2),'state',m.state,'lastKick',m.lastTouch?.id,m.lastTouchKind);}pending.splice(i,1);}}
  const owner=m.owner;if(owner!==lastOwner){if(lastOwner&&lastOwner.team===team()&&lastOwner===m.controlled&&owner&&owner.team!==team())st.dispossessed++;if(owner&&owner.team===team()&&lastOwner&&lastOwner.team!==team()&&owner===m.controlled)st.wins++;if(owner===m.controlled&&owner?.team===team()){st.carried++;carryStart=clock;}lastOwner=owner;}
  if(m.state==='playing'&&!m.owner&&m.controlContext().attack)st.chaseTime+=dt;
 }
 st.state=m.state;st.possession=m.stats.possession.map(v=>+v.toFixed(1));return st;
}
export function summarize(runs){const sum=k=>runs.reduce((a,r)=>a+(typeof k==='function'?k(r):r[k]),0),lat={},ign={},press={},intr={};
 for(const r of runs){for(const [k,v] of Object.entries(r.latency))(lat[k]||=[]).push(...v);for(const [k,v] of Object.entries(r.ignored))ign[k]=(ign[k]||0)+v;for(const [k,v] of Object.entries(r.interrupted))intr[k]=(intr[k]||0)+v;for(const [k,v] of Object.entries(r.presses))press[k]=(press[k]||0)+v;}
 const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return +(s[Math.floor((s.length-1)*p)]??NaN).toFixed(3);};
 return {matches:runs.length,score:runs.map(r=>r.goals.join('-')).join(' '),goalsFor:sum(r=>r.goals[0]),goalsAgainst:sum(r=>r.goals[1]),shots:sum('shots'),onTarget:sum('onTarget'),
  passes:sum('passes'),passCompletion:+(sum('completed')/Math.max(1,sum('passes'))).toFixed(3),interceptedShare:+(sum('intercepted')/Math.max(1,sum('passes'))).toFixed(3),
  oppShots:sum('oppShots'),oppPassCompletion:+(sum('oppCompleted')/Math.max(1,sum('oppPasses'))).toFixed(3),carries:sum('carried'),dispossessedPerCarry:+(sum('dispossessed')/Math.max(1,sum('carried'))).toFixed(3),ballWins:sum('wins'),switches:sum('switches'),missedKicks:sum('missed'),
  possessionShare:+(sum(r=>r.possession[0])/Math.max(1,sum(r=>r.possession[0]+r.possession[1]))).toFixed(3),
  latency:Object.fromEntries(Object.entries(lat).map(([k,v])=>[k,{n:v.length,p50:q(v,.5),p90:q(v,.9)}])),ignored:Object.fromEntries(Object.entries(press).map(([k,v])=>[k,`${ign[k]||0}/${v}`])),interruptedByOpponent:Object.fromEntries(Object.entries(press).map(([k,v])=>[k,`${intr[k]||0}/${v}`]))};}
if(import.meta.url===`file://${process.argv[1]}`){const seeds=Number(arg('seeds',6)),half=Number(arg('half',180)),difficulty=arg('difficulty','normal'),runs=[];
 for(let i=0;i<seeds;i++){const r=playHuman(3000+i,{half,difficulty});runs.push(r);process.stderr.write(`seed ${r.seed}: ${r.goals.join('-')} ${r.state}\n`);}
 const out=summarize(runs);console.log(JSON.stringify(out,null,1));const j=arg('json',null);if(j)(await import('node:fs')).writeFileSync(j,JSON.stringify({summary:out,runs},null,1));}
