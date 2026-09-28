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
 for(let i=0;i<4;i++)assert.ok(Math.abs(back[i]-raw[i])<=OFFSET_STEP/2+1e-9,`${raw[i]} -> ${back[i]}`);
 assert.ok(Math.abs(back[4]+127*OFFSET_STEP)<1e-9&&Math.abs(back[5]-127*OFFSET_STEP)<1e-9,'larger moves are clamped');
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
