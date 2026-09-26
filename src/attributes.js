import {KEEPER} from './keeper-tuning.js';
import {clamp} from './config.js';

// Original game tuning, not EA/Nexon conversion curves. Normalized skills are 0..1.
export const skill=(p,key,fallback=.8)=>clamp(Number.isFinite(p[key])?p[key]:fallback,0,1);
export function movementProfile(p,speed,axis){
 const agility=skill(p,'agility'),balance=skill(p,'balance');
 const n=Math.hypot(axis.x,axis.z),alignment=n>.01&&speed>.1?(p.vx*axis.x+p.vz*axis.z)/(speed*n):1;
 const turning=clamp((1-alignment)*.5,0,1),fatigue=.8+.2*(p.stamina??1);
 return {acceleration:p.acceleration*fatigue*(.76+.3*agility)*(1-turning*(1-balance)*.45),
  braking:19*(.65+.43*balance),turn:(5+4*agility-speed*.23)*(.85+.15*balance)};
}
export function kickSkill(p,a){return skill(p,a.type==='shoot'?'shooting':a.type==='lob'||a.lob?'longPass':'passing');}
export function kickError(p,a,pressure){
 const ability=kickSkill(p,a),alignment=clamp((Math.sin(p.yaw)*a.aim.x+Math.cos(p.yaw)*a.aim.z+1)/2,0,1);
 const posture=1+(1-alignment)*(1.8-skill(p,'balance'));
 const weak=a.foot&&a.foot!==p.foot?1+(1-skill(p,'weakFoot',.7))*.9:1;
 const stress=1+clamp((2-pressure)/2,0,1)*(.6+(1-skill(p,'balance')));
 const fatigue=1+(1-(p.stamina??1))*.6;
 // Shots keep their tuning. Passes had the same tiny base (about +-0.5 degrees for a 76-rated passer), so every ball
 // arrived on the receiver's feet like a 99 stat; they now miss by roughly a degree at 20 m and more for long balls.
 if(a.type==='shoot')return (.003+(1-ability)*.065)*posture*weak*stress*fatigue;
 return (PASS_ERROR.base+(1-ability)*PASS_ERROR.skill)*(1+(a.distance||0)/PASS_ERROR.distance)*(a.type==='through'?PASS_ERROR.through:1)*posture*weak*stress*fatigue;
}
// Pass error in radians (full range): (base + (1 - skill) * skill) * (1 + distance / distance) * through * posture...
// `pace` scales the same error into an under- or over-hit weight.
export const PASS_ERROR={base:.018,skill:.11,distance:30,through:1.15,pace:2.2};
export function keeperProfile(p){const reflex=skill(p,'reflexes'),reach=clamp(p.reach||1.7,1.3,2.2);
 return {reaction:KEEPER.reactionBase+(1-reflex)*KEEPER.reactionSpread,catchSpeed:KEEPER.catchBase+reflex*KEEPER.catchReflex,range:reach*(p.dive>0?KEEPER.diveRange:KEEPER.standingRange),height:Math.min(p.height||1.81,reach)+KEEPER.heightPadding};}
export function seededRandom(seed=0x4f2c9a13){let state=seed>>>0;return ()=>{state+=0x6d2b79f5;let x=state;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
