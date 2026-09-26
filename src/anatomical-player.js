import {distantGeometry} from './geometry-lod.js';
import * as THREE from '../vendor/three.module.js';
import {anatomy} from './anatomy-data.js';
import {bodyPoint,bodyMetrics} from './body-shape.js';
import {createHumanDeformation,updateHumanDeformation} from './human-deformation.js';
import {dualQuaternionShader} from './dual-quaternion.js';
import {addHumanCorrectives,updateHumanCorrectives} from './human-correctives.js';
// The source weights let the side of the chest follow the upper arm down to about 1.20 m (up to half its weight), so a
// raised arm dragged the flank up with it into a web joining arm and body. Below the armpit crease that influence now
// fades out and goes to the vertex's own spine bone; the shoulder cap above it keeps the original blend.
const ARM_WEB={bones:new Set([8,9,10,15,16,17]),spine:new Set([1,2,3,4,5]),from:1.3,to:1.46};
let safeWeights=null;
export function torsoSafeWeights(){
 if(safeWeights)return safeWeights;const P=anatomy.body.positions,BI=anatomy.body.skinIndices,BW=anatomy.body.skinWeights,I=anatomy.detail.skinIndices,out=Float32Array.from(anatomy.detail.skinWeights);
 for(let v=0;v<P.length/3;v++){let arm=0;for(let k=0;k<4;k++)if(BI[v*4+k]>=3&&BI[v*4+k]<=6)arm+=BW[v*4+k];if(arm>.5)continue;
  const keep=THREE.MathUtils.smoothstep(P[v*3+1],ARM_WEB.from,ARM_WEB.to);if(keep>=1)continue;let moved=0,spine=-1;
  for(let k=0;k<4;k++){const b=I[v*4+k];if(ARM_WEB.bones.has(b)){moved+=out[v*4+k]*(1-keep);out[v*4+k]*=keep;}else if(ARM_WEB.spine.has(b)&&(spine<0||out[v*4+k]>out[v*4+spine]))spine=k;}
  if(moved>0){if(spine>=0)out[v*4+spine]+=moved;else{const sum=out[v*4]+out[v*4+1]+out[v*4+2]+out[v*4+3]||1;for(let k=0;k<4;k++)out[v*4+k]/=sum;}}}
 return safeWeights=out;
}
// Retargeted CC0 anatomy: actual shoulder, elbow, knee and hand topology.
export function createAnatomicalBody(rig,colors){
 const bones=[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(a=>[a.upper,a.lower]),...rig.legs.flatMap(l=>[l.upper,l.lower,l.foot])];
 const g=new THREE.BufferGeometry(),positions=new Float32Array(anatomy.body.positions),armWeights=[];
 g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(anatomy.body.indices);g.computeVertexNormals();const normals=g.attributes.normal;
 const wardrobePositions=positions.slice(),metrics=rig.bodyMetrics||bodyMetrics();
 for(let i=0;i<positions.length/3;i++){let arm=0;for(let k=0;k<4;k++){const b=anatomy.body.skinIndices[i*4+k];if(b>=3&&b<=6)arm+=anatomy.body.skinWeights[i*4+k];}armWeights.push(arm);const x=positions[i*3],y=positions[i*3+1],neck=1.42+.13*Math.min(1,Math.abs(x)/.15),top=neck*(1-arm)+1.23*arm,shirt=(1-arm)*THREE.MathUtils.smoothstep(y,.95,.97)*(1-THREE.MathUtils.smoothstep(y,neck-.012,neck))+arm*THREE.MathUtils.smoothstep(y,1.225,1.235),shorts=THREE.MathUtils.smoothstep(y,.70,.72)*(1-THREE.MathUtils.smoothstep(y,.96,.975))*(1-arm),yoke=Math.exp(-(((y-1.40)/.07)**2)),thickness=shirt*(.012-.007*yoke)+shorts*.014;positions[i*3]+=normals.getX(i)*thickness;positions[i*3+1]+=normals.getY(i)*thickness*.35;positions[i*3+2]+=normals.getZ(i)*thickness;}
 for(let i=0;i<positions.length/3;i++){const source=positions.slice(i*3,i*3+3),out=[0,0,0];for(let k=0;k<4;k++){const w=anatomy.body.skinWeights[i*4+k];if(!w)continue;const p=bodyPoint(...source,anatomy.body.skinIndices[i*4+k],metrics);for(let j=0;j<3;j++)out[j]+=p[j]*w;}positions.set(out,i*3);}
 g.setAttribute('wardrobePosition',new THREE.BufferAttribute(wardrobePositions,3));g.setAttribute('wardrobeArm',new THREE.Float32BufferAttribute(armWeights,1));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(anatomy.detail.skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(torsoSafeWeights(),4));g.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({roughness:.79});
 // Evaluate garment borders per pixel; interpolated per-vertex colours made torn, triangular necklines.
 mat.onBeforeCompile=shader=>{for(const key of ['skin','kit','shorts','sock'])shader.uniforms['uniform'+key]={value:colors[key]};shader.uniforms.uniformkit2={value:colors.kit2||colors.kit};shader.uniforms.uniformsleeve={value:colors.sleeve||colors.kit};shader.uniforms.uniformpattern=colors.pattern||{value:0};shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 wardrobePosition; attribute float wardrobeArm; varying vec3 vWardrobe; varying float vArm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWardrobe=wardrobePosition; vArm=wardrobeArm;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWardrobe; varying float vArm; uniform vec3 uniformskin,uniformkit,uniformshorts,uniformsock,uniformkit2,uniformsleeve; uniform float uniformpattern;').replace('#include <color_fragment>',`#include <color_fragment>
 float y=vWardrobe.y;
 float neckline=1.42+.13*min(1.0,abs(vWardrobe.x)/.15);
 float top=neckline;
 float torsoShirt=smoothstep(.963,.966,y)*(1.0-smoothstep(top-.002,top+.002,y));
 float shirt=mix(torsoShirt,smoothstep(1.228,1.232,y),vArm);
 float shorts=smoothstep(.708,.712,y)*(1.0-smoothstep(.963,.966,y))*(1.0-vArm);
 float sock=(1.0-smoothstep(.418,.422,y))*(1.0-vArm);
 vec3 clothing=mix(uniformskin,uniformsock,sock);
 clothing=mix(clothing,uniformshorts,shorts);
 // Club kit patterns: 1 vertical stripes, 2 gradient from the second colour at the hem to the shirt colour at the chest,
 // 3 hoops, 4 a faint diamond weave; sleeves take the club's sleeve colour.
 vec3 kitColour=uniformkit;
 if(uniformpattern>.5&&uniformpattern<1.5)kitColour=mix(uniformkit,uniformkit2,step(.5,fract(vWardrobe.x*11.0+.25)));
 else if(uniformpattern>1.5&&uniformpattern<2.5)kitColour=mix(uniformkit2,uniformkit,smoothstep(1.0,1.34,y));
 else if(uniformpattern>2.5&&uniformpattern<3.5)kitColour=mix(uniformkit,uniformkit2,step(.5,fract(y*9.0)));
 else if(uniformpattern>3.5)kitColour=mix(uniformkit,uniformkit2,1.0-step(.22,abs(fract(vWardrobe.x*9.0)-.5)+abs(fract(y*9.0)-.5)));
 kitColour=mix(kitColour,uniformsleeve,vArm);
 clothing=mix(clothing,kitColour,shirt);
 float collar=torsoShirt*smoothstep(top-.014,top-.01,y)*(1.0-vArm);
 diffuseColor.rgb*=mix(clothing,uniformshorts,collar*.7);
 `);dualQuaternionShader(shader);};
 mat.customProgramCacheKey=()=> 'human-dqs-wardrobe-v2';
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
 const farMat=mat.clone();farMat.onBeforeCompile=shader=>{const original=shader.vertexShader;mat.onBeforeCompile(shader);shader.vertexShader=original.replace('#include <common>','#include <common>\nattribute vec3 wardrobePosition; attribute float wardrobeArm; varying vec3 vWardrobe; varying float vArm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWardrobe=wardrobePosition;vArm=wardrobeArm;');};farMat.customProgramCacheKey=()=> 'human-lbs-wardrobe-v2';
 // Capture neutral bind matrices, not the relaxed upper-arm pose restored above.
 const posed=rig.arms.flatMap(a=>[a.upper.quaternion.clone(),a.lower.quaternion.clone()]);for(const a of rig.arms){a.upper.quaternion.identity();a.lower.quaternion.identity();}rig.root.updateMatrixWorld(true);
 const farSkeleton=new THREE.Skeleton(bones),far=new THREE.SkinnedMesh(distantGeometry(farSource,.035),farMat);farSource.dispose();far.castShadow=true;far.receiveShadow=true;far.frustumCulled=false;far.visible=false;rig.root.add(far);far.bind(farSkeleton,mesh.bindMatrix);rig.arms.forEach((a,i)=>{a.upper.quaternion.copy(posed[i*2]);a.lower.quaternion.copy(posed[i*2+1]);});
 const updateWorld=detail.group.updateMatrixWorld.bind(detail.group);detail.group.updateMatrixWorld=force=>{if(!rig.distant)updateWorld(force);};rig.lod.push({near:[mesh,garment],far});return {mesh,garment,far,skeleton,farSkeleton};
}
