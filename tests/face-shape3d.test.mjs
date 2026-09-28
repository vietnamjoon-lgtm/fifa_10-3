import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register} from 'node:module';
register('../tools/three-loader.mjs',import.meta.url);
const {encodeFaceShape,decodeFaceShape,validFaceShape,faceShapeField,headLandmarks,mirrorPairs,meshOffsets}=await import('../src/face-shape3d.js');
const {cleanFaceAsset}=await import('../src/face-assets.js');
const {cleanFace,networkFace,facePreviewProfile}=await import('../src/face-settings.js');
const {cleanProfile,cleanLibrary,cleanLineup,defaultSquads,fitSquadBudget}=await import('../src/squads.js');
const {humanLook,faceShape,eastAsianTone}=await import('../src/human-body.js');
const {HAIR_STYLES}=await import('../src/human-kit.js');
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const canonical=read('assets/human/canonical-face.json'),heads=read('assets/human/rocketbox/face-landmarks-3d.json'),layout=read('assets/human/rocketbox/rocketbox.json');
const jpeg='data:image/jpeg;base64,/9j/'+'A'.repeat(200)+'/9k=';
// A synthetic "photo": the canonical face, optionally widened, turned and projected into a 600 x 800 image.
function photo({widen=1,yaw=0}={}){
 return canonical.vertices.map(([x,y,z])=>{x*=widen;const X=x*Math.cos(yaw)+z*Math.sin(yaw),Z=-x*Math.sin(yaw)+z*Math.cos(yaw);return [(300+X*18)/600,(400-y*18)/800,-(Z*18)/600];});
}
const shapeOf=landmarks=>encodeFaceShape({front:{landmarks,width:600,height:800}},canonical).shape;

test('a stored face shape is 1,874 characters, round-trips, and anything else is refused',()=>{
 const s=shapeOf(photo());assert.equal(s.length,1874);assert.equal(validFaceShape(s),s);
 const back=decodeFaceShape(s,canonical);let err=0;canonical.vertices.forEach((v,i)=>v.forEach((c,k)=>err=Math.max(err,Math.abs(back[i*3+k]-c))));
 assert.ok(err<.02,`canonical face decodes to itself (${err} cm)`);
 for(const bad of [null,'',s.slice(0,-1),'2'+s.slice(1),s.slice(0,-1)+'<',{},'1:'+'A'.repeat(1871)+'=' ])assert.equal(validFaceShape(bad),null);
 assert.equal(encodeFaceShape({front:{landmarks:photo().slice(0,100),width:600,height:800}},canonical),null);
});

test('every shipped head has 468 calibration points and its own MediaPipe reading',()=>{
 for(const id of Object.keys(layout.avatars)){const h=heads[id];assert.ok(h,id);assert.equal(h.points.length,468);assert.ok(h.points.filter(Boolean).length>=460,id);assert.ok(validFaceShape(h.shape),id);
  // Metres, +Y up, face along +Z: the nose tip is in front of the chin and between the eyes and the chin.
  const nose=h.points[1],chin=h.points[152];assert.ok(nose[2]>chin[2]&&nose[1]>chin[1]&&nose[1]>1.55&&nose[1]<1.75,id);}
});

test('a head fitted to its own reading does not move; a wider face widens the jaw on both sides alike',()=>{
 for(const id of Object.keys(layout.avatars)){
  const self=faceShapeField(heads[id],decodeFaceShape(heads[id].shape,canonical),canonical);assert.ok(self.largest<.01,`${id} ${self.largest} mm`);
  const wide=faceShapeField(heads[id],decodeFaceShape(shapeOf(photo({widen:1.08,yaw:.17})),canonical),canonical),jaw=headLandmarks(heads[id].points,mirrorPairs(canonical.vertices))[172],L=[0,0,0],R=[0,0,0];
  wide.offset(...jaw,L);wide.offset(-jaw[0],jaw[1],jaw[2],R);
  assert.ok(L[0]<-.002&&R[0]>.002,`${id} jaw moves out: ${L[0]} ${R[0]}`);assert.ok(Math.abs(L[0]+R[0])<.0015,`${id} symmetric: ${L[0]} ${R[0]}`);
  assert.ok(wide.largest<=15.01,'offsets are capped at 15 mm');
 }
});

test('the back of the head, the scalp, the neck and the neck seam never move; eyeballs move as one piece',()=>{
 const seam=new Float32Array([0,1.49,.06,.07,1.53,0,0,1.55,-.06]),f=faceShapeField(heads.asian_01,decodeFaceShape(shapeOf(photo({widen:1.1})),canonical),canonical,{seam}),o=[0,0,0];
 for(const p of [[0,1.70,-.09],[.08,1.68,-.03],[0,1.83,.02],[0,1.46,.05],[0,1.49,.06],[.07,1.53,0]]){f.offset(...p,o);assert.ok(Math.hypot(...o)<1e-9,`${p} moved ${o}`);}
 const rest=new Float32Array([.03,1.69,.08,.031,1.69,.081,.029,1.689,.082,0,1.62,.12]),{offsets}=meshOffsets(f,rest,[[0,1,2]]);
 assert.deepEqual([...offsets.slice(0,3)],[...offsets.slice(3,6)]);assert.deepEqual([...offsets.slice(0,3)],[...offsets.slice(6,9)]);
});

test('a head missing a calibration ray on one side takes its partner mirrored',()=>{
 const pairs=mirrorPairs(canonical.vertices),pts=heads.male_02.points.map(p=>p&&[...p]),i=234,j=pairs[i];pts[j]=null;
 const done=headLandmarks(pts,pairs);assert.deepEqual(done[j],[-pts[i][0],pts[i][1],pts[i][2]]);
 assert.equal(pairs[1],1,'the nose tip is its own partner');
});

test('face assets keep a valid 3D shape; older assets and bad values have none',()=>{
 const s=shapeOf(photo({widen:1.05}));
 assert.equal(cleanFaceAsset({id:'f3d',atlas:jpeg,online:jpeg,shape3d:s}).shape3d,s);
 assert.equal(cleanFaceAsset({id:'old',atlas:jpeg,online:jpeg}).shape3d,null);
 assert.equal(cleanFaceAsset({id:'bad',atlas:jpeg,online:jpeg,shape3d:'<script>'}).shape3d,null);
});

test('profiles: saved rosters leave the shape in the asset store, the network keeps only a valid shared one',()=>{
 const s=shapeOf(photo()),d=defaultSquads();d.players[9]={...d.players[9],face:{enabled:true,assetId:'a1'},faceShape3d:s,faceBase:'asian_02',hairStyle:'twoblock'};
 const lib=cleanLibrary(d);assert.equal(lib.players[9].faceShape3d,undefined);assert.equal(lib.players[9].faceBase,'asian_02');assert.equal(lib.players[9].hairStyle,'twoblock');
 assert.equal(cleanProfile({faceBase:'__proto__',hairStyle:'mohawk'}).faceBase,'auto');assert.equal(cleanProfile({hairStyle:'sidepart'}).hairStyle,'sidepart');
 assert.equal(cleanProfile({face:{enabled:false},faceShape3d:s}).faceShape3d,null);
 const p={...d.players[9],face:{enabled:true}};
 assert.equal(networkFace(p,jpeg,true,null,s).faceShape3d,s);assert.equal(networkFace(p,jpeg,false,null,s).faceShape3d,null);assert.equal(networkFace(p,jpeg,true,null,'x').faceShape3d,null);
 const raw=defaultSquads().players.slice(0,11);raw[9]={...raw[9],face:{enabled:true},faceShape3d:s};raw[8]={...raw[8],face:{enabled:true},faceShape3d:'1:'+'<'.repeat(1872)};
 const net=cleanLineup(raw,0,true);assert.equal(net[9].faceShape3d,s);assert.equal(net[8].faceShape3d,null);
 assert.equal(facePreviewProfile({},{enabled:true},{shape3d:s,atlas:jpeg}).faceShape3d,s);
});

test('the online squad budget drops warp textures first, then 3D shapes from the last players',()=>{
 const s=shapeOf(photo()),big=n=>'data:image/jpeg;base64,/9j/'+'A'.repeat(n);
 const lineup=Array.from({length:11},(_,i)=>({uid:'p'+i,faceTexture:big(33500),faceUV:big(27000),faceShape3d:s}));
 fitSquadBudget(lineup,385000);assert.ok(JSON.stringify(lineup).length<=385000);
 assert.ok(lineup.every(p=>!p.faceUV),'every warp texture goes before any shape');assert.ok(lineup[0].faceShape3d&&!lineup[10].faceShape3d,'shapes go from the end');
 const small=[{uid:'a',faceUV:big(100),faceShape3d:s}];fitSquadBudget(small);assert.equal(small[0].faceShape3d,s);
});

test('head choice: the editor pick wins, photo faces with an East Asian skin tone get the East Asian head',()=>{
 const photoFace={face:{enabled:true},faceTexture:jpeg};
 assert.equal(humanLook({...photoFace,skin:'#e0b48f'},3).avatar,'asian_01');
 assert.equal(humanLook({skin:'#e0b48f'},3).avatar,'male_02','without a photo nothing changes');
 assert.equal(humanLook({...photoFace,skin:'#74482f'},3).avatar,'male_03');
 assert.equal(humanLook({skin:'#e0b48f',faceBase:'asian_02'},3).avatar,'asian_02');
 assert.equal(humanLook({...photoFace,skin:'#e0b48f',hairStyle:'crest'},3).avatar,'male_03');
 assert.equal(humanLook({skin:'#e0b48f',faceBase:'__proto__'},3).avatar,'male_02');
 assert.equal(humanLook({skin:'#e0b48f',faceBase:'asian_01'},3,{male_02:{skin:'#c18a6f'},male_03:{skin:'#a0674a'}}).avatar,'male_02','an unloaded head falls back');
 assert.ok(eastAsianTone('#d9b08c')&&eastAsianTone('#dcae88')&&!eastAsianTone('#5a3a28')&&!eastAsianTone('#8899aa')&&!eastAsianTone('bad'));
 assert.equal(humanLook({hairStyle:'twoblock'},3).hairStyle,HAIR_STYLES.twoblock);assert.equal(humanLook({hairStyle:'sidepart'},3).hairStyle,HAIR_STYLES.sidepart);
});

test('with a 3D shape the face sliders only add what was changed after the photo analysis',()=>{
 const s=shapeOf(photo()),fit={width:1.1,jaw:.9},face={enabled:true,shape:{...fit},fitShape:{...fit}};
 const same=faceShape({face,faceTexture:jpeg,faceShape3d:s},3);assert.ok(Object.values(same).every(v=>Math.abs(v)<1e-9),JSON.stringify(same));
 const wider=faceShape({face:{...face,shape:{...fit,width:1.2}},faceTexture:jpeg,faceShape3d:s},3);assert.ok(wider.face_width>0&&Math.abs(wider.face_jaw)<1e-9);
 const legacy=faceShape({face:{enabled:true,shape:{width:1.2}},faceTexture:jpeg},3);assert.ok(Math.abs(legacy.face_width-1)<1e-9,'older photo faces keep the slider morphs');
 assert.deepEqual(cleanFace({fitShape:{width:9}}).fitShape.width,1.2);assert.equal(cleanFace({}).fitShape,null);
});

test('transplanted heads: files exist, the model keeps the expressions and face morphs, the body normal map is shared',()=>{
 const glbJSON=file=>{const b=fs.readFileSync(new URL('../assets/human/rocketbox/'+file,import.meta.url));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));};
 const names=j=>j.meshes[0].extras.targetNames,base=names(glbJSON('male_02.glb'));
 for(const [id,a] of Object.entries(layout.avatars).filter(([,a])=>a.transplant)){
  for(const key of ['body','head','bodyNormal','headNormal','model','hairMask','hair'])assert.ok(fs.existsSync(new URL('../assets/human/rocketbox/'+a[key],import.meta.url)),`${id} ${key}`);
  const j=glbJSON(a.model);assert.deepEqual(names(j),base,`${id} morph names`);assert.deepEqual(j.materials.map(m=>m.name).sort(),['body','hair','head']);
  assert.equal(a.bodyNormal,'male_02-body-normal.jpg');
 }
});
