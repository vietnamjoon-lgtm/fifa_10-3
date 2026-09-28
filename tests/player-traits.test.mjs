import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAITS,TRAIT_MAX,defaultTraits,cleanTraits,cleanWorkRate} from '../src/traits.js';
import {cleanProfile,cleanLineup,defaultSquads,lineupProfiles,applyLineups,cleanLibrary} from '../src/squads.js';
import {cardProfile,CARD_POOL} from '../src/card-data.js';
import {Match} from '../src/match.js';
import {DuelMatch} from '../src/duel.js';
import {defaults} from '../src/settings.js';
import {Room} from '../server/room.js';
import {carrierDecision,supportShape,teamPlan,keeperTarget} from '../src/ai.js';
import {aiTrait,decisionScale,passLean,slideLunge,attackPush,TRAIT_AI} from '../src/trait-ai.js';
import {staminaDrain,tackleReach,foulTolerance,kickTraits,farPostShot,TRAIT_PLAY} from '../src/trait-play.js';

const neutral=p=>({...p,traits:[],workRate:{attack:'mid',defence:'mid'}});

test('profiles keep only known traits (at most five, no duplicates) and valid work rates',()=>{
 const p=cleanProfile({role:'DEF',traits:['runner','runner','bogus','__proto__','sweeper','longShots','finesse','tireless','playmaker','soloPlay',7,null],workRate:{attack:'max',defence:'low'}});
 assert.deepEqual(p.traits,['runner','longShots','finesse','tireless','playmaker']);assert.equal(p.traits.length,TRAIT_MAX);
 assert.deepEqual(p.workRate,{attack:'low',defence:'low'});
 assert.deepEqual(cleanProfile({role:'GK',traits:['sweeper','crossClaimer']}).traits,['sweeper','crossClaimer']);
 assert.deepEqual(cleanProfile({uid:'x',role:'FWD',traits:'runner'}).traits,[]);
 assert.equal(cleanTraits({length:3},'FWD'),null);assert.deepEqual(cleanWorkRate({attack:{},defence:'__proto__'},'MID'),{attack:'mid',defence:'mid'});
});

test('old saves get position work rates; built-in players get stable position traits, custom ones none',()=>{
 const data=defaultSquads(),old=structuredClone(data);for(const p of old.players){delete p.traits;delete p.workRate;}
 const loaded=cleanLibrary(old);
 for(const p of loaded.players){const want={FWD:{attack:'high',defence:'low'},DEF:{attack:'low',defence:'high'},MID:{attack:'mid',defence:'mid'},GK:{attack:'mid',defence:'mid'}}[p.role];assert.deepEqual(p.workRate,want);
  assert.ok(p.traits.length>=1&&p.traits.length<=2);assert.deepEqual(p.traits,defaultTraits(p.role,p.uid));
  for(const id of p.traits)assert.equal(TRAITS[id].kind==='keeper',p.role==='GK');}
 assert.deepEqual(loaded.players.map(p=>p.traits),data.players.map(p=>p.traits));
 assert.deepEqual(cleanProfile({uid:'my-own-player',role:'FWD'}).traits,[]);
 assert.deepEqual(cardProfile(CARD_POOL[0],'a').traits,cardProfile(CARD_POOL[0],'b').traits);
 // Choosing no traits stays empty after a save and reload.
 assert.deepEqual(cleanLibrary(JSON.parse(JSON.stringify({...data,players:data.players.map(p=>({...p,traits:[]}))}))).players[3].traits,[]);
});

test('network lineups and the room server pass only allowed trait values to both clients and the simulation',()=>{
 let id=0;const r=new Room({code:'ABCDEFGH',random:()=>String(++id)}),data=defaultSquads(),home=lineupProfiles(data,0),away=lineupProfiles(data,1);
 home[9]={...home[9],traits:['runner','soloPlay'],workRate:{attack:'high',defence:'mid'}};
 away[3]={...away[3],traits:['slideTackler','<script>','sweeper',...Object.keys(TRAITS)],workRate:{attack:'ultra',defence:'high'}};
 const a=r.reserve('a',true,home),b=r.reserve('b',false,away),messages=[[],[]];r.connect(a.token,m=>messages[0].push(m));r.connect(b.token,m=>messages[1].push(m));
 for(const t of [0,1])r.message(t,{type:'ready',ready:true});r.message(0,{type:'start'});
 assert.deepEqual(r.match.players[9].traits,['runner','soloPlay']);
 const bad=r.match.players[14];assert.equal(bad.traits.length,TRAIT_MAX);assert.ok(bad.traits.every(t=>Object.hasOwn(TRAITS,t)&&TRAITS[t].kind!=='keeper'));assert.deepEqual(bad.workRate,{attack:'low',defence:'high'});
 const squads=messages.map(m=>m.find(x=>x.type==='start').squads);assert.deepEqual(squads[0],squads[1]);assert.deepEqual(squads[0][1][3].traits,bad.traits);
 assert.deepEqual(cleanLineup(away,1,true)[3].traits,bad.traits);
});

test('no traits and mid work rates play exactly like players without the new fields',()=>{
 const run=strip=>{const m=new Match({...defaults,halfSeconds:15,seed:77});applyLineups(m,defaultSquads().lineups.map((_,t)=>lineupProfiles(defaultSquads(),t).map(neutral)));if(strip)for(const p of m.players){delete p.traits;delete p.workRate;}m.start(false);m.autoplay=true;for(let i=0;i<120*40&&m.state!=='fulltime';i++)m.step(1/120,{axis:{x:0,z:0}});return JSON.stringify([m.score,m.stats,m.players.map(p=>[p.x.toFixed(6),p.z.toFixed(6),p.stamina])]);};
 assert.equal(run(false),run(true));
});

// A match paused at a chosen moment; `setup` places the players.
function scene(team,half,setup){const m=new Match({...defaults,seed:5});applyLineups(m,[0,1].map(t=>lineupProfiles(defaultSquads(),t).map(neutral)));m.start(false);m.half=half;m.state='playing';m.autoplay=true;m.controlled=null;
 const dir=m.direction(team);for(const p of m.players){p.x=-dir*p.team*0;p.vx=p.vz=0;p.cooldown=0;p.touchCooldown=0;p.action=null;}
 setup(m,dir);return m;}
for(const team of [0,1])for(const half of [1,2])test(`long-shot, sweeper and support traits act the same for team ${team} in half ${half}`,()=>{
 // A carrier 30.5 m out with a clear lane: the default AI keeps the ball, a long-shot taker shoots.
 const shoots=traits=>{const m=scene(team,half,(m,dir)=>{for(const p of m.players){p.x=p.team===team?-dir*30:dir*45;p.z=(p.index<6?-1:1)*(8+p.index*2);}const gk=m.players[(1-team)*11];gk.x=dir*51;gk.z=0;
  const p=m.players[team*11+9];p.x=dir*(52.5-30.5);p.z=0;p.yaw=dir*Math.PI/2;p.traits=traits;m.physics.reset(p.x+dir*.45,p.z);m.owner=p;m.lastTouch=p;});
  const p=m.players[team*11+9];m.random=()=>.1;p.nextDecision=-1;carrierDecision(m,p);return p.action?.type==='shoot'||p.pendingKick?.args[0]==='shoot';};
 assert.equal(shoots([]),false);assert.equal(shoots(['longShots']),true);
 // A loose ball behind the back line: only the sweeper keeper leaves his line for it.
 const sweeps=traits=>{const m=scene(team,half,(m,dir)=>{for(const p of m.players){p.x=p.team===team?dir*5:dir*30;p.z=(p.index-5)*5;}const gk=m.players[team*11];gk.x=-dir*51;gk.z=0;gk.traits=traits;m.physics.reset(-dir*36,2);m.physics.ball.velocity.set(-dir*3,0,0);m.owner=null;m.lastTouchTeam=1-team;m.lastKickType='pass';});
  const gk=m.players[team*11];keeperTarget(m,gk);return {state:gk.aiState,toward:(gk.target.x-gk.x)*m.direction(team)};};
 assert.notEqual(sweeps([]).state,'SWEEP');const sweep=sweeps(['sweeper']);assert.equal(sweep.state,'SWEEP');assert.ok(sweep.toward>5);
 // Support: a high attacking work rate stands further forward along the attack, never past the second-last defender.
 const support=workRate=>{const m=scene(team,half,(m,dir)=>{for(const p of m.players){p.x=p.team===team?dir*-5:dir*20;p.z=(p.index-5)*5;}const o=m.players[team*11+6];o.x=dir*0;o.z=0;m.owner=o;});teamPlan(m,team);m.aiPlans[team].kind='build';const p=m.players[team*11+7];p.workRate=workRate;return supportShape(m,p,m.owner).x*m.direction(team);};
 assert.ok(Math.abs(support({attack:'high',defence:'mid'})-support({attack:'mid',defence:'mid'})-TRAIT_AI.attackPush.MID)<1e-9);
 assert.ok(support({attack:'low',defence:'mid'})<support({attack:'mid',defence:'mid'}));
});

test('AI traits never steer the player a person controls',()=>{
 const m=new DuelMatch({halfSeconds:60});m.start(false);const p=m.selected(0);p.traits=['playmaker','teamPlayer','soloPlay','speedDribbler','slideTackler'];
 assert.equal(m.isHumanControlled(p),true);assert.equal(aiTrait(m,p,'soloPlay'),false);assert.equal(decisionScale(m,p,1),1);
 assert.deepEqual(passLean(m,p,{space:9}),{carry:0,pressure:2.2,minimum:0});
 m.physics.reset(p.x+Math.sin(p.yaw)*1.4,p.z+Math.cos(p.yaw)*1.4);m.owner=m.players[15];assert.equal(slideLunge(m,p,m.owner),false);assert.equal(p.action,null);
 // A human's carrier is never given an AI target or decision, even with every AI trait.
 m.withSeat(0,()=>{m.owner=p;m.state='playing';m.aiClock=0;m.step(1/120);});assert.notEqual(p.aiState,'CARRY');
 const other=m.players.find(q=>q.team===0&&q!==p&&q.role!=='GK');other.traits=['soloPlay'];assert.equal(aiTrait(m,other,'soloPlay'),true);
});

test('general traits: sliding reach and fouls, headers, far-post finesse, stamina and work-rate cost',()=>{
 const plain={traits:[]},slider={traits:['slideTackler']};
 assert.equal(tackleReach(plain,true),1);assert.equal(tackleReach(slider,false),1);assert.equal(tackleReach(slider,true),TRAIT_PLAY.slide.reach);assert.ok(foulTolerance(slider,true)<1);
 assert.equal(staminaDrain({traits:[],workRate:{attack:'mid',defence:'mid'}}),1);assert.equal(staminaDrain({}),1);
 assert.ok(staminaDrain({traits:['tireless'],workRate:{attack:'mid',defence:'mid'}})<1);
 assert.ok(staminaDrain({traits:[],workRate:{attack:'high',defence:'high'}})>staminaDrain({traits:[],workRate:{attack:'high',defence:'mid'}}));
 assert.ok(staminaDrain({traits:[],workRate:{attack:'low',defence:'low'}})<1);
 for(const team of [0,1])for(const half of [1,2]){const m=new Match({...defaults});m.half=half;const dir=m.direction(team),p={team,traits:['finesse','powerHeader']},b={x:dir*36,y:.11,z:10};
  const far={type:'shoot',aim:{x:dir*.78,z:-.62}},near={type:'shoot',aim:{x:dir*.9,z:-.43}};
  assert.equal(farPostShot(m,p,far,b),true);assert.equal(farPostShot(m,p,near,b),false);
  assert.deepEqual(kickTraits(m,p,far,b),{error:TRAIT_PLAY.finesse.error,speed:1,curve:TRAIT_PLAY.finesse.curve});
  assert.deepEqual(kickTraits(m,{team,traits:[]},far,b),{error:1,speed:1,curve:1});
  const header=kickTraits(m,p,{type:'pass',aerial:true,aim:{x:dir,z:0}},{x:0,y:1.6,z:0});assert.equal(header.speed,TRAIT_PLAY.header.speed);assert.ok(header.error<1);}
 // Work-rate support pushes are mirrored for both directions by construction (metres along the attack).
 assert.equal(attackPush({role:'FWD',workRate:{attack:'mid'}}),0);
});

test('online matches with traits stay deterministic: two rooms fed the same inputs send the same snapshots',()=>{
 const play=()=>{let now=10000,id=0;const room=new Room({code:'ABCD2345',now:()=>now,random:()=>`t-${++id}`}),data=defaultSquads();
  const home=lineupProfiles(data,0),away=lineupProfiles(data,1);home[9].traits=['runner','soloPlay'];away[2].traits=['slideTackler'];away[0].traits=['sweeper','crossClaimer'];
  const a=room.reserve('A',true,home),b=room.reserve('B',false,away),out=[[],[]];room.connect(a.token,x=>out[0].push(JSON.stringify(x)));room.connect(b.token,x=>out[1].push(JSON.stringify(x)));
  for(const t of [0,1])room.message(t,{type:'ready',ready:true});room.message(0,{type:'start'});
  for(let i=0;i<120;i++){now+=50;for(const t of [0,1])room.message(t,{type:'input',seq:i,input:{axis:{x:Math.sin(i*.1+t),z:Math.cos(i*.07)},sprint:i%3===0}});room.tick();}
  return out;};
 const first=play(),second=play();
 assert.deepEqual(first[0].filter(m=>m.includes('"snapshot"')),first[1].filter(m=>m.includes('"snapshot"')));
 assert.deepEqual(first[0],second[0]);
});
