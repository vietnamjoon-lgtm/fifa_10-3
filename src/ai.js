import {KEEPER} from './keeper-tuning.js';
import {activePass,interceptPoint} from './ball-assistance.js';
import {keeperProfile} from './attributes.js';
import {clamp,distance,TUNING} from './config.js';
import {passTarget} from './assists.js';
import {offsideSnapshot} from './rules.js';
import {safeAutoTackle} from './auto-defence.js';
import {chooseCross,inCrossingZone} from './crossing.js';
export function laneClear(a,b,opponents){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;let danger=0;for(const p of opponents){const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1);if(t>.05&&t<.95){const d=Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);danger+=Math.max(0,3.3-d);}}return danger;}
export function choosePass(match,p,aim,type='pass'){
 const opponents=match.players.filter(q=>q.active&&q.team!==p.team),dir=match.direction(p.team),offside=offsideSnapshot(match,p);let best=null,score=-Infinity;
 const magnitude=aim?Math.hypot(aim.x,aim.z):0;
 for(const q of match.players){if(q===p||!q.active||q.down>0||q.team!==p.team||offside.has(q.id))continue;const d=distance(p,q);if(d<2||d>(type==='lob'?48:38))continue;const dx=(q.x-p.x)/d,dz=(q.z-p.z)/d;const alignment=magnitude>.1?(dx*aim.x+dz*aim.z)/magnitude:dx*dir*.6;if(magnitude>.1&&alignment<.4)continue;const pressure=Math.min(9,...opponents.map(r=>distance(q,r)));const lane=laneClear(p,q,opponents);const value=alignment*24+(magnitude>.1?0:(q.x-p.x)*dir*.25)+pressure-lane*3-d*.22;
 if(value>score){best=q;score=value;}}
 return best?passTarget(match,p,best,type):null;
}
export function updateTeamAI(match){
 if(match.setPiece)return;
 const b=match.physics.ball.position,owner=match.owner;
 for(const team of [0,1]){teamPlan(match,team);
 const dir=match.direction(team),flight=activePass(match),hasBall=owner?.team===team||flight?.team===team;
 const assistance=match.assistanceForTeam?.(team)||match.settings;
 const candidates=match.players.filter(p=>p.active&&p.team===team&&p.role!=='GK'&&(!match.isHumanControlled(p)||assistance.looseBallAssist!==false&&Math.hypot(match.inputForTeam(p.team).axis?.x||0,match.inputForTeam(p.team).axis?.z||0)<.12)).sort((a,c)=>distance(a,b)-distance(c,b));const chaser=flight?.team===team?match.players.find(p=>p.id===flight.receiver):candidates[0];
 // Against a carrier the defence works as a unit: one presser engages goal-side and jockeys, a cover player sits behind
 // him on the inside, and in a press one more player cuts the carrier's nearest passing lane (see defenceRoles).
 const roles=owner&&owner.team!==team?defenceRoles(match,team,owner,candidates):null,cover=roles?.cover||null;
 for(const p of match.players){if(!p.active||p.team!==team||match.isHumanControlled(p))continue;p.jockey=false;p.speedCap=0;
 if(p.role==='GK'){keeperTarget(match,p);continue;}
 if(!owner&&flight?.receiver===p.id){if(flight.follow){p.aiState=flight.type==='through'?'THROUGH RUN':'HOLD PASS LANE';p.target={...flight.runTarget};p.sprinting=flight.type==='through';continue;}const target=interceptPoint(match,p);if(target){p.aiState='MEET PASS';p.target=target;p.sprinting=distance(p,target)>2.2;continue;}}
 if(owner!==p&&p.runUntil>match.time){p.aiState='RUN';p.target=p.runTarget||{x:clamp(p.x+dir*10,-49,49),z:p.z};p.sprinting=true;continue;}
 if(owner!==p&&p.supportUntil>match.time&&owner?.team===team){p.aiState='SUPPORT CALL';p.target={x:owner.x-dir*5,z:owner.z+Math.sign(p.z-owner.z||1)*5};p.sprinting=false;continue;}
 if(owner===p){carrierDecision(match,p);
 }else if(roles&&p===roles.presser){engageCarrier(match,p,owner,roles);
 }else if(p===cover){coverPresser(match,p,owner,roles);
 }else if(roles&&p===roles.lane){blockLane(match,p,owner,roles);
 }else if(p===chaser&&!roles&&(!hasBall||!owner)){p.aiState='PRESS';const target=interceptPoint(match,p);p.target=target||{x:b.x,z:b.z};p.sprinting=distance(p,b)>4.5;if(owner&&owner.team!==team&&safeAutoTackle(match,p))match.tackle(p);}
 else {p.aiState=hasBall?'SUPPORT':'COVER';const progress=b.x*dir,shift=clamp(progress*.5+(hasBall?20:7),-10,36);let x=(p.homeX+shift)*dir,z=p.homeZ+b.z*.19;
 if(hasBall&&p.role==='FWD'){x=clamp((progress+12)*dir,-46,46);z=p.homeZ*.88+b.z*.12;}
 if(hasBall&&p.role==='MID'&&owner){x=owner.x-dir*(p.index%2?7:12);z=owner.z+(p.homeZ<0?-11:11);}
 if(hasBall&&owner){const shaped=supportShape(match,p,owner);if(shaped){x=shaped.x;z=shaped.z;}}
 if(!hasBall&&p.role==='DEF'){x=dir*clamp(progress-10,-42,-10);z=p.homeZ*.65+b.z*.45;}
 if(!hasBall){const block=blockPosition(match,p,roles);if(block){x=block.x;z=block.z;p.aiState=block.state;}}
 p.target={x:clamp(x,-49,49),z:clamp(z,-30,30)};p.sprinting=distance(p,p.target)>(hasBall?15:7);}
 }
 }
}
export function keeperTarget(match,p){const b=match.physics.ball.position,v=match.physics.ball.velocity,dir=match.direction(p.team),goalX=-dir*51;
 if(match.inputForTeam(p.team).keeperRush&&!match.heldBy){p.aiState='RUSH';p.target={x:clamp(b.x,-51,51),z:clamp(b.z,-30,30)};p.sprinting=true;return;}
 p.aiState='KEEPER SET';let tx=goalX+dir*1.3,tz=clamp(b.z*.115,-2.75,2.75);
 if(b.x*dir<-32&&Math.abs(b.z)<18){tx=goalX+dir*clamp((52.5+b.x*dir)*.19,1,5);tz=clamp(b.z*.25,-3.3,3.3);}
 const toward=v.x*dir<-.5,arrival=(goalX-b.x)/(v.x||.001);
 const keeper=keeperProfile(p);
 if(!toward||arrival<=0||match.lastTouchTeam===p.team)p.keeperRead=null;
 if(toward&&arrival>0&&arrival<1.5&&match.lastTouchTeam!==p.team&&match.time-match.lastKickTime>keeper.reaction){
  // Commit to the observed shot instead of tracking its future destination perfectly.
  // Read where the ball crosses the keeper's own line, not the goal line: an angled shot moves sideways in between.
  if(!p.keeperRead||p.keeperRead.kickTime!==match.lastKickTime){const travel=Math.max(.01,(p.x-b.x)/(v.x||.001)),error=(match.random()-.5)*(KEEPER.readError+(1-p.reflexes)*KEEPER.readErrorReflex);p.keeperRead={kickTime:match.lastKickTime,at:match.time+travel,z:b.z+v.z*travel+error,height:clamp(b.y+v.y*travel-4.905*travel*travel,.18,2.25)};}
  const read=p.keeperRead;tz=clamp(read.z,-3.45,3.45);p.intercept={x:p.x,z:read.z};
  if(read.at-match.time<KEEPER.diveTriggerTime&&Math.abs(tz-p.z)>KEEPER.diveTriggerDistance&&p.dive<=0&&p.cooldown<=0){p.dive=p.diveDuration=KEEPER.diveDuration;p.diveDirection=Math.sign(tz-p.z);p.diveHeight=read.height;p.cooldown=KEEPER.diveCooldown;p.aiState='DIVE';}
 }
 if(p.dive>0){tx=p.x;tz=p.z;}p.target={x:tx,z:tz};p.sprinting=false;
}
// Attacking plans. Each possession an AI team picks one, so attacks do not all run straight through the middle:
// direct (runs in behind and through balls), wing (carry wide and cross) or build (short, safe passing).
export const AI_PLANS={direct:.3,wing:.4,build:.3};
export function teamPlan(match,team){
 match.aiPlans||=[null,null];const owner=match.owner,current=match.aiPlans[team];
 if(current&&owner&&owner.team!==team)current.lost=true;
 if(current&&!current.lost&&match.time<current.until)return current;
 if(current?.lost&&owner?.team!==team)return current;
 let pick=match.random(),kind='build';for(const [name,weight]of Object.entries(AI_PLANS)){if(pick<weight){kind=name;break;}pick-=weight;}
 const opponents=match.players.filter(q=>q.active&&q.team!==team),crowd=side=>opponents.filter(q=>Math.sign(q.z)===side&&Math.abs(q.z)>9).length;
 const side=crowd(1)<crowd(-1)?1:crowd(1)>crowd(-1)?-1:match.random()<.5?1:-1;
 // Small per-player offsets keep support positions from repeating exactly from one attack to the next.
 for(const p of match.players)if(p.team===team)p.supportOffset={x:(match.random()-.5)*6,z:(match.random()-.5)*8};
 return match.aiPlans[team]={kind,side,until:match.time+8+match.random()*6,lost:false};
}
function spaceAt(opponents,x,z){let space=20;for(const q of opponents)space=Math.min(space,Math.hypot(q.x-x,q.z-z));return space;}
// The second-last defender (keeper included) or the ball, whichever is further forward: forwards hold this line.
export function offsideLine(match,team){const dir=match.direction(team),xs=match.players.filter(q=>q.active&&q.team!==team).map(q=>q.x*dir).sort((a,c)=>c-a);return Math.max(xs[1]??0,match.physics.ball.position.x*dir,0);}
// Where the carrier runs: the direction with the most space and progress, shaped by the plan. The previous lane keeps a
// small bonus so the carrier does not zigzag between equal options.
export function carryLane(match,p,plan,opponents){const dir=match.direction(p.team);let best=null;
 for(const angle of [-1,-.6,-.3,0,.3,.6,1]){const hx=Math.cos(angle)*dir,hz=Math.sin(angle),x=p.x+hx*7,z=p.z+hz*7;if(Math.abs(z)>31)continue;
  const space=spaceAt(opponents,x,z),progress=hx*dir*7;let bonus=angle===p.carryAngle?1:0;
  if(plan.kind==='wing'&&Math.abs(p.z)<25&&Math.sign(z)===plan.side&&Math.abs(z)>Math.abs(p.z))bonus+=1.6;
  if(plan.kind==='direct')bonus+=progress*.15;
  if(p.x*dir>32&&Math.abs(p.z)>18&&Math.abs(z)<Math.abs(p.z))bonus+=plan.kind==='wing'?.4:1.4;
  const value=Math.min(space,9)+progress*.45+bonus-(Math.abs(z)>28?3:0);
  if(!best||value>best.value)best={angle,value,space,progress,target:{x:clamp(p.x+hx*14,-51,51),z:clamp(p.z+hz*14,-31,31)}};}
 p.carryAngle=best.angle;return best;}
// The best pass the AI can see. A receiver who is marked or behind a defender in the passing lane is skipped; the old AI
// still passed there and lost the ball.
export function bestPassOption(match,p,opponents){const dir=match.direction(p.team),offside=offsideSnapshot(match,p);let best=null;
 for(const q of match.players){if(q===p||!q.active||q.down>0||q.team!==p.team||q.role==='GK'||offside.has(q.id))continue;const d=distance(p,q);if(d<5||d>40)continue;
  const open=Math.min(12,spaceAt(opponents,q.x,q.z)),lane=laneClear(p,q,opponents),lofted=d>22&&lane>1.4;
  if(open<(lofted?4:2)||lane>(lofted?4:1.4))continue;
  const forward=(q.x-p.x)*dir,ahead=spaceAt(opponents,q.x+dir*6,q.z),running=q.runUntil>match.time;
  const through=!lofted&&(running&&forward>2||forward>6&&ahead>8&&q.role!=='DEF');
  const value=Math.min(open,8)*.9+forward*.3+Math.min(ahead,10)*.35-(lofted?3:lane*2.5)-d*.06+(q.x*dir>28?1.5:0)+(through?1:0);
  if(!best||value>best.value){const type=lofted?'lob':through?'through':'pass';best={player:q,value,type,target:passTarget(match,p,q,type)};}}
 return best;}
function shootAt(match,p,opponents){const dir=match.direction(p.team),gk=opponents.find(q=>q.role==='GK'),far=-(Math.sign((gk?.z||0)-p.z*.08)||(match.random()<.5?1:-1)),r=match.random();
 // Mostly the far side of the keeper, sometimes the near post or low and central: never the same exact corner.
 const z=r<.6?far*(1.3+match.random()*1.5):r<.85?-far*(1.1+match.random()*1.3):(match.random()-.5)*1.8;
 match.queueKick(p,'shoot',.5+match.random()*.35,{x:dir*52.5-p.x,z:clamp(z,-2.9,2.9)-p.z});}
// The AI carrier compares carrying on with shooting, crossing and its best pass, instead of passing on a timer.
export function carrierDecision(match,p){
 const team=p.team,dir=match.direction(team),plan=teamPlan(match,team),opponents=match.players.filter(q=>q.active&&q.team!==team),pressure=spaceAt(opponents,p.x,p.z);
 const lane=carryLane(match,p,plan,opponents);p.aiState='CARRY';p.target=lane.target;p.sprinting=lane.space>3.5;
 if(match.time<=p.nextDecision||p.action)return;
 const base=match.settings.difficulty==='hard'?.45:match.settings.difficulty==='easy'?.95:.65;p.nextDecision=match.time+base*(pressure<3?.6:1)*(.85+match.random()*.3);
 const goalDistance=52.5-p.x*dir,shotLane=laneClear(p,{x:dir*52.5,z:clamp(p.z*.2,-3,3)},opponents.filter(q=>q.role!=='GK'));
 if(goalDistance<17&&Math.abs(p.z)<12||goalDistance<25&&Math.abs(p.z)<15&&(shotLane<1.2||pressure<2.2)&&(lane.space<4||match.random()<.5)||goalDistance<30&&Math.abs(p.z)<10&&shotLane<.4&&match.random()<.2){shootAt(match,p,opponents);return;}
 if(inCrossingZone(match,p)&&p.x*dir>28){const cross=chooseCross(match,p,null);if(cross?.player&&spaceAt(opponents,cross.x,cross.z)>1.6&&(plan.kind==='wing'||lane.space<4||p.x*dir>40||match.random()<.35)){match.queueKick(p,'lob',.5,{x:cross.x-p.x,z:cross.z-p.z},cross.player);return;}}
 // On a direct plan a forward on the offside line makes a run for the carrier to find.
 if(plan.kind==='direct'&&p.x*dir>-15&&p.x*dir<30&&match.random()<.3){const line=offsideLine(match,team),runner=match.players.filter(q=>q.active&&q.team===team&&q.role==='FWD'&&q!==p&&!(q.runUntil>match.time)&&q.x*dir>line-6&&q.x*dir<line).sort((a,c)=>Math.abs(a.z-p.z)-Math.abs(c.z-p.z))[0];if(runner){runner.runUntil=match.time+2.4;runner.runTarget={x:clamp((line+11)*dir,-48,48),z:clamp(runner.z*.75,-26,26)};}}
 const option=bestPassOption(match,p,opponents),carry=Math.min(lane.space,8)*1.1+lane.progress*.35+(goalDistance<35?1.5:0)+(plan.kind==='build'?-1.5:0);
 if(option&&(option.value>carry+1.2||(pressure<2.2||lane.space<2.2)&&option.value>0))match.queueKick(p,option.type,.5,{x:option.target.x-p.x,z:option.target.z-p.z},option.player);
}
// Support positions shaped by the plan: forwards hold the offside line, a wing plan overlaps on its side, a build plan
// offers short angles. Returns null to keep the default position.
export function supportShape(match,p,owner){
 const team=p.team,dir=match.direction(team),plan=match.aiPlans?.[team],offset=p.supportOffset||{x:0,z:0};if(!plan||p.role==='DEF'||p.role==='GK')return null;
 const line=offsideLine(match,team),progress=owner.x*dir,wide=Math.abs(p.homeZ)>10,side=Math.sign(p.homeZ);let x,z;
 if(p.role==='FWD'){
  x=Math.min(progress+(wide?8:12)+offset.x,line-.8,46);z=p.homeZ*.85+owner.z*.15+offset.z*.5;
  if(plan.kind==='wing'&&wide&&side===plan.side){x=Math.min(progress+3,line-.8,44);z=side*27;}
  if(plan.kind==='build')x=Math.min(progress+6+offset.x,line-.8,46);
  // Once the ball is in the final third the forwards attack the box: near post, far post and penalty spot.
  if(progress>26){x=Math.min(Math.max(x,38),line-.3,47);z=wide?side*(side===Math.sign(owner.z)?4:6.5)+offset.z*.3:-Math.sign(owner.z||1)*1.5+offset.z*.3;}
 }else{
  x=owner.x*dir-(p.index%2?6:10)+offset.x;z=owner.z+(p.homeZ<0?-10:10)+offset.z*.5;
  if(plan.kind==='wing'&&wide&&side===plan.side){x=progress-2+offset.x;z=side*25;}
  if(plan.kind==='build'){x=progress-4+offset.x;z=owner.z+(side||(p.index%2?1:-1))*8;}
  if(plan.kind==='direct'&&!wide)x=Math.min(progress+4,line-.8);
 }
 return {x:clamp(x,-49,49)*dir,z:clamp(z,-30,30)};
}
// ---- Defending ----------------------------------------------------------------------------------------------------
// Coaching principles used here: the nearest goal-side player engages but does not dive in (delay, jockey at arm's
// length and show the carrier outside), a second player covers behind him on the inside, the back line holds a
// compact line and stays goal-side of runners, and in a press another player cuts the carrier's easiest pass.
// Each opponent possession the defence picks a block height: press (engage anywhere), mid (engage from the halfway
// line) or low (engage around our box), so the defending shape and trigger vary.
export const DEFENCE_BLOCKS={press:{weight:.35,line:-18,engage:60,depth:-5},mid:{weight:.45,line:-14,engage:8,depth:-18},low:{weight:.2,line:-10,engage:-12,depth:-28}};
export function defencePlan(match,team){
 match.aiDefence||=[null,null];const current=match.aiDefence[team];if(current&&match.time<current.until)return current;
 const dir=match.direction(team),losing=match.score[team]<match.score[1-team],late=match.elapsed>(match.settings.halfSeconds||120)*.7;
 let pick=match.random(),mode='mid';const weights={press:DEFENCE_BLOCKS.press.weight+(losing?.25:0),mid:DEFENCE_BLOCKS.mid.weight,low:DEFENCE_BLOCKS.low.weight+(!losing&&late&&match.score[team]>match.score[1-team]?.25:0)},total=Object.values(weights).reduce((a,c)=>a+c,0);
 for(const [name,w] of Object.entries(weights)){if(pick<w/total){mode=name;break;}pick-=w/total;}
 return match.aiDefence[team]={mode,dir,until:match.time+10+match.random()*8};
}
// The goal-side point from which to jockey: on the line from the carrier to a spot just inside our goal, `gap` metres
// from him, nudged toward the middle so the carrier is shown the touchline, and led by his velocity.
export function jockeyPoint(match,team,owner,gap){
 const dir=match.direction(team),gx=-dir*52.5-owner.x,gz=clamp(owner.z*.3,-3,3)-owner.z,n=Math.hypot(gx,gz)||1,ux=gx/n,uz=gz/n;
 const inside=-(Math.sign(owner.z)||1),along=uz*inside,lx=-ux*along,lz=inside-uz*along,ln=Math.hypot(lx,lz)||1,shade=clamp(Math.abs(owner.z)/20,0,1)*.45;
 // Lead his sideways movement fully but give ground only slowly: a defender who retreats as fast as the carrier runs
 // never gets a tackle in, one who holds his ground makes the carrier come to him.
 const run=owner.vx*ux+owner.vz*uz,sideX=owner.vx-run*ux,sideZ=owner.vz-run*uz,give=Math.max(0,run)*.12;
 return {x:owner.x+sideX*.35+ux*(gap+give)+lx/ln*shade,z:owner.z+sideZ*.35+uz*(gap+give)+lz/ln*shade,ux,uz};
}
export function goalSide(match,team,p,owner){const dir=match.direction(team),gx=-dir*52.5-owner.x,gz=-owner.z,n=Math.hypot(gx,gz)||1;return ((p.x-owner.x)*gx+(p.z-owner.z)*gz)/n;}
export function defenceRoles(match,team,owner,candidates){
 const plan=defencePlan(match,team),dir=match.direction(team),carrierU=owner.x*dir,block=DEFENCE_BLOCKS[plan.mode],engaging=carrierU<block.engage;
 const pool=candidates.filter(p=>p.down<=0);
 // The presser is whoever can get goal-side of the carrier soonest; a player behind the ball must first run round it.
 const cost=p=>{const jp=jockeyPoint(match,team,owner,2);return distance(p,jp)+(goalSide(match,team,p,owner)<.3?5:0);};
 const presser=pool.slice().sort((a,c)=>cost(a)-cost(c))[0]||null;
 const cover=pool.filter(p=>p!==presser&&p.role!=='FWD'&&goalSide(match,team,p,owner)>2).sort((a,c)=>distance(a,owner)-distance(c,owner))[0]||null;
 let lane=null,laneTarget=null;
 if(plan.mode==='press'){const receiver=match.players.filter(q=>q.active&&q.team===owner.team&&q!==owner&&q.role!=='GK'&&distance(q,owner)<22).sort((a,c)=>distance(a,owner)-distance(c,owner))[0];
  if(receiver){laneTarget={x:owner.x+(receiver.x-owner.x)*.45,z:owner.z+(receiver.z-owner.z)*.45};lane=pool.filter(p=>p!==presser&&p!==cover&&p.role!=='DEF').sort((a,c)=>distance(a,laneTarget)-distance(c,laneTarget))[0]||null;}}
 return {plan,block,engaging,presser,cover,lane,laneTarget,owner};
}
const TACKLE_RATE={easy:.3,normal:.45,hard:.6};
export function engageCarrier(match,p,owner,roles){
 const team=p.team,carrierSpeed=Math.hypot(owner.vx,owner.vz),d=distance(p,owner),side=goalSide(match,team,p,owner),b=match.physics.ball.position;
 // Outside the block's trigger zone the presser only screens from a distance; inside it he closes to arm's length.
 const danger=clamp((20-(52.5+owner.x*match.direction(team)))/20,0,1),gap=!roles.engaging?5.5:clamp(1.05+carrierSpeed*.05-danger*.15,.85,1.35),jp=jockeyPoint(match,team,owner,side<.3?gap+2.5:gap);
 p.aiState=side<.3?'RECOVER':roles.engaging?'PRESS':'SCREEN';p.target={x:clamp(jp.x,-51,51),z:clamp(jp.z,-33,33)};
 const toTarget=distance(p,p.target);p.sprinting=toTarget>2.5||side<.3||carrierSpeed>5;
 // Jockeying: side-on, matching a slow carrier at arm's length rather than running at the ball.
 p.jockey=roles.engaging&&side>=.3&&d<4.2&&carrierSpeed<4.2;
 // Approach fast, arrive slow: close to within a few metres at speed, then brake so the carrier cannot simply cut past
 // a defender carried on by his own momentum.
 if(side>=.3&&roles.engaging)p.speedCap=Math.max(carrierSpeed+1.1,2.2+Math.max(0,d-1.4)*1.15);
 if(p.action||p.cooldown>0)return;
 // Tackle only when it can be won: a ball that has run away from the carrier's feet, or a slow carrier shielding
 // poorly at close range (a chance per decision scaled by tackling skill and difficulty).
 const ballGap=distance(owner,b),exposed=ballGap>.62||distance(p,b)<ballGap+.25,steal=match.random()<(TACKLE_RATE[match.settings.difficulty]||TACKLE_RATE.normal)*(p.tackling??.8)/.8;
 if((exposed||roles.engaging&&steal)&&safeAutoTackle(match,p))match.tackle(p);
}
export function coverPresser(match,p,owner,roles){
 const team=p.team,dir=match.direction(team),presser=roles.presser,beaten=!presser||goalSide(match,team,presser,owner)<-.5;
 // Double up on a carrier pinned against the touchline or entering our final third.
 const trap=Math.abs(owner.z)>23||owner.x*dir<-20;
 // If the presser has been beaten the cover player becomes the new presser; otherwise he waits 6-8 m behind him on the
 // inside, where the carrier would have to go past both.
 if(beaten||trap&&roles.engaging){engageCarrier(match,p,owner,{...roles,engaging:true});p.aiState=beaten?'COVER PRESS':'DOUBLE TEAM';return;}
 const jp=jockeyPoint(match,team,owner,clamp(distance(presser,owner)+5.5,6,9)),inside=-(Math.sign(owner.z)||1);
 p.aiState='COVER';p.target={x:clamp(jp.x,-51,51),z:clamp(jp.z+inside*1.2,-33,33)};p.sprinting=distance(p,p.target)>4;p.jockey=false;
 if(distance(p,match.physics.ball.position)<1&&safeAutoTackle(match,p)&&distance(owner,match.physics.ball.position)>.62)match.tackle(p);
}
export function blockLane(match,p,owner,roles){p.aiState='CUT LANE';p.target={x:clamp(roles.laneTarget.x,-51,51),z:clamp(roles.laneTarget.z,-33,33)};p.sprinting=distance(p,p.target)>3;p.jockey=false;}
// Out of possession every other player takes a place in a compact block: the back line at the block's height, holding
// together and goal-side of the attackers in its zone; midfield 11 m in front; forwards screening the next line.
export function blockPosition(match,p,roles){
 if(p.role==='GK')return null;const team=p.team,dir=match.direction(team),b=match.physics.ball.position,ballU=b.x*dir,plan=defencePlan(match,team),block=DEFENCE_BLOCKS[plan.mode];
 const line=clamp(ballU+block.line,-41,block.depth+(plan.mode==='press'?14:0)),opponents=match.players.filter(q=>q.active&&q.team!==team&&q.role!=='GK');
 let u,z,state='COVER';
 if(p.role==='DEF'){u=line;z=p.homeZ*.62+b.z*.42;
  // Stay goal-side of an attacker in this defender's channel who is near or beyond the line (not one clearly offside).
  const threat=opponents.filter(q=>Math.abs(q.z-z)<9&&q.x*dir<line+7&&q.x*dir>line-12).sort((a,c)=>a.x*dir-c.x*dir)[0];
  if(threat){u=Math.min(line,threat.x*dir-1.4);z=z*.3+threat.z*.7+Math.sign(b.z-threat.z||0)*.5;state='MARK';}
 }else if(p.role==='MID'){u=line+11;z=p.homeZ*.7+b.z*.38;}
 else{u=clamp(Math.min(line+24,ballU+3),-22,35);z=p.homeZ*.55+b.z*.3;}
 u=clamp(u,-46,40);return {x:u*dir,z:clamp(z,-30,30),state};
}
