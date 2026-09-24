import {activePass} from './ball-assistance.js';
import {clamp,distance} from './config.js';

export const followPassEnabled=(match,team)=>(match.assistanceForTeam?.(team)||match.settings).passFollow!==false;
export function createPassFlight(match,p,a){
 const receiver=a.receiver;if(!receiver||a.type==='shoot')return null;
 const follow=followPassEnabled(match,p.team),b=match.physics.ball,initialSpeed=Math.hypot(b.velocity.x,b.velocity.z),speed=clamp(initialSpeed,9,34),lofted=b.velocity.y>2||b.position.y>.55;
 const moving=Math.hypot(receiver.vx,receiver.vz)>.4,through=a.type==='through';
 const run=receiver.runUntil>match.time&&receiver.runTarget?receiver.runTarget:through?{x:receiver.x+match.direction(p.team)*9,z:receiver.z}:moving?{x:receiver.x+receiver.vx*1.5,z:receiver.z+receiver.vz*1.5}:{x:receiver.x,z:receiver.z};
 return {receiver:receiver.id,kicker:p.id,team:p.team,follow,type:a.type,speed,lofted,start:match.time,arrival:match.time+clamp(distance(receiver,b.position)/speed,.35,2.6),expires:match.time+(follow?8:Math.min(5.5,1.8+a.distance/9)),runTarget:{x:clamp(run.x,-50.5,50.5),z:clamp(run.z,-32.5,32.5)}};
}
// Guide velocity only. The ball still crosses every point on the path and all
// opponent contact/referee checks run after the normal physics step.
export function guidePass(match,dt){
 const f=activePass(match);if(!f){match.passFlight=null;return false;}if(!f.follow)return false;
 const p=match.players.find(p=>p.id===f.receiver);
 if(!p?.active||p.down>0||match.state!=='playing'||match.setPiece||Math.abs(p.x)>52.1||Math.abs(p.z)>33.5){match.passFlight=null;return false;}
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,dx=p.x-b.x,dz=p.z-b.z;
 let vx=p.vx+dx*4,vz=p.vz+dz*4,n=Math.hypot(vx,vz);if(n>f.speed){vx*=f.speed/n;vz*=f.speed/n;}
 // Limit steering impulse so the ball curves into the moving receiver smoothly.
 const w=1-Math.exp(-10*dt);let ax=(vx-v.x)*w,az=(vz-v.z)*w;const change=Math.hypot(ax,az),limit=(Math.hypot(dx,dz)<2.5?65:38)*dt;if(change>limit){ax*=limit/change;az*=limit/change;}v.x+=ax;v.z+=az;
 // Lofted passes retain their gravity-driven arc and bounce; horizontal guidance
 // alone follows a changed run, avoiding a last-second vertical dive.
 // Ground passes stay low while lofted passes keep an arc; no position snapping.
 if(!f.lofted&&b.y>.15)v.y=Math.min(v.y,-Math.min(3,(b.y-.11)*8));
 ball.wakeUp();return true;
}
