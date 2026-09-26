import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ADDONS=['loaders/GLTFLoader.js','loaders/KTX2Loader.js','utils/SkeletonUtils.js','utils/BufferGeometryUtils.js','utils/WorkerPool.js','libs/ktx-parse.module.js','libs/zstddec.module.js','libs/meshopt_decoder.module.js','libs/basis/basis_transcoder.js','libs/basis/basis_transcoder.wasm','math/ColorSpaces.js'];
test('three r180 addons are vendored next to the core build',()=>{
 for(const f of ADDONS)assert.ok(fs.existsSync('vendor/three-addons/'+f),f);
 assert.match(fs.readFileSync('vendor/three.core.js','utf8'),/REVISION = '180'/);
 assert.match(fs.readFileSync('vendor/three-addons/VERSION','utf8'),/^0\.180\.0/);
});

const BODY22=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
test('bone maps only target the 22 body bones and cover every source joint',()=>{
 const style=read('tools/human/maps/100style.json');
 const src100=['Hips','Chest','Chest2','Chest3','Chest4','Neck','Head','RightCollar','RightShoulder','RightElbow','RightWrist','LeftCollar','LeftShoulder','LeftElbow','LeftWrist','RightHip','RightKnee','RightAnkle','RightToe','LeftHip','LeftKnee','LeftAnkle','LeftToe'];
 assert.deepEqual(Object.keys(style.bones).sort(),src100.sort());
 for(const m of [style,read('tools/human/maps/cmu.json')])for(const v of Object.values(m.bones))if(v)assert.ok(BODY22.includes(v.target),v.target);
 const g=read('tools/human/maps/game13.json');
 for(const j of Object.values(g.joints))for(const part of j.bones)assert.ok(BODY22.includes(part.bone),part.bone);
 for(const j of Object.values(g.joints))assert.ok(Math.abs(j.bones.reduce((s,b)=>s+b.share,0)-1)<1e-9);
});
test('game13 records which side index 0 is and the convention it relies on',()=>{
 const g=read('tools/human/maps/game13.json');
 assert.equal(g.sides.legs0,'Right');assert.equal(g.sides.arms0,'Right');
 assert.ok(g.joints['legs0.upper'].read.startsWith('Right')&&g.joints['legs1.upper'].read.startsWith('Left'));
 assert.match(g.sides.convention,/sides\.js/);assert.match(g.sides.requires,/PR #34/);
});
test('humans.json: 3-day scope, CC0 skins and hair that exist in the asset pack',()=>{
 const c=read('tools/human/config/humans.json'),lic=read('reports/human-v2/assets-licenses.json');
 assert.deepEqual(Object.keys(c.bodies),['standard']);
 const b=c.bodies.standard;assert.ok(b.heightRange[0]>=1.70&&b.heightRange[1]<=1.95);assert.ok(b.macro.weight<=0.35&&b.macro.muscle>=0.5);
 assert.equal(c.faces.length,3);assert.deepEqual(c.skinTones.map(t=>t.id),['light','brown','dark']);
 const cc0=kind=>new Set(lic[kind].filter(a=>a.license==='CC0').map(a=>a.name)),skins=cc0('skins'),hair=cc0('hair');
 for(const t of c.skinTones){assert.ok(skins.has(t.base),t.base);if(t.mix)assert.ok(skins.has(t.mix.with),t.mix.with);}
 assert.deepEqual(c.hair.short,['short01','afro01']);for(const h of c.hair.short)assert.ok(hair.has(h),h);
 assert.deepEqual(Object.keys(c.kits),['field_short']);assert.deepEqual(c.lod.player,{maxTriangles:8000,bones:22});
});
test('rest skeleton: 22 body bones, 1.83 m, left leg on +x in glTF axes',()=>{
 const r=read('assets/human/rest-skeleton.json');
 assert.deepEqual(Object.keys(r.bones).sort(),[...BODY22].sort());
 assert.equal(r.bones.Hips.parent,null);assert.equal(r.bones.LeftLeg.parent,'LeftUpLeg');
 assert.ok(r.bones.LeftUpLeg.head[0]>0&&r.bones.RightUpLeg.head[0]<0);
 assert.ok(r.bones.Head.head[1]>1.5&&r.bones.Head.head[1]<1.75);
});
test('player.glb: 22 bones, under 8,000 triangles with either hair, compressed assets under 1.5 MB',()=>{
 const m=read('assets/human/player.json'),s=read('assets/human/sizes.json');
 assert.equal(m.bones,22);
 const base=['Body','Eyes','Eyebrows','Kit_shirt','Kit_shorts','Kit_socks','Kit_boots'].reduce((a,n)=>a+m.triangles[n],0);
 for(const h of ['Hair_short01','Hair_afro01'])assert.ok(base+m.triangles[h]<=m.budget.maxTriangles,h);
 assert.deepEqual(m.morphs,['face_f1','face_f2','face_f3']);
 assert.ok(fs.existsSync('assets/human/player.glb'));for(const f of Object.keys(s.textures))assert.ok(fs.existsSync('assets/human/'+f),f);
 assert.ok(s.total<1.5e6,'total '+s.total);
});
