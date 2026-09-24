import {distantGeometry} from './geometry-lod.js';
import * as THREE from '../vendor/three.module.js';
import {anatomy} from './anatomy-data.js';
import {bodyPoint,bodyMetrics} from './body-shape.js';
// Retargeted CC0 anatomy: actual shoulder, elbow, knee and hand topology.
export function createAnatomicalBody(rig,colors){
 const bones=[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(a=>[a.upper,a.lower]),...rig.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
 const g=new THREE.BufferGeometry(),positions=new Float32Array(anatomy.body.positions),armWeights=[];
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(anatomy.body.indices);g.computeVertexNormals();const normals=g.attributes.normal;
 const wardrobePositions=positions.slice(),metrics=rig.bodyMetrics||bodyMetrics();
 for(let i=0;i<positions.length/3;i++){let arm=0;for(let k=0;k<4;k++){const b=anatomy.body.skinIndices[i*4+k];if(b>=3&&b<=6)arm+=anatomy.body.skinWeights[i*4+k];}armWeights.push(arm);const x=positions[i*3],y=positions[i*3+1],neck=1.42+.13*Math.min(1,Math.abs(x)/.15),top=neck*(1-arm)+1.23*arm,shirt=(1-arm)*THREE.MathUtils.smoothstep(y,.95,.97)*(1-THREE.MathUtils.smoothstep(y,neck-.012,neck))+arm*THREE.MathUtils.smoothstep(y,1.225,1.235),shorts=THREE.MathUtils.smoothstep(y,.70,.72)*(1-THREE.MathUtils.smoothstep(y,.96,.975))*(1-arm),thickness=shirt*.012+shorts*.014;positions[i*3]+=normals.getX(i)*thickness;positions[i*3+1]+=normals.getY(i)*thickness*.35;positions[i*3+2]+=normals.getZ(i)*thickness;}
 for(let i=0;i<positions.length/3;i++){const source=positions.slice(i*3,i*3+3),out=[0,0,0];for(let k=0;k<4;k++){const w=anatomy.body.skinWeights[i*4+k];if(!w)continue;const p=bodyPoint(...source,anatomy.body.skinIndices[i*4+k],metrics);for(let j=0;j<3;j++)out[j]+=p[j]*w;}positions.set(out,i*3);}
 g.setAttribute('wardrobePosition',new THREE.BufferAttribute(wardrobePositions,3));g.setAttribute('wardrobeArm',new THREE.Float32BufferAttribute(armWeights,1));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(anatomy.body.skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(anatomy.body.skinWeights,4));g.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({roughness:.79});
 // Evaluate garment borders per pixel; interpolated per-vertex colours made torn, triangular necklines.
 mat.onBeforeCompile=shader=>{for(const key of ['skin','kit','shorts','sock'])shader.uniforms['uniform'+key]={value:colors[key]};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 wardrobePosition; attribute float wardrobeArm; varying vec3 vWardrobe; varying float vArm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWardrobe=wardrobePosition; vArm=wardrobeArm;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWardrobe; varying float vArm; uniform vec3 uniformskin,uniformkit,uniformshorts,uniformsock;').replace('#include <color_fragment>',`#include <color_fragment>
 float y=vWardrobe.y;
 float neckline=1.42+.13*min(1.0,abs(vWardrobe.x)/.15);
 float top=neckline;
 float torsoShirt=smoothstep(.963,.966,y)*(1.0-smoothstep(top-.002,top+.002,y));
 float shirt=mix(torsoShirt,smoothstep(1.228,1.232,y),vArm);
 float shorts=smoothstep(.708,.712,y)*(1.0-smoothstep(.963,.966,y))*(1.0-vArm);
 float sock=(1.0-smoothstep(.418,.422,y))*(1.0-vArm);
 vec3 clothing=mix(uniformskin,uniformsock,sock);
 clothing=mix(clothing,uniformshorts,shorts);
 clothing=mix(clothing,uniformkit,shirt);
 float collar=torsoShirt*smoothstep(top-.014,top-.01,y)*(1.0-vArm);
 diffuseColor.rgb*=mix(clothing,uniformshorts,collar*.7);
 `);};
 const mesh=new THREE.SkinnedMesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 // Data is baked at these neutral bone angles, not at the previous mannequin pose.
 const saved=rig.arms.flatMap(a=>[a.upper.quaternion.clone(),a.lower.quaternion.clone()]);for(const a of rig.arms){a.upper.quaternion.identity();a.lower.quaternion.identity();}
 rig.root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);rig.root.add(mesh);mesh.bind(skeleton);rig.arms.forEach((a,i)=>{a.upper.quaternion.copy(saved[i*2]);a.lower.quaternion.copy(saved[i*2+1]);});
 const far=new THREE.SkinnedMesh(distantGeometry(g,.035),mat);far.castShadow=true;far.receiveShadow=true;far.frustumCulled=false;far.visible=false;rig.root.add(far);far.bind(skeleton,mesh.bindMatrix);rig.lod.push({near:[mesh],far});return {mesh,far,skeleton};
}
