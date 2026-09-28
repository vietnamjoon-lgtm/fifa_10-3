import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {Input} from '../src/input.js';
import {executeCommand} from '../src/commands.js';
import {MOVES,MOVE_BY_KEY,autoMove} from '../src/skill-moves.js';
import {SKILLS,skillAction} from '../src/skills.js';
import {safeAutoTackle} from '../src/auto-defence.js';

const dt=1/120;
/** The user's dribbler at (-20·d, 5) with the ball, all other players off the pitch except `defender` (an AI opponent)
 * when asked, which is placed `gap` metres ahead facing him. */
function rig({seed=5,defender=false,run=true,gap=14}={}){
 const m=new Match({...defaults,seed},()=>{});m.start(false);m.state='playing';m.lock=0;m.time=3;
 const p=m.controlled,d=m.direction(p.team),opp=defender?m.players.find(q=>q.team!==p.team&&q.role!=='GK'):null;
 for(const q of m.players){q.active=q===p||q===opp;q.action=null;if(!q.active)q.x=q.z=200;}
 p.x=-20*d;p.z=5;p.vx=p.vz=0;p.yaw=d*Math.PI/2;p.skillMoves=5;p.cooldown=p.touchCooldown=0;m.owner=p;p.possessedAt=m.time;m.physics.reset(p.x+d*.4,5,.11);
 if(opp){opp.x=p.x+d*gap+(seed%3-1)*.4;opp.z=5+(seed%5-2)*.3;opp.yaw=-d*Math.PI/2;}
 const input={axis:run?{x:d,z:0}:{x:0,z:0}};return {m,p,d,opp,input};
}
const gapOf=(m,p)=>{const b=m.physics.ball.position;return Math.hypot(b.x-p.x,b.z-p.z);};
/** Runs up (until the defender is `trigger` metres away, or 100 steps), plays `key`, then keeps the stick held (hold) or lets it go. */
function perform(key,{mode='run',hold=true,defender=false,seed=5,trigger=4}={}){
 const {m,p,d,opp,input}=rig({seed,defender,run:mode==='run',gap:mode==='run'?14:5});
 for(let i=0;i<(mode==='run'?600:40);i++){m.step(dt,input);if(opp?Math.hypot(opp.x-p.x,opp.z-p.z)<trigger&&i>30:mode==='run'&&i>=100)break;}
 const facing=mode==='run'?{x:d,z:0}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)},a=p.action=skillAction(p,facing,++m.actionId,key);p.cooldown=a.duration+.12;
 const after=hold&&mode==='run'?input:{axis:{x:0,z:0}};m.input=after;let t=0,endGap=null,end=null;
 while(t<5){m.step(dt,after);t+=dt;if(p.action!==a&&end===null){end=t;endGap=gapOf(m,p);}if(end!==null&&t>end+1.2)break;}
 return {m,p,endGap,kept:m.owner===p||!m.owner&&m.lastTouch===p&&gapOf(m,p)<1.2};
}
const KEYS=[...MOVES.map(m=>m.key),...Object.keys(SKILLS)];

test('with nobody near, every skill ends with the ball at the feet whether the stick stays held or is let go',()=>{
 for(const key of KEYS)for(const mode of ['stand','run'])for(const hold of [true,false]){const state=MOVE_BY_KEY[key]?.state;if(state&&state!==mode||mode==='stand'&&!hold)continue;
  const {endGap,kept}=perform(key,{mode,hold});
  assert.ok(endGap<1.6,`${key} ${mode} ${hold?'held':'released'}: ball ${endGap.toFixed(2)} m away when the move ended`);
  assert.ok(kept,`${key} ${mode} ${hold?'held':'released'}: lost the ball`);}
});

test('a skill move wrong-foots an AI defender in front: he steps aside and cannot tackle until after the exit touch',()=>{
 const {m,p,d,opp,input}=rig({defender:true});
 for(let i=0;i<600&&Math.hypot(opp.x-p.x,opp.z-p.z)>=4;i++)m.step(dt,input);
 p.action=skillAction(p,{x:d,z:0},++m.actionId,'fco-feint-exit:right');m.step(dt,input);
 assert.ok(opp.beaten&&opp.beaten.until>m.time+.3,'defender wrong-footed');
 // The move exits to the player's right, so the defender is sent the other way (the player's left).
 const right={x:-Math.cos(p.yaw),z:Math.sin(p.yaw)};assert.ok(opp.beaten.dir.x*right.x+opp.beaten.dir.z*right.z<-.9);
 assert.equal(safeAutoTackle(m,opp),false);
 // The same defender is not fooled again straight away.
 const until=opp.beaten.until;p.action=skillAction(p,{x:d,z:0},++m.actionId,'fco-body-feint:left');m.step(dt,input);assert.equal(opp.beaten.until,until);
});

test('against one AI defender, cut-away skills keep the ball far more often than running straight at him',()=>{
 let lost=0,runs=0,straight=0;
 for(const seed of [3,5,7,11,13,17]){
  for(const key of ['fco-body-feint:right','fco-feint-exit:left','fco-ball-roll-cut:right','fco-elastico:left','fco-step-over:right']){runs++;if(!perform(key,{defender:true,seed}).kept)lost++;}
  // Baseline: no skill at all, straight into him.
  const {m,p,opp,input}=rig({defender:true,seed});for(let i=0;i<600&&Math.hypot(opp.x-p.x,opp.z-p.z)>=4;i++)m.step(dt,input);for(let i=0;i<260;i++)m.step(dt,input);if(m.owner!==p)straight++;
 }
 assert.ok(lost<=runs*.12,`skills lost the ball ${lost}/${runs} times`);assert.ok(straight>=2,`running straight lost ${straight}/6`);
});

test('an F tap on its own plays a move picked for the player; 1~7 alone play the numbered skills',()=>{
 let clock=0;const emitted=[];const input=new Input({controls:'modern',defence:'basic'},(action,options)=>emitted.push({action,options}),()=>({attack:true}),{now:()=>clock*1000,target:null,getPads:()=>[]});input.enabled=true;
 const wait=s=>{const end=clock+s;while(clock<end-1e-9){clock+=1/120;input.poll();}};
 input.keyDown('KeyF');wait(.1);input.keyUp('KeyF');assert.deepEqual(emitted.at(-1),{action:'skill',options:{special:'auto'}});
 // A long hold with no arrow is not a tap.
 emitted.length=0;input.keyDown('KeyF');wait(.5);input.keyUp('KeyF');assert.equal(emitted.length,0);
 input.keyDown('Digit3');assert.deepEqual(emitted.at(-1),{action:'skill',options:{skill:Object.keys(SKILLS)[2]}});
 const {m,p}=rig({run:false});m.input={axis:{x:0,z:0}};executeCommand(m,'skill',{special:'auto'});assert.ok(p.action?.move,'a move started');
});

test('the picked move cuts away from the defender in front, turns on a stick held back and suits the stars',()=>{
 const p={x:0,z:0,yaw:Math.PI/2,vx:0,vz:0,skillMoves:5};// facing +x; the player's right is +z
 assert.equal(autoMove(p,[{x:3,z:.8}]).key,'fco-elastico:left');
 assert.equal(autoMove(p,[{x:3,z:-.8}]).key,'fco-elastico:right');
 assert.equal(autoMove({...p,skillMoves:3},[{x:3,z:.8}]).key,'fco-feint-exit:left');
 assert.equal(autoMove({...p,skillMoves:1},[]).key,'fco-no-touch-feint');
 // The stick leaning to one side wins over the defender's position.
 assert.equal(autoMove(p,[{x:3,z:-.8}],{x:.5,z:.8}).key,'fco-elastico:right');
 assert.equal(autoMove(p,[{x:3,z:.8}],{x:.5,z:.8}).key,'fco-elastico:right');
 assert.equal(autoMove({...p,skillMoves:2},[],{x:-1,z:0}).key,'fco-drag-back');
 assert.equal(autoMove(p,[],{x:-1,z:0}).key.startsWith('fco-drag-back-spin'),true);
});
