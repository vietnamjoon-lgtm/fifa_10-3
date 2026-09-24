import {chooseCross,crossFlight} from './crossing.js';
import {arrangeSetPiece,updateSetPiece,restartShotTarget,penaltyFlight,secondTouch} from './setpieces.js';
import {followPassEnabled,createPassFlight,guidePass} from './guided-pass.js';
import {KEEPER} from './keeper-tuning.js';
import {resolvePlayerContacts} from './player-contact.js';
import {cleanGameplay,gameplayValue} from './gameplay-settings.js';
import {resolvePostMotion} from './post-contact.js';
import {autoDefenceMovement} from './auto-defence.js';
import {setpieceFlight} from './setpiece-styles.js';
import {skillImpulse} from './skills.js';
import {collectionMovement,activePass} from './ball-assistance.js';
import {prepareReception} from './receive-control.js';
import {keeperContact} from './keeper-balance.js';
import {planKick,locomotionCadence,receivePlan} from './motion-planner.js';
import {movementProfile,kickSkill,kickError,keeperProfile,seededRandom} from './attributes.js';
import {chooseKickFoot,footSign,predictContact} from './contact-model.js';
import {createPhysics,curveDrift,detectGoal} from './physics.js';
import {resolveBodyContacts} from './contacts.js';
import {FIELD,TUNING,roster,clamp,distance,turnToward} from './config.js';
import {updateTeamAI,choosePass,keeperTarget} from './ai.js';
import {boundaryRestart,offsideSnapshot} from './rules.js';
import {ASSIST,footPosition,shotTarget,groundPassSpeed,passTarget,setKickTarget,dribbleTouch,cushionFirstTouch,possessionRadius,dribbleSteer,controlReach,kickApproach} from './assists.js';
import {resetReferee,resolveTackle,flushCards,updateAdvantage,inPenaltyArea} from './referee.js';
import {executeCommand,controlContext,throwIn} from './commands.js';
import {selectControlled,updateAutoControl,runTarget} from './control-assist.js';
export class Match{
 constructor(settings,onEvent=()=>{}){this.settings=settings;this.emit=onEvent;this.random=seededRandom(settings.seed);this.actionId=0;this.contacts=[];this.gameplay=cleanGameplay(settings.gameplay);this.physics=createPhysics(this.gameplay);this.players=[...roster(0),...roster(1)].map(p=>({...p,x:0,z:0,vx:0,vz:0,yaw:0,stamina:1,target:{x:0,z:0},cooldown:0,action:null,touchCooldown:0,dive:0,down:0,aiState:'READY',nextDecision:0}));this.state='menu';this.time=0;this.half=1;this.score=[0,0];this.controlled=this.players[9];this.owner=null;this.lastTouchTeam=0;this.lastTouch=null;this.lastKickTime=-10;this.lock=0;this.charge=0;this.charging=false;this.aiClock=0;this.timer=0;this.history=[];this.offside=new Set();this.stats={shots:[0,0],passes:[0,0],saves:[0,0],possession:[0,0],fouls:[0,0]};this.input={axis:{x:0,z:0}};this.autoplay=false;}
 direction(team){return (team===0?1:-1)*(this.half===1?1:-1)}
 start(practice=false){this.gameplay=cleanGameplay(this.settings.gameplay);this.physics.configure(this.gameplay);this.autoplay=false;this.heldBy=null;this.practice=practice;this.state='kickoff';this.half=1;this.time=0;this.elapsed=0;this.score=[0,0];this.stats={shots:[0,0],passes:[0,0],saves:[0,0],possession:[0,0],fouls:[0,0]};resetReferee(this);this.pressEnergy=1;this.pressExhausted=false;this.history=[];this.kickoff(this.settings.userTeam);this.emit('start');}
 kickoff(team){this.passFlight=null;if(this.practice)team=this.settings.userTeam;this.owner=null;this.heldBy=null;this.receiving=null;this.setPiece=null;this.restartOrigin=null;this.advantage=null;this.aiClock=0;this.offside.clear();this.physics.reset();this.lastTouchTeam=team;this.lock=.2;this.charging=false;this.charge=0;this.manualSwitchUntil=0;this.controlLockUntil=0;this.carryInput=null;
 for(const p of this.players){const d=this.direction(p.team);p.x=p.homeX*d;p.z=p.homeZ;p.vx=0;p.vz=0;p.yaw=d*Math.PI/2;p.action=null;p.intent=null;p.motionPhase=0;p.motionAcceleration=0;p.motionTurn=0;p.receiveUntil=0;p.receive=null;p.receivePrep=null;p.autoDefending=false;p.autoDefendSince=null;p.dribblePose=null;p.turnPlan=null;p.keeperMotion=null;p.keeperRead=null;p.chargeContactUntil=0;p.diveDuration=0;p.diveHeight=0;p.interaction=null;p.wallHoldUntil=0;p.cooldown=.5;p.touchCooldown=0;p.possessedAt=-1;p.dive=0;p.down=0;p.active=!p.sentOff&&(!this.practice||p.id===this.settings.userTeam*11+9);p.target={x:p.x,z:p.z};}
 const p=this.players.find(p=>p.id===team*11+9&&p.active)||this.players.find(p=>p.team===team&&p.active&&p.role==='FWD')||this.players.find(p=>p.team===team&&p.active);if(!p){this.state='fulltime';this.emit('fulltime');return;}p.x=-this.direction(team)*.5;p.z=-.11;p.yaw=this.direction(team)*Math.PI/2;this.owner=p;this.controlled=this.players.find(p=>p.id===this.settings.userTeam*11+9&&p.active)||this.players.find(p=>p.team===this.settings.userTeam&&p.active);if(this.practice){const d=this.direction(this.settings.userTeam);this.controlled.x=d*23;this.controlled.z=0;this.physics.reset(d*23.5,-d*.11);this.owner=this.controlled;}
 this.state='kickoff';this.timer=1.35;this.emit('kickoff',{team});}
 queueKick(p,type,power=.4,aim=null,receiver=null,options={}){
 const ball=this.physics.ball.position;
 if(this.setPiece&&this.setPiece.taker!==p)return false;
 // The owner may start a kick on a ball knocked slightly ahead; the windup runs onto it before contact.
 if(!p||!p.active||p.action||p.down>0||distance(p,ball)>(this.owner===p&&ball.y<.5?ASSIST.kickReach:ASSIST.touchRadius)||ball.y>2.2)return false;
 let target=null,assistOffset=null;
 if(!aim){
  const axis=this.input.axis||{x:0,z:0},hasInput=Math.hypot(axis.x,axis.z)>.2;
  if(type==='shoot'){
   target=restartShotTarget(this,p)||shotTarget(this,p,axis);
   aim=target?{x:target.x-ball.x,z:target.z-ball.z}:{x:axis.x,z:axis.z};
  }else{
   const mode=p===this.controlled?(this.settings[type==='lob'?'crossAssist':type==='through'?'throughAssist':'passAssist']||'auto'):'auto';
   const follow=followPassEnabled(this,p.team);const pass=mode==='manual'&&!follow?null:(type==='lob'?chooseCross(this,p,hasInput?axis:null):null)||choosePass(this,p,hasInput?axis:null,type)||(follow?choosePass(this,p,null,type):null);
   if(pass){receiver=pass.player;target={...pass};if(mode==='semi'&&hasInput){const n=Math.hypot(axis.x,axis.z),length=distance(ball,pass);assistOffset={x:(ball.x+axis.x/n*length-pass.x)*.25,z:(ball.z+axis.z/n*length-pass.z)*.25};target.x+=assistOffset.x;target.z+=assistOffset.z;}aim={x:target.x-ball.x,z:target.z-ball.z};}
   else aim=hasInput?{x:axis.x*14,z:axis.z*14}:{x:Math.sin(p.yaw)*14,z:Math.cos(p.yaw)*14};
  }
 }
 const length=Math.hypot(aim.x,aim.z)||1;
 const source=p===this.controlled?this.input:{};
 p.action={id:++this.actionId,foot:chooseKickFoot(p,ball,aim),inputTime:this.time,acceptedTime:this.time,animationStart:this.time,type,elapsed:0,contactAt:type==='shoot'?.24:.18,hit:false,power:clamp(power,0,1),aim:{x:aim.x/length,z:aim.z/length},distance:length,target,receiver,assistOffset,...options,curve:(options.curve??source.curve)?18:0,low:options.low??source.low,chip:options.chip??source.chip,aerial:ball.y>.65};
 // A knocked-on ball is planned at touching range: the windup closes the gap before contact.
 const gap=distance(p,ball),near=ASSIST.touchRadius*.98,planBall=gap>near?{x:p.x+(ball.x-p.x)*near/gap,y:ball.y,z:p.z+(ball.z-p.z)*near/gap}:ball;
 const plan=planKick(p,p.action,planBall,this.time);if(!plan){p.action=null;return false;}Object.assign(p.action,plan);p.action.contactTarget={x:ball.x,y:ball.y,z:ball.z};
 p.action.restartKind=this.setPiece?.taker===p?this.setPiece.kind:null;
 if(this.setPiece?.kind==='free'&&type==='shoot')p.action.flightStyle=this.setPiece.style||'inside';
 if(this.setPiece?.kind==='free'&&p.action.chip){p.action.chip=false;p.action.flightStyle='chip';}
 this.receiving=null;
 return true;
 }
 requestKick(p,type,power=.4,options={}){if(this.queueKick(p,type,power,null,null,options))return true;if(!p?.active||p.action||p.down>0)return false;const b=this.physics.ball.position,v=this.physics.ball.velocity,predicted=predictContact(p,b,v);if(distance(p,b)<7&&predicted.time>.02&&predicted.distance<1.1&&predicted.height<2.1){p.intent={type,power,options:{...options},axis:{...this.input.axis},inputTime:this.time,expires:this.time+.65};return true;}return false;}
 selectControlled(p,reason){return selectControlled(this,p,reason);}
 updateAutoControl(){updateAutoControl(this);}
 isHumanControlled(p){return p===this.controlled&&!this.autoplay;}
 isHumanTeam(team){return team===this.settings.userTeam&&!this.autoplay;}
 inputForTeam(team){return this.isHumanTeam(team)?this.input:{};}
 controlContext(){return controlContext(this);}
 action(action,options={}){executeCommand(this,action,options);}
 switchPlayer(){if(this.practice)return;this.receiving=null;const b=this.physics.ball.position,v=this.physics.ball.velocity,a=this.input.axis||{x:0,z:0};const aim={x:b.x+v.x*.35,z:b.z+v.z*.35};let best=null,score=Infinity;for(const p of this.players){if(!p.active||p.team!==this.settings.userTeam||p.role==='GK'||p===this.controlled)continue;const d=distance(p,aim),alignment=((p.x-this.controlled.x)*a.x+(p.z-this.controlled.z)*a.z)*.15;const val=d-alignment+(p.down>0?20:0);if(val<score){best=p;score=val;}}if(best)this.selectControlled(best,'manual');this.charging=false;this.charge=0;}
 tackle(p,slide=false){if(!p.active||p.cooldown>0||p.action||this.heldBy===p)return;p.cooldown=slide?1.65:TUNING.tackleCooldown;const b=this.physics.ball.position;p.yaw=turnToward(p.yaw,Math.atan2(b.x-p.x,b.z-p.z),.45);p.action={type:slide?'slide':'tackle',elapsed:0,hit:false};}
 contactKick(p,a){if(secondTouch(this,p))return;const b=this.physics.ball.position,foot=footPosition(p);const reachable=a.aerial?distance(p,b)<.95&&b.y>.4&&b.y<2.25:distance(foot,b)<=ASSIST.contactRadius&&b.y<=.65;if(!reachable){a.missed=true;this.emit('miss',{player:p});return;}
 a.contactTime=this.time;a.ballReleaseTime=this.time;a.actualTarget={x:b.x,y:b.y,z:b.z};a.nextActionAllowed=this.time+(a.recovery||.28);
 if(a.receiver?.active){a.target=passTarget(this,p,a.receiver,a.type);if(a.type==='lob'){const t=clamp(distance(b,a.receiver)/20,.65,2.5);a.target.x=clamp(a.receiver.x+a.receiver.vx*t*.7,-50,50);a.target.z=clamp(a.receiver.z+a.receiver.vz*t*.7,-32,32);}if(a.assistOffset){a.target.x+=a.assistOffset.x;a.target.z+=a.assistOffset.z;}}
 if(a.target)setKickTarget(a,b,a.target);
 const pressure=Math.min(...this.players.filter(q=>q.team!==p.team&&q.active).map(q=>distance(p,q)),20);let speed,lift,curve=a.curve||0,solved=null;
 if(a.type==='shoot'){speed=(TUNING.shotMin+(TUNING.shotMax-TUNING.shotMin)*a.power)*p.power;const flight=clamp(a.distance/(speed*.88),.15,1.3);lift=a.low?.45:a.chip?9:a.target?clamp((.85-b.y+4.905*flight*flight)/flight,1.2,6.8):1.1+a.power*3.7;this.stats.shots[p.team]++;}
 else {const lob=a.type==='lob'||a.lob;speed=lob?clamp(9+a.distance*.46,11,30):groundPassSpeed(a.distance,a.type,this.gameplay.ballRoll);lift=lob?clamp(a.distance*.23,5,11):a.type==='through'?.25:.08;if(a.driven)speed=Math.min(38,speed*1.3);if(a.groundCross)lift=.1;if(a.lowCross)lift=2;if(a.bounce)lift=3.3;if(a.early){speed*=1.1;lift*=1.05;}speed*=.96+.04*kickSkill(p,a);this.stats.passes[p.team]++;}
 if(a.type==='lob'&&!a.groundCross){solved=crossFlight(a,b);speed=solved.speed;lift=solved.lift;curve=solved.curve;}if(a.groundCross){speed=groundPassSpeed(a.distance,'pass',this.gameplay.ballRoll);lift=.08;}
 const setFlight=a.type!=='shoot'?null:a.restartKind==='penalty'?penaltyFlight(a,p,b):setpieceFlight(a.flightStyle,p,a,b);if(setFlight){solved=setFlight;speed=setFlight.speed;lift=setFlight.lift;curve=setFlight.curve;}else if(a.type==='shoot'&&a.flair&&a.power>=.4&&!a.aerial){curve=-14*(a.foot==='left'?-1:1);}
 if(a.aerial){speed*=b.y>1.2?.72:.92;lift=a.low?-1:Math.min(lift,2);}
 const assistKey=a.type==='lob'?'crossAssist':a.type==='through'?'throughAssist':'passAssist',assisted=a.type!=='shoot'&&a.receiver&&(this.settings[assistKey]||'auto')!=='manual';const error=a.type!=='shoot'&&a.receiver&&followPassEnabled(this,p.team)?0:kickError(p,a,pressure)*(assisted?((this.settings[assistKey]||'auto')==='auto'?.48:.75):1);// Start curled kicks outside the target so the Magnus bend brings them back.
 let aim=a.aim;if(solved){const c=Math.cos(solved.aimOffset),s=Math.sin(solved.aimOffset);aim={x:aim.x*c-aim.z*s,z:aim.x*s+aim.z*c};}if(!solved&&curve&&a.flightStyle!=='knuckle'&&lift>1&&a.distance>1){const n=Math.hypot(aim.x,aim.z)||1,x=aim.x/n,z=aim.z/n,k=Math.sign(curve)*curveDrift(speed,curve,a.distance)/a.distance;aim={x:x-k*z,z:z+k*x};}
 const angle=(this.random()-.5)*error;const dx=aim.x*Math.cos(angle)-aim.z*Math.sin(angle),dz=aim.x*Math.sin(angle)+aim.z*Math.cos(angle);
 const restart=this.setPiece?.taker===p?this.setPiece.kind:null;
 if(restart==='penalty'&&dx*this.direction(p.team)<=0){this.beginRestart({kind:'indirect',team:1-p.team,x:b.x,z:b.z,label:'페널티킥은 전방으로 · 간접 프리킥'});return;}
 for(const id of this.setPiece?.wall||[])this.players[id].wallHoldUntil=this.time+.4;
 this.physics.kick({x:dx,z:dz},speed,lift,curve,a.flightStyle);this.owner=null;this.lastTouch=p;this.lastTouchTeam=p.team;this.lastTouchKind=a.aerial?'aerial':'kick';this.lastKickTime=this.time;this.lastKickType=a.type;this.passFlight=createPassFlight(this,p,a);this.lock=.07;this.offside=['corner','goalkick','throw'].includes(restart)?new Set():offsideSnapshot(this,p);this.restartOrigin=restart?{kind:restart,player:p.id,team:p.team}:null;this.setPiece=null;p.touchCooldown=.38;
 if(a.oneTwo){p.runUntil=this.time+3;p.runTarget=runTarget(this,p);p.target={...p.runTarget};}
 const contact={id:a.id,player:p.id,foot:a.foot,inputTime:a.inputTime,acceptedTime:a.acceptedTime,animationStart:a.animationStart,motionStart:a.motionStart,commitTime:a.commitTime,plannedContact:a.plannedContact,actualContact:this.time,ballRelease:this.time,nextActionAllowed:a.nextActionAllowed,clipId:a.clipId,clipTime:a.elapsed,selectedFoot:a.foot,warpAmount:a.actualTarget?distance(a.contactTarget,a.actualTarget):0,plantError:p.rig?.plantError??null,contactError:distance(foot,b),contactTime:this.time,ballReleaseTime:this.time,logicalError:distance(foot,b),target:{...a.contactTarget}};this.contacts.push(contact);if(this.contacts.length>80)this.contacts.shift();this.emit('kick',{player:p,type:a.type,power:a.power,contact});if(a.receiver&&p===this.controlled){this.selectControlled(a.receiver,'pass');this.receiving={player:a.receiver,expires:this.passFlight.expires};}}
 updateAction(p,dt){const a=p.action;if(!a)return;a.elapsed+=dt;
 if(a.type==='feint'){if(a.events){for(const event of a.events){if(event.done||a.elapsed<event.at)continue;event.done=true;const b=this.physics.ball.position;if(distance(p,b)>.95||b.y>.4||this.owner&&this.owner!==p){a.failed=true;continue;}const impulse=skillImpulse(p,a,event.stage??(event.at>.12?1:0));this.physics.kick(impulse.aim,impulse.speed,impulse.lift);p.touchCooldown=.12;this.lastTouch=p;this.lastTouchTeam=p.team;this.lastTouchKind='touch';}if(a.elapsed>(a.duration||.42))p.action=null;}else{if(this.owner===p&&!this.setPiece)dribbleTouch(this,p);if(a.elapsed>.28)p.action=null;}return;}
 if(a.type==='tackle'||a.type==='slide'){if(a.elapsed>.13&&!a.hit){a.hit=true;resolveTackle(this,p,a);}if(a.elapsed>(a.type==='slide'?.85:.55))p.action=null;return;}
 if(!a.hit&&!a.commitTime){const b=this.physics.ball.position;a.contactTarget={x:b.x,y:b.y,z:b.z};if(a.target)setKickTarget(a,b,a.target);if(a.elapsed>=a.commitAt)a.commitTime=this.time;}
 p.yaw=turnToward(p.yaw,Math.atan2(a.aim.x,a.aim.z),dt*10);
 if(!a.hit&&this.owner===p&&!this.setPiece)dribbleTouch(this,p,true);
 if(a.elapsed>=a.contactAt&&!a.hit){const aligned=Math.sin(p.yaw)*a.aim.x+Math.cos(p.yaw)*a.aim.z>.82,reach=a.aerial?distance(p,this.physics.ball.position)<.95:distance(footPosition(p),this.physics.ball.position)<ASSIST.contactRadius;if(aligned&&reach||a.elapsed>.62){a.hit=true;a.contactAt=a.elapsed;this.contactKick(p,a);}else a.contactAt+=dt;}
 if(a.hit&&a.elapsed>a.contactAt+(a.recovery||(a.type==='shoot'?.36:.28)))p.action=null;
 }
 beginRestart(r){if(this.state!=='playing')return;if(this.advantage&&r.team!==this.advantage.restart.team)r=this.advantage.restart;this.advantage=null;flushCards(this);this.state='restart';this.passFlight=null;this.timer=1.7;this.restart=r;this.setPiece=null;this.restartOrigin=null;this.owner=null;this.heldBy=null;this.receiving=null;this.offside.clear();this.charging=false;this.emit('restart',r);}
 finishRestart(){const r=this.restart;this.physics.reset(r.kind==='penalty'?this.direction(r.team)*41.5:r.x,r.kind==='penalty'?0:r.z,r.kind==='throw'?1.7:.115);const b=this.physics.ball.position;let p=this.players.filter(p=>p.team===r.team&&p.active).sort((a,c)=>distance(a,b)-distance(c,b))[0];if(r.kind==='goalkick'&&this.players[r.team*11].active)p=this.players[r.team*11];if(!p){this.kickoff(this.settings.userTeam);return}const d=this.direction(r.team);p.x=b.x-d*.55;p.z=b.z-.1;p.vx=p.vz=0;p.yaw=d*Math.PI/2;p.action=null;
 for(const q of this.players){q.action=null;if(q!==p&&distance(q,b)<(r.kind==='penalty'?9:3)){q.x=clamp(q.x-d*5,-51,51);q.z=clamp(q.z+Math.sign(q.z||1)*4,-32,32);}}
 this.owner=r.kind==='throw'?null:p;this.lastTouch=p;this.lastTouchTeam=p.team;this.lock=.2;this.state='playing';this.setPiece={...r,taker:p,expires:this.time+8};arrangeSetPiece(this,this.setPiece);p.touchCooldown=0;if(p.team===this.settings.userTeam)this.controlled=p;this.emit('resumePlay');}
 move(p,axis,sprint,defend,dt){if(this.owner===p&&!this.heldBy&&!p.action){axis=dribbleSteer(this,p,axis);if(p.dribbleChase)sprint=true;}else if(this.owner===p&&p.action?.aim&&!p.action.hit&&!p.action.aerial){axis=kickApproach(this,p,axis);}else{p.dribbleAim=null;p.dribbleStop=p.dribbleChase=false;}if(!p.action&&!p.turnPlan&&Math.hypot(p.vx,p.vz)>2&&Math.hypot(axis.x,axis.z)>.5){const angle=Math.atan2(Math.sin(Math.atan2(axis.x,axis.z)-p.yaw),Math.cos(Math.atan2(axis.x,axis.z)-p.yaw));if(Math.abs(angle)>1.4)p.turnPlan={start:this.time,duration:.24+Math.abs(angle)*.035,angle,foot:chooseKickFoot(p,this.physics.ball.position,axis)};}if(p.turnPlan&&this.time>p.turnPlan.start+p.turnPlan.duration)p.turnPlan=null;let n=Math.hypot(axis.x,axis.z),speed=(sprint?TUNING.jog+(p.pace*(.75+p.stamina*.25)-TUNING.jog)*(typeof sprint==='number'?sprint:1):TUNING.jog)*(defend?(p.autoDefending&&distance(p,this.physics.ball.position)>3.4?.93:.68):1)*(this.owner===p?.93:1)*(p.closeControl?.72:1);if(p.action?.hit)speed*=.65;if(['drag-back','drag-to-heel','ball-roll'].includes(p.action?.skill))speed=Math.min(speed,2.4);if(p.action?.type==='tackle')speed*=.65;if(p.down>0)speed=0;
 if(p.role==='GK'&&!this.isHumanControlled(p))speed=Math.min(speed,p.dive>0?.65:KEEPER.moveSpeed);const previousSpeed=Math.hypot(p.vx,p.vz),previousYaw=p.yaw,profile=movementProfile(p,previousSpeed,axis);profile.acceleration*=gameplayValue(this,'acceleration');profile.braking*=gameplayValue(this,'braking');profile.turn*=gameplayValue(this,'turnResponse');const align=previousSpeed>.2&&n>.05?(p.vx*axis.x+p.vz*axis.z)/(previousSpeed*n):1;speed*=1-clamp((1-align)*.5,0,1)*clamp(previousSpeed/8,0,1)*.28;const targetX=axis.x*speed,targetZ=axis.z*speed,acc=n>.05?(align<-.1?profile.braking:profile.acceleration):profile.braking;let dx=targetX-p.vx,dz=targetZ-p.vz,change=Math.hypot(dx,dz),max=acc*dt*(p===this.controlled&&this.settings.defenceAssist&&this.owner?.team!==p.team&&defend?1.3:1);if(change>max){dx*=max/change;dz*=max/change}p.vx+=dx;p.vz+=dz;
 const beforeMove={x:p.x,z:p.z};p.x=clamp(p.x+p.vx*dt,-53.5,53.5);p.z=clamp(p.z+p.vz*dt,-35.5,35.5);
 resolvePostMotion(p,beforeMove);
 const current=Math.hypot(p.vx,p.vz);if(current>.2&&!p.action){const yaw=defend?Math.atan2(this.physics.ball.position.x-p.x,this.physics.ball.position.z-p.z):align<.1&&n>.1?Math.atan2(axis.x,axis.z):Math.atan2(p.vx,p.vz);p.yaw=turnToward(p.yaw,yaw,profile.turn*dt);}
 p.motionAcceleration=(current-previousSpeed)/dt;p.motionTurn=Math.atan2(Math.sin(p.yaw-previousYaw),Math.cos(p.yaw-previousYaw))/dt;p.motionPhase=(p.motionPhase||0)+dt*locomotionCadence(current,p.motionStyle,p);p.defending=!!defend;
 p.stamina=clamp(p.stamina+(sprint&&current>6?-TUNING.staminaDrain:TUNING.staminaRecovery)*dt,.12,1);p.cooldown=Math.max(0,p.cooldown-dt);p.touchCooldown=Math.max(0,p.touchCooldown-dt);p.down=Math.max(0,p.down-dt);p.dive=Math.max(0,p.dive-dt);
 }
 updatePossession(dt){
 const b=this.physics.ball.position,v=this.physics.ball.velocity;this.lock=Math.max(0,this.lock-dt);
 if(this.setPiece)return;
 if(this.heldBy){
  const p=this.heldBy;this.holdTime-=dt;
  b.set(p.x+Math.sin(p.yaw)*.4,1.05*(p.height/1.81),p.z+Math.cos(p.yaw)*.4);v.setZero();p.keeperMotion={kind:'hold',until:this.time+.1,target:{x:b.x,y:b.y,z:b.z}};
  if(this.holdTime<=0){this.heldBy=null;this.physics.kick({x:this.direction(p.team),z:-p.z*.04},20,6);this.owner=null;this.lock=.15;p.touchCooldown=.4;this.lastTouchKind='keeper';this.offside=offsideSnapshot(this,p);this.emit('kick',{player:p,type:'lob',power:.5});}
  return;
 }
 if(this.owner&&(!this.owner.active||distance(this.owner,b)>possessionRadius(this,this.owner)||b.y>.85||this.owner.down>0))this.owner=null;
 const nearby=this.players.filter(p=>p.active&&p.down<=0&&p.touchCooldown<=0&&!p.action&&distance(p,b)<(p.role==='GK'?Math.max(1.65,keeperProfile(p).range+.05):1.65)).sort((a,c)=>distance(a,b)-distance(c,b)||a.id-c.id);
 // A short settling window avoids ownership flicker. An exposed ball stays stealable.
 if(this.owner&&this.time-(this.owner.possessedAt??-1)>.16&&b.y<.55){
  const challenger=nearby.find(p=>p.team!==this.owner.team&&distance(p,b)<.68&&distance(p,b)+.22<distance(this.owner,b));
  if(challenger)this.owner=null;
 }
 if(this.lock<=0&&!this.owner){
  for(const p of nearby){
   const flight=activePass(this);if(flight?.follow&&p.team===flight.team&&p.id!==flight.receiver)continue;
   const d=distance(p,b);
   const backpass=this.lastTouch?.team===p.team&&this.lastTouch!==p&&['kick','throw'].includes(this.lastTouchKind);
   if(p.role==='GK'&&inPenaltyArea(this,p,p.team)&&!backpass){
    const save=keeperContact(this,p);
    if(save){
     p.keeperMotion={kind:save.catchable?'catch':'punch',until:this.time+.45,target:{x:b.x,y:b.y,z:b.z}};if(!save.catchable){this.physics.kick({x:this.direction(p.team),z:Math.sign(b.z-p.z||1)*.65},v.length()*.43,2.3);this.lock=.25;p.touchCooldown=.3;}
     else{this.heldBy=p;this.holdTime=this.isHumanTeam(p.team)?5:1.1;this.owner=p;this.lock=1.2;if(p.team===this.settings.userTeam&&!this.autoplay)this.selectControlled(p,'keeper');}
     this.stats.saves[p.team]++;this.lastTouch=p;this.lastTouchTeam=p.team;this.lastTouchKind='save';this.restartOrigin=null;this.receiving=null;this.emit('save',{player:p});break;
    }
   }
   if(p.role==='GK'&&this.lastTouchTeam!==p.team&&v.length()>7)continue;
   const relative=Math.hypot(v.x-p.vx,v.z-p.vz),radius=controlReach(p,relative);
   if(d>=radius)continue;if(secondTouch(this,p))return;if(b.y>.55){if(b.y>1.8||v.y>2||relative>20||p.receive&&this.time<p.receive.start+p.receive.duration)continue;if(this.offside.has(p.id)){this.beginRestart({kind:'indirect',team:1-p.team,x:p.x,z:p.z,label:'오프사이드 · 간접 프리킥'});return;}p.receive=receivePlan(p,b,this.time);p.receiveUntil=this.time+p.receive.duration;v.x*=.25+.3*(1-p.control);v.z*=.25+.3*(1-p.control);v.y=-Math.min(2,Math.abs(v.y)*.2);p.touchCooldown=.14;this.lock=.14;this.offside.clear();this.restartOrigin=null;this.lastTouch=p;this.lastTouchTeam=p.team;this.lastTouchKind='control';break;}
   if(this.offside.has(p.id)){this.beginRestart({kind:'indirect',team:1-p.team,x:p.x,z:p.z,label:'오프사이드 · 간접 프리킥'});return;}
   p.receive=receivePlan(p,b,this.time);p.receiveUntil=this.time+p.receive.duration;if(p.defending)p.receive.kind='intercept';const settled=cushionFirstTouch(this,p);
   this.lastTouch=p;this.lastTouchTeam=p.team;this.lastTouchKind='control';this.offside.clear();this.restartOrigin=null;this.receiving=null;
   if(settled){this.owner=p;p.possessedAt=this.time;this.emit('control',{player:p});}
   else this.lock=.08;
   break;
  }
 }
 if(this.owner&&!this.heldBy){const p=this.owner;this.stats.possession[p.team]+=dt;if(!p.action)dribbleTouch(this,p);}
 }
 autoRestart(s){if(s.kind==='throw')throwIn(this,'pass');else{const shot=s.kind==='penalty'||s.kind==='free'&&distance(this.physics.ball.position,{x:this.direction(s.team)*52.5,z:0})<33;if(shot&&!this.isHumanTeam(s.team))s.aimZ=(this.random()<.5?-1:1)*2.3;this.queueKick(s.taker,shot?'shoot':s.kind==='corner'?'lob':'pass',.62);}}
 updatePress(dt,input=this.input){
 const pressing=input.teamPress&&!this.autoplay&&this.owner?.team!==this.settings.userTeam&&!this.setPiece;
 if(pressing&&!this.pressExhausted){this.pressEnergy=Math.max(0,this.pressEnergy-dt/(input.teamPressCount===2?6.5:5.5));if(this.pressEnergy===0)this.pressExhausted=true;}else{this.pressEnergy=Math.min(1,this.pressEnergy+dt/11);if(this.pressEnergy>=1)this.pressExhausted=false;}
 this.pressHelpers=pressing&&!this.pressExhausted?this.players.filter(p=>p.active&&p.team===this.settings.userTeam&&p!==this.controlled&&p.role!=='GK').sort((a,b)=>distance(a,this.physics.ball.position)-distance(b,this.physics.ball.position)).slice(0,input.teamPressCount===2?2:1):[];
 for(const helper of this.pressHelpers){helper.target={x:this.physics.ball.position.x,z:this.physics.ball.position.z};helper.sprinting=true;helper.aiState='TEAM PRESS';}
 }
 updatePlayer(p,dt,input=this.input){
 if(this.setPiece&&p!==this.setPiece.taker){const pos=this.setPiece.positions?.find(q=>q.id===p.id);if(pos){p.x=pos.x;p.z=pos.z;p.yaw=pos.yaw;}p.vx=p.vz=0;return;}
 if(p.wallHoldUntil>this.time&&!this.isHumanControlled(p)){p.vx=p.vz=0;return;}
 if(p.active&&p.role==='GK'&&!this.isHumanControlled(p))keeperTarget(this,p);
 if(!p.active)return;if(p.intent){const intent=p.intent;if(this.time>intent.expires||p!==this.controlled||p.down>0)p.intent=null;else if(distance(p,this.physics.ball.position)<ASSIST.touchRadius&&!p.action){const incoming=this.physics.ball.velocity.length();if(incoming<15||this.physics.ball.position.y>.65||this.owner===p){const saved=this.input.axis;this.input.axis=intent.axis;if(this.queueKick(p,intent.type,intent.power,null,null,intent.options)){p.action.inputTime=intent.inputTime;p.intent=null;}this.input.axis=saved;}}}p.closeControl=false;p.shield=false;p.autoDefending=false;let axis,sprint=false,defend=false;if(p===this.controlled&&!this.autoplay){axis=this.carryInput&&this.time<this.carryInput.until?this.carryInput.axis:input.axis||{x:0,z:0};sprint=this.settings.analogSprint&&input.sprintAmount!==undefined?input.sprintAmount:input.sprint;defend=input.defend;p.closeControl=input.closeControl&&this.owner===p;p.shield=input.shield&&this.owner===p;
 const auto=autoDefenceMovement(this,p,input,axis,dt);if(auto){axis=auto.axis;sprint=auto.sprint;defend=true;}
 const assistance=auto?null:collectionMovement(this,p,axis,input);if(assistance){axis=assistance.axis;sprint=assistance.sprint;}

 }else {let x=p.target.x-p.x,z=p.target.z-p.z,n=Math.hypot(x,z);axis=n>.25?{x:x/n*Math.min(n/1.3,1),z:z/n*Math.min(n/1.3,1)}:{x:0,z:0};sprint=p.sprinting;}
 if(this.setPiece){axis={x:0,z:0};sprint=false;}
 if(p.action?.type==='slide'){axis={x:Math.sin(p.yaw)*.8,z:Math.cos(p.yaw)*.8};sprint=true;}
 if(p.action?.aim&&!p.action.hit){const a=p.action,b=this.physics.ball.position,v=this.physics.ball.velocity,side=footSign(a.foot)*.11,dx=b.x-a.aim.x*.48-a.aim.z*side-p.x+v.x*.08,dz=b.z-a.aim.z*.48+a.aim.x*side-p.z+v.z*.08;axis={x:clamp(dx*6,-1,1),z:clamp(dz*6,-1,1)};const n=Math.hypot(axis.x,axis.z);if(n>1){axis.x/=n;axis.z/=n}sprint=true;}
 p.sprinting=sprint;this.move(p,axis,sprint,defend,dt);prepareReception(this,p,dt,input);if(p.dive>0)p.z+=p.diveDirection*dt*KEEPER.diveSpeed;this.updateAction(p,dt);
 }
 step(dt,input=this.input){if(['menu','paused','fulltime'].includes(this.state))return;this.input=input;this.time+=dt;
 if(this.state==='kickoff'||this.state==='halftime'){this.timer-=dt;if(this.timer<=0){if(this.state==='halftime'){this.half=2;this.elapsed=0;this.stoppageSeconds=0;this.addedTime=null;this.kickoff(1-this.settings.userTeam);}else{this.state='playing';this.emit('resumePlay');}}return;}
 if(this.state==='restart'){this.stoppageSeconds+=dt;this.timer-=dt;if(this.timer<=0)this.finishRestart();return;}
 if(this.state==='goal'){this.physics.step(dt);this.timer-=dt;if(this.timer<=0)this.kickoff(1-this.goalTeam);return;}
 this.elapsed+=dt;
 if(this.restartOrigin?.kind==='penalty'&&this.time-this.lastKickTime>1&&this.physics.ball.velocity.length()<.2)this.restartOrigin=null;
 if(!this.practice&&this.setPiece?.kind!=='penalty'&&this.restartOrigin?.kind!=='penalty'&&this.elapsed>=this.settings.halfSeconds){if(this.addedTime===null){this.addedTime=this.settings.halfSeconds>=30?Math.min(8,Math.ceil(this.stoppageSeconds*.35)):0;if(this.addedTime>0)this.emit('addedTime',{seconds:this.addedTime});}if(this.elapsed>=this.settings.halfSeconds+this.addedTime){flushCards(this);this.advantage=null;if(this.half===1){this.state='halftime';this.timer=3;this.emit('halftime');}else {this.state='fulltime';this.emit('fulltime');}return;}}
 if(this.setPiece){const s=this.setPiece;if(!s.taker.active){this.beginRestart(s);return;}updateSetPiece(this,dt);if(!s.taker.action&&this.time>s.expires){this.autoRestart(s);}}
 if(this.charging)this.charge=clamp(this.charge+dt/.9,0,1);
 this.aiClock-=dt;if(this.aiClock<=0){const t=performance.now();const ctrl=this.controlled;if(this.autoplay)this.controlled=null;updateTeamAI(this);if(this.autoplay)this.controlled=ctrl;this.aiMs=performance.now()-t;this.aiClock=TUNING.aiInterval;}
 this.updatePress(dt,input);
 for(const p of this.players){this.updatePlayer(p,dt,input);if(this.state!=='playing')return;}
 resolvePlayerContacts(this,dt);if(this.state!=='playing')return;
 this.updatePossession(dt);this.updateAutoControl();updateAdvantage(this);if(this.state!=='playing')return;
 const ball=this.physics.ball,previous={x:ball.position.x,y:ball.position.y,z:ball.position.z};const t=performance.now();guidePass(this,dt);if(!this.heldBy&&!this.setPiece)this.physics.step(dt);this.physicsMs=performance.now()-t;resolveBodyContacts(this,previous);if(this.state!=="playing")return;
 const goal=detectGoal(previous,ball.position);if(goal!==-1){const team=this.half===1?goal:1-goal;
 if(this.restartOrigin&&(['throw','indirect'].includes(this.restartOrigin.kind)||team!==this.restartOrigin.team&&['free','corner','goalkick'].includes(this.restartOrigin.kind))){const own=team!==this.restartOrigin.team,end=Math.sign(ball.position.x);this.beginRestart({kind:own?'corner':'goalkick',team:own?team:1-team,x:end*(own?52:47),z:own?33.5:5,label:own?'코너킥':'직접 득점 불가 · 골킥'});return;}
 this.advantage=null;flushCards(this);this.score[team]++;this.state='goal';this.timer=10;this.goalTeam=team;for(const q of this.players){q.celebrationStart=this.time;q.action=null;q.vx=q.vz=0;}this.owner=null;this.charging=false;this.stoppageSeconds+=3;this.emit('goal',{team,scorer:this.lastTouch});return;}
 const restart=boundaryRestart(this,previous);if(restart){const pending=this.advantage;this.advantage=null;this.beginRestart(pending&&this.time<pending.expires?pending.restart:restart);}
 }
}
