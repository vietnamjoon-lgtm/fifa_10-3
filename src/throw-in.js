import {clamp,turnToward} from './config.js';
// Throw-in timing and ball path, shared by the rules (the ball stays in the hands until
// release) and the pose (the hands stay on the ball), so the two never drift apart.
export const THROW={windup:.24,release:.42,end:.74};
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const scaleOf=p=>clamp((p.height||1.81)/1.81,.85,1.16);
// Ball centre relative to the thrower's feet for a 1.81 m player: held behind the head within
// reach of bent arms (the hands grip its sides),
// drawn further back in the wind-up, then brought over the head and released in front.
export function throwBallLocal(t=-1){
 if(t<0)return {forward:-.16,up:1.86};
 const back=smooth(t/THROW.windup),over=smooth((t-THROW.windup)/(THROW.release-THROW.windup));
 return {forward:-.16-.12*back+.53*over,up:1.86-.02*back+.01*over};
}
export function heldBallPosition(p,t=-1){
 const s=scaleOf(p),l=throwBallLocal(t),x=p.x+Math.sin(p.yaw)*l.forward*s,z=p.z+Math.cos(p.yaw)*l.forward*s;
 // Keep the held ball on or inside the touchline so holding it never reads as out of play.
 return {x,y:l.up*s,z:clamp(z,-34.1,34.1)};
}
// Hands: on the ball until release, then carried on along the throw while the hand IK fades
// out (weight) and the authored follow-through pose takes over.
export function throwHandsPosition(p,t){
 if(t<=THROW.release)return {...heldBallPosition(p,t),spread:.12,weight:1};
 const s=scaleOf(p),f=smooth((t-THROW.release)/.22),forward=.25+.3*f,up=1.86-.15*f;
 return {x:p.x+Math.sin(p.yaw)*forward*s,y:up*s,z:p.z+Math.cos(p.yaw)*forward*s,spread:.12+.05*f,weight:1-f};
}
// The taker stands on the touchline facing the pitch, turns within reach of the stick's
// direction and holds the ball overhead until the throw starts.
export function holdThrower(m,p,dt,input){
 const s=m.setPiece,side=Math.sign(s.z??p.z)||1;
 // A restart from the touchline puts the taker on the line; a throw staged without one keeps the taker in place.
 if(!s.spot){const b=m.physics.ball.position,line=Number.isFinite(s.z);s.spot=line?{x:clamp(b.x,-51,51),z:side*33.95}:{x:p.x,z:p.z};if(line)p.yaw=Math.atan2(0,-side);}
 p.x=s.spot.x;p.z=s.spot.z;p.vx=p.vz=0;p.throwHold=!p.action;
 if(p.action)return;
 const field=Math.atan2(0,-side),axis=m.isHumanTeam?.(p.team)?input?.axis:null,n=Math.hypot(axis?.x||0,axis?.z||0);
 let aim=field;if(n>.2){const want=Math.atan2(axis.x,axis.z),off=Math.atan2(Math.sin(want-field),Math.cos(want-field));aim=field+clamp(off,-1.3,1.3);}
 p.yaw=turnToward(p.yaw,aim,dt*5);
 const b=heldBallPosition(p);m.physics.reset(b.x,b.z,b.y);
}
// Runs the throw action: ball in the hands until release, then the rules' release callback.
export function updateThrow(m,p,a,release){
 if(!a.hit){const b=heldBallPosition(p,Math.min(a.elapsed,THROW.release));m.physics.reset(b.x,b.z,b.y);
  if(a.elapsed>=THROW.release){a.hit=true;p.throwHold=false;release(m,p,a);}}
 if(a.elapsed>THROW.end)p.action=null;
}
