import {SETPIECE_STYLES} from './setpiece-styles.js';
import {SKILLS} from './skills.js';
import {clamp} from './config.js';

// Contextual keyboard commands; the same reducer is exercised by input tests.
export class Input{
 constructor(settings,onAction,getContext=()=>({attack:true}),environment={}){
  this.settings=settings;this.onAction=onAction;this.getContext=getContext;
  this.now=environment.now||(()=>performance.now());this.getPads=environment.getPads||(()=>globalThis.navigator?.getGamepads?.()||[]);
  this.keys=new Set();this.gamepadButtons=[];this.axis={x:0,z:0};this.enabled=false;
  this.lastShot=-1e6;this.lastLob=-1e6;this.lastPress=-1e6;this.lobCount=0;this.charging=false;this.shotOptions={};
  const target=environment.target??globalThis.window;
  target?.addEventListener('keydown',e=>{
   if(e.target?.matches?.('input,select,textarea,[contenteditable=true]'))return;
   if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
   if(!e.repeat)this.keyDown(e.code);
  });
  target?.addEventListener('keyup',e=>this.keyUp(e.code));
  target?.addEventListener('blur',()=>{this.clear();onAction('blur');});this.refresh();
 }
 get legacy(){return this.settings.controls==='legacy';}
 get tactical(){return this.settings.defence==='tactical';}
 emit(action,options={}){this.onAction(action,options);}
 clear(){this.keys.clear();this.axis={x:0,z:0};this.charging=false;this.gamepadButtons=[];this.shotOptions={};this.lastShot=this.lastLob=this.lastPress=-1e6;this.refresh();}
 refresh(){
  const k=this.keys,has=(...codes)=>codes.some(c=>k.has(c)),attack=this.getContext().attack;
  this.axis={x:Number(has('ArrowRight',...(this.legacy?['KeyD']:[])))-Number(has('ArrowLeft',...(this.legacy?['KeyA']:[]))),z:Number(has('ArrowDown',...(this.legacy?['KeyS']:[])))-Number(has('ArrowUp',...(this.legacy?['KeyW']:[])))};
  const n=Math.hypot(this.axis.x,this.axis.z);if(n>1){this.axis.x/=n;this.axis.z/=n;}
  this.sprint=this.legacy?has('ShiftLeft','ShiftRight'):has('KeyE','ShiftLeft','ShiftRight');
  this.sprintAmount=this.sprint?1:0;
  this.defend=this.legacy?has('ControlLeft','ControlRight'):has('KeyC');this.shield=attack&&this.defend;
  this.curve=this.legacy?has('KeyE'):has('KeyZ');this.chip=this.legacy?has('KeyX'):has('KeyQ');this.low=this.legacy&&has('KeyZ');
  this.closeControl=!this.legacy&&attack&&has('Space');
  this.teamPress=!this.legacy&&!attack&&has(this.tactical?'KeyZ':'KeyQ');this.teamPressCount=this.pressDouble?2:1;
  this.press=!this.legacy&&!attack&&has(this.tactical?'KeyS':'KeyD');this.autoDefend=!this.legacy&&!attack&&has('KeyD');
  this.keeperRush=!this.legacy&&!attack&&has('KeyW');this.knock=!this.legacy&&has('ControlLeft','ControlRight');
 }
 modifiers(){return {curve:this.curve,chip:this.chip,low:this.low,flair:!this.legacy&&this.keys.has('KeyC')};}
 startShot(){if(this.now()-this.lastShot<310){this.emit('lowShot');this.lastShot=-1e6;return;}this.charging=true;this.shotOptions=this.modifiers();this.emit('charge',this.shotOptions);}
 passCommand(){
  if(this.charging||this.now()-this.lastShot<310||this.now()-this.lastLob<310){this.charging=false;this.lastShot=this.lastLob=-1e6;this.emit('fake');return;}
  this.emit('pass',{driven:this.keys.has('KeyZ'),oneTwo:this.keys.has('KeyQ'),flair:this.keys.has('KeyC')});
 }
 lobCommand(){this.lobCount=this.now()-this.lastLob<310?this.lobCount+1:1;this.lastLob=this.now();if(this.lobCount>1){this.emit('crossType',{ground:this.lobCount===2,low:this.lobCount>=3});return;}this.emit('lob',{early:this.keys.has('KeyQ'),bounce:this.keys.has('KeyZ')});}
 keyDown(code){
  this.keys.add(code);this.refresh();
  if(code==='Escape'){this.emit('pause');return;}if(code==='KeyR'){this.emit('replaySkip');return;}if(!this.enabled)return;
  if(code==='F2'||(this.legacy&&code==='KeyC')){this.emit('camera');return;}
  if(code==='F3'){this.emit('debug');return;}if(code==='KeyH'){this.emit('help');return;}
  if(this.legacy){const map={KeyJ:'pass',KeyL:'through',KeyI:'lob',Space:'tackle',KeyQ:'switch'};if(map[code])this.emit(map[code]);if(code==='KeyK')this.startShot();return;}
  const context=this.getContext(),attack=context.attack;
  if((code==='KeyC'||code==='KeyE')&&this.keys.has('KeyC')&&this.keys.has('KeyE')){this.charging=false;this.emit('cancel');}
  if(context.keeperHolding){if(code==='KeyS')this.emit('keeperPass',{driven:this.keys.has('KeyZ')});if(code==='KeyA'||code==='KeyD')this.emit('keeperKick');if(code==='KeyW')this.emit('keeperDrop');return;}
  if(attack){
   if(context.setPiece==='free'&&/^Digit[1-7]$/.test(code)&&!this.keys.has('ShiftLeft')&&!this.keys.has('ShiftRight')){this.emit('setpieceStyle',{style:Object.keys(SETPIECE_STYLES)[Number(code.slice(5))-1]});return;}
   if(/^Digit[1-7]$/.test(code)&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight'))){this.emit('skill',{skill:Object.keys(SKILLS)[Number(code.slice(5))-1]});return;}
   if(code==='KeyD')this.startShot();if(code==='KeyS')this.passCommand();if(code==='KeyA')this.lobCommand();
   if(code==='KeyW')this.emit('through',{lob:this.keys.has('KeyQ'),driven:this.keys.has('KeyZ')});
   if(code==='KeyQ')this.emit('run');if(code==='KeyZ')this.emit('support');
   if(code.startsWith('Arrow')&&this.knock)this.emit('knock');
   // Shift + movement is knock-and-run via sprint dribbling; skills use Shift + 1~7.
  }else{
   if(code===(this.tactical?'KeyQ':'KeyS'))this.emit('switch');if(code==='KeyD')this.emit('tackle',{automatic:true});if(code==='KeyA')this.emit('slide');
   if(code===(this.tactical?'KeyZ':'KeyQ')){this.pressDouble=this.now()-this.lastPress<300;this.lastPress=this.now();this.refresh();}
   // Shift also sprints in defence, without unexpectedly switching players.
  }
 }
 keyUp(code){this.keys.delete(code);this.refresh();if(code===(this.legacy?'KeyK':'KeyD')&&this.charging){this.charging=false;this.lastShot=this.now();if(this.enabled)this.emit('shoot',this.shotOptions);}}
 poll(){
  this.refresh();const pad=this.getPads()[0];
  if(pad){
   const button=i=>!!pad.buttons[i]?.pressed,context=this.getContext(),attack=context.attack;
   const x=pad.axes[0]||0,z=pad.axes[1]||0,mag=Math.hypot(x,z),dead=this.settings.deadzone;
   if(mag>dead){const value=clamp((mag-dead)/(1-dead)*this.settings.sensitivity,0,1);this.axis={x:x/mag*value,z:z/mag*value};}
   const trigger=pad.buttons[7]?.value||0;this.sprint||=trigger>.3;this.sprintAmount=Math.max(this.sprintAmount,this.settings.analogSprint?trigger:trigger>.3?1:0);this.defend||=(pad.buttons[6]?.value||0)>.3;this.shield=attack&&this.defend;
   this.curve||=button(5);this.chip||=button(4);this.closeControl||=attack&&button(5);
   this.teamPress||=!attack&&button(5);this.press||=!attack&&button(0);this.autoDefend||=!attack&&button(1);this.keeperRush||=!attack&&button(3);
   pad.buttons.forEach((b,i)=>{
    if(b.pressed&&!this.gamepadButtons[i]&&(this.enabled||i===9)){
     if(i===9)this.emit('pause');else if(i===8)this.emit('camera');
     else if(context.keeperHolding){if(i===0)this.emit('keeperPass');if(i===1||i===2)this.emit('keeperKick');if(i===3)this.emit('keeperDrop');}
     else if(attack){if(i===1)this.startShot();if(i===0){if(this.charging){this.charging=false;this.emit('fake');}else this.emit('pass',{oneTwo:button(4),driven:button(5)});}if(i===2)this.emit('lob',{early:button(4),bounce:button(5)});if(i===3)this.emit('through',{lob:button(4),driven:button(5)});if(i===4)this.emit('run');}
     else {if(i===4)this.emit('switch');if(i===1||(!this.tactical&&i===0))this.emit('tackle',{automatic:true});if(i===2)this.emit('slide');}
    }
    if(!b.pressed&&this.gamepadButtons[i]&&i===1&&this.charging){this.charging=false;this.lastShot=this.now();if(this.enabled)this.emit('shoot',this.shotOptions);}
    this.gamepadButtons[i]=b.pressed;
   });
  }
  if(!this.enabled){this.axis={x:0,z:0};this.sprint=this.defend=this.teamPress=this.press=this.autoDefend=this.keeperRush=this.closeControl=false;}return this;
 }
}
