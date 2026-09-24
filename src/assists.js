import {logicalFoot} from './contact-model.js';
import {FIELD,clamp,distance} from './config.js';
import {gameplayValue} from './gameplay-settings.js';
import {rollLaunchSpeed} from './physics.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,knockReleaseRadius:2.6,footReach:.3,underfootReach:.38,footForward:.5,startTouch:3.5,receiveRadius:1.04,contactRadius:.49};

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

// Foot dribbling: a touch happens only when one of the player's feet reaches the ball. The touch plays
// the ball in the wanted direction; between touches it rolls freely and the player has to run onto it.
export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position;
 if(b.y>.38||p.touchCooldown>0)return false;
 const left=distance(logicalFoot(p,'left'),b),right=distance(logicalFoot(p,'right'),b),foot=left<right?'left':'right';
 // A ball under the body can still be played with the sole or inside of the foot.
 if(Math.min(left,right)>ASSIST.footReach&&distance(p,b)>ASSIST.underfootReach)return false;
 const speed=Math.hypot(p.vx,p.vz),aim=p.dribbleAim;
 // A set-up touch before a kick keeps the ball on the kicking line the player faces.
 const f=preparing?{x:Math.sin(p.yaw),z:Math.cos(p.yaw)}:aim||(speed>.35?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)});
 // Long knocks are only played into space: a nearby opponent shortens the touch.
 const space=clamp((Math.min(...match.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(p,q)),99)-2.5)/5,0,1);
 const knock=(.3+space*.2*speed)*(1.3-.5*(p.control||.8));
 // With the stick held, the first touch from a standstill already plays the ball ahead of the accelerating player.
 const run=aim?Math.max(speed,ASSIST.startTouch):speed;
 const out=p.dribbleStop&&!preparing?0:preparing||p.shield?speed*.9:p.closeControl?run+.35:run+knock;
 match.physics.kick(f,out,.015);match.lastTouch=p;match.lastTouchTeam=p.team;
 if(!preparing)p.dribblePose={start:match.time,foot,duration:.20};
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:.2;
 return true;
}

/** The owner runs onto the ball: toward the spot where a foot meets it on the wanted line. Sets p.dribbleAim and p.dribbleStop. */
export function dribbleSteer(match,p,axis){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,n=Math.hypot(axis.x,axis.z);
 p.dribbleStop=n<.05;p.dribbleAim=n>=.05?{x:axis.x/n,z:axis.z/n}:null;
 if(b.y>.5)return axis;
 const speed=Math.hypot(p.vx,p.vz),ahead=Math.min(.45,distance(p,b)/(speed+2));
 const bx=b.x+v.x*ahead,bz=b.z+v.z*ahead,toBall=Math.hypot(bx-p.x,bz-p.z)||1;
 const dir=p.dribbleAim||{x:(bx-p.x)/toBall,z:(bz-p.z)/toBall};
 const tx=bx-dir.x*ASSIST.footForward-p.x,tz=bz-dir.z*ASSIST.footForward-p.z,d=Math.hypot(tx,tz);
 if(d<.06||n<.05&&d<.25&&Math.hypot(v.x,v.z)<.3)return n<.05?{x:0,z:0}:axis;
 // Without input the player still goes after a loose touch, then stops on the ball.
 const magnitude=n>=.05?n:clamp(d*1.6,0,1);
 return {x:tx/d*magnitude,z:tz/d*magnitude};
}

/** Radius within which the owner keeps possession: the last player to touch a rolling ball stays its owner until it is out of reach. */
export function possessionRadius(match,p){return match.lastTouch===p?ASSIST.knockReleaseRadius:ASSIST.releaseRadius;}

/** A ball is controlled only when it reaches the feet or body: a stretched leg reaches about 0.75 m for a slow ball, less for a fast one. */
export function controlReach(p,relative){return (.5+.3*(p.control||.8))*clamp(1.25-relative/24,.45,1);}

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
