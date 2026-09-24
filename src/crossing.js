import {clamp,distance} from './config.js';
import {solveAirKick} from './air-flight.js';
import {offsideSnapshot} from './rules.js';
export function chooseCross(match,p,axis){
 const dir=match.direction(p.team),b=match.physics.ball.position;
 if(match.setPiece?.kind!=='corner'&&(p.x*dir<16||Math.abs(p.z)<14))return null;
 const offside=match.setPiece?.kind==='corner'?new Set():offsideSnapshot(match,p),n=Math.hypot(axis?.x||0,axis?.z||0);let best=null,score=-Infinity;
 for(const q of match.players){if(!q.active||q.team!==p.team||q===p||q.role==='GK'||q.down>0||offside.has(q.id)||q.x*dir<20||Math.abs(q.z)>22)continue;
 const d=distance(b,q);if(d<5||d>55)continue;const alignment=n>.2?((q.x-b.x)*axis.x+(q.z-b.z)*axis.z)/(d*n):0;
 if(n>.2&&alignment<-.2)continue;
 const value=(q.role==='FWD'?8:0)-Math.abs(q.x*dir-42)*.6-Math.abs(q.z)*.15+alignment*9;
 if(value>score){score=value;best=q;}}
 if(!best)return null;const t=clamp(distance(b,best)/20,.75,2.5);
 return {player:best,x:clamp(best.x+best.vx*t*.7,-50,50),z:clamp(best.z+best.vz*t*.7,-28,28)};
}
export function crossFlight(a,ball){
 const low=a.lowCross,ground=a.groundCross,time=clamp(a.distance/(a.early?24:20),.65,2.5)*(low?.7:1),height=low?.55:a.bounce?.15:1.25;
 if(ground)return null;
 const spin=(a.foot==='left'?-1:1)*(a.early?9:6);
 return solveAirKick(a.distance,height,time,ball.y,spin);
}
