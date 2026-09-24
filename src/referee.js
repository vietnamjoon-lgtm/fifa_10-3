import {FIELD,clamp,distance} from './config.js';
import {sweepCircle} from './collision-math.js';
import {foulThreshold} from './gameplay-settings.js';

export function inPenaltyArea(match,position,defendingTeam){
 const x=position.x*match.direction(defendingTeam);
 return x<=-36&&x>=-FIELD.halfLength&&Math.abs(position.z)<=20.16;
}

export function resetReferee(match){
 match.advantage=null;match.pendingCards=[];match.lastDecision=null;match.setPiece=null;match.restartOrigin=null;
 match.stoppageSeconds=0;match.addedTime=null;match.stats.yellows=[0,0];match.stats.reds=[0,0];
 for(const p of match.players){p.yellows=0;p.sentOff=false;p.runUntil=0;p.supportUntil=0;}
}

export function applyCard(match,p,card){
 if(!card||p.sentOff)return;
 if(card==='yellow'){p.yellows++;match.stats.yellows[p.team]++;}
 if(card==='red'||p.yellows>=2){
  p.sentOff=true;p.active=false;p.action=null;p.vx=p.vz=0;match.stats.reds[p.team]++;
  if(match.owner===p)match.owner=null;if(match.heldBy===p)match.heldBy=null;
  if(match.controlled===p){const replacement=match.players.filter(q=>q.active&&q.team===p.team).sort((a,b)=>distance(a,match.physics.ball.position)-distance(b,match.physics.ball.position))[0];if(replacement)match.controlled=replacement;}
  match.emit('card',{player:p,card:'red',secondYellow:card==='yellow'});
 }else match.emit('card',{player:p,card:'yellow'});
}
export function flushCards(match){for(const pending of match.pendingCards||[])applyCard(match,pending.player,pending.card);match.pendingCards=[];}

export function foul(match,offender,victim,{slide=false,relativeSpeed=0,ballAttempt=true,reason='무리한 태클'}={}){
 if(match.state!=='playing'||!victim.active||!offender.active)return;
 const penalty=inPenaltyArea(match,victim,offender.team),dir=match.direction(victim.team);
 const goalDistance=52.5-victim.x*dir;
 const covering=match.players.filter(p=>p.active&&p.team===offender.team&&p!==offender&&p.role!=='GK'&&p.x*dir>victim.x*dir&&Math.abs(p.z-victim.z)<9);
 const ball=match.physics.ball,nearBall=distance(victim,ball.position)<2.2,goingForward=Math.hypot(victim.vx,victim.vz)>.7?victim.vx*dir>.3:Math.sin(victim.yaw)*dir>.4;
 const controlled=match.owner===victim||nearBall&&match.lastTouch?.team===victim.team&&ball.velocity.x*dir>-1;
 const dogso=controlled&&goingForward&&goalDistance>0&&goalDistance<25&&Math.abs(victim.z)<14&&covering.length===0;
 const behind=(offender.x-victim.x)*Math.sin(victim.yaw)+(offender.z-victim.z)*Math.cos(victim.yaw)<-.2;
 const threshold=foulThreshold(match),serious=slide&&relativeSpeed>9||(slide&&behind&&relativeSpeed>7.5)||!ballAttempt&&relativeSpeed>11;
 let card=serious?'red':relativeSpeed>(slide?4.2:5.8)*threshold?'yellow':null;
 if(dogso)card=penalty&&ballAttempt&&!serious?'yellow':'red';
 const restart={kind:penalty?'penalty':'free',team:victim.team,x:clamp(victim.x,-52,52),z:clamp(victim.z,-33.5,33.5),label:(penalty?'페널티킥':'프리킥')+' · '+reason};
 match.stats.fouls[offender.team]++;victim.down=(slide?1.1:.55)*(1.3-.35*(victim.balance??.8));
 match.lastDecision={kind:'foul',offender:offender.id,victim:victim.id,card,penalty,dogso,reason,time:match.time};
 const b=match.physics.ball,shotContinues=match.lastTouch?.team===victim.team&&match.time-match.lastKickTime<1&&b.velocity.x*dir>8&&Math.abs(b.position.z)<14;
 const teammateContinues=match.owner?.team===victim.team&&match.owner!==victim;
 if(card!=='red'&&(!card||offender.yellows<1)&&(shotContinues||teammateContinues)){
  if(!match.advantage)match.advantage={restart,expires:match.time+2.2};
  if(card)match.pendingCards.push({player:offender,card});match.emit('advantage',{team:victim.team});
 }else{
  if(card)match.pendingCards.push({player:offender,card});match.beginRestart(restart);
 }
}

export function updateAdvantage(match){
 const a=match.advantage;if(!a)return;
 if(match.owner&&match.owner.team!==a.restart.team){match.advantage=null;match.beginRestart(a.restart);return;}
 if(match.time>=a.expires){match.advantage=null;}
}

export function resolveTackle(match,p,action){
 const b=match.physics.ball.position,slide=action.type==='slide',range=(slide?1.7:1.25)*(.8+.24*(p.tackling??.8));
 const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 const alignment=d?((dx*f.x+dz*f.z)/d):1;
 const end={x:p.x+f.x*range,z:p.z+f.z*range},ballHit=b.y<.7?sweepCircle(p,end,b,slide?.25:.23):null;
 const contacts=match.players.filter(q=>q.active&&q.team!==p.team&&q.down<=0).map(q=>({q,t:sweepCircle(p,end,q,slide?.34:.29)})).filter(c=>c.t!==null).sort((a,b)=>a.t-b.t||a.q.id-b.q.id),contact=contacts[0],victim=contact?.q;
 const relativeSpeed=victim?Math.hypot(p.vx-victim.vx,p.vz-victim.vz):0;
 const dangerous=victim&&slide&&relativeSpeed>9;
 const bodyFirst=contact&&contact.t<(ballHit??Infinity)-.025;
 const ballFirst=ballHit!==null&&d<range+.11&&alignment>.15&&!bodyFirst&&!match.heldBy;
 if(dangerous){foul(match,p,victim,{slide,relativeSpeed,ballAttempt:ballHit!==null,reason:'과도한 힘의 슬라이딩'});return;}
 if(ballFirst){
  match.physics.kick(f,slide?5.2:3.8,.15);match.owner=null;match.lastTouch=p;match.lastTouchTeam=p.team;match.lastTouchKind='tackle';match.offside.clear();match.restartOrigin=null;match.lock=.10;p.touchCooldown=.12;match.emit('tackle');
 }else if(victim){
  foul(match,p,victim,{slide,relativeSpeed,ballAttempt:ballHit!==null,reason:bodyFirst?'공보다 몸에 먼저 접촉':'늦은 태클'});
 }
}
