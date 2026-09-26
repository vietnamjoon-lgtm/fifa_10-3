import {footSign} from './contact-model.js';
import {KEEPER} from './keeper-tuning.js';
import {SKILLS} from './skills.js';
import {CELEBRATIONS} from './celebrations.js';
import {locomotionCadence} from './motion-planner.js';
import {animatePlayer} from './player.js';
export class MotionPreview{
 constructor(hero){this.hero=hero;this.active=false;this.time=0;this.playing=true;this.kind='run';this.foot='right';this.speed=1;this.angle=.65;const $=id=>document.getElementById(id);
  for(const [id,config]of Object.entries(SKILLS)){if(['elastico','drag-back'].includes(id))continue;const option=document.createElement('option');option.value=id;option.textContent=config.name;$('motion-kind').append(option);}
  for(const clip of CELEBRATIONS){const option=document.createElement('option');option.value='celebration:'+clip.id;option.textContent='세리머니 · '+clip.name;$('motion-kind').append(option);}
  $('motion-open').onclick=()=>{this.active=true;this.time=0;$('menu').classList.add('hidden');$('motion-preview').classList.remove('hidden');};
  this.close=()=>{this.active=false;delete hero.motionPhaseOverride;hero.root.position.set(0,0,24.6);$('motion-preview').classList.add('hidden');$('menu').classList.remove('hidden');};
  addEventListener('touchline-preview',e=>{const value=e.detail;if(!Array.from($('motion-kind').options).some(o=>o.value===value))return;$('research-panel').classList.add('hidden');$('research-video').pause();$('motion-kind').value=value;this.kind=value;this.time=0;this.active=true;this.playing=true;this.hero.plantState=null;$('menu').classList.add('hidden');$('motion-preview').classList.remove('hidden');});
  $('motion-close').onclick=this.close;$('motion-foot').onchange=e=>this.foot=e.target.value;$('motion-kind').onchange=e=>{this.kind=e.target.value;this.hero.plantState=null;this.hero.impactError=undefined;this.time=0;this.playing=true;$('motion-play').textContent='멈춤 Ⅱ';};$('motion-speed').onchange=e=>this.speed=Number(e.target.value);$('motion-angle').oninput=e=>this.angle=Number(e.target.value);
  $('motion-frame').oninput=e=>{this.playing=false;this.hero.plantState=null;this.time=Number(e.target.value)*this.duration;$('motion-play').textContent='재생 ▶';};
  $('motion-play').onclick=()=>{this.playing=!this.playing;$('motion-play').textContent=this.playing?'멈춤 Ⅱ':'재생 ▶';};
  addEventListener('keydown',e=>{if(e.code==='Escape'&&this.active)this.close();});
 }
 get duration(){return this.kind.startsWith('celebration:')||this.kind==='celebrate'?5:2;}
 animate(ball,camera,dt){
  if(this.playing)this.time=(this.time+dt*this.speed)%this.duration;const t=this.time,kind=this.kind;
  const p={id:9,foot:this.foot,x:0,z:24.6,yaw:0,vx:0,vz:kind==='run'?5.8:kind==='sprint'?8.3:kind==='dribble'?3:0,closeControl:kind==='dribble',shield:kind==='shield',down:0};
  if(kind.startsWith('celebration:')){p.celebration=kind.split(':')[1];p.celebrationStart=0;}
  const kick=['shoot','pass','lob','chip','finesse','low','setpiece'].includes(kind),actionTime=t-.55,contact=kind==='shoot'?.24:.18;
  if(kick&&actionTime>=0&&actionTime<contact+.36)p.action={type:['chip','finesse','low','setpiece'].includes(kind)?'shoot':kind,chip:kind==='chip',curve:kind==='finesse'?18:0,low:kind==='low',foot:this.foot,contactTarget:{x:footSign(this.foot)*.11,y:.11,z:25.14},elapsed:actionTime,contactAt:contact,hit:actionTime>=contact,power:.8};
  if(['slide','tackle','feint'].includes(kind)&&actionTime>=0&&actionTime<(kind==='slide'?.85:kind==='tackle'?.55:.28))p.action={type:kind,elapsed:actionTime};
  if(kind==='header'&&actionTime>=0&&actionTime<.7)p.action={type:'shoot',aerial:true,elapsed:actionTime};
  if(kind==='dive'&&actionTime>=0&&actionTime<KEEPER.diveDuration){p.dive=KEEPER.diveDuration-actionTime;p.diveDuration=KEEPER.diveDuration;p.diveDirection=1;}
  if(['start','stop','turn','backpedal','receive','jockey'].includes(kind)){p.vz=kind==='backpedal'?-3:kind==='receive'?0:kind==='jockey'?0:4;p.vx=kind==='jockey'?3:0;p.motionAcceleration=kind==='start'?7:kind==='stop'?-7:0;p.motionTurn=kind==='turn'?4:0;p.defending=kind==='jockey';p.receiveUntil=kind==='receive'?t+.1:0;}
  if(['receive-inside','receive-instep','receive-thigh','receive-chest','intercept'].includes(kind)){if(t<.65)p.receivePrep={kind:kind.replace('receive-',''),foot:this.foot,start:0,until:.65,eta:.65-t,weight:Math.min(1,t/.4)};else p.receive={kind:kind.replace('receive-',''),foot:this.foot,start:.52,duration:.46};}
  if(['turn90','turn135','turn180'].includes(kind)){p.turnPlan={start:.55,duration:.6,angle:Number(kind.slice(4))*Math.PI/180,foot:this.foot};p.vz=2;}
  if(['keeper-ready','keeper-step','keeper-catch','keeper-punch'].includes(kind)){p.role='GK';p.vx=kind==='keeper-step'?2:0;if(['keeper-catch','keeper-punch'].includes(kind))p.keeperMotion={kind:kind.slice(7),until:t+.1,target:{x:0,y:1.2,z:25.05}};}
  if(kind==='knock-on'){p.vz=6;p.closeControl=false;}
  if(SKILLS[kind]&&actionTime>=0&&actionTime<SKILLS[kind].duration)p.action={type:'feint',skill:kind,elapsed:actionTime,foot:this.foot};
  if(kind==='duel')p.interaction={start:0,until:3,side:1};
  if(kind==='fall'||kind==='recover')p.down=kind==='fall'?.7:.2;
  this.hero.root.position.set(0,0,24.6);this.hero.root.rotation.y=0;this.hero.motionPhaseOverride=t*locomotionCadence(Math.hypot(p.vx,p.vz),p.motionStyle,p);
  const after=kick?Math.max(0,actionTime-contact):0;ball.position.set(footSign(this.foot)*.11,kind==='header'?1.65:.11+Math.max(0,Math.sin(after*3))*.55,25.14+after*10);ball.rotation.x=t*8;
  animatePlayer(this.hero,Math.hypot(p.vx,p.vz),Math.max(dt,.016),t,kind==='celebrate'||kind.startsWith('celebration:'),p,ball.position);
  camera.position.set(Math.sin(this.angle)*3.7,1.6,24.6+Math.cos(this.angle)*3.7);camera.lookAt(0,1.02,24.6);
  document.getElementById('motion-state').textContent=this.hero.motionState.toUpperCase();if(this.playing)document.getElementById('motion-frame').value=String(t/this.duration);
 }
}
