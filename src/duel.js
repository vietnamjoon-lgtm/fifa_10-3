import {SKILLS} from './skills.js';
import {SETPIECE_STYLES} from './setpiece-styles.js';
import {cleanAssistance,assistanceDefaults} from './control-assist.js';
import {Match} from './match.js';
import {defaults} from './settings.js';
import {clamp} from './config.js';

export const emptyInput=()=>({axis:{x:0,z:0}});
const seatFields=['controlled','input','charging','charge','chargeOptions','receiving','pressEnergy','pressExhausted','pressHelpers','manualSwitchUntil','controlLockUntil','carryInput'];
const seat=(p)=>({controlled:p,input:emptyInput(),charging:false,charge:0,chargeOptions:{},receiving:null,pressEnergy:1,pressExhausted:false,pressHelpers:[],defence:'basic',assistance:{...assistanceDefaults},manualSwitchUntil:0,controlLockUntil:0,carryInput:null});
export const ACTIONS=new Set(['switch','charge','shoot','lowShot','pass','through','lob','crossType','fake','cancel','tackle','slide','run','support','knock','skill','keeperPass','keeperKick','keeperDrop','setpieceStyle']);
const inputFlags=['autoDefend','sprint','defend','shield','closeControl','teamPress','press','keeperRush','curve','chip','low'];
const optionFlags=['automatic','curve','chip','low','driven','oneTwo','flair','lob','early','bounce','ground'];
export function cleanInput(raw={}){
 const number=x=>typeof x==='number'&&Number.isFinite(x)?clamp(x,-1,1):0;
 const axis={x:number(raw.axis?.x),z:number(raw.axis?.z)},n=Math.hypot(axis.x,axis.z);if(n>1){axis.x/=n;axis.z/=n;}
 const out={axis,sprintAmount:typeof raw.sprintAmount==='number'&&Number.isFinite(raw.sprintAmount)?clamp(raw.sprintAmount,0,1):raw.sprint===true?1:0,teamPressCount:raw.teamPressCount===2?2:1};for(const key of inputFlags)out[key]=raw[key]===true;return out;
}
export function cleanOptions(raw={}){const out={};if(Object.hasOwn(SKILLS,raw.skill))out.skill=raw.skill;if(Object.hasOwn(SETPIECE_STYLES,raw.style))out.style=raw.style;for(const key of optionFlags)if(typeof raw[key]==='boolean')out[key]=raw[key];return out;}

// Both human seats share one ball, referee and fixed-step simulation.
// Seat context is synchronous: commands and movement never borrow the other team's input.
export class DuelMatch extends Match{
 constructor(settings={},emit=()=>{}){super({...defaults,...settings,userTeam:0},emit);this.seats=[seat(this.players[9]),seat(this.players[20])];this.seatTeam=0;this.loadSeat(0);}
 saveSeat(){for(const key of seatFields)this.seats[this.seatTeam][key]=this[key];}
 loadSeat(team){this.seatTeam=team;this.settings.userTeam=team;this.settings.defence=this.seats[team].defence;Object.assign(this.settings,this.seats[team].assistance);for(const key of seatFields)this[key]=this.seats[team][key];}
 withSeat(team,run){const before=this.seatTeam;this.saveSeat();this.loadSeat(team);try{return run();}finally{this.saveSeat();this.loadSeat(before);}}
 selected(team){return team===this.seatTeam?this.controlled:this.seats[team].controlled;}
 isHumanTeam(){return true;}
 isHumanControlled(p){return !!p&&p===this.selected(p.team);}
 inputForTeam(team){return team===this.seatTeam?this.input:this.seats[team].input;}
 assistanceForTeam(team){return this.seats[team].assistance;}
 kickoff(team){super.kickoff(team);for(let t=0;t<2;t++)this.withSeat(t,()=>{this.controlled=this.players.find(p=>p.active&&p.team===t&&p.index===9)||this.players.find(p=>p.active&&p.team===t);this.charging=false;this.charge=0;this.receiving=null;this.manualSwitchUntil=this.controlLockUntil=0;this.carryInput=null;});}
 finishRestart(){this.withSeat(this.restart.team,()=>super.finishRestart());}
 autoRestart(s){this.withSeat(s.team,()=>super.autoRestart(s));}
 updatePress(dt){for(let t=0;t<2;t++)this.withSeat(t,()=>super.updatePress(dt,this.input));}
 updatePlayer(p,dt){this.withSeat(p.team,()=>super.updatePlayer(p,dt,this.input));}
 updateAutoControl(){for(let t=0;t<2;t++)this.withSeat(t,()=>super.updateAutoControl());}
 command(team,action,options={}){if(team!==0&&team!==1||!ACTIONS.has(action))return;this.withSeat(team,()=>super.action(action,cleanOptions(options)));}
 setInput(team,raw,defence,assistance){if(team!==0&&team!==1)return;this.withSeat(team,()=>{this.input=cleanInput(raw);});this.seats[team].defence=defence==='tactical'?'tactical':'basic';if(assistance)this.seats[team].assistance=cleanAssistance(assistance);if(this.seatTeam===team)this.loadSeat(team);}
 step(dt){if(this.state==='playing'&&this.seats[1].charging)this.seats[1].charge=clamp(this.seats[1].charge+dt/.9,0,1);super.step(dt,this.input);this.saveSeat();for(let t=0;t<2;t++)if(!this.selected(t)?.active)this.withSeat(t,()=>{this.controlled=this.players.find(p=>p.active&&p.team===t)||this.players[t*11+9];this.charging=false;});}
}

const round=n=>Math.round((Number(n)||0)*1000)/1000;
export function matchSnapshot(m){
 m.saveSeat();const b=m.physics.ball;
 return {time:round(m.time),state:m.state,half:m.half,elapsed:round(m.elapsed),timer:round(m.timer),score:m.score,stats:m.stats,goalTeam:m.goalTeam,
  owner:m.owner?.id??null,heldBy:m.heldBy?.id??null,lastTouchTeam:m.lastTouchTeam,halfSeconds:m.settings.halfSeconds,
  controlled:m.seats.map(s=>s.controlled.id),charges:m.seats.map(s=>[s.charging,round(s.charge)]),press:m.seats.map(s=>[round(s.pressEnergy),s.pressHelpers.length]),
  advantage:!!m.advantage,addedTime:m.addedTime,setPiece:m.setPiece?{kind:m.setPiece.kind,team:m.setPiece.team,taker:m.setPiece.taker.id,label:m.setPiece.label,style:m.setPiece.style}:null,
  ball:[b.position.x,b.position.y,b.position.z,b.velocity.x,b.velocity.y,b.velocity.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w].map(round),
  players:m.players.map(p=>({id:p.id,x:round(p.x),z:round(p.z),vx:round(p.vx),vz:round(p.vz),yaw:round(p.yaw),active:p.active,stamina:round(p.stamina),down:round(p.down),dive:round(p.dive),diveDirection:p.diveDirection||0,motionPhase:round(p.motionPhase),motionAcceleration:round(p.motionAcceleration),motionTurn:round(p.motionTurn),receiveUntil:round(p.receiveUntil),receive:p.receive,receivePrep:p.receivePrep,dribblePose:p.dribblePose,celebrationStart:p.celebrationStart,turnPlan:p.turnPlan,keeperMotion:p.keeperMotion,interaction:p.interaction,defending:!!p.defending,autoDefending:!!p.autoDefending,shield:!!p.shield,closeControl:!!p.closeControl,yellows:p.yellows,sentOff:p.sentOff,action:p.action?{id:p.action.id,clipId:p.action.clipId,skill:p.action.skill,duration:p.action.duration,events:p.action.events,commitAt:p.action.commitAt,recovery:p.action.recovery,foot:p.action.foot,contactTarget:p.action.contactTarget,contactTime:p.action.contactTime,type:p.action.type,elapsed:round(p.action.elapsed),contactAt:round(p.action.contactAt),hit:p.action.hit,aerial:p.action.aerial,power:p.action.power,curve:p.action.curve,flair:p.action.flair,flightStyle:p.action.flightStyle,chip:p.action.chip,low:p.action.low}:null}))};
}
