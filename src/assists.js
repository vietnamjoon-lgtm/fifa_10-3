import {logicalFoot,footSign} from './contact-model.js';
import {FIELD,TUNING,clamp,distance} from './config.js';
import {gameplayValue} from './gameplay-settings.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,receiveRadius:1.04,contactRadius:.49};

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

export function groundPassSpeed(length,type='pass'){
 // Invert dv/ds = -rollingDrag - airDrag*v for a useful receiving speed.
 const k=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2/.43;
 const r=TUNING.rollingDrag+.012,arrival=type==='through'?6.2:4.5;
 return clamp((arrival+r/k)*Math.exp(k*length)-r/k,7,34);
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

export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position;
 if(distance(p,b)>ASSIST.touchRadius||b.y>.38||p.touchCooldown>0)return false;
 const speed=Math.hypot(p.vx,p.vz),moving=speed>.35;
 const f=moving&&!preparing?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 const lead=preparing?.48:p.shield?.34:p.closeControl?.4:.5+Math.min(speed,9)*.016;
 const side=footSign(p.action?.foot||p.turnPlan?.foot||p.foot)*.09;const target={x:p.x+f.x*lead+f.z*side,z:p.z+f.z*lead-f.x*side};
 const gain=moving||preparing?7:4;let dx=(target.x-b.x)*gain,dz=(target.z-b.z)*gain;
 const correction=Math.hypot(dx,dz),limit=3.6+p.control;
 if(correction>limit){dx*=limit/correction;dz*=limit/correction;}
 const vx=p.vx+dx,vz=p.vz+dz,n=Math.hypot(vx,vz);
 match.physics.kick({x:vx,z:vz},n,.015);
 if(!preparing)p.dribblePose={start:match.time,foot:p.foot,duration:.20};
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:p.closeControl?.16:p.sprinting?.22:.20;
 return true;
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
