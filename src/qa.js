export function installQA(match,ui){
 if(!new URLSearchParams(location.search).has('qa'))return;
 const panel=document.createElement('div');panel.id='qa-panel';panel.style.cssText='position:fixed;right:18px;top:100px;background:#091c15ed;border:1px solid #c6ff5d77;padding:12px;z-index:25;display:flex;flex-direction:column;gap:6px;font:10px Arial;width:155px';panel.innerHTML='<strong style="color:#c6ff5d">DEVELOPER SCENARIOS</strong>';
 const add=(name,run)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='background:#24402f;padding:7px;font-size:10px';b.onclick=run;panel.append(b);};
 let scenarioTimer;
 const status=document.createElement('div');status.style.cssText='color:#dce8d7;font-size:11px;line-height:1.5';
 const position=(x,z,practice=true)=>{clearInterval(scenarioTimer);status.textContent='';match.start(practice);match.state='playing';const p=match.controlled;p.x=x;p.z=z;p.vx=p.vz=0;p.yaw=match.direction(p.team)*Math.PI/2;match.physics.reset(x+match.direction(p.team)*.54,z-match.direction(p.team)*.11);match.owner=p;match.lock=.3;match.qaInput=null;return p;};
 add('보정 드리블 · 방향 전환',()=>{
  const p=position(10,0),start=match.time;let max=0,retained=true;
  const axes=[{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:0,z:0}];
  match.qaInput={axis:axes[0],sprint:true};
  scenarioTimer=setInterval(()=>{const phase=Math.floor((match.time-start)/1.2);max=Math.max(max,Math.hypot(p.x-match.physics.ball.position.x,p.z-match.physics.ball.position.z));retained&&=match.owner===p;
   if(phase>=axes.length){clearInterval(scenarioTimer);match.qaInput=null;status.textContent=`${retained?'공 소유 유지':'소유 변경'} · 최대 거리 ${max.toFixed(2)}m`;}
   else match.qaInput={axis:axes[phase],sprint:true};
  },30);
 });
 add('보정 패스 · 첫 터치',()=>{
  const p=position(10,0),q=match.players[p.team*11+6];q.active=true;q.x=26;q.z=4;q.target={x:q.x,z:q.z};p.target={x:p.x,z:p.z};match.aiClock=1e6;
  match.input={axis:{x:1,z:0}};match.queueKick(p,'pass');const start=match.time;
  scenarioTimer=setInterval(()=>{if(match.owner===q||match.time-start>5){clearInterval(scenarioTimer);status.textContent=match.owner===q?'패스 수신 · 첫 터치 성공':'패스 수신 확인 필요';}},30);
 });
 add('D 자동 수비 확인',()=>{const p=position(10,0),q=match.players[20];q.active=true;q.x=15;q.z=1;q.target={x:15,z:1};q.vx=q.vz=0;match.physics.reset(14.5,1);match.owner=q;match.aiClock=1e6;match.qaInput={axis:{x:0,z:0},autoDefend:true};const start=match.time;scenarioTimer=setInterval(()=>{status.textContent=`${p.autoDefending?'자동 수비 자세':'수비 해제'} · 상대 거리 ${Math.hypot(q.x-p.x,q.z-p.z).toFixed(2)}m`;if(match.time-start>3){clearInterval(scenarioTimer);match.qaInput=null;}},50);});
 add('보정 슛 · 대각선 입력',()=>{const dir=match.direction(match.settings.userTeam),p=position(dir*38,-10);match.input={axis:{x:dir,z:-1}};match.queueKick(p,'shoot',.65);});
 add('드리블 3초',()=>{position(15,0);match.qaInput={axis:{x:1,z:0},sprint:false};setTimeout(()=>{match.qaInput=null},3000)});
 add('접촉 슈팅',()=>{const p=position(38,0);match.queueKick(p,'shoot',.7,{x:1,z:.07});});
 add('로빙 패스',()=>{const p=position(27,0);match.queueKick(p,'lob',.7,{x:22,z:8});});
 add('골키퍼 선방',()=>{const p=position(40,0,false);match.players[11].x=50;match.players[11].z=0;match.queueKick(p,'shoot',.3,{x:1,z:.08});});
 add('골대 충돌',()=>{position(45,3.72);match.owner=null;match.physics.reset(48,3.72,.7);match.physics.kick({x:1,z:0},33,0);});
 add('AI 자동 경기',()=>{match.start(false);match.autoplay=true;});
 add('경기 종료 흐름',()=>{match.start(false);match.state='playing';match.half=2;match.elapsed=match.settings.halfSeconds-2;});
 add('진단 수치',()=>{ui.debug=!ui.debug});
 panel.append(status);document.body.append(panel);
}
