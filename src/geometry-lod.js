import * as THREE from '../vendor/three.module.js';
// Vertex clustering for distant silhouettes. Merge skin influences by bone id,
// never average bone indices; this keeps elbows and knees attached when posing.
export function distantGeometry(source,cell){
 const p=source.attributes.position,groups=[],map=new Map(),remap=[];
 const attrs=Object.entries(source.attributes).filter(([n])=>!['normal','skinIndex','skinWeight'].includes(n));
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v/cell)).join(',');let id=map.get(key);
  if(id===undefined){id=groups.length;map.set(key,id);groups.push({count:0,sums:Object.fromEntries(attrs.map(([n,a])=>[n,Array(a.itemSize).fill(0)])),bones:new Map()});}
  remap[i]=id;const g=groups[id];g.count++;for(const [n,a]of attrs)for(let j=0;j<a.itemSize;j++)g.sums[n][j]+=a.array[i*a.itemSize+j];
  if(source.attributes.skinIndex)for(let j=0;j<4;j++){const bone=source.attributes.skinIndex.array[i*4+j],w=source.attributes.skinWeight.array[i*4+j];g.bones.set(bone,(g.bones.get(bone)||0)+w);}
 }
 const out=new THREE.BufferGeometry();for(const [n,a]of attrs)out.setAttribute(n,new THREE.Float32BufferAttribute(groups.flatMap(g=>g.sums[n].map(v=>v/g.count)),a.itemSize));
 if(source.attributes.skinIndex){const indices=[],weights=[];for(const g of groups){const top=[...g.bones].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,x)=>n+x[1],0);for(let j=0;j<4;j++){indices.push(top[j]?.[0]||0);weights.push((top[j]?.[1]||0)/(sum||1));}}out.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));out.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));}
 const indices=[],seen=new Set(),original=source.index?.array||Array.from({length:p.count},(_,i)=>i);for(let i=0;i<original.length;i+=3){const tri=Array.from(original.slice(i,i+3),n=>remap[n]);if(new Set(tri).size<3)continue;const key=[...tri].sort((a,b)=>a-b).join(',');if(seen.has(key))continue;seen.add(key);indices.push(...tri);}out.setIndex(indices);out.computeVertexNormals();out.computeBoundingSphere();return out;
}
