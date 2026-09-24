import * as THREE from 'three';
import {createPlayer,animatePlayer,disposePlayerRig} from './player.js';
const RUN_FROM=-9,RUN_TO=-1.05,RUN_TIME=1.9,RUN_SPEED=5.4;
const SOLO_LANE=1.05,PAIR_LANES=[-.85,.85];
const HALL_W=2.6,HALL_H=3.4,HALL_Z=-16;
// FC 온라인 팩 개봉 화면을 참고한 네온 복도. 등급 색이 복도 라인과 끝의 밝은 문에 함께 적용됩니다.
export class CardWalkout{
 constructor(canvas){
  this.canvas=canvas;this.rigs=[];this.frame=null;this.neon=[];
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(42,1,.05,60);
  this.scene.add(new THREE.HemisphereLight(0xcfe4ff,0x1a1d18,1.25));
  const key=new THREE.DirectionalLight(0xfff4e6,3.1);key.position.set(-1.4,2.9,4.6);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xe9f4ff,1.4);fill.position.set(2.2,1.7,3.4);this.scene.add(fill);
  this.glow=new THREE.PointLight(0xffffff,16,16,2);this.glow.position.set(0,1.8,-9);this.scene.add(this.glow);
  const shell=new THREE.MeshStandardMaterial({color:0x0d1210,roughness:.92,side:THREE.DoubleSide});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HALL_W*2,-HALL_Z),shell);
  floor.rotation.x=-Math.PI/2;floor.position.z=HALL_Z/2;this.scene.add(floor);
  const ceiling=floor.clone();ceiling.position.y=HALL_H;ceiling.rotation.x=Math.PI/2;this.scene.add(ceiling);
  for(const side of [-1,1]){
   const wall=new THREE.Mesh(new THREE.PlaneGeometry(-HALL_Z,HALL_H),shell);
   wall.rotation.y=side*Math.PI/2;wall.position.set(side*HALL_W,HALL_H/2,HALL_Z/2);this.scene.add(wall);
  }
  // 복도 네 모서리를 따라 흐르는 발광 라인과 일정 간격의 세로 리브.
  const strip=new THREE.BoxGeometry(.055,.055,-HALL_Z);
  for(const x of [-HALL_W,HALL_W])for(const y of [.03,HALL_H-.03]){
   const mat=new THREE.MeshBasicMaterial({color:0xffffff});this.neon.push(mat);
   const line=new THREE.Mesh(strip,mat);line.position.set(x,y,HALL_Z/2);this.scene.add(line);
  }
  const rib=new THREE.BoxGeometry(.045,HALL_H,.045);
  for(let z=-2.5;z>HALL_Z+1;z-=2.6)for(const x of [-HALL_W,HALL_W]){
   const mat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5});this.neon.push(mat);
   const bar=new THREE.Mesh(rib,mat);bar.position.set(x,HALL_H/2,z);this.scene.add(bar);
  }
  // 복도 끝의 밝은 문. 포지션 글자가 이 앞에 뜹니다.
  this.doorMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92});
  this.door=new THREE.Mesh(new THREE.PlaneGeometry(HALL_W*1.35,HALL_H*.82),this.doorMat);
  this.door.position.set(0,HALL_H*.44,HALL_Z+.4);this.scene.add(this.door);
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
 }
 tint(color){
  const tone=new THREE.Color(color);
  for(const mat of this.neon)mat.color.copy(tone);
  this.glow.color.copy(tone);
  this.doorMat.color.copy(tone).lerp(new THREE.Color(0xffffff),.72);
 }
 // 팩이 열리자마자 보여 주는 빈 복도. 스페셜이 들어 있다는 신호입니다.
 showTunnel(color){
  this.stop();this.tint(color);
  this.camera.position.set(0,1.55,2.4);this.camera.lookAt(0,1.5,HALL_Z);
  this.draw();
 }
 play(profiles,color='#e8c15a',team=0){
  this.stop();this.tint(color);
  const list=[].concat(profiles).slice(0,2),lanes=list.length>1?PAIR_LANES:[SOLO_LANE];
  this.started=performance.now()/1000;this.last=this.started;
  this.rigs=list.map((profile,i)=>{
   const rig=createPlayer(team,profile.number,profile.role==='GK',profile);
   rig.profile=profile;rig.lane=lanes[i];rig.root.position.set(rig.lane,0,RUN_FROM);
   this.scene.add(rig.root);return rig;
  });
  const focus=list.length>1?0:SOLO_LANE-.62;
  const tick=now=>{
   this.frame=requestAnimationFrame(tick);
   const time=now/1000,dt=Math.min(.05,Math.max(.012,time-this.last));this.last=time;
   const elapsed=time-this.started,running=elapsed<RUN_TIME;
   const z=running?RUN_FROM+(RUN_TO-RUN_FROM)*(elapsed/RUN_TIME):RUN_TO;
   for(const rig of this.rigs){
    rig.root.position.set(rig.lane,0,z);rig.root.rotation.y=running?0:Math.sin(elapsed*.7)*.12;
    const state={...rig.profile,id:rig.profile.number,x:rig.lane,z,yaw:0,vx:0,vz:running?RUN_SPEED:0,stamina:1};
    if(!running)state.celebrationStart=this.started+RUN_TIME;
    animatePlayer(rig,running?RUN_SPEED:0,dt,time,!running,state);
   }
   this.camera.position.set(focus*.5,1.45,list.length>1?3.2:2.35);
   this.camera.lookAt(focus,1.1,z-.15);
   this.draw();
  };
  this.frame=requestAnimationFrame(tick);
  for(const rig of this.rigs)rig.ready?.then(()=>{if(this.rigs.includes(rig)&&!rig.disposed)this.draw();});
 }
 draw(){
  const w=this.canvas.clientWidth||420,h=this.canvas.clientHeight||300;
  if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.render(this.scene,this.camera);
 }
 stop(){
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;
  for(const rig of this.rigs)disposePlayerRig(rig);
  this.rigs=[];
 }
}
