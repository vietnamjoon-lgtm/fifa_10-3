import * as THREE from 'three';
import {createPlayer,animatePlayer,disposePlayerRig} from './player.js';
// 카드에 넣을 선수 상반신 그림을 3D 선수 모델에서 직접 뽑습니다. 외부 사진을 쓰지 않습니다.
export class CardPortrait{
 // 카드에 올릴 그림이라 화면에 보이는 크기의 세 배로 그려 선명도를 확보합니다.
 constructor(width=260,height=300,scale=3){
  this.canvas=document.createElement('canvas');
  this.canvas.width=width*scale;this.canvas.height=height*scale;
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(1);this.renderer.setSize(width*scale,height*scale,false);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(30,width/height,.02,12);
  this.scene.add(new THREE.HemisphereLight(0xe8f6ff,0x4a3a2a,1.6));
  const key=new THREE.DirectionalLight(0xfff2e2,2.9);key.position.set(-1.5,2.4,3.4);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xdcecff,1.1);fill.position.set(2.2,1.2,2);this.scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,1.4);rim.position.set(.6,2.2,-2.4);this.scene.add(rim);
  this.cache=new Map();
 }
 async imageFor(profile,team=0){
  const key=profile.uid||profile.name;
  if(this.cache.has(key))return this.cache.get(key);
  const rig=createPlayer(team,profile.number,profile.role==='GK',profile);
  this.scene.add(rig.root);
  try{
   await Promise.race([rig.ready??Promise.resolve(),new Promise(r=>setTimeout(r,2500))]);
   if(rig.disposed)return null;
   animatePlayer(rig,0,.016,0,false,{...profile,x:0,z:0,vx:0,vz:0,yaw:0});
   rig.root.rotation.y=.16;rig.root.updateMatrixWorld(true);
   const headY=rig.head.getWorldPosition(new THREE.Vector3()).y;
   this.camera.position.set(.05,headY-.015,.66);
   this.camera.lookAt(0,headY-.10,0);
   this.renderer.render(this.scene,this.camera);
   const url=this.canvas.toDataURL('image/png');
   this.cache.set(key,url);
   return url;
  }finally{disposePlayerRig(rig);}
 }
}
