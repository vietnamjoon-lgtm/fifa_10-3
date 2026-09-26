import {distantGeometry} from './geometry-lod.js';
import * as THREE from '../vendor/three.module.js';
import {anatomy} from './anatomy-data.js';
import {bodyPoint,bodyMetrics} from './body-shape.js';
import {createHumanDeformation,updateHumanDeformation} from './human-deformation.js';
import {dualQuaternionShader} from './dual-quaternion.js';
import {addHumanCorrectives,updateHumanCorrectives} from './human-correctives.js';
// Retargeted CC0 anatomy: actual shoulder, elbow, knee and hand topology.
export function createAnatomicalBody(rig,colors){
 const bones=[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(a=>[a.upper,a.lower]),...rig.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
 const g=new THREE.BufferGeometry(),positions=new Float32Array(anatomy.body.positions),armWeights=[];
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(anatomy.body.indices);g.computeVertexNormals();const normals=g.attributes.normal;
 const wardrobePositions=positions.slice(),metrics=rig.bodyMetrics||bodyMetrics();
 for(let i=0;i<positions.length/3;i++){let arm=0;for(let k=0;k<4;k++){const b=anatomy.body.skinIndices[i*4+k];if(b>=3&&b<=6)arm+=anatomy.body.skinWeights[i*4+k];}armWeights.push(arm);const x=positions[i*3],y=positions[i*3+1],neck=1.42+.13*Math.min(1,Math.abs(x)/.15),top=neck*(1-arm)+1.23*arm,shirt=(1-arm)*THREE.MathUtils.smoothstep(y,.95,.97)*(1-THREE.MathUtils.smoothstep(y,neck-.012,neck))+arm*THREE.MathUtils.smoothstep(y,1.225,1.235),shorts=THREE.MathUtils.smoothstep(y,.70,.72)*(1-THREE.MathUtils.smoothstep(y,.96,.975))*(1-arm),yoke=Math.exp(-(((y-1.40)/.07)**2)),thickness=shirt*(.012-.007*yoke)+shorts*.014;positions[i*3]+=normals.getX(i)*thickness;positions[i*3+1]+=normals.getY(i)*thickness*.35;positions[i*3+2]+=normals.getZ(i)*thickness;}
 for(let i=0;i<positions.length/3;i++){const source=positions.slice(i*3,i*3+3),out=[0,0,0];for(let k=0;k<4;k++){const w=anatomy.body.skinWeights[i*4+k];if(!w)continue;const p=bodyPoint(...source,anatomy.body.skinIndices[i*4+k],metrics);for(let j=0;j<3;j++)out[j]+=p[j]*w;}positions.set(out,i*3);}
 g.setAttribute('wardrobePosition',new THREE.BufferAttribute(wardrobePositions,3));g.setAttribute('wardrobeArm',new THREE.Float32BufferAttribute(armWeights,1));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(anatomy.detail.skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(anatomy.detail.skinWeights,4));g.computeVertexNormals();
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
 `);dualQuaternionShader(shader);};
 mat.customProgramCacheKey=()=> 'human-dqs-wardrobe-v1';
 addHumanCorrectives(g,rig);const mesh=new THREE.SkinnedMesh(g,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),distance=new THREE.MeshDistanceMaterial();for(const material of [depth,distance]){material.onBeforeCompile=dualQuaternionShader;material.customProgramCacheKey=()=> 'human-dqs-shadow-v1';}mesh.customDepthMaterial=depth;mesh.customDistanceMaterial=distance;
 // Data is baked at these neutral bone angles, not at the previous mannequin pose.
 const saved=rig.arms.flatMap(a=>[a.upper.quaternion.clone(),a.lower.quaternion.clone()]);for(const a of rig.arms){a.upper.quaternion.identity();a.lower.quaternion.identity();}
 rig.root.updateMatrixWorld(true);const detail=createHumanDeformation(rig),skeleton=new THREE.Skeleton(detail.bones);rig.root.add(mesh);mesh.bind(skeleton);
 const rootInverse=rig.root.matrixWorld.clone().invert(),spine=detail.specs.map((b,i)=>({b,i,y:bodyPoint(...b.position,b.control,metrics)[1]})).filter(v=>v.b.name.startsWith('spine')).sort((a,b)=>a.y-b.y);
 rig.details=(rig.details||[]).map(label=>{const geometry=label.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse,label.matrixWorld)),index=[],weight=[];for(let v=0;v<geometry.attributes.position.count;v++){const y=geometry.attributes.position.getY(v);let j=1;while(j<spine.length-1&&y>spine[j].y)j++;const a=spine[j-1],b=spine[j],t=THREE.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1);index.push(a.i,b.i,0,0);weight.push(1-t,t,0,0);}geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(index,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));label.material.onBeforeCompile=dualQuaternionShader;label.material.customProgramCacheKey=()=> 'human-dqs-label-v1';const replacement=new THREE.SkinnedMesh(geometry,label.material);replacement.frustumCulled=false;rig.root.add(replacement);replacement.bind(skeleton,mesh.bindMatrix);label.removeFromParent();label.geometry.dispose();return replacement;});
 const update=skeleton.update.bind(skeleton);skeleton.update=()=>{updateHumanDeformation(rig,rig.animationPlayer,rig.animationTime);updateHumanCorrectives(rig,[mesh,garment]);update();};
 rig.arms.forEach((a,i)=>{a.upper.quaternion.copy(saved[i*2]);a.lower.quaternion.copy(saved[i*2+1]);});
 // A real offset garment shell, with roomy cuffs/hem and shallow woven folds.
 const clothing=g.clone(),clothPositions=clothing.attributes.position,clothNormals=clothing.attributes.normal,clothIndices=[];
 for(let i=0;i<clothPositions.count;i++){const y=wardrobePositions[i*3+1],x=wardrobePositions[i*3],arm=armWeights[i],hem=Math.exp(-(((y-.966)/.035)**2)),cuff=Math.exp(-(((y-(arm>.5?1.23:.71))/.028)**2)),yoke=Math.exp(-(((y-1.40)/.07)**2))*(1-arm),offset=(.007+.012*hem+.009*cuff+.0025*Math.sin(x*95+y*42)*Math.sin(y*79))*(1-.55*yoke);for(let axis=0;axis<3;axis++)clothPositions.array[i*3+axis]+=clothNormals.array[i*3+axis]*offset;}
 for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];if(ids.every(v=>[1,2].includes(anatomy.body.regions[v])))clothIndices.push(...ids);}
 clothing.setIndex(clothIndices);clothing.computeVertexNormals();const garment=new THREE.SkinnedMesh(clothing,mat);garment.castShadow=true;garment.frustumCulled=false;garment.customDepthMaterial=depth;garment.customDistanceMaterial=distance;rig.root.add(garment);garment.bind(skeleton,mesh.bindMatrix);
 const farSource=g.clone();farSource.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(anatomy.body.skinIndices,4));farSource.setAttribute('skinWeight',new THREE.Float32BufferAttribute(anatomy.body.skinWeights,4));
 const farMat=mat.clone();farMat.onBeforeCompile=shader=>{const original=shader.vertexShader;mat.onBeforeCompile(shader);shader.vertexShader=original.replace('#include <common>','#include <common>\nattribute vec3 wardrobePosition; attribute float wardrobeArm; varying vec3 vWardrobe; varying float vArm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWardrobe=wardrobePosition;vArm=wardrobeArm;');};farMat.customProgramCacheKey=()=> 'human-lbs-wardrobe-v1';
 // Capture neutral bind matrices, not the relaxed upper-arm pose restored above.
 const posed=rig.arms.flatMap(a=>[a.upper.quaternion.clone(),a.lower.quaternion.clone()]);for(const a of rig.arms){a.upper.quaternion.identity();a.lower.quaternion.identity();}rig.root.updateMatrixWorld(true);
 const farSkeleton=new THREE.Skeleton(bones),far=new THREE.SkinnedMesh(distantGeometry(farSource,.035),farMat);farSource.dispose();far.castShadow=true;far.receiveShadow=true;far.frustumCulled=false;far.visible=false;rig.root.add(far);far.bind(farSkeleton,mesh.bindMatrix);rig.arms.forEach((a,i)=>{a.upper.quaternion.copy(posed[i*2]);a.lower.quaternion.copy(posed[i*2+1]);});
 const updateWorld=detail.group.updateMatrixWorld.bind(detail.group);detail.group.updateMatrixWorld=force=>{if(!rig.distant)updateWorld(force);};rig.lod.push({near:[mesh,garment],far});return {mesh,garment,far,skeleton,farSkeleton};
}
