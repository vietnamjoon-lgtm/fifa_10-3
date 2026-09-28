import {hasTrait,workLevel} from './traits.js';
import {clamp,distance} from './config.js';
import {offsideSnapshot} from './rules.js';
// How traits and work rates tilt the AI's choices (src/ai.js). Our own tuning, measured in reports/PLAYER-TRAITS.md.
// A player a person controls is never steered by these; a player with no traits and mid/mid work rates gets exactly the
// old decisions (every factor is 1 or 0, and no extra random number is drawn for him).
export const TRAIT_AI={
 decision:{playmaker:.7,teamPlayer:.75},
 longShot:{range:31,width:14,lane:.9,chance:.35,power:.1},
 earlyCross:{from:4,width:12,chance:.5,space:1.6},
 carry:{solo:2.5,soloPressure:1.4,team:-1.5,teamPressure:3.2,teamMinimum:-1,speed:1,speedSpace:6},
 playmakerBonus:1.6,
 longPass:{reach:52,perMetre:.08,max:1.8,switchPlay:1,lofted:1.5},
 speedDribble:{sprintSpace:2.5,knock:1.3},
 runner:{lineGap:.3,push:3,chance:.22},attackRunChance:.06,
 attackPush:{FWD:2,MID:3,DEF:4},
 defenceDrop:{FWD:4,MID:3},defenceHold:{FWD:2,MID:1.5},
 recoverSprint:2,presserCost:1,
 slide:{chance:.18,min:1.05,max:1.9,alignment:.7}
};
export const aiTrait=(match,p,id)=>hasTrait(p,id)&&!match.isHumanControlled(p);
/** Factor on the carrier's time to his next decision. */
export function decisionScale(match,p,pressure){let k=1;if(aiTrait(match,p,'playmaker'))k*=TRAIT_AI.decision.playmaker;if(pressure<3&&aiTrait(match,p,'teamPlayer'))k*=TRAIT_AI.decision.teamPlayer;return k;}
/** A shot from 25-30 m the default AI would not take. Draws a random number only for a long-shot player. */
export function takesLongShot(match,p,goalDistance,shotLane){
 const s=TRAIT_AI.longShot;return aiTrait(match,p,'longShots')&&goalDistance<s.range&&Math.abs(p.z)<s.width&&shotLane<s.lane&&match.random()<s.chance;}
export function longShotPower(match,p,goalDistance){return goalDistance>24&&aiTrait(match,p,'longShots')?TRAIT_AI.longShot.power:0;}
/** How the carry-or-pass comparison leans: extra carry value, the pressure that forces a pass and the pass value that is enough then. */
export function passLean(match,p,lane){
 const c=TRAIT_AI.carry;let carry=0,pressure=2.2,minimum=0;
 if(aiTrait(match,p,'soloPlay')){carry+=c.solo;pressure=Math.min(pressure,c.soloPressure);}
 if(aiTrait(match,p,'teamPlayer')){carry+=c.team;pressure=Math.max(pressure,c.teamPressure);minimum=c.teamMinimum;}
 if(lane.space>c.speedSpace&&aiTrait(match,p,'speedDribbler'))carry+=c.speed;
 return {carry,pressure,minimum};
}
export const carrySprintSpace=(match,p)=>aiTrait(match,p,'speedDribbler')?TRAIT_AI.speedDribble.sprintSpace:3.5;
/** Longer knocks for an AI speed dribbler (the caller has already checked no person controls him). */
export const knockScale=p=>hasTrait(p,'speedDribbler')?TRAIT_AI.speedDribble.knock:1;
/** Pass reach and extra value of a receiver in bestPassOption. */
export const passReach=(match,p)=>aiTrait(match,p,'longPasser')?TRAIT_AI.longPass.reach:40;
export function passBonus(match,p,q,d,lofted){
 let bonus=0;
 if(aiTrait(match,q,'playmaker'))bonus+=TRAIT_AI.playmakerBonus;
 if(aiTrait(match,p,'longPasser')){const l=TRAIT_AI.longPass;bonus+=clamp((d-22)*l.perMetre,0,l.max)+(Math.abs(q.z-p.z)>20?l.switchPlay:0)+(lofted?l.lofted:0);}
 return bonus;
}
/** An early cross from deep on the flank (from about the halfway line), for a player with the early-cross trait. */
export function earlyCross(match,p,plan,opponents,space){
 const e=TRAIT_AI.earlyCross,dir=match.direction(p.team);
 if(!aiTrait(match,p,'earlyCross')||p.x*dir<e.from||Math.abs(p.z)<e.width)return false;
 const offside=offsideSnapshot(match,p);let best=null,score=-Infinity;
 for(const q of match.players){if(!q.active||q.team!==p.team||q===p||q.role==='GK'||q.down>0||offside.has(q.id)||q.x*dir<28||Math.abs(q.z)>20)continue;
  const d=distance(p,q);if(d<12||d>55)continue;const value=(q.role==='FWD'?6:0)-Math.abs(q.x*dir-42)*.5-Math.abs(q.z)*.15;if(value>score){score=value;best=q;}}
 if(!best)return false;
 const t=clamp(distance(p,best)/22,.75,2.5),x=clamp(best.x+best.vx*t*.7,-50,50),z=clamp(best.z+best.vz*t*.7,-28,28);
 if(space(opponents,x,z)<e.space||!(plan.kind==='wing'||match.random()<e.chance))return false;
 return match.queueKick(p,'lob',.55,{x:x-p.x,z:z-p.z},best,{early:true});
}
/** Runs in behind from players with the runner trait or a high attacking work rate, on any plan. */
export function traitRuns(match,p,line){
 const dir=match.direction(p.team);if(p.x*dir<=-15||p.x*dir>=34)return;
 const chance=q=>(aiTrait(match,q,'runner')?TRAIT_AI.runner.chance:0)+(workLevel(q,'attack')>0&&q.role!=='DEF'&&!match.isHumanControlled(q)?TRAIT_AI.attackRunChance:0);
 const runner=match.players.filter(q=>q.active&&q.team===p.team&&q!==p&&q.role!=='GK'&&q.down<=0&&!(q.runUntil>match.time)&&q.x*dir>line-8&&q.x*dir<line+.5&&chance(q)>0).sort((a,c)=>Math.abs(a.z-p.z)-Math.abs(c.z-p.z))[0];
 if(runner&&match.random()<chance(runner)){runner.runUntil=match.time+2.4;runner.runTarget={x:clamp((line+11)*dir,-48,48),z:clamp(runner.z*.75,-26,26)};}
}
/** Support-position shift forward (metres along the attack) for the attacking work rate, and the runner's closer line. */
export const attackPush=p=>workLevel(p,'attack')*(TRAIT_AI.attackPush[p.role]||0);
export const onsideGap=(match,p)=>aiTrait(match,p,'runner')?TRAIT_AI.runner.lineGap:.8;
export const runnerPush=(match,p)=>aiTrait(match,p,'runner')?TRAIT_AI.runner.push:0;
/** Out of possession: metres a forward or midfielder drops deeper (high) or stays up (low). */
export function defenceShift(p){const w=workLevel(p,'defence');return w>0?-(TRAIT_AI.defenceDrop[p.role]||0):w<0?TRAIT_AI.defenceHold[p.role]||0:0;}
/** Distance to his position beyond which a defending player sprints back. */
export const recoverDistance=p=>7-workLevel(p,'defence')*TRAIT_AI.recoverSprint;
/** Extra cost of being the presser for a midfielder or forward: a hard worker volunteers, a lazy one waits for someone else.
 * Defenders are left out so the back line is not pulled apart. */
export const presserCost=p=>p.role==='DEF'?0:-workLevel(p,'defence')*TRAIT_AI.presserCost;
/** A sliding tackler goes to ground from a little further than a standing tackle reaches (1.05-1.9 m from a ball on the
 * ground in front of him). Draws a random number only for such a player in that position. */
export function slideLunge(match,p,owner){
 if(!aiTrait(match,p,'slideTackler')||match.heldBy||p.action||p.cooldown>0||p.down>0||owner?.team===p.team)return false;
 const s=TRAIT_AI.slide,b=match.physics.ball.position,d=distance(p,b);if(b.y>.55||d<=s.min||d>=s.max)return false;
 if(((b.x-p.x)*Math.sin(p.yaw)+(b.z-p.z)*Math.cos(p.yaw))/d<s.alignment||match.random()>=s.chance)return false;
 match.tackle(p,true);return true;
}
