import {clamp,distance,turnToward} from './config.js';
export function safeAutoTackle(match,p){const b=match.physics.ball.position,owner=match.owner,d=distance(p,b);if(match.heldBy||owner?.team===p.team||b.y>.55||d>.99||p.action||p.down>0||p.cooldown>0)return false;const dx=b.x-p.x,dz=b.z-p.z,alignment=(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/(d||1);if(alignment<.6)return false;if(owner){const relative=Math.hypot(p.vx-owner.vx,p.vz-owner.vz),bodyAlong=((owner.x-p.x)*dx+(owner.z-p.z)*dz)/(d||1),bodySide=Math.abs((owner.x-p.x)*dz-(owner.z-p.z)*dx)/(d||1);if(relative>5||bodyAlong>0&&bodyAlong<d-.16&&bodySide<.4)return false;}return true;}
export function autoDefenceMovement(match,p,input,axis,dt){const b=match.physics.ball.position,owner=match.owner;
 if(!(input.autoDefend||input.press)||owner?.team===p.team||match.setPiece||match.heldBy?.team===p.team||p.down>0){p.autoDefending=false;p.autoDefendSince=null;return null;}
 p.autoDefending=true;p.autoDefendSince??=match.time;
 const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz),manual=Math.hypot(axis.x,axis.z)>.12;
 p.yaw=turnToward(p.yaw,Math.atan2(dx,dz),dt*(5+p.agility*3));
 let target={x:b.x,z:b.z};
 if(owner&&owner.team!==p.team){const goalX=-match.direction(p.team)*52.5,gx=goalX-owner.x,gz=-owner.z,n=Math.hypot(gx,gz)||1;target={x:owner.x+gx/n*.85+owner.vx*.12,z:owner.z+gz/n*.85+owner.vz*.12};}
 const tx=target.x-p.x,tz=target.z-p.z,n=Math.hypot(tx,tz),amount=clamp((n-.18)/1.25,0,1),moving=manual?axis:{x:n?tx/n*amount:0,z:n?tz/n*amount:0};
 const retreating=manual&&axis.x*dx+axis.z*dz<-.05;
 if(!retreating&&match.time-p.autoDefendSince>.12&&safeAutoTackle(match,p))match.tackle(p);
 return {axis:moving,sprint:manual?input.sprint:d>6,defend:true};
}
