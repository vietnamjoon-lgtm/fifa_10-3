import * as THREE from '../vendor/three.module.js';
import {MOVES} from './skill-moves.js';
import {skillAction,skillImpulse} from './skills.js';
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
const LEAD=.45;
// Player and ball at time t of a move played from standing (the ball starts in front of the feet):
// the same action, body turn and touch impulses the match uses.
export function sampleMove(move,t){
 const p={id:9,x:0,z:24.6,yaw:0,vx:0,vz:0,foot:'right',role:'MID',skillMoves:5},axis={x:0,z:1},action=skillAction(p,axis,1,move.key),elapsed=t-LEAD;
 let x=move.side===-1?-.05:.05,y=.11,z=24.95,vx=0,vy=0,vz=0,next=0;const dt=1/120,yawAt=s=>{const u=Math.min(1,Math.max(0,s/action.duration)),e=u*u*(3-2*u);return action.turn?action.yaw0+action.turn*e:p.yaw;};
 for(let s=0;s<t;s+=dt){const e=s-LEAD;
  if(next<action.events.length&&e>=action.events[next].at){const hit=skillImpulse({...p,yaw:yawAt(e)},action,next),n=Math.hypot(hit.aim.x,hit.aim.z)||1;vx=hit.aim.x/n*hit.speed;vz=hit.aim.z/n*hit.speed;vy=hit.lift;next++;}
  x+=vx*dt;y+=vy*dt;z+=vz*dt;if(y>.11)vy-=9.81*dt;else{y=.11;vy=vy<-1?-vy*.45:0;const roll=Math.exp(-1.2*dt);vx*=roll;vz*=roll;}}
 const active=elapsed>=0&&elapsed<=action.duration;if(active){action.elapsed=elapsed;p.yaw=yawAt(elapsed);}
 return {p:{...p,action:active?action:null},ball:{x,y,z},loop:LEAD+action.duration+.9};
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
 overlay.innerHTML=`<section class="dialog"><div class="side"><div><span class="eyebrow">SKILL GUIDE</span><h2>개인기 가이드</h2><p>개인기를 누르면 선수가 직접 보여 줍니다.</p></div><div class="filters"></div><div class="list"></div></div><div class="stage"><div class="view"></div><div class="row"><button class="chip on" data-side="right">오른쪽으로</button><button class="chip" data-side="left">왼쪽으로</button><button class="chip on" data-speed="1">1배속</button><button class="chip" data-speed=".5">0.5배속</button><button class="chip" data-speed=".25">0.25배속</button><input type="range" min="-3.1" max="3.1" step=".05" value=".9" aria-label="카메라 각도"><button class="chip" data-close>닫기 · ESC</button></div><div class="detail"></div><p class="note">방향은 오른쪽으로 공격할 때 기준입니다(→ 앞, ↑ 선수 왼쪽, ↓ 선수 오른쪽). 왼쪽으로 공격할 때는 방향을 반대로 누릅니다. 선수의 개인기 별 수보다 높은 기술은 나가지 않고, 같은 입력의 낮은 기술이 나갑니다.</p></div></section>`;
 document.body.append(overlay);
 const $=s=>overlay.querySelector(s),entries=guideEntries(),state={entry:entries[0],side:'right',speed:1,angle:.9,time:0,stars:0};let viewer=null;
 const move=()=>state.entry.variants[state.side]||state.entry.variants.right||state.entry.variants.left;
 const showDetail=()=>{const m=move(),sided=state.entry.variants.left&&state.entry.variants.right;
  $('.detail').innerHTML=`<strong>${'★'.repeat(m.stars)} ${sided?m.label:m.name}</strong><p><b>키</b> <kbd>${moveKeys(m)}</kbd></p><p><b>누르는 법</b> ${howToPress(m)}</p><p><b>동작</b> ${DOES[m.pose]||''}${m.state==='stand'?' (서 있을 때)':m.state==='run'?' (달리는 도중)':''}</p>`;
  for(const b of overlay.querySelectorAll('[data-side]'))b.disabled=!state.entry.variants[b.dataset.side];};
 const restart=()=>{state.time=0;viewer?.reset();};
 const renderList=()=>{const list=$('.list');list.innerHTML='';for(const e of entries){if(state.stars&&e.stars!==state.stars)continue;const b=document.createElement('button');b.className='skill'+(e===state.entry?' active':'');b.innerHTML=`<span>${e.name}</span><span class="stars">${'★'.repeat(e.stars)}</span>`;b.onclick=()=>{state.entry=e;if(!e.variants[state.side])state.side=e.variants.right?'right':'left';markSide();renderList();showDetail();restart();};list.append(b);}};
 const markSide=()=>{for(const b of overlay.querySelectorAll('[data-side]'))b.classList.toggle('on',b.dataset.side===state.side);};
 const filters=$('.filters');for(const n of [0,1,2,3,4,5]){const b=document.createElement('button');b.className='chip'+(n?'':' on');b.textContent=n?'★'.repeat(n):'전체';b.onclick=()=>{state.stars=n;for(const c of filters.children)c.classList.toggle('on',c===b);renderList();};filters.append(b);}
 overlay.querySelectorAll('[data-side]').forEach(b=>b.onclick=()=>{if(!state.entry.variants[b.dataset.side])return;state.side=b.dataset.side;markSide();showDetail();restart();});
 overlay.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{state.speed=Number(b.dataset.speed);for(const c of overlay.querySelectorAll('[data-speed]'))c.classList.toggle('on',c===b);});
 $('input').oninput=e=>state.angle=Number(e.target.value);
 const close=()=>{overlay.classList.add('hidden');viewer?.dispose();viewer=null;};
 $('[data-close]').onclick=close;
 // While open the guide owns the keyboard: ESC closes it and no key reaches the paused match.
 addEventListener('keydown',e=>{if(overlay.classList.contains('hidden'))return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();close();}},{capture:true});
 return {async open(){overlay.classList.remove('hidden');renderList();markSide();showDetail();if(!viewer){const rig=await import('./player.js');if(!overlay.classList.contains('hidden')&&!viewer)viewer=createViewer($('.view'),state,move,rig);}restart();}};
}
// Small self-contained scene: grass, ball and one player, rendered only while the guide is open.
// player.js is loaded when the guide first opens, so the move table code stays free of rendering modules.
function createViewer(container,state,move,{createPlayer,animatePlayer,disposePlayerRig}){
 const canvas=document.createElement('canvas');container.append(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1c14);scene.add(new THREE.HemisphereLight(0xb9d3e0,0x274c22,2));
 const sun=new THREE.DirectionalLight(0xffeed8,2.6);sun.position.set(-3,8,30);sun.target.position.set(0,0,24.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});scene.add(sun,sun.target);
 const grass=new THREE.Mesh(new THREE.CircleGeometry(9,48),new THREE.MeshStandardMaterial({color:0x3d7a33,roughness:.95}));grass.rotation.x=-Math.PI/2;grass.position.set(0,0,24.6);grass.receiveShadow=true;scene.add(grass);
 const arrow=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,3),new THREE.MeshBasicMaterial({color:0xc6ff5d}));arrow.rotation.x=Math.PI/2;arrow.position.set(0,.01,27.3);scene.add(arrow);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),new THREE.MeshStandardMaterial({color:0xf4f4f0,roughness:.45}));ball.castShadow=true;scene.add(ball);
 const rig=createPlayer(0,10,false,{});scene.add(rig.root);
 const camera=new THREE.PerspectiveCamera(36,1,.1,60);let frame=0,last=performance.now();
 const reset=()=>{rig.plantState=null;rig.motionHistory=undefined;rig.root.traverse(o=>{if(o.userData)delete o.userData.inertial;});};
 const loop=now=>{frame=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
  const w=container.clientWidth,h=container.clientHeight,ratio=renderer.getPixelRatio();if(w&&h&&(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio))){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const m=move(),first=sampleMove(m,0);state.time=(state.time+dt*state.speed)%first.loop;const s=sampleMove(m,state.time);
  rig.root.position.set(0,0,24.6);rig.root.rotation.y=s.p.yaw;ball.position.set(s.ball.x,s.ball.y,s.ball.z);ball.rotation.x=state.time*8;
  animatePlayer(rig,0,Math.max(dt*state.speed,.004),state.time,false,s.p,ball.position);
  camera.position.set(Math.sin(state.angle)*4.6,1.4,24.6+Math.cos(state.angle)*4.6);camera.lookAt(0,.8,25);renderer.render(scene,camera);};
 frame=requestAnimationFrame(loop);
 return {reset,dispose(){cancelAnimationFrame(frame);disposePlayerRig(rig);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
