import {KEEPER} from './keeper-tuning.js';
import {gaitTargets} from './gait.js';
import {applySkillPose} from './skills.js';
import {applyCelebration} from './celebrations.js';
import {Quaternion,Euler} from '../vendor/three.module.js';
import {mocap} from './mocap-data.js';
import {clamp} from './config.js';
const lerp=(a,b,t)=>a+(b-a)*t;
const WALK_SHIFT=.55;
const HELD_STATES=new Set(['idle','run','sprint','close-control','jockey','start','stop','turn','backpedal','keeper-step','keeper-ready']);
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
 const speed=Math.hypot(p.vx||0,p.vz||0),amount=clamp(speed/7.5,0,1),sprint=smooth((speed-5)/3),tight=p.closeControl||p.shield;
 const yaw=p.yaw||0,forward=(p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw),side=(p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw);
 const pose={contacts:[1,0],state:speed<.2?'idle':tight?'close-control':Math.abs(side)>speed*.65?'jockey':speed>(kinematics.state==='sprint'?5.6:6)?'sprint':'run',hipY:.897+Math.sin(time*2.2)*.002,rootRoll:0,rootY:0,hips:[0,0,0],torso:[.02,0,0],head:[0,0,0],legs:[{upper:[0,0,0],lower:[.08,0,0]},{upper:[0,0,0],lower:[.08,0,0]}],arms:[{upper:[0,0,.12],lower:[-.28,0,0]},{upper:[0,0,-.12],lower:[-.28,0,0]}]};
 const stride=amount*(tight?.25:.39+sprint*.1),direction=forward<-.3?-1:1;

 pose.hipY-=amount*.045;pose.hipY+=Math.cos(phase*2)*amount*.013;
 pose.hips[1]=Math.sin(phase)*amount*.075;pose.hips[2]=Math.cos(phase)*amount*.025;
 pose.torso[0]=amount*.1+sprint*.07+clamp((kinematics.acceleration||0)*.008,-.12,.12);
 pose.torso[1]=-Math.sin(phase)*amount*.11;pose.torso[2]=clamp(-(kinematics.turn||0)*amount*.024,-.22,.22)-side*.014;
 // Standing: a relaxed athletic stance rather than a mannequin's. Knees soft, chest slightly over the feet, arms loose
 // at the sides, and a slow weight shift from one leg to the other (the pelvis tilts, the shoulders counter it).
 if(speed<.2){const shift=Math.sin(time*.55+(p.id||0)*1.7);pose.hips[2]=shift*.045+Math.sin(time*1.1)*.012;pose.torso[2]=-pose.hips[2]*.75;pose.torso[0]+=.035;pose.hipY-=.016;pose.head[0]+=.03;for(let i=0;i<2;i++){pose.arms[i].upper[0]=-.06+Math.sin(time*.9+i)*.015;pose.arms[i].upper[2]=(i===0?1:-1)*.075;pose.arms[i].lower[0]=-.34;}}
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
 // Start, stop and turn leans grow continuously with the smoothed acceleration and turn rate. Switching them on at a
 // threshold popped the torso several times a second on a curving dribble, and each label change restarted the
 // renderer's inertial transition; the label now changes only for a clear start, stop or turn.
 if(!p.action&&speed>.2){const acceleration=kinematics.acceleration||0,turning=Math.abs(kinematics.turn||0),start=smooth((acceleration-2)/4),stop=smooth((-acceleration-2)/4),turn=smooth((turning-1.2)/2.5);
  pose.torso[0]+=.10*start-.14*stop;pose.hipY-=.035*stop+.025*turn*(1-stop);
  const held=kinematics.state;if(acceleration>(held==='start'?3:4.5))pose.state='start';else if(acceleration<(held==='stop'?-3:-4.5))pose.state='stop';else if(turning>(held==='turn'?2.2:3))pose.state='turn';else if(forward<(held==='backpedal'?-.15:-.3))pose.state='backpedal';if(p.defending){pose.state='jockey';pose.hipY-=.035;pose.arms[0].upper[2]=.32;pose.arms[1].upper[2]=-.32;}}
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
 // The captured gait and the arm swing used to switch on and off with "running forward"
 // (forward > 0.65 x speed) in one frame, without a state change for the inertial blend to cover.
 // Both now use one weight: 0 at 0.5 and 1 at 0.8 of speed forward, followed by the renderer over
 // 0.2 s (kinematics.capture).
 const captureTarget=!action&&!p.shield&&speed>.25?smooth((forward/speed-.5)/.3):0,capture=kinematics.capture??captureTarget;pose.captureTarget=captureTarget;
 if(!p.down&&!p.dive&&!celebrate){
  if(!action&&capture>.001&&speed>.25){const cycle=((phase/(Math.PI*2))%1+1)%1;
   const jog=smooth((speed-1.5)/1.3),run=smooth((speed-3.5)/1.5),weight=smooth((speed-.25)/.9)*.78*capture;
   // CMU 16_15 lands its right foot at cycle 0.02 and left at 0.61, half a stride away from the
   // jog and run clips (left at 0.04 / 0.98, right at 0.54 / 0.50) that it is blended with. Shift it
   // by 0.55 of a cycle so all three land the same foot together (residual 0.05 on each foot).
   if(jog<1)blendCapture(pose,sampleMocap('walk',((cycle+WALK_SHIFT)%1)*mocap.walk.duration),weight*(1-jog));
   if(jog>0&&run<1)blendCapture(pose,sampleMocap('jog',cycle*mocap.jog.duration),weight*jog*(1-run));
   if(run>0)blendCapture(pose,sampleMocap('run',cycle*mocap.run.duration),weight*run);
   pose.clipId=speed<2?'walk':speed<4?'jog':'run';pose.torso[2]+=clamp(-(kinematics.turn||0)*.018,-.18,.18)*capture;
  }
  else if(action&&!action.aerial&&(action.type==='shoot'||action.type==='lob')){
   // Crosses and lofted passes use the captured instep kick too; the procedural swing alone barely lifted the leg.
   const at=Math.max(.12,action.contactAt||.24),elapsed=action.elapsed||0,after=Math.max(0,elapsed-at),recovery=action.type==='shoot'?.36:.28,clip=mocap.kick;
   const clipTime=action.hit?clip.contact+Math.min(1,after/recovery)*(clip.duration-clip.contact):Math.min(1,elapsed/at)*clip.contact;
   const weight=smooth(elapsed/.065)*(1-smooth((after/recovery-.72)/.28))*(action.type==='shoot'?.96:.82);
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
 if(!action&&!p.down&&!p.dive&&!celebrate&&!p.shield&&!p.defending&&capture>.001&&speed>1.2){const w=smooth((speed-1.2)/2.4)*capture;for(let i=0;i<2;i++){const arm=pose.arms[i],side=i===0?-1:1;arm.upper[0]=lerp(arm.upper[0],clamp(-(pose.legs[i].upper[0]-pose.legs[1-i].upper[0])*.55,-.58,.66),w);arm.upper[1]*=1-w*.95;arm.upper[2]=lerp(arm.upper[2],side*.16,w);arm.lower[0]=lerp(arm.lower[0],-1.12-sprint*.14,w);arm.lower[1]*=1-w;arm.lower[2]*=1-w;}}
 // Separate receiving, turning and goalkeeper poses are authored independently of the kick capture.
 if(!action&&p.receivePrep&&time<p.receivePrep.until){const r=p.receivePrep,w=r.weight,i=r.foot==='left'?0:1;pose.state='receive-prepare';pose.hipY-=w*.026;pose.torso[0]+=.07*w;pose.torso[1]+=(i===0?-1:1)*.16*w;pose.arms[0].upper[2]-=.25*w;pose.arms[1].upper[2]+=.25*w;if(r.eta<.32){pose.legs[i].upper[0]-=.22*w;pose.legs[i].lower[0]+=.23*w;pose.legs[i].upper[1]=(i===0?-.38:.38)*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.receive&&time<p.receive.start+p.receive.duration){const r=p.receive,t=clamp((time-r.start)/r.duration,0,1),w=Math.sin(t*Math.PI),i=r.foot==='left'?0:1;pose.state='receive-'+r.kind;pose.hipY-=w*.03;if(r.kind==='chest'){pose.torso[0]=-.17*w;pose.arms[0].upper[2]=-.6*w;pose.arms[1].upper[2]=.6*w;pose.head[0]=.08*w;}else{pose.legs[i].upper[0]-=w*(r.kind==='thigh'?.9:r.kind==='instep'?.48:.18);pose.legs[i].upper[1]=r.kind==='inside'?(i===0?-.38:.38)*w:0;pose.legs[i].lower[0]+=.26*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.turnPlan&&time<p.turnPlan.start+p.turnPlan.duration){const t=clamp((time-p.turnPlan.start)/p.turnPlan.duration,0,1),w=Math.sin(t*Math.PI),sign=Math.sign(p.turnPlan.angle);pose.state=t<.25?'turn-brake':t<.5?'turn-plant':t<.65?'turn-touch':'turn-exit';pose.hipY-=w*.065;pose.torso[1]-=sign*w*.22;pose.hips[1]+=sign*w*.12;pose.torso[2]-=sign*w*.14;pose.contacts[p.turnPlan.foot==='left'?1:0]=1;}
 if(p.role==='GK'&&!p.down&&!p.dive&&!action){pose.state=speed>(kinematics.state==='keeper-step'?.35:.5)?'keeper-step':'keeper-ready';pose.hipY-=.065;pose.torso[0]=.17;for(let i=0;i<2;i++){pose.legs[i].lower[0]+=.15;pose.arms[i].upper[0]=-.45;pose.arms[i].lower[0]=-.75;}if(p.keeperMotion&&time<p.keeperMotion.until){pose.state='keeper-'+p.keeperMotion.kind;for(let i=0;i<2;i++){pose.arms[i].upper[0]=-1.1;pose.arms[i].lower[0]=-.7;}}}
 if(!action&&p.interaction&&time<p.interaction.until){pose.state='shoulder-duel';pose.torso[2]=p.interaction.side*.15;pose.arms[p.interaction.side>0?0:1].upper[2]=p.interaction.side*-.8;}
 for(const arm of pose.arms){arm.lower[1]*=.18;arm.lower[2]*=.16;}
 const style=p.motionStyle||'balanced';if(style!=='balanced'){for(const arm of pose.arms)arm.upper[0]*=style==='compact'?.8:1.15;pose.torso[0]+=style==='power'?.035:-.018;}
 if(action?.type==='pass'||action?.type==='through'){const w=Math.sin(clamp((action.elapsed||0)/((action.contactAt||.18)+.25),0,1)*Math.PI),i=action.foot==='left'?0:1;pose.legs[i].upper[1]+=(i===0?-.5:.5)*w;pose.feet[i][1]+=(i===0?-.4:.4)*w;}
 if(!action&&p.dribblePose&&time<p.dribblePose.start+p.dribblePose.duration){const r=p.dribblePose,w=Math.sin(clamp((time-r.start)/r.duration,0,1)*Math.PI),i=r.foot==='left'?0:1;pose.legs[i].upper[0]-=.10*w;pose.feet[i][1]+=(i===0?-.12:.12)*w;}
 if(action?.type==='shoot'&&(action.flair||String(action.flightStyle).toLowerCase().includes('outside'))){const i=action.foot==='left'?0:1,w=Math.sin(clamp(action.elapsed/((action.contactAt||.24)+.25),0,1)*Math.PI);pose.feet[i][1]+=(i===0?.45:-.45)*w;pose.legs[i].upper[1]+=(i===0?.3:-.3)*w;}
 if(action?.type==='feint')applySkillPose(pose,action);
 if(celebrate&&!p.down&&!action)applyCelebration(pose,p,time);
 if(!action&&!p.down&&!p.dive&&!celebrate&&!pose.state.startsWith('receive')&&!(p.interaction&&time<p.interaction.until)){
  const gait=gaitTargets(p,phase),m=gait.metrics;pose.hipY=Math.min(pose.hipY,gait.hipY);pose.contacts=gait.contacts;pose.gaitTargets=gait.feet;
  for(let i=0;i<2;i++){const target=gait.feet[i],leg=solveLeg(target.z,target.y,pose.hipY+m.hipOffset,m.upperLeg,m.lowerLeg);pose.legs[i].upper[0]=leg[0];pose.legs[i].lower[0]=leg[1];pose.legs[i].upper[2]=-Math.atan2(target.x-(i===0?-1:1)*m.hipX,Math.max(.3,pose.hipY+m.hipOffset-.075-target.y));pose.feet[i]=[-pose.hips[0]-leg[0]-leg[1],0,-pose.legs[i].upper[2]];}
 }
 if(!action&&!p.down&&!p.dive&&!celebrate){
  if(p.turnPlan&&time<p.turnPlan.start+p.turnPlan.duration){const u=clamp((time-p.turnPlan.start)/p.turnPlan.duration,0,1);blendUpperCapture(pose,'turn',u*mocap.turn.duration,.22*Math.sin(u*Math.PI)**2,p.turnPlan.angle<0);}
  else if((kinematics.acceleration||0)<-2)blendUpperCapture(pose,'stop',mocap.stop.duration-clamp(speed/8,0,1)*.7,.20*smooth((-(kinematics.acceleration||0)-2)/6));
 }
 // Locomotion labels flickered for 1-5 frames (run>start>run, run>stop>run, keeper-step>ready),
 // and every change restarts the renderer's inertial transition. With the thresholds above now
 // using hysteresis, a locomotion label is also held for at least 0.15 s.
 if(HELD_STATES.has(pose.state)&&HELD_STATES.has(kinematics.state)&&pose.state!==kinematics.state&&(kinematics.stateAge??1)<.15)pose.state=kinematics.state;
 return pose;
}
