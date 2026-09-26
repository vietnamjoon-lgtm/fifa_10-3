// Builds one player from the shared player.glb: own skeleton (SkeletonUtils.clone), shared meshes and
// textures, per-player skin tone, face preset, hair, kit colours, number/name and height.
import * as THREE from 'three';
import {clone} from '../../vendor/three-addons/utils/SkeletonUtils.js';

export const REFERENCE_HEIGHT=1.83;
const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

/** Body sizes from the rest skeleton and the player's scale (height / 1.83). */
export function bodyMetrics(rest,s){
 const b=rest.bones,leg=len(b.RightUpLeg.head,b.RightLeg.head)+len(b.RightLeg.head,b.RightFoot.head)+b.RightFoot.head[1];
 return {height:REFERENCE_HEIGHT*s,legLength:leg*s,hipHeight:b.Hips.head[1]*s,footLength:len(b.RightFoot.head,b.RightToeBase.tail)*s,shoulderWidth:len(b.LeftArm.head,b.RightArm.head)*s};
}

/** Number and name for the shirt's second UV: back in the left half, front in the right half. */
export function shirtTexture(color,number,name){
 const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
 g.fillStyle=color;g.fillRect(0,0,512,256);g.fillStyle='#f4f4f4';g.textAlign='center';g.textBaseline='middle';
 g.font='bold 34px Arial';g.fillText(String(name).toUpperCase(),128,52);
 g.font='bold 128px Arial';g.fillText(String(number),128,150);
 g.font='bold 46px Arial';g.fillText(String(number),330,78);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.channel=1;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.anisotropy=4;return t;
}

export function createHuman(assets,{skin='light',face=null,hair='short01',height=REFERENCE_HEIGHT,kit={shirt:'#b3121f',shorts:'#f2f2f2',socks:'#b3121f',boots:'#111111'},number=10,name='PLAYER'}={}){
 const root=clone(assets.gltf.scene),meshes={};let skeleton=null;
 root.traverse(o=>{if(o.isSkinnedMesh){meshes[o.name]=o;skeleton=o.skeleton;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;}});
 for(const h of assets.manifest.hair){const m=meshes['Hair_'+h];if(m)m.visible=h===hair;}
 const set=(meshName,material)=>{const m=meshes[meshName];if(m)m.material=material;};
 set('Body',assets.materials.skin[skin]);
 for(const n of ['Eyes','Eyebrows','Hair_short01','Hair_afro01'])set(n,assets.materials[n]);
 const cloth=c=>new THREE.MeshStandardMaterial({color:c,roughness:.82,sheen:0,side:THREE.DoubleSide});
 set('Kit_shirt',new THREE.MeshStandardMaterial({map:shirtTexture(kit.shirt,number,name),roughness:.8,side:THREE.DoubleSide}));
 set('Kit_shorts',cloth(kit.shorts));set('Kit_socks',cloth(kit.socks));
 set('Kit_boots',new THREE.MeshStandardMaterial({color:kit.boots,roughness:.35,metalness:.05}));
 const faceMorphs=assets.manifest.morphs;
 for(const m of Object.values(meshes)){const d=m.morphTargetDictionary;if(!d)continue;for(const k of faceMorphs)if(k in d)m.morphTargetInfluences[d[k]]=face&&k==='face_'+face?1:0;}
 const s=height/REFERENCE_HEIGHT;root.scale.setScalar(s);
 const bones=Object.fromEntries(skeleton.bones.map(b=>[b.name,b]));
 return {root,meshes,skeleton,bones,scale:s,metrics:bodyMetrics(assets.rest,s)};
}
