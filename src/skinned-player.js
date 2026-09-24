import * as THREE from '../vendor/three.module.js';

// One continuous tube per limb. Rings straddle the joints and share bone weights.
// The same skeleton drives two geometry densities, without changing the bind pose.
export function createSkinnedLimbs(rig,materials){
 const {root,hips,torso,arms,legs}=rig,bones=[hips,torso,...arms.flatMap(a=>[a.upper,a.lower]),...legs.flatMap(l=>[l.upper,l.lower])];
 root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
 const skeleton=new THREE.Skeleton(bones),material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.76});
 const make=segments=>{
  const positions=[],colors=[],indices=[],weights=[],skinIndices=[],triangles=[];
  const limb=(upper,lower,isLeg)=>{
   const joint=isLeg?.35:.255,length=isLeg?.745:.47;
   const rings=isLeg?[[.055,.055],[.03,.09],[0,.103],[-.09,.108],[-.18,.093],[-.24,.08],[-.30,.067],[-.335,.064],[-.35,.065],[-.365,.063],[-.395,.062],[-.47,.062],[-.57,.048],[-.68,.039],[-length,.036]]:[[.09,.008],[.073,.047],[.055,.066],[.035,.077],[-.04,.086],[-.11,.078],[-.17,.061],[-.215,.055],[-.24,.054],[-.255,.054],[-.27,.054],[-.30,.052],[-.36,.044],[-.43,.034],[-length,.031]];
   const transform=new THREE.Matrix4().multiplyMatrices(inverse,upper.matrixWorld),u=bones.indexOf(upper),l=bones.indexOf(lower),parent=isLeg?0:1,start=positions.length/3;
   for(const [y,radius]of rings){const d=-y,t=THREE.MathUtils.smoothstep(d,joint-.085,joint+.085),parentWeight=isLeg?Math.max(0,(.05-d)/.1):Math.max(0,(.055-d)/.13);
    const color=isLeg?(d<.20?materials.shorts:d<.39?materials.skin:materials.sock):(d<.135?materials.kit:materials.skin);
    for(let j=0;j<=segments;j++){const theta=j/segments*Math.PI*2,v=new THREE.Vector3(Math.cos(theta)*radius*(isLeg?.94:.91),y,Math.sin(theta)*radius*(isLeg?1.08:1.03)+(isLeg?-.007*Math.exp(-(((d-.48)/.1)**2)):.004*Math.exp(-(((d-.18)/.1)**2)))).applyMatrix4(transform);positions.push(v.x,v.y,v.z);colors.push(color.r,color.g,color.b);skinIndices.push(u,l,parent,0);weights.push((1-t)*(1-parentWeight),t*(1-parentWeight),parentWeight,0);}
   }
   for(let r=0;r<rings.length-1;r++)for(let j=0;j<segments;j++){const a=start+r*(segments+1)+j,b=a+segments+1;triangles.push(a,a+1,b,b,a+1,b+1);}
  };
  arms.forEach(a=>limb(a.upper,a.lower,false));legs.forEach(l=>limb(l.upper,l.lower,true));
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));g.setIndex(triangles);g.computeVertexNormals();
  const mesh=new THREE.SkinnedMesh(g,material);mesh.castShadow=true;mesh.frustumCulled=false;root.add(mesh);mesh.bind(skeleton);return mesh;
 };
 const near=make(20),far=make(7);far.visible=false;
 return {near:[near],far,skeleton};
}
