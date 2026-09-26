import * as THREE from '../vendor/three.module.js';

// Lettering uses the jersey's actual triangles. Projecting a regular plane's
// vertices alone leaves its triangle interiors cutting through cloth folds;
// re-blending interpolated bone weights also diverges under DQS. Keeping the
// source topology, weights and corrective deltas eliminates both errors.
export function uniformLabelProjector(surface){
 const p=surface.attributes.position,n=surface.attributes.normal,ids=surface.index.array;
 return geometry=>{
  const plane=geometry.attributes.position,uv=geometry.attributes.uv,side=geometry.attributes.normal.getZ(0)>=0?1:-1;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,x0=0,x1=0,y0=0,y1=0;
  for(let i=0;i<plane.count;i++){const x=plane.getX(i),y=plane.getY(i);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(uv.getX(i)===0)x0=x;if(uv.getX(i)===1)x1=x;if(uv.getY(i)===0)y0=y;if(uv.getY(i)===1)y1=y;}
  const result=new THREE.BufferGeometry(),sourceVertices=[],remap=new Map(),index=[];
  for(let k=0;k<ids.length;k+=3){const tri=[ids[k],ids[k+1],ids[k+2]],xs=tri.map(i=>p.getX(i)),ys=tri.map(i=>p.getY(i));if(Math.max(...xs)<minX||Math.min(...xs)>maxX||Math.max(...ys)<minY||Math.min(...ys)>maxY||tri.reduce((sum,i)=>sum+n.getZ(i),0)*side<=.15)continue;
   for(const source of tri){if(!remap.has(source)){remap.set(source,sourceVertices.length);sourceVertices.push(source);}index.push(remap.get(source));}
  }
  if(!index.length)throw new Error('Uniform lettering requires an overlapping jersey surface');
  const positions=[],normals=[],texcoords=[],skinIndices=[],skinWeights=[],morphs=(surface.morphAttributes.position||[]).map(()=>[]);let maxCorrection=0;
  for(const source of sourceVertices){const x=p.getX(source),y=p.getY(source),z=p.getZ(source),nx=n.getX(source),ny=n.getY(source),nz=n.getZ(source);positions.push(x+nx*.0015,y+ny*.0015,z+nz*.0015);normals.push(nx,ny,nz);texcoords.push((x-x0)/(x1-x0),(y-y0)/(y1-y0));maxCorrection=Math.max(maxCorrection,Math.abs(z-plane.getZ(0)));
   for(let j=0;j<4;j++){skinIndices.push(surface.attributes.skinIndex.array[source*4+j]);skinWeights.push(surface.attributes.skinWeight.array[source*4+j]);}
   for(let m=0;m<morphs.length;m++)for(let axis=0;axis<3;axis++)morphs[m].push(surface.morphAttributes.position[m].array[source*3+axis]);
  }
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));result.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));result.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeights,4));result.setIndex(index);result.morphTargetsRelative=true;result.morphAttributes.position=morphs.map(data=>new THREE.Float32BufferAttribute(data,3));result.userData.uniformProjection={clamped:0,maxCorrection,sourceVertices,sourceTopology:true};result.computeBoundingSphere();geometry.copy(result);return geometry;
 };
}