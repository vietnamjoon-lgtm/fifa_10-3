import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import {fixture} from '../tools/human-fixture.mjs';
register('../tools/three-loader.mjs',import.meta.url);
const {JOINT_BONES,bindData,retarget,humanLook,bodyShape,reachAnkles}=await import('../src/human-body.js');
const {bodyMetrics,BODY_PRESETS}=await import('../src/body-shape.js');
const {kitColours,shirtName,DECALS}=await import('../src/human-kit.js');
const MODELS=['male_02','male_03'];

// The 22-bone skeleton straight from a model's node table (no meshes needed).
function glbSkeleton(model='male_02'){
 const b=fs.readFileSync(new URL(`../assets/human/rocketbox/${model}.glb`,import.meta.url)),json=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 const objects=json.nodes.map(n=>{const o=n.skin===undefined&&n.mesh===undefined&&n.name!=='Rig'&&n.name!=='Player'?new THREE.Bone():new THREE.Group();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);return o;});
 json.nodes.forEach((n,i)=>{for(const c of n.children||[])objects[i].add(objects[c]);});
 const scene=new THREE.Group();for(const i of json.scenes[0].nodes)scene.add(objects[i]);
 const bones={};scene.traverse(o=>{if(o.isBone)bones[o.name]=o;});return {scene,bones};
}
const old=rig=>({upLeg:rig.legs[0].upper,leg:rig.legs[0].lower,arm:rig.arms[0].upper,foreArm:rig.arms[0].lower});
const worldDir=(o,axis)=>axis.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).normalize();
const pose=(rig,seed)=>{let s=seed;const r=()=>((s=(s*16807)%2147483647)/2147483647-.5)*1.6;for(const [path] of JOINT_BONES){const [part,key]=path.split('.'),m=/^(arms|legs)(\d)$/.exec(part),j=key?rig[m[1]][+m[2]][key]:rig[part];j.quaternion.setFromEuler(new THREE.Euler(r(),r()*.5,r()*.5));}rig.root.updateMatrixWorld(true);};

test('every mapped bone exists in both models and follows game13.json',()=>{
 for(const model of MODELS){const {bones}=glbSkeleton(model),map=JSON.parse(fs.readFileSync(new URL('../tools/human/maps/game13.json',import.meta.url))).joints;
 for(const [path,,list] of JOINT_BONES){assert.deepEqual(list.map(([n])=>n),map[path].bones.map(b=>b.bone),path);for(const [n] of list)assert.ok(bones[n],n);
  assert.equal(list.at(-1)[1],1);}
 // Index 0 is the player's right side in both rigs (x<0 when facing +z), and the model faces +z.
 assert.ok(bones.RightUpLeg.getWorldPosition(new THREE.Vector3()).x<0);
 assert.ok(bones.LeftToeBase.getWorldPosition(new THREE.Vector3()).z>bones.LeftFoot.getWorldPosition(new THREE.Vector3()).z);}
});

const childDir=b=>{const c=b.children.find(o=>o.isBone);return c.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize();};
test('retarget puts thighs, shins and arms on the old limb directions in any pose',()=>{
 for(const model of MODELS){const {scene,bones}=glbSkeleton(model),data=bindData(scene),rig=fixture({});rig.root.add(scene);
 for(const seed of [3,11,29,57]){
  pose(rig,seed);retarget(rig,bones,data);scene.updateMatrixWorld(true);
  const o=old(rig);
  for(const [name,joint] of [['RightUpLeg',o.upLeg],['RightLeg',o.leg],['RightArm',o.arm],['RightForeArm',o.foreArm],['LeftUpLeg',rig.legs[1].upper],['LeftLeg',rig.legs[1].lower]]){
   const angle=childDir(bones[name]).angleTo(worldDir(joint,new THREE.Vector3(0,-1,0)));
   assert.ok(angle<1e-3,`${name} seed ${seed}: ${angle}`);
  }
  // Feet, chest and head keep their bind offset to the old joint.
  for(const [name,joint] of [['RightFoot',rig.legs[0].foot],['Spine2',rig.torso],['Head',rig.head],['Hips',rig.hips]]){
   const q=joint.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bones[name].getWorldQuaternion(new THREE.Quaternion()));
   assert.ok(q.angleTo(data.model[name])<1e-3,`${name} seed ${seed}: ${q.angleTo(data.model[name])}`);
  }
 }}
});

test('the model leg is as long as the old rig leg once scaled to the same leg top',()=>{
 for(const model of MODELS){const {scene,bones}=glbSkeleton(model),data=bindData(scene),rig=fixture({}),m=rig.bodyMetrics;
 const worldScale=(m.hipY-.075)*m.scale/data.legTop,p=o=>o.getWorldPosition(new THREE.Vector3());scene.updateMatrixWorld(true);rig.root.updateMatrixWorld(true);
 const newLeg=p(bones.RightUpLeg).distanceTo(p(bones.RightLeg))+p(bones.RightLeg).distanceTo(p(bones.RightFoot)),oldLeg=(m.upperLeg+m.lowerLeg)*m.scale;
 assert.ok(Math.abs(newLeg*worldScale-oldLeg)/oldLeg<.06,`${model} ${newLeg*worldScale} vs ${oldLeg}`);}
});

test('looks come from the saved profile without changing it',()=>{
 const profile={skin:'#74482f',hairStyle:'crest',uid:'a'},copy=JSON.stringify(profile);
 assert.equal(humanLook(profile,7).avatar,'male_03');assert.equal(humanLook({skin:'#e1ad88'},3).avatar,'male_02');
 const t=humanLook({skin:'#e1ad88'},3).tint;assert.ok(t.r>1&&t.g>1,'lighter skin brightens the tint');
 assert.equal(JSON.stringify(profile),copy);
});

test('kit colours follow the club and keepers wear their own shirt and gloves',()=>{
 const team={kit:{shirt:'#d71920',second:'#141414',pattern:2,sleeves:'#141414',shorts:'#141414',socks:'#141414',text:'#ffffff'},keeper:'#3fb8e8'};
 const c=kitColours(team,{boots:'#dce7f0'});assert.equal(c.shirt,'#d71920');assert.equal(c.trim,'#141414');assert.equal(c.pattern,2);assert.equal(c.gloves,null);
 const plain=kitColours({kit:{shirt:'#f4f4f2',second:'#F4F4F2',text:'#c8102e'}});assert.equal(plain.trim,'#c8102e','trim falls back to the text colour');
 const k=kitColours(team,{keeper:true});assert.equal(k.shirt,'#3fb8e8');assert.equal(k.pattern,0);assert.ok(k.gloves);
 assert.equal(shirtName('J. KANG'),'KANG');assert.equal(shirtName('Son Heung-min'),'HEUNG-MIN');
});

test('decal rectangles sit inside the texture and the kit mask marks every part',async()=>{
 const layout=JSON.parse(fs.readFileSync(new URL('../assets/human/rocketbox/rocketbox.json',import.meta.url)));
 for(const k of DECALS){const r=layout.decals[k];assert.ok(r&&r[0]>=0&&r[2]<=1&&r[1]>=0&&r[3]<=1&&r[0]<r[2]&&r[1]<r[3],k);}
 for(const [id,a] of Object.entries(layout.avatars))for(const f of [a.model,a.body,a.head,a.bodyNormal,a.headNormal,a.hair].filter(Boolean))assert.ok(fs.existsSync(new URL(`../assets/human/rocketbox/${f}`,import.meta.url)),`${id} ${f}`);
});

test('body sliders drive the shape morphs in the right direction and default to neutral',()=>{
 const base=bodyShape(bodyMetrics({}));for(const [k,v] of Object.entries(base.morphs))assert.ok(Math.abs(v)<.2,`${k} ${v}`);assert.equal(base.leg,1);
 const sturdy=bodyShape(bodyMetrics({body:BODY_PRESETS.sturdy.values})),slim=bodyShape(bodyMetrics({body:BODY_PRESETS.slim.values,weight:62}));
 assert.ok(sturdy.morphs.body_muscle>.4&&sturdy.morphs.body_chest>0&&sturdy.morphs.body_thigh>0);
 assert.ok(slim.morphs.body_heavy<0&&slim.morphs.body_waist<0&&slim.morphs.body_muscle<0);
 assert.ok(bodyShape(bodyMetrics({body:{legLength:108}})).leg>1);
});

test('ankle IK puts the model ankles on the old rig ankles',()=>{
 for(const model of MODELS){const {scene,bones}=glbSkeleton(model),rig=fixture({});
  // Positions for kitBind-free bind data (height is not used here).
  const data=bindData(scene),m=rig.bodyMetrics,worldScale=1.81/1.82;scene.scale.setScalar(worldScale/m.scale);rig.root.add(scene);
  for(const seed of [5,17]){pose(rig,seed);for(const leg of rig.legs)leg.upper.quaternion.setFromEuler(new THREE.Euler(-.6,0,0)),leg.lower.quaternion.setFromEuler(new THREE.Euler(1.1,0,0));
   // Reachable by construction: a bent knee (the model leg is a little shorter than the old rig's).
   rig.root.updateMatrixWorld(true);retarget(rig,bones,data);reachAnkles(rig,scene,bones,m,data,worldScale);
   const lift=data.ankle*worldScale-m.ankle*m.scale;
   rig.legs.forEach((leg,i)=>{const want=leg.foot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,lift,0).applyQuaternion(leg.foot.getWorldQuaternion(new THREE.Quaternion())));
    const got=bones[i===0?'RightFoot':'LeftFoot'].getWorldPosition(new THREE.Vector3());assert.ok(got.distanceTo(want)<.01,`${model} ${i} ${got.distanceTo(want)}`);});}
 }
});
