import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {Input} from '../src/input.js';
import {executeCommand} from '../src/commands.js';
import {MOVES,HOLD} from '../src/skill-moves.js';
import {skillAction} from '../src/skills.js';

// Keyboard arrows for directions relative to a team attacking toward +x (the guide's "left to right" view).
const ARROWS={F:['ArrowRight'],B:['ArrowLeft'],L:['ArrowUp'],R:['ArrowDown'],FL:['ArrowRight','ArrowUp'],FR:['ArrowRight','ArrowDown'],BL:['ArrowLeft','ArrowUp'],BR:['ArrowLeft','ArrowDown']};
const MOD_KEYS={q:'KeyQ',c:'KeyC',z:'KeyZ',e:'KeyE'};

/** Plays a move's keyboard input through the real Input and returns the emitted command options. */
function play(move){
 let clock=0;const emitted=[];
 const input=new Input({controls:'modern',defence:'basic'},(action,options)=>emitted.push({action,options}),()=>({attack:true}),{now:()=>clock*1000,target:null,getPads:()=>[]});
 input.enabled=true;
 const wait=s=>{const end=clock+s;while(clock<end-1e-9){clock=Math.min(end,clock+1/120);input.poll();}};
 const down=c=>input.keyDown(c),up=c=>input.keyUp(c),held=new Set();
 const moveTo=dir=>{const want=new Set(dir?ARROWS[dir]:[]);for(const k of want)if(!held.has(k)){down(k);held.add(k);}for(const k of [...held])if(!want.has(k)){up(k);held.delete(k);}};
 const k=move.keys,mods=(k.mods||'').split('').filter(Boolean);
 for(const m of mods)down(MOD_KEYS[m]);wait(.05);
 if(k.special==='z-tap'){down('KeyZ');wait(.08);up('KeyZ');}
 else if(k.special==='z-hold'){down('KeyZ');wait(HOLD+.1);up('KeyZ');}
 else if(k.special==='backquote'){down('Backquote');wait(.05);up('Backquote');}
 else if(k.special==='q-tap'){down('KeyQ');wait(.1);up('KeyQ');}
 else if(k.plain){for(const a of ARROWS[k.plain])down(a);wait(.08);for(const a of ARROWS[k.plain])up(a);}
 else{
  down('ShiftLeft');wait(.04);
  if(k.sweep){for(const d of k.sweep){moveTo(d);wait(.05);}moveTo(null);}
  if(k.hold){moveTo(k.hold);wait(HOLD+.12);moveTo(null);}
  if(k.taps)for(const t of k.taps){const hold=t.startsWith('hold:');moveTo(hold?t.slice(5):t);wait(hold?HOLD+.08:.07);moveTo(null);wait(.07);}
  if(k.holds){moveTo(k.holds[0]);wait(HOLD+.08);moveTo(null);moveTo(k.holds[1]);wait(HOLD+.08);moveTo(null);}
  if(k.holdTap){moveTo(k.holdTap[0]);wait(HOLD+.08);for(const a of ARROWS[k.holdTap[1]])down(a);wait(.07);for(const a of ARROWS[k.holdTap[1]])up(a);moveTo(null);}
  wait(.25);up('ShiftLeft');
 }
 wait(.05);for(const m of mods)up(MOD_KEYS[m]);
 return emitted.filter(e=>e.action==='skill').map(e=>e.options);
}

function player(move,team=0){
 const m=new Match({...defaults,userTeam:team,seed:3});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;const p=m.controlled,d=m.direction(team);
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-10*d;p.z=0;p.yaw=d*Math.PI/2;p.skillMoves=move.stars;p.vx=move.state==='run'?5*d:0;p.vz=0;
 m.setPiece=null;p.cooldown=0;m.physics.reset(p.x+d*.45,0);m.owner=p;m.lastTouch=p;m.input={axis:{x:0,z:0}};return {m,p,d};
}

test('every move in the official skill table is performed by its keyboard input, for both attack directions',()=>{
 const covered=[];
 for(const move of MOVES){if(move.keys.special==='fake')continue;
  for(const team of [0,1]){const {m,p,d}=player(move,team);
   let options=play(move);
   // The recorded screen arrows are for a team attacking toward +x; mirror them for the other end.
   if(d<0)options=options.map(o=>({...o,gesture:o.gesture&&{...o.gesture,events:o.gesture.events.map(e=>({...e,x:-e.x,z:-e.z}))},plain:o.plain&&{x:-o.plain.x,z:-o.plain.z}}));
   assert.ok(options.length>=1,`${move.label}: no skill input`);
   executeCommand(m,'skill',options[options.length-1]);
   assert.equal(p.action?.move,move.key,`${move.label} (${move.stars}★, team ${team}) gave ${p.action?.move??'nothing'}`);}
  covered.push(move.key);}
 assert.ok(covered.length>=60,`${covered.length} moves covered`);
});

test('fakes with a direction become scoop turns, heel chops and rabona fakes at the right stars',()=>{
 for(const move of MOVES.filter(x=>x.keys.special==='fake')){
  const {m,p,d}=player(move),side=move.keys.side,axis={x:side==='B'?-d:0,z:side==='R'?d:side==='L'?-d:0};
  m.input={axis};executeCommand(m,'fake',{mods:{c:(move.keys.mods||'').includes('c')}});
  assert.equal(p.action?.move,move.key,`${move.label} gave ${p.action?.move??p.action?.type??'nothing'}`);
  const low=player({...move,stars:move.stars-1});low.m.input={axis};executeCommand(low.m,'fake',{mods:{c:(move.keys.mods||'').includes('c')}});
  assert.notEqual(low.p.action?.move,move.key,`${move.label} must need ${move.stars} stars`);
 }
});

test('a player without enough stars gets the lower move for the same input, or none',()=>{
 const elastico=MOVES.find(m=>m.key==='fco-elastico:left'),feint=MOVES.find(m=>m.key==='fco-feint-exit:left'),knock=MOVES.find(m=>m.key==='fco-feint-knock:left');
 for(const [stars,want] of [[2,undefined],[3,feint.key],[4,knock.key],[5,elastico.key]]){const {m,p}=player({...elastico,stars});executeCommand(m,'skill',play(elastico).at(-1));assert.equal(p.action?.move,want,`${stars} stars`);}
});

test('holding SHIFT keeps the run going while the arrows are read as the move',()=>{
 let clock=0;const input=new Input({controls:'modern'},()=>{},()=>({attack:true}),{now:()=>clock*1000,target:null,getPads:()=>[]});input.enabled=true;
 input.keyDown('ArrowRight');input.poll();assert.equal(input.axis.x,1);
 input.keyDown('ShiftLeft');input.keyDown('ArrowDown');input.poll();assert.deepEqual(input.axis,{x:1,z:0});
 input.keyUp('ArrowDown');clock=.4;input.poll();input.keyUp('ShiftLeft');input.poll();assert.deepEqual(input.axis,{x:1,z:0});
});

test('every table move plays out: its touches land, the player keeps or leads the ball and nothing goes non-finite',()=>{
 for(const move of MOVES){
  const {m,p}=player(move),events=[];m.physics.kick=(k=>(...a)=>{events.push(a[1]);return k(...a);})(m.physics.kick.bind(m.physics));
  p.action=skillAction(p,{x:Math.sin(p.yaw),z:Math.cos(p.yaw)},1,move.key);const a=p.action;
  for(let i=0;i<(move.duration+.4)*120;i++){m.step(1/120,{axis:{x:0,z:0}});
   assert.ok([p.x,p.z,p.yaw,m.physics.ball.position.x,m.physics.ball.position.y].every(Number.isFinite),`${move.label}: non-finite state`);}
  assert.ok(!a.failed,`${move.label}: a touch missed the ball`);assert.equal(a.events.filter(e=>e.done).length,move.touches.length,`${move.label}: touches played`);
  // Flicks over the head (rainbow) send the ball on ahead for the player to run onto; everything else stays close.
  const b=m.physics.ball.position,gap=Math.hypot(b.x-p.x,b.z-p.z),ahead=(b.x-p.x)*Math.sin(p.yaw)+(b.z-p.z)*Math.cos(p.yaw);
  assert.ok(gap<3||move.pose==='rainbow'&&m.lastTouch===p&&ahead>0&&gap<7,`${move.label}: ball ended ${gap.toFixed(2)} m away`);
 }
});
