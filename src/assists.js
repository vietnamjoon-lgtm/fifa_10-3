import {logicalFoot} from './contact-model.js';
import {FIELD,clamp,distance,jogSpeed,sprintSpeed} from './config.js';
import {gameplayValue} from './gameplay-settings.js';
import {rollLaunchSpeed} from './physics.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,knockReleaseRadius:4,kickReach:3,pendingKick:1.5,kickStart:1.35,footReach:.22,footLane:.12,underfootReach:.45,stretchReach:.6,turnReach:.9,turnCarry:.2,laneLead:.1,dribbleGap:.7,turnKnock:.6,closeGap:.45,touchLead:.3,touchGap:.3,sprintTouchGap:.22,knockGap:1.58,knockStart:.3,knockPace:2,freshKnock:3.15,sprintKnockSpeed:2.5,sprintKickStart:.2,kickBurst:1.15,kickLook:.25,trapPace:2.5,lunge:.2,footForward:.35,dribbleStride:.35,startTouch:2.5,receiveRadius:1.04,contactRadius:.49};

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

/** Where a running foot meets the ball while dribbling: closer to the body than the kicking contact point. */
export function dribbleFoot(p,foot){const f=logicalFoot(p,foot),k=ASSIST.dribbleStride/.54;return {x:p.x+(f.x-p.x)*k,y:f.y,z:p.z+(f.z-p.z)*k};}

/** Whether a foot can play the ball now: within foot reach, under the body, or, while turning, anywhere
 * around the body that a swivel and the inside or sole of the foot can reach. */
export function footCanPlay(p,b,turning=false){
 const foot=Math.min(distance(dribbleFoot(p,'left'),b),distance(dribbleFoot(p,'right'),b));
 return foot<=(turning?ASSIST.stretchReach:ASSIST.footReach)||distance(p,b)<=(turning?ASSIST.turnReach:ASSIST.underfootReach);
}

/** How far a sprint knock plays the ball ahead: about 1.7 m, at most 2 m, for the reference player (pace 8.3, control 0.8); a faster
 * player knocks it further, a better ball controller a little shorter. */
export function knockDistance(p){const pace=clamp(Number.isFinite(p.pace)?p.pace:8.3,5,10),control=clamp(Number.isFinite(p.control)?p.control:.8,.2,1);
 return ASSIST.knockGap*(.3+.7*pace/8.3)*(1.2-.25*control);}
// Foot dribbling: a touch happens only when one of the player's feet reaches the ball. Each touch plays
// the ball back onto the player's running line, a little ahead of the stride; between touches it rolls
// freely. The touch is never slower than the run, so the ball does not hold the player back.
export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position;
 if(b.y>.38||p.touchCooldown>0)return false;
 const left=distance(dribbleFoot(p,'left'),b),right=distance(dribbleFoot(p,'right'),b),foot=left<right?'left':'right';
 const speed=Math.hypot(p.vx,p.vz),aim=p.dribbleAim,v=ball.velocity,ballSpeed=Math.hypot(v.x,v.z);
 // When the stick turns away from the ball's line, or the ball has dropped beside or behind the player on the
 // stick's line, the player stretches or swivels for it (the same reach the run is steered by).
 const lagging=!!aim&&(b.x-p.x)*aim.x+(b.z-p.z)*aim.z<ASSIST.footForward*.5;
 const turning=!!aim&&!preparing&&(lagging||ballSpeed<.5||(v.x*aim.x+v.z*aim.z)/ballSpeed<Math.cos(Math.PI/7));
 if(!footCanPlay(p,b,turning))return false;
 // On a straight run the ball is touched in a stride rhythm (touchGap) and only once the player is catching it;
 // a turn can be played at once.
 if(!turning&&!preparing&&!p.knockFresh&&match.time<(p.nextDribbleTouch||0))return false;
 if(!turning&&!preparing&&aim&&(v.x*aim.x+v.z*aim.z)>Math.hypot(p.vx,p.vz)+.6)return false;
 // A set-up touch before a kick keeps the ball on the kicking line the player faces.
 const f=preparing?{x:Math.sin(p.yaw),z:Math.cos(p.yaw)}:aim||(speed>.35?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)});
 // Each touch plays the ball to a spot ahead of the stride that the player reaches about half a second later.
 // A faster run in open space puts it further ahead; a nearby opponent or close control keeps it tight. A ball
 // behind or under the player is therefore played firmly out in front instead of being carried along.
 const space=clamp((Math.min(...match.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(p,q)),99)-2.5)/5,0,1);
 // Knock and run: every sprint touch in open space knocks the ball knockDistance ahead (about 2 m; 0.66 m at a jog) and
 // the player runs onto it for the next knock; the first knock after pressing sprint (or from a standstill) also goes
 // about 2 m. A nearby opponent
 // shortens an AI dribbler's knock back to a close touch; a human's sprint knocks past defenders too. A kick waits
 // until the ball is in reach (see kickInReach).
 const human=match.isHumanControlled(p),knockOn=p.sprinting&&!p.closeControl&&!preparing?(human?1:space):0;
 const carry=(ASSIST.dribbleGap+space*.03*speed)*(1.3-.5*(p.control||.8));
 const ahead=(b.x-p.x)*f.x+(b.z-p.z)*f.z,start=knockOn*Math.max(clamp(1-speed/jogSpeed(p),0,1),p.knockFresh?1:0),gap=p.closeControl?ASSIST.closeGap:carry+(knockDistance(p)*(1+ASSIST.knockStart*start)-carry)*knockOn,knock=clamp((gap-ahead)/ASSIST.touchLead,.15,4+ASSIST.knockPace*knockOn);
 // Every touch plays the ball in the stick's direction, however sharp the turn; only releasing the stick traps it.
 // A sharp turn plays it softly (about 3 m/s) so the turning player can follow; a gentle one keeps more of the pace.
 const along=p.vx*f.x+p.vz*f.z,trap=p.dribbleStop&&!preparing;
 const run=Math.max(turning?Math.max(along,speed*.7*Math.max(0,along/(speed||1))):speed,aim?ASSIST.startTouch:0);
 // A turn taken at pace is a short touch round the body; a standing start, or a ball that dropped behind on a
 // straight run, is played firmly out in front.
 const fresh=human&&p.knockFresh&&knockOn>0&&!turning&&!p.pendingKick&&!preparing&&!p.shield;
 // The first knock after pressing sprint runs a fixed amount faster than the player's own top sprint, so it lands about
 // 2 m ahead whether the player was standing, walking or jogging.
 const forward=fresh?sprintSpeed(p)*.96+ASSIST.freshKnock*(knockDistance(p)/ASSIST.knockGap)**1.5*knockOn:preparing||p.shield?speed*.9:p.pendingKick?run+.35:run+(turning&&speed>ASSIST.startTouch&&along<speed*.8?Math.min(knock,ASSIST.turnKnock):knock);
 // Sideways part: a quarter of the player's own sideways momentum (the body carries on through a cut) plus a small
 // correction toward the touching foot's side of the stick's line, so the ball goes where the stick points.
 // The line is taken through where the player's momentum carries the body over the next touch, not where it is now.
 const lead=ASSIST.laneLead,across=(b.x-p.x-p.vx*lead)*f.z-(b.z-p.z-p.vz*lead)*f.x,lane=(foot==='left'?-1:1)*ASSIST.footLane,side=(p.vx*f.z-p.vz*f.x)*ASSIST.turnCarry+clamp((lane-across)/.35,-1.5,1.5);
 const vx=trap?0:f.x*forward+f.z*side,vz=trap?0:f.z*forward-f.x*side;
 match.physics.kick({x:vx,z:vz},Math.hypot(vx,vz),.015);match.lastTouch=p;match.lastTouchTeam=p.team;
 if(!preparing)p.dribblePose={start:match.time,foot,duration:.20};
 if(!preparing&&knockOn>0)p.knockFresh=false;
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:.12;p.nextDribbleTouch=match.time+ASSIST.touchGap+(ASSIST.sprintTouchGap-ASSIST.touchGap)*knockOn;
 return true;
}

/** The owner runs at the stick's pace to where the next touch can send the ball along the stick: straight on when
 * a foot can reach it, otherwise toward the spot just behind it on the stick's line (or straight at a ball left
 * behind). Sets p.dribbleAim, p.dribbleStop and p.dribbleChase for dribbleTouch and move(). */
export function dribbleSteer(match,p,axis){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,n=Math.hypot(axis.x,axis.z);
 p.dribbleStop=n<.05;p.dribbleAim=n>=.05?{x:axis.x/n,z:axis.z/n}:null;p.dribbleChase=false;
 // Pressing sprint, or winning the ball with sprint held, arms a long first knock for the next touch (see dribbleTouch).
 if(p.sprinting&&!p.sprintHeld)p.knockFresh=true;if(!p.sprinting)p.knockFresh=false;p.sprintHeld=!!p.sprinting;
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
 // A ball the foot can reach now is simply played in the stick's direction by the next touch. A ball ahead is
 // chased toward the spot just behind it on the stick's line, at the stick's pace, so the next touch sends it on.
 if(footCanPlay(p,b,true)||t<.06)return p.dribbleChase?{x:dir.x,z:dir.z}:axis;
 const magnitude=p.dribbleChase?1:n;
 // A ball well off the stick's line (more than 45 degrees, e.g. on the right while the stick says left) is met by
 // the shortest route and played across by the first touch; the player never runs around it the wrong way.
 if(dir.x*bx+dir.z*bz<reach*Math.cos(Math.PI/4))return {x:bx/reach*magnitude,z:bz/reach*magnitude};
 return {x:tx/t*magnitude,z:tz/t*magnitude};
}

/** Extra reach of a lengthened last stride when the ball runs ahead of a moving kicker. */
export function kickLunge(p,a,b){
 const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz)||1,speed=Math.hypot(p.vx,p.vz);
 // A faster run lengthens the last stride more.
 return speed>2&&(dx*p.vx+dz*p.vz)/(d*speed)>Math.cos(Math.PI/4)?ASSIST.lunge+.05*speed:0;
}

/** Radius within which the owner keeps possession: the last player to touch a rolling ball stays its owner until it is out of reach. */
export function possessionRadius(match,p){return match.lastTouch===p?ASSIST.knockReleaseRadius:ASSIST.releaseRadius;}

/** A ball is controlled only when it reaches the feet or body: a stretched leg reaches about 0.75 m for a slow ball, less for a fast one. */
/** Distance at which a kick's windup may start. A sprinting dribbler's ball runs ahead at about the player's pace, so
 * the windup starts from further back and the last strides close the gap (see the approach burst in match.move). */
export function kickStartDistance(p){return ASSIST.kickStart+ASSIST.sprintKickStart*(p.sprinting?clamp((Math.hypot(p.vx,p.vz)-jogSpeed(p))/ASSIST.sprintKnockSpeed,0,1):0);}
/** Whether a kick's windup can start now: the ball, where it and the player will be a moment later, is within reach.
 * A knocked ball that runs away as fast as the player waits until the player has closed on it. */
export function kickInReach(p,ball,v){const t=ASSIST.kickLook,x=ball.x+v.x*t-p.x-p.vx*t,z=ball.z+v.z*t-p.z-p.vz*t;return Math.max(distance(p,ball),Math.hypot(x,z))<=kickStartDistance(p);}
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
