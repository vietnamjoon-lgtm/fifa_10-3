import {cleanGameplay} from './gameplay-settings.js';
import {TEAMS} from './config.js';
import {cleanAssistance} from './control-assist.js';
import {ONLINE_SERVER} from './online-config.js';
import {SnapshotBuffer,applySnapshot} from './net-state.js';
const $=id=>document.getElementById(id),visible=(id,on)=>$(id).classList.toggle('hidden',!on);
const codeOf=value=>String(value||'').trim().toUpperCase();
export class Online{
 constructor(match,settings,hooks){
  this.match=match;this.settings=settings;this.hooks=hooks;this.active=false;this.connected=false;this.started=false;this.paused=false;this.queue=[];this.seq=0;this.buffer=new SnapshotBuffer();this.lastEvent=0;this.generation=0;this.pendingEvents=[];
  $('online-open').onclick=()=>this.open();$('online-close').onclick=()=>{if(this.active)this.leave();else visible('online',false);};
  $('room-create').onclick=()=>this.enter(true);$('room-join').onclick=()=>this.enter(false);$('room-code').addEventListener('keydown',e=>{if(e.key==='Enter')this.enter(false);});
  $('room-ready').onclick=()=>this.send({type:'ready',ready:!this.lobby?.players[this.team]?.ready});$('room-start').onclick=()=>this.send({type:'start'});
  $('room-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('room-link').value);this.status('초대 링크를 복사했습니다. 친구에게 보내 주세요.');}catch{$('room-link').select();this.status('표시된 초대 링크를 복사해 주세요.');}};
  try{$('online-name').value=localStorage.getItem('touchline-online-name')||'PLAYER';}catch{}
  const invite=codeOf(new URL(location.href).searchParams.get('room'));if(/^[A-Z2-9]{8}$/.test(invite)){$('room-code').value=invite;this.open();this.status('초대받은 방입니다. 이름을 입력하고 입장하세요.');}
  addEventListener('beforeunload',()=>{this.socket?.close();});
 }
 status(text,error=false){$('online-status').textContent=text;$('online-status').classList.toggle('error',error);}
 open(){visible('online',true);if(!this.active){visible('room-entry',true);visible('room-lobby',false);this.status('방을 만들고 초대 링크를 친구에게 보내세요.');}}
 async api(path,data){const response=await fetch(ONLINE_SERVER+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'omit',signal:AbortSignal.timeout(12000)});const result=await response.json();if(!response.ok)throw Error(result.error||'연결에 실패했습니다.');return result;}
 async enter(create){
  if(this.active||this.busy)return;if(!ONLINE_SERVER){this.status('온라인 서버가 아직 준비되지 않았습니다.',true);return;}
  const code=codeOf($('room-code').value),name=$('online-name').value.trim().slice(0,16)||'PLAYER';if(!create&&!/^[A-Z2-9]{8}$/.test(code)){this.status('8자리 방 코드를 입력해 주세요.',true);return;}
  this.busy=true;$('room-create').disabled=$('room-join').disabled=true;this.status(create?'방을 만드는 중…':'방에 입장하는 중…');
  try{
   let session;try{session=!create&&JSON.parse(sessionStorage.getItem('touchline-room-'+code)||'null');}catch{}
   if(!session)session=await this.api(create?'/rooms':`/rooms/${code}/join`,{name,halfSeconds:Number($('online-duration').value),gameplay:cleanGameplay(this.settings.gameplay),squad:this.hooks.networkLineup?.(create?0:1,$('online-share-face').checked)});
   try{sessionStorage.setItem('touchline-room-'+session.room,JSON.stringify(session));localStorage.setItem('touchline-online-name',name);}catch{}
   this.room=session.room;this.token=session.token;this.team=session.team;this.offlineGameplay=cleanGameplay(this.settings.gameplay);this.offlineTeam=this.settings.userTeam;this.offlineDuration=this.settings.halfSeconds;this.settings.userTeam=this.team;this.active=true;this.started=false;this.paused=false;this.seq=0;this.lastEvent=0;this.lastFrame=-1;this.queue=[];this.buffer.clear();this.pendingEvents=[];this.latest=null;this.generation++;this.reconnectUntil=Date.now()+45000;
   visible('room-entry',false);visible('room-lobby',true);$('room-label').textContent=this.room;const url=new URL(location.href);url.search='';url.searchParams.set('room',this.room);$('room-link').value=url.href;history.replaceState(null,'',url.pathname+url.search);
   this.connect();this.sendTimer=setInterval(()=>this.flush(),1000/30);this.pingTimer=setInterval(()=>this.send({type:'ping',sent:Date.now()}),2000);
  }catch(e){this.status(e.message||'서버 연결에 실패했습니다.',true);}finally{this.busy=false;$('room-create').disabled=$('room-join').disabled=false;}
 }
 connect(){
  const generation=this.generation,url=ONLINE_SERVER.replace(/^http/,'ws')+`/rooms/${this.room}/socket`;
  this.status('친구와 연결하는 중…');const socket=this.socket=new WebSocket(url);this.connected=false;
  socket.onopen=()=>socket.send(JSON.stringify({type:'auth',token:this.token,protocol:1}));
  socket.onmessage=event=>{if(generation!==this.generation)return;let message;try{message=JSON.parse(event.data);}catch{return;}
   if(message.type==='welcome'){this.settings.gameplay=cleanGameplay(message.gameplay);this.squads=message.squads;this.connected=true;this.reconnectUntil=Date.now()+45000;this.status('연결됐습니다. 두 사람 모두 준비 완료를 눌러 주세요.');}
   if(message.type==='lobby'){this.lobby=message;this.renderLobby();}
   if(message.type==='start'){this.settings.gameplay=cleanGameplay(message.gameplay);this.squads=message.squads;this.started=true;this.paused=false;this.lastEvent=0;this.lastFrame=-1;this.buffer.clear();this.queue=[];this.pendingEvents=[];this.hooks.begin();visible('online',false);$('play-again').disabled=false;$('play-again').textContent='다시 한 판 · 준비';}
   if(message.type==='snapshot'){
    if(message.frame<this.lastFrame)return;this.lastFrame=message.frame;this.latest=message.data;this.buffer.push(message.data,performance.now());
    const resumed=!this.started;if(resumed){this.started=true;this.hooks.begin();visible('online',false);$('play-again').textContent='다시 대결 · 준비';}
    applySnapshot(this.match,message.data,this.team);for(const event of message.events){if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;if(event.type==='kick')this.pendingEvents.push({...event,time:event.data.contact?.contactTime??message.data.time});else this.hooks.event(event.type,event.data);}
    if(resumed&&message.data.state==='fulltime'&&!message.events.some(e=>e.type==='fulltime'))this.hooks.event('fulltime');
   }
   if(message.type==='pong'){this.ping=Math.max(0,Date.now()-message.sent);this.renderConnection();}
   if(message.type==='error'){this.fail(message.message||'연결 정보를 확인해 주세요.');}
   if(message.type==='ended')this.fail(message.reason);
  };
  socket.onclose=()=>{if(generation!==this.generation||!this.active)return;if(this.connected)this.reconnectUntil=Date.now()+45000;this.connected=false;this.queue=[];this.renderConnection();this.status('연결이 끊겼습니다. 같은 방에 재접속하는 중…');if(Date.now()>this.reconnectUntil){this.fail('재접속 시간이 지났습니다. 새 방에서 다시 시작해 주세요.');return;}this.reconnectTimer=setTimeout(()=>this.connect(),1200);};
  socket.onerror=()=>this.status('서버 연결을 확인하는 중…');
 }
 send(data){if(this.socket?.readyState===1)this.socket.send(JSON.stringify(data));}
 command(action,options={}){if(this.connected&&this.started&&!this.paused&&!this.lobby?.paused&&this.queue.length<8)this.queue.push({action,options});}
 flush(){if(!this.active||!this.connected)return;const input=this.paused||this.lobby?.paused?{axis:{x:0,z:0}}:this.latestInput||{axis:{x:0,z:0}};this.send({type:'input',seq:++this.seq,input,defence:this.settings.defence,assistance:cleanAssistance(this.settings),actions:this.queue.splice(0,8)});}
 update(input,now){if(!this.active)return;this.latestInput={axis:{...input.axis}};for(const key of ['autoDefend','sprint','sprintAmount','defend','shield','closeControl','teamPress','teamPressCount','press','keeperRush','curve','chip','low'])this.latestInput[key]=input[key];const sample=this.buffer.sample(now);if(sample&&this.latest){applySnapshot(this.match,sample,this.team);while(this.pendingEvents.length&&this.pendingEvents[0].time<=sample.time){const e=this.pendingEvents.shift();this.hooks.event(e.type,e.data);}}this.renderConnection();}
 renderConnection(){const el=$('network-hud');visible('network-hud',this.active&&this.started);if(!this.active)return;el.textContent=!this.connected?'연결 복구 중…':this.lobby?.paused?'상대 재접속 대기 · 경기가 멈췄습니다':`${TEAMS[this.team]?.name||(this.team===0?'APEX FC':'VOLT UNITED')} · ${this.ping===undefined?'연결됨':this.ping+' ms'} · ${this.room}`;el.classList.toggle('waiting',!this.connected||!!this.lobby?.paused);}
 renderLobby(){const data=this.lobby;if(!data)return;for(let t=0;t<2;t++){const p=data.players[t],card=$('room-player-'+t);card.querySelector('strong').textContent=p?.name||'친구를 기다리는 중';card.querySelector('small').textContent=p?(p.connected?(p.ready?'준비 완료':'준비 중'):'재접속 대기'):'초대 링크로 입장';card.classList.toggle('ready',!!p?.ready);card.classList.toggle('mine',this.team===t);}
  const rules=data.gameplay||cleanGameplay();$('room-label').title=`방장 공통 설정 · 출발 ${rules.acceleration} / 멈춤 ${rules.braking} / 방향 ${rules.turnResponse} / 굴림 ${rules.ballRoll} / 반발 ${rules.ballBounce} / 첫 터치 ${rules.firstTouch}`;let label=document.getElementById('room-gameplay');if(!label){label=document.createElement('p');label.id='room-gameplay';$('room-label').parentElement.after(label);}label.textContent=`공통 경기 설정 · 출발 ${rules.acceleration} · 방향 ${rules.turnResponse} · 첫 터치 ${rules.firstTouch} · 파울 ${{lenient:'관대',standard:'표준',strict:'엄격'}[rules.referee]||'표준'}`;const ready=data.players[this.team]?.ready;$('room-ready').textContent=ready?'준비 취소':'준비 완료';$('room-start').classList.toggle('hidden',this.team!==0);$('room-start').disabled=!data.players.every(p=>p?.connected&&p.ready);$('online-close').textContent='방 나가기';this.renderConnection();
 }
 rematch(){if(!this.active)return false;this.send({type:'ready',ready:true});$('play-again').textContent='상대의 준비를 기다리는 중…';$('play-again').disabled=true;return true;}
 fail(reason){this.leave(false);this.open();this.status(reason||'연결이 종료되었습니다.',true);}
 leave(notify=true){if(!this.active)return;if(notify)this.send({type:'leave'});this.active=false;this.connected=false;this.generation++;clearInterval(this.sendTimer);clearInterval(this.pingTimer);clearTimeout(this.reconnectTimer);this.socket?.close();this.socket=null;this.queue=[];this.buffer.clear();this.pendingEvents=[];this.latest=null;try{sessionStorage.removeItem('touchline-room-'+this.room);}catch{}const cleanURL=new URL(location.href);cleanURL.searchParams.delete('room');history.replaceState(null,'',cleanURL.pathname+cleanURL.search);this.settings.gameplay=cleanGameplay(this.offlineGameplay);this.settings.userTeam=this.offlineTeam??0;this.settings.halfSeconds=this.offlineDuration??120;this.hooks.end();visible('online',false);visible('network-hud',false);$('play-again').disabled=false;$('play-again').textContent='다시 도전 ↗';$('online-close').textContent='돌아가기';}
}
