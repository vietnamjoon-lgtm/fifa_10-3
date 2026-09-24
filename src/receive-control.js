import {clamp,distance,turnToward} from './config.js';
import {activePass,interceptPoint} from './ball-assistance.js';
import {chooseKickFoot,predictContact} from './contact-model.js';

export function prepareReception(match,p,dt,input){
 const b=match.physics.ball.position,v=match.physics.ball.velocity;
 if(match.owner||match.heldBy||match.setPiece||p.action||p.down>0||p.role==='GK'||p.touchCooldown>.12){p.receivePrep=null;return;}
 const d=distance(p,b),flight=activePass(match),intended=flight?.receiver===p.id,contact=predictContact(p,b,v,1.1);
 if(d>10||Math.hypot(v.x,v.z)<1.2||!intended&&(contact.distance>1.3||contact.time>.75)||match.offside.has(p.id)){p.receivePrep=null;return;}
 const target=intended?interceptPoint(match,p,1.25):{x:b.x+v.x*contact.time,y:Math.max(.11,contact.height),z:b.z+v.z*contact.time,time:contact.time};if(!target||target.time>1.1||target.y>1.85){p.receivePrep=null;return;}
 const toward={x:b.x-p.x,z:b.z-p.z},n=Math.hypot(toward.x,toward.z)||1,foot=chooseKickFoot(p,b,{x:toward.x/n,z:toward.z/n});
 const previous=p.receivePrep,start=previous?.start??match.time,weight=clamp((1.05-target.time)/.75,0,1),kind=target.y>1.4?'chest':target.y>.8?'thigh':target.y>.38?'instep':'inside';
 p.receivePrep={start,until:match.time+.1,eta:target.time,foot,kind,weight,target:{x:target.x,y:target.y,z:target.z}};
 const manuallyMoving=match.isHumanControlled(p)&&Math.hypot(input?.axis?.x||0,input?.axis?.z||0)>.12;
 if(!manuallyMoving&&d<4&&Math.hypot(p.vx,p.vz)<3.6){const facing=Math.atan2(toward.x,toward.z),open=match.direction(p.team)*Math.PI/2,diff=Math.atan2(Math.sin(open-facing),Math.cos(open-facing)),yaw=facing+clamp(diff,-.65,.65);p.yaw=turnToward(p.yaw,yaw,dt*(3+p.agility*3));}
}
