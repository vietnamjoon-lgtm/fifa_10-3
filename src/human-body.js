// Game connection for the player model: Microsoft Rocketbox football players (assets/human/rocketbox, MIT),
// with a separate shirt, shorts, socks and studded boots modelled over the body. The old 13-joint rig keeps
// running every motion, IK, contact and camera system unchanged but is hidden; after animatePlayer each frame
// its joint rotations are copied onto the model's 22 bones (retarget in the rig root's space).
import * as THREE from 'three';
import {GLTFLoader} from '../vendor/three-addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/three-addons/libs/meshopt_decoder.module.js';
import {clone} from '../vendor/three-addons/utils/SkeletonUtils.js';
import {TEAMS} from './config.js';
import {kitHooks} from './player.js';
import {kitColours,kitMaterial,setKitColours,headMaterial,drawDecals} from './human-kit.js';

// Old joint -> new bones, from tools/human/maps/game13.json (index 0 is the player's right side).
// Each bone takes the cumulative share of the old joint's local rotation. `align` turns the new limb's
// bind direction onto the old rig's straight-down rest so the knee and elbow hinges line up.
export const JOINT_BONES=[
 ['hips',null,[['Hips',1]],false],
 ['torso','hips',[['Spine',.3],['Spine1',.6],['Spine2',1]],false],
 ['head','torso',[['Neck',.4],['Head',1]],false],
 ...[0,1].flatMap(i=>{const side=i===0?'Right':'Left';return [
  [`arms${i}.upper`,'torso',[[side+'Arm',1]],true],
  [`arms${i}.lower`,`arms${i}.upper`,[[side+'ForeArm',1]],true],
  [`legs${i}.upper`,'hips',[[side+'UpLeg',1]],true],
  [`legs${i}.lower`,`legs${i}.upper`,[[side+'Leg',1]],true],
  [`legs${i}.foot`,`legs${i}.lower`,[[side+'Foot',1]],false]];})];
const jointOf=(rig,path)=>{const [part,key]=path.split('.');if(!key)return rig[part];const m=/^(arms|legs)(\d)$/.exec(part);return rig[m[1]][+m[2]][key];};

const DOWN=new THREE.Vector3(0,-1,0),identity=new THREE.Quaternion();
const BASE='./assets/human/rocketbox/';
let assetsPromise=null,assets=null;
const live=new Set();
kitHooks.add(()=>{for(const rig of live)dress(rig);});

/** Bind data shared by every clone: local and model-space rest rotations, limb corrections, leg-top height. */
export function bindData(scene){
 scene.updateMatrixWorld(true);const bones={};scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const sceneInverse=new THREE.Quaternion(),model={},local={},parent={},correction={};scene.getWorldQuaternion(sceneInverse).invert();
 const scenePosition=b=>scene.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
 for(const [name,b] of Object.entries(bones)){local[name]=b.quaternion.clone();model[name]=sceneInverse.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));parent[name]=b.parent?.isBone?b.parent.name:null;}
 // A limb's direction is the line to its child joint (bone axes differ between rigs).
 for(const [,,targets,align] of JOINT_BONES)for(const [name] of targets){
  const child=align&&bones[name].children.find(c=>c.isBone);
  correction[name]=child?new THREE.Quaternion().setFromUnitVectors(scenePosition(child).sub(scenePosition(bones[name])).normalize(),DOWN):identity.clone();
 }
 const legTop=(scenePosition(bones.LeftUpLeg).y+scenePosition(bones.RightUpLeg).y)/2,ankle=(scenePosition(bones.LeftFoot).y+scenePosition(bones.RightFoot).y)/2;
 let height=0;scene.traverse(o=>{const a=o.geometry?.attributes.kitBind;if(a)for(let i=1;i<a.array.length;i+=3)height=Math.max(height,a.array[i]);});
 // Order: every bone after its parent.
 const order=[];const visit=n=>{order.push(n);for(const c of bones[n].children)if(c.isBone)visit(c.name);};visit('Hips');
 return {local,model,parent,correction,legTop,ankle,height:height||1.82,hips:bones.Hips.position.clone(),order};
}

/** Rest-pose position of every vertex in metres (`kitBind`), for kit patterns. The file's positions are quantized
 * and, for skinned meshes, the dequantization lives in the inverse bind matrices, so it is computed once here. */
function addBindPositions(scene){
 scene.updateMatrixWorld(true);const v=new THREE.Vector3();
 scene.traverse(o=>{if(!o.isSkinnedMesh||o.geometry.attributes.kitBind)return;o.skeleton.update();const pos=o.geometry.attributes.position,out=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);out.set([v.x,v.y,v.z],i*3);}
  o.geometry.setAttribute('kitBind',new THREE.BufferAttribute(out,3));});
}

/** Loads the models and textures once. Resolves false (old model stays) when loading fails. */
export function loadHumanBodies(renderer){
 if(assetsPromise)return assetsPromise;
 const load=async()=>{
  const layout=await fetch(BASE+'rocketbox.json').then(r=>r.json()),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),textures=new THREE.TextureLoader();
  const anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||1);
  // Repeat wrapping: the waist seam continues past u = 1 (tools/human/rocketbox/01_convert.py).
  const tex=async(file,srgb=true)=>{if(!file)return null;const t=await textures.loadAsync(BASE+file);t.flipY=false;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=anisotropy;t.wrapS=THREE.RepeatWrapping;return t;};
  // Part ids must not blend across seams: sample the mask without filtering.
  const mask=await tex('kit-mask.png',false);mask.generateMipmaps=false;mask.minFilter=mask.magFilter=THREE.NearestFilter;mask.anisotropy=1;
  const avatars={};
  for(const [id,a] of Object.entries(layout.avatars)){
   const [gltf,body,head,bodyNormal,headNormal,hair]=await Promise.all([loader.loadAsync(BASE+a.model),tex(a.body),tex(a.head),tex(a.bodyNormal,false),tex(a.headNormal,false),tex(a.hair)]);
   addBindPositions(gltf.scene);
   avatars[id]={...a,gltf,body,head,bodyNormal,headNormal,hair,bind:bindData(gltf.scene),skinColor:new THREE.Color(a.skin)};
  }
  assets={layout,mask,avatars};return true;
 };
 assetsPromise=load().catch(error=>{console.warn('New player model unavailable, keeping the old one:',error);return false;});
 return assetsPromise;
}
export const humanBodiesDisabled=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('human')==='old';

const lum=c=>.2126*c.r+.7152*c.g+.0722*c.b;
const defaultSkins=['#bf8561','#976143','#deb18a','#74482f','#c89572','#e1ad88'];
/** Which Rocketbox player and skin tint suit the saved profile (the profile itself is not changed). */
export function humanLook(profile={},number=10,avatars={male_02:{skin:'#c18a6f'},male_03:{skin:'#a0674a'}}){
 const target=new THREE.Color(profile.skin||defaultSkins[number%6]),ids=Object.keys(avatars);
 const dark=ids.find(id=>id.endsWith('03'))||ids.at(-1),light=ids.find(id=>id.endsWith('02'))||ids[0];
 const id=profile.hairStyle==='crest'||lum(target)<lum(new THREE.Color(avatars[dark].skin))*1.05?dark:light;
 const ref=new THREE.Color(avatars[id].skin),tint=new THREE.Color(...['r','g','b'].map(k=>THREE.MathUtils.clamp(target[k]/Math.max(ref[k],.01),.3,1.7)));
 return {avatar:id,tint};
}
const bootColors=['#d3ff47','#f18e54','#dce7f0'];
function coloursFor(look){return kitColours(TEAMS[look.team],{keeper:look.keeper,boots:look.profile.boots||bootColors[look.number%3]});}
function decalsFor(rig){
 const {team,number,profile}=rig.look,t=TEAMS[team],c=coloursFor(rig.look);
 drawDecals(rig.human.decalCanvas,{number,name:profile.name||'',text:c.text,chest:t?.chest||'APEX',crest:t?.club?.crest});rig.human.decals.needsUpdate=true;
}
function dress(rig){const h=rig.human;if(!h)return;setKitColours(h.materials.body,coloursFor(rig.look));decalsFor(rig);}

/** Replaces the rig's visible body with the new model once it has loaded. */
export function attachHumanBody(rig){
 if(humanBodiesDisabled()||!assetsPromise)return;
 if(assets)return attach(rig);
 assetsPromise.then(ok=>{if(ok&&!rig.disposed)attach(rig);});
}

/** Rotations for one frame: old joints in the rig root's space -> new bones' local rotations. */
export function retarget(rig,bones,data){
 const joint=rig.humanScratch??=Object.fromEntries(JOINT_BONES.map(([path])=>[path,new THREE.Quaternion()]));
 const model=rig.humanModel??=Object.fromEntries(data.order.map(n=>[n,new THREE.Quaternion()]));
 const target=rig.humanTarget??=Object.fromEntries(JOINT_BONES.flatMap(([,,list])=>list.map(([n])=>[n,new THREE.Quaternion()])));
 for(const [path,parent,list] of JOINT_BONES){
  const local=jointOf(rig,path).quaternion;joint[path].copy(parent?joint[parent]:identity).multiply(local);
  for(const [name,share] of list)target[name].slerpQuaternions(identity,local,share).premultiply(parent?joint[parent]:identity).multiply(data.correction[name]).multiply(data.model[name]);
 }
 for(const name of data.order){const b=bones[name],p=data.parent[name],parentModel=p?model[p]:identity;
  if(target[name]){b.quaternion.copy(parentModel).invert().multiply(target[name]);model[name].copy(target[name]);}
  else{b.quaternion.copy(data.local[name]);model[name].copy(parentModel).multiply(b.quaternion);}}
}
const clamp=THREE.MathUtils.clamp;
/** Morph weights and joint lengths from the saved body sliders (src/body-shape.js bodyMetrics). */
export function bodyShape(m){
 const b=m.body,pct=(v,range)=>clamp((v-100)/range,-1,1.5);
 return {morphs:{body_heavy:clamp((m.width-1)/.22+m.soft*.35,-1,1.5),body_muscle:clamp(m.muscle,-1,1),body_chest:pct(b.chest,25),body_waist:pct(b.waist,30),
  body_thigh:pct(b.thigh,30),body_calf:pct(b.calf,30),body_arms:pct((b.upperArm+b.forearm)/2,30)},leg:b.legLength/100,arm:b.armLength/100,shoulders:b.shoulders/100};
}
/** Sets morphs and bone lengths on one model; returns how much the hips rise for longer legs (model units). */
function applyBodyShape(bones,meshes,m,bind){
 const shape=bodyShape(m);
 for(const mesh of meshes){const d=mesh.morphTargetDictionary;if(!d)continue;for(const [k,v] of Object.entries(shape.morphs))if(k in d)mesh.morphTargetInfluences[d[k]]=v;}
 for(const side of ['Left','Right']){
  for(const n of ['Leg','Foot'])bones[side+n].position.multiplyScalar(shape.leg);
  for(const n of ['ForeArm','Hand'])bones[side+n].position.multiplyScalar(shape.arm);
  bones[side+'Arm'].position.multiplyScalar(shape.shoulders);
 }
 return (shape.leg-1)*(bind.legTop-bind.ankle);
}
const ik={a:new THREE.Vector3(),b:new THREE.Vector3(),c:new THREE.Vector3(),t:new THREE.Vector3(),k:new THREE.Vector3(),pole:new THREE.Vector3(),dir:new THREE.Vector3(),
 q:new THREE.Quaternion(),qp:new THREE.Quaternion(),foot:new THREE.Quaternion(),up:new THREE.Vector3()};
/** Rotates bone so the direction from its joint to `from` turns to `to` (world space). */
function aim(bone,from,to){
 const j=bone.getWorldPosition(ik.dir);const f=from.clone().sub(j).normalize(),t=to.clone().sub(j).normalize();
 ik.q.setFromUnitVectors(f,t);bone.parent.getWorldQuaternion(ik.qp);
 const world=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(ik.q);bone.quaternion.copy(ik.qp.invert().multiply(world));bone.updateMatrixWorld(true);
}
/** Two-bone IK: each model ankle goes where the old rig's ankle is (foot planting, kicks), knee toward the old knee. */
export function reachAnkles(rig,root,bones,m,bind,worldScale){
 root.updateMatrixWorld(true);rig.root.updateMatrixWorld(true);
 const lift=(bind.ankle*worldScale-m.ankle*m.scale); // model ankle sits higher above the sole than the old one
 rig.legs.forEach((leg,i)=>{
  const side=i===0?'Right':'Left',up=bones[side+'UpLeg'],low=bones[side+'Leg'],foot=bones[side+'Foot'];
  foot.getWorldQuaternion(ik.foot);
  leg.foot.getWorldPosition(ik.t);ik.up.set(0,lift,0).applyQuaternion(leg.foot.getWorldQuaternion(ik.q));ik.t.add(ik.up);
  up.getWorldPosition(ik.a);low.getWorldPosition(ik.b);foot.getWorldPosition(ik.c);
  const a=ik.a.distanceTo(ik.b),b=ik.b.distanceTo(ik.c);ik.dir.subVectors(ik.t,ik.a);const d=clamp(ik.dir.length(),Math.abs(a-b)+1e-4,a+b-1e-4);ik.dir.normalize();
  // Knee plane from the old knee.
  leg.lower.getWorldPosition(ik.pole).sub(ik.a);ik.pole.addScaledVector(ik.dir,-ik.pole.dot(ik.dir));if(ik.pole.lengthSq()<1e-8)ik.pole.set(0,0,1).applyQuaternion(rig.root.quaternion);ik.pole.normalize();
  const x=(a*a-b*b+d*d)/(2*d),y=Math.sqrt(Math.max(a*a-x*x,0));ik.k.copy(ik.a).addScaledVector(ik.dir,x).addScaledVector(ik.pole,y);
  const target=ik.a.clone().addScaledVector(ik.dir,d),knee=ik.k.clone();
  aim(up,ik.b.clone(),knee);low.getWorldPosition(ik.b);foot.getWorldPosition(ik.c);aim(low,ik.c.clone(),target);
  // The foot keeps the orientation the retarget gave it.
  low.getWorldQuaternion(ik.qp);foot.quaternion.copy(ik.qp.invert().multiply(ik.foot));foot.updateMatrixWorld(true);
 });
}
function attach(rig){
 if(rig.human||rig.disposed)return;const look=rig.look||(rig.look={team:0,number:10,keeper:false,profile:{}}),m=rig.bodyMetrics;
 const {avatar:id,tint}=humanLook(look.profile,look.number,assets.avatars),a=assets.avatars[id],bind=a.bind;
 const root=clone(a.gltf.scene),bones={},meshes=[];root.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const decalCanvas=document.createElement('canvas');decalCanvas.width=decalCanvas.height=512;
 const decals=new THREE.CanvasTexture(decalCanvas);decals.flipY=false;decals.colorSpace=THREE.SRGBColorSpace;decals.anisotropy=4;
 const materials={
  body:kitMaterial({map:a.body,normalMap:a.bodyNormal,mask:assets.mask,layout:assets.layout},coloursFor(look),decals,tint),
  head:headMaterial({map:a.head,normalMap:a.headNormal,eyes:assets.layout.eyes},tint),
  hair:a.hair&&new THREE.MeshStandardMaterial({map:a.hair,alphaTest:.5,side:THREE.DoubleSide,roughness:.8})};
 for(const mesh of meshes){mesh.material=materials[mesh.material.name]||materials.body;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;}
 // Profile height, limb lengths and girth; the feet then reach the old rig's ankles by IK every frame.
 const worldScale=m.height/bind.height,toModel=m.scale/worldScale;root.scale.setScalar(1/toModel);
 const hipsLift=applyBodyShape(bones,meshes,m,bind);
 // Hide the old body (its bones keep updating) but keep the blob shadow.
 rig.hips.visible=false;for(const c of rig.root.children)if(c.isMesh&&c.geometry?.type!=='CircleGeometry')c.visible=false;
 rig.details=[];rig.lod=[];rig.root.add(root);
 const skeletons=new Set(meshes.map(mesh=>mesh.skeleton));
 rig.human={root,bones,meshes,materials,decals,decalCanvas,avatar:id,sync(){
  retarget(rig,bones,bind);
  bones.Hips.position.set(bind.hips.x+rig.hips.position.x*toModel,bind.hips.y+hipsLift+(rig.hips.position.y-m.hipY)*toModel,bind.hips.z+rig.hips.position.z*toModel);
  reachAnkles(rig,root,bones,m,bind,worldScale);
 },dispose(){live.delete(rig);root.removeFromParent();for(const mat of Object.values(materials))mat?.dispose();decals.dispose();for(const s of skeletons)s.dispose();}};
 decalsFor(rig);live.add(rig);rig.human.sync();
}
