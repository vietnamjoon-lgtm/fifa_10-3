import * as THREE from '../vendor/three.module.js';
import {stanceFraction} from './motion-planner.js';
// Original boot mesh, measured in metres: 12 mm outsole plus 8 mm studs.
export const BOOT_SURFACES=Object.freeze({instep:[0,.016,.085],inside:[.061,-.015,.071],outside:[-.061,-.015,.071],sole:[0,-.075,.073],toe:[0,-.036,.185]});
function shell(rings,material){const positions=[],indices=[],n=16;for(const [z,width,height,center]of rings)for(let k=0;k<n;k++){const a=k/n*Math.PI*2;positions.push(Math.cos(a)*width,center+Math.sin(a)*height,z);}for(let j=0;j<rings.length-1;j++)for(let k=0;k<n;k++){const a=j*n+k,b=j*n+(k+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.castShadow=true;return m;}
export function createFootballBoot(ankle,color){
 const foot=new THREE.Group();foot.name='boot';ankle.add(foot);
 const upper=new THREE.MeshStandardMaterial({color,roughness:.48}),sole=new THREE.MeshStandardMaterial({color:0x222726,roughness:.55}),lace=new THREE.MeshStandardMaterial({color:0xecebdc,roughness:.88});
 const back=[[-.082,.001,.001,-.034],[-.075,.041,.028,-.022],[-.04,.049,.044,-.015],[.012,.049,.053,-.012],[.065,.058,.038,-.023],[.095,.061,.026,-.032]],front=[[.095,.061,.026,-.032],[.14,.06,.023,-.033],[.172,.042,.016,-.035],[.188,.001,.001,-.04]];
 foot.add(shell(back,upper));const toe=new THREE.Group();toe.name='MTP';toe.position.z=.095;foot.add(toe);const frontMesh=shell(front.map(r=>[r[0]-.095,...r.slice(1)]),upper);toe.add(frontMesh);
 for(const [group,rings,offset]of [[foot,back,0],[toe,front,.095]]){group.add(shell(rings.map(([z,w])=>[z-offset,w+.001,.006,-.061]),sole));for(const z of group===foot?[-.049,.047]:[.133])for(const sign of [-1,1]){const stud=new THREE.Mesh(new THREE.CylinderGeometry(.006,.005,.008,6),sole);stud.position.set(sign*.035,-.071,z-offset);group.add(stud);}}
 for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.CapsuleGeometry(.002,.059,2,5),lace);m.rotation.z=Math.PI/2+(i%2?.07:-.07);m.position.set(0,.033-i*.004,.007+i*.013);foot.add(m);}
 ankle.userData.toe=toe;ankle.userData.boot=foot;ankle.userData.contactSurfaces=BOOT_SURFACES;return toe;
}
export function updateBoots(rig,pose,speed){const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};for(let i=0;i<2;i++){const {toe,boot}=rig.legs[i].foot.userData;if(!toe||!boot)continue;const cycle=((rig.phase/(2*Math.PI)+i*.5)%1+1)%1,stance=stanceFraction(speed),amplitude=.45*smooth(speed/3),u=cycle<stance?cycle/stance:(cycle-stance)/(1-stance),angle=cycle<stance?amplitude*smooth((u-.55)/.45):amplitude*(1-smooth(u/.55));
 const theta=pose.gaitTargets?angle:0,pivotY=-.075,pivotZ=.095;boot.rotation.x=theta;boot.position.y=pivotY-(pivotY*Math.cos(theta)-pivotZ*Math.sin(theta));boot.position.z=(pivotZ-(pivotY*Math.sin(theta)+pivotZ*Math.cos(theta)))*(rig.bodyMetrics?.foot||1);toe.rotation.x=-theta;
}}
