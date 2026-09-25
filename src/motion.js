import {KEEPER} from './keeper-tuning.js';
import {gaitTargets} from './gait.js';
import {applySkillPose} from './skills.js';
import {applyCelebration} from './celebrations.js';
import {Quaternion,Euler} from '../vendor/three.module.js';
import {mocap} from './mocap-data.js';
import {clamp} from './config.js';
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function sampleMocap(name,time){
 const clip=mocap[name],frames=clip.frames,position=clamp(time/clip.duration,0,1)*(frames.length-1),index=Math.floor(position),next=Math.min(index+1,frames.length-1),t=position-index;
 const data=[lerp(frames[index][0],frames[next][0],t)];data.rotations=clip.localRotations[index].map((q,i)=>new Quaternion().fromArray(q).slerp(new Quaternion().fromArray(clip.localRotations[next][i]),t));data.ankles=clip.ankleRotations[index].map((q,i)=>new Quaternion().fromArray(q).slerp(new Quaternion().fromArray(clip.ankleRotations[next][i]),t));for(const q of data.rotations){const e=new Euler().setFromQuaternion(q,'XYZ');data.push(e.x,e.y,e.z);}return data;
}
function blendCapture(pose,data,weight){
 if(weight<.0001)return;
 pose.hipY=lerp(pose.hipY,.875+(data[0]-.85)*.55,weight);pose.captureFeet={quaternions:data.ankles,weight};const targets=[pose.hips,pose.torso,pose.head,...pose.legs.flatMap(l=>[l.upper,l.lower]),...pose.arms.flatMap(a=>[a.upper,a.lower])];
 for(let i=0;i<targets.length;i++){const target=targets[i],from=new Quaternion().setFromEuler(new Euler(...target)),to=data.rotations?.[i]||new Quaternion().setFromEuler(new Euler(...data.slice(1+i*3,4+i*3))),e=new Euler().setFromQuaternion(from.slerp(to,weight),'XYZ');target[0]=e.x;target[1]=e.y;target[2]=e.z;}
}
function blendUpperCapture(pose,name,t,weight,mirror=false){if(weight<.0001)return;const data=sampleMocap(name,t),targets=[[pose.torso,1],[pose.head,2],[pose.arms[0].upper,7],[pose.arms[0].lower,8],[pose.arms[1].upper,9],[pose.arms[1].lower,10]];for(const [target,index]of targets){const mapped=mirror&&index>=7?(index<9?index+2:index-2):index,e=new Euler().setFromQuaternion(data.rotations[mapped],'XYZ'),goal=new Quaternion().setFromEuler(new Euler(e.x,e.y*(mirror?-1:1),e.z*(mirror?-1:1))),out=new Euler().setFromQuaternion(new Quaternion().setFromEuler(new Euler(...target)).slerp(goal,weight),'XYZ');target[0]=out.x;target[1]=out.y;target[2]=out.z;}}
export function captureContacts(name,cycle){const clip=mocap[name],i=Math.min(clip.frames.length-1,Math.floor(clamp(cycle,0,1)*(clip.frames.length-1)));return clip.contacts?.[i]||[1,0];}
export function solveLeg(forward,height,hipY,a=.35,b=.4){
 const down=Math.max(.1,hipY-.075-height),r=clamp(Math.hypot(down,forward),.15,a+b-.002);
 return [-Math.atan2(forward,down)-Math.acos(clamp((a*a+r*r-b*b)/(2*a*r),-1,1)),Math.PI-Math.acos(clamp((a*a+b*b-r*r)/(2*a*b),-1,1))];
}
export function sampleMotion(p={},phase=0,time=0,ball=null,celebrate=false,kinematics={}){
 const speed=Math.hypot(p.vx||0,p.vz||0),amount=clamp(speed/7.5,0,1),sprint=smooth((speed-5)/3),tight=p.closeControl||p.shield||p.agile;
 const yaw=p.yaw||0,forward=(p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw),side=(p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw);
 const pose={contacts:[1,0],state:speed<.2?'idle':tight?'close-control':Math.abs(side)>speed*.65?'jockey':speed>6?'sprint':'run',hipY:.897+Math.sin(time*2.2)*.002,rootRoll:0,rootY:0,hips:[0,0,0],torso:[.02,0,0],head:[0,0,0],legs:[{upper:[0,0,0],lower:[.08,0,0]},{upper:[0,0,0],lower:[.08,0,0]}],arms:[{upper:[0,0,.12],lower:[-.28,0,0]},{upper:[0,0,-.12],lower:[-.28,0,0]}]};
 const stride=amount*(tight?.25:.39+sprint*.1),direction=forward<-.3?-1:1;

 pose.hipY-=amount*.045;pose.hipY+=Math.cos(phase*2)*amount*.013;
 pose.hips[1]=Math.sin(phase)*amount*.075;pose.hips[2]=Math.cos(phase)*amount*.025;
 pose.torso[0]=amount*.1+sprint*.07+clamp((kinematics.acceleration||0)*.008,-.12,.12);
 pose.torso[1]=-Math.sin(phase)*amount*.11;pose.torso[2]=clamp(-(kinematics.turn||0)*amount*.024,-.22,.22)-side*.014;
 if(speed<.2){pose.hips[2]=Math.sin(time*1.1)*.035;pose.torso[2]=-pose.hips[2]*.7;}
 for(let i=0;i<2;i++){
  const cycle=((phase/(Math.PI*2)+i*.5)%1+1)%1,stance=cycle<.56;
  pose.contacts[i]=stance?1:0;const t=stance?cycle/.56:(cycle-.56)/.44;
  const z=(stance?lerp(stride,-stride,t):lerp(-stride,stride,smooth(t)))*direction;
  const y=.068+(stance?0:Math.sin(t*Math.PI)*amount*(.12+sprint*.14));
  const [hip,knee]=solveLeg(z,y,pose.hipY);pose.legs[i].upper[0]=hip;pose.legs[i].lower[0]=knee;
  pose.legs[i].upper[2]=-side*.032+(i===0?.025:-.025)*amount;
  const wave=Math.sin(phase+i*Math.PI);pose.arms[i].upper[0]=-wave*amount*(.42+sprint*.25);pose.arms[i].lower[0]=-.3-amount*(.65+sprint*.2);
 }
 if(ball){pose.head[1]=clamp(Math.atan2(Math.sin(Math.atan2(ball.x-p.x,ball.z-p.z)-yaw),Math.cos(Math.atan2(ball.x-p.x,ball.z-p.z)-yaw)),-.5,.5)*.65;pose.head[0]=clamp((1.5-ball.y)*.05,-.1,.1);}
 if(p.shield){pose.state='shield';pose.torso[0]=.18;pose.torso[1]=.15;pose.arms[0].upper=[-.2,0,.9];pose.arms[1].upper=[.15,0,-.7];}
 if(!p.action&&speed>.2){if((kinematics.acceleration||0)>3){pose.state='start';pose.torso[0]+=.10;}else if((kinematics.acceleration||0)<-3){pose.state='stop';pose.torso[0]-=.14;pose.hipY-=.035;}else if(Math.abs(kinematics.turn||0)>2){pose.state='turn';pose.hipY-=.025;}else if(forward<-.3)pose.state='backpedal';if(p.defending){pose.state='jockey';pose.hipY-=.035;pose.arms[0].upper[2]=.32;pose.arms[1].upper[2]=-.32;}}
 if(!p.action&&p.receiveUntil>time){pose.state='receive';pose.hipY-=.035;pose.legs[p.foot==='left'?0:1].lower[0]+=.2;}
 const action=p.action;
 if(action){const t=action.elapsed||0;
  if(action.type==='feint'){pose.state='feint';const wave=Math.sin(clamp(t/.28,0,1)*Math.PI*2);pose.hips[2]=wave*.16;pose.torso[2]=-wave*.28;pose.legs[1].upper[2]=wave*.35;if(action.skill==='drag-back'){pose.legs[1].upper[0]=-.4+wave*.35;pose.legs[1].lower[0]=.7;pose.torso[0]=-.12;}pose.arms[0].upper[2]=.55;}
  else if(action.type==='slide'){pose.state='slide';const enter=smooth(t/.17),recover=smooth((t-.53)/.32),weight=enter*(1-recover);pose.hipY=lerp(pose.hipY,.29,weight);pose.rootRoll=-.36*weight;pose.torso[0]=-.35*weight;pose.legs[1].upper[0]=lerp(pose.legs[1].upper[0],-1.25,weight);pose.legs[1].lower[0]=.12;pose.legs[0].upper[0]=-.6;pose.legs[0].lower[0]=1.5;pose.arms[0].upper=[.4,0,.7];pose.arms[1].upper=[-.25,0,-.6];}
  else if(action.type==='tackle'){pose.state='tackle';const weight=Math.sin(clamp(t/.55,0,1)*Math.PI);pose.hipY-=weight*.12;pose.torso[0]=weight*.26;pose.legs[1].upper[0]=-weight*.95;pose.legs[1].lower[0]=.16;pose.arms[0].upper[2]=.55;}
  else if(action.aerial){pose.state=(ball?.y||1.5)>1.2?'header':'volley';const u=clamp(t/.7,0,1),jump=Math.sin(u*Math.PI);pose.rootY=jump*.27;pose.torso[0]=-.22+smooth((u-.2)/.4)*.65;pose.head[0]=smooth((u-.25)/.35)*.22;pose.legs[0].lower[0]=.6*jump;pose.legs[1].lower[0]=.9*jump;pose.arms[0].upper=[-.3,0,.8];pose.arms[1].upper=[-.3,0,-.8];if(pose.state==='volley')pose.legs[1].upper[0]=-1.2*jump;}
  else if(['shoot','pass','through','lob'].includes(action.type)){
   pose.state=action.type;const contact=Math.max(.12,action.contactAt||.18),pre=clamp(t/contact,0,1),follow=action.hit?smooth((t-contact)/.28):0;
   const strength=action.type==='shoot'?.7+(action.power||0)*.3:.55;
   pose.hipY=(action.type==='shoot'?.825:.86)+follow*.025;pose.torso[0]=action.chip?-.08:.1;pose.torso[1]=lerp(-.2,.3,pre)*strength*(1-follow);pose.hips[1]=pose.torso[1]*.4;
   const localZ=ball?((ball.x-p.x)*Math.sin(yaw)+(ball.z-p.z)*Math.cos(yaw)):.45;
   const z=action.hit?lerp(.6,.08,follow):pre<.35?lerp(-.05,-.28,smooth(pre/.35)):lerp(-.28,clamp(localZ-.06,.12,.56),smooth((pre-.35)/.65));
   const y=action.hit?lerp(.33*strength,.08,follow):.08+Math.sin(Math.min(pre/.7,1)*Math.PI)*.09;
   const kick=solveLeg(z,y,pose.hipY),plant=solveLeg(-.09,.065,pose.hipY);
   pose.legs[1].upper=[kick[0],action.curve?.2:0,action.curve?-.12:0];pose.legs[1].lower[0]=kick[1];pose.legs[0].upper[0]=plant[0];pose.legs[0].lower[0]=plant[1];
   pose.arms[0].upper=[-.45*strength,0,.55*(1-follow)];pose.arms[1].upper=[.5*strength,0,-.4*(1-follow)];
  }
 }
 if(p.dive>0){pose.state='dive';const u=clamp(1-p.dive/(p.diveDuration||KEEPER.diveDuration),0,1),weight=Math.sin(u*Math.PI),sign=p.diveDirection||1;pose.rootRoll=sign*weight*1.15;pose.hipY=.85-weight*.33;pose.rootY=weight*.15;pose.arms[0].upper=[-.6,0,2.25];pose.arms[1].upper=[-.6,0,-2.25];pose.legs[0].lower[0]=weight*.9;pose.legs[1].lower[0]=weight*.6;}
 if(p.down>0){pose.state=p.down<.3?'recover':'fall';const weight=smooth(p.down/.3);pose.rootRoll=weight*1.15*(p.interaction?.side||1);pose.hipY=lerp(.87,.28,weight);pose.torso[0]=weight*.25;pose.legs[0].lower[0]=weight*1.4;pose.legs[1].lower[0]=weight*.8;pose.arms[0].upper=[-.5,0,1.1];pose.arms[1].upper=[-.5,0,-.5];}
 if(celebrate&&!p.down&&!action){pose.state='celebrate';pose.arms[0].upper=[-.2,0,2.5];pose.arms[1].upper=[-.2,0,-2.5];pose.rootY=Math.max(0,Math.sin(time*5+p.id))*.12;}
 for(const arm of pose.arms)arm.upper[2]*=-1;
 if(!p.down&&!p.dive&&!celebrate){
  if(!action&&!p.shield&&forward>speed*.65&&speed>.25){const cycle=((phase/(Math.PI*2))%1+1)%1;
   const jog=smooth((speed-1.5)/1.3),run=smooth((speed-3.5)/1.5),weight=smooth((speed-.25)/.9)*.78;
   if(jog<1)blendCapture(pose,sampleMocap('walk',cycle*mocap.walk.duration),weight*(1-jog));
   if(jog>0&&run<1)blendCapture(pose,sampleMocap('jog',cycle*mocap.jog.duration),weight*jog*(1-run));
   if(run>0)blendCapture(pose,sampleMocap('run',cycle*mocap.run.duration),weight*run);
   pose.clipId=speed<2?'walk':speed<4?'jog':'run';pose.torso[2]+=clamp(-(kinematics.turn||0)*.018,-.18,.18);
  }
  else if(action&&!action.aerial&&action.type==='shoot'){
   const at=Math.max(.12,action.contactAt||.24),elapsed=action.elapsed||0,after=Math.max(0,elapsed-at),recovery=action.type==='shoot'?.36:.28,clip=mocap.kick;
   const clipTime=action.hit?clip.contact+Math.min(1,after/recovery)*(clip.duration-clip.contact):Math.min(1,elapsed/at)*clip.contact;
   const weight=smooth(elapsed/.065)*(1-smooth((after/recovery-.72)/.28))*(action.type==='shoot'?.96:.65);
   blendCapture(pose,sampleMocap('kick',clipTime),weight);
   const contactWeight=Math.max(0,1-Math.abs(elapsed-at)/.075)*.8;if(ball&&contactWeight>0){pose.hipY=lerp(pose.hipY,.815,contactWeight);const z=(ball.x-p.x)*Math.sin(yaw)+(ball.z-p.z)*Math.cos(yaw),leg=solveLeg(clamp(z-.055,.15,.56),.08,pose.hipY);pose.legs[1].upper[0]=lerp(pose.legs[1].upper[0],leg[0],contactWeight);pose.legs[1].lower[0]=lerp(pose.legs[1].lower[0],leg[1],contactWeight);}
  }
 }
 if(!action&&!p.down&&!p.dive&&p.defending){pose.state='jockey';pose.hipY-=.04;pose.torso[0]=.16;for(let i=0;i<2;i++){pose.legs[i].lower[0]+=.12;pose.arms[i].upper[2]=i===0?-.4:.4;pose.arms[i].lower[0]=-.7;}}
 if(!action&&!p.down&&!p.dive){pose.torso[0]+=clamp((kinematics.acceleration||0)*.012,-.15,.12);if(pose.state==='receive')pose.legs[p.foot==='left'?0:1].lower[0]+=.15;}
 pose.feet=pose.legs.map((leg,i)=>{const cycle=((phase/(Math.PI*2)+i*.5)%1+1)%1,push=cycle>.32&&cycle<.56?Math.sin((cycle-.32)/.24*Math.PI)*amount*.22:0;return [clamp(-pose.hips[0]-leg.upper[0]-leg.lower[0]+push,-1.1,.8),0,clamp(-leg.upper[2]-leg.lower[2],-.3,.3)];});
 if(pose.captureFeet?.quaternions)for(let i=0;i<2;i++){const e=new Euler().setFromQuaternion(new Quaternion().setFromEuler(new Euler(...pose.feet[i])).slerp(pose.captureFeet.quaternions[i],pose.captureFeet.weight*.55),'XYZ');pose.feet[i]=[e.x,e.y,e.z];}
 if(action?.foot==='left'&&!action.aerial&&['shoot','pass','through','lob'].includes(action.type)){
  for(const key of ['hips','torso','head']){pose[key][1]*=-1;pose[key][2]*=-1;}
  for(const key of ['legs','arms']){pose[key].reverse();for(const limb of pose[key])for(const part of ['upper','lower']){limb[part][1]*=-1;limb[part][2]*=-1;}}
  pose.contacts.reverse();pose.feet.reverse();for(const foot of pose.feet){foot[1]*=-1;foot[2]*=-1;}
 }
 // Keep the running swing opposite the legs; transferred shoulder twist is not
 // compatible with this rig's straight upper-arm bind pose.
 if(!action&&!p.down&&!p.dive&&!celebrate&&!p.shield&&!p.defending&&forward>speed*.65&&speed>1.2){const w=smooth((speed-1.2)/2.4);for(let i=0;i<2;i++){const arm=pose.arms[i],side=i===0?-1:1;arm.upper[0]=lerp(arm.upper[0],clamp(-(pose.legs[i].upper[0]-pose.legs[1-i].upper[0])*.55,-.58,.66),w);arm.upper[1]*=1-w*.95;arm.upper[2]=lerp(arm.upper[2],side*.16,w);arm.lower[0]=lerp(arm.lower[0],-1.12-sprint*.14,w);arm.lower[1]*=1-w;arm.lower[2]*=1-w;}}
 // Separate receiving, turning and goalkeeper poses are authored independently of the kick capture.
 if(!action&&p.receivePrep&&time<p.receivePrep.until){const r=p.receivePrep,w=r.weight,i=r.foot==='left'?0:1;pose.state='receive-prepare';pose.hipY-=w*.026;pose.torso[0]+=.07*w;pose.torso[1]+=(i===0?-1:1)*.16*w;pose.arms[0].upper[2]-=.25*w;pose.arms[1].upper[2]+=.25*w;if(r.eta<.32){pose.legs[i].upper[0]-=.22*w;pose.legs[i].lower[0]+=.23*w;pose.legs[i].upper[1]=(i===0?-.38:.38)*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.receive&&time<p.receive.start+p.receive.duration){const r=p.receive,t=clamp((time-r.start)/r.duration,0,1),w=Math.sin(t*Math.PI),i=r.foot==='left'?0:1;pose.state='receive-'+r.kind;pose.hipY-=w*.03;if(r.kind==='chest'){pose.torso[0]=-.17*w;pose.arms[0].upper[2]=-.6*w;pose.arms[1].upper[2]=.6*w;pose.head[0]=.08*w;}else{pose.legs[i].upper[0]-=w*(r.kind==='thigh'?.9:r.kind==='instep'?.48:.18);pose.legs[i].upper[1]=r.kind==='inside'?(i===0?-.38:.38)*w:0;pose.legs[i].lower[0]+=.26*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.turnPlan&&time<p.turnPlan.start+p.turnPlan.duration){const t=clamp((time-p.turnPlan.start)/p.turnPlan.duration,0,1),w=Math.sin(t*Math.PI),sign=Math.sign(p.turnPlan.angle);pose.state=t<.25?'turn-brake':t<.5?'turn-plant':t<.65?'turn-touch':'turn-exit';pose.hipY-=w*.065;pose.torso[1]-=sign*w*.22;pose.hips[1]+=sign*w*.12;pose.torso[2]-=sign*w*.14;pose.contacts[p.turnPlan.foot==='left'?1:0]=1;}
 if(p.role==='GK'&&!p.down&&!p.dive&&!action){pose.state=speed>.5?'keeper-step':'keeper-ready';pose.hipY-=.065;pose.torso[0]=.17;for(let i=0;i<2;i++){pose.legs[i].lower[0]+=.15;pose.arms[i].upper[0]=-.45;pose.arms[i].lower[0]=-.75;}if(p.keeperMotion&&time<p.keeperMotion.until){pose.state='keeper-'+p.keeperMotion.kind;for(let i=0;i<2;i++){pose.arms[i].upper[0]=-1.1;pose.arms[i].lower[0]=-.7;}}}
 if(!action&&p.interaction&&time<p.interaction.until){pose.state='shoulder-duel';pose.torso[2]=p.interaction.side*.15;pose.arms[p.interaction.side>0?0:1].upper[2]=p.interaction.side*-.8;}
 for(const arm of pose.arms){arm.lower[1]*=.18;arm.lower[2]*=.16;}
 const style=p.motionStyle||'balanced';if(style!=='balanced'){for(const arm of pose.arms)arm.upper[0]*=style==='compact'?.8:1.15;pose.torso[0]+=style==='power'?.035:-.018;}
 if(action?.type==='pass'||action?.type==='through'){const w=Math.sin(clamp((action.elapsed||0)/((action.contactAt||.18)+.25),0,1)*Math.PI),i=action.foot==='left'?0:1;pose.legs[i].upper[1]+=(i===0?-.5:.5)*w;pose.feet[i][1]+=(i===0?-.4:.4)*w;}
 if(!action&&p.dribblePose&&time<p.dribblePose.start+p.dribblePose.duration){const r=p.dribblePose,w=Math.sin(clamp((time-r.start)/r.duration,0,1)*Math.PI),i=r.foot==='left'?0:1;pose.legs[i].upper[0]-=.10*w;pose.feet[i][1]+=(i===0?-.12:.12)*w;}
 if(action?.type==='shoot'&&(action.flair||String(action.flightStyle).toLowerCase().includes('outside'))){const i=action.foot==='left'?0:1,w=Math.sin(clamp(action.elapsed/((action.contactAt||.24)+.25),0,1)*Math.PI);pose.feet[i][1]+=(i===0?.45:-.45)*w;pose.legs[i].upper[1]+=(i===0?.3:-.3)*w;}
 if(action?.type==='feint')applySkillPose(pose,action);
 if(celebrate&&!p.down&&!action)applyCelebration(pose,p,time);
 // The stride's foot targets are used at every speed (the stride shrinks to nothing when standing) and through turn
 // plans, so the foot-plant IK is never switched on or off mid-motion, which made the feet jump when a player set off,
 // stopped or turned. A standing keeper or shielding player keeps his set pose.
 // A keeper standing ready is on both feet too: left out, the crouched keeper's feet were drawn 6 cm into the turf and
 // dropped there whenever a foot's pin let go.
 if((speed>.08||pose.state!=='shield')&&(!action||action.move)&&!p.down&&!p.dive&&!celebrate&&!pose.state.startsWith('receive')&&!(p.interaction&&time<p.interaction.until)){
  const gait=gaitTargets(p,phase),m=gait.metrics;pose.hipY=Math.min(pose.hipY,gait.hipY);pose.contacts=gait.contacts;pose.gaitTargets=gait.feet;
  for(let i=0;i<2;i++){const target=gait.feet[i],leg=solveLeg(target.z,target.y,pose.hipY+m.hipOffset,m.upperLeg,m.lowerLeg);pose.legs[i].upper[0]=leg[0];pose.legs[i].lower[0]=leg[1];pose.legs[i].upper[2]=-Math.atan2(target.x-(i===0?-1:1)*m.hipX,Math.max(.3,pose.hipY+m.hipOffset-.075-target.y));pose.feet[i]=[-pose.hips[0]-leg[0]-leg[1],0,-pose.legs[i].upper[2]];}
 }
 // Dribble touches are played by a foot that is on the ball. Each pull in dribblePose.pulls eases one foot onto the ball
 // from `from` to `at` (following the ball until its contact point is fixed) and back into the stride over 0.12 s. Every
 // weight is a smooth function of time, so the drawn foot never jumps.
 // A skill move on the run first shapes the stride (moveTargets); then each of its touches is played by the foot on the
 // move's side, which eases onto the ball over the 0.1 s before the touch and off the contact point after it.
 if(action?.move&&pose.gaitTargets)moveTargets(pose,p,action,phase,yaw);
 if(action?.move&&action.events){const start=time-action.elapsed,foot=action.side>0?0:1;
  for(const e of action.events){const spec=e.spec;if(!spec||!(spec[3]>0))continue;const at=start+e.at;if(time<at-.1||time>=at+.12)continue;
   const w=time<at?smooth((time-at+.1)/.1):1-smooth((time-at)/.12);reachFoot(pose,p,foot,time<at?ball:e.spot||ball,w,phase,yaw);}}
 const pulls=!action&&p.dribblePose?.pulls;
 if(pulls)for(const q of pulls){
  // A drag (assists.js startDrag) holds the foot on the ball for `hold` seconds after `at` before it eases off.
  const end=q.at+(q.hold||0);if(time<q.from||time>=end+.12)continue;
  const w=time<q.at?smooth((time-q.from)/Math.max(.001,q.at-q.from)):time<end?1:1-smooth((time-end)/.12);
  reachFoot(pose,p,q.foot==='left'?0:1,q.target||ball,w,phase,yaw,q.stride);
 }
 // No boot passes through the ball: a foot whose toe would be inside it is held at its surface.
 if(!action&&ball&&pose.gaitTargets)keepFeetOutOfBall(pose,p,ball,phase,yaw);
 if(!action&&!p.down&&!p.dive&&!celebrate){
  if(p.turnPlan&&time<p.turnPlan.start+p.turnPlan.duration){const u=clamp((time-p.turnPlan.start)/p.turnPlan.duration,0,1);blendUpperCapture(pose,'turn',u*mocap.turn.duration,.22*Math.sin(u*Math.PI)**2,p.turnPlan.angle<0);}
  else if((kinematics.acceleration||0)<-2)blendUpperCapture(pose,'stop',mocap.stop.duration-clamp(speed/8,0,1)*.7,.20*smooth((-(kinematics.acceleration||0)-2)/6));
 }
 return pose;
}

// The boot's toe is about 0.15 m ahead of the ankle, so an ankle this far behind the ball's centre has the boot on the
// ball's surface rather than inside it (assists.js uses the same distance for leg reach).
const ANKLE_BEHIND=.26;
/** Moves foot `i` toward just behind the ball with weight `w`, on top of the stride. */
function reachFoot(pose,p,i,target,w,phase,yaw,stride=false){
 if(!target||!(w>0))return;
 const m=gaitTargets(p,phase).metrics,s=Math.sin(yaw),c=Math.cos(yaw),dx=target.x-(p.x||0),dz=target.z-(p.z||0);
 const base=pose.gaitTargets?.[i]||{x:(i===0?-1:1)*m.hipX,y:.075,z:0},lz=dx*s+dz*c-ANKLE_BEHIND,lx=dx*c-dz*s;
 // A stride only settles onto a ball its foot is already close to (full within 0.15 m, none beyond 0.4 m); it never
 // drags the foot across to a ball the run has left behind or beside.
 if(stride)w*=1-smooth((Math.hypot(lz-base.z,lx-base.x)-.15)/.25);
 if(!(w>0))return;
 // A ball in the air (juggling, a lifted ball) is met at its height.
 const tz=base.z+(lz-base.z)*w,tx=base.x+(lx-base.x)*w,ty=base.y+(Math.max(.09,(target.y??.11)-.12)-base.y)*w;
 // The leg swings out sideways to a ball beside the body, so it is solved along that tilted line, not straight down.
 const down=Math.max(.3,pose.hipY+m.hipOffset-.075-ty),lateral=tx-(i===0?-1:1)*m.hipX,tilted=Math.hypot(down,lateral);
 const leg=solveLeg(tz,ty-(tilted-down),pose.hipY+m.hipOffset,m.upperLeg,m.lowerLeg);pose.legs[i].upper[0]=leg[0];pose.legs[i].lower[0]=leg[1];pose.legs[i].upper[2]=-Math.atan2(lateral,down);pose.feet[i]=[-pose.hips[0]-leg[0]-leg[1],0,-pose.legs[i].upper[2]];pose.contacts[i]=0;
 // The foot-plant pass re-solves the legs toward the gait targets in world space, so the reach goes there too.
 if(pose.gaitTargets){pose.gaitTargets=pose.gaitTargets.slice();pose.gaitTargets[i]={x:tx,y:ty,z:tz};}
}

/** Pushes each drawn foot out of the ball (toe 0.15 m ahead of the ankle, 0.03 m above it), along the line from the
 * ball's centre, so a stride that does not play the ball steps against it instead of through it. */
function keepFeetOutOfBall(pose,p,ball,phase,yaw){
 const m=gaitTargets(p,phase).metrics,s=Math.sin(yaw),c=Math.cos(yaw),dx=ball.x-(p.x||0),dz=ball.z-(p.z||0),bz=dx*s+dz*c,bx=dx*c-dz*s,by=ball.y??.11,clear=.11+.01;
 for(let i=0;i<2;i++){const t=pose.gaitTargets[i],ox=t.x-bx,oy=t.y+.03-by,oz=t.z+.15-bz,d=Math.hypot(ox,oy,oz);if(d>=clear)continue;
  // Pushed out to the ball's surface along a direction that turns smoothly upward as the toe gets deeper, so a ball
  // rolling through the foot lifts it over the top instead of flipping it from one side to the other near the centre
  // (a radial push reverses there, and the foot jumped 7 cm in 1 ms).
  const vy=oy+2*(clear-d),n=Math.hypot(ox,vy,oz),tx=t.x+ox*clear/n-ox,ty=Math.max(.075,t.y+vy*clear/n-oy),tz=t.z+oz*clear/n-oz;
  const down=Math.max(.3,pose.hipY+m.hipOffset-.075-ty),lateral=tx-(i===0?-1:1)*m.hipX,tilted=Math.hypot(down,lateral);
  const leg=solveLeg(tz,ty-(tilted-down),pose.hipY+m.hipOffset,m.upperLeg,m.lowerLeg);pose.legs[i].upper[0]=leg[0];pose.legs[i].lower[0]=leg[1];pose.legs[i].upper[2]=-Math.atan2(lateral,down);pose.feet[i]=[-pose.hips[0]-leg[0]-leg[1],0,-pose.legs[i].upper[2]];
  pose.gaitTargets=pose.gaitTargets.slice();pose.gaitTargets[i]={x:tx,y:ty,z:tz};}
}

/** Foot-target offsets (local x toward the player's left, y up, z forward) for a skill move on the run, by pose kind;
 * `side` points toward the move's side. */
function moveTargets(pose,p,a,phase,yaw){
 // feet[0] sits on the body's +z side when facing +x, the player's right (↓ in the guide); local -x points right.
 const u=Math.min(1,a.elapsed/a.duration),w=Math.sin(u*Math.PI),arc=Math.sin(u*Math.PI*2),i=a.side>0?0:1,side=a.side>0?-1:1,m=gaitTargets(p,phase).metrics;
 const offsets=[[0,0,0],[0,0,0]],o=offsets[i];
 switch(a.pose){
  case 'step-over':case 'step-over-reverse':{const r=a.pose==='step-over'?1:-1;o[0]=side*r*arc*.24;o[1]=.12*w;o[2]=.16*w;break;}
  case 'feint':o[0]=side*.1*w;break;
  case 'drag':o[1]=.06*w;o[2]=.22*w*(1-1.6*smooth(u));break;
  case 'roll':o[0]=side*(.2-.4*u)*w;o[1]=.05*w;o[2]=.22*w;break;
  case 'heel':o[1]=.3*w;o[2]=-.25*w;break;
  case 'lift':o[1]=.18*w;o[2]=.2*w;break;
  case 'rainbow':o[1]=.42*w;o[2]=-.2*w;break;
  case 'elastico':o[0]=side*arc*.22;o[1]=.04*w;o[2]=.2*w;break;
  case 'roulette':o[0]=side*arc*.1;o[1]=.05*w;o[2]=.15*w;break;
  case 'scoop':o[0]=side*.15*w;o[1]=.15*w;o[2]=.15*w;break;
  case 'rabona':o[0]=-side*.3*w;o[1]=.12*w;o[2]=.05*w;break;
  case 'juggle':{const k=Math.max(0,Math.sin(u*Math.PI*5))*w;o[1]=.25*k;o[2]=.15*k;break;}
  case 'fake-step':o[1]=.1*w;o[2]=.15*w;break;
  case 'side-step':offsets[0][0]=offsets[1][0]=side*.2*w;break;
  case 'jump':offsets[0][1]=offsets[1][1]=.25*w;break;
 }
 pose.gaitTargets=pose.gaitTargets.slice();
 for(let k=0;k<2;k++){const [dx,dy,dz]=offsets[k];if(!dx&&!dy&&!dz)continue;const t=pose.gaitTargets[k],tx=t.x+dx,ty=Math.max(.075,t.y+dy),tz=t.z+dz;
  const down=Math.max(.3,pose.hipY+m.hipOffset-.075-ty),lateral=tx-(k===0?-1:1)*m.hipX,tilted=Math.hypot(down,lateral);
  const leg=solveLeg(tz,ty-(tilted-down),pose.hipY+m.hipOffset,m.upperLeg,m.lowerLeg);pose.legs[k].upper[0]=leg[0];pose.legs[k].lower[0]=leg[1];pose.legs[k].upper[2]=-Math.atan2(lateral,down);pose.feet[k]=[-pose.hips[0]-leg[0]-leg[1],0,-pose.legs[k].upper[2]];
  pose.gaitTargets[k]={x:tx,y:ty,z:tz};if(dy>.02)pose.contacts[k]=0;}
}
