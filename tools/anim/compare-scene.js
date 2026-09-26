// Deterministic before/after scene for tools/anim/render-compare.mjs. One human-controlled player in practice mode
// follows a fixed input script (stand, walk, jog, run, sprint, 100 deg left turn, 180 deg turn, stop) through the
// real Match simulation at 120 Hz; the page renders one 60 fps frame per window.renderFrame() call with a camera
// that keeps a fixed offset from the player, so both versions are filmed identically.
import * as THREE from '../../vendor/three.module.js';
import {createPlayer,animatePlayer} from '../../src/player.js';
import {Match} from '../../src/match.js';
import {defaults} from '../../src/settings.js';
const params=new URLSearchParams(location.search),$=id=>document.getElementById(id);
$('label').textContent=params.get('label')||'';
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(640,540,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color('#9fb0a4');
scene.add(new THREE.HemisphereLight(0xf7f9ee,0x4b6558,2.2));const sun=new THREE.DirectionalLight(0xfff5e6,2.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3});scene.add(sun,sun.target);
const grass=new THREE.Mesh(new THREE.PlaneGeometry(140,100),new THREE.MeshStandardMaterial({color:0x5f8a55,roughness:1}));grass.rotation.x=-Math.PI/2;grass.receiveShadow=true;scene.add(grass);
const grid=new THREE.GridHelper(140,140,0xe9f0e4,0xd4e0cf);grid.position.y=.002;grid.material.opacity=.35;grid.material.transparent=true;scene.add(grid);
const camera=new THREE.PerspectiveCamera(32,640/540,.1,200);

const m=new Match({...defaults,userTeam:0,seed:7});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;
const p=m.controlled,dir=m.direction(0);p.x=-dir*30;p.z=-10;p.target={x:p.x,z:p.z};p.yaw=dir*Math.PI/2;
for(const other of m.players)other.active=other===p;m.physics.reset(0,30);m.owner=null;
const rig=createPlayer(0,10,false,{name:'CLIPS',height:1.81,weight:78,skin:'#c89572',hair:'#211a15',hairStyle:'crop',face:{mode:'sculpt'}});scene.add(rig.root);
await rig.ready;
// Input script in seconds: [until, axis angle from the initial heading (deg, + = left), magnitude, sprint].
const SCRIPT=[[1,0,0,false],[4,0,.26,false],[7,0,.55,false],[9.5,0,1,false],[11.5,0,1,true],[13.5,100,1,false],[15.5,280,1,false],[17.5,280,0,false],[18.5,280,0,false]];
export const DURATION=SCRIPT.at(-1)[0];
const axisAt=t=>{const [,angle,mag,sprint]=SCRIPT.find(s=>t<s[0])||SCRIPT.at(-1),yaw=dir*Math.PI/2+angle*Math.PI/180;return {axis:{x:Math.sin(yaw)*mag,z:Math.cos(yaw)*mag},sprint};};
let step=0,frame=0;
window.renderFrame=()=>{
 for(let k=0;k<2;k++){const {axis,sprint}=axisAt(step/120);m.step(1/120,{axis,sprint});step++;}
 const speed=Math.hypot(p.vx,p.vz);rig.contactDetail=true;rig.distant=false;rig.root.position.set(p.x,0,p.z);rig.root.rotation.y=p.yaw;
 animatePlayer(rig,speed,1/60,m.time,false,p,m.physics.ball.position);
 camera.position.set(p.x+4.2,1.7,p.z-6.4);camera.lookAt(p.x,.95,p.z);sun.position.set(p.x-3,7,p.z-4);sun.target.position.set(p.x,0,p.z);
 renderer.render(scene,camera);frame++;
 $('info').textContent=`t ${(frame/60).toFixed(2)} s   ${speed.toFixed(1)} m/s   ${rig.motionState}`;
 return {frame,time:frame/60,speed,state:rig.motionState,done:frame/60>=DURATION};
};
window.sceneReady=true;
