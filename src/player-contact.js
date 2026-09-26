import {bodyContactMass,cleanWeight,defaultWeight} from './body-shape.js';
import {clamp,distance} from './config.js';
import {foul} from './referee.js';
import {foulThreshold} from './gameplay-settings.js';

export const playerRadius=p=>clamp(.285*(p.build||1)*Math.sqrt(cleanWeight(p.weight,p)/defaultWeight(p)),.23,.37);
export function resolvePlayerContacts(match,dt){
 const players=match.players.filter(p=>p.active).sort((a,b)=>a.id-b.id);
 for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
  const a=players[i],b=players[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),reach=playerRadius(a)+playerRadius(b);if(d>=reach)continue;
  const nx=d>1e-8?dx/d:1,nz=d>1e-8?dz/d:0,ma=bodyContactMass(a),mb=bodyContactMass(b),shareA=mb/(ma+mb),shareB=1-shareA,closing=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
  if(a.team!==b.team&&a.down<=0&&b.down<=0){
   if(!a.interaction||match.time>a.interaction.until){const shared={id:++match.actionId,start:match.time,until:match.time+.22,anchor:{x:(a.x+b.x)/2,z:(a.z+b.z)/2}};a.interaction={...shared,partner:b.id,side:1};b.interaction={...shared,partner:a.id,side:-1};}
   const victim=match.owner===a?a:match.owner===b?b:null,offender=victim===a?b:a;
   // Only the offender's own run into the ball carrier counts: a carrier backing or turning into a defender is not fouled.
   const into=victim?((victim.x-offender.x)*offender.vx+(victim.z-offender.z)*offender.vz)/(d||1):0;
   if(victim&&closing>4.2*foulThreshold(match)&&into>closing*.6&&match.time>=Math.max(a.chargeContactUntil||0,b.chargeContactUntil||0)&&!['slide','tackle'].includes(offender.action?.type)){
    const behind=(offender.x-victim.x)*Math.sin(victim.yaw)+(offender.z-victim.z)*Math.cos(victim.yaw)<-.2;
    if(behind&&distance(victim,match.physics.ball.position)<1.7){a.chargeContactUntil=b.chargeContactUntil=match.time+1;foul(match,offender,victim,{relativeSpeed:closing,ballAttempt:false,reason:'뒤에서 충돌'});}
   }
  }
  // Inelastic normal impulse preserves tangential motion and cannot add energy.
  if(closing>0){a.vx-=nx*closing*shareA;a.vz-=nz*closing*shareA;b.vx+=nx*closing*shareB;b.vz+=nz*closing*shareB;}
  const push=Math.max(0,reach-d-.002)*(1-Math.exp(-180*dt));a.x-=nx*push*shareA;a.z-=nz*push*shareA;b.x+=nx*push*shareB;b.z+=nz*push*shareB;
  if(match.state!=='playing')return;
 }
}
