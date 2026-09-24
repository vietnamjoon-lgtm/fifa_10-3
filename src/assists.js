import {logicalFoot,footSign} from './contact-model.js';
import {FIELD,clamp,distance} from './config.js';
import {gameplayValue} from './gameplay-settings.js';
import {rollLaunchSpeed} from './physics.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,knockReleaseRadius:3.2,strideReach:.62,receiveRadius:1.04,contactRadius:.49};

export const footPosition=logicalFoot;

export function shotTarget(match,p,axis={x:0,z:0}){
 const dir=match.direction(p.team),forward=(axis.x||0)*dir;
 // A deliberate backwards shot retains its input direction.
 if(forward<-.25)return null;
 const keeper=match.players.find(q=>q.active&&q.team!==p.team&&q.role==='GK');
 const corner=Math.abs(axis.z||0)>.2?clamp(axis.z,-1,1)*2.65:
  keeper&&Math.abs(keeper.z)>.35?-Math.sign(keeper.z)*2.35:Math.abs(p.z)>.6?-Math.sign(p.z)*2.35:p.foot==='left'?-2.35:2.35;
 return {x:dir*(FIELD.halfLength+.25),z:corner};
}

export function groundPassSpeed(length,type='pass',ballRoll=100){
 // Invert the shared ground-roll model so the ball still arrives with a useful receiving speed.
 return clamp(rollLaunchSpeed(length,type==='through'?9.5:8,ballRoll),7,34);
}

export function passTarget(match,p,receiver,type='pass'){
 const d=distance(p,receiver),speed=groundPassSpeed(d,type);
 const flight=clamp(d/(speed*.77),.15,1.65);
 const lead=type==='through'?1:type==='lob'?.8:.72;
 const run=type==='through'?match.direction(p.team)*3.2:0;
 return {player:receiver,x:clamp(receiver.x+receiver.vx*flight*lead+run,-51,51),
  z:clamp(receiver.z+receiver.vz*flight*lead,-32,32)};
}

export function setKickTarget(action,ball,target){
 const dx=target.x-ball.x,dz=target.z-ball.z,n=Math.hypot(dx,dz)||1;
 action.aim={x:dx/n,z:dz/n};action.distance=n;
}

// Knock-on dribbling: the player plays the ball ahead of the stride and runs onto it.
// A faster run knocks it further; close control, shielding and a pending kick keep it short.
export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity;
 if(distance(p,b)>ASSIST.touchRadius||b.y>.38||p.touchCooldown>0)return false;
 const speed=Math.hypot(p.vx,p.vz),moving=speed>.35;
 const f=moving&&!preparing?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 const rx=b.x-p.x,rz=b.z-p.z,ahead=rx*f.x+rz*f.z,across=Math.abs(rx*f.z-rz*f.x),ballSpeed=Math.hypot(v.x,v.z);
 const onLine=ballSpeed>.5&&(v.x*f.x+v.z*f.z)/ballSpeed>.9&&across<.45;
 const pending=preparing||p.shield||!!p.intent;
 // A ball still running ahead on the player's line is not touched again until it is back within the stride.
 if(p.knockOn&&!pending&&onLine&&ahead>ASSIST.strideReach)return false;
 // Stopping without input: the ball is trapped under the sole instead of placed ahead of a run that is ending.
 const stopping=p.dribbleStop&&!preparing;
 const lead=preparing?.48:stopping?.45:p.shield?.34:p.closeControl?.4:.5+Math.min(speed,9)*.016;
 const side=footSign(p.action?.foot||p.turnPlan?.foot||p.foot)*.09;const target={x:p.x+f.x*lead+f.z*side,z:p.z+f.z*lead-f.x*side};
 const gain=stopping?3:moving||preparing?7:4;let dx=(target.x-b.x)*gain,dz=(target.z-b.z)*gain;
 const correction=Math.hypot(dx,dz),limit=stopping?1.5:3.6+p.control;
 if(correction>limit){dx*=limit/correction;dz*=limit/correction;}
 // Long knocks are only played into space: a nearby opponent shortens the touch.
 const space=pending||p.closeControl||!moving||!p.knockOn?0:clamp((Math.min(...match.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(p,q)),99)-2.5)/5,0,1);
 const knock=space*clamp(.08+.2*(speed-3)/5.6,.08,.28)*(1.3-.5*(p.control||.8))*speed;
 const carry=stopping?.4:1;let vx=p.vx*carry+dx,vz=p.vz*carry+dz;
 // The knock tops the ball up to run speed + knock; it does not stack on the placement correction,
 // so the ball stays within touching range for a stop, pass or shot.
 if(knock){const forward=vx*f.x+vz*f.z,extra=Math.max(0,speed+knock-forward);vx+=f.x*extra;vz+=f.z*extra;}
 const n=Math.hypot(vx,vz);
 match.physics.kick({x:vx,z:vz},n,.015);
 if(!preparing)p.dribblePose={start:match.time,foot:p.foot,duration:.20};
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:p.closeControl?.16:p.sprinting?.22:.20;
 return true;
}

/** The owner reaches a knocked-on ball before turning away from it. Sets p.knockOn and p.dribbleStop for dribbleTouch. */
export function dribbleSteer(match,p,axis){
 const b=match.physics.ball.position,d=distance(p,b),n=Math.hypot(axis.x,axis.z),speed=Math.hypot(p.vx,p.vz);
 p.knockOn=n>.5&&speed>2&&(p.vx*axis.x+p.vz*axis.z)/(speed*n)>.82;p.dribbleStop=n<.05;
 if(b.y>.5||d<=ASSIST.strideReach+.15)return axis;
 const bx=(b.x-p.x)/d,bz=(b.z-p.z)/d;
 return n>.05&&(axis.x*bx+axis.z*bz)/n<.5?{x:bx*n,z:bz*n}:axis;
}

/** Radius within which the owner keeps possession. A knocked-on ball ahead of the owner's run stays theirs. */
export function possessionRadius(match,p){
 const b=match.physics.ball.position,speed=Math.hypot(p.vx,p.vz);
 if(match.lastTouch!==p||speed<2)return ASSIST.releaseRadius;
 const rx=b.x-p.x,rz=b.z-p.z,ahead=(rx*p.vx+rz*p.vz)/speed,across=Math.abs(rx*p.vz-rz*p.vx)/speed;
 return ahead>0&&across<.6?ASSIST.knockReleaseRadius:ASSIST.releaseRadius;
}

export function cushionFirstTouch(match,p){
 const b=match.physics.ball,v=b.velocity;
 const relative=Math.hypot(v.x-p.vx,v.z-p.vz);
 const retained=relative>23?.48:clamp((.27-p.control*.20)/gameplayValue(match,'firstTouch'),.06,.21);
 const input=match.isHumanControlled(p)?match.inputForTeam(p.team):null,axis=input?.axis,n=Math.hypot(axis?.x||0,axis?.z||0),directed=n>.15&&relative<=23;
 const touchSpeed=clamp(Math.hypot(p.vx,p.vz)+.65,.9,3.4),targetX=directed?axis.x/n*touchSpeed:p.vx,targetZ=directed?axis.z/n*touchSpeed:p.vz;
 const vx=targetX+(v.x-targetX)*retained,vz=targetZ+(v.z-targetZ)*retained;
 match.physics.kick({x:vx,z:vz},Math.hypot(vx,vz),Math.min(Math.max(v.y,0)*.18,.35));
 p.touchCooldown=relative>23?.10:.11;p.dribbleTouch=.16;p.receiveUntil=match.time+.24;
 return relative<=27;
}
