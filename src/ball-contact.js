import {secondTouch} from './setpieces.js';
import {activePass} from './ball-assistance.js';
import {sweepCircle} from './collision-math.js';
import {FIELD} from './config.js';

// Leg block below knee height, and how softly the dribbler's own legs nudge the ball.
export const CONTACT={legHeight:.45,legRadius:.16,ownClosing:.8,ownMoving:.5,ownRestitution:.25};

// Select the first contact along the swept ball path, independent of roster order. Every player's body blocks the
// ball: the trunk above knee height, the legs (a narrower circle) below it, so a rolling ball no longer passes through
// shins. The dribbler's own legs block it too, but only nudge it (soft, low restitution) and never take possession away.
export function resolveBodyContacts(match,previous){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity;if(match.heldBy)return;
 const flight=activePass(match),hits=[];
 for(const p of match.players){
  const own=p===match.owner;
  // A ball the dribbler has just played with a dribble touch or is dragging round, or that rolls off past the body after a
  // drag (assists.js startDrag), is meant to pass beside the legs: blocking it bounced it straight back off the shins.
  if(own&&(match.time-(p.dribblePose?.start??-Infinity)<.16||p.ballDrag||match.time<(p.dragRestUntil??-Infinity)))continue;
  if(!p.active||p.down>0||(!own&&p.touchCooldown>0)||flight?.follow&&p.team===flight.team)continue;
  const low=b.y<=CONTACT.legHeight,radius=(b.y>.65?.26:low?CONTACT.legRadius:.21)*(p.build||1)+FIELD.ballRadius,t=sweepCircle(previous,b,p,radius);if(t===null)continue;
  const y=previous.y+(b.y-previous.y)*t;if(y>(p.height||1.81)-.04)continue;
  const x=previous.x+(b.x-previous.x)*t,z=previous.z+(b.z-previous.z)*t,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz),rvx=v.x-p.vx,rvz=v.z-p.vz,s=Math.hypot(rvx,rvz)||1,nx=d>1e-8?dx/d:-rvx/s,nz=d>1e-8?dz/d:-rvz/s,incoming=rvx*nx+rvz*nz;
  // Others need a real strike. The dribbler's legs block a moving ball; a ball trapped still under the sole is not bumped.
  if(incoming<0&&(own?-incoming>CONTACT.ownClosing&&Math.hypot(v.x,v.z)>=CONTACT.ownMoving:v.length()>=2))hits.push({p,t,radius,nx,nz,incoming,y,own});
 }
 hits.sort((a,b)=>a.t-b.t||a.p.id-b.p.id);const hit=hits[0];if(!hit)return;
 const {p,radius,nx,nz,incoming,y,own}=hit;
 if(own){v.x-=incoming*(1+CONTACT.ownRestitution)*nx;v.z-=incoming*(1+CONTACT.ownRestitution)*nz;b.x=p.x+nx*(radius+.002);b.z=p.z+nz*(radius+.002);match.emit('bodyContact',{player:p,speed:Math.abs(incoming),own:true});return;}
 if(secondTouch(match,p))return;
 if(match.offside.has(p.id)){match.beginRestart({kind:'indirect',team:1-p.team,x:p.x,z:p.z,label:'오프사이드 · 간접 프리킥'});return;}
 v.x-=incoming*1.35*nx;v.z-=incoming*1.35*nz;b.x=p.x+nx*(radius+.002);b.z=p.z+nz*(radius+.002);b.y=y;
 p.touchCooldown=.15;match.lastTouch=p;match.lastTouchTeam=p.team;match.lastTouchKind='deflection';match.restartOrigin=null;match.owner=null;match.emit('bodyContact',{player:p,speed:Math.abs(incoming)});
}
