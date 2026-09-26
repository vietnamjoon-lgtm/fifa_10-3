// Player gallery: the game's player model (src/human-body.js) in several club kits, a keeper and different
// skin tones under the game lighting. Front, back and side views for checking kit details.
import * as THREE from 'three';
import {createPlayer,animatePlayer} from '../player.js';
import {loadHumanBodies,attachHumanBody} from '../human-body.js';
import {applyClubs} from '../clubs.js';

const $=id=>document.getElementById(id);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1a2a);
const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,.1,200);
// Same lights as src/stadium.js.
scene.add(new THREE.HemisphereLight(0xb9d3e0,0x274c22,2.0));
const sun=new THREE.DirectionalLight(0xffeed8,3.15);sun.position.set(-18,34,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:120});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;scene.add(sun);
const fill=new THREE.DirectionalLight(0x9acbff,1.1);fill.position.set(20,18,-26);scene.add(fill);
const pitch=new THREE.Mesh(new THREE.PlaneGeometry(60,30),new THREE.MeshStandardMaterial({color:0x2f6b2c,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);

await loadHumanBodies(renderer);
// [home club, away club, team index, keeper, profile]
const LINE=[
 ['bucheon','seoul',0,false,{name:'J. KANG',number:10,skin:'#c89572',hairStyle:'short'}],
 ['bucheon','seoul',1,false,{name:'M. PARK',number:7,skin:'#976143',hairStyle:'crest'}],
 ['daejeon','pohang',0,false,{name:'S. LEE',number:9,skin:'#deb18a',hairStyle:'short'}],
 ['daejeon','pohang',1,false,{name:'H. KIM',number:4,skin:'#74482f',hairStyle:'crest'}],
 ['ulsan','seoul',0,false,{name:'D. CHOI',number:23,skin:'#e1ad88',hairStyle:'short'}],
 ['seoul','bucheon',1,false,{name:'Y. JUNG',number:11,skin:'#bf8561',hairStyle:'crop'}],
 ['bucheon','seoul',0,true,{name:'K. HAN',number:1,skin:'#c89572',hairStyle:'short'}],
];
const players=LINE.map(([home,away,team,keeper,profile],i)=>{
 applyClubs(home,away);const rig=createPlayer(team,profile.number,keeper,{...profile,role:keeper?'GK':'MF'});
 attachHumanBody(rig);rig.root.position.set((i-(LINE.length-1)/2)*1.05,0,0);scene.add(rig.root);return {rig,profile};
});
let view='front',running=false,time=0;
function place(){const d=9.2,a=view==='front'?0:view==='back'?Math.PI:Math.PI/2;camera.position.set(Math.sin(a)*d,1.25,Math.cos(a)*d);camera.lookAt(0,.95,0);
 $('info').textContent=`${view==='front'?'앞':view==='back'?'뒤':'옆'} · ${running?'달리기':'서 있기'} · 부천 홈/원정, 대전·포항, 울산, 서울 원정, 골키퍼`;}
for(const v of ['front','back','side'])$(v).onclick=()=>{view=v;place();};$('run').onclick=()=>{running=!running;place();};
function step(dt){time+=dt;for(const {rig,profile} of players){const speed=running?5:0;animatePlayer(rig,speed,dt,time,false,{...profile,x:rig.root.position.x,z:0,vx:0,vz:speed,yaw:0,id:profile.number});}}
let last=performance.now();function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;step(dt);renderer.render(scene,camera);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.setView=(v,r=running)=>{view=v;running=r;place();step(1/60);renderer.render(scene,camera);};
place();requestAnimationFrame(loop);
