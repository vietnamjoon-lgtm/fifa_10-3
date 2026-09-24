import {logicalFoot} from './contact-model.js';
import {FIELD,clamp,distance} from './config.js';
import {gameplayValue} from './gameplay-settings.js';
import {rollLaunchSpeed} from './physics.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,knockReleaseRadius:4,kickReach:2.2,footReach:.4,underfootReach:.45,stretchReach:.6,lunge:.35,footForward:.5,startTouch:2.5,receiveRadius:1.04,contactRadius:.49};

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

/** Whether a foot can play the ball now: within foot reach, under the body, or at a stretch while turning. */
export function footCanPlay(p,b,turning=false){
 const foot=Math.min(distance(logicalFoot(p,'left'),b),distance(logicalFoot(p,'right'),b));
 return foot<=(turning?ASSIST.stretchReach:ASSIST.footReach)||distance(p,b)<=ASSIST.underfootReach;
}

// Foot dribbling: a touch happens only when one of the player's feet reaches the ball. Each touch plays
// the ball back onto the player's running line, a little ahead of the stride; between touches it rolls
// freely. The touch is never slower than the run, so the ball does not hold the player back.
export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position;
 if(b.y>.38||p.touchCooldown>0)return false;
 const left=distance(logicalFoot(p,'left'),b),right=distance(logicalFoot(p,'right'),b),foot=left<right?'left':'right';
 const speed=Math.hypot(p.vx,p.vz),aim=p.dribbleAim,v=ball.velocity,ballSpeed=Math.hypot(v.x,v.z);
 // When the stick turns away from the ball's line, the player stretches for a turning touch.
 const turning=!!aim&&!preparing&&(ballSpeed<.5||(v.x*aim.x+v.z*aim.z)/ballSpeed<Math.cos(Math.PI/7));
 if(!footCanPlay(p,b,turning))return false;
 // A set-up touch before a kick keeps the ball on the kicking line the player faces.
 const f=preparing?{x:Math.sin(p.yaw),z:Math.cos(p.yaw)}:aim||(speed>.35?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)});
 // Long knocks are only played into space: a nearby opponent shortens the touch.
 const space=clamp((Math.min(...match.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(p,q)),99)-2.5)/5,0,1);
 const knock=(.25+space*.12*speed)*(1.3-.5*(p.control||.8));
 // Turning back (the stick against the run) traps the ball under the sole; the player stops and comes round.
 // Other turns play the ball at up to 70% of the run; a straight run is never slower than the player.
 const along=p.vx*f.x+p.vz*f.z,trap=p.dribbleStop&&!preparing||turning&&along<0;
 const run=Math.max(turning?Math.max(along,speed*.7):speed,aim?ASSIST.startTouch:0);
 const forward=preparing||p.shield?speed*.9:p.closeControl||turning?run+.35:run+knock;
 // Sideways part: keep the player's own sideways pace and bring the ball back onto the running line
 // within about a third of a second.
 const across=(b.x-p.x)*f.z-(b.z-p.z)*f.x,side=p.vx*f.z-p.vz*f.x+clamp(-across/.35,-3,3);
 const vx=trap?0:f.x*forward+f.z*side,vz=trap?0:f.z*forward-f.x*side;
 match.physics.kick({x:vx,z:vz},Math.hypot(vx,vz),.015);match.lastTouch=p;match.lastTouchTeam=p.team;
 if(!preparing)p.dribblePose={start:match.time,foot,duration:.20};
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:.16;
 return true;
}

/** The owner follows the stick while the ball stays playable: within stretching reach, or ahead inside the
 * stick's 30-degree cone. Only a ball left behind or out to the side pulls the run toward the spot behind it.
 * Sets p.dribbleAim, p.dribbleStop and p.dribbleChase for dribbleTouch and move(). */
export function dribbleSteer(match,p,axis){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,n=Math.hypot(axis.x,axis.z);
 p.dribbleStop=n<.05;p.dribbleAim=n>=.05?{x:axis.x/n,z:axis.z/n}:null;p.dribbleChase=false;
 if(b.y>.5)return axis;
 const speed=Math.hypot(p.vx,p.vz),ballSpeed=Math.hypot(v.x,v.z),d=distance(p,b);
 const ahead=Math.min(.45,d/(speed+2)),bx=b.x+v.x*ahead-p.x,bz=b.z+v.z*ahead-p.z,reach=Math.hypot(bx,bz)||1;
 // A ball running away is chased at full speed whatever the sprint button says.
 p.dribbleChase=d>1.3&&ballSpeed>speed-.3;
 const dir=p.dribbleAim||{x:bx/reach,z:bz/reach};
 const tx=bx-dir.x*ASSIST.footForward,tz=bz-dir.z*ASSIST.footForward,t=Math.hypot(tx,tz);
 if(p.dribbleStop){
  // Without input the player walks onto the ball and stops it.
  if(t<.06||t<.25&&ballSpeed<.3)return {x:0,z:0};
  const magnitude=p.dribbleChase?1:clamp(t*1.6,0,1);return {x:tx/t*magnitude,z:tz/t*magnitude};
 }
 const playable=footCanPlay(p,b,true)||(dir.x*bx+dir.z*bz)/reach>Math.cos(Math.PI/6);
 if(playable||t<.06)return p.dribbleChase?{x:dir.x,z:dir.z}:axis;
 const magnitude=p.dribbleChase?1:n;
 // A ball on the far side of the stick (turning back) is met directly and dragged round, not run around.
 if(dir.x*bx+dir.z*bz<0)return {x:bx/reach*magnitude,z:bz/reach*magnitude};
 return {x:tx/t*magnitude,z:tz/t*magnitude};
}

/** Extra reach of a lengthened last stride when the ball runs ahead of a moving kicker. */
export function kickLunge(p,a,b){
 const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz)||1,speed=Math.hypot(p.vx,p.vz);
 return speed>2&&(dx*p.vx+dz*p.vz)/(d*speed)>Math.cos(Math.PI/6)?ASSIST.lunge:0;
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
