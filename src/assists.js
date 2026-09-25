import {logicalFoot} from './contact-model.js';
import {FIELD,TUNING,clamp,distance} from './config.js';
import {gameplayValue} from './gameplay-settings.js';
import {rollLaunchSpeed,rollAfter} from './physics.js';
import {gaitTargets,stepDrive} from './gait.js';
import {locomotionCadence,stanceFraction} from './motion-planner.js';

// Foot touches and initial targeting. Target-following pass velocity is handled
// separately by guided-pass.js; shots retain their unassisted physical flight.
export const ASSIST={touchRadius:1.12,releaseRadius:1.65,knockReleaseRadius:4,kickReach:3,pendingKick:1.5,kickStart:1.35,footReach:.28,footLane:.12,underfootReach:.45,stretchReach:.6,turnReach:.9,turnCarry:.3,dribbleGap:1.1,turnKnock:.6,closeGap:.8,touchLead:.45,trapPace:2.5,lunge:.2,footForward:.5,startTouch:2.5,receiveRadius:1.04,contactRadius:.49,
 instep:.1,contactReach:.21,contactSwing:.9,syncSpeed:1.6,touchEvery:.7,spaceEvery:.25,closeEvery:.35,footSpeed:4,reachMin:.04,reachMax:.2,trapReach:.12,strideRamp:.1,pullDecay:.12,ankleBehind:.26,reachWait:1,legSlack:.05,reachFront:.3,reachLead:.2,recoverAhead:.6,recoverLead:.3,recoverKnock:2.2,recoverWindow:1,agileWindow:.6,agilePace:.93,strideWarp:.2,underBody:.2,cutMin:.6,cutMax:1.9,cutRate:12,cutPace:.8,cutAlign:.1,cutWait:.5,cutKnock:1.6,cutLead:.9,cutLane:.12,dragTime:.06,dragMin:1,dragWait:.25,dragEase:.04,dragRest:.25,meetBall:.14,meetStride:.14};
const TAU=Math.PI*2,wrap1=x=>(x%1+1)%1;

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

/** Whether a foot can play the ball now: within foot reach, under the body, or, while turning, anywhere
 * around the body that a swivel and the inside or sole of the foot can reach. */
export function footCanPlay(p,b,turning=false){
 const foot=Math.min(distance(logicalFoot(p,'left'),b),distance(logicalFoot(p,'right'),b));
 return foot<=(turning?ASSIST.stretchReach:ASSIST.footReach)||distance(p,b)<=(turning?ASSIST.turnReach:ASSIST.underfootReach);
}

/** Each foot's instep (world position) and how far through its swing it is (null while planted), taken from the
 * same gait the renderer draws, so a touch can wait for the foot the player is actually swinging. */
export function strideFeet(p,phase=p.motionPhase||0,at=p){
 const g=gaitTargets(at,phase),stance=stanceFraction(stepDrive(at)),s=Math.sin(at.yaw),c=Math.cos(at.yaw);
 return g.feet.map((f,i)=>{const cycle=wrap1(phase/TAU+i*.5),z=f.z+ASSIST.instep;
  return {foot:i?'right':'left',x:at.x+z*s+f.x*c,z:at.z+z*c-f.x*s,swing:g.contacts[i]?null:(cycle-stance)/(1-stance)};});
}

/** How far the ball is beyond what a leg can reach (negative: reachable). The ankle has to get just behind the ball's
 * centre, from the hip, with the leg at full length; the same geometry the reaching pose is solved with. */
export function legShortfall(p,b,foot){
 const g=gaitTargets(p,p.motionPhase||0),m=g.metrics,s=Math.sin(p.yaw),c=Math.cos(p.yaw),dx=b.x-p.x,dz=b.z-p.z,side=foot==='left'?-1:1;
 return Math.hypot(dx*s+dz*c-ASSIST.ankleBehind,dx*c-dz*s-side*m.hipX,g.hipY+m.hipOffset-.165)-(m.upperLeg+m.lowerLeg);
}

/** The foot pulls the pose draws (motion.js): each eases one foot onto the ball from `from` to `at` and back into the
 * stride over pullDecay afterwards. Pulls are only ever added or given a fixed target, never cut short, so a new touch
 * cannot make a foot jump. `target` is fixed at the moment of contact; until then the foot follows the ball. */
function posePulls(p,match,add=null,freezeFoot=null){
 // The touch happens inside the physics step and the ball moves on before the step is drawn, so the contact point is
 // where the ball is at the end of the step (where the drawn foot was following it).
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,x=b.x+v.x*TUNING.step,z=b.z+v.z*TUNING.step;
 let list=(p.dribblePose?.pulls||[]).filter(q=>match.time<q.at+(q.hold||0)+ASSIST.pullDecay);
 // A touch changes where the ball goes, so a stride planned to meet it that has not begun easing on is dropped (its
 // weight is still zero, so nothing moves); left in, it eased the foot onto the ball with no touch to follow and the
 // boot, inside the ball, was then pushed out of it in a few milliseconds.
 if(freezeFoot)list=list.filter(q=>!(q.stride&&match.time<q.from));
 // Any touch fixes every pull already under way: a foot that was reaching for the ball does not chase it once it is played.
 if(freezeFoot)list=list.map(q=>!q.target&&match.time>=q.from?{...q,target:{x,z},settle:true,...(q.drag?{hold:Math.max(0,match.time-q.at)}:{})}:q);
 return add?[...list,add]:list;
}

/** After the physics step: a contact point fixed during the step is moved to exactly where the ball ended the step, the
 * position the drawn foot was following, so fixing it never moves the foot (Match.step calls this). */
export function settlePosePulls(match){
 const b=match.physics.ball.position;
 for(const p of match.players){
  // A skill move's touch: where the ball ended the step is the contact point its foot eases off from.
  for(const e of p.action?.events||[])if(e.settle){e.spot={x:b.x,y:b.y,z:b.z};e.settle=false;}
  const pulls=p.dribblePose?.pulls;if(!pulls?.some(q=>q.settle))continue;
  p.dribblePose={...p.dribblePose,pulls:pulls.map(q=>q.settle?{...q,target:{x:b.x,z:b.z},settle:false}:q)};}
}

/** Where the reaching foot's instep is drawn now, as motion.js reachFoot blends it from the stride toward just behind
 * the ball (the pull that follows the ball, weight rising from `from` to `at`); its distance to the ball. */
function reachingInstepDistance(match,p,foot){
 const q=(p.dribblePose?.pulls||[]).find(q=>q.foot===foot&&!q.target&&!q.stride&&match.time>=q.from&&match.time<q.at);if(!q)return Infinity;
 const b=match.physics.ball.position,u=clamp((match.time-q.from)/Math.max(.001,q.at-q.from),0,1),w=u*u*(3-2*u);
 const f=strideFeet(p).find(f=>f.foot===foot),s=Math.sin(p.yaw),c=Math.cos(p.yaw),d=Math.hypot(b.x-p.x,b.z-p.z);
 // The pull's target: the ankle ANKLE_BEHIND (0.26 m) behind the ball's centre along the facing, instep 0.1 m ahead of it.
 const tx=b.x-s*.16,tz=b.z-c*.16,x=f.x+(tx-f.x)*w,z=f.z+(tz-f.z)*w;
 return d>1.5?Infinity:Math.hypot(b.x-x,b.z-z);
}

/** How long the foot takes to get from where the stride has it to just behind the ball, at footSpeed. */
function reachTime(p,b,foot){
 const g=gaitTargets(p,p.motionPhase||0),i=foot==='left'?0:1,f=g.feet[i],s=Math.sin(p.yaw),c=Math.cos(p.yaw),dx=b.x-p.x,dz=b.z-p.z;
 return clamp(Math.hypot(dx*s+dz*c-ASSIST.ankleBehind-f.z,dx*c-dz*s-f.x,.09-f.y)/ASSIST.footSpeed,ASSIST.reachMin,ASSIST.reachMax);
}

/** Upcoming moments at which a foot reaches the planned point of its swing, with where its instep will be, assuming
 * the player keeps running along `f` at `pace` (the current pace unless given). */
function strideEvents(p,f,horizon,pace=Math.hypot(p.vx,p.vz)){
 const speed=Math.hypot(p.vx,p.vz),drive=stepDrive(p),rate=locomotionCadence(drive,p.motionStyle,p)/TAU,stance=stanceFraction(drive),mark=stance+ASSIST.contactSwing*(1-stance),out=[];
 if(!(rate>0))return out;
 const phase=p.motionPhase||0,yaw=Math.atan2(f.x,f.z);
 for(let i=0;i<2;i++)for(let n=0;;n++){const T=(wrap1(mark-wrap1(phase/TAU+i*.5))+n)/rate;if(T>horizon)break;if(T<.12)continue;
  const at={...p,x:p.x+f.x*pace*T,z:p.z+f.z*pace*T,vx:f.x*speed,vz:f.z*speed,yaw},q=strideFeet(p,phase+TAU*rate*T,at)[i];out.push({T,foot:q.foot,x:q.x,z:q.z,body:at});}
 return out.sort((a,b)=>a.T-b.T);
}

/** Ground speed that rolls the ball `distance` metres in exactly `T` seconds (the ball slows as it rolls). */
function rollSpeedFor(distance,T,ballRoll){let lo=0,hi=30;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(rollAfter(mid,T,ballRoll).travel<distance)lo=mid;else hi=mid;}return (lo+hi)/2;}

/** A touch timed to the stride: the ball is sent to where a later swing of one of the feet will meet it. The swing
 * nearest the wanted touch interval is chosen, as long as the roll does not open more than the wanted gap. */
function stridePlannedKick(match,p,f,gap,every,pace=Math.hypot(p.vx,p.vz)){
 const b=match.physics.ball.position,speed=pace,ballRoll=match.gameplay?.ballRoll;let best=null;
 for(const e of strideEvents(p,f,2.2,pace)){const dx=e.x-b.x,dz=e.z-b.z,d=Math.hypot(dx,dz);if(d<.05)continue;
  const v=rollSpeedFor(d,e.T,ballRoll);let lead=0;for(let t=.05;t<e.T;t+=.05)lead=Math.max(lead,rollAfter(v,t,ballRoll).travel-speed*t);
  const score=Math.abs(e.T-every)+Math.max(0,lead+ASSIST.footForward-gap)*2;if(!best||score<best.score)best={score,v,x:dx/d,z:dz/d,event:e};}
 return best;
}

/** A touch that turns the ball back against its roll is a drag, as in FC Online: the boot stays on the ball while its
 * velocity turns from `v0` to the touch's over dragTime (2-5 ticks of 1/60 s in the footage), instead of in one step.
 * applyBallDrag (called by Match.step before the physics step) moves the ball's velocity; the touching foot's pull
 * follows the ball for the whole drag (`hold`) and eases off once it ends. */
function startDrag(match,p,v1,foot){
 const b=match.physics.ball.position,v=match.physics.ball.velocity,t=match.time;
 // Every pull under way is fixed at the contact point as for any touch (their weights are never changed, so no foot
 // jumps); the drag adds its own pull, easing the foot onto the ball from zero and holding it there until the drag ends.
 // A foot not yet on the ball gets there first (at footSpeed, as a reach does). The ball turns only once the leg can
 // reach it (applyBallDrag); until then the player keeps running at it (dribbleSteer), as in the footage, where the
 // body brakes only after the boot is on the ball.
 const arrive=Math.max(ASSIST.dragEase,reachTime(p,{x:b.x+v.x*.03,z:b.z+v.z*.03},foot));
 const list=[...posePulls(p,match,null,foot),{foot,from:t,at:t+arrive,hold:9,target:null,drag:true}];
 p.ballDrag={v0:{x:v.x,z:v.z},v1,start:t+arrive,foot,pending:true};p.dribblePose={start:t,foot,duration:.20,pulls:list};p.strideNext=null;
}
/** Moves a drag's ball on for this step (see startDrag); a ball that got away from the dragger is let go. */
export function applyBallDrag(match){
 for(const p of match.players){const d=p.ballDrag;if(!d)continue;const b=match.physics.ball.position;
  if(match.owner!==p||p.action||b.y>.38||distance(p,b)>1.4||match.time<d.start-1){p.ballDrag=null;continue;}
  // The stick moved off the drag's line (more than 90 degrees): a drag whose foot is not on the ball yet is dropped; one
  // under way turns the ball onto the new line at the run's pace instead, so ball and body never part.
  const aim=p.dribbleAim,n1=Math.hypot(d.v1.x,d.v1.z);
  if(aim&&n1>0&&(aim.x*d.v1.x+aim.z*d.v1.z)/n1<0){
   if(d.pending){p.ballDrag=null;endDragPull(match,p,d.foot);continue;}
   const run=Math.max(Math.hypot(p.vx,p.vz),n1*.5);d.v1={x:aim.x*run,z:aim.z*run};}
  if(match.time<d.start)continue;
  if(d.pending){if(legShortfall(p,b,d.foot)>0&&match.time<d.start+ASSIST.dragWait)continue;const v=match.physics.ball.velocity;d.pending=false;d.start=match.time;d.v0={x:v.x,z:v.z};}
  const u=clamp((match.time-d.start)/ASSIST.dragTime,0,1),e=u*u*(3-2*u),vx=d.v0.x+(d.v1.x-d.v0.x)*e,vz=d.v0.z+(d.v1.z-d.v0.z)*e;
  // The foot carries the ball: its ground velocity (and roll) are set, it is not struck (so it is no kick).
  const ball=match.physics.ball;ball.velocity.x=vx;ball.velocity.z=vz;ball.angularVelocity.set(vz/FIELD.ballRadius,0,-vx/FIELD.ballRadius);ball.wakeUp();
  // The drag is over: the foot eases off from where the ball leaves it (its pull's hold ends now).
  // After the turn the ball rolls off ahead of the turning body; the next touch waits for the player to catch up
  // (about 0.3 s in the footage) rather than reaching after a ball rolling past the feet.
  if(u>=1){p.ballDrag=null;endDragPull(match,p,d.foot);p.touchCooldown=Math.max(p.touchCooldown,ASSIST.dragRest);p.dragRestUntil=match.time+ASSIST.dragRest;}}
}
/** Ends the hold of a drag's foot pull now: the foot eases off from where the ball leaves it. */
function endDragPull(match,p,foot){
 const pulls=p.dribblePose?.pulls;if(pulls)p.dribblePose={...p.dribblePose,pulls:pulls.map(q=>q.foot===foot&&q.drag&&!q.target?{...q,hold:Math.max(0,match.time-q.at),settle:true}:q)};
}
/** Plays a dribble touch: a drag when it turns the ball back against its roll (beyond cutMax), otherwise at once. */
function playTouch(match,p,vx,vz,foot){
 const v=match.physics.ball.velocity,bv=Math.hypot(v.x,v.z);
 // Only a turn back (beyond cutMax from the roll) is dragged; anything less is a cut, played at once.
 if(bv>ASSIST.dragMin&&v.x*vx+v.z*vz<Math.cos(ASSIST.cutMax)*bv*Math.hypot(vx,vz)){startDrag(match,p,{x:vx,z:vz},foot);return true;}
 match.physics.kick({x:vx,z:vz},Math.hypot(vx,vz),.015);return false;
}
/** A touch that sends the ball off the run's line (cutMin..cutMax radians) is a cut: the body leaves with the ball on its
 * new line (Match.move turns the run at cutRate), as in FC Online, where ball and body share the new line after a cut. */
function startCut(match,p,vx,vz){
 const speed=Math.hypot(p.vx,p.vz),n=Math.hypot(vx,vz);if(speed<ASSIST.syncSpeed||n<.3)return;
 const angle=Math.acos(clamp((p.vx*vx+p.vz*vz)/(speed*n),-1,1));
 p.cutTo=angle>ASSIST.cutMin&&angle<ASSIST.cutMax?{x:vx/n,z:vz/n,at:match.time}:null;
}
// Foot dribbling: a touch happens only when one of the player's feet reaches the ball. Each touch plays
// the ball back onto the player's running line, a little ahead of the stride; between touches it rolls
// freely. The touch is never slower than the run, so the ball does not hold the player back.
export function dribbleTouch(match,p,preparing=false){
 const ball=match.physics.ball,b=ball.position;
 if(b.y>.38)return false;
 // The cooldown keeps one touch from being played twice, but a swinging boot that actually meets the ball plays it: held
 // back, it swept through the ball and was flicked up over it (37 m/s at a sprint).
 // (Only the other foot, with the ball closing on it: the foot that has just played the ball is still beside it.)
 // After a drag the ball is meant to roll off past the turning body, so its rest is kept whole.
 if(p.touchCooldown>0){const v=match.physics.ball.velocity,rx=v.x-p.vx,rz=v.z-p.vz;
  if(preparing||match.time<(p.dragRestUntil??-9)||!strideFeet(p).some(q=>q.foot!==p.dribblePose?.foot&&q.swing!==null&&q.swing>=.3&&Math.hypot(b.x-q.x,b.z-q.z)<ASSIST.meetStride&&(q.x-b.x)*rx+(q.z-b.z)*rz>0))return false;}
 // A drag under way (startDrag) is playing the ball already.
 if(p.ballDrag&&!preparing)return false;
 const left=distance(logicalFoot(p,'left'),b),right=distance(logicalFoot(p,'right'),b),foot=left<right?'left':'right';
 const speed=Math.hypot(p.vx,p.vz),aim=p.dribbleAim,v=ball.velocity,ballSpeed=Math.hypot(v.x,v.z);
 // When the stick turns away from the ball's line, or the ball has dropped beside or behind the player on the
 // stick's line, the player stretches or swivels for it (the same reach the run is steered by).
 const lagging=!!aim&&(b.x-p.x)*aim.x+(b.z-p.z)*aim.z<ASSIST.footForward*.5;
 const turning=!!aim&&!preparing&&(lagging||ballSpeed<.5||(v.x*aim.x+v.z*aim.z)/ballSpeed<Math.cos(Math.PI/7));
 // A reach already under way is completed: the foot has followed the ball there.
 const committed=!preparing&&p.touchWindup?.at!=null&&match.time>=p.touchWindup.at&&match.time<=p.touchWindup.at+.1&&distance(p,b)<ASSIST.turnReach+.5;
 if(!committed&&!footCanPlay(p,b,turning))return false;
 // A set-up touch before a kick keeps the ball on the kicking line the player faces.
 const f=preparing?{x:Math.sin(p.yaw),z:Math.cos(p.yaw)}:aim||(speed>.35?{x:p.vx/speed,z:p.vz/speed}:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)});
 // Each touch plays the ball to a spot ahead of the stride that the player reaches about half a second later.
 // A faster run in open space puts it further ahead; a nearby opponent or close control keeps it tight. A ball
 // behind or under the player is therefore played firmly out in front instead of being carried along.
 const space=clamp((Math.min(...match.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(p,q)),99)-2.5)/5,0,1);
 const ahead=(b.x-p.x)*f.x+(b.z-p.z)*f.z,gap=p.closeControl||p.agile?ASSIST.closeGap:(ASSIST.dribbleGap+space*.08*speed)*(1.3-.5*(p.control||.8));
 // A ball that a running player has caught up with just after changing direction (beside, under or behind the body) is
 // tapped back out to recoverAhead in front within recoverLead seconds, never more than recoverKnock faster than the run:
 // a softer tap left it carried under the body, and knocking it to the full dribble gap made it shoot away. Setting off
 // with the ball behind still plays it firmly out in front.
 const recovering=turning&&speed>=ASSIST.syncSpeed&&ahead<ASSIST.footForward&&match.time-(p.aimTurnAt??-9)<ASSIST.recoverWindow,knock=recovering?clamp((ASSIST.recoverAhead-ahead)/ASSIST.recoverLead,.3,ASSIST.recoverKnock):clamp((gap-ahead)/ASSIST.touchLead,.3,4);
 // Every touch plays the ball in the stick's direction, however sharp the turn; only releasing the stick traps it.
 // A sharp turn plays it softly (about 3 m/s) so the turning player can follow; a gentle one keeps more of the pace.
 const along=p.vx*f.x+p.vz*f.z,trap=p.dribbleStop&&!preparing;
 // A ball that has already stopped at the feet is left alone; stopping it again every moment made the standing foot twitch.
 if(trap&&ballSpeed<.05&&speed<.3)return false;
 // While the body is still turning onto the line a cut sent the ball along, a ball still in front is left to roll: a
 // tap (stride or correction) then came with the foot short of the ball.
 if(p.cutTo&&!preparing&&!trap&&aim&&(b.x-p.x)*aim.x+(b.z-p.z)*aim.z>ASSIST.footForward*.5)return false;
 // Running dribble: the ball is played only when the instep of a swinging foot actually meets it, and it is sent to
 // where a later stride will meet it again. A ball slipping under the body or out of the stride's lane is still
 // played by the nearest foot below, so possession never depends on the stride alone.
 if(!preparing&&!turning&&!trap&&!p.shield&&!p.pendingKick&&speed>=ASSIST.syncSpeed){
  // The feet travel along the run, so whether the stride can still meet the ball is judged along the run.
  const h={x:p.vx/speed,z:p.vz/speed},run0=(b.x-p.x)*h.x+(b.z-p.z)*h.z,across0=Math.abs((b.x-p.x)*h.z-(b.z-p.z)*h.x);
  const swing=strideFeet(p).filter(q=>q.swing!==null&&q.swing>=.3).map(q=>({...q,d:Math.hypot(b.x-q.x,b.z-q.z)})).filter(q=>q.d<=ASSIST.contactReach).sort((a,c)=>a.d-c.d)[0];
  // The stride that was planned to meet the ball is already easing onto it; a touch a moment before that is held back
  // so the foot arrives on the ball rather than being pulled onto it.
  const planned=p.strideNext&&match.time<p.strideNext.at+ASSIST.pullDecay&&p.strideNext.at<match.time+3?p.strideNext:null;
  if(swing&&planned&&swing.foot===planned.foot&&match.time<planned.at-.004&&planned.at-match.time<ASSIST.strideRamp&&run0>ASSIST.underBody)return false;
  if(swing){const plan=stridePlannedKick(match,p,f,gap,p.closeControl||p.agile?ASSIST.closeEvery:ASSIST.touchEvery+ASSIST.spaceEvery*space);
   if(plan){
    // A stride touch that cuts the ball onto a new line is played firmly enough to lead the body out of the cut.
    const cut=Math.acos(clamp((p.vx*plan.x+p.vz*plan.z)/(speed*(Math.hypot(plan.x,plan.z)||1)),-1,1))>ASSIST.cutMin;if(cut)plan.v=Math.max(plan.v,speed*ASSIST.cutPace+ASSIST.cutKnock);
    const dragged=playTouch(match,p,plan.x*plan.v,plan.z*plan.v,swing.foot);match.lastTouch=p;match.lastTouchTeam=p.team;if(!dragged)startCut(match,p,plan.x,plan.z);
    if(dragged){p.touchWindup=null;p.dribbleTouch=.16;p.touchCooldown=.16;return true;}
    // The foot on the ball keeps to the contact point as it eases off; the stride planned to meet the ball next eases on.
    const at=match.time+plan.event.T;p.strideNext={at,foot:plan.event.foot};
    p.dribblePose={start:match.time,foot:swing.foot,duration:.20,pulls:posePulls(p,match,{foot:plan.event.foot,from:at-ASSIST.strideRamp,at,target:null,stride:true},swing.foot)};p.touchWindup=null;p.dribbleTouch=.16;p.touchCooldown=.16;return true;}}
  if(run0>ASSIST.underBody&&across0<.35)return false;
 }
 // Every other touch (a turn or cut, a ball that slipped under the body, stopping it) first reaches for the ball with
 // the foot on the ball's side: the foot travels to it (the pose follows dribblePose.pulls) and the touch is played on
 // arrival once the ball is within that leg's length; a ball still ahead of it is run to first (for at most reachWait),
 // as a player gets to the ball before changing direction with it.
 let touchFoot=foot;
 if(!preparing){
  // The reach is a small state machine (p.touchWindup): pick the foot on the ball's side; while the ball is ahead and
  // beyond that leg's length the player just runs to it (no reach drawn); then the foot travels to the ball at no more
  // than footSpeed relative to the body, and the touch is played when it arrives. The foot never jumps between steps.
  let w=p.touchWindup;
  // A reach from before a restart (the clock went back) or one that never arrived is dropped.
  if(w&&(w.since>match.time||w.at!==null&&w.at>match.time+ASSIST.reachMax+.05||(w.at===null?match.time>w.since+ASSIST.reachWait:match.time>w.at+.1)))w=p.touchWindup=null;
  if(!w){const side=legShortfall(p,b,'left')<legShortfall(p,b,'right')?'left':'right';w=p.touchWindup={foot:side,at:null,since:match.time};}
  if(w.at===null){
   const front=(b.x-p.x)*Math.sin(p.yaw)+(b.z-p.z)*Math.cos(p.yaw);
   if(!trap&&front>ASSIST.reachFront&&legShortfall(p,b,w.foot)>ASSIST.legSlack+ASSIST.reachLead&&match.time<w.since+ASSIST.reachWait)return false;
   // Stopping the ball under the sole is a quick stamp, but never quicker than trapReach: a foot sent across 0.8 m in
   // 0.08 s flew at 20 m/s and was flicked up off the ball as it arrived.
   w.at=match.time+(trap?clamp(reachTime(p,b,w.foot),ASSIST.trapReach,ASSIST.reachMax):reachTime(p,b,w.foot));p.dribblePose={start:w.at,foot:w.foot,duration:.20,pulls:posePulls(p,match,{foot:w.foot,from:match.time,at:w.at,target:null})};
  }
  // A ball that rolls onto the reaching foot before it was due is played where it meets the boot; waiting for the
  // planned moment let the ball roll through the drawn foot.
  if(match.time<w.at&&!(reachingInstepDistance(match,p,w.foot)<ASSIST.meetBall))return false;
  touchFoot=w.foot;p.touchWindup=null;
 }
 const run=Math.max(turning?Math.max(along,speed*.7*Math.max(0,along/(speed||1))):speed,aim?ASSIST.startTouch:0);
 // A turn taken at pace is a short touch round the body; a standing start, or a ball that dropped behind on a
 // straight run, is played firmly out in front.
 const forward=preparing||p.shield?speed*.9:p.pendingKick?run+.35:run+(turning&&!recovering&&speed>ASSIST.startTouch&&along<speed*.8?Math.min(knock,ASSIST.turnKnock):knock);
 // Sideways part: a quarter of the player's own sideways momentum (the body carries on through a cut) plus a small
 // correction toward the touching foot's side of the stick's line, so the ball goes where the stick points.
 // A cut (the stick's line off the run's by more than cutMin) is played firmly enough to lead the body out of it.
 const cutting=!preparing&&!trap&&speed>=ASSIST.syncSpeed&&along<speed*Math.cos(ASSIST.cutMin)&&along>speed*Math.cos(ASSIST.cutMax),lead=cutting?Math.max(forward,speed*ASSIST.cutPace+ASSIST.cutKnock):forward;
 const across=(b.x-p.x)*f.z-(b.z-p.z)*f.x,lane=(touchFoot==='left'?-1:1)*ASSIST.footLane,side=(p.vx*f.z-p.vz*f.x)*ASSIST.turnCarry+clamp((lane-across)/.35,-1.5,1.5);
 const vx=trap?0:f.x*lead+f.z*side,vz=trap?0:f.z*lead-f.x*side;
 const dragged=!preparing&&!trap&&playTouch(match,p,vx,vz,touchFoot);if(preparing||trap)match.physics.kick({x:vx,z:vz},Math.hypot(vx,vz),.015);match.lastTouch=p;match.lastTouchTeam=p.team;if(!preparing&&!trap&&!dragged)startCut(match,p,vx,vz);
 if(!preparing&&!dragged){p.dribblePose={start:match.time,foot:touchFoot,duration:.20,pulls:posePulls(p,match,null,touchFoot)};p.strideNext=null;}
 p.dribbleTouch=.16;p.touchCooldown=preparing?.07:.16;
 return true;
}

/** The owner runs at the stick's pace to where the next touch can send the ball along the stick: straight on when
 * a foot can reach it, otherwise toward the spot just behind it on the stick's line (or straight at a ball left
 * behind). Sets p.dribbleAim, p.dribbleStop and p.dribbleChase for dribbleTouch and move(). */
export function dribbleSteer(match,p,axis){
 const ball=match.physics.ball,b=ball.position,v=ball.velocity,n=Math.hypot(axis.x,axis.z);
 p.dribbleStop=n<.05;p.dribbleAim=n>=.05?{x:axis.x/n,z:axis.z/n}:null;p.dribbleChase=false;p.strideWarp=1;
 // When the stick last swung to a new line (more than 20 degrees), for recovering a ball the player overran in the turn.
 if(p.dribbleAim){const last=p.lastAim;if(last&&last.x*p.dribbleAim.x+last.z*p.dribbleAim.z<Math.cos(Math.PI/9))p.aimTurnAt=match.time;p.lastAim=p.dribbleAim;}
 // Steering quickly (the stick swung within agileWindow) the player shortens the run and keeps the ball close, as with
 // close control.
 p.agile=!!p.dribbleAim&&match.time-(p.aimTurnAt??-9)<ASSIST.agileWindow;
 if(b.y>.5)return axis;
 const speed=Math.hypot(p.vx,p.vz),ballSpeed=Math.hypot(v.x,v.z),d=distance(p,b);
 if(p.dribbleAim&&speed>=ASSIST.syncSpeed)p.strideWarp=strideWarp(match,p,p.dribbleAim);
 const ahead=Math.min(.45,d/(speed+2)),bx=b.x+v.x*ahead-p.x,bz=b.z+v.z*ahead-p.z,reach=Math.hypot(bx,bz)||1;
 // A ball running away is chased at full speed whatever the sprint button says.
 p.dribbleChase=d>1.3&&ballSpeed>speed-.3;
 // While a foot is reaching for the ball (a cut or turn about to be played), the run goes to the ball first, as a
 // player gets to the ball before changing direction with it; turning early would leave it rolling on sideways.
 // Only a ball ahead and out of the reaching leg's range is run to; one beside or behind is swivelled round at once.
 const w=p.touchWindup;
 if(w&&n>=.05&&speed>.5&&match.time<=w.at+ASSIST.reachWait+.05&&((b.x-p.x)*p.vx+(b.z-p.z)*p.vz)/speed>.3&&legShortfall(p,b,w.foot)>ASSIST.legSlack){
  p.dribbleChase=true;return {x:bx/reach,z:bz/reach};}
 // A drag not yet started (the foot is still getting to the ball) keeps the run going at the ball.
 if(p.ballDrag?.pending&&speed>.5){p.dribbleChase=true;return {x:bx/reach,z:bz/reach};}
 // A cut not yet played (stick off the run's line by cutMin..cutMax) keeps the run on the ball until the touch that
 // turns it: curving early leaves the body beside the ball's new line.
 if(p.dribbleAim&&!p.cutTo&&speed>=ASSIST.syncSpeed&&((b.x-p.x)*p.vx+(b.z-p.z)*p.vz)/speed>.1){const off=Math.acos(clamp((p.vx*p.dribbleAim.x+p.vz*p.dribbleAim.z)/speed,-1,1));if(off>ASSIST.cutMin&&off<ASSIST.cutMax)return {x:bx/reach,z:bz/reach};}
 const dir=p.dribbleAim||{x:bx/reach,z:bz/reach};
 const tx=bx-dir.x*ASSIST.footForward,tz=bz-dir.z*ASSIST.footForward,t=Math.hypot(tx,tz);
 if(p.dribbleStop){
  // Without input the player walks onto the ball and stops it.
  // A stopped ball already at the feet is kept there; the player does not step back to square up to it.
  if(t<.06||t<.25&&ballSpeed<.3||d<ASSIST.underfootReach&&ballSpeed<.3)return {x:0,z:0};
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

/** Stride timing correction: when the ball will reach the next swinging foot a little earlier or later than the foot
 * gets there, the stride quickens or lengthens (up to 20%) so the foot and the ball arrive together. */
function strideWarp(match,p,aim){
 const b=match.physics.ball.position,v=match.physics.ball.velocity,speed=Math.hypot(p.vx,p.vz),ahead=(b.x-p.x)*aim.x+(b.z-p.z)*aim.z;
 const closing=speed-(v.x*aim.x+v.z*aim.z);if(closing<.3||ahead<0||ahead>1.6)return 1;
 const next=strideEvents(p,aim,.9)[0];if(!next)return 1;
 const ballSpeed=Math.hypot(v.x,v.z),roll=rollAfter(ballSpeed,next.T,match.gameplay?.ballRoll).travel,bx=b.x+(ballSpeed?v.x/ballSpeed*roll:0),bz=b.z+(ballSpeed?v.z/ballSpeed*roll:0);
 // Positive: the ball will still be ahead of the instep when the foot arrives, so the foot should come later.
 const early=(bx-next.x)*aim.x+(bz-next.z)*aim.z,shift=early/closing;
 if(Math.abs(shift)>next.T+.3)return 1;
 return clamp(next.T/Math.max(.05,next.T+shift),1-ASSIST.strideWarp,1+ASSIST.strideWarp);
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
