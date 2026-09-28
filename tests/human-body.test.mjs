import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register} from 'node:module';
import * as THREE from '../vendor/three.module.js';
import {fixture} from '../tools/human-fixture.mjs';
register('../tools/three-loader.mjs',import.meta.url);
const {JOINT_BONES,bindData,retarget,humanLook,bodyShape,reachAnkles,faceShape,ATHLETE,shapedHeight,expressionTargets,EXPRESSIONS}=await import('../src/human-body.js');
const {bodyMetrics,BODY_PRESETS}=await import('../src/body-shape.js');
const {kitColours,shirtName,DECALS,headToAtlas,photoWeight,composePhotoHead,FACE_OVAL}=await import('../src/human-kit.js');
const MODELS=['male_02','male_03'];
const hands=await import('../src/human-body.js'),{celebrationHands}=await import('../src/celebrations.js');

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

test('body sliders move the shape morphs away from the footballer base in the right direction',()=>{
 const base=bodyShape(bodyMetrics({}));for(const [k,v] of Object.entries(base.morphs))assert.ok(Math.abs(v-(ATHLETE.morphs[k]||0))<.2,`${k} ${v}`);
 assert.equal(base.leg,ATHLETE.leg);assert.equal(base.head,ATHLETE.head);
 const sturdy=bodyShape(bodyMetrics({body:BODY_PRESETS.sturdy.values})),slim=bodyShape(bodyMetrics({body:BODY_PRESETS.slim.values,weight:62}));
 assert.ok(sturdy.morphs.body_muscle>base.morphs.body_muscle+.4&&sturdy.morphs.body_chest>base.morphs.body_chest&&sturdy.morphs.body_thigh>base.morphs.body_thigh);
 assert.ok(slim.morphs.body_heavy<0&&slim.morphs.body_waist<base.morphs.body_waist&&slim.morphs.body_muscle<base.morphs.body_muscle);
 assert.ok(bodyShape(bodyMetrics({body:{legLength:108}})).leg>base.leg);
});

test('footballer proportions: hips above half the height, head about an eighth',()=>{
 for(const model of MODELS){const {scene}=glbSkeleton(model),bind=bindData(scene),shape=bodyShape(bodyMetrics({}));
  // Rocketbox top of head (kitBind is not available here): Head joint + 0.218 m.
  bind.height=bind.headY+.218;const h=shapedHeight(bind,shape),hip=bind.legTop+(shape.leg-1)*(bind.legTop-bind.ankle),head=(bind.height-bind.headY+.03)*shape.head;
  assert.ok(hip/h>.51&&hip/h<.54,`${model} hips ${hip/h}`);assert.ok(h/head>7.6&&h/head<8.6,`${model} heads ${h/head}`);}
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

test('visible wrists reach the contact rig after retargeting both human models',()=>{
 for(const model of MODELS)for(const height of [1.65,1.81,1.98]){
  const {scene,bones}=glbSkeleton(model),rig=fixture({height}),data=bindData(scene);
  scene.scale.setScalar(height/1.82/rig.bodyMetrics.scale);rig.root.add(scene);
  for(const arm of rig.arms){arm.upper.rotation.x=-1.2;arm.lower.rotation.x=-.8;}
  rig.root.updateMatrixWorld(true);retarget(rig,bones,data);
  const errors=()=>rig.arms.map((a,i)=>bones[(i===0?'Right':'Left')+'Hand'].getWorldPosition(new THREE.Vector3()).distanceTo(a.lower.localToWorld(new THREE.Vector3(0,-rig.bodyMetrics.handReach+.07,0))));
  const before=errors();hands.reachContactHands(rig,scene,bones);const after=errors();
  for(let i=0;i<2;i++)assert.ok(after[i]<.025&&after[i]<before[i],`${model} ${height} side ${i}: ${before[i]} -> ${after[i]}`);
 }
});

test('photo faces land on the head texture landmarks and stay inside the face oval',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} vs ${b}`);
 // Eyes, nose, mouth and chin of the head texture read the same landmarks of the editor atlas.
 for(const [hv,av] of [[.283,.44],[.342,.59],[.40,.775],[.483,.92]])near(headToAtlas(.5,hv)[1],av);
 near(headToAtlas(.571,.3)[0],.552);near(headToAtlas(.429,.3)[0],.448);
 assert.ok(photoWeight(.5,.36)>.9,'full photo in the middle of the face');
 for(const [u,v] of [[.5,.1],[.2,.33],[.8,.33],[.5,.6]])assert.equal(photoWeight(u,v),0,`${u},${v}`);
});

test('face shapes follow the sliders and default faces differ per player',()=>{
 const f=faceShape({face:{shape:{width:1.2,nose:.6}}},3);assert.ok(Math.abs(f.face_width-1)<1e-9&&Math.abs(f.face_nose+1)<1e-9&&f.face_jaw===0);
 const a=faceShape({uid:'a'},1),b=faceShape({uid:'b'},1);assert.notDeepEqual(a,b);assert.deepEqual(a,faceShape({uid:'a'},1));
 for(const v of Object.values(a))assert.ok(Math.abs(v)<=.7);
});

test('expressions: blinks, running effort, strike effort, shouting and the camera grin',()=>{
 const within=(e)=>{for(const [k,v] of Object.entries(e))assert.ok(v>=0&&v<=1,`${k} ${v}`);};
 // Blinks come and go (0.16 s every 2.5-5 s).
 let closed=0;for(let t=0;t<10;t+=.01){const e=expressionTargets({time:t,seed:5});within(e);if(e.expr_blinkL>.5)closed++;}assert.ok(closed>2&&closed<60,`${closed}`);
 const run=expressionTargets({time:1,seed:5,speed:8}),stand=expressionTargets({time:1,seed:5,speed:0});assert.ok(run.expr_squint>stand.expr_squint&&run.expr_jawOpen>stand.expr_jawOpen);
 const kick=expressionTargets({time:1,seed:5,speed:5,action:{elapsed:.3,contactAt:.32}});assert.ok(kick.expr_press>.5&&kick.expr_jawOpen===0);
 const shout=expressionTargets({time:1,seed:5,state:'celebrate'});assert.ok(shout.expr_jawOpen>.7&&shout.expr_browUp>.5);
 const camera=expressionTargets({time:1,seed:5,state:'celebrate',celebration:'camera'});assert.ok(camera.expr_grin===1&&camera.expr_jawOpen>0&&camera.expr_blinkL<.5&&camera.expr_blinkR<.5);
 const left=expressionTargets({look:[.4,-.2]});assert.ok(left.expr_eyesLeft>.5&&left.expr_eyesRight===0&&left.expr_eyesDown>.3);
 // Every expression the game drives exists in both models.
 for(const model of MODELS){const b=fs.readFileSync(new URL(`../assets/human/rocketbox/${model}.glb`,import.meta.url)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());for(const k of EXPRESSIONS)assert.ok(j.meshes[0].extras.targetNames.includes(k),`${model} ${k}`);}
});

test('hair style and beard come from the profile, with a stable beard for players who never chose one',()=>{
 assert.equal(humanLook({hairStyle:'bald'},3).hairStyle,2);assert.equal(humanLook({hairStyle:'crop'},3).hairStyle,1);assert.equal(humanLook({hairStyle:'short'},3).hairStyle,0);
 assert.equal(humanLook({beard:'beard'},3).beard,2);assert.equal(humanLook({beard:'none'},3).beard,0);
 assert.equal(humanLook({uid:'x1'},4).beard,humanLook({uid:'x1'},4).beard);
 const counts=[0,0,0];for(let i=0;i<200;i++)counts[humanLook({uid:'p'+i},i).beard]++;assert.ok(counts.every(c=>c>20),JSON.stringify(counts));
});

test('fingers: every finger bone exists, relaxed hands curl towards the palm, sprinting closes them more',()=>{
 const {FINGERS,handPose,poseHands}=hands;
 for(const model of MODELS){const {scene,bones}=glbSkeleton(model),data=bindData(scene);assert.ok(data.hands,model);
  for(const side of ['Left','Right'])for(const f of FINGERS)for(const s of [1,2,3])assert.ok(bones[side+'Hand'+f+s],`${model} ${side}${f}${s}`);
  // Fingertip (third segment joint) moves along the palm normal when the hand closes.
  const tip=()=>bones.RightHandIndex3.getWorldPosition(new THREE.Vector3()),hand=()=>bones.RightHand.getWorldPosition(new THREE.Vector3());
  scene.updateMatrixWorld(true);const straight=tip().sub(hand()).dot(data.hands.Right.P);
  poseHands(scene,bones,data,{speed:0});scene.updateMatrixWorld(true);const relaxed=tip().sub(hand()).dot(data.hands.Right.P);
  for(const n of data.order)bones[n].quaternion.copy(data.local[n]);poseHands(scene,bones,data,{speed:8});scene.updateMatrixWorld(true);const sprint=tip().sub(hand()).dot(data.hands.Right.P);
  assert.ok(relaxed>straight+.005&&sprint>relaxed,`${model} ${straight} ${relaxed} ${sprint}`);
 }
 const keeper=handPose({keeper:true}),field=handPose({});assert.ok(keeper.curl.every((c,i)=>c<field.curl[i]));
});

test('camera celebration: hands come up after the run-in, the right index finger clicks twice',()=>{
 const at=t=>celebrationHands({celebration:'camera',celebrationStart:0},t);
 assert.equal(at(1).weight,0);assert.equal(at(2.2).weight,1);assert.equal(at(6).weight,1);assert.equal(celebrationHands({celebration:'c12-1'},3),null);
 let clicks=0,was=false;for(let t=0;t<6;t+=.01){const on=at(t).click>.5;if(on&&!was)clicks++;was=on;}assert.equal(clicks,2);
 const pose=hands.handPose({camera:{weight:1,click:0},side:'Left'});assert.deepEqual(pose.curl.slice(0,2),[0,0]);assert.ok(pose.curl.slice(2).every(c=>c===1)&&pose.l===1);
});

test('camera frame: index knuckles on the frame corners in front of the eyes, fingers along the edges, thumbs square',()=>{
 const {CAMERA_FRAME:F,poseHands}=hands;
 for(const model of MODELS){const {scene,bones}=glbSkeleton(model),rig=fixture({}),data=bindData(scene),m=rig.bodyMetrics;scene.scale.setScalar(1.81/1.82/m.scale);rig.root.add(scene);
  for(const yaw of [0,2.4]){rig.root.rotation.y=yaw;rig.root.updateMatrixWorld(true);retarget(rig,bones,data);poseHands(scene,bones,data,{state:'celebrate',camera:{weight:1,click:0}});scene.updateMatrixWorld(true);
   const head=bones.Head.getWorldQuaternion(new THREE.Quaternion()).multiply(data.model.Head.clone().invert()),eye=data.eye.clone().applyMatrix4(bones.Head.matrixWorld);
   for(const [side,sx,sy] of [['Right',-1,1],['Left',1,-1]]){
    const want=new THREE.Vector3(F.centre[0]+sx*F.half[0],F.centre[1]+sy*F.half[1],F.distance).applyQuaternion(head).add(eye),at=n=>bones[side+n].getWorldPosition(new THREE.Vector3());
    assert.ok(at('HandIndex1').distanceTo(want)<.015,`${model} ${side} ${at('HandIndex1').distanceTo(want)}`);
    const index=at('HandIndex3').sub(at('HandIndex1')).normalize(),thumb=at('HandThumb3').sub(at('HandThumb2')).normalize();
    assert.ok(index.dot(new THREE.Vector3(...F[side].finger).applyQuaternion(head))>.85,`${model} ${side} index`);
    assert.ok(thumb.dot(new THREE.Vector3(0,-sy,0).applyQuaternion(head))>.6,`${model} ${side} thumb ${thumb.dot(new THREE.Vector3(0,-sy,0).applyQuaternion(head))}`);
   }}
 }
});

test('beard choice is saved, and legacy or unknown values fall back to the per-player pick',async()=>{
 const {cleanProfile}=await import('../src/squads.js');
 assert.equal(cleanProfile({beard:'stubble'}).beard,'stubble');assert.equal(cleanProfile({}).beard,'auto');assert.equal(cleanProfile({beard:'<b>'}).beard,'auto');
 assert.equal(humanLook({beard:'none'},3).beard,0);assert.equal(humanLook({beard:'beard'},3).beard,2);
 assert.equal(humanLook({beard:'auto',uid:'x'},3).beard,humanLook({uid:'x'},3).beard);
});

test('photo mouth and nostrils are pulled onto the model mouth and nose, continuously',()=>{
 const near=(a,b,e=1e-3)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);
 near(headToAtlas(.545,.40)[0],.556);near(headToAtlas(.455,.40)[0],.444);near(headToAtlas(.531,.335)[0],.53);
 // No jumps across the edges of the warped areas.
 for(const v of [.32,.345,.37,.40,.44,.47])for(let d=0;d<.2;d+=.002)assert.ok(Math.abs(headToAtlas(.5+d+.002,v)[0]-headToAtlas(.5+d,v)[0])<.005,`${v} ${d}`);
 for(let v=.25;v<.5;v+=.002)assert.ok(Math.abs(headToAtlas(.53,v+.002)[0]-headToAtlas(.53,v)[0])<.005,`v ${v}`);
});

test('the triangle-warp face oval is a real, closed MediaPipe landmark loop and composePhotoHead still accepts the legacy 2-argument call',()=>{
 assert.equal(FACE_OVAL.length,36);
 for(const i of FACE_OVAL)assert.ok(Number.isInteger(i)&&i>=0&&i<468,i);
 assert.equal(new Set(FACE_OVAL).size,FACE_OVAL.length,'no repeated landmark in the loop');
 // Only the DOM-free part is checked here (no faceUV/calibration/canonical -> legacy path); the actual pixel
 // output needs a canvas (browser, see reports/human-v2 before/after screenshots).
 assert.equal(composePhotoHead.length,2);
});
