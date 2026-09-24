import {activePass} from './ball-assistance.js';
import {clamp,distance} from './config.js';

// Passes are purely physical: the ball is never steered toward a receiver after it leaves the foot,
// so a misplaced pass keeps rolling. The saved passFollow preference is still sanitized and stored
// for compatibility, but it no longer bends the ball.
export const followPassEnabled=()=>false;
export function createPassFlight(match,p,a){
 const receiver=a.receiver;if(!receiver||a.type==='shoot')return null;
 const follow=followPassEnabled(match,p.team),b=match.physics.ball,initialSpeed=Math.hypot(b.velocity.x,b.velocity.z),speed=clamp(initialSpeed,9,34),lofted=b.velocity.y>2||b.position.y>.55;
 const moving=Math.hypot(receiver.vx,receiver.vz)>.4,through=a.type==='through';
 const run=receiver.runUntil>match.time&&receiver.runTarget?receiver.runTarget:through?{x:receiver.x+match.direction(p.team)*9,z:receiver.z}:moving?{x:receiver.x+receiver.vx*1.5,z:receiver.z+receiver.vz*1.5}:{x:receiver.x,z:receiver.z};
 return {receiver:receiver.id,kicker:p.id,team:p.team,follow,type:a.type,speed,lofted,start:match.time,arrival:match.time+clamp(distance(receiver,b.position)/speed,.35,2.6),expires:match.time+(follow?8:Math.min(5.5,1.8+a.distance/9)),runTarget:{x:clamp(run.x,-50.5,50.5),z:clamp(run.z,-32.5,32.5)}};
}
// Kept as the per-frame pass tracker: it only expires the flight, it never changes the ball's velocity.
export function guidePass(match){if(!activePass(match))match.passFlight=null;return false;}
