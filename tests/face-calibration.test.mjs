import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mirrorPairs} from '../src/face-shape3d.js';
import {repairCalibrationUV,unreliableLandmarks} from '../src/face-calibration.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const canonical=read('assets/human/canonical-face.json'),heads=read('assets/human/rocketbox/face-landmarks-3d.json'),tables=read('assets/human/rocketbox/face-landmarks-uv.json');
const pairs=mirrorPairs(canonical.vertices),N=1024;
// Face-outline landmarks in front of the ears (MediaPipe FACEMESH_FACE_OVAL, cheek to jaw on both sides).
const CHEEK=[[234,454],[93,323],[132,361],[58,288],[172,397],[127,356]];

test('a missed or ear-grazing calibration ray is flagged; a centre-line point never is',()=>{
 const points=canonical.vertices.map(([x,y,z])=>[x/100,y/100,z/100]);
 assert.deepEqual(unreliableLandmarks(points,pairs),[]);
 points[454]=null;points[323]=[points[323][0],points[323][1],points[93][2]-.02];
 assert.deepEqual(unreliableLandmarks(points,pairs),[323,454]);
 points[1]=null; // nose tip: its own partner
 assert.ok(unreliableLandmarks(points,pairs).includes(1));
 const uv=canonical.uv.map(p=>[...p]),{repaired}=repairCalibrationUV(uv,points,pairs);
 assert.deepEqual(repaired.sort((a,b)=>a-b),[323,454]);
});

test('repaired calibration tables: every cheek pair in front of the ears mirrors within 16 texels',()=>{
 for(const [id,table] of Object.entries(tables)){
  const {uv,repaired}=repairCalibrationUV(table,heads[id].points,pairs);
  for(const [a,b] of CHEEK){const gap=Math.hypot(uv[a][0]+uv[b][0]-1,uv[a][1]-uv[b][1])*N;assert.ok(gap<16,`${id} ${a}/${b}: ${gap.toFixed(1)} texels apart`);}
  // Reliable points keep their own UV.
  for(let i=0;i<table.length;i++)if(!repaired.includes(i))assert.deepEqual(uv[i],table[i]);
 }
});

test('shipped male_02 and asian_02 tables had cheek points on the ear (the patch in front of the ear)',()=>{
 for(const id of ['male_02','asian_02']){
  const worst=Math.max(...CHEEK.map(([a,b])=>Math.hypot(tables[id][a][0]+tables[id][b][0]-1,tables[id][a][1]-tables[id][b][1])*N));
  assert.ok(worst>60,`${id}: ${worst.toFixed(0)} texels`);
 }
});
