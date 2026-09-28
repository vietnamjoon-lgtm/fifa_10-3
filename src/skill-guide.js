import * as THREE from '../vendor/three.module.js';
import {MOVES} from './skill-moves.js';
import {skillAction} from './skills.js';
import {moveKeys} from './control-help.js';
// Skill guide: every FC Online skill move with its stars, keys (spelled out in words) and what
// it does, played on a loop by a player in a small 3D view. It opens from the H controls
// table during a match and from the main menu. The view exists only while the guide is open.
const DOES={
 juggle:'공을 발등으로 톡톡 띄워 저글링합니다. 서 있을 때만 나갑니다.',
 'fake-step':'공을 차는 척 발을 들었다가 그대로 내려 수비수를 속입니다.',
 heel:'뒤꿈치로 공을 옆이나 앞으로 빠르게 쳐서 방향을 바꿉니다.',
 'double-feint':'몸을 좌우로 연달아 흔들어 속인 뒤 한쪽으로 빠져나갑니다.',
 feint:'어깨와 몸을 한쪽으로 기울여 속이고 반대쪽으로 공을 칩니다.',
 'step-over':'발을 공 위로 넘겨 속인 뒤 반대 방향으로 빠져나갑니다.',
 'step-over-reverse':'바깥에서 안쪽으로 발을 넘기는 역방향 스텝오버입니다.',
 'side-step':'옆으로 게걸음하듯 공을 끌며 수비수와 거리를 벌립니다.',
 drag:'발바닥으로 공을 뒤로 끌어 멈추거나 방향을 바꿉니다.',
 roll:'발바닥으로 공을 옆으로 굴려 몸 앞을 가로질러 옮깁니다.',
 lift:'발끝으로 공을 살짝 띄워 수비수의 발을 넘깁니다.',
 rainbow:'공을 종아리 뒤로 올려 뒤꿈치로 머리 위로 넘깁니다.',
 elastico:'발 바깥쪽으로 밀었다가 같은 발 안쪽으로 순식간에 반대로 끌어옵니다.',
 roulette:'발바닥으로 공을 끌며 몸을 돌려 수비수를 등지고 빠져나갑니다.',
 scoop:'공을 발로 떠서 몸을 돌리며 반대 방향으로 가져갑니다.',
 rabona:'디딤발 뒤로 차는 다리를 감아 차는 척하는 동작입니다.',
 jump:'발 사이에 공을 끼우고 점프하듯 들어 올립니다.'
};
const ARROW_WORD={'→':'앞(→)','←':'뒤(←)','↑':'왼쪽(↑)','↓':'오른쪽(↓)','↗':'왼쪽 앞(↗)','↘':'오른쪽 앞(↘)','↖':'왼쪽 뒤(↖)','↙':'오른쪽 뒤(↙)'};
const arrows=list=>list.map(d=>d.startsWith('hold:')?ARROW_WORD[{F:'→',B:'←',L:'↑',R:'↓',FL:'↗',FR:'↘',BL:'↖',BR:'↙'}[d.slice(5)]]+' 길게':ARROW_WORD[{F:'→',B:'←',L:'↑',R:'↓',FL:'↗',FR:'↘',BL:'↖',BR:'↙'}[d]]);
const KEYNAME={q:'Q',c:'C',z:'Z',e:'E'};
// The move's keyboard input as step-by-step words, following the H table's keys (F stands for the guide's SHIFT).
export function howToPress(m){
 const k=m.keys,mods=(k.mods||'').split('').filter(Boolean).map(x=>KEYNAME[x]),hold=mods.length?mods.join('와 ')+'를 누른 채로 ':'';
 if(k.special==='z-tap')return hold+'Z를 톡 누릅니다.';
 if(k.special==='z-hold')return hold+'Z를 길게 누릅니다.';
 if(k.special==='backquote')return '` 키(숫자 1 왼쪽)를 톡 누릅니다.';
 if(k.special==='q-tap')return (k.mods==='e'?'E를 누른 채로 ':'')+'Q를 톡 누릅니다. 공을 가진 선수는 그 자리에서 발 없이 속임 동작을 합니다.';
 if(k.special==='fake')return hold+'슛(D)이나 크로스(A)를 누른 뒤 바로 패스(S)로 취소하면서, 방향키 '+(k.side==='B'?'뒤(←)':'옆(↑ 또는 ↓)')+'를 누릅니다.';
 if(k.plain)return hold+'방향키 '+arrows([k.plain])[0]+'를 누릅니다.';
 const start=(mods.length?mods.join(', ')+', F를 함께 누른 채로':'F를 누른 채로')+' 방향키를 ';
 if(k.sweep)return start+arrows(k.sweep).join(' → ')+' 순서로 끊지 말고 이어서 돌립니다.';
 if(k.hold)return start+arrows([k.hold])[0]+' 길게 누릅니다.';
 if(k.taps)return start+arrows(k.taps).join(', ')+' 순서로 하나씩 톡톡 누릅니다.';
 if(k.holds)return start+arrows(k.holds).join(', ')+' 순서로 길게 누릅니다.';
 if(k.holdTap)return start+arrows([k.holdTap[0]])[0]+'를 길게 누른 뒤 '+arrows([k.holdTap[1]])[0]+'를 톡 누릅니다.';
 return moveKeys(m);
}
// One entry per move (a sided move keeps both variants and is shown once).
function guideEntries(){const out=new Map();for(const m of MOVES){const e=out.get(m.id)||{id:m.id,name:m.name,stars:m.stars,state:m.state,variants:{}};e.variants[m.side===-1?'left':'right']=m;out.set(m.id,e);}return [...out.values()];}
// A move recorded from the real match simulation, so the guide shows exactly what happens in a game: the same touches, the
// dribbler following the ball and the body turn. He is alone, jogging toward his attack with the stick held (mode 'run') or
// standing still (mode 'stand'). Frames are 60 a second, turned so that he faces +z and starts at (0, 24.6); `start` is
// when the move begins and `loop` the clip's length in seconds.
export function recordMove({Match,defaults},move,mode='run'){
 const dt=1/120,m=new Match({...defaults,seed:5},()=>{});m.start(false);m.state='playing';m.aiClock=1e6;m.lock=0;m.time=3;
 const p=m.controlled,d=m.direction(p.team),run=mode==='run';for(const q of m.players){q.active=q===p;q.action=null;if(q!==p)q.x=q.z=200;}
 p.x=-30*d;p.z=0;p.vx=p.vz=0;p.yaw=d*Math.PI/2;p.skillMoves=5;p.cooldown=p.touchCooldown=0;m.owner=p;p.possessedAt=m.time;m.physics.reset(p.x+d*.4,0,.11);
 const input={axis:run?{x:d,z:0}:{x:0,z:0}},lead=run?1.5:.45,shown=run?.7:.45,turn=d*Math.PI/2,c=Math.cos(turn),s=Math.sin(turn);m.input=input;
 const frames=[];let origin=null,action=null,end=null;
 const rot=(x,z)=>({x:x*c-z*s,z:z*c+x*s});
 const snap=()=>{const b=m.physics.ball.position;origin??={x:p.x,z:p.z};const at=rot(p.x-origin.x,p.z-origin.z),v=rot(p.vx,p.vz),ball=rot(b.x-origin.x,b.z-origin.z);
  frames.push({time:m.time,p:{...p,x:at.x,z:at.z+24.6,vx:v.x,vz:v.z,yaw:p.yaw-turn,action:p.action?{...p.action,events:p.action.events?.map(e=>({...e}))}:null},ball:{x:ball.x,y:b.y,z:ball.z+24.6}});};
 for(let i=0;i<Math.round((lead+5)/dt);i++){const t=i*dt;
  if(!action&&t>=lead){action=p.action=skillAction(p,run?input.axis:{x:Math.sin(p.yaw),z:Math.cos(p.yaw)},++m.actionId,move.key);p.cooldown=action.duration+.12;}
  if(action&&p.action!==action&&end===null)end=t;if(end!==null&&t>end+(run?.9:.7))break;
  m.step(dt,input);if(t>=lead-shown-1e-9&&i%2===0)snap();}
 return {frames,start:shown,loop:(frames.length-1)/60};
}
const css=`
#skill-guide-match{z-index:40}
#skill-guide-match .dialog{width:min(1040px,95vw);height:min(660px,92vh);padding:20px;display:grid;grid-template-columns:minmax(230px,320px) 1fr;gap:16px;color:#f0f6e7;font-size:12px}
#skill-guide-match h2{font-size:24px;letter-spacing:-1px;margin:4px 0 2px}
#skill-guide-match .eyebrow{font-size:10px;letter-spacing:3px;color:var(--lime,#c6ff5d)}
#skill-guide-match p{margin:0;color:#bdcfba;line-height:1.6}
#skill-guide-match .side,#skill-guide-match .stage{display:flex;flex-direction:column;gap:10px;min-height:0}
#skill-guide-match .filters{display:flex;gap:4px;flex-wrap:wrap}
#skill-guide-match .list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px}
#skill-guide-match .skill{display:flex;justify-content:space-between;gap:8px;text-align:left;padding:9px 11px;background:#1d3228;border:1px solid #6b825455;border-radius:7px;color:inherit;cursor:pointer;font:inherit;width:100%;margin:0}
#skill-guide-match .skill:hover{border-color:#c6ff5d88}
#skill-guide-match .skill.active{border-color:var(--lime,#c6ff5d);background:#26402f}
#skill-guide-match .stars{color:var(--lime,#c6ff5d);white-space:nowrap}
#skill-guide-match .view{flex:1;min-height:170px;border-radius:8px;overflow:hidden;background:#07120d}
#skill-guide-match .view canvas{width:100%;height:100%;display:block}
#skill-guide-match .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#skill-guide-match button.chip{padding:7px 10px;font-size:11px;margin:0}
#skill-guide-match button.chip.on{border-color:var(--lime,#c6ff5d);color:var(--lime,#c6ff5d)}
#skill-guide-match .row input{accent-color:#c6ff5d;flex:1;min-width:100px}
#skill-guide-match .detail{border-top:1px solid #69816455;padding-top:10px;display:flex;flex-direction:column;gap:6px}
#skill-guide-match .detail strong{color:var(--lime,#c6ff5d);font-size:13px}
#skill-guide-match kbd{padding:4px 8px;border:1px solid #9bb18e66;border-radius:5px;background:#0b1c17;font-size:12px}
#skill-guide-match .note{font-size:10px;color:#9bb18e}
.skill-guide-open{width:100%;margin-top:14px}
@media (max-width:760px){#skill-guide-match .dialog{grid-template-columns:1fr;grid-template-rows:38% 1fr}#skill-guide-match .note{display:none}}
`;
let guide=null;
// Adds the "개인기 가이드" buttons to the H table and the menu (idempotent; called with the controls table).
export function ensureSkillGuide(){
 if(typeof document==='undefined')return;
 if(!guide)guide=buildGuide();
 const help=document.querySelector('#help .help-dialog');
 if(help&&!help.querySelector('.skill-guide-open')){const b=document.createElement('button');b.className='skill-guide-open';b.textContent='개인기 가이드 · 누르는 법 영상으로 보기 ↗';const grid=help.querySelector('.help-grid');if(grid)grid.after(b);else help.append(b);b.onclick=()=>guide.open();}
 const menu=document.getElementById('motion-open');
 if(menu&&!document.getElementById('skill-guide-menu')){const b=document.createElement('button');b.id='skill-guide-menu';b.textContent='개인기 가이드 ↗';menu.after(b);b.onclick=()=>guide.open();}
}
function buildGuide(){
 const style=document.createElement('style');style.textContent=css;document.head.append(style);
 const overlay=document.createElement('div');overlay.id='skill-guide-match';overlay.className='overlay hidden';
 overlay.innerHTML=`<section class="dialog"><div class="side"><div><span class="eyebrow">SKILL GUIDE</span><h2>개인기 가이드</h2><p>개인기를 누르면 선수가 직접 보여 줍니다.</p><p class="easy"><b>쉽게 쓰기</b> 공을 몰다가 <kbd>F</kbd>를 짧게 톡 누르면 앞 수비를 피해 옆으로 제치는 개인기가 자동으로 나갑니다. 방향키를 옆으로 기울이면 그쪽으로, 뒤로 누르면 돌아섭니다. 숫자 <kbd>1</kbd>~<kbd>7</kbd>만 눌러도 번호 개인기가 나갑니다.</p></div><div class="filters"></div><div class="list"></div></div><div class="stage"><div class="view"></div><div class="row"><button class="chip on" data-side="right">오른쪽으로</button><button class="chip" data-side="left">왼쪽으로</button><button class="chip on" data-mode="run">달리면서</button><button class="chip" data-mode="stand">서서</button><button class="chip on" data-speed="1">1배속</button><button class="chip" data-speed=".5">0.5배속</button><button class="chip" data-speed=".25">0.25배속</button><input type="range" min="-3.1" max="3.1" step=".05" value=".9" aria-label="카메라 각도"><button class="chip" data-close>닫기 · ESC</button></div><div class="detail"></div><p class="note">방향은 오른쪽으로 공격할 때 기준입니다(→ 앞, ↑ 선수 왼쪽, ↓ 선수 오른쪽). 왼쪽으로 공격할 때는 방향을 반대로 누릅니다. 선수의 개인기 별 수보다 높은 기술은 나가지 않고, 같은 입력의 낮은 기술이 나갑니다.</p></div></section>`;
 document.body.append(overlay);
 const $=s=>overlay.querySelector(s),entries=guideEntries(),state={entry:entries[0],side:'right',mode:'run',speed:1,angle:.9,time:0,stars:0};let viewer=null;
 const move=()=>state.entry.variants[state.side]||state.entry.variants.right||state.entry.variants.left,modeOf=()=>state.entry.state||state.mode;state.modeOf=modeOf;
 const showDetail=()=>{const m=move(),sided=state.entry.variants.left&&state.entry.variants.right;
  $('.detail').innerHTML=`<strong>${'★'.repeat(m.stars)} ${sided?m.label:m.name}</strong><p><b>키</b> <kbd>${moveKeys(m)}</kbd></p><p><b>누르는 법</b> ${howToPress(m)}</p><p><b>동작</b> ${DOES[m.pose]||''}${m.state==='stand'?' (서 있을 때)':m.state==='run'?' (달리는 도중)':''}</p>`;
  for(const b of overlay.querySelectorAll('[data-side]'))b.disabled=!state.entry.variants[b.dataset.side];
  // A move made only standing or only running is shown that way; the others can be watched either way.
  for(const b of overlay.querySelectorAll('[data-mode]')){b.disabled=!!state.entry.state&&state.entry.state!==b.dataset.mode;b.classList.toggle('on',b.dataset.mode===modeOf());}};
 const restart=()=>{state.time=0;viewer?.reset();};
 const renderList=()=>{const list=$('.list');list.innerHTML='';for(const e of entries){if(state.stars&&e.stars!==state.stars)continue;const b=document.createElement('button');b.className='skill'+(e===state.entry?' active':'');b.innerHTML=`<span>${e.name}</span><span class="stars">${'★'.repeat(e.stars)}</span>`;b.onclick=()=>{state.entry=e;if(!e.variants[state.side])state.side=e.variants.right?'right':'left';markSide();renderList();showDetail();restart();};list.append(b);}};
 const markSide=()=>{for(const b of overlay.querySelectorAll('[data-side]'))b.classList.toggle('on',b.dataset.side===state.side);};
 const filters=$('.filters');for(const n of [0,1,2,3,4,5]){const b=document.createElement('button');b.className='chip'+(n?'':' on');b.textContent=n?'★'.repeat(n):'전체';b.onclick=()=>{state.stars=n;for(const c of filters.children)c.classList.toggle('on',c===b);renderList();};filters.append(b);}
 overlay.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{if(!state.entry.variants[b.dataset.side])return;state.side=b.dataset.side;markSide();showDetail();restart();});
 overlay.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(state.entry.state)return;state.mode=b.dataset.mode;showDetail();restart();});
 overlay.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{state.speed=Number(b.dataset.speed);for(const c of overlay.querySelectorAll('[data-speed]'))c.classList.toggle('on',c===b);});
 $('input').oninput=e=>state.angle=Number(e.target.value);
 const close=()=>{overlay.classList.add('hidden');viewer?.dispose();viewer=null;};
 $('[data-close]').onclick=close;
 // While open the guide owns the keyboard: ESC closes it and no key reaches the paused match.
 addEventListener('keydown',e=>{if(overlay.classList.contains('hidden'))return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();close();}},{capture:true});
 return {async open(){overlay.classList.remove('hidden');renderList();markSide();showDetail();if(!viewer){const [rig,{Match},{defaults}]=await Promise.all([import('./player.js'),import('./match.js'),import('./settings.js')]);if(!overlay.classList.contains('hidden')&&!viewer)viewer=createViewer($('.view'),state,move,rig,{Match,defaults});}restart();}};
}
// Small self-contained scene: grass, ball and one player, rendered only while the guide is open. Each move is recorded once
// from the match (recordMove) and played back; the camera follows the player. player.js and match.js are loaded when the guide
// first opens, so the move table code stays free of rendering and simulation modules.
function createViewer(container,state,move,{createPlayer,animatePlayer,disposePlayerRig},engine){
 const canvas=document.createElement('canvas');container.append(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1c14);scene.add(new THREE.HemisphereLight(0xb9d3e0,0x274c22,2));
 const sun=new THREE.DirectionalLight(0xffeed8,2.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});scene.add(sun,sun.target);
 const grass=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0x3d7a33,roughness:.95}));grass.rotation.x=-Math.PI/2;grass.position.set(0,0,34);grass.receiveShadow=true;scene.add(grass);
 // Grid lines on the grass show the player's run.
 const grid=new THREE.GridHelper(80,40,0x5c9a4c,0x5c9a4c);grid.position.set(0,.005,34);grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),new THREE.MeshStandardMaterial({color:0xf4f4f0,roughness:.45}));ball.castShadow=true;scene.add(ball);
 const rig=createPlayer(0,10,false,{});scene.add(rig.root);
 const camera=new THREE.PerspectiveCamera(36,1,.1,90),clips=new Map();let frame=0,last=performance.now(),previous=0;
 const reset=()=>{rig.plantState=null;rig.motionHistory=undefined;rig.root.traverse(o=>{if(o.userData)delete o.userData.inertial;});};
 const clip=()=>{const m=move(),mode=state.modeOf(),key=m.key+'|'+mode;if(!clips.has(key))clips.set(key,recordMove(engine,m,mode));return clips.get(key);};
 const loop=now=>{frame=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
  const w=container.clientWidth,h=container.clientHeight,ratio=renderer.getPixelRatio();if(w&&h&&(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio))){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const c=clip();state.time=(state.time+dt*state.speed)%c.loop;if(state.time<previous)reset();previous=state.time;
  // Between two recorded frames every position, the stride phase and the move's clock are interpolated.
  const f=c.frames,at=state.time*60,i=Math.min(f.length-2,Math.floor(at)),k=at-i,A=f[i],B=f[i+1],mix=(a,b)=>a+(b-a)*k,turn=Math.atan2(Math.sin(B.p.yaw-A.p.yaw),Math.cos(B.p.yaw-A.p.yaw));
  const p={...A.p,x:mix(A.p.x,B.p.x),z:mix(A.p.z,B.p.z),vx:mix(A.p.vx,B.p.vx),vz:mix(A.p.vz,B.p.vz),yaw:A.p.yaw+turn*k,motionPhase:mix(A.p.motionPhase||0,B.p.motionPhase||0),
   action:A.p.action&&{...A.p.action,elapsed:B.p.action?.id===A.p.action.id?mix(A.p.action.elapsed,B.p.action.elapsed):A.p.action.elapsed}};
  rig.root.position.set(p.x,0,p.z);rig.root.rotation.y=p.yaw;ball.position.set(mix(A.ball.x,B.ball.x),mix(A.ball.y,B.ball.y),mix(A.ball.z,B.ball.z));ball.rotation.x=(ball.position.z-24.6)/.11;
  animatePlayer(rig,Math.hypot(p.vx,p.vz),Math.max(dt*state.speed,.004),mix(A.time,B.time),false,p,ball.position);
  sun.position.set(p.x-3,8,p.z+5.4);sun.target.position.set(p.x,0,p.z);
  camera.position.set(p.x+Math.sin(state.angle)*4.6,1.4,p.z+Math.cos(state.angle)*4.6);camera.lookAt(p.x,.8,p.z+.4);renderer.render(scene,camera);};
 frame=requestAnimationFrame(loop);
 return {reset:()=>{previous=0;reset();},dispose(){cancelAnimationFrame(frame);disposePlayerRig(rig);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
