import {SKILLS} from './skills.js';
import * as THREE from '../vendor/three.module.js';
import {createPlayer,animatePlayer,disposePlayerRig} from './player.js';
import {previewSample} from './motion-preview.js';
// Skill guide: every skill with its keys, difficulty and use, played back with the same pose
// and ball touches the match uses. The menu version drives the menu's 3D motion preview; the
// in-match version (from the H controls table) has its own small 3D view.
export const SKILL_GUIDE=[
 {id:'step-over',stars:2,how:'공을 발 앞에 둔 채 발을 공 바깥으로 넘겨 속인 뒤, 반대쪽으로 빠져나갑니다.',use:'수비수와 1:1로 마주 섰을 때 가장 기본적인 페인트.'},
 {id:'ball-roll',stars:2,how:'발바닥으로 공을 옆으로 굴려 몸 앞을 가로질러 옮깁니다.',use:'측면에서 안쪽으로 파고들거나 각도를 만들 때.'},
 {id:'drag-back',stars:2,how:'발바닥으로 공을 뒤로 끌어 멈춘 뒤, 방향을 바꿔 다시 출발합니다.',use:'앞이 막혔을 때 공을 지키며 돌아서기.'},
 {id:'nutmeg',stars:3,how:'수비수 다리 사이로 공을 짧게 찔러 넣고 뒤로 돌아 들어갑니다.',use:'수비수가 다리를 벌리고 달려들 때.'},
 {id:'heel-flick',stars:3,how:'뒤꿈치로 공을 앞쪽으로 튕겨 수비수의 타이밍을 빼앗습니다.',use:'등지고 있다가 빠르게 앞으로 공을 보낼 때.'},
 {id:'drag-to-heel',stars:4,how:'발바닥으로 끌어온 공을 디딤발 뒤로 뒤꿈치로 쳐서 옆으로 빼냅니다.',use:'측면에서 수비수를 제치고 안쪽으로 방향 전환.'},
 {id:'roulette',stars:4,how:'발바닥으로 공을 끌며 몸을 한 바퀴 돌리고, 반대발로 공을 이어 빼냅니다.',use:'바로 앞의 수비수를 몸으로 막으며 옆으로 돌아 나가기.'},
 {id:'la-croqueta',stars:4,how:'발 안쪽으로 공을 반대발 쪽으로 빠르게 옮기고, 그 발로 바로 치고 나갑니다.',use:'좁은 공간에서 한 명을 옆으로 빠르게 제칠 때.'},
 {id:'rainbow-flick',stars:4,how:'공을 뒤로 굴려 종아리 뒤로 올린 뒤, 뒤꿈치로 머리 위로 넘깁니다.',use:'앞의 수비수를 공중으로 넘길 때. 공이 떠 있는 동안 빼앗기기 쉽습니다.'},
 {id:'elastico',stars:5,how:'발 바깥쪽으로 공을 밀었다가 같은 발 안쪽으로 순식간에 반대로 끌어옵니다.',use:'수비수가 한쪽으로 체중을 실었을 때 반대쪽으로 빠지기.'}
];
// Keys in this game: Shift + the skill's number (the 10th is Shift + 0).
export function skillKeys(id){const index=Object.keys(SKILLS).indexOf(id);return index<0?'':`Shift + ${(index+1)%10}`;}
const NOTE='공을 가진 상태에서 Shift를 누른 채 숫자키를 누릅니다. Shift + 방향키는 방향에 맞는 개인기(앞: 엘라스티코, 뒤: 드래그 백)를 씁니다.';
const css=`
.skill-guide{color:#f0f6e7;font-size:12px}
.skill-guide h2{font-size:24px;letter-spacing:-1px;margin:4px 0 2px}
.skill-guide .eyebrow{font-size:10px;letter-spacing:3px;color:var(--lime,#c6ff5d)}
.skill-guide p{margin:0;color:#bdcfba;line-height:1.6}
.skill-guide .list{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px}
.skill-guide .skill{display:grid;grid-template-columns:1fr auto;gap:4px 10px;text-align:left;padding:10px 12px;background:#1d3228;border:1px solid #6b825455;border-radius:7px;color:inherit;cursor:pointer;font:inherit;width:100%;margin:0}
.skill-guide .skill:hover{border-color:#c6ff5d88}
.skill-guide .skill.active{border-color:var(--lime,#c6ff5d);background:#26402f}
.skill-guide .skill b{font-size:13px}
.skill-guide .stars{color:var(--lime,#c6ff5d);letter-spacing:1px;font-size:11px}
.skill-guide kbd{justify-self:end;align-self:center;grid-row:span 2;padding:5px 8px;border:1px solid #9bb18e66;border-radius:5px;background:#0b1c17;font-size:11px;white-space:nowrap}
.skill-guide .detail{border-top:1px solid #69816455;padding-top:12px;display:flex;flex-direction:column;gap:6px}
.skill-guide .detail strong{color:var(--lime,#c6ff5d);font-size:11px;letter-spacing:1px}
.skill-guide .note{font-size:10px;color:#9bb18e}
#skill-guide{position:absolute;left:18px;top:18px;bottom:18px;width:min(360px,calc(100vw - 36px));z-index:16;display:flex;flex-direction:column;gap:12px;pointer-events:auto;background:#0b1c17ed;border:1px solid #69816455;border-radius:9px;padding:18px}
#skill-guide.hidden{display:none}
#motion-preview.guide-mode>div:first-child{visibility:hidden}
#skill-guide-open-help{width:100%;margin-top:14px}
#skill-guide-match{z-index:40}
#skill-guide-match .dialog{width:min(980px,94vw);height:min(620px,90vh);padding:20px;display:grid;grid-template-columns:minmax(220px,300px) 1fr;gap:16px}
#skill-guide-match .side{display:flex;flex-direction:column;gap:10px;min-height:0}
#skill-guide-match .stage{display:flex;flex-direction:column;gap:10px;min-height:0}
#skill-guide-match .view{flex:1;min-height:180px;border-radius:8px;overflow:hidden;background:#07120d}
#skill-guide-match .view canvas{width:100%;height:100%;display:block}
#skill-guide-match .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#skill-guide-match .row button{padding:8px 11px;font-size:11px;margin:0}
#skill-guide-match .row button.on{border-color:var(--lime,#c6ff5d);color:var(--lime,#c6ff5d)}
#skill-guide-match .row input{accent-color:#c6ff5d;flex:1;min-width:110px}
@media (max-width:760px),(max-height:620px){#skill-guide{top:auto;height:52vh;padding:12px;gap:8px}#skill-guide>div:first-child p,#skill-guide .note{display:none}.skill-guide h2{font-size:18px}#skill-guide .list{min-height:40%}#skill-guide-match .note{display:none}}
@media (max-width:760px){#skill-guide-match .dialog{grid-template-columns:1fr;grid-template-rows:36% 1fr}}
`;
// Cards with name, keys and stars; picking one fills the detail and calls onPick.
function buildList(list,detail,onPick){
 const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
 const select=item=>{for(const b of list.children)b.classList.toggle('active',b.dataset.id===item.id);
  detail.innerHTML=`<strong>${SKILLS[item.id].name} · ${skillKeys(item.id)}</strong><p>${item.how}</p><p><b>언제</b> ${item.use}</p>`;onPick(item.id);};
 for(const item of SKILL_GUIDE){if(!SKILLS[item.id])continue;const b=document.createElement('button');b.className='skill';b.dataset.id=item.id;
  b.innerHTML=`<b>${SKILLS[item.id].name}</b><kbd>${skillKeys(item.id)}</kbd><span class="stars">${stars(item.stars)}</span>`;b.onclick=()=>select(item);list.append(b);}
 return select;
}
// Adds the menu button and panel (preview.show(kind) plays the chosen skill) and the in-match guide.
export function initSkillGuide(preview){
 const $=id=>document.getElementById(id),menuButton=$('motion-open');if(!menuButton||$('skill-guide-open'))return;
 const style=document.createElement('style');style.textContent=css;document.head.append(style);
 const open=document.createElement('button');open.id='skill-guide-open';open.textContent='개인기 가이드 ↗';menuButton.after(open);
 const panel=document.createElement('section');panel.id='skill-guide';panel.className='skill-guide hidden';
 panel.innerHTML=`<div><span class="eyebrow">SKILL GUIDE</span><h2>개인기 가이드</h2><p>개인기를 누르면 선수가 직접 보여 줍니다. 오른쪽에서 왼발·오른발, 느린 재생, 카메라 각도를 바꿀 수 있어요.</p></div><div class="list"></div><div class="detail"></div><p class="note">${NOTE}</p>`;
 document.body.append(panel);
 const select=buildList(panel.querySelector('.list'),panel.querySelector('.detail'),id=>preview.show(id));
 open.onclick=()=>{panel.classList.remove('hidden');$('motion-preview').classList.add('guide-mode');select(SKILL_GUIDE[0]);};
 preview.onClose.push(()=>{panel.classList.add('hidden');$('motion-preview').classList.remove('guide-mode');});
 initMatchGuide();
}
// In-match guide, opened from the H controls table while the match is paused. The match
// renderer is showing the match, so this window has its own small 3D view that exists only
// while the window is open.
function initMatchGuide(){
 const dialog=document.querySelector('#help .help-dialog');if(!dialog||document.getElementById('skill-guide-open-help'))return;
 const button=document.createElement('button');button.id='skill-guide-open-help';button.textContent='개인기 가이드 · 영상으로 보기 ↗';const grid=dialog.querySelector('.help-grid');if(grid)grid.after(button);else dialog.append(button);
 const overlay=document.createElement('div');overlay.id='skill-guide-match';overlay.className='overlay hidden';
 overlay.innerHTML=`<section class="dialog skill-guide"><div class="side"><div><span class="eyebrow">SKILL GUIDE</span><h2>개인기 가이드</h2></div><div class="list"></div></div><div class="stage"><div class="view"></div><div class="row"><button data-foot="right" class="on">오른발</button><button data-foot="left">왼발</button><button data-speed="1" class="on">1배속</button><button data-speed=".5">0.5배속</button><button data-speed=".25">0.25배속</button><input type="range" min="-3.1" max="3.1" step=".05" value=".9" aria-label="카메라 각도"><button data-close>닫기 · ESC</button></div><div class="detail"></div><p class="note">${NOTE}</p></div></section>`;
 document.body.append(overlay);
 const state={kind:SKILL_GUIDE[0].id,foot:'right',speed:1,angle:.9,time:0},view=overlay.querySelector('.view');let viewer=null;
 const restart=()=>{state.time=0;viewer?.reset();};
 const select=buildList(overlay.querySelector('.list'),overlay.querySelector('.detail'),id=>{state.kind=id;restart();});
 const mark=(attr,value)=>{for(const b of overlay.querySelectorAll(`[data-${attr}]`))b.classList.toggle('on',b.dataset[attr]===value);};
 overlay.querySelectorAll('[data-foot]').forEach(b=>b.onclick=()=>{state.foot=b.dataset.foot;restart();mark('foot',b.dataset.foot);});
 overlay.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{state.speed=Number(b.dataset.speed);mark('speed',b.dataset.speed);});
 overlay.querySelector('input').oninput=e=>state.angle=Number(e.target.value);
 const close=()=>{overlay.classList.add('hidden');viewer?.dispose();viewer=null;};
 overlay.querySelector('[data-close]').onclick=close;
 button.onclick=()=>{overlay.classList.remove('hidden');viewer=createViewer(view,state);select(SKILL_GUIDE.find(i=>i.id===state.kind)||SKILL_GUIDE[0]);};
 // While open the guide owns the keyboard: ESC closes it and nothing reaches the paused match.
 addEventListener('keydown',e=>{if(overlay.classList.contains('hidden'))return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();close();}},{capture:true});
}
// Small self-contained scene: grass, ball and one player, rendered only while the guide is open.
function createViewer(container,state){
 const canvas=document.createElement('canvas');container.append(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1c14);scene.add(new THREE.HemisphereLight(0xb9d3e0,0x274c22,2));
 const sun=new THREE.DirectionalLight(0xffeed8,2.6);sun.position.set(-3,8,30);sun.target.position.set(0,0,24.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:1,far:20});scene.add(sun,sun.target);
 const grass=new THREE.Mesh(new THREE.CircleGeometry(9,48),new THREE.MeshStandardMaterial({color:0x3d7a33,roughness:.95}));grass.rotation.x=-Math.PI/2;grass.position.set(0,0,24.6);grass.receiveShadow=true;scene.add(grass);
 const line=new THREE.Mesh(new THREE.PlaneGeometry(9,.08),new THREE.MeshBasicMaterial({color:0xe8efe0}));line.rotation.x=-Math.PI/2;line.position.set(0,.003,23.2);scene.add(line);
 const ball=new THREE.Mesh(new THREE.SphereGeometry(.11,24,16),new THREE.MeshStandardMaterial({color:0xf4f4f0,roughness:.45}));ball.castShadow=true;scene.add(ball);
 const rig=createPlayer(0,10,false,{});scene.add(rig.root);
 const camera=new THREE.PerspectiveCamera(34,1,.1,60);let frame=0,last=performance.now();
 const reset=()=>{rig.plantState=null;rig.motionHistory=undefined;rig.root.traverse(o=>{if(o.userData)delete o.userData.inertial;});};
 const loop=now=>{frame=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
  const w=container.clientWidth,h=container.clientHeight,ratio=renderer.getPixelRatio();if(w&&h&&(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio))){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  state.time=(state.time+dt*state.speed)%2;const t=state.time,sample=previewSample(state.kind,t,state.foot),p=sample.p;
  rig.root.position.set(0,0,24.6);rig.root.rotation.y=0;rig.motionPhaseOverride=sample.phase;ball.position.set(sample.ball.x,sample.ball.y,sample.ball.z);ball.rotation.x=t*8;
  animatePlayer(rig,Math.hypot(p.vx,p.vz),Math.max(dt,.016),t,false,p,ball.position);
  camera.position.set(Math.sin(state.angle)*4.6,1.4,24.6+Math.cos(state.angle)*4.6);camera.lookAt(0,.85,24.6);renderer.render(scene,camera);};
 frame=requestAnimationFrame(loop);
 return {reset,dispose(){cancelAnimationFrame(frame);disposePlayerRig(rig);scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}
