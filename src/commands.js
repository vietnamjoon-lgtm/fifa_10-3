import {safeAutoTackle} from './auto-defence.js';
import {createPassFlight} from './guided-pass.js';
import {SETPIECE_STYLES} from './setpiece-styles.js';
import {skillAction} from './skills.js';
import {resolveGesture,relativeDir} from './skill-moves.js';
import {runTarget} from './control-assist.js';
import {clamp,distance} from './config.js';
import {choosePass} from './ai.js';
import {offsideSnapshot} from './rules.js';

export function controlContext(match){
 const p=match.controlled,b=match.physics.ball.position;
 return {setPiece:match.setPiece?.kind,keeperHolding:match.heldBy?.team===match.settings.userTeam,
  attack:!!(match.practice||match.setPiece?.team===match.settings.userTeam||match.owner?.team===match.settings.userTeam||!match.owner&&(match.lastTouchTeam===match.settings.userTeam||distance(p,b)<1.2))};
}

export function keeperRelease(m,type,options={}){
 const p=m.heldBy;if(!p||p.team!==m.settings.userTeam)return;
 const target=choosePass(m,p,m.input.axis,'pass');
 const aim=target?{x:target.x-p.x,z:target.z-p.z}:{x:m.direction(p.team),z:-p.z*.03};
 m.heldBy=null;m.owner=null;m.lastTouch=p;m.lastTouchTeam=p.team;m.lastTouchKind='keeper';m.offside=offsideSnapshot(m,p);m.lock=.18;p.touchCooldown=.4;
 m.physics.kick(aim,type==='keeperDrop'?1:type==='keeperPass'?(options.driven?18:12):22,type==='keeperKick'?6:type==='keeperPass'?1.2:0);
 m.passFlight=target&&type==='keeperPass'?createPassFlight(m,p,{receiver:target.player,type:'pass',distance:distance(p,target.player)}):null;
 if(target&&type==='keeperPass'){m.selectControlled(target.player,'pass');m.receiving={player:target.player,expires:m.time+3};}
 m.emit('kick',{player:p,type:type==='keeperKick'?'lob':'pass',power:.5});
}

export function executeCommand(m,action,options={}){
 if(m.state!=='playing')return;
 const p=m.controlled;if(!p?.active)return;
 if(action==='setpieceStyle'&&m.setPiece?.kind==='free'&&m.setPiece.team===p.team&&Object.hasOwn(SETPIECE_STYLES,options.style)){m.setPiece.style=options.style;m.emit('command',{text:SETPIECE_STYLES[options.style]});return;}
 if(m.setPiece&&m.setPiece.taker!==p)return;
 if(m.setPiece&&['switch','tackle','slide','skill','knock'].includes(action))return;
 if(action==='switch'){m.switchPlayer();return;}
 if(action.startsWith('keeper')){keeperRelease(m,action,options);return;}
 if(action==='cancel'||action==='fake'){
  m.charging=false;m.charge=0;p.intent=null;
  if(p.action?.hit||p.action?.commitTime)return;
  // A shot or pass fake with a direction is a scoop turn, heel chop or rabona fake when the player has the stars for it.
  if(action==='fake'&&m.owner===p&&!p.action){const move=gestureMove(m,p,{special:'fake',mods:options.mods});if(move){startMove(m,p,move);return;}}
  p.action=action==='fake'&&m.owner===p?{type:'feint',elapsed:0,hit:false}:null;
  return;
 }
 if(action==='lowShot'){if(p.action?.type==='shoot'&&!p.action.hit)p.action.low=true;return;}
 if(action==='crossType'){if(p.action?.type==='lob'&&!p.action.hit){p.action.groundCross=options.ground;p.action.lowCross=options.low;}return;}
 if(action==='charge'){if(p.action)return;m.charging=true;m.charge=0;m.chargeOptions={...options};return;}
 if(action==='shoot'){
  if(m.charging)m.requestKick(p,'shoot',Math.max(.12,m.charge),{...m.chargeOptions,...options});
  m.charging=false;m.charge=0;return;
 }
 if(['pass','through','lob'].includes(action)){
  if(m.setPiece?.kind==='throw'){throwIn(m,action,options);return;}
  m.requestKick(p,action,.5,options);return;
 }
 if(action==='tackle'||action==='slide'){
  if(options.automatic&&!safeAutoTackle(m,p))return;
  const b=m.physics.ball.position;
  if(action==='tackle'&&b.y>.65&&distance(p,b)<1.1)m.queueKick(p,'shoot',.65,{x:m.direction(p.team)*25,z:0},null,{clearance:true});
  else m.tackle(p,action==='slide');return;
 }
 if(action==='run'||action==='support'){
  const pass=choosePass(m,p,Math.hypot(m.input.axis?.x||0,m.input.axis?.z||0)>.2?m.input.axis:null);
  if(pass){pass.player[action==='run'?'runUntil':'supportUntil']=m.time+2.8;if(action==='run')pass.player.runTarget=runTarget(m,pass.player);m.aiClock=0;m.emit('command',{text:action==='run'?'동료 침투 요청':'동료 지원 요청'});}
  if(action==='run'&&Math.hypot(m.input.axis?.x||0,m.input.axis?.z||0)<.1)p.yaw=Math.atan2(m.direction(p.team)*52.5-p.x,-p.z);
  return;
 }
 // FC Online skill-move inputs (skill-input gestures, Z + direction, C + Z, Q taps, the ` key) resolved for this player.
 if(action==='skill'&&(options.gesture||options.special||options.plain)){
  const move=m.owner===p&&!p.action&&p.cooldown<=0&&distance(p,m.physics.ball.position)<(options.special==='q-tap'?9:1.12)?gestureMove(m,p,options):null;
  if(move){startMove(m,p,move);return;}
  if(options.special==='q-tap'&&m.owner!==p)executeCommand(m,'run');
  return;
 }
 if((action==='knock'||action==='skill')&&m.owner===p&&!p.action&&p.cooldown<=0&&distance(p,m.physics.ball.position)<1.12){
  const axis=m.input.axis||{x:Math.sin(p.yaw),z:Math.cos(p.yaw)},n=Math.hypot(axis.x,axis.z);if(n<.1)return;
  if(action==='skill'){p.action=skillAction(p,axis,++m.actionId,options.skill);p.cooldown=p.action.duration+.12;return;}m.physics.kick(axis,Math.max(5,Math.hypot(p.vx,p.vz)+3),.03);
  p.touchCooldown=action==='knock'?.35:.12;p.cooldown=.35;m.lastTouch=p;m.lastTouchTeam=p.team;m.lastTouchKind='touch';
  if(action==='knock'){m.owner=null;m.lock=.13;}else p.action={type:'feint',elapsed:0,hit:false};
 }
}

export function throwIn(m,type,options={}){
 const p=m.setPiece?.taker;if(!p)return;
 const pass=choosePass(m,p,m.input.axis,type==='lob'?'lob':'pass'),dir=m.direction(p.team);
 const aim=pass?{x:pass.x-p.x,z:pass.z-p.z}:{x:dir*.5,z:-Math.sign(p.z||1)};
 // A throw must travel into the field; keep its vertical component physical.
 if(aim.z*Math.sign(p.z)>0)aim.z=-aim.z;
 m.physics.kick(aim,type==='lob'?16:9,type==='lob'?5:2.6);m.owner=null;m.setPiece=null;m.offside.clear();
 m.lastTouch=p;m.lastTouchTeam=p.team;m.lastTouchKind='throw';m.restartOrigin={kind:'throw',player:p.id,team:p.team};m.lock=.2;p.touchCooldown=.5;
 m.passFlight=pass?createPassFlight(m,p,{receiver:pass.player,type:type==='lob'?'lob':'pass',distance:distance(p,pass.player)}):null;
 if(pass&&p.team===m.settings.userTeam){m.selectControlled(pass.player,'pass');m.receiving={player:pass.player,expires:m.time+4};}
 m.emit('kick',{player:p,type:'lob',power:.5});
}

/** The table move for an input: screen arrow directions are turned into directions relative to the player's attack. */
function gestureMove(m,p,options){
 const d=m.direction(p.team),axis=m.input.axis||{x:0,z:0},g={mods:options.mods||{},special:options.special||null,end:options.gesture?.end||0};
 if(options.gesture)g.events=options.gesture.events.map(e=>({t:e.t,dir:relativeDir(e.x,e.z,d)}));
 if(options.plain)g.plain=relativeDir(options.plain.x,options.plain.z,d);
 // A fake takes its side from the stick: to the left or right of the attack, or back.
 if(g.special==='fake'){const r=relativeDir(Math.abs(axis.x)>.35?Math.sign(axis.x):0,Math.abs(axis.z)>.35?Math.sign(axis.z):0,d);g.side=r&&r.includes('R')?'R':r&&r.includes('L')?'L':r==='B'?'B':null;}
 return resolveGesture(g,p);
}
function startMove(m,p,move){
 const axis=m.input.axis&&Math.hypot(m.input.axis.x,m.input.axis.z)>.1?m.input.axis:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 p.action=skillAction(p,axis,++m.actionId,move.key);p.cooldown=p.action.duration+.12;m.emit('command',{text:move.label});
}
