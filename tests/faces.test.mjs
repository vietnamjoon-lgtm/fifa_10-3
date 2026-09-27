import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanFace,cleanCrop,projectionSample,validFaceTexture} from '../src/face-settings.js';
import {humanHeadGeometry} from '../src/human-head.js';
import {cleanFaceAsset,warpFaceV} from '../src/face-assets.js';
import {triangleTransform,MAX_MAGNIFY,boxBlur1ch} from '../src/face-uv.js';
import {cleanLibrary,defaultSquads,cleanLineup,applyLineups} from '../src/squads.js';
import {Room} from '../server/room.js';
const jpeg='data:image/jpeg;base64,/9j/'+ 'A'.repeat(200) + '/9k=';
const canonicalFace=JSON.parse(fs.readFileSync(new URL('../assets/human/canonical-face.json',import.meta.url)));
const faceLandmarksUV=JSON.parse(fs.readFileSync(new URL('../assets/human/rocketbox/face-landmarks-uv.json',import.meta.url)));
test('face shape and crop controls sanitize legacy, null and extreme values',()=>{assert.equal(cleanFace(null).shape.width,1);assert.equal(cleanCrop(null).zoom,1);const f=cleanFace({assetId:'../../private',shape:{width:Infinity,jaw:100,depth:0},photoHair:'true'});assert.equal(f.assetId,null);assert.equal(f.shape.width,1);assert.equal(f.shape.jaw,1.3);assert.equal(f.shape.depth,.8);assert.equal(f.photoHair,false);const c=cleanCrop({zoom:99,x:99,eyes:.8,nose:0,mouth:0});assert.equal(c.zoom,8);assert.ok(c.eyes<c.nose&&c.nose<c.mouth);});
test('multiview projection has correct front side back and continuous seam weights',()=>{assert.equal(projectionSample(.5,.5).front.weight,1);assert.ok(projectionSample(.75,.5).side.weight>.99999);assert.equal(projectionSample(0,.5).back.weight,1);for(let u=0;u<=1;u+=.01){const sample=projectionSample(u,.4);assert.ok(Math.abs(Object.values(sample).reduce((a,p)=>a+p.weight,0)-1)<1e-12);}for(const view of ['front','side','back'])assert.ok(Math.abs(projectionSample(0,.5)[view].u-projectionSample(1,.5)[view].u)<1e-12);assert.ok(projectionSample(.625,.5).front.weight>.9);});
test('landmark warping preserves endpoints and aligns eyes nose mouth monotonically',()=>{const c={eyes:.51,nose:.69,mouth:.805};for(const [a,b]of [[0,0],[.444,.51],[.603,.69],[.797,.805],[1,1]])assert.ok(Math.abs(warpFaceV(a,c)-b)<1e-10);let prev=0;for(let v=0;v<=1;v+=.001){const y=warpFaceV(v,c);assert.ok(y>=prev);prev=y;}});
test('detailed and distant human head meshes are finite, outward facing and anatomically bounded',()=>{for(const [segments,rows]of [[96,64],[32,24]]){const g=humanHeadGeometry({},segments,rows);g.computeBoundingBox();const p=g.attributes.position,n=g.attributes.normal;assert.ok(g.boundingBox.max.y-g.boundingBox.min.y<.32);assert.ok(g.boundingBox.max.x-g.boundingBox.min.x<.22);for(const v of [...p.array,...n.array,...g.attributes.uv.array])assert.ok(Number.isFinite(v));const center=Math.round(rows*.55)*(segments+1)+segments/2;assert.ok(n.getZ(center)>0);assert.ok(g.index.count>4000);g.dispose();}});
test('face shape changes actual head geometry while maintaining valid normals',()=>{const a=humanHeadGeometry(),b=humanHeadGeometry({shape:{width:1.2,jaw:1.3,nose:1.5,chin:1.2}});a.computeBoundingBox();b.computeBoundingBox();assert.ok(b.boundingBox.max.x>a.boundingBox.max.x);assert.ok(b.boundingBox.min.y<a.boundingBox.min.y);assert.ok(b.boundingBox.max.z>a.boundingBox.max.z);a.dispose();b.dispose();});
test('photo profiles preserve shape and asset id but keep large image data out of local roster metadata',()=>{const d=defaultSquads();d.players[9].face={assetId:'custom-face',enabled:true,shape:{jaw:1.2}};d.players[9].faceTexture=jpeg;const clean=cleanLibrary(d);assert.equal(clean.players[9].face.assetId,'custom-face');assert.equal(clean.players[9].face.shape.jaw,1.2);assert.equal(clean.players[9].faceTexture,undefined);});
test('face textures accept only bounded inline JPEG and reject remote, script and SVG input',()=>{assert.equal(validFaceTexture(jpeg),jpeg);for(const value of ['https://example.com/private.jpg','data:image/svg+xml;base64,AAA','javascript:alert(1)',jpeg+'<script>',jpeg.repeat(1000)])assert.equal(validFaceTexture(value),null);assert.equal(validFaceTexture(jpeg,20),null);assert.throws(()=>cleanFaceAsset({id:'face',atlas:jpeg,online:'bad'}));});
test('face asset import retains all three views and independent crop alignment',()=>{const asset=cleanFaceAsset({id:'face-123',atlas:jpeg,online:jpeg,sources:{front:jpeg,side:jpeg,back:jpeg},crops:{side:{flip:true,zoom:2.5},back:{x:.2}},skin:'#998877'});assert.equal(Object.keys(asset.sources).length,3);assert.equal(asset.crops.side.flip,true);assert.equal(asset.crops.back.x,.2);assert.equal(asset.skin,'#998877');assert.throws(()=>cleanFaceAsset({...asset,id:'bad/path'}));});
test('online roster strips device asset IDs and rejects oversized photos while preserving shape',()=>{const d=defaultSquads().players.slice(0,11);d[9].face={enabled:true,assetId:'local-private',shape:{nose:1.4}};d[9].faceTexture=jpeg;const out=cleanLineup(d,1,true);assert.equal(out[9].face.assetId,null);assert.equal(out[9].faceTexture,jpeg);assert.equal(out[9].face.shape.nose,1.4);d[9].faceTexture='data:image/jpeg;base64,'+'A'.repeat(33000);assert.equal(cleanLineup(d,1,true)[9].faceTexture,null);});
test('online welcome and start share the same small texture once without putting photos into snapshots',()=>{const raw=defaultSquads().players.slice(0,11);raw[9].face={enabled:true,assetId:'local-photo'};raw[9].faceTexture=jpeg;const room=new Room({code:'FACE1234'}),a=room.reserve('a',true,raw),b=room.reserve('b',false),messages=[];room.connect(a.token,m=>messages.push(m));room.connect(b.token,()=>{});room.message(0,{type:'ready',ready:true});room.message(1,{type:'ready',ready:true});room.message(0,{type:'start'});assert.equal(messages.find(m=>m.type==='welcome').squads[0][9].faceTexture,jpeg);assert.equal(room.match.players[9].faceTexture,jpeg);room.tick();assert.ok(messages.filter(m=>m.type==='snapshot').every(m=>!JSON.stringify(m).includes('data:image')));});

test('canonical MediaPipe face UV has 468 landmarks and a triangulation that only refers to them',()=>{
 assert.equal(canonicalFace.uv.length,468);
 for(const [u,v] of canonicalFace.uv){assert.ok(u>=0&&u<=1);assert.ok(v>=0&&v<=1);}
 assert.ok(canonicalFace.triangles.length>800&&canonicalFace.triangles.length<1000);
 for(const t of canonicalFace.triangles){assert.equal(t.length,3);for(const i of t)assert.ok(Number.isInteger(i)&&i>=0&&i<468);}
});
test('the Rocketbox head UV calibration covers both avatars with 468 in-range points each',()=>{
 for(const avatar of ['male_02','male_03']){const uv=faceLandmarksUV[avatar];assert.equal(uv.length,468,avatar);for(const [u,v] of uv){assert.ok(u>=0&&u<=1,avatar);assert.ok(v>=0&&v<=1,avatar);}}
});
test('triangleTransform maps a source triangle exactly onto its destination triangle',()=>{
 const m=triangleTransform([0,0],[1,0],[0,1],[0,0],[1,0],[0,1]);assert.deepEqual(m,{a:1,b:0,c:0,d:1,e:0,f:0});
 const scaled=triangleTransform([0,0],[1,0],[0,1],[5,7],[7,7],[5,9]);const at=(p)=>[scaled.a*p[0]+scaled.c*p[1]+scaled.e,scaled.b*p[0]+scaled.d*p[1]+scaled.f];
 for(const [s,d] of [[[0,0],[5,7]],[[1,0],[7,7]],[[0,1],[5,9]],[[2,3],[9,13]]]){const [x,y]=at(s);assert.ok(Math.abs(x-d[0])<1e-9&&Math.abs(y-d[1])<1e-9);}
 assert.throws(()=>triangleTransform([0,0],[1,0],[2,0],[0,0],[1,0],[0,1]),'collinear source triangle is degenerate');
});
test('boxBlur1ch turns a hard step into a real gradient (regression: ctx.filter blur silently no-opped in production, leaving a hard-edged face mask)',()=>{
 const N=64,a=new Float32Array(N*N);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)a[y*N+x]=x<N/2?255:0;
 const blurred=boxBlur1ch(a,N,8);
 const row=16,distinct=new Set();
 for(let x=0;x<N;x++)distinct.add(Math.round(blurred[row*N+x]));
 assert.ok(distinct.size>10,`expected a real gradient, got ${distinct.size} distinct values`);
 assert.ok(Math.abs(blurred[row*N+2]-255)<5,'far from the edge stays at the fill value');
 assert.ok(blurred[row*N+N-3]<5,'far on the other side stays at 0');
 let prev=blurred[row*N];for(let x=1;x<N;x++){assert.ok(blurred[row*N+x]<=prev+1e-6,`not monotonically non-increasing at x=${x}`);prev=blurred[row*N+x];}
});
test('face asset import accepts a triangle-warp faceUV bake and keeps older assets without one valid',()=>{
 const withUV=cleanFaceAsset({id:'face-uv',atlas:jpeg,online:jpeg,faceUV:jpeg,faceUVOnline:jpeg,skin:'#c89572'});
 assert.equal(withUV.faceUV,jpeg);assert.equal(withUV.faceUVOnline,jpeg);
 const legacy=cleanFaceAsset({id:'face-legacy',atlas:jpeg,online:jpeg,skin:'#c89572'});
 assert.equal(legacy.faceUV,null);assert.equal(legacy.faceUVOnline,null);
 assert.equal(cleanFaceAsset({id:'face-oversized',atlas:jpeg,online:jpeg,faceUV:'data:image/jpeg;base64,'+'A'.repeat(200000)}).faceUV,null);
});
test('network face sharing carries the small faceUV variant, not the full-size one',()=>{const d=defaultSquads().players.slice(0,11);d[9].face={enabled:true,assetId:'local-uv'};d[9].faceTexture=jpeg;d[9].faceUV=jpeg;const shared=cleanLineup(d,1,true)[9];assert.equal(shared.faceUV,jpeg);d[9].faceUV='data:image/jpeg;base64,'+'A'.repeat(29000);assert.equal(cleanLineup(d,1,true)[9].faceUV,null);});

test('most canonical-to-head-UV triangles stay under the magnification cap or edge-length cap; only known outliers are skipped',()=>{
 // Two independent reasons a triangle is dropped, both real calibration characteristics rather than bugs:
 // (1) a closed mouth/eye collapses those landmarks' source triangles near to a point while the head's own
 // UV keeps real separation there (MAX_MAGNIFY, the torn-streak bug that first fix caught); (2) some eyelid
 // landmarks' matching eye-interior landmark raycasts onto the model's separate eyeball texture swatch, far
 // from the face -- a real, moderate-area sliver reaching hundreds of pixels away that MAX_MAGNIFY alone
 // doesn't catch (the black-seam-to-the-chin bug the maxEdge argument to warpTriangles catches instead).
 // Guards against a future calibration regeneration silently making either much worse across the whole face.
 // Scaled the same way as the real bake (src/face-assets.js bakeFaceUV: canonical UV * 512) and compose
 // (src/human-kit.js composePhotoHead: head UV * 1024, maxEdge = 1024 * .12), so both ratios match production.
 const FACE_UV_SIZE=512,HEAD_SIZE=1024,MAX_EDGE=HEAD_SIZE*.12;
 for(const avatar of ['male_02','male_03']){
  const src=canonicalFace.uv.map(([u,v])=>[u*FACE_UV_SIZE,v*FACE_UV_SIZE]),dst=faceLandmarksUV[avatar].map(([u,v])=>[u*HEAD_SIZE,v*HEAD_SIZE]);
  let skippedMagnify=0,skippedEdge=0;
  for(const [i,j,k] of canonicalFace.triangles){
   const edge=Math.max(Math.hypot(dst[i][0]-dst[j][0],dst[i][1]-dst[j][1]),Math.hypot(dst[j][0]-dst[k][0],dst[j][1]-dst[k][1]),Math.hypot(dst[k][0]-dst[i][0],dst[k][1]-dst[i][1]));
   if(edge>MAX_EDGE){skippedEdge++;continue;}
   let m;try{m=triangleTransform(src[i],src[j],src[k],dst[i],dst[j],dst[k]);}catch{skippedMagnify++;continue;}
   if(Math.abs(m.a*m.d-m.b*m.c)>MAX_MAGNIFY)skippedMagnify++;
  }
  assert.ok(skippedEdge>0&&skippedEdge<150,`${avatar}: ${skippedEdge} triangles skipped by edge length`);
  assert.ok(skippedMagnify<60,`${avatar}: ${skippedMagnify}/${canonicalFace.triangles.length} triangles skipped by magnification`);
 }
});

test('an online squad with many shared photo faces stays under the room server request limit',async()=>{
 const {fitSquadBudget,NETWORK_SQUAD_BUDGET}=await import('../src/squads.js');
 const jpeg=n=>'data:image/jpeg;base64,/9j/'+'A'.repeat(n);
 const lineup=Array.from({length:11},(_,i)=>({uid:'p'+i,faceTexture:jpeg(31000),faceUV:jpeg(27000)}));
 fitSquadBudget(lineup);
 assert.ok(JSON.stringify(lineup).length<=NETWORK_SQUAD_BUDGET);
 assert.ok(lineup.every(p=>p.faceTexture),'every legacy face texture is kept');
 assert.ok(lineup[0].faceUV&&!lineup[10].faceUV,'warp textures are dropped from the end first');
 const small=[{uid:'a',faceTexture:null,faceUV:jpeg(27000)}];assert.ok(fitSquadBudget(small)[0].faceUV,'small squads keep everything');
});
