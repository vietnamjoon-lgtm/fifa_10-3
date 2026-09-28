// A game head as the game itself loads it (GLTFLoader + meshopt, src/human-body.js addBindPositions), for the
// face-scan tool: head and hair-card vertices in the same order as the game's geometry, their rest positions in
// metres (+Y up, the face along +Z), UVs, triangles, the eyeball/teeth pieces and the neck seam. The face pack's
// vertex offsets are indexed by exactly this order, so the game can apply them without any matching.
import fs from 'node:fs';
import path from 'node:path';
import {register} from 'node:module';
register('../../three-loader.mjs',import.meta.url);
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../../..');
const {GLTFLoader}=await import('../../../vendor/three-addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('../../../vendor/three-addons/libs/meshopt_decoder.module.js');
const {addBindPositions,neckSeam,rigidPieces}=await import('../../../src/human-body.js');
const {headLandmarks,mirrorPairs}=await import('../../../src/face-shape3d.js');

export const readJSON=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));

export async function gameHead(avatar){
 const layout=readJSON('assets/human/rocketbox/rocketbox.json'),entry=layout.avatars[avatar];
 if(!entry)throw Error(`unknown head ${avatar}; one of ${Object.keys(layout.avatars).join(', ')}`);
 const b=fs.readFileSync(path.join(root,'assets/human/rocketbox',entry.model));
 const gltf=await new Promise((resolve,reject)=>new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'',resolve,reject));
 addBindPositions(gltf.scene);
 const meshes={};
 gltf.scene.traverse(o=>{if(!o.isSkinnedMesh||!['head','hair'].includes(o.material.name))return;const g=o.geometry,uv=g.attributes.uv;
  meshes[o.material.name]={count:g.attributes.position.count,rest:[...g.attributes.kitBind.array],uv:Array.from({length:uv.count},(_,i)=>[uv.getX(i),uv.getY(i)]),
   index:[...g.index.array],rigid:o.material.name==='head'?rigidPieces(g,layout.eyes):[]};});
 const canonical=readJSON('assets/human/canonical-face.json'),calibration=readJSON('assets/human/rocketbox/face-landmarks-3d.json')[avatar];
 return {avatar,head:meshes.head,hair:meshes.hair||null,seam:[...neckSeam(gltf.scene)],calibration,canonical,
  landmarks:headLandmarks(calibration.points,mirrorPairs(canonical.vertices)),headTexture:path.join(root,'assets/human/rocketbox',entry.head)};
}
