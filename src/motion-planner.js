import {clamp} from './config.js';
// Authored motion candidates: the values describe this game, not EA's private clips.
export const MOTION_CANDIDATES=[
 {id:'inside-pass',types:['pass','through'],height:[0,.65],speed:0,turn:0,reach:1.12,contact:.18,recovery:.25},
 {id:'moving-pass',types:['pass','through'],height:[0,.65],speed:5,turn:0,reach:1.12,contact:.17,recovery:.24},
 {id:'reverse-pass',types:['pass','through'],height:[0,.65],speed:2,turn:Math.PI,reach:1.12,contact:.24,recovery:.25},
 {id:'instep-shot',types:['shoot'],height:[0,.65],speed:3,turn:0,reach:1.12,contact:.24,recovery:.36},
 {id:'lofted-kick',types:['lob'],height:[0,.65],speed:2,turn:0,reach:1.12,contact:.22,recovery:.3},
 {id:'half-volley',types:['shoot','pass','through','lob'],height:[.55,.85],speed:2,turn:0,reach:1.12,contact:.18,recovery:.34},
 {id:'volley',types:['shoot','pass','through','lob'],height:[.65,1.3],speed:2,turn:0,reach:1.12,contact:.21,recovery:.38},
 {id:'header',types:['shoot','pass','through','lob'],height:[1.2,2.25],speed:2,turn:0,reach:1.12,contact:.19,recovery:.32}
];
export function selectMotion(query,candidates=MOTION_CANDIDATES){let best=null,cost=Infinity;for(const c of candidates){if(!c.types.includes(query.type)||query.height<c.height[0]||query.height>c.height[1]||query.distance>c.reach||c.foot&&c.foot!==query.foot)continue;const value=((query.speed-c.speed)/6)**2+((query.turn-c.turn)/Math.PI)**2*.65+(query.supportFoot===query.foot? .1:0)+(query.previous&&query.previous!==c.id? .12:0);if(value<cost){cost=value;best=c;}}return best?{...best,cost}:null;}
// Share of a stride with the foot on the ground: walking double support, then a
// shorter contact and a longer flight as the run becomes a sprint.
export function stanceFraction(speed){const t=clamp((speed-1.2)/1.8,0,1),r=clamp((speed-3)/6,0,1);return .62-.28*t*t*(3-2*t)-.16*r*(2-r);}
// Walking keeps a natural step length; running cadence rises slowly with speed.
// Sideways, backwards and defending movement shorten the step instead of stretching it.
export function locomotionCadence(speed,style='balanced',p){if(speed<.04)return 0;const multiplier=style==='compact'?1.035:style==='power'?.975:1;let cycles=Math.min(2.12,speed<1.8?speed/(2*(.48+.12*speed)):1.2931+(speed-1.8)*.1)*multiplier;
 if(p){const leg=clamp((p.body?.legLength||100)/100,.92,1.08),scale=clamp(p.height||1.81,1.55,2.1)/1.744663;cycles=Math.max(cycles/Math.sqrt(leg*scale),speed*stanceFraction(speed)/(2*.44*leg*scale));
  const yaw=p.yaw||0,forward=((p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw))/speed,side=Math.abs(((p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw))/speed);
  if(Number.isFinite(forward)){const step=Math.min(2.5,side>.5?.62:2.5,forward<-.3?.72:2.5,p.defending?.58:2.5)*leg*scale;cycles=Math.max(cycles,speed/(2*step));}
  if(p.closeControl)cycles*=1.1;if(Number.isFinite(p.motionTurn))cycles*=1+clamp(Math.abs(p.motionTurn)/7,0,1)*.45;}
 return 2*Math.PI*cycles;}
export function planKick(p,a,ball,time){const turn=Math.abs(Math.atan2(Math.sin(Math.atan2(a.aim.x,a.aim.z)-p.yaw),Math.cos(Math.atan2(a.aim.x,a.aim.z)-p.yaw))),candidate=selectMotion({type:a.type,height:ball.y,distance:Math.hypot(p.x-ball.x,p.z-ball.z),speed:Math.hypot(p.vx,p.vz),turn,foot:a.foot,previous:p.lastClip});if(!candidate)return null;p.lastClip=candidate.id;return {clipId:candidate.id,contactAt:candidate.contact,recovery:candidate.recovery,motionStart:time,commitAt:Math.max(.04,candidate.contact-.055),plannedContact:time+candidate.contact,nextActionAllowed:time+candidate.contact+candidate.recovery,warpLimits:{time:[.75,1.4],distance:.22,rotation:.5},events:[{id:'ball-contact',at:candidate.contact}],selectedFoot:a.foot};}
export function receivePlan(p,ball,time){const height=ball.y,kind=height>1.4?'chest':height>.8?'thigh':height>.38?'instep':Math.hypot(p.vx,p.vz)>2?'redirect':'inside',prepared=p.receivePrep&&p.receivePrep.until>=time;return {kind,foot:prepared?p.receivePrep.foot:p.foot,start:time-(prepared?.13:.06),duration:kind==='chest'?.46:.38,target:{x:ball.x,y:ball.y,z:ball.z},contactTime:time,commitTime:time};}
