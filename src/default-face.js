import * as THREE from '../vendor/three.module.js';
import {loadImage} from './face-assets.js';
import {cleanCrop} from './face-settings.js';
let samplePromise,texturePromise;
// An original generated fictional athlete. No real player's likeness is bundled.
export function defaultFacePhotos(){return samplePromise??=loadImage(new URL('./assets/fictional-player-reference.png',import.meta.url).href).then(image=>{const sources={},crops={};for(const [index,view]of ['front','side','back'].entries()){const c=document.createElement('canvas');c.width=512;c.height=640;const ctx=c.getContext('2d'),w=image.width/3;ctx.drawImage(image,index*w,0,w,image.height*.91,0,0,512,640);sources[view]=c.toDataURL('image/jpeg',.89);crops[view]={...cleanCrop(),eyes:.515,nose:.69,mouth:.805};}return {sources,crops};});}
export function defaultFaceTexture(){return texturePromise??=new Promise((resolve,reject)=>new THREE.TextureLoader().load(new URL('./assets/default-face.jpg',import.meta.url).href,map=>{map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;map.userData.shared=true;resolve({map,skin:'#d3ad9d'});},undefined,reject)).catch(error=>{texturePromise=null;throw error;});}
