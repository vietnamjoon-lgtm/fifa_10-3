import {skillImpulse} from './skills.js';
import {sideIndex} from './sides.js';

// Where each boot goes during a skill move, in world space, so the foot really meets the ball (foot-plant.js
// solves the leg onto these goals). Every touch is played by the part of the boot facing its push: the boot
// comes to the side of the ball away from where the touch sends it, meets it at the touch's time and
// follows it out a little; a drag, roll or stopping touch puts the sole on top of the ball, and a flick gets
// the toe under it. A step-over circles the stepping boot over the ball and plants it on the far side.
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
const SOLE=new Set(['drag','roll','roulette']),STEP=new Set(['step-over','step-over-reverse']);
const IN=.16,OUT=.14,R=.11;
// The ankle (the foot bone) sits this high when the sole rests on the ground.
const ANKLE=.075;

export function skillFootGoals(p,a,ball){
 if(!ball||a?.type!=='feint'||!a.events)return [];
 const f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},r={x:-f.z,z:f.x},side=a.move?(a.side>0?'right':'left'):(a.foot==='left'?'left':'right'),main=sideIndex(side),s=side==='right'?1:-1;
 const e=a.elapsed||0,kind=a.pose||a.skill,n=a.events.length,by=Math.max(R,ball.y??R),per=[[],[]];
 a.events.forEach((ev,k)=>{
  const t=e-ev.at;if(t<-IN||t>OUT)return;
  const hit=skillImpulse(p,a,k),d=hit.aim,w=t<0?smooth((t+IN)/IN):1-smooth(t/OUT),last=k===n-1;
  // A step-over's exit is played by the other boot, the one that did not step over.
  const i=STEP.has(kind)&&last?1-main:main;
  // After the touch the ball has moved on; the boot follows from where it met it.
  const back=t>0?hit.speed*t:0,bx=ball.x-d.x*back,bz=ball.z-d.z*back,follow=t>0?Math.min(.16,t*1.3):0;
  const sole=hit.speed<.6||(SOLE.has(kind)&&!last)||kind==='roll'||d.x*f.x+d.z*f.z<-.35;
  let goal;
  if(sole)goal={x:bx-f.x*.07+d.x*follow,y:by+R+ANKLE,z:bz-f.z*.07+d.z*follow};
  // A flick is played from under the ball: from the grass, or at the ball's height for a juggle in the air.
  else if(hit.lift>.3)goal={x:bx-d.x*.09+d.x*follow,y:Math.max(ANKLE,(ball.y??R)-R-.05),z:bz-d.z*.09+d.z*follow};
  else goal={x:bx-d.x*(R+.06)+d.x*follow,y:ANKLE+.03,z:bz-d.z*(R+.06)+d.z*follow};
  per[i].push({...goal,w});
 });
 // Step-over: the stepping boot starts beside the ball on the inside, passes over it and lands outside it
 // (a reverse step-over goes the other way round), finishing before the exit touch.
 if(STEP.has(kind)&&a.move){const exit=a.events[n-1]?.at??a.duration*.8,w0=.05,w1=Math.max(w0+.15,exit-.07),v=(e-w0)/(w1-w0);
  if(v>-.2&&v<1.15){const u=Math.min(1,Math.max(0,v)),q=kind==='step-over'?1:-1,from=q>0?-.1:.34,to=q>0?.4:-.12,lat=s*(from+(to-from)*u),fwd=-.12+.22*Math.sin(u*Math.PI)+.06*u;
   per[main].push({x:ball.x+r.x*lat+f.x*fwd,y:ANKLE+.36*Math.sin(u*Math.PI),z:ball.z+r.z*lat+f.z*fwd,w:.9*smooth((v+.2)/.35)*(1-smooth((v-.85)/.3))});}}
 // A pretend touch: the boot goes to the ball and comes back without playing it.
 if(kind==='fake-step'){const u=Math.min(1,e/(a.duration||.6)),w=Math.sin(u*Math.PI);per[main].push({x:ball.x-f.x*.16-r.x*s*.05,y:ANKLE+.12*w,z:ball.z-f.z*.16-r.z*s*.05,w:.8*w});}
 const goals=[];
 // Two goals for one boot (the out and in touches of an elastico) are blended by weight, lifted over the
 // ball where they overlap, so the boot slides round the ball instead of jumping through it.
 per.forEach((list,i)=>{if(!list.length)return;const total=list.reduce((q,g)=>q+g.w,0);if(total<.01)return;
  const mix=k=>list.reduce((q,g)=>q+g[k]*g.w,0)/total,top=Math.max(...list.map(g=>g.w)),overlap=list.length>1?1-top/total:0;
  goals.push({i,x:mix('x'),y:mix('y')+.22*overlap,z:mix('z'),weight:Math.min(.95,top)});});
 return goals;
}
