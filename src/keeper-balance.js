import {KEEPER} from './keeper-tuning.js';
import {keeperProfile} from './attributes.js';
import {clamp} from './config.js';

// A keeper needs reaction time and a reachable hand contact, even when AI steering is disabled.
export function keeperContact(match,p){const b=match.physics.ball.position,v=match.physics.ball.velocity,k=keeperProfile(p),speed=v.length(),dir=match.direction(p.team),dx=(b.x-p.x)*dir,dz=b.z-p.z,shot=match.lastTouchTeam!==p.team&&speed>7;
 if(shot&&match.time-match.lastKickTime<k.reaction)return null;
 if(dx<-KEEPER.behindReach||dx>KEEPER.forwardReach)return null;
 let reach=k.range,height=k.height,vertical=true;
 if(p.dive>0){const extension=clamp(((p.diveDuration||KEEPER.diveDuration)-p.dive)/KEEPER.diveExtension,0,1);reach=KEEPER.diveStartReach+(k.range-KEEPER.diveStartReach)*extension;if(dz*(p.diveDirection||1)<-.18)return null;const target=p.diveHeight??.7;vertical=Math.abs(b.y-target)<KEEPER.verticalTolerance+KEEPER.verticalReflex*p.reflexes;height=2.25;}
 const lateral=Math.abs(dz),ellipse=(dx/KEEPER.forwardReach)**2+(lateral/reach)**2;
 if(ellipse>1||b.y>height||!vertical)return null;
 const relative=Math.hypot(v.x-p.vx,v.y,v.z-p.vz),stretched=lateral>reach*.77||p.dive>0;
 return {catchable:relative<k.catchSpeed*(stretched?.76:1),target:{x:b.x,y:b.y,z:b.z}};
}
