// Game connection for the MPFB player (assets/human/player.glb). The old 13-joint rig keeps running every
// motion, IK, contact and camera system unchanged but is hidden; after animatePlayer each frame its joint
// rotations are copied onto the new 22-bone skinned model (retarget in the rig root's space).
import * as THREE from 'three';
import {loadHumanAssets} from './human-lab/load.js';
import {createHuman,kitMaterials} from './human-lab/assemble.js';
import {TEAMS} from './config.js';
import {kitHooks} from './player.js';

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

const DOWN=new THREE.Vector3(0,-1,0),UP=new THREE.Vector3(0,1,0),identity=new THREE.Quaternion();
let assetsPromise=null,assets=null,bind=null;
const live=new Set();
kitHooks.add(()=>{for(const rig of live)dress(rig);});

/** Bind data shared by every clone: local and model-space rest rotations, limb corrections, leg-top height. */
export function bindData(scene){
 scene.updateMatrixWorld(true);const bones={};scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});
 const sceneInverse=new THREE.Quaternion(),model={},local={},parent={},correction={};scene.getWorldQuaternion(sceneInverse).invert();
 for(const [name,b] of Object.entries(bones)){local[name]=b.quaternion.clone();model[name]=sceneInverse.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));parent[name]=b.parent?.isBone?b.parent.name:null;}
 for(const [,,targets,align] of JOINT_BONES)for(const [name] of targets)correction[name]=align?new THREE.Quaternion().setFromUnitVectors(UP.clone().applyQuaternion(model[name]).normalize(),DOWN):identity.clone();
 const scenePosition=b=>scene.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
 const legTop=(scenePosition(bones.LeftUpLeg).y+scenePosition(bones.RightUpLeg).y)/2;
 // Order: every bone after its parent.
 const order=[];const visit=n=>{order.push(n);for(const c of bones[n].children)if(c.isBone)visit(c.name);};visit('Hips');
 return {local,model,parent,correction,legTop,hips:bones.Hips.position.clone(),order};
}

/** Starts loading player.glb once. Resolves false (old model stays) when loading fails. */
export function loadHumanBodies(renderer){
 if(!assetsPromise)assetsPromise=loadHumanAssets(renderer).then(a=>{assets=a;bind=bindData(a.gltf.scene);return true;}).catch(error=>{console.warn('New player model unavailable, keeping the old one:',error);return false;});
 return assetsPromise;
}
export const humanBodiesDisabled=()=>typeof location!=='undefined'&&new URLSearchParams(location.search).get('human')==='old';

const lum=hex=>{const c=new THREE.Color(hex);return .2126*c.r+.7152*c.g+.0722*c.b;};
/** Skin tone, face preset and hair from the saved profile (photo faces are not mapped yet). */
export function humanLook(profile={},number=10){
 const l=profile.skin?lum(profile.skin):[.36,.22,.5,.12,.4,.52][number%6];
 const skin=l>.33?'light':l>.17?'brown':'dark';
 const seed=[...String(profile.uid??profile.name??number)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,number);
 const hair=profile.hairStyle==='bald'?null:profile.hairStyle==='crest'&&skin!=='light'?'afro01':'short01';
 return {skin,face:['f1','f2','f3'][seed%3],hair};
}
const bootColors=['#d3ff47','#f18e54','#dce7f0'];
function kitFor(look){
 const team=TEAMS[look.team],k=team?.kit||{},keeper=look.keeper;
 return {shirt:keeper?(team?.keeper||'#ecc842'):k.shirt||(look.team?'#df593e':'#d7edc0'),shorts:k.shorts||'#102c21',socks:keeper?(team?.keeper||'#ecc842'):k.socks||'#c6dbb4',
  boots:look.profile.boots||bootColors[look.number%3],text:keeper?'#1b1b1b':k.text||(look.team===0?'#183b27':'#ffffff')};
}
function dress(rig){
 const h=rig.human;if(!h)return;const materials=kitMaterials(kitFor(rig.look),h.options.number,h.options.name);
 for(const [name,material] of Object.entries(materials)){const mesh=h.meshes[name];if(!mesh){material.map?.dispose();material.dispose();continue;}disposeMaterial(mesh.material);mesh.material=material;}
}
let shared=null;
function disposeMaterial(m){shared??=new Set(Object.values(assets.materials).flatMap(v=>v.isMaterial?[v]:Object.values(v)));if(!m||shared.has(m))return;m.map?.dispose();m.dispose();}

/** Replaces the rig's visible body with the new model once player.glb has loaded. */
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
function attach(rig){
 if(rig.human||rig.disposed)return;const look=rig.look||{team:0,number:10,keeper:false,profile:{}},m=rig.bodyMetrics;
 const options={...humanLook(look.profile,look.number),number:look.number,name:look.profile.name||TEAMS[look.team]?.name||'PLAYER',kit:kitFor(look)};
 const h=createHuman(assets,options);
 // Same leg-top height as the old rig, so its foot IK and contacts stay valid.
 const worldScale=(m.hipY-.075)*m.scale/bind.legTop,toModel=m.scale/worldScale;h.root.scale.setScalar(1/toModel);
 // Hide the old body (its bones keep updating) but keep the blob shadow.
 rig.hips.visible=false;for(const c of rig.root.children)if(c.isMesh&&c.geometry?.type!=='CircleGeometry')c.visible=false;
 rig.details=[];rig.lod=[];rig.root.add(h.root);
 const skeletons=new Set(Object.values(h.meshes).map(mesh=>mesh.skeleton));
 rig.human={...h,options,sync(){
  retarget(rig,h.bones,bind);
  h.bones.Hips.position.set(bind.hips.x+rig.hips.position.x*toModel,bind.hips.y+(rig.hips.position.y-m.hipY)*toModel,bind.hips.z+rig.hips.position.z*toModel);
 },dispose(){live.delete(rig);h.root.removeFromParent();for(const mesh of Object.values(h.meshes))disposeMaterial(mesh.material);for(const s of skeletons)s.dispose();}};
 live.add(rig);rig.human.sync();
}
