import {activePass} from './ball-assistance.js';
import {sweepCircle} from './collision-math.js';
import {FIELD} from './config.js';

// Select the first contact along the swept ball path, independent of roster order.
export function resolveBodyContacts(match,previous){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity;if(match.heldBy||v.length()<2)return;
 const flight=activePass(match),hits=[];
 for(const p of match.players){
  if(!p.active||p===match.owner||p.down>0||p.touchCooldown>0||flight?.follow&&p.team===flight.team)continue;
  const radius=(b.y>.65?.26:.21)*(p.build||1)+FIELD.ballRadius,t=sweepCircle(previous,b,p,radius);if(t===null)continue;
  const y=previous.y+(b.y-previous.y)*t;if(y<=.14||y>(p.height||1.81)-.04)continue;
  const x=previous.x+(b.x-previous.x)*t,z=previous.z+(b.z-previous.z)*t,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),rvx=v.x-p.vx,rvz=v.z-p.vz,s=Math.hypot(rvx,rvz)||1,nx=d>1e-8?dx/d:-rvx/s,nz=d>1e-8?dz/d:-rvz/s,incoming=rvx*nx+rvz*nz;
  if(incoming<0)hits.push({p,t,radius,nx,nz,incoming,y});
 }
 hits.sort((a,b)=>a.t-b.t||a.p.id-b.p.id);const hit=hits[0];if(!hit)return;
 const {p,radius,nx,nz,incoming,y}=hit;
 if(match.offside.has(p.id)){match.beginRestart({kind:'indirect',team:1-p.team,x:p.x,z:p.z,label:'오프사이드 · 간접 프리킥'});return;}
 v.x-=incoming*1.35*nx;v.z-=incoming*1.35*nz;b.x=p.x+nx*(radius+.002);b.z=p.z+nz*(radius+.002);b.y=y;
 p.touchCooldown=.15;match.lastTouch=p;match.lastTouchTeam=p.team;match.lastTouchKind='deflection';match.restartOrigin=null;match.owner=null;match.emit('bodyContact',{player:p,speed:Math.abs(incoming)});
}
