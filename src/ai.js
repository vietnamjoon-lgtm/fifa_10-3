import {KEEPER} from './keeper-tuning.js';
import {activePass,interceptPoint} from './ball-assistance.js';
import {keeperProfile} from './attributes.js';
import {clamp,distance,TUNING} from './config.js';
import {passTarget} from './assists.js';
import {offsideSnapshot} from './rules.js';
export function laneClear(a,b,opponents){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;let danger=0;for(const p of opponents){const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1);if(t>.05&&t<.95){const d=Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);danger+=Math.max(0,3.3-d);}}return danger;}
export function choosePass(match,p,aim,type='pass'){
 const opponents=match.players.filter(q=>q.active&&q.team!==p.team),dir=match.direction(p.team),offside=offsideSnapshot(match,p);let best=null,score=-Infinity;
 const magnitude=aim?Math.hypot(aim.x,aim.z):0;
 for(const q of match.players){if(q===p||!q.active||q.down>0||q.team!==p.team||offside.has(q.id))continue;const d=distance(p,q);if(d<2||d>(type==='lob'?48:38))continue;const dx=(q.x-p.x)/d,dz=(q.z-p.z)/d;const alignment=magnitude>.1?(dx*aim.x+dz*aim.z)/magnitude:dx*dir*.6;if(magnitude>.1&&alignment<.4)continue;const pressure=Math.min(9,...opponents.map(r=>distance(q,r)));const lane=laneClear(p,q,opponents);const value=alignment*24+(magnitude>.1?0:(q.x-p.x)*dir*.25)+pressure-lane*3-d*.22;
 if(value>score){best=q;score=value;}}
 return best?passTarget(match,p,best,type):null;
}
export function updateTeamAI(match){
 if(match.setPiece)return;
 const b=match.physics.ball.position,owner=match.owner;
 for(const team of [0,1]){
 const dir=match.direction(team),flight=activePass(match),hasBall=owner?.team===team||flight?.team===team;
 const assistance=match.assistanceForTeam?.(team)||match.settings;
 const candidates=match.players.filter(p=>p.active&&p.team===team&&p.role!=='GK'&&(!match.isHumanControlled(p)||assistance.looseBallAssist!==false&&Math.hypot(match.inputForTeam(p.team).axis?.x||0,match.inputForTeam(p.team).axis?.z||0)<.12)).sort((a,c)=>distance(a,b)-distance(c,b));const chaser=flight?.team===team?match.players.find(p=>p.id===flight.receiver):candidates[0];
 // A second defender closes the carrier down from the goal side once the ball is in or near our half,
 // so a single presser is not the only resistance to a dribble.
 const cover=owner&&owner.team!==team&&owner.x*dir<12?candidates.filter(p=>p!==chaser&&!match.isHumanControlled(p)&&(owner.x-p.x)*dir>-1).sort((a,c)=>distance(a,owner)-distance(c,owner))[0]:null;
 for(const p of match.players){if(!p.active||p.team!==team||match.isHumanControlled(p))continue;
 if(p.role==='GK'){keeperTarget(match,p);continue;}
 if(!owner&&flight?.receiver===p.id){if(flight.follow){p.aiState='HOLD PASS LANE';p.target={...flight.runTarget};p.sprinting=p.runUntil>match.time;continue;}const target=interceptPoint(match,p);if(target){p.aiState='MEET PASS';p.target=target;p.sprinting=distance(p,target)>2.2;continue;}}
 if(owner!==p&&p.runUntil>match.time){p.aiState='RUN';p.target=p.runTarget||{x:clamp(p.x+dir*10,-49,49),z:p.z};p.sprinting=true;continue;}
 if(owner!==p&&p.supportUntil>match.time&&owner?.team===team){p.aiState='SUPPORT CALL';p.target={x:owner.x-dir*5,z:owner.z+Math.sign(p.z-owner.z||1)*5};p.sprinting=false;continue;}
 if(owner===p){p.aiState='CARRY';p.target={x:dir*51,z:p.z*.83};p.sprinting=true;
 const pressure=Math.min(...match.players.filter(q=>q.active&&q.team!==team).map(q=>distance(p,q)));
 if(match.time>p.nextDecision&&!p.action){p.nextDecision=match.time+(match.settings.difficulty==='hard'?.55:match.settings.difficulty==='easy'?1.15:.8);
 const goalDistance=52.5-p.x*dir;
 if(goalDistance<24&&Math.abs(p.z)<16){const targetZ=clamp(-Math.sign(match.players.find(q=>q.team!==team&&q.role==='GK')?.z||1)*2.1+p.z*.04,-2.7,2.7);match.queueKick(p,'shoot',.56+match.random()*.25,{x:dir*52.5-p.x,z:targetZ-p.z});}
 else if(pressure<2.8||match.random()<.13){const type=match.random()>.6?'through':'pass',pass=choosePass(match,p,null,type);if(pass)match.queueKick(p,Math.abs(p.z)>24&&goalDistance<28?'lob':type,.5,{x:pass.x-p.x,z:pass.z-p.z},pass.player);}
 }
 }else if(p===cover){p.aiState='CLOSE DOWN';const gx=-dir*52.5,dx=gx-owner.x,dz=-owner.z,n=Math.hypot(dx,dz)||1,gap=clamp(distance(p,owner)*.35,1.6,3);p.target={x:owner.x+dx/n*gap,z:owner.z+dz/n*gap};p.sprinting=distance(p,p.target)>2;if(distance(p,b)<.95&&p.cooldown<=0&&match.random()<.2)match.tackle(p);}
 else if(p===chaser&&(!hasBall||!owner)){p.aiState='PRESS';const target=interceptPoint(match,p);p.target=target||{x:b.x,z:b.z};p.sprinting=distance(p,b)>7;if(owner&&owner.team!==team&&distance(p,b)<.95&&p.cooldown<=0&&match.random()<.28)match.tackle(p);}
 else {p.aiState=hasBall?'SUPPORT':'COVER';const progress=b.x*dir,shift=clamp(progress*.5+(hasBall?20:7),-10,36);let x=(p.homeX+shift)*dir,z=p.homeZ+b.z*.19;
 if(hasBall&&p.role==='FWD'){x=clamp((progress+12)*dir,-46,46);z=p.homeZ*.88+b.z*.12;}
 if(hasBall&&p.role==='MID'&&owner){x=owner.x-dir*(p.index%2?7:12);z=owner.z+(p.homeZ<0?-11:11);}
 if(!hasBall&&p.role==='DEF'){x=dir*clamp(progress-10,-42,-10);z=p.homeZ*.65+b.z*.45;}
 p.target={x:clamp(x,-49,49),z:clamp(z,-30,30)};p.sprinting=distance(p,p.target)>15;}
 }
 }
}
export function keeperTarget(match,p){const b=match.physics.ball.position,v=match.physics.ball.velocity,dir=match.direction(p.team),goalX=-dir*51;
 if(match.inputForTeam(p.team).keeperRush&&!match.heldBy){p.aiState='RUSH';p.target={x:clamp(b.x,-51,51),z:clamp(b.z,-30,30)};p.sprinting=true;return;}
 p.aiState='KEEPER SET';let tx=goalX+dir*1.3,tz=clamp(b.z*.115,-2.75,2.75);
 if(b.x*dir<-32&&Math.abs(b.z)<18){tx=goalX+dir*clamp((52.5+b.x*dir)*.19,1,5);tz=clamp(b.z*.25,-3.3,3.3);}
 const toward=v.x*dir<-.5,arrival=(goalX-b.x)/(v.x||.001);
 const keeper=keeperProfile(p);
 if(!toward||arrival<=0||match.lastTouchTeam===p.team)p.keeperRead=null;
 if(toward&&arrival>0&&arrival<1.5&&match.lastTouchTeam!==p.team&&match.time-match.lastKickTime>keeper.reaction){
  // Commit to the observed shot instead of tracking its future destination perfectly.
  // Read where the ball crosses the keeper's own line, not the goal line: an angled shot moves sideways in between.
  if(!p.keeperRead||p.keeperRead.kickTime!==match.lastKickTime){const travel=Math.max(.01,(p.x-b.x)/(v.x||.001)),error=(match.random()-.5)*(KEEPER.readError+(1-p.reflexes)*KEEPER.readErrorReflex);p.keeperRead={kickTime:match.lastKickTime,at:match.time+travel,z:b.z+v.z*travel+error,height:clamp(b.y+v.y*travel-4.905*travel*travel,.18,2.25)};}
  const read=p.keeperRead;tz=clamp(read.z,-3.45,3.45);p.intercept={x:p.x,z:read.z};
  if(read.at-match.time<KEEPER.diveTriggerTime&&Math.abs(tz-p.z)>KEEPER.diveTriggerDistance&&p.dive<=0&&p.cooldown<=0){p.dive=p.diveDuration=KEEPER.diveDuration;p.diveDirection=Math.sign(tz-p.z);p.diveHeight=read.height;p.cooldown=KEEPER.diveCooldown;p.aiState='DIVE';}
 }
 if(p.dive>0){tx=p.x;tz=p.z;}p.target={x:tx,z:tz};p.sprinting=false;
}
