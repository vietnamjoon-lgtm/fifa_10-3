import {createHumanHead} from './human-head.js';
import {configureBodyRig} from './body-rig.js';
import {createAnatomicalBody} from './anatomical-player.js';
import {stabilizeHands} from './hand-contact.js';
import {InertialJoint} from './inertial-motion.js';
import {locomotionCadence} from './motion-planner.js';
import {stabilizeFeet} from './foot-plant.js';
import {sampleMotion} from './motion.js';
import * as THREE from 'three';
import {mergeMeshes,addDistantGeometry} from './geometry.js';
const sphere=new THREE.SphereGeometry(1,16,12), cylinder=new THREE.CylinderGeometry(1,1,1,12);
const kitMats=[new THREE.MeshStandardMaterial({color:0xd7edc0,roughness:.87}),new THREE.MeshStandardMaterial({color:0xdf593e,roughness:.85})];
const shortMats=[new THREE.MeshStandardMaterial({color:0x102c21,roughness:.86}),new THREE.MeshStandardMaterial({color:0x192236,roughness:.86})];
const socksMats=[new THREE.MeshStandardMaterial({color:0xc6dbb4,roughness:.92}),new THREE.MeshStandardMaterial({color:0xc43d2a,roughness:.92})];
const black=new THREE.MeshStandardMaterial({color:0x10150f,roughness:.72});
const white=new THREE.MeshStandardMaterial({color:0xefece0,roughness:.7});
const bootMats=[new THREE.MeshStandardMaterial({color:0xd3ff47,roughness:.38}),new THREE.MeshStandardMaterial({color:0xf18e54,roughness:.42}),new THREE.MeshStandardMaterial({color:0xdce7f0,roughness:.4})];
const gkMat=new THREE.MeshStandardMaterial({color:0xecc842,roughness:.84});
let fabricReady=false;
function addFabric(){if(fabricReady)return;fabricReady=true;const c=document.createElement('canvas');c.width=c.height=128;const cx=c.getContext('2d');cx.fillStyle='#999';cx.fillRect(0,0,128,128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){cx.fillStyle=(x+y)%2?'#8c8c8c':'#a4a4a4';cx.fillRect(x,y,1,1);}const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,5);for(const m of [...kitMats,...shortMats,...socksMats,gkMat]){m.bumpMap=texture;m.bumpScale=.0022;}}
function ellipsoid(parent,mat,x,y,z,sx,sy,sz){const m=new THREE.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
function tube(parent,mat,x,y,z,r1,r2,length){const points=[];for(let i=0;i<=8;i++){const t=i/8,bulge=1+Math.sin(t*Math.PI)*.075;points.push(new THREE.Vector2((r2+(r1-r2)*t)*bulge,(t-.5)*length));}const m=new THREE.Mesh(new THREE.LatheGeometry(points,18),mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function textMat(text,color,bg='transparent',size=130) {const c=document.createElement('canvas');c.width=256;c.height=256;const cx=c.getContext('2d');cx.clearRect(0,0,256,256);if(bg!=='transparent'){cx.fillStyle=bg;cx.fillRect(0,0,256,256);}cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.font=`900 ${size}px Arial`;cx.fillText(text,128,134);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.9,side:THREE.DoubleSide,depthWrite:false});}
function label(parent,mat,x,y,z,w,h,ry=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);m.rotation.y=ry;parent.add(m);return m;}
export function createPlayer(team=0,number=10,keeper=false,profile={}){
  addFabric();
  const root=new THREE.Group(),hips=new THREE.Bone();root.add(hips);hips.position.y=.91;
  const skinColors=[0xbf8561,0x976143,0xdeb18a,0x74482f,0xc89572,0xe1ad88];
  const skin=new THREE.MeshStandardMaterial({color:profile.skin||skinColors[number%skinColors.length],roughness:.67});
  const kit=keeper?gkMat:kitMats[team],shorts=shortMats[team],sock=socksMats[team];
  const torso=new THREE.Bone();hips.add(torso);
  // Woven hem, collar, chest sponsor and raised club crest.
  label(torso,textMat('APEX',team===0?'#173b27':'#fff',undefined,70),0,.34,.190,.30,.115);
  label(torso,textMat('A',team===0?'#153b24':'#f5e9d5',undefined,120),.12,.46,.16,.065,.075);
  label(torso,textMat(String(number),team===0?'#183b27':'#fff'),0,.31,-.190,.34,.34,Math.PI);
  label(torso,textMat(profile.name||(team===0?'APEX FC':'VOLT UNITED'),team===0?'#183b27':'#fff',undefined,41),0,.47,-.16,.31,.09,Math.PI);
  const head=new THREE.Bone();head.position.set(0,.675,.005);torso.add(head);
  const human=createHumanHead(profile,number);head.add(human.group);const face=human.face,eyelids=human.eyes;
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const arm=new THREE.Bone();arm.position.set(s*.222,.447,0);torso.add(arm);arm.rotation.z=s*.12;
    const forearm=new THREE.Bone();forearm.position.y=-.255;arm.add(forearm);forearm.rotation.x=-.12;
    arms.push({upper:arm,lower:forearm});
    const leg=new THREE.Bone();leg.position.set(s*.112,-.075,0);hips.add(leg);
    const shin=new THREE.Bone();shin.position.y=-.35;leg.add(shin);
    const ankle=new THREE.Bone();ankle.position.y=-.4;shin.add(ankle);
    const boot=ellipsoid(ankle,profile.boots?new THREE.MeshStandardMaterial({color:profile.boots,roughness:.4}):bootMats[number%3],0,-.027,.056,.064,.049,.132);
    ellipsoid(ankle,black,0,-.059,.055,.066,.015,.13);
    for(let j=0;j<3;j++){const lace=ellipsoid(ankle,white,0,.014,.058+j*.023,.043,.007,.006);lace.rotation.z=.12;}
    legs.push({upper:leg,lower:shin,foot:ankle});
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.46,24),new THREE.MeshBasicMaterial({color:0x071407,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;root.add(shadow);
  // Replace rigid limb fragments with continuous weighted skin. Hands and boots stay on bones.
  for(const part of [...arms,...legs]){for(const child of [...part.upper.children])if(child.isMesh)child.removeFromParent();for(const child of [...part.lower.children])if(child.isMesh&&!(arms.includes(part)&&child.position.y<-.18))child.removeFromParent();}
  // Static non-deforming detail is batched by material.
  const lod=[{near:[human.near],far:human.far}];
  for(const group of [head,torso,...arms.flatMap(a=>[a.upper,a.lower]),...legs.flatMap(l=>[l.upper,l.lower,l.foot])]){mergeMeshes(group);const level=addDistantGeometry(group,group===head);if(level)lod.push(level);}
  const details=torso.children.filter(m=>m.isMesh&&m.material.transparent);
  const rig={ready:human.ready,disposeHead:human.dispose,animateFace:human.animate,details,root,hips,torso,head,arms,legs,lod,face,eyelids,distant:false,phase:number,kickTime:0,tackle:0};
  // Keep labels and boots; replace primitive torso, neck, hands and limbs with anatomy.
  for(const parent of [hips,torso,...arms.flatMap(a=>[a.upper,a.lower])])for(const child of [...parent.children])if(child.isMesh&&!child.material.transparent){child.removeFromParent();child.geometry.dispose();}
  configureBodyRig(rig,profile);
  const body=createAnatomicalBody(rig,{skin:skin.color,kit:kit.color,shorts:shorts.color,sock:sock.color});rig.anatomy=body;
  return rig;
}
export function disposePlayerRig(rig){rig.disposed=true;rig.disposeHead?.();const sharedGeometry=new Set([sphere,cylinder]),sharedMaterial=new Set([...kitMats,...shortMats,...socksMats,...bootMats,black,white,gkMat]),geometries=new Set(),materials=new Set(),skeletons=new Set();rig.root.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry))geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!sharedMaterial.has(m))materials.add(m);if(o.skeleton)skeletons.add(o.skeleton);});for(const g of geometries)g.dispose();for(const m of materials){for(const key of ['map','bumpMap','normalMap'])if(!m[key]?.userData.shared)m[key]?.dispose();m.dispose();}for(const s of skeletons)s.dispose();rig.root.removeFromParent();}
const poseEuler=new THREE.Euler(),poseQuaternion=new THREE.Quaternion();
export function animatePlayer(rig,speed,dt,time,celebrate=false,player=null,ball=null){
 const p=player||{x:rig.root.position.x,z:rig.root.position.z,vx:0,vz:speed,yaw:0},history=rig.motionHistory||{yaw:p.yaw||0,speed};
 const rawTurn=p.motionTurn??Math.atan2(Math.sin((p.yaw||0)-history.yaw),Math.cos((p.yaw||0)-history.yaw))/Math.max(dt,.001);
 const rawAcceleration=p.motionAcceleration??(speed-history.speed)/Math.max(dt,.001);const smoothing=1-Math.exp(-Math.min(dt,.05)*14),turn=(history.turn||0)+(rawTurn-(history.turn||0))*smoothing,acceleration=(history.acceleration||0)+(rawAcceleration-(history.acceleration||0))*smoothing;rig.motionHistory={yaw:p.yaw||0,speed,turn,acceleration};
 if(rig.motionPhaseOverride!==undefined)rig.phase=rig.motionPhaseOverride;else if(p.motionPhase!==undefined)rig.phase=p.motionPhase;else rig.phase+=dt*locomotionCadence(speed,p.motionStyle,p);
 const pose=sampleMotion(p,rig.phase,time,ball,celebrate,{turn,acceleration});rig.motionState=pose.state;
 const impact=p.action&&!p.action.aerial&&Math.abs(p.action.elapsed-p.action.contactAt)<.055;
 const weight=1-Math.exp(-dt*(p.action?28:18)),blend=(a,b)=>a+(b-a)*weight;
 const rotation=(joint,angles)=>{poseEuler.set(...angles);poseQuaternion.setFromEuler(poseEuler);const state=joint.userData.inertial||(joint.userData.inertial=new InertialJoint());joint.quaternion.copy(state.sample(poseQuaternion,p.action?.id!==undefined?'action-'+p.action.id:pose.state,dt));};
 rig.hips.position.y=blend(rig.hips.position.y,pose.hipY+(rig.bodyMetrics?.hipOffset||0));rig.root.position.y=blend(rig.root.position.y,pose.rootY);rig.root.rotation.z=blend(rig.root.rotation.z,pose.rootRoll);
 rotation(rig.hips,pose.hips);rotation(rig.torso,pose.torso);rotation(rig.head,pose.head);
 for(let i=0;i<2;i++){rotation(rig.legs[i].upper,pose.legs[i].upper);rotation(rig.legs[i].lower,pose.legs[i].lower);rotation(rig.legs[i].foot,pose.feet[i]);rotation(rig.arms[i].upper,pose.arms[i].upper);rotation(rig.arms[i].lower,pose.arms[i].lower);}
 stabilizeFeet(rig,{...p,sampleTime:time},pose,dt);stabilizeHands(rig,p,time);
 const blink=Math.max(0,1-Math.abs(((time+(p.id||0)*.31)%4.1)-3.9)/.075);for(const eye of rig.eyelids)eye.scale.y=(eye.userData.baseEyeY||.006)*(1-blink*.88);
 if(rig.animateFace)rig.animateFace(time,speed,celebrate,pose.head[1]);else rig.face.morphTargetInfluences[0]=celebrate?.8:Math.min(.45,speed*.045);
}
