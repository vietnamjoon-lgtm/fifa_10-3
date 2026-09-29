import {clamp,distance,turnToward,sprintSpeed,jogSpeed} from './config.js';
import {skill} from './attributes.js';
export function safeAutoTackle(match,p,reach=.99){const b=match.physics.ball.position,owner=match.owner,d=distance(p,b);if(match.heldBy||p.beaten?.until>match.time||owner?.team===p.team||b.y>.55||d>reach||p.action||p.down>0||p.cooldown>0)return false;const dx=b.x-p.x,dz=b.z-p.z,alignment=(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/(d||1);if(alignment<.6)return false;if(owner){const relative=Math.hypot(p.vx-owner.vx,p.vz-owner.vz),bodyAlong=((owner.x-p.x)*dx+(owner.z-p.z)*dz)/(d||1),bodySide=Math.abs((owner.x-p.x)*dz-(owner.z-p.z)*dx)/(d||1);if(relative>5||bodyAlong>0&&bodyAlong<d-.16&&bodySide<.4)return false;}return true;}
// Holding D (contain, "압박" in FC Online): the defender takes a goal-side spot a stride in front of the carrier and
// keeps it at the carrier's own pace. From further than `close` metres he closes at a sprint; nearer he arrives
// at the carrier's speed plus `arrive` per metre still to go, so a carrier who is not quicker cannot run past him.
// He reads the carrier's direction with a `reaction`-second lag (sharper for a high tackling rating), so a sudden
// cut or a skill move can still beat him. A D tap within `tapReach` of the ball lunges into a standing tackle.
// While containing, the defender tackles on his own when the ball is within `autoReach`: at once when the carrier's touch
// leaves it more than `exposed` metres from his feet, otherwise at `rate` attempts per second for a 0.8 tackler.
export const CONTAIN={gap:1.15,slowGap:.9,lead:.22,reaction:.2,reactionSkill:.1,arrive:2.2,close:3.2,tapReach:1.6,autoReach:1.3,exposed:.62,rate:1.1};
export function containReaction(p){return CONTAIN.reaction-CONTAIN.reactionSkill*(skill(p,'tackling')-.5);}
export function autoDefenceMovement(match,p,input,axis,dt){const b=match.physics.ball.position,owner=match.owner;
 if(!(input.autoDefend||input.press)||owner?.team===p.team||match.setPiece||match.heldBy?.team===p.team||p.down>0){p.autoDefending=false;p.autoDefendSince=null;p.containVel=null;return null;}
 p.autoDefending=true;p.autoDefendSince??=match.time;
 const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),manual=Math.hypot(axis.x,axis.z)>.12,top=sprintSpeed(p);
 p.yaw=turnToward(p.yaw,Math.atan2(dx,dz),dt*(5+p.agility*3));
 let target={x:b.x,z:b.z},speed=d>CONTAIN.close?top:jogSpeed(p);
 if(owner&&owner.team!==p.team){
  const k=1-Math.exp(-dt/Math.max(.05,containReaction(p))),v=p.containVel?{x:p.containVel.x+(owner.vx-p.containVel.x)*k,z:p.containVel.z+(owner.vz-p.containVel.z)*k}:{x:owner.vx,z:owner.vz};p.containVel=v;
  const carrierSpeed=Math.hypot(owner.vx,owner.vz),cx=owner.x+v.x*CONTAIN.lead,cz=owner.z+v.z*CONTAIN.lead,goalX=-match.direction(p.team)*52.5,gx=goalX-cx,gz=-cz,g=Math.hypot(gx,gz)||1,gap=carrierSpeed<3?CONTAIN.slowGap:CONTAIN.gap;
  target={x:cx+gx/g*gap,z:cz+gz/g*gap};const n=distance(p,target);
  speed=n>CONTAIN.close?top:Math.min(top,Math.hypot(v.x,v.z)+.3+n*CONTAIN.arrive);
 }else p.containVel=null;
 if(input.sprint)speed=top;
 const tx=target.x-p.x,tz=target.z-p.z,n=Math.hypot(tx,tz),amount=clamp((n-.1)/.6,0,1),moving=manual?axis:{x:n?tx/n*amount:0,z:n?tz/n*amount:0};
 if(manual)speed=input.sprint?top:jogSpeed(p)*.85;
 const retreating=manual&&axis.x*dx+axis.z*dz<-.05;
 if(!retreating&&match.time-p.autoDefendSince>.12&&safeAutoTackle(match,p,CONTAIN.autoReach)){const exposed=!owner||distance(owner,b)>CONTAIN.exposed;if(exposed||match.random()<CONTAIN.rate*dt*skill(p,'tackling')/.8)match.tackle(p);}
 return {axis:moving,sprint:speed>jogSpeed(p)+.05,defend:true,speed};
}
