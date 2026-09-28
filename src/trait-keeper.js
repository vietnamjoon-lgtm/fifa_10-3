import {hasTrait} from './traits.js';
import {clamp,distance} from './config.js';
import {activePass} from './ball-assistance.js';
// Goalkeeper traits (called from keeperTarget in src/ai.js for a keeper no person controls). A sweeper keeper leaves his
// line for a loose ball behind the defence he can reach first and clears it; a cross claimer comes for a high ball
// dropping near his six-yard box. Other keepers keep the default positioning. Our own tuning.
export const TRAIT_KEEPER={
 sweep:{from:-23,width:24,maxHeight:1.2,shotWindow:2,maxIncoming:9,speed:6.4,rival:7.4,margin:.85,look:1.2,clearPower:.85},
 claim:{height:2.2,depth:-41,width:10.5,speed:6.2,slack:.25,minTime:.2,maxTime:2.6}
};
function sweepPoint(match,p){
 const s=TRAIT_KEEPER.sweep,b=match.physics.ball.position,v=match.physics.ball.velocity,dir=match.direction(p.team),flight=activePass(match);
 if(match.owner||match.heldBy||b.y>s.maxHeight||b.x*dir>s.from||Math.abs(b.z)>s.width||flight?.team===p.team)return null;
 // Never for a shot or a hard ball already running at goal: those are for the keeper's set position and dive.
 if(match.lastKickType==='shoot'&&match.time-match.lastKickTime<s.shotWindow||-v.x*dir>s.maxIncoming)return null;
 // Only a ball in behind: nearer our goal than every outfield team-mate.
 const last=Math.min(...match.players.filter(q=>q.active&&q.team===p.team&&q.role!=='GK').map(q=>q.x*dir),99);if(b.x*dir>last)return null;
 const reach=distance(p,b),t=Math.min(s.look,reach/s.speed),point={x:clamp(b.x+v.x*t,-52,52),z:clamp(b.z+v.z*t,-30,30)};
 if(point.x*dir>s.from+4)return null;
 const mine=distance(p,point)/s.speed,rival=Math.min(...match.players.filter(q=>q.active&&q!==p&&q.down<=0).map(q=>distance(q,point)/s.rival),99);
 return mine<rival*s.margin?point:null;
}
function claimPoint(match,p){
 const c=TRAIT_KEEPER.claim,b=match.physics.ball.position,v=match.physics.ball.velocity,dir=match.direction(p.team);
 if(match.owner||match.heldBy||match.lastTouchTeam===p.team||match.lastKickType==='shoot'||b.y<1&&v.y<1)return null;
 const disc=v.y*v.y+2*9.81*(b.y-c.height);if(disc<0)return null;
 const t=(v.y+Math.sqrt(disc))/9.81;if(t<c.minTime||t>c.maxTime)return null;
 const point={x:b.x+v.x*t,z:b.z+v.z*t};
 if(point.x*dir>c.depth||point.x*dir<-52.4||Math.abs(point.z)>c.width)return null;
 return distance(p,point)/c.speed<t+c.slack?point:null;
}
/** Sets the keeper's target and returns true when a keeper trait takes over this frame. */
export function keeperTraitTarget(match,p){
 p.keeperDash=false;
 const sweeper=hasTrait(p,'sweeper'),claimer=hasTrait(p,'crossClaimer');if(!sweeper&&!claimer)return false;
 const dir=match.direction(p.team);
 // A sweeper with the ball at his feet outside the hands (not held) clears it long and wide instead of walking it back.
 if(sweeper&&match.owner===p&&!match.heldBy){p.aiState='SWEEP CLEAR';p.target={x:p.x,z:p.z};p.sprinting=false;
  if(!p.action&&p.cooldown<=0)match.queueKick(p,'lob',TRAIT_KEEPER.sweep.clearPower,{x:dir*34,z:(Math.sign(p.z)||1)*16-p.z*.3});return true;}
 const claim=claimer&&claimPoint(match,p),point=claim||(sweeper&&sweepPoint(match,p));
 if(!point)return false;
 p.aiState=claim?'CLAIM':'SWEEP';p.target=point;p.sprinting=true;p.keeperDash=true;return true;
}
