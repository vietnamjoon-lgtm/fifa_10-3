// MediaPipe's canonical_face_model.obj (vendor/mediapipe, Apache-2.0) has 468 vertices in the same order
// as FaceLandmarker's 468 landmarks, with a UV unwrap for a front-facing photo. Its face corners reference
// vertex and texcoord indices independently (v/vt), so a vertex's UV must be read off the faces, not off
// vt's own order. OBJ texcoords put v=0 at the bottom (chin); this game's texture convention (rocketbox.json,
// src/human-kit.js) puts v=0 at the top, so v is flipped here. `vertices` are the model's 3D positions (centimetres,
// +Y up, the face looking along +Z): the reference frame src/face-shape3d.js stores a photo's face shape in.
// node tools/human/rocketbox/build-canonical-face.mjs
import fs from 'node:fs';
import path from 'node:path';

const root=path.dirname(new URL(import.meta.url).pathname);
const objPath=path.resolve(root,'../../../vendor/mediapipe/canonical_face_model.obj');
const outPath=path.resolve(root,'../../../assets/human/canonical-face.json');

const v=[],vt=[],f=[];
for(const line of fs.readFileSync(objPath,'utf8').split('\n')){
 const p=line.trim().split(/\s+/);
 if(p[0]==='v')v.push(p.slice(1).map(Number));
 else if(p[0]==='vt')vt.push(p.slice(1).map(Number));
 else if(p[0]==='f')f.push(p.slice(1).map(c=>c.split('/').map(Number)));
}
if(v.length!==468||vt.length!==468)throw Error(`expected 468 vertices and texcoords, got ${v.length}/${vt.length}`);

const vertexToTexcoord=new Map();
for(const face of f)for(const [vi,vti] of face){
 const have=vertexToTexcoord.get(vi);
 if(have!==undefined&&have!==vti)throw Error(`vertex ${vi} maps to more than one texcoord (${have} and ${vti})`);
 vertexToTexcoord.set(vi,vti);
}
if(vertexToTexcoord.size!==468)throw Error(`only ${vertexToTexcoord.size}/468 vertices appear in a face`);

const uv=[];
for(let landmark=0;landmark<468;landmark++){
 const vti=vertexToTexcoord.get(landmark+1),[u,vv]=vt[vti-1];
 uv.push([u,1-vv]);
}
const triangles=f.map(face=>{
 if(face.length!==3)throw Error('expected a triangulated mesh');
 return face.map(([vi])=>vi-1);
});

const vertices=v.map(p=>p.map(c=>Math.round(c*1e4)/1e4));
fs.writeFileSync(outPath,JSON.stringify({source:'MediaPipe canonical_face_model.obj (Apache-2.0)',uv,triangles,vertices}));
console.log(JSON.stringify({landmarks:uv.length,triangles:triangles.length,out:path.relative(process.cwd(),outPath)}));
