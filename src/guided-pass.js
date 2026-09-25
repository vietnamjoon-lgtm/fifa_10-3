import {activePass} from './ball-assistance.js';
import {clamp,distance} from './config.js';

// Assisted passes follow the receiver; manual passes retain their physical trajectory.
export const followPassEnabled=(match,team,type='pass')=>{
 const settings=match.assistanceForTeam?.(team)||match.settings;
 const mode=type==='lob'?'crossAssist':type==='through'?'throughAssist':'passAssist';
 return settings.passFollow!==false&&settings[mode]!=='manual';
};
export function createPassFlight(match,p,a){
 const receiver=a.receiver;if(!receiver||a.type==='shoot')return null;
 const follow=followPassEnabled(match,p.team,a.type),b=match.physics.ball,initialSpeed=Math.hypot(b.velocity.x,b.velocity.z),speed=clamp(initialSpeed,9,34),lofted=b.velocity.y>2||b.position.y>.55;
 // Preserve an explicit run command, but do not manufacture a run to meet a pass.
 const run=receiver.runUntil>match.time&&receiver.runTarget?receiver.runTarget:{x:receiver.x,z:receiver.z};
 return {receiver:receiver.id,kicker:p.id,team:p.team,follow,type:a.type,speed,lofted,start:match.time,arrival:match.time+clamp(distance(receiver,b.position)/speed,.35,2.6),expires:match.time+(follow?8:Math.min(5.5,1.8+a.distance/9)),runTarget:{x:clamp(run.x,-50.5,50.5),z:clamp(run.z,-32.5,32.5)}};
}
// Change horizontal velocity only: normal physics, gravity and contact checks still apply.
export function guidePass(match,dt){
 const f=activePass(match);if(!f){match.passFlight=null;return false;}if(!f.follow)return false;
 const p=match.players.find(p=>p.id===f.receiver);
 if(!p?.active||p.down>0||match.state!=='playing'||match.setPiece||Math.abs(p.x)>52.1||Math.abs(p.z)>33.5){match.passFlight=null;return false;}
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,dx=p.x-b.x,dz=p.z-b.z;
 // Match the receiver's velocity near contact and brake instead of rolling metres past them.
 let vx=p.vx+dx*4,vz=p.vz+dz*4,n=Math.hypot(vx,vz);if(n>f.speed){vx*=f.speed/n;vz*=f.speed/n;}
 const w=1-Math.exp(-10*dt);let ax=(vx-v.x)*w,az=(vz-v.z)*w;
 const change=Math.hypot(ax,az),limit=(Math.hypot(dx,dz)<2.5?65:38)*dt;
 if(change>limit){ax*=limit/change;az*=limit/change;}v.x+=ax;v.z+=az;
 ball.wakeUp();return true;
}
