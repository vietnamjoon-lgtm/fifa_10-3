import {hasTrait,workLevel} from './traits.js';
import {clamp} from './config.js';
// Traits that change a player's own play whoever controls him (src/match.js, src/referee.js), and the stamina cost of
// work rates. Our own tuning. With no traits and mid/mid work rates every factor here is exactly 1.
export const TRAIT_PLAY={
 slide:{reach:1.12,foul:.82},
 header:{speed:1.12,error:.8,height:1.2},
 finesse:{error:.75,curve:1.3,minSide:3,minGoalZ:.9},
 stamina:{tireless:.7,high:.06,low:-.04}
};
/** Sprint stamina drain factor: tireless lasts longer; each high work rate costs a little more, each low one a little less. */
export function staminaDrain(p){
 const s=TRAIT_PLAY.stamina,a=workLevel(p,'attack'),d=workLevel(p,'defence');let k=hasTrait(p,'tireless')?s.tireless:1;
 const work=(a>0?s.high:a<0?s.low:0)+(d>0?s.high:d<0?s.low:0);return work?k*(1+work):k;
}
/** A sliding tackler's slide reaches further. */
export const tackleReach=(p,slide)=>slide&&hasTrait(p,'slideTackler')?TRAIT_PLAY.slide.reach:1;
/** Factor on the contact speeds at which the referee sees a foul or a card: below 1 means fouls come sooner. */
export const foulTolerance=(p,slide)=>slide&&hasTrait(p,'slideTackler')?TRAIT_PLAY.slide.foul:1;
/** Whether a shot is aimed at the far post from a wide position (where the goal line is crossed, relative to the ball). */
export function farPostShot(match,p,a,b){
 const f=TRAIT_PLAY.finesse,dir=match.direction(p.team);if(a.type!=='shoot'||Math.abs(b.z)<f.minSide||a.aim.x*dir<.1)return false;
 const z=b.z+a.aim.z*(dir*52.5-b.x)/a.aim.x;return Math.sign(z)===-Math.sign(b.z)&&Math.abs(z)>f.minGoalZ;
}
/** Kick factors from traits: {error, speed, curve}. */
export function kickTraits(match,p,a,b){
 let error=1,speed=1,curve=1;
 if(a.aerial&&b.y>TRAIT_PLAY.header.height&&hasTrait(p,'powerHeader')){error*=TRAIT_PLAY.header.error;speed*=TRAIT_PLAY.header.speed;}
 if(hasTrait(p,'finesse')&&farPostShot(match,p,a,b)){error*=TRAIT_PLAY.finesse.error;curve*=TRAIT_PLAY.finesse.curve;}
 return {error,speed,curve:clamp(curve,1,2)};
}
