// human-lab: the new player next to the old one under the game's lighting, and 22 players at the
// broadcast camera distance with a frame-time measurement. Does not touch the game code.
import * as THREE from 'three';
import {loadHumanAssets} from './load.js';
import {createHuman} from './assemble.js';
import {createPlayer,animatePlayer} from '../player.js';

const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1a2a);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.08,250);
// Same lights as src/stadium.js.
scene.add(new THREE.HemisphereLight(0xb9d3e0,0x274c22,2.0));
const sun=new THREE.DirectionalLight(0xffeed8,3.15);sun.position.set(-18,34,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-40,right:40,top:40,bottom:-40,near:1,far:120});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9acbff,1.1);fill.position.set(20,18,-26);scene.add(fill);
const pitch=new THREE.Mesh(new THREE.PlaneGeometry(105,68),new THREE.MeshStandardMaterial({color:0x2f6b2c,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);

const assets=await loadHumanAssets(renderer);
let players=[],mode='compare',animate=true,who='new';
const TEAMS=[{shirt:'#b3121f',shorts:'#f2f2f2',socks:'#b3121f',boots:'#111111'},{shirt:'#1d3f8f',shorts:'#1d3f8f',socks:'#f2f2f2',boots:'#f2f2f2'}];
const LOOKS=[['light','f1','short01'],['brown','f2','short01'],['dark','f3','afro01'],['light','f3','short01'],['brown','f1','afro01'],['dark','f2','short01']];

function clear(){for(const p of players)scene.remove(p.root);players=[];}
function addNew(i,x,z,yaw,team){const [skin,face,hair]=LOOKS[i%LOOKS.length];const h=createHuman(assets,{skin,face,hair,height:1.72+((i*7)%24)/100,kit:TEAMS[team],number:i+1,name:'Player'});
 h.root.position.set(x,0,z);h.root.rotation.y=yaw;scene.add(h.root);players.push({kind:'new',...h,phase:i*.7});}
function addOld(i,x,z,yaw,team){const rig=createPlayer(team,i+1,false,{});rig.root.position.set(x,0,z);rig.root.rotation.y=yaw;rig.distant=false;scene.add(rig.root);players.push({kind:'old',rig,root:rig.root,phase:i*.7,yaw,x,z});}

function build(){clear();
 if(mode==='compare'){
  // Old character on the left, then the three new looks.
  addOld(0,-1.8,0,0,0);addNew(0,-.6,0,0,0);addNew(1,.6,0,0,0);addNew(2,1.8,0,0,0);
  // Fit the 4.6 m wide row whatever the window's aspect.
  const fitDistance=Math.max(4.6,2.6/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/camera.aspect);
  camera.position.set(0,1.3,fitDistance);camera.lookAt(0,.95,0);
 }else{
  // 4-4-2 for both teams inside the broadcast view (x across the pitch, z toward the camera).
  const shape=[[-32,0],[-22,-15],[-22,-5],[-22,5],[-22,15],[-11,-16],[-11,-5],[-11,5],[-11,16],[-3,-5],[-3,5]];
  const spots=[];for(let t=0;t<2;t++)for(const [x,z] of shape)spots.push([t?-x*.9+2:x*.9-2,z*.8,t]);
  spots.forEach(([x,z,t],i)=>who==='new'?addNew(i,x,z,t?-Math.PI/2:Math.PI/2,t):addOld(i,x,z,t?-Math.PI/2:Math.PI/2,t));
  camera.position.set(0,19,30);camera.lookAt(0,0,0);
 }
 $('info').textContent=`${mode==='compare'?'비교: 기존 캐릭터 | 새 모델 3명':`22명 · ${who==='new'?'새 모델':'기존 캐릭터'} · 방송 카메라`} · 애니메이션 ${animate?'켬':'끔'}`;
}

// A simple running swing on the new rig (skinning stays active); the old rig uses its own animatePlayer.
const e=new THREE.Euler(),q=new THREE.Quaternion();
function pose(p,t){
 const w=t*9+p.phase,swing=Math.sin(w),set=(name,x,z=0)=>{const b=p.bones[name];if(!b)return;if(!b.userData.rest)b.userData.rest=b.quaternion.clone();b.quaternion.copy(b.userData.rest).multiply(q.setFromEuler(e.set(x,0,z)));};
 set('LeftUpLeg',-.55*swing);set('RightUpLeg',.55*swing);set('LeftLeg',.9*Math.max(0,Math.sin(w+1.2)));set('RightLeg',.9*Math.max(0,Math.sin(w+1.2+Math.PI)));
 set('LeftArm',0,.45*swing);set('RightArm',0,.45*swing);set('Spine1',0,.06*swing);
}
function step(t,dt){for(const p of players){if(!animate)continue;if(p.kind==='new')pose(p,t);else animatePlayer(p.rig,3,dt,t,false,{x:p.x??0,z:p.z??0,vx:Math.sin(p.yaw??0)*3,vz:Math.cos(p.yaw??0)*3,yaw:p.yaw??0,id:p.phase});}}

let last=performance.now(),time=0;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;time+=dt;step(time,dt);renderer.render(scene,camera);}
requestAnimationFrame(loop);

/** Frame time without relying on rAF (works in a hidden tab): n frames of update + render + GPU finish. */
window.measure=async({frames=180}={})=>{const gl=renderer.getContext(),times=[];let t=0;
 for(let i=0;i<frames;i++){const a=performance.now();step(t+=1/60,1/60);renderer.render(scene,camera);gl.finish();times.push(performance.now()-a);if(i%30===0)await new Promise(r=>setTimeout(r,0));}
 times.sort((a,b)=>a-b);const mean=times.reduce((a,b)=>a+b,0)/times.length;
 return {mode,who,animate,players:players.length,meanMs:+mean.toFixed(2),p95Ms:+times[Math.floor(times.length*.95)].toFixed(2),fps:+(1000/mean).toFixed(1),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
window.setView=(m,w=who,a=animate)=>{mode=m;who=w;animate=a;build();};
window.snapshot=()=>{renderer.render(scene,camera);return renderer.domElement.toDataURL('image/jpeg',.9);};
for(const [id,fn] of [['compare',()=>setView('compare')],['crowd-new',()=>setView('crowd','new')],['crowd-old',()=>setView('crowd','old')],['anim',()=>{animate=!animate;build();}],['measure',async()=>{$('result').textContent='측정 중...';$('result').textContent=JSON.stringify(await measure());}]])$(id).onclick=fn;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
build();
