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
// ?face=1: the fictional reference face on every head, before and after the 3D face shape (src/human-lab/face-check.js).
const faceCheck=new URLSearchParams(location.search).get('face')==='1'?await import('./face-check.js'):null,faceResult=faceCheck&&await faceCheck.fictionalFace();
// [home club, away club, team index, keeper, profile]
const LINE=faceCheck?faceCheck.faceCheckLine(faceResult).map(([label,profile])=>['bucheon','seoul',0,false,{...profile,label}]):[
 ['bucheon','seoul',0,false,{name:'J. KANG',number:10,skin:'#c89572',hairStyle:'short',beard:'stubble',height:1.81}],
 ['bucheon','seoul',1,false,{name:'M. PARK',number:7,skin:'#976143',hairStyle:'crest',height:1.92,weight:84,body:{legLength:106}}],
 ['daejeon','pohang',0,false,{name:'S. LEE',number:9,skin:'#deb18a',hairStyle:'short',beard:'none',height:1.70,weight:63,body:{muscle:30,softness:15,shoulders:94,chest:92,waist:88,upperArm:88,thigh:90}}],
 ['daejeon','pohang',1,false,{name:'H. KIM',number:4,skin:'#74482f',hairStyle:'crest',height:1.86,weight:88,body:{muscle:90,softness:25,shoulders:112,chest:110,upperArm:118,thigh:115,calf:110}}],
 ['ulsan','seoul',0,false,{name:'D. CHOI',number:23,skin:'#e1ad88',hairStyle:'bald',beard:'beard',height:1.78,weight:92,body:{muscle:45,softness:80,waist:125,chest:106,thigh:112}}],
 ['seoul','bucheon',1,false,{name:'Y. JUNG',number:11,skin:'#bf8561',hairStyle:'crop',height:1.66,weight:60,body:{legLength:94,armLength:95}}],
 ['bucheon','seoul',0,true,{name:'K. HAN',number:1,skin:'#c89572',hairStyle:'short',height:1.94,weight:88,body:{armLength:108}}],
 // Photo face from the bundled fictional reference athlete (src/assets/default-face.jpg).
 ['bucheon','seoul',0,false,{name:'H. SEO',number:8,skin:'#d3ad9d',hair:'#141210',hairStyle:'short',height:1.80,face:{enabled:true,mode:'photo',fitted:true},faceTexture:'./src/assets/default-face.jpg'}],
];
const players=LINE.map(([home,away,team,keeper,profile],i)=>{
 applyClubs(home,away);const rig=createPlayer(team,profile.number,keeper,{...profile,role:keeper?'GK':'MF'});
 const ready=attachHumanBody(rig);rig.root.position.set((i-(LINE.length-1)/2)*1.05,0,0);scene.add(rig.root);return {rig,profile,ready};
});
await Promise.all(players.map(p=>p.ready));
let view='front',running=false,time=0,focus=0;
function place(){
 if(view==='shot')return;
 if(view==='face'){const p=players[focus].rig,head=new THREE.Vector3();p.human?.bones.Head.getWorldPosition(head);camera.position.set(head.x+.35,head.y+.02,head.z+1.25);camera.lookAt(head.x,head.y-.02,head.z);$('info').textContent=`얼굴 · ${LINE[focus][4].name}`;return;}
 const d=9.2,a=view==='front'?0:view==='back'?Math.PI:Math.PI/2;camera.position.set(Math.sin(a)*d,1.25,Math.cos(a)*d);camera.lookAt(0,.95,0);
 $('info').textContent=`${view==='front'?'앞':view==='back'?'뒤':'옆'} · ${running?'달리기':'서 있기'} · 구단 유니폼과 체형(키 1.66~1.94 m, 마름·근육·통통, 다리 길이)`;}
for(const v of ['front','back','side'])$(v).onclick=()=>{view=v;place();};$('face').onclick=()=>{focus=view==='face'?(focus+1)%players.length:0;view='face';place();};$('run').onclick=()=>{running=!running;place();};
// mood: '' (stand or run), 'shout' (goal celebration) or 'camera' (the camera celebration).
let mood='';const ball=new THREE.Vector3(0,.11,1.2);
function step(dt){time+=dt;for(const {rig,profile} of players){const speed=running?7:0,celebrate=!!mood;ball.x=rig.root.position.x+.5;
 animatePlayer(rig,speed,dt,time,celebrate,{...profile,x:rig.root.position.x,z:0,vx:0,vz:speed,yaw:0,id:profile.number,celebration:mood==='camera'?'camera':'c12-15',celebrationStart:0},ball);}}
let last=performance.now();function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,Math.max(0,(now-last)/1000));/* the first rAF time can precede last */last=now;step(dt);renderer.render(scene,camera);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.setView=(v,r=running,i=focus,m=mood,frames=1)=>{view=v;running=r;focus=i;mood=m;for(let k=0;k<frames;k++)step(1/30);place();renderer.render(scene,camera);};
window.galleryPlayers=players; // for checks from the browser console
// Face close-up of player i, turned by `angle` degrees (0 front, 45, 90 the player's left side), for screenshots.
window.faceShot=(i,angle=0,distance=.62)=>{view='shot';focus=i;step(1/30);const p=players[i].rig,eye=new THREE.Vector3();p.human.eye(eye);const a=angle*Math.PI/180;
 camera.position.set(eye.x+Math.sin(a)*distance,eye.y-.03,eye.z+Math.cos(a)*distance);camera.lookAt(eye.x,eye.y-.045,eye.z);$('info').textContent=LINE[i][4].label||LINE[i][4].name;renderer.render(scene,camera);};
window.faceCheck=faceResult&&{side:faceResult.side,shape3d:!!faceResult.asset.shape3d,avatars:players.map(p=>p.rig.human?.avatar),shapes:players.map(p=>p.rig.human?.faceShape)};
place();requestAnimationFrame(loop);
