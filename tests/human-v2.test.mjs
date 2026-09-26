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
test('game13 records which side index 0 is, with evidence and every left/right conversion site',()=>{
 const g=read('tools/human/maps/game13.json');
 assert.equal(g.sides.legs0,'Right');assert.equal(g.sides.arms0,'Right');
 assert.ok(g.joints['legs0.upper'].read.startsWith('Right')&&g.joints['legs1.upper'].read.startsWith('Left'));
 const src=f=>fs.readFileSync(f,'utf8');
 for(const site of g.sides.conversion_sites){const [loc,...code]=site.split(' ');const [file,line]=loc.split(':');const expr=code[0];
  assert.ok(src(file).split('\n')[+line-1].includes(expr.slice(expr.indexOf('foot'))),site);}
 const count=['src/foot-plant.js','src/motion.js','src/skills.js'].reduce((n,f)=>n+(src(f).match(/foot==='left'\?[01]:[01]/g)||[]).length,0);
 assert.equal(count,g.sides.conversion_sites.length,'every conversion site is listed');
});
test('humans.json: footballer bodies, 8 faces, CC0 skins and hair that exist in the asset pack',()=>{
 const c=read('tools/human/config/humans.json'),lic=read('reports/human-v2/assets-licenses.json');
 assert.deepEqual(Object.keys(c.bodies),['slim','standard','large']);
 for(const b of Object.values(c.bodies)){assert.ok(b.heightRange[0]>=1.70&&b.heightRange[1]<=1.95);assert.ok(b.macro.weight<=0.35&&b.macro.muscle>=0.5);}
 assert.equal(c.faces.length,8);assert.equal(c.hairColors.length,5);
 const cc0=kind=>new Set(lic[kind].filter(a=>a.license==='CC0').map(a=>a.name));
 const skins=cc0('skins'),hair=cc0('hair');
 const bases=[...c.skinTones.map(s=>s.base),...c.skinToneCandidates.tinted.flatMap(s=>[s.base,s.mix?.with].filter(Boolean)),...c.skinToneCandidates.middleage];
 for(const b of bases)assert.ok(skins.has(b),b);
 assert.ok(c.skinTones.length>=4);
 for(const h of [...c.hair.short,...c.hair.long])assert.ok(hair.has(h),h);
 assert.ok(c.hair.short.includes('afro01')&&c.hair.long.length<=2);
 assert.deepEqual(Object.keys(c.kits),['field_short','field_long','gk']);
});
