import {cleanGameplay} from '../src/gameplay-settings.js';
import {cleanLineup,applyLineups} from '../src/squads.js';
import {DuelMatch,matchSnapshot,emptyInput,ACTIONS} from '../src/duel.js';
export const PROTOCOL=1;
const nameOf=value=>String(value||'PLAYER').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,16)||'PLAYER';
export class Room{
 constructor({code,now=()=>Date.now(),random=()=>crypto.randomUUID(),halfSeconds=120,gameplay}={}){this.gameplay=cleanGameplay(gameplay);this.code=code;this.now=now;this.random=random;this.created=now();this.lastActive=this.created;this.halfSeconds=[60,120].includes(halfSeconds)?halfSeconds:120;this.slots=[null,null];this.phase='lobby';this.frame=0;this.events=[];this.eventId=0;this.accumulator=0;this.lastTick=now();this.snapshotClock=0;this.disconnectedAt=null;}
 reserve(name,host=false,squad){if(this.phase!=='lobby')throw Error('이미 시작한 방입니다.');const team=host?0:1;if(this.slots[team])throw Error('방이 가득 찼습니다.');const token=this.random();this.slots[team]={token,name:nameOf(name),squad:cleanLineup(squad,team,true),ready:false,send:null,lastSeen:this.now(),lastInput:0,lastSeq:-1,rateTime:0,rateCount:0};return {room:this.code,team,token,protocol:PROTOCOL};}
 connect(token,send,close=()=>{}){const team=this.slots.findIndex(s=>s?.token===token);if(team<0||this.phase==='closed')throw Error('만료되었거나 유효하지 않은 입장 정보입니다.');const slot=this.slots[team];slot.close?.();slot.send=send;slot.close=close;slot.lastSeq=-1;slot.lastSeen=this.now();this.lastActive=this.now();send({type:'welcome',team,room:this.code,protocol:PROTOCOL,gameplay:this.gameplay,squads:this.slots.map((s,t)=>s?.squad||cleanLineup(null,t))});this.broadcastLobby();if(this.match)send({type:'snapshot',frame:this.frame,data:matchSnapshot(this.match),events:[]});return team;}
 disconnect(team,send){const s=this.slots[team];if(!s||s.send!==send)return;s.send=null;s.close=null;s.ready=false;if(this.match)this.match.setInput(team,emptyInput(),s.defence);if(this.phase==='playing'&&this.disconnectedAt===null)this.disconnectedAt=this.now();this.broadcastLobby();}
 lobby(){return {type:'lobby',room:this.code,phase:this.phase,halfSeconds:this.halfSeconds,gameplay:this.gameplay,players:this.slots.map(s=>s?{name:s.name,connected:!!s.send,ready:s.ready}:null),paused:this.phase==='playing'&&!this.slots.every(s=>s?.send)};}
 broadcast(message){for(const s of this.slots)if(s?.send)try{s.send(message);}catch{}}
 broadcastLobby(){this.broadcast(this.lobby());}
 event(type,data={}){if(['start','resumePlay','kickoff','goal','restart','halftime','fulltime','card','advantage','addedTime','save','kick','command','tackle'].includes(type)){this.events.push({id:++this.eventId,type,data:{...data,player:data.player?{id:data.player.id,name:data.player.name}:undefined,scorer:data.scorer?{id:data.scorer.id,name:data.scorer.name}:undefined}});if(this.events.length>24)this.events.shift();}}
 start(){this.events=[];this.match=new DuelMatch({halfSeconds:this.halfSeconds,gameplay:this.gameplay},(type,data)=>this.event(type,data));applyLineups(this.match,this.slots.map(s=>s.squad));this.match.start(false);this.phase='playing';this.disconnectedAt=null;this.accumulator=0;this.lastTick=this.now();this.frame=0;for(const s of this.slots){s.ready=false;s.lastInput=this.now();}this.broadcast({type:'start',gameplay:this.gameplay,squads:this.slots.map(s=>s.squad)});this.broadcastLobby();}
 message(team,message){const slot=this.slots[team];if(!slot||!slot.send||!message||typeof message!=='object')return;const now=this.now();if(now-slot.rateTime>1000){slot.rateTime=now;slot.rateCount=0;}if(++slot.rateCount>100)return;slot.lastSeen=now;this.lastActive=now;
  if(message.type==='ping'){slot.send({type:'pong',sent:message.sent});return;}
  if(message.type==='leave'){this.leave(team);return;}
  if(message.type==='ready'&&(this.phase==='lobby'||this.phase==='finished')){slot.ready=message.ready===true;this.broadcastLobby();if(this.phase==='finished'&&this.slots.every(s=>s?.send&&s.ready))this.start();return;}
  if(message.type==='start'&&team===0&&this.phase==='lobby'&&this.slots.every(s=>s?.send&&s.ready)){this.start();return;}
  if(message.type==='input'&&this.phase==='playing'&&this.slots.every(s=>s?.send)&&Number.isSafeInteger(message.seq)&&message.seq>slot.lastSeq){slot.lastSeq=message.seq;slot.lastInput=now;slot.defence=message.defence==='tactical'?'tactical':'basic';this.match.setInput(team,message.input,slot.defence,message.assistance);for(const c of (Array.isArray(message.actions)?message.actions:[]).slice(0,8))if(c&&ACTIONS.has(c.action))this.match.command(team,c.action,c.options);}
 }
 leave(team){const slot=this.slots[team];if(!slot)return;if(this.phase==='lobby'&&team===1){slot.close?.();this.slots[1]=null;this.broadcastLobby();return;}this.close('상대가 방을 나갔습니다. 새 방에서 다시 만날 수 있습니다.');}
 close(reason){if(this.phase==='closed')return;this.phase='closed';this.broadcast({type:'ended',reason});for(const s of this.slots){s?.close?.();if(s)s.send=null;}this.match=null;}
 tick(){const now=this.now(),dt=Math.min(.1,Math.max(0,(now-this.lastTick)/1000));this.lastTick=now;
  if(now-this.lastActive>600000||now-this.created>3600000){this.close('사용 시간이 지나 방이 종료되었습니다.');return;}
  for(let t=0;t<2;t++){const s=this.slots[t];if(s?.send&&now-s.lastSeen>30000){const send=s.send;s.close?.();this.disconnect(t,send);}}
  if(this.phase!=='playing')return;
  if(!this.slots.every(s=>s?.send)){this.accumulator=0;if(this.disconnectedAt===null)this.disconnectedAt=now;if(now-this.disconnectedAt>45000)this.close('상대가 45초 안에 재접속하지 않아 경기가 종료되었습니다.');return;}
  if(this.disconnectedAt!==null){this.disconnectedAt=null;this.broadcastLobby();}
  for(let t=0;t<2;t++)if(now-this.slots[t].lastInput>350){this.match.setInput(t,emptyInput(),this.slots[t].defence);this.match.withSeat(t,()=>{this.match.charging=false;this.match.charge=0;});}
  this.accumulator+=dt;while(this.accumulator>=1/120){this.match.step(1/120);this.accumulator-=1/120;}
  this.snapshotClock+=dt;if(this.snapshotClock>=1/25){this.snapshotClock%=1/25;this.broadcast({type:'snapshot',frame:++this.frame,data:matchSnapshot(this.match),events:this.events.splice(0)});}
  if(this.match.state==='fulltime'){this.phase='finished';this.broadcast({type:'snapshot',frame:++this.frame,data:matchSnapshot(this.match),events:this.events.splice(0)});this.broadcastLobby();}
 }
}
