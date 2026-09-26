// Loads player.glb (meshopt) once, the KTX2 textures and the rest skeleton; builds the shared materials.
import * as THREE from 'three';
import {GLTFLoader} from '../../vendor/three-addons/loaders/GLTFLoader.js';
import {KTX2Loader} from '../../vendor/three-addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from '../../vendor/three-addons/libs/meshopt_decoder.module.js';

const BASE='./assets/human/';
export async function loadHumanAssets(renderer){
 const [manifest,rest]=await Promise.all([fetch(BASE+'player.json').then(r=>r.json()),fetch(BASE+'rest-skeleton.json').then(r=>r.json())]);
 const ktx=new KTX2Loader().setTranscoderPath('./vendor/three-addons/libs/basis/').detectSupport(renderer);
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx).loadAsync(BASE+manifest.model);
 const tex=async file=>{const t=await ktx.loadAsync(BASE+file.replace(/\.png$/,'.ktx2'));t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;return t;};
 const skin={};for(const [tone,file] of Object.entries(manifest.textures.Skin))skin[tone]=new THREE.MeshStandardMaterial({map:await tex(file),roughness:.58});
 const cutout=async(file,extra={})=>new THREE.MeshStandardMaterial({map:await tex(file),alphaTest:.45,side:THREE.DoubleSide,roughness:.7,...extra});
 const materials={skin,
  Eyes:new THREE.MeshStandardMaterial({map:await tex(manifest.textures.Eyes),roughness:.2}),
  Eyebrows:await cutout(manifest.textures.Eyebrows,{alphaTest:.35,depthWrite:true}),
  Hair_short01:await cutout(manifest.textures.Hair_short01),
  Hair_afro01:await cutout(manifest.textures.Hair_afro01)};
 return {gltf,manifest,rest,materials};
}
