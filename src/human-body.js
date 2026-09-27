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
import {kitColours,kitMaterial,setKitColours,headMaterial,drawDecals,composePhotoHead} from './human-kit.js';
import {cleanFace,FACE_SHAPE} from './face-settings.js';

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
 const legTop=(scenePosition(bones.LeftUpLeg).y+scenePosition(bones.RightUpLeg).y)/2,ankle=(scenePosition(bones.LeftFoot).y+scenePosition(bones.RightFoot).y)/2,headY=scenePosition(bones.Head).y;
 let height=0;scene.traverse(o=>{const a=o.geometry?.attributes.kitBind;if(a)for(let i=1;i<a.array.length;i+=3)height=Math.max(height,a.array[i]);});
 // Order: every bone after its parent.
 const order=[];const visit=n=>{order.push(n);for(const c of bones[n].children)if(c.isBone)visit(c.name);};visit('Hips');
 return {local,model,parent,correction,legTop,ankle,headY,height:height||1.82,hips:bones.Hips.position.clone(),order};
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
  const maskSmooth=mask.clone();maskSmooth.minFilter=THREE.LinearMipmapLinearFilter;maskSmooth.magFilter=THREE.LinearFilter;maskSmooth.generateMipmaps=true;maskSmooth.anisotropy=anisotropy;
  const avatars={};
  for(const [id,a] of Object.entries(layout.avatars)){
   const [gltf,body,head,bodyNormal,headNormal,hair,hairMask]=await Promise.all([loader.loadAsync(BASE+a.model),tex(a.body),tex(a.head),tex(a.bodyNormal,false),tex(a.headNormal,false),tex(a.hair),tex(a.hairMask,false)]);
   addBindPositions(gltf.scene);
   avatars[id]={...a,gltf,body,head,bodyNormal,headNormal,hair,hairMask,bind:bindData(gltf.scene),skinColor:new THREE.Color(a.skin)};
  }
  assets={layout,mask,maskSmooth,avatars};return true;
 };
 assetsPromise=load().catch(error=>{console.warn('New player model unavailable, keeping the old one:',error);return false;});
 return assetsPromise;
}
export const humanBodiesDisabled=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('human')==='old';

const lum=c=>.2126*c.r+.7152*c.g+.0722*c.b;
const defaultSkins=['#bf8561','#976143','#deb18a','#74482f','#c89572','#e1ad88'];
/** Which Rocketbox player and skin tint suit the saved profile (the profile itself is not changed). */
export function humanLook(profile={},number=10,avatars={male_02:{skin:'#c18a6f',hairColor:'#372619'},male_03:{skin:'#a0674a',hairColor:'#16100c'}}){
 const target=new THREE.Color(profile.skin||defaultSkins[number%6]),ids=Object.keys(avatars);
 const dark=ids.find(id=>id.endsWith('03'))||ids.at(-1),light=ids.find(id=>id.endsWith('02'))||ids[0];
 const id=profile.hairStyle==='crest'||lum(target)<lum(new THREE.Color(avatars[dark].skin))*1.05?dark:light;
 // Mostly a brightness change, half of the hue difference: per-channel ratios alone turn light skin grey-green.
 // The reference is a median that includes shadowed skin, so the change is softened (power .6).
 const ratio=(want,have)=>{const l=(lum(want)/Math.max(lum(have),.005))**.6;return new THREE.Color(...['r','g','b'].map(k=>clamp(l*(1+((want[k]/Math.max(have[k],.005))/(lum(want)/Math.max(lum(have),.005))-1)*.45),.25,1.8)));};
 const tint=ratio(target,new THREE.Color(avatars[id].skin));
 const hairTint=ratio(new THREE.Color(profile.hair||'#211a15'),new THREE.Color(avatars[id].hairColor||'#2a1d14'));
 return {avatar:id,tint,hairTint};
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
/**
 * Footballer proportions on top of the Rocketbox body (measured at 1.82 m: hip joint 49% of height, head 1/7.4
 * of it, shoulder joints 78.5%). A footballer is closer to hips 52%, head 1/8, shoulders 81%, with a narrower
 * waist and fuller thighs and calves, so the legs are lengthened, the head scaled down and the shoulders
 * widened before the whole body is scaled to the profile height.
 */
export const ATHLETE={leg:1.075,head:.92,shoulders:1.04,morphs:{body_muscle:.2,body_chest:.15,body_waist:-.25,body_thigh:.25,body_calf:.15}};
export function bodyShape(m){
 const b=m.body,pct=(v,range)=>(v-100)/range,base=ATHLETE.morphs,out=(k,v)=>clamp((base[k]||0)+v,-1,1.5);
 return {morphs:{body_heavy:out('body_heavy',(m.width-1)/.22+m.soft*.35),body_muscle:out('body_muscle',m.muscle),body_chest:out('body_chest',pct(b.chest,25)),body_waist:out('body_waist',pct(b.waist,30)),
  body_thigh:out('body_thigh',pct(b.thigh,30)),body_calf:out('body_calf',pct(b.calf,30)),body_arms:out('body_arms',pct((b.upperArm+b.forearm)/2,30))},
  leg:ATHLETE.leg*b.legLength/100,arm:b.armLength/100,shoulders:ATHLETE.shoulders*b.shoulders/100,head:ATHLETE.head};
}
/** Standing height of the model (model units) after the proportion changes, head top to sole. */
export function shapedHeight(bind,shape){return bind.height+(shape.leg-1)*(bind.legTop-bind.ankle)-(1-shape.head)*(bind.height-bind.headY);}
const seeded=text=>{let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>((h=Math.imul(h^h>>>15,2246822507)^Math.imul(h^h>>>13,3266489909))>>>0)/4294967296;};
/** Face-shape morph weights from the saved face sliders; players who never sculpted a face get their own
 * stable variation (from uid or number) so a squad does not share one face. */
export function faceShape(profile={},number=10){
 const f=cleanFace(profile.face).shape,infl=(key,v=f[key])=>{const [,min,max]=FACE_SHAPE[key];return v>=1?(v-1)/(max-1):-(1-v)/(1-min);};
 const out={face_width:infl('width'),face_jaw:infl('jaw'),face_chin:clamp(infl('chin')+.6*infl('length'),-1,1),face_cheek:infl('cheek'),face_nose:infl('nose'),
  face_noseWidth:infl('noseWidth'),face_mouth:infl('mouth'),face_lips:infl('lips'),face_brow:infl('brow'),face_depth:infl('depth')};
 if(Object.values(f).every(v=>v===1)){const r=seeded(profile.uid??profile.name??number);for(const k of Object.keys(out))out[k]=(r()*2-1)*.7;}
 return out;
}
/** Sets morphs and bone lengths on one model; returns how much the hips rise for longer legs (model units). */
function applyBodyShape(bones,meshes,shape,bind,face={}){
 const morphs={...shape.morphs,...face};
 for(const mesh of meshes){const d=mesh.morphTargetDictionary;if(!d)continue;for(const [k,v] of Object.entries(morphs))if(k in d)mesh.morphTargetInfluences[d[k]]=v;}
 for(const side of ['Left','Right']){
  for(const n of ['Leg','Foot'])bones[side+n].position.multiplyScalar(shape.leg);
  for(const n of ['ForeArm','Hand'])bones[side+n].position.multiplyScalar(shape.arm);
  bones[side+'Arm'].position.multiplyScalar(shape.shoulders);
 }
 bones.Head.scale.setScalar(shape.head);
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
// Expressions (Rocketbox ARKit shapes, tools/human/rocketbox/01_convert.py): blinking, eyes on the ball,
// running effort, strike effort, celebration shouts and the camera celebration's wink and smile.
export const EXPRESSIONS=['expr_blinkL','expr_blinkR','expr_squint','expr_wide','expr_jawOpen','expr_funnel','expr_smile','expr_stretch','expr_browUp','expr_browDown','expr_cheekPuff','expr_press','expr_eyesLeft','expr_eyesRight','expr_eyesUp','expr_eyesDown'];
/**
 * Target expression weights for one frame. `look` is the ball direction in the head frame (yaw, pitch in
 * radians, positive = to the player's left / up) or null. Pure, so it can be tested.
 */
export function expressionTargets({time=0,seed=0,speed=0,action=null,state='',celebration=null,look=null}={}){
 const e=Object.fromEntries(EXPRESSIONS.map(k=>[k,0]));
 // Blinks every 2.5-5 s (per player), 0.16 s long, sometimes twice.
 const period=2.5+(seed%100)/40,local=(time+seed*.37)%period,blink=t=>Math.max(0,1-Math.abs(t-.08)/.08),w=Math.max(blink(local),seed%3===0?blink(local-.3):0);
 e.expr_blinkL=e.expr_blinkR=w;
 const run=clamp((speed-3)/5,0,1);
 e.expr_squint=.5*run;e.expr_stretch=.2*run;e.expr_jawOpen=run*(.18+.08*Math.sin(time*7+seed));e.expr_cheekPuff=.18*run*Math.max(0,Math.sin(time*3.5+seed));e.expr_browDown=.25*run;
 if(action&&Math.abs((action.elapsed??0)-(action.contactAt??0))<.28){e.expr_press=.85;e.expr_squint=Math.max(e.expr_squint,.6);e.expr_browDown=.55;e.expr_jawOpen=0;}
 if(state==='celebrate'){
  if(celebration==='camera'){e.expr_blinkL=1;e.expr_blinkR=0;e.expr_smile=.75;e.expr_squint=.35;e.expr_jawOpen=.05;e.expr_browDown=0;}
  else{const shout=.9+.1*Math.sin(time*9+seed);e.expr_jawOpen=shout;e.expr_browUp=.8;e.expr_stretch=.6;e.expr_wide=.45;e.expr_squint=0;e.expr_blinkL=e.expr_blinkR=0;}
 }else if(speed<.3&&!action)e.expr_smile=.12+.1*Math.max(0,Math.sin(time*.45+seed));
 if(look&&state!=='celebrate'){e.expr_eyesLeft=clamp(look[0]/.55,0,1);e.expr_eyesRight=clamp(-look[0]/.55,0,1);e.expr_eyesUp=clamp(look[1]/.35,0,1);e.expr_eyesDown=clamp(-look[1]/.35,0,1);}
 return e;
}
const face={q:new THREE.Quaternion(),bind:new THREE.Quaternion(),f:new THREE.Vector3(),u:new THREE.Vector3(),l:new THREE.Vector3(),v:new THREE.Vector3(),h:new THREE.Vector3()};
/** Ball direction in the head frame: [yaw to the player's left, pitch up], or null when far or behind. */
function lookAtBall(head,bindHead,ball){
 if(!ball)return null;head.getWorldQuaternion(face.q).multiply(face.bind.copy(bindHead).invert());head.getWorldPosition(face.h);
 face.v.set(ball.x,ball.y,ball.z).sub(face.h);const d=face.v.length();if(d>35||d<.2)return null;
 face.f.set(0,0,1).applyQuaternion(face.q);face.u.set(0,1,0).applyQuaternion(face.q);face.l.set(1,0,0).applyQuaternion(face.q);
 const fwd=face.v.dot(face.f);if(fwd<=0)return null;return [Math.atan2(face.v.dot(face.l),fwd),Math.atan2(face.v.dot(face.u),fwd)];
}
function attach(rig){
 if(rig.human||rig.disposed)return;const look=rig.look||(rig.look={team:0,number:10,keeper:false,profile:{}}),m=rig.bodyMetrics;
 const {avatar:id,tint,hairTint}=humanLook(look.profile,look.number,assets.avatars),a=assets.avatars[id],bind=a.bind;
 const root=clone(a.gltf.scene),bones={},meshes=[];root.traverse(o=>{if(o.isBone)bones[o.name]=o;if(o.isSkinnedMesh)meshes.push(o);});
 const decalCanvas=document.createElement('canvas');decalCanvas.width=decalCanvas.height=512;
 const decals=new THREE.CanvasTexture(decalCanvas);decals.flipY=false;decals.colorSpace=THREE.SRGBColorSpace;decals.anisotropy=4;
 const materials={
  body:kitMaterial({map:a.body,normalMap:a.bodyNormal,mask:assets.mask,maskSmooth:assets.maskSmooth,layout:assets.layout},coloursFor(look),decals,tint),
  head:headMaterial({map:a.head,normalMap:a.headNormal,eyes:assets.layout.eyes,hairMask:a.hairMask},tint,hairTint),
  hair:a.hair&&new THREE.MeshStandardMaterial({map:a.hair,color:hairTint,alphaTest:.5,side:THREE.DoubleSide,roughness:.8})};
 for(const mesh of meshes){mesh.material=materials[mesh.material.name]||materials.body;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;}
 // Profile height, limb lengths and girth; the feet then reach the old rig's ankles by IK every frame.
 const shape=bodyShape(m),worldScale=m.height/shapedHeight(bind,shape),toModel=m.scale/worldScale;root.scale.setScalar(1/toModel);
 const hipsLift=applyBodyShape(bones,meshes,shape,bind,faceShape(look.profile,look.number));
 // Hide the old body (its bones keep updating) but keep the blob shadow.
 rig.hips.visible=false;for(const c of rig.root.children)if(c.isMesh&&c.geometry?.type!=='CircleGeometry')c.visible=false;
 rig.details=[];rig.lod=[];rig.root.add(root);
 const skeletons=new Set(meshes.map(mesh=>mesh.skeleton)),expr={values:{}},seed=[...String(look.profile.uid??look.profile.name??look.number)].reduce((h,c)=>(h*31+c.charCodeAt(0))%9973,look.number*7);
 rig.human={root,bones,meshes,materials,decals,decalCanvas,avatar:id,sync(){
  retarget(rig,bones,bind);
  // Faces only when the player is big enough on screen to read one.
  if(!rig.distant){const p=rig.animationPlayer||{},t=rig.animationTime||0;
   const target=expressionTargets({time:t,seed:seed,speed:rig.animationSpeed||0,action:p.action,state:rig.motionState,celebration:p.celebration,look:lookAtBall(bones.Head,bind.model.Head,rig.animationBall)});
   const k=1-Math.exp(-Math.min(.1,Math.max(0,t-(expr.time??t)))*18);expr.time=t;
   for(const [name,v] of Object.entries(target)){const now=expr.values[name]??0,next=name.startsWith('expr_blink')?v:now+(v-now)*(k||1);expr.values[name]=next;for(const mesh of meshes){const i=mesh.morphTargetDictionary?.[name];if(i!==undefined)mesh.morphTargetInfluences[i]=next;}}
  }
  bones.Hips.position.set(bind.hips.x+rig.hips.position.x*toModel,bind.hips.y+hipsLift+(rig.hips.position.y-m.hipY)*toModel,bind.hips.z+rig.hips.position.z*toModel);
  reachAnkles(rig,root,bones,m,bind,worldScale);
 },dispose(){live.delete(rig);root.removeFromParent();for(const mat of Object.values(materials))mat?.dispose();decals.dispose();rig.human.photoTexture?.dispose();for(const s of skeletons)s.dispose();}};
 decalsFor(rig);live.add(rig);rig.human.sync();
 // A saved photo face replaces the painted face (the texture is per player).
 const face=cleanFace(look.profile.face);
 if(face.enabled&&look.profile.faceTexture){const image=new Image();image.onload=()=>{if(rig.disposed||!rig.human)return;
  const t=new THREE.CanvasTexture(composePhotoHead(a.head.image,image));t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.wrapS=THREE.RepeatWrapping;
  materials.head.map=t;materials.head.needsUpdate=true;rig.human.photoTexture=t;};image.src=look.profile.faceTexture;}
}
