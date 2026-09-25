import {clamp} from './config.js';
import {predictContact} from './contact-model.js';
import {choosePass} from './ai.js';
import {shotTarget} from './assists.js';
import {skill} from './attributes.js';
// Headers and aerial duels. A cross covers the last metre in well under a tenth of a second,
// so a header is started early: when the ball's path will pass within reach at head height,
// the player jumps with the contact time set so the head meets the ball at the top of the jump.
export const HEADER={minHeight:1.25,chestHeight:1.62,jump:.42,lead:.26,window:.16,reach:.85,duel:1.2,steer:2.6};
// Highest ball centre a jumping player can head: head height plus the jump.
export const headReach=p=>clamp(p.height||1.81,1.55,2.1)*.97+HEADER.jump*(.8+.4*skill(p,'strength',.75));
// Who wins an aerial ball: reach, position and strength, with a little luck.
const duelScore=(m,p,c)=>(headReach(p)-c.height)*1.2-c.distance*1.6+skill(p,'strength',.75)*.45+m.random()*.3;
// What the winner does with it. null leaves a chest-high ball to the normal chest/thigh control.
function headerChoice(m,p,c){
 if(m.controlled===p&&m.isHumanControlled(p)){
  const intent=p.intent;if(intent){p.intent=null;return {type:intent.type==='shoot'?'shoot':intent.type==='lob'?'clear':'pass',human:true};}
  return c.height>=HEADER.chestHeight?{type:'pass',human:true}:null;
 }
 const dir=m.direction(p.team),x=p.x*dir;
 if(x>34&&Math.abs(p.z)<22)return {type:'shoot'};
 if(x<-8&&m.lastTouchTeam!==p.team)return {type:'clear'};
 return c.height>=HEADER.chestHeight?{type:'pass'}:null;
}
function startHeader(m,p,choice,c){
 const b=m.physics.ball.position,v=m.physics.ball.velocity,dir=m.direction(p.team),axis=choice.human?m.input.axis||{x:0,z:0}:{x:0,z:0};
 const point={x:b.x+v.x*c.time,y:c.height,z:b.z+v.z*c.time};
 let type='pass',aim=null,receiver=null,options={};
 if(choice.type==='shoot'){const t=shotTarget(m,p,axis)||{x:dir*52.5,z:0};type='shoot';aim={x:t.x-point.x,z:t.z-point.z};options.low=true;}
 else if(choice.type==='clear'){type='lob';aim={x:dir*24,z:clamp(point.z*.5+Math.sign(point.z||1)*10,-28,28)-point.z};}
 else{const pass=choosePass(m,p,Math.hypot(axis.x,axis.z)>.2?axis:null,'pass');if(pass){receiver=pass.player;aim={x:pass.x-point.x,z:pass.z-point.z};}else aim={x:dir*12,z:0};}
 return m.queueKick(p,type,type==='shoot'?.4:.5,aim,receiver,{...options,header:true,contactAt:c.time,contactPoint:point,planBall:{x:point.x,y:clamp(point.y,1.2,2.2),z:point.z}});
}
// The loser of an aerial duel jumps for the same ball but cannot touch it.
function contest(m,p,c){const b=m.physics.ball.position,n=Math.hypot(b.x-p.x,b.z-p.z)||1;
 p.action={id:++m.actionId,type:'shoot',aerial:true,clipId:'header',contest:true,elapsed:0,hit:true,contactAt:c.time,recovery:.32,power:0,aim:{x:(b.x-p.x)/n,z:(b.z-p.z)/n},contactTarget:{x:b.x,y:c.height,z:b.z}};}
export function planHeaders(m,dt){
 // Players already jumping drift toward the planned contact point so the head arrives there.
 for(const p of m.players){const a=p.action;if(!a?.header||a.hit||!a.contactPoint)continue;const dx=a.contactPoint.x-p.x,dz=a.contactPoint.z-p.z,d=Math.hypot(dx,dz);if(d>.02){const step=Math.min(d,HEADER.steer*dt);p.x+=dx/d*step;p.z+=dz/d*step;}}
 if(m.state!=='playing'||m.setPiece||m.heldBy||m.owner)return;
 const b=m.physics.ball.position,v=m.physics.ball.velocity;if(b.y<.9||Math.hypot(v.x,v.z)<3)return;
 const candidates=[];
 for(const p of m.players){
  if(!p.active||p.action||p.down>0||p.role==='GK'||p.touchCooldown>0||m.offside.has(p.id))continue;
  // Everyone arriving at the ball together is compared, not only whoever is first in time.
  const c=predictContact(p,b,v,.6);if(c.time<.08||c.time>HEADER.lead+HEADER.window||c.distance>HEADER.duel||c.height<HEADER.minHeight||c.height>headReach(p))continue;
  candidates.push({p,c,score:duelScore(m,p,c)});
 }
 if(!candidates.length)return;
 candidates.sort((a,c)=>c.score-a.score);const win=candidates[0];if(win.c.distance>HEADER.reach||win.c.time>HEADER.lead)return;
 const choice=headerChoice(m,win.p,win.c);if(!choice||!startHeader(m,win.p,choice,win.c))return;
 m.lastHeader={player:win.p.id,time:m.time,duel:candidates.length>1};
 for(const other of candidates.slice(1))if(other.p.team!==win.p.team&&other.c.distance<HEADER.duel)contest(m,other.p,other.c);
}
