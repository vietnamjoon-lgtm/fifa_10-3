import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('../tools/three-loader.mjs',import.meta.url);
const {encodeOffsets,decodeOffsets,cleanFacePack,cleanFaceScan,networkFaceScan,FACE_PACK_KIND,OFFSET_STEP,SCAN_ONLINE_MAX}=await import('../src/face-scan.js');
const jpeg=n=>'data:image/jpeg;base64,/9j/'+'A'.repeat(n);
const offsets=count=>encodeOffsets(Float32Array.from({length:count*3},(_,i)=>((i%7)-3)*.001));
const pack=(extra={})=>({kind:FACE_PACK_KIND,version:1,avatar:'asian_01',head:{count:1654,offsets:offsets(1654)},hair:{count:226,offsets:offsets(226)},texture:jpeg(200000),online:jpeg(20000),skin:'#c58c6b',...extra});

test('vertex offsets survive the pack in 0.25 mm steps and are capped at +-31.75 mm',()=>{
 const raw=Float32Array.from([0,.001,-.00249,.0123,-.0999,.05]),back=decodeOffsets(encodeOffsets(raw),2);
 for(let i=0;i<4;i++)assert.ok(Math.abs(back[i]-raw[i])<=OFFSET_STEP/2+1e-7,`${raw[i]} -> ${back[i]}`);
 assert.ok(Math.abs(back[4]+127*OFFSET_STEP)<1e-7&&Math.abs(back[5]-127*OFFSET_STEP)<1e-7,'larger moves are clamped');
 assert.equal(encodeOffsets(new Float32Array(1654*3)).length,1654*4,'four base64 characters per vertex');
});

test('a face pack is checked: kind, version, head, offsets that match their vertex count, texture sizes',()=>{
 const good=cleanFacePack(JSON.stringify(pack()));assert.equal(good.avatar,'asian_01');assert.equal(good.head.count,1654);assert.equal(good.hair.count,226);
 for(const bad of [{kind:'other'},{version:2},{avatar:'auto'},{avatar:'__proto__'},{avatar:'nobody'},{head:{count:1654,offsets:offsets(1653)}},{head:{count:0,offsets:''}},
  {head:{count:1654,offsets:offsets(1654).slice(0,-1)+'<'}},{texture:'https://example.com/face.jpg'},{texture:jpeg(500000)},{online:jpeg(SCAN_ONLINE_MAX+10)},{online:null}])
  assert.throws(()=>cleanFacePack(pack(bad)),JSON.stringify(bad).slice(0,60));
 assert.throws(()=>cleanFacePack('not json'));assert.throws(()=>cleanFacePack('x'.repeat(600000)));
 assert.equal(cleanFacePack(pack({hair:{count:3,offsets:'bad'}})).hair,null,'bad hair offsets are dropped, the face stays');
});

const {cleanFaceAsset,faceAssetFromPack}=await import('../src/face-assets.js');
const {networkFace}=await import('../src/face-settings.js');
const {cleanProfile,cleanLibrary,cleanLineup,defaultSquads,fitSquadBudget}=await import('../src/squads.js');

test('a face pack becomes a scan face asset; card imports keep it, broken ones are refused',()=>{
 const asset=faceAssetFromPack(JSON.stringify(pack()));
 assert.equal(asset.kind,'scan');assert.equal(asset.scan.avatar,'asian_01');assert.equal(asset.atlas,null);assert.equal(asset.skin,'#c58c6b');assert.ok(asset.online.length<=SCAN_ONLINE_MAX);
 const again=cleanFaceAsset({id:asset.id,scan:asset.scan,online:asset.online});assert.deepEqual(again.scan,asset.scan);
 assert.throws(()=>cleanFaceAsset({id:'x1',scan:{...asset.scan,avatar:'nobody'},online:asset.online}));
 assert.throws(()=>cleanFaceAsset({id:'x2',scan:asset.scan,online:jpeg(SCAN_ONLINE_MAX+10)}));
 assert.equal(cleanFaceAsset({id:'photo',atlas:jpeg(300),online:jpeg(300)}).scan,undefined,'photo assets are unchanged');
});

test('scan faces: saved rosters keep them in the face store, online sends only the small texture',()=>{
 const scan=cleanFaceScan(pack()),d=defaultSquads();d.players[9]={...d.players[9],face:{enabled:true,mode:'scan',assetId:'s1'},faceScan:scan};
 assert.equal(cleanLibrary(d).players[9].faceScan,undefined);assert.equal(cleanLibrary(d).players[9].face.mode,'scan');
 assert.equal(cleanProfile({face:{enabled:false},faceScan:scan}).faceScan,null);
 const small=networkFaceScan(scan,jpeg(20000)),shared=networkFace({...d.players[9]},jpeg(20000),true,null,null,small);
 assert.equal(shared.faceTexture,null,'no photo atlas for a scan face');assert.equal(shared.faceScan.texture.length,jpeg(20000).length);
 assert.equal(networkFace({...d.players[9]},jpeg(20000),false,null,null,small).faceScan,null,'only when sharing');
 const raw=defaultSquads().players.slice(0,11);raw[9]={...raw[9],face:{enabled:true},faceScan:small};raw[8]={...raw[8],face:{enabled:true},faceScan:scan};
 const net=cleanLineup(raw,0,true);assert.deepEqual(net[9].faceScan,small);assert.equal(net[8].faceScan,null,'a full-size texture is refused online');
});

test('the online budget drops scan faces last, from the end of the lineup',()=>{
 const small=networkFaceScan(cleanFaceScan(pack()),jpeg(28000));
 const lineup=Array.from({length:11},(_,i)=>({uid:'p'+i,faceTexture:null,faceUV:jpeg(20000),faceScan:small}));
 fitSquadBudget(lineup,385000);assert.ok(JSON.stringify(lineup).length<=385000);
 assert.ok(lineup.every(p=>!p.faceUV),'warp textures go first');assert.ok(lineup[0].faceScan&&!lineup[10].faceScan,'then scans from the end');
});

const {humanLook,faceShape}=await import('../src/human-body.js');

test('a scan face always gets the head it was fitted to, and the face sliders only add later changes',()=>{
 const scan=cleanFaceScan(pack({avatar:'male_03'})),p={skin:'#e0b48f',faceBase:'asian_02',hairStyle:'short',face:{enabled:true,mode:'scan'},faceScan:scan};
 assert.equal(humanLook(p,3).avatar,'male_03');assert.equal(humanLook({...p,face:{enabled:false}},3).avatar,'asian_02','a switched-off face uses the chosen head');
 assert.ok(Object.values(faceShape(p,3)).every(v=>Math.abs(v)<1e-9),'no per-player random face on a scan');
});

test('the tool reads each head in the game\'s own vertex order, and landmarks on target move nothing',async()=>{
 const {gameHead}=await import('../tools/human/scan/game-head.mjs'),{landmarkField}=await import('../src/face-shape3d.js');
 const head=await gameHead('asian_01');
 assert.equal(head.head.count,1654);assert.equal(head.hair.count,226);assert.equal(head.head.rest.length,1654*3);assert.ok(head.head.rigid.length>=2,'eyeballs found');assert.ok(head.seam.length/3>=20,'neck seam found');
 const still=landmarkField(head.calibration,head.landmarks,head.canonical,{seam:Float32Array.from(head.seam)});assert.ok(still.largest<1e-6);
 const nose=head.landmarks[1],moved=head.landmarks.map((p,i)=>p&&(i===1?[p[0],p[1],p[2]+.01]:p)),f=landmarkField(head.calibration,moved,head.canonical),o=[0,0,0];
 f.offset(...nose,o);assert.ok(o[2]>.004&&o[2]<=.0101,`nose follows its landmark: ${o[2]}`);f.offset(0,1.70,-.09,o);assert.ok(Math.hypot(...o)<1e-12,'back of the head stays');
});
