import {clamp,distance} from './config.js';
import {solveAirKick} from './air-flight.js';
import {offsideSnapshot} from './rules.js';
// Wide areas of the attacking third from which A plays a cross rather than a lofted pass.
export function inCrossingZone(match,p){const dir=match.direction(p.team);return match.setPiece?.kind==='corner'||p.x*dir>=16&&Math.abs(p.z)>=14;}
// Spaces a cross can be aimed into when no teammate is there yet: metres from the goal line along the attack, and
// across the pitch with positive values away from the crosser's touchline (the far side).
export const CROSS_ZONES=[{x:46.5,z:-3,name:'near post'},{x:44.5,z:1,name:'six-yard centre'},{x:45,z:4.5,name:'far post'},{x:41.5,z:0,name:'penalty spot'},{x:37,z:-6,name:'cut-back'}];
// The zone the stick points at, or the centre of the six-yard box without a direction.
export function crossZone(match,p,axis){
 const dir=match.direction(p.team),b=match.physics.ball.position,side=Math.sign(p.z)||1,n=Math.hypot(axis?.x||0,axis?.z||0);let best=null,score=-Infinity;
 for(const zone of CROSS_ZONES){const x=dir*zone.x,z=-side*zone.z,d=Math.hypot(x-b.x,z-b.z)||1,alignment=n>.2?((x-b.x)*axis.x+(z-b.z)*axis.z)/(d*n):0;
  const value=(n>.2?alignment*10:zone.name==='six-yard centre'?3:0)-Math.max(0,d-38)*.5;
  if(value>score){score=value;best={player:null,x,z,zone:zone.name,alignment};}}
 // A stick pointing away from the box asks for a lofted pass, not a cross.
 return n>.2&&best.alignment<.15?null:best;
}
export function chooseCross(match,p,axis){
 const dir=match.direction(p.team),b=match.physics.ball.position;
 if(!inCrossingZone(match,p))return null;
 const offside=match.setPiece?.kind==='corner'?new Set():offsideSnapshot(match,p),n=Math.hypot(axis?.x||0,axis?.z||0);let best=null,score=-Infinity;
 for(const q of match.players){if(!q.active||q.team!==p.team||q===p||q.role==='GK'||q.down>0||offside.has(q.id)||q.x*dir<20||Math.abs(q.z)>22)continue;
 const d=distance(b,q);if(d<5||d>55)continue;const alignment=n>.2?((q.x-b.x)*axis.x+(q.z-b.z)*axis.z)/(d*n):0;
 if(n>.2&&alignment<-.2)continue;
 const value=(q.role==='FWD'?8:0)-Math.abs(q.x*dir-42)*.6-Math.abs(q.z)*.15+alignment*9;
 if(value>score){score=value;best=q;}}
 // Nobody in the box yet: cross into space instead of lofting the ball along the touchline or back to midfield.
 if(!best)return match.setPiece?.kind==='corner'?null:crossZone(match,p,axis);
 const t=clamp(distance(b,best)/20,.75,2.5);
 return {player:best,x:clamp(best.x+best.vx*t*.7,-50,50),z:clamp(best.z+best.vz*t*.7,-28,28)};
}
export function crossFlight(a,ball){
 const low=a.lowCross,ground=a.groundCross,time=clamp(a.distance/(a.early?24:20),.65,2.5)*(low?.7:1),height=low?.55:a.bounce?.15:1.25;
 if(ground)return null;
 const spin=(a.foot==='left'?-1:1)*(a.early?9:6);
 return solveAirKick(a.distance,height,time,ball.y,spin);
}
