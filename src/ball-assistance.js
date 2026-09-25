import {FIELD,TUNING,clamp,distance} from './config.js';
import {rollAfter} from './physics.js';

export function activePass(match){const f=match.passFlight;return f&&!match.owner&&!match.heldBy&&match.time<f.expires&&(match.lastTouch?.id===f.kicker||f.follow&&match.lastTouch?.id===f.receiver&&match.lastTouchKind==='control')?f:null;}

// Meeting points remain useful for loose balls and optional legacy reception.
export function predictBall(match,t){const b=match.physics.ball.position,v=match.physics.ball.velocity,speed=Math.hypot(v.x,v.z),ground=b.y<.22&&Math.abs(v.y)<1,k=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2/.43,travel=speed<.01?0:ground?rollAfter(speed,t,match.gameplay?.ballRoll).travel:Math.log1p(k*speed*t)/k;
 return {x:b.x+(speed?v.x/speed*travel:0),z:b.z+(speed?v.z/speed*travel:0),y:ground?FIELD.ballRadius:Math.max(FIELD.ballRadius,b.y+v.y*t-4.905*t*t)};
}
export function interceptPoint(match,p,horizon=2.6){const pace=p.pace*(.75+.25*p.stamina),acc=p.acceleration*.85;let best=null,bestCost=Infinity;
 for(let t=.06;t<=horizon;t+=.08){const q=predictBall(match,t);if(Math.abs(q.x)>52.2||Math.abs(q.z)>33.7||q.y>1.2)continue;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz),initial=clamp((p.vx*dx+p.vz*dz)/(d||1),0,pace),ramp=Math.min(t,(pace-initial)/acc),reach=initial*ramp+.5*acc*ramp*ramp+pace*(t-ramp),cost=d-reach;
  if(cost<bestCost){best={...q,time:t,distance:d};bestCost=cost;}if(cost<.6)return best;
 }return best;
}
export function collectionMovement(match,p,axis,input={}){
 if(match.owner||match.heldBy||match.setPiece||p.action||p.down>0||p.role==='GK'||match.offside.has(p.id)||input.defend||input.shield)return null;
 const receiving=(match.receiving?.player===p&&match.time<match.receiving.expires)||activePass(match)?.receiver===p.id;
 if(activePass(match)?.follow)return null;
 if(receiving?match.settings.receiveAssist===false:match.settings.looseBallAssist===false)return null;
 if(!receiving){if(distance(p,match.physics.ball.position)>22||p.touchCooldown>0)return null;const candidate=match.players.filter(q=>q.active&&q.team===p.team&&q.role!=='GK'&&!q.action&&q.down<=0&&!match.offside.has(q.id)).sort((a,b)=>distance(a,match.physics.ball.position)/a.pace-distance(b,match.physics.ball.position)/b.pace||a.id-b.id)[0];if(candidate!==p)return null;}
 const target=interceptPoint(match,p);if(!target)return null;const dx=target.x-p.x,dz=target.z-p.z,n=Math.hypot(dx,dz);
 // Optional physical-pass reception assists neutral input only. For a loose ball a stick pointing
 // roughly toward it (within 75 degrees) is
 // corrected onto the meeting point; a stick pointing away, or any stick once at the ball, is obeyed.
 const stick=Math.hypot(axis.x,axis.z);
 if(stick>.12&&(receiving||n<=.38||(axis.x*dx+axis.z*dz)/(stick*n)<Math.cos(75*Math.PI/180)))return null;
 const brakeSpeed=Math.sqrt(2*(12+6*p.balance)*Math.max(0,n-.45)),sprint=n>3.5||!!input.sprint,top=sprint?p.pace:5.2,amount=clamp(Math.min((n-.38)/1.25,brakeSpeed/top),0,1);p.aiState=receiving?'MEET PASS':'COLLECT BALL';return {axis:n>.38?{x:dx/n*amount,z:dz/n*amount}:{x:0,z:0},sprint,target};
}
