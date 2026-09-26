import {KEEPER} from './keeper-tuning.js';
import {SKILLS,skillImpulse} from './skills.js';
import {initSkillGuide} from './skill-guide.js';
import {CELEBRATIONS} from './celebrations.js';
import {locomotionCadence} from './motion-planner.js';
import {animatePlayer} from './player.js';
import {THROW,heldBallPosition} from './throw-in.js';
const KICKS=['shoot','pass','lob','chip','finesse','low','setpiece'],lerp=(a,b,t)=>a+(b-a)*t;
// One preview sample. Shared by the in-menu viewer and offline pose checks.
export function previewSample(kind,t,foot='right'){
 const p={id:9,foot,x:0,z:24.6,yaw:0,vx:0,vz:kind==='run'?5.8:kind==='sprint'?8.3:kind==='dribble'?3:kind==='jog'?3.2:kind==='walk'?1.5:0,closeControl:kind==='dribble',shield:kind==='shield',down:0};
 if(kind.startsWith('celebration:')){p.celebration=kind.split(':')[1];p.celebrationStart=0;}
 const kick=KICKS.includes(kind),actionTime=t-.55,contact=kind==='shoot'?.24:.18;
 if(kick&&actionTime>=0&&actionTime<contact+.36)p.action={type:['chip','finesse','low','setpiece'].includes(kind)?'shoot':kind,chip:kind==='chip',curve:kind==='finesse'?18:0,low:kind==='low',foot,contactTarget:{x:foot==='left'?-.11:.11,y:.11,z:25.14},elapsed:actionTime,contactAt:contact,hit:actionTime>=contact,power:.8};
 if(['slide','tackle','feint'].includes(kind)&&actionTime>=0&&actionTime<(kind==='slide'?.85:kind==='tackle'?.55:.28))p.action={type:kind,elapsed:actionTime};
 if(kind==='header'&&actionTime>=0&&actionTime<.7)p.action={type:'shoot',aerial:true,elapsed:actionTime,clipId:'header',contactTarget:{x:0,y:1.65,z:25.14}};
 if(kind==='volley'&&actionTime>=0&&actionTime<.6)p.action={type:'shoot',aerial:true,foot,elapsed:actionTime,contactAt:.21,clipId:'volley',contactTarget:{x:foot==='left'?-.12:.12,y:.9,z:25.1}};
 if(kind==='dive'&&actionTime>=0&&actionTime<KEEPER.diveDuration){p.dive=KEEPER.diveDuration-actionTime;p.diveDuration=KEEPER.diveDuration;p.diveDirection=1;}
 if(['start','stop','turn','backpedal','receive','jockey'].includes(kind)){p.vz=kind==='backpedal'?-3:kind==='receive'?0:kind==='jockey'?0:4;p.vx=kind==='jockey'?3:0;p.motionAcceleration=kind==='start'?7:kind==='stop'?-7:0;p.motionTurn=kind==='turn'?4:0;p.defending=kind==='jockey';p.receiveUntil=kind==='receive'?t+.1:0;}
 // A ball arrives from straight ahead at 0.65 s; the receiving foot, instep, thigh or chest meets it.
 const receiving=['receive-inside','receive-instep','receive-thigh','receive-chest','intercept'].includes(kind),receiveKind=kind.replace('receive-',''),arrival={x:(foot==='left'?-1:1)*.14,y:{instep:.5,thigh:1,chest:1.45}[receiveKind]||.11,z:24.6+({thigh:.35,chest:.3}[receiveKind]||.5)};
 if(receiving){const incoming={x:0,z:-1};if(t<.65)p.receivePrep={kind:receiveKind,foot,start:0,until:.65,eta:.65-t,weight:Math.min(1,t/.4),target:arrival,incoming};else p.receive={kind:receiveKind,foot,start:.52,duration:.46,target:arrival,contactTime:.65,incoming};}
 if(['turn90','turn135','turn180'].includes(kind)){p.turnPlan={start:.55,duration:.6,angle:Number(kind.slice(4))*Math.PI/180,foot};p.vz=2;}
 if(['keeper-ready','keeper-step','keeper-catch','keeper-punch'].includes(kind)){p.role='GK';p.vx=kind==='keeper-step'?2:0;if(['keeper-catch','keeper-punch'].includes(kind))p.keeperMotion={kind:kind.slice(7),until:t+.1,target:{x:0,y:1.2,z:25.05}};}
 if(kind==='knock-on'){p.vz=6;p.closeControl=false;}
 // Dribble: a touch every 0.45 s with alternating feet; the ball runs ahead and the player catches it again.
 const touchAt=Math.floor(t/.45)*.45,since=t-touchAt,toucher=Math.round(touchAt/.45)%2?'left':'right';
 if(kind==='dribble'){p.dribbleAim={x:0,z:1};p.dribblePose={start:touchAt,foot:toucher,duration:.2};p.nextDribbleTouch=touchAt+.45;}
 if(SKILLS[kind]&&actionTime>=0&&actionTime<SKILLS[kind].duration)p.action={type:'feint',skill:kind,elapsed:actionTime,foot};
 if(kind==='duel')p.interaction={start:0,until:3,side:1};
 // Knocked down at 0.3 s: on the ground, then up on hands and a knee and back to standing.
 if(kind==='fall'||kind==='recover')p.down=t<.3?0:Math.max(0,(kind==='fall'?1.4:.8)-t);
 // Throw-in: hold overhead, throw at 0.55 s, ball released at THROW.release.
 if(kind==='throw-in'){if(actionTime<0)p.throwHold=true;else if(actionTime<THROW.end)p.action={id:1,type:'throw',elapsed:actionTime,hit:actionTime>=THROW.release};const after=actionTime-THROW.release,held=heldBallPosition(p,Math.min(Math.max(actionTime,-1),THROW.release));return {p,ball:after>0?{x:held.x,y:held.y+after*3-4.9*after*after,z:held.z+after*9}:held,celebrate:false,phase:0};}
 if(SKILLS[kind])return {p,ball:skillBall(kind,t,foot),celebrate:false,phase:0};
 const volleyAfter=Math.max(0,actionTime-.21);
 if(kind==='volley'){const x=foot==='left'?-.12:.12;return {p,ball:volleyAfter>0?{x,y:.9+volleyAfter*2,z:24.6+.5+volleyAfter*18}:{x,y:.9+Math.max(0,-actionTime)*.4,z:24.6+.5+Math.max(0,.21-actionTime)*3},celebrate:false,phase:0};}
 const after=kick?Math.max(0,actionTime-contact):0,ball=kind==='dribble'?{x:lerp(toucher==='left'?-.06:.06,toucher==='left'?.06:-.06,since/.45),y:.11,z:24.6+.33+.6*Math.sin(Math.PI*since/.45)}:receiving?{x:arrival.x,y:t<.65?arrival.y+(.65-t)*(arrival.y>.2?1.4:0):Math.max(.11,arrival.y-(t-.65)*3),z:arrival.z+Math.max(0,.65-t)*9}:{x:foot==='left'?-.11:.11,y:kind==='header'?1.65:.11+Math.max(0,Math.sin(after*3))*.55,z:25.14+after*10};
 return {p,ball,celebrate:kind==='celebrate'||kind.startsWith('celebration:'),phase:t*locomotionCadence(Math.hypot(p.vx,p.vz),p.motionStyle,p)};
}
// Ball for a skill preview: rests at the touching foot and is moved by the same touch impulses
// the match applies at each skill event, then rolls (or flies and bounces) freely.
function skillBall(kind,t,foot){
 const config=SKILLS[kind],a={skill:kind,foot},p={yaw:0},events=config.events.map(at=>.55+at),dt=1/120;
 let x=(foot==='left'?-1:1)*.06,y=.11,z=.34,vx=0,vy=0,vz=0,next=0;
 for(let s=0;s<t;s+=dt){
  if(next<events.length&&s>=events[next]){const hit=skillImpulse(p,a,next),n=Math.hypot(hit.aim.x,hit.aim.z)||1;vx=hit.aim.x/n*hit.speed;vz=hit.aim.z/n*hit.speed;vy=hit.lift;next++;}
  x+=vx*dt;y+=vy*dt;z+=vz*dt;
  if(y>.11)vy-=9.81*dt;else{y=.11;vy=vy<-1?-vy*.45:0;const roll=Math.exp(-1.1*dt);vx*=roll;vz*=roll;}
 }
 return {x,y,z:24.6+z};
}
export class MotionPreview{
 constructor(hero){this.hero=hero;this.active=false;this.time=0;this.playing=true;this.kind='run';this.foot='right';this.speed=1;this.angle=.65;const $=id=>document.getElementById(id);
  for(const [id,config]of Object.entries(SKILLS)){if(['elastico','drag-back'].includes(id))continue;const option=document.createElement('option');option.value=id;option.textContent=config.name;$('motion-kind').append(option);}
  const header=Array.from($('motion-kind').options).find(o=>o.value==='header');if(header&&!Array.from($('motion-kind').options).some(o=>o.value==='volley')){const option=document.createElement('option');option.value='volley';option.textContent='발리';header.after(option);}
  if(!Array.from($('motion-kind').options).some(o=>o.value==='throw-in')){const option=document.createElement('option');option.value='throw-in';option.textContent='스로인';$('motion-kind').append(option);}
  for(const clip of CELEBRATIONS){const option=document.createElement('option');option.value='celebration:'+clip.id;option.textContent='세리머니 · '+clip.name;$('motion-kind').append(option);}
  $('motion-open').onclick=()=>{this.active=true;this.time=0;$('menu').classList.add('hidden');$('motion-preview').classList.remove('hidden');};
  this.onClose=[];
  // Plays one motion kind (used by the skill guide and the research panel).
  this.show=kind=>{if(!Array.from($('motion-kind').options).some(o=>o.value===kind))return;$('motion-kind').value=kind;this.kind=kind;this.time=0;this.active=true;this.playing=true;this.hero.plantState=null;$('motion-play').textContent='멈춤 Ⅱ';$('menu').classList.add('hidden');$('motion-preview').classList.remove('hidden');};
  this.close=()=>{for(const fn of this.onClose)fn();this.active=false;delete hero.motionPhaseOverride;hero.root.position.set(0,0,24.6);$('motion-preview').classList.add('hidden');$('menu').classList.remove('hidden');};
  addEventListener('touchline-preview',e=>{const value=e.detail;if(!Array.from($('motion-kind').options).some(o=>o.value===value))return;$('research-panel').classList.add('hidden');$('research-video').pause();$('motion-kind').value=value;this.kind=value;this.time=0;this.active=true;this.playing=true;this.hero.plantState=null;$('menu').classList.add('hidden');$('motion-preview').classList.remove('hidden');});
  $('motion-close').onclick=this.close;$('motion-foot').onchange=e=>this.foot=e.target.value;$('motion-kind').onchange=e=>{this.kind=e.target.value;this.hero.plantState=null;this.hero.impactError=undefined;this.time=0;this.playing=true;$('motion-play').textContent='멈춤 Ⅱ';};$('motion-speed').onchange=e=>this.speed=Number(e.target.value);$('motion-angle').oninput=e=>this.angle=Number(e.target.value);
  $('motion-frame').oninput=e=>{this.playing=false;this.hero.plantState=null;this.time=Number(e.target.value)*this.duration;$('motion-play').textContent='재생 ▶';};
  $('motion-play').onclick=()=>{this.playing=!this.playing;$('motion-play').textContent=this.playing?'멈춤 Ⅱ':'재생 ▶';};
  addEventListener('keydown',e=>{if(e.code==='Escape'&&this.active)this.close();});
  initSkillGuide(this);
 }
 get duration(){return this.kind.startsWith('celebration:')||this.kind==='celebrate'?5:2;}
 animate(ball,camera,dt){
  if(this.playing)this.time=(this.time+dt*this.speed)%this.duration;const t=this.time,sample=previewSample(this.kind,t,this.foot),p=sample.p;
  this.hero.root.position.set(0,0,24.6);this.hero.root.rotation.y=0;this.hero.motionPhaseOverride=sample.phase;
  ball.position.set(sample.ball.x,sample.ball.y,sample.ball.z);ball.rotation.x=t*8;
  animatePlayer(this.hero,Math.hypot(p.vx,p.vz),Math.max(dt,.016),t,sample.celebrate,p,ball.position);
  camera.position.set(Math.sin(this.angle)*3.7,1.6,24.6+Math.cos(this.angle)*3.7);camera.lookAt(0,1.02,24.6);
  document.getElementById('motion-state').textContent=this.hero.motionState.toUpperCase();if(this.playing)document.getElementById('motion-frame').value=String(t/this.duration);
 }
}
