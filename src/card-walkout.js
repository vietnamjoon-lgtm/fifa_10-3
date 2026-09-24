import * as THREE from 'three';
import {createPlayer,animatePlayer,disposePlayerRig} from './player.js';
const RUN_FROM=-6.2,RUN_TO=-1.05,RUN_TIME=1.75,RUN_SPEED=5.4,LANE=.62;
// 카드 공개 때 선수가 터널에서 달려 나와 멈춘 뒤 세리머니를 합니다.
export class CardWalkout{
 constructor(canvas){
  this.canvas=canvas;this.rig=null;this.frame=null;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(38,1,.05,40);
  this.scene.add(new THREE.HemisphereLight(0xdceeff,0x2a2418,1.7));
  const key=new THREE.DirectionalLight(0xfff4e6,3.6);key.position.set(-1.4,2.9,4.6);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xe9f4ff,1.5);fill.position.set(2.2,1.7,3.4);this.scene.add(fill);
  const rim=new THREE.DirectionalLight(0x9fd4ff,1.8);rim.position.set(2.4,2.4,-3);this.scene.add(rim);
  this.glow=new THREE.PointLight(0xffffff,10,11,2);this.glow.position.set(0,2,-6);this.scene.add(this.glow);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(7,16),new THREE.MeshStandardMaterial({color:0x10150e,roughness:.85}));
  floor.rotation.x=-Math.PI/2;floor.position.z=-4;this.scene.add(floor);
  const wall=new THREE.BoxGeometry(.5,3.4,15),wallMat=new THREE.MeshStandardMaterial({color:0x0a0d08,roughness:.95});
  for(const x of [-2.5,2.5]){const side=new THREE.Mesh(wall,wallMat);side.position.set(x,1.7,-4.4);this.scene.add(side);}
  this.backdrop=new THREE.Mesh(new THREE.PlaneGeometry(5,3.6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.22}));
  this.backdrop.position.set(0,1.8,-8.2);this.scene.add(this.backdrop);
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
 }
 play(profile,tierColor='#e8c15a',team=0){
  this.stop();
  this.profile=profile;this.started=performance.now()/1000;this.last=this.started;
  const color=new THREE.Color(tierColor);this.backdrop.material.color.copy(color);this.glow.color.copy(color);
  const rig=this.rig=createPlayer(team,profile.number,profile.role==='GK',profile);
  rig.root.position.set(0,0,RUN_FROM);this.scene.add(rig.root);
  const tick=now=>{
   this.frame=requestAnimationFrame(tick);
   const time=now/1000,dt=Math.min(.05,Math.max(.012,time-this.last));this.last=time;
   const elapsed=time-this.started,running=elapsed<RUN_TIME;
   const z=running?RUN_FROM+(RUN_TO-RUN_FROM)*(elapsed/RUN_TIME):RUN_TO;
   rig.root.position.set(LANE,0,z);rig.root.rotation.y=running?0:Math.sin(elapsed*.7)*.12;
   const state={...profile,id:profile.number,x:LANE,z,yaw:0,vx:0,vz:running?RUN_SPEED:0,stamina:1};
   if(!running)state.celebrationStart=this.started+RUN_TIME;
   animatePlayer(rig,running?RUN_SPEED:0,dt,time,!running,state);
   this.camera.position.set(LANE*.45,1.38,2.05);this.camera.lookAt(LANE,1.02,z-.15);
   this.draw();
  };
  this.frame=requestAnimationFrame(tick);
  rig.ready?.then(()=>{if(this.rig===rig&&!rig.disposed)this.draw();});
 }
 draw(){
  const w=this.canvas.clientWidth||420,h=this.canvas.clientHeight||300;
  if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.render(this.scene,this.camera);
 }
 stop(){
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;
  if(this.rig){disposePlayerRig(this.rig);this.rig=null;}
 }
}
