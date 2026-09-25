import {KEEPER} from './keeper-tuning.js';
import {locomotionPose,legIK} from './gait.js';
import {bodyMetrics} from './body-shape.js';
import {ASSIST,dribbleFoot} from './assists.js';
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
 pose.hipY=lerp(pose.hipY,.875+(data[0]-.85)*.55,weight);pose.captureFeet={quaternions:data.ankles,weight};const targets=[pose.hips,pose.torso,pose.head,...pose.legs.flatMap(l=>[l.upper,l.lower]),...pose.arms.flatMap(a=>[a.upper,a.lower])];
 for(let i=0;i<targets.length;i++){const target=targets[i],from=new Quaternion().setFromEuler(new Euler(...target)),to=data.rotations?.[i]||new Quaternion().setFromEuler(new Euler(...data.slice(1+i*3,4+i*3))),e=new Euler().setFromQuaternion(from.slerp(to,weight),'XYZ');target[0]=e.x;target[1]=e.y;target[2]=e.z;}
}
export function captureContacts(name,cycle){const clip=mocap[name],i=Math.min(clip.frames.length-1,Math.floor(clamp(cycle,0,1)*(clip.frames.length-1)));return clip.contacts?.[i]||[1,0];}
export function solveLeg(forward,height,hipY,a=.35,b=.4){
 const down=Math.max(.1,hipY-.075-height),r=clamp(Math.hypot(down,forward),.15,a+b-.002);
 return [-Math.atan2(forward,down)-Math.acos(clamp((a*a+r*r-b*b)/(2*a*r),-1,1)),Math.PI-Math.acos(clamp((a*a+b*b-r*r)/(2*a*b),-1,1))];
}
// World point to unscaled root-space coordinates of the player's rig.
function toLocal(p,m,point){const dx=point.x-(p.x||0),dz=point.z-(p.z||0),yaw=p.yaw||0;return {x:(dx*Math.cos(yaw)-dz*Math.sin(yaw))/m.scale,y:(point.y??.11)/m.scale,z:(dx*Math.sin(yaw)+dz*Math.cos(yaw))/m.scale};}
const reachSide=i=>i===0?-1:1;
// Foot meeting a rolling ball: laces behind it on a run, the inside of the foot beside it when slow or turning.
function touchTarget(ball,i,inside){const s=reachSide(i);return {x:clamp(ball.x+s*lerp(.015,.075,inside),s>0?-.08:-.34,s>0?.34:.08),y:.1,z:clamp(ball.z-lerp(.15,.08,inside),.02,.62),pitch:.35*(1-inside),yaw:s*lerp(.1,1,inside)};}
// Dribbling: the foot the rules will touch with reaches onto the ball as that touch falls
// due, then pushes through along the run and hands back to the stride.
function dribbleReach(reach,p,m,ball,time,kin){
 if(!(p.dribbleAim||p.dribbleStop)||!ball||ball.y>.38)return 0;
 const speed=Math.hypot(p.vx||0,p.vz||0),local=toLocal(p,m,ball);if(Math.hypot(local.x,local.z)*m.scale>1.8)return 0;
 const inside=Math.max(1-smooth((speed-2)/1.6),smooth((Math.abs(kin.turn||0)-1.2)/1.5));
 const gaps=['left','right'].map(f=>{const at=dribbleFoot(p,f);return Math.hypot(at.x-ball.x,at.z-ball.z);}),next=gaps[0]<gaps[1]?0:1;
 const due=smooth((.2-((p.nextDribbleTouch||0)-time))/.2),close=smooth((.42-Math.max(0,gaps[next]-ASSIST.footReach))/.36);
 if(due*close>0)reach[next]={...touchTarget(local,next,inside),weight:due*close};
 const touch=p.dribblePose,since=touch?time-touch.start:9;
 if(since>=0&&since<.22){const i=touch.foot==='left'?0:1,anchor=toLocal(p,m,dribbleFoot(p,touch.foot)),push=Math.sin(Math.PI*Math.min(1,since/.22)),t=touchTarget({x:anchor.x,z:anchor.z+.12*push},i,inside),weight=1-smooth(since/.22);
  if(weight>(reach[i]?.weight||0))reach[i]={...t,y:.1+.05*push,weight};}
 return 1;
}
// First touch: before contact the chosen foot, instep or thigh goes to where the ball will
// arrive; after contact the leg gives with the ball (cushion) and returns to the stride.
function receiveReach(reach,p,m,ball,time,pose){
 const prep=p.receivePrep&&time<p.receivePrep.until?p.receivePrep:null,done=p.receive&&time<p.receive.start+p.receive.duration?p.receive:null,r=done||prep;
 if(!r?.target||r.kind==='chest')return;
 const i=r.foot==='left'?0:1,s=reachSide(i),at=toLocal(p,m,r.target),kind=r.kind==='intercept'||r.kind==='redirect'?'inside':r.kind;
 const since=done?time-(done.contactTime??done.start):0,weight=done?1-smooth(since/(kind==='thigh'?.3:.22)):(r.weight??1)*smooth((.42-(r.eta??0))/.32);if(weight<=0)return;
 let target;
 if(kind==='inside'){
  // The inside of the foot faces the incoming ball; after contact it gives back with it.
  const yawNow=p.yaw||0,travel=r.incoming?{x:r.incoming.x*Math.cos(yawNow)-r.incoming.z*Math.sin(yawNow),z:r.incoming.x*Math.sin(yawNow)+r.incoming.z*Math.cos(yawNow)}:ball&&!done?{x:at.x-toLocal(p,m,ball).x,z:at.z-toLocal(p,m,ball).z}:{x:0,z:-1};
  const n=Math.hypot(travel.x,travel.z)||1,ix=travel.x/n,iz=travel.z/n;
  const yaw=clamp(s>0?Math.atan2(-iz,ix):Math.atan2(iz,-ix),s>0?-.3:-1.25,s>0?1.25:.3),give=done?.14*smooth(since/.16):0;
  target={x:at.x+ix*.15-Math.sin(yaw)*.03,y:.1,z:at.z+iz*.15-Math.cos(yaw)*.03-give,pitch:0,yaw};
 }else if(kind==='instep')target={x:at.x+s*.02,y:clamp(at.y-.07,.12,.5),z:at.z-.09-(done?.1*smooth(since/.2):0),pitch:.9,yaw:s*.15};
 else{
  // Thigh: raise the knee to the ball's height; the shank hangs below it.
  const hip=pose.hipY+m.hipOffset-.075,knee=clamp(at.y-.06-(done?.12*smooth(since/.25):0),hip-.33,hip-.02),angle=Math.acos(clamp((hip-knee)/m.upperLeg,-1,1));
  target={x:s*m.hipX,y:Math.max(.16,knee-m.lowerLeg*.92),z:m.upperLeg*Math.sin(angle)-.12,pitch:.5,yaw:s*.1};
 }
 target.x=clamp(target.x,s>0?-.1:-.4,s>0?.4:.1);target.z=clamp(target.z,-.2,.62);reach[i]={...target,weight:Math.max(weight,reach[i]?.weight||0)};
}
// Kick authored for the right foot (the left foot mirrors later): plant beside the
// ball, wind up with the hip, swing through the ball and follow the target line.
function kickPose(pose,p,action,ball,yaw){
 const t=action.elapsed||0,contact=Math.max(.12,action.contactAt||.18),pre=clamp(t/contact,0,1),after=action.hit?clamp((t-contact)/.32,0,1):0;
 const shot=action.type==='shoot',lofted=action.type==='lob'||!!action.chip,inside=!shot&&!lofted,strength=shot?.7+(action.power||0)*.3:lofted?.75:.55;
 const m=bodyMetrics(p),side=action.foot==='left'?-1:1,dx=ball?ball.x-(p.x||0):0,dz=ball?ball.z-(p.z||0):.45;
 const bx=clamp(side*(dx*Math.cos(yaw)-dz*Math.sin(yaw))/m.scale,-.1,.25),bz=clamp((dx*Math.sin(yaw)+dz*Math.cos(yaw))/m.scale,.15,.62);
 const back=Math.sin(clamp(pre/.55,0,1)*Math.PI/2)*(1-smooth((pre-.55)/.45)),through=smooth((pre-.4)/.6)*(1-smooth((after-.35)/.65)),settle=smooth(after);
 // Shots are re-posed by the kick capture below, so their feet are recomputed from the final legs.
 pose.state=action.type;pose.rootRoll=0;pose.rootY=0;pose.feetSolved=!shot;pose.contacts=[1,0];pose.feet=[[0,0,0],[0,0,0]];
 pose.hipY=(shot?.835:.855)-back*.02-pre*(1-after)*.015+settle*.02;
 pose.hips=[.07+.05*strength*(1-settle),(.26*back-.3*through)*strength,.05*back+.03*through];
 pose.torso=[(lofted?.02:.12)+.06*strength*through-pose.hips[0]*.5,-pose.hips[1]*.55,.08*strength];
 pose.head=[.28-(pose.hips[0]+pose.torso[0])*.4,-(pose.hips[1]+pose.torso[1])*.8,-(pose.hips[2]+pose.torso[2])*.6];
 legIK(pose,m,0,{x:clamp(bx-.23,-.34,-.14),y:.075,z:bz-.1},0,-.12);
 const lift=inside?.24:.32,start={x:.1,y:.075,z:-.04},wind={x:.14,y:.1+lift*strength,z:-.28-.12*strength},hit={x:bx+(inside?.03:0),y:.1,z:bz-(inside?.12:.1)};
 const high={x:bx-.02,y:.1+(inside?.14:.3)*strength+(lofted?.12:0),z:bz+.18+.2*strength},down={x:.08,y:.075,z:bz+.05};
 const seg=(a,b,u)=>{const w=smooth(u);return {x:lerp(a.x,b.x,w),y:lerp(a.y,b.y,w),z:lerp(a.z,b.z,w)};};
 const foot=action.hit?(after<.4?seg(hit,high,after/.4):seg(high,down,(after-.4)/.6)):pre<.55?seg(start,wind,pre/.55):seg(wind,hit,(pre-.55)/.45);
 // Inside-foot passes turn the foot out; shots and lofted balls point the toe.
 const turn=inside?lerp(.15,1.1,smooth(pre/.6))*(1-settle*.7):.12,point=(shot?.55:lofted?.3:0)*smooth((pre-.5)/.5)*(1-settle);
 legIK(pose,m,1,foot,point,turn,action.hit?0:back*.8,.1);
 pose.arms[0].upper=[-.35-.35*through,0,.85+.45*strength*back+.3*through];pose.arms[0].lower=[-.55,0,0];
 pose.arms[1].upper=[.45*back-.2*through,0,-(.35+.25*strength)];pose.arms[1].lower=[-.45,0,0];
}
export function sampleMotion(p={},phase=0,time=0,ball=null,celebrate=false,kinematics={}){
 const speed=Math.hypot(p.vx||0,p.vz||0),amount=clamp(speed/7.5,0,1),sprint=smooth((speed-5)/3),tight=p.closeControl||p.shield;
 const yaw=p.yaw||0,forward=(p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw),side=(p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw);
 const pose={contacts:[1,0],state:speed<.2?'idle':tight?'close-control':Math.abs(side)>speed*.65?'jockey':speed>6?'sprint':'run',hipY:.885+Math.sin(time*2.2)*.003,rootRoll:0,rootY:0,hips:[0,0,0],torso:[.02,0,0],head:[0,0,0],legs:[{upper:[0,0,0],lower:[.08,0,0]},{upper:[0,0,0],lower:[.08,0,0]}],arms:[{upper:[0,0,.12],lower:[-.28,0,0]},{upper:[0,0,-.12],lower:[-.28,0,0]}]};
 const stride=amount*(tight?.25:.39+sprint*.1),direction=forward<-.3?-1:1;
 pose.hipY-=amount*.045;pose.hipY+=Math.cos(phase*2)*amount*.013;
 pose.hips[1]=Math.sin(phase)*amount*.075;pose.hips[2]=Math.cos(phase)*amount*.025;
 pose.torso[0]=amount*.1+sprint*.07+clamp((kinematics.acceleration||0)*.008,-.12,.12);
 pose.torso[1]=-Math.sin(phase)*amount*.11;pose.torso[2]=clamp(-(kinematics.turn||0)*amount*.024,-.22,.22)-side*.014;
 for(let i=0;i<2;i++){
  const cycle=((phase/(Math.PI*2)+i*.5)%1+1)%1,stance=cycle<.56;
  pose.contacts[i]=stance?1:0;const t=stance?cycle/.56:(cycle-.56)/.44;
  const z=(stance?lerp(stride,-stride,t):lerp(-stride,stride,smooth(t)))*direction;
  const y=.068+(stance?0:Math.sin(t*Math.PI)*amount*(.12+sprint*.14));
  const [hip,knee]=solveLeg(z,y,pose.hipY);pose.legs[i].upper[0]=hip;pose.legs[i].lower[0]=knee;
  pose.legs[i].upper[2]=-side*.032+(i===0?.025:-.025)*amount;
  const wave=Math.sin(phase+i*Math.PI);pose.arms[i].upper[0]=-wave*amount*(.42+sprint*.25);pose.arms[i].lower[0]=-.3-amount*(.65+sprint*.2);
 }
 // Free movement uses the full-body gait; actions keep their authored poses.
 const action=p.action,locomotion=!action&&!(p.down>0)&&!(p.dive>0)&&!celebrate,tweak=!locomotion;
 const gait=locomotion?locomotionPose(pose,p,phase,time,kinematics):null;
 const base=locomotion&&{hipY:pose.hipY,hips:[...pose.hips],legs:pose.legs.map(l=>({upper:[...l.upper],lower:[...l.lower]}))};
 if(ball){const look=clamp(Math.atan2(Math.sin(Math.atan2(ball.x-p.x,ball.z-p.z)-yaw),Math.cos(Math.atan2(ball.x-p.x,ball.z-p.z)-yaw)),-.5,.5)*.65,tilt=clamp((1.5-ball.y)*.05,-.1,.1),carrying=(p.dribbleAim||p.dribbleStop)&&Math.hypot(ball.x-p.x,ball.z-p.z)<2.5;if(locomotion){pose.head[1]+=look;pose.head[0]+=tilt+(carrying?.14:0);}else{pose.head[1]=look;pose.head[0]=tilt;}}
 if(p.shield){pose.state='shield';pose.torso[0]=.18;pose.torso[1]=.15;pose.arms[0].upper=[-.2,0,.9];pose.arms[1].upper=[.15,0,-.7];}
 if(!p.action&&speed>.2){if((kinematics.acceleration||0)>3){pose.state='start';if(tweak)pose.torso[0]+=.10;}else if((kinematics.acceleration||0)<-3){pose.state='stop';if(tweak){pose.torso[0]-=.14;pose.hipY-=.035;}}else if(Math.abs(kinematics.turn||0)>2){pose.state='turn';if(tweak)pose.hipY-=.025;}else if(forward<-.3)pose.state='backpedal';if(p.defending){pose.state='jockey';if(tweak){pose.hipY-=.035;pose.arms[0].upper[2]=.32;pose.arms[1].upper[2]=-.32;}}}
 if(!p.action&&p.receiveUntil>time){pose.state='receive';pose.hipY-=.035;if(tweak)pose.legs[p.foot==='left'?0:1].lower[0]+=.2;}
 if(action){const t=action.elapsed||0;
  if(action.type==='feint'){pose.state='feint';const wave=Math.sin(clamp(t/.28,0,1)*Math.PI*2);pose.hips[2]=wave*.16;pose.torso[2]=-wave*.28;pose.legs[1].upper[2]=wave*.35;if(action.skill==='drag-back'){pose.legs[1].upper[0]=-.4+wave*.35;pose.legs[1].lower[0]=.7;pose.torso[0]=-.12;}pose.arms[0].upper[2]=.55;}
  else if(action.type==='slide'){pose.state='slide';const enter=smooth(t/.17),recover=smooth((t-.53)/.32),weight=enter*(1-recover);pose.hipY=lerp(pose.hipY,.29,weight);pose.rootRoll=-.36*weight;pose.torso[0]=-.35*weight;pose.legs[1].upper[0]=lerp(pose.legs[1].upper[0],-1.25,weight);pose.legs[1].lower[0]=.12;pose.legs[0].upper[0]=-.6;pose.legs[0].lower[0]=1.5;pose.arms[0].upper=[.4,0,.7];pose.arms[1].upper=[-.25,0,-.6];}
  else if(action.type==='tackle'){pose.state='tackle';const weight=Math.sin(clamp(t/.55,0,1)*Math.PI);pose.hipY-=weight*.12;pose.torso[0]=weight*.26;pose.legs[1].upper[0]=-weight*.95;pose.legs[1].lower[0]=.16;pose.arms[0].upper[2]=.55;}
  else if(action.aerial){pose.state=(ball?.y||1.5)>1.2?'header':'volley';const u=clamp(t/.7,0,1),jump=Math.sin(u*Math.PI);pose.rootY=jump*.27;pose.torso[0]=-.22+smooth((u-.2)/.4)*.65;pose.head[0]=smooth((u-.25)/.35)*.22;pose.legs[0].lower[0]=.6*jump;pose.legs[1].lower[0]=.9*jump;pose.arms[0].upper=[-.3,0,.8];pose.arms[1].upper=[-.3,0,-.8];if(pose.state==='volley')pose.legs[1].upper[0]=-1.2*jump;}
  else if(['shoot','pass','through','lob'].includes(action.type))kickPose(pose,p,action,ball,yaw);
 }
 if(p.dive>0){pose.state='dive';const u=clamp(1-p.dive/(p.diveDuration||KEEPER.diveDuration),0,1),weight=Math.sin(u*Math.PI),sign=p.diveDirection||1;pose.rootRoll=sign*weight*1.15;pose.hipY=.85-weight*.33;pose.rootY=weight*.15;pose.arms[0].upper=[-.6,0,2.25];pose.arms[1].upper=[-.6,0,-2.25];pose.legs[0].lower[0]=weight*.9;pose.legs[1].lower[0]=weight*.6;}
 if(p.down>0){pose.state=p.down<.3?'recover':'fall';const weight=smooth(p.down/.3);pose.rootRoll=weight*1.15*(p.interaction?.side||1);pose.hipY=lerp(.87,.28,weight);pose.torso[0]=weight*.25;pose.legs[0].lower[0]=weight*1.4;pose.legs[1].lower[0]=weight*.8;pose.arms[0].upper=[-.5,0,1.1];pose.arms[1].upper=[-.5,0,-.5];}
 if(celebrate&&!p.down&&!action){pose.state='celebrate';pose.arms[0].upper=[-.2,0,2.5];pose.arms[1].upper=[-.2,0,-2.5];pose.rootY=Math.max(0,Math.sin(time*5+p.id))*.12;}
 for(const arm of pose.arms)arm.upper[2]*=-1;
 if(!p.down&&!p.dive&&!celebrate){
  if(action&&!action.aerial&&action.type==='shoot'){
   const at=Math.max(.12,action.contactAt||.24),elapsed=action.elapsed||0,after=Math.max(0,elapsed-at),recovery=action.type==='shoot'?.36:.28,clip=mocap.kick;
   const clipTime=action.hit?clip.contact+Math.min(1,after/recovery)*(clip.duration-clip.contact):Math.min(1,elapsed/at)*clip.contact;
   const weight=smooth(elapsed/.065)*(1-smooth((after/recovery-.72)/.28))*(action.type==='shoot'?.96:.65);
   blendCapture(pose,sampleMocap('kick',clipTime),weight);
   const contactWeight=Math.max(0,1-Math.abs(elapsed-at)/.075)*.8;if(ball&&contactWeight>0){pose.hipY=lerp(pose.hipY,.815,contactWeight);const z=(ball.x-p.x)*Math.sin(yaw)+(ball.z-p.z)*Math.cos(yaw),leg=solveLeg(clamp(z-.055,.15,.56),.08,pose.hipY);pose.legs[1].upper[0]=lerp(pose.legs[1].upper[0],leg[0],contactWeight);pose.legs[1].lower[0]=lerp(pose.legs[1].lower[0],leg[1],contactWeight);}
  }
 }
 if(!action&&!p.down&&!p.dive&&p.defending){pose.state='jockey';if(tweak){pose.hipY-=.04;pose.torso[0]=.16;for(let i=0;i<2;i++){pose.legs[i].lower[0]+=.12;pose.arms[i].upper[2]=i===0?-.4:.4;pose.arms[i].lower[0]=-.7;}}}
 if(tweak&&!action&&!p.down&&!p.dive){pose.torso[0]+=clamp((kinematics.acceleration||0)*.012,-.15,.12);if(pose.state==='receive')pose.legs[p.foot==='left'?0:1].lower[0]+=.15;}
 if(!locomotion&&!pose.feetSolved)pose.feet=pose.legs.map((leg,i)=>{const cycle=((phase/(Math.PI*2)+i*.5)%1+1)%1,push=cycle>.32&&cycle<.56?Math.sin((cycle-.32)/.24*Math.PI)*amount*.22:0;return [clamp(-pose.hips[0]-leg.upper[0]-leg.lower[0]+push,-1.1,.8),0,clamp(-leg.upper[2]-leg.lower[2],-.3,.3)];});
 if(pose.captureFeet?.quaternions)for(let i=0;i<2;i++){const e=new Euler().setFromQuaternion(new Quaternion().setFromEuler(new Euler(...pose.feet[i])).slerp(pose.captureFeet.quaternions[i],pose.captureFeet.weight*.55),'XYZ');pose.feet[i]=[e.x,e.y,e.z];}
 if(action?.foot==='left'&&!action.aerial&&['shoot','pass','through','lob'].includes(action.type)){
  for(const key of ['hips','torso','head']){pose[key][1]*=-1;pose[key][2]*=-1;}
  for(const key of ['legs','arms']){pose[key].reverse();for(const limb of pose[key])for(const part of ['upper','lower']){limb[part][1]*=-1;limb[part][2]*=-1;}}
  pose.contacts.reverse();pose.feet.reverse();for(const foot of pose.feet){foot[1]*=-1;foot[2]*=-1;}
 }
 // Separate receiving, turning and goalkeeper poses are authored independently of the kick capture.
 if(!action&&p.receivePrep&&time<p.receivePrep.until){const r=p.receivePrep,w=r.weight,i=r.foot==='left'?0:1,high=r.kind==='chest'||r.kind==='thigh';pose.state='receive-prepare';pose.hipY-=w*.026;pose.torso[0]+=(high?0:.07)*w;pose.torso[1]+=(i===0?-1:1)*.16*w;pose.arms[0].upper[2]-=.25*w;pose.arms[1].upper[2]+=.25*w;
  // Chest control: lean back, bend the knees and open the arms as the ball drops in.
  if(r.kind==='chest'){const c=w*smooth((.38-(r.eta??0))/.3);pose.torso[0]-=.26*c;pose.head[0]+=.15*c;pose.hipY-=.03*c;pose.arms[0].upper[2]-=.45*c;pose.arms[1].upper[2]+=.45*c;pose.arms[0].upper[0]-=.25*c;pose.arms[1].upper[0]-=.25*c;}if(tweak&&r.eta<.32){pose.legs[i].upper[0]-=.22*w;pose.legs[i].lower[0]+=.23*w;pose.legs[i].upper[1]=(i===0?-.38:.38)*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.receive&&time<p.receive.start+p.receive.duration){const r=p.receive,t=clamp((time-r.start)/r.duration,0,1),w=Math.sin(t*Math.PI),i=r.foot==='left'?0:1;pose.state='receive-'+r.kind;pose.hipY-=w*.03;if(r.kind==='chest'){pose.torso[0]=lerp(pose.torso[0],-.24,w);pose.arms[0].upper[2]=lerp(pose.arms[0].upper[2],-.75,w);pose.arms[1].upper[2]=lerp(pose.arms[1].upper[2],.75,w);pose.arms[0].upper[0]-=.25*w;pose.arms[1].upper[0]-=.25*w;pose.head[0]+=.16*w;pose.hipY-=w*.03;}else if(tweak){pose.legs[i].upper[0]-=w*(r.kind==='thigh'?.9:r.kind==='instep'?.48:.18);pose.legs[i].upper[1]=r.kind==='inside'?(i===0?-.38:.38)*w:0;pose.legs[i].lower[0]+=.26*w;pose.feet[i][1]=(i===0?-.38:.38)*w;pose.contacts[i]=0;}}
 if(!action&&p.turnPlan&&time<p.turnPlan.start+p.turnPlan.duration){const t=clamp((time-p.turnPlan.start)/p.turnPlan.duration,0,1),w=Math.sin(t*Math.PI),sign=Math.sign(p.turnPlan.angle);pose.state=t<.25?'turn-brake':t<.5?'turn-plant':t<.65?'turn-touch':'turn-exit';pose.hipY-=w*.065;pose.torso[1]-=sign*w*.22;pose.hips[1]+=sign*w*.12;pose.torso[2]-=sign*w*.14;pose.contacts[p.turnPlan.foot==='left'?1:0]=1;}
 if(p.role==='GK'&&!p.down&&!p.dive&&!action){pose.state=speed>.5?'keeper-step':'keeper-ready';if(tweak){pose.hipY-=.065;pose.torso[0]=.17;}for(let i=0;i<2;i++){if(tweak)pose.legs[i].lower[0]+=.15;pose.arms[i].upper[0]=-.45;pose.arms[i].lower[0]=-.75;}if(p.keeperMotion&&time<p.keeperMotion.until){pose.state='keeper-'+p.keeperMotion.kind;for(let i=0;i<2;i++){pose.arms[i].upper[0]=-1.1;pose.arms[i].lower[0]=-.7;}}}
 if(!action&&p.interaction&&time<p.interaction.until){pose.state='shoulder-duel';pose.torso[2]=p.interaction.side*.15;pose.arms[p.interaction.side>0?0:1].upper[2]=p.interaction.side*-.8;}
 for(const arm of pose.arms){arm.lower[1]*=.18;arm.lower[2]*=.16;}
 const style=p.motionStyle||'balanced';if(tweak&&style!=='balanced'){for(const arm of pose.arms)arm.upper[0]*=style==='compact'?.8:1.15;pose.torso[0]+=style==='power'?.035:-.018;}
 if(tweak&&!action&&p.dribblePose&&time<p.dribblePose.start+p.dribblePose.duration){const r=p.dribblePose,w=Math.sin(clamp((time-r.start)/r.duration,0,1)*Math.PI),i=r.foot==='left'?0:1;pose.legs[i].upper[0]-=.10*w;pose.feet[i][1]+=(i===0?-.12:.12)*w;}
 if(action?.type==='shoot'&&(action.flair||String(action.flightStyle).toLowerCase().includes('outside'))){const i=action.foot==='left'?0:1,w=Math.sin(clamp(action.elapsed/((action.contactAt||.24)+.25),0,1)*Math.PI);pose.feet[i][1]+=(i===0?.45:-.45)*w;pose.legs[i].upper[1]+=(i===0?.3:-.3)*w;}
 if(action?.type==='feint')applySkillPose(pose,action);
 if(celebrate&&!p.down&&!action)applyCelebration(pose,p,time);
 // Final leg solve: a foot reaching for the ball blends from its stride target to the ball;
 // every other untouched foot stays on its stride target under the final pelvis.
 if(base){const m=gait.metrics,reach=[null,null];if(p.dribbleAim||p.dribbleStop)dribbleReach(reach,p,m,ball,time,kinematics);if(p.receivePrep||p.receive)receiveReach(reach,p,m,ball,time,pose);
  pose.planted=pose.legs.map((leg,i)=>!reach[i]&&leg.upper.every((v,k)=>v===base.legs[i].upper[k])&&leg.lower.every((v,k)=>v===base.legs[i].lower[k]));
  const moved=pose.hipY!==base.hipY||pose.hips.some((v,k)=>v!==base.hips[k]);
  for(let i=0;i<2;i++){const f=pose.gaitTargets[i],r=reach[i];
   if(r){const w=clamp(r.weight,0,1);legIK(pose,m,i,{x:lerp(f.x,r.x,w),y:lerp(f.y,r.y,w),z:lerp(f.z,r.z,w)},lerp(f.pitch,r.pitch,w),lerp(f.yaw,r.yaw,w));if(w>.3)pose.contacts[i]=0;}
   else if(pose.planted[i]&&moved)legIK(pose,m,i,f,f.pitch,f.yaw);}
  pose.reach=reach.map(r=>r||false);}
 return pose;
}
