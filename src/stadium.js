import * as THREE from 'three';
import {FIELD} from './config.js';
import {mergeMeshes} from './geometry.js';
const materials=new Map();
const mat=(color,roughness=.85)=>{const key=color+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness}));return materials.get(key);};
function box(parent,x,y,z,w,h,d,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function beam(parent,a,b,r,material){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),material);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(m);return m;}
function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function pitchTexture(){return canvasTexture(3072,2048,(c,w,h)=>{
  c.fillStyle='#337744';c.fillRect(0,0,w,h);
  const image=c.getImageData(0,0,w,h),data=image.data;
  let seed=192;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=(rand()-.5)*17,stripe=Math.floor(x/(w/20))%2?3:-3;data[i]=39+n*.5+stripe;data[i+1]=102+n+stripe;data[i+2]=49+n*.4+stripe;data[i+3]=255;}c.putImageData(image,0,0);
  c.globalAlpha=.07;for(let i=0;i<220000;i++){const x=rand()*w,y=rand()*h;c.strokeStyle=rand()>.5?'#d8dd88':'#061b0b';c.beginPath();c.moveTo(x,y);c.lineTo(x+.4,y+1+rand()*4);c.stroke();}c.globalAlpha=1;
  const sx=w/116,sy=h/78;const X=x=>(x+58)*sx,Y=z=>(z+39)*sy;
  for(const x of [-50,0,50]){const g=c.createRadialGradient(X(x),Y(0),0,X(x),Y(0),sx*7);g.addColorStop(0,'#ae987520');g.addColorStop(1,'#ae987500');c.fillStyle=g;c.fillRect(X(x)-sx*8,Y(0)-sx*8,sx*16,sx*16);}
  c.strokeStyle='#e2ecdf';c.lineWidth=sx*.12;const rect=(x,z,ww,hh)=>c.strokeRect(X(x),Y(z),ww*sx,hh*sy);
  rect(-52.5,-34,105,68);c.beginPath();c.moveTo(X(0),Y(-34));c.lineTo(X(0),Y(34));c.stroke();
  const arc=(x,z,r,a=0,b=Math.PI*2)=>{c.beginPath();c.ellipse(X(x),Y(z),r*sx,r*sy,0,a,b);c.stroke()};arc(0,0,9.15);
  const dot=(x,z)=>{c.fillStyle='#e2ecdf';c.beginPath();c.ellipse(X(x),Y(z),sx*.15,sy*.15,0,0,7);c.fill()};dot(0,0);
  for(const s of [-1,1]){rect(s<0?-52.5:36,-20.16,16.5,40.32);rect(s<0?-52.5:47,-9.16,5.5,18.32);dot(s*41.5,0);arc(s*41.5,0,9.15,s<0?-Math.acos(5.5/9.15):Math.PI-Math.acos(5.5/9.15),s<0?Math.acos(5.5/9.15):Math.PI+Math.acos(5.5/9.15));for(const z of [-34,34])arc(s*52.5,z,1,s<0?(z<0?0:-Math.PI/2):(z<0?Math.PI/2:Math.PI),s<0?(z<0?Math.PI/2:0):(z<0?Math.PI:Math.PI*1.5));}
 });}
function adTexture(){return canvasTexture(2048,128,(c,w,h)=>{c.fillStyle='#c6ff5d';c.fillRect(0,0,w,h);c.fillStyle='#0c261c';c.font='900 italic 58px Arial';c.textBaseline='middle';for(let x=25;x<w;x+=500)c.fillText(x%1000<500?'TOUCHLINE /':'OWN THE MOMENT',x,67);});}
export function buildStadium(scene){
 scene.background=new THREE.Color(0x0c1a25);scene.fog=new THREE.FogExp2(0x112d2c,.0024);
 const hemi=new THREE.HemisphereLight(0xb9d3e0,0x274c22,2.0);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffeed8,3.15);sun.position.set(-35,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:52,bottom:-52,near:5,far:150});sun.shadow.bias=-.0003;sun.shadow.normalBias=.023;sun.shadow.radius=2;scene.add(sun);
 const rim=new THREE.DirectionalLight(0x9acbff,1.1);rim.position.set(30,35,-35);scene.add(rim);
 const stadium=new THREE.Group();scene.add(stadium);
 const asphalt=mat(0x16332b),concrete=mat(0x263b39),metal=mat(0x455e60,.46),white=mat(0xe9eee8,.46),dark=mat(0x101e24);
 box(stadium,0,-.3,0,180,.5,142,asphalt);
 const grass=new THREE.MeshStandardMaterial({map:pitchTexture(),roughness:.95});
 const field=new THREE.Mesh(new THREE.PlaneGeometry(116,78),grass);field.rotation.x=-Math.PI/2;field.position.y=.004;field.receiveShadow=true;stadium.add(field);
 const detail=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#888';c.fillRect(0,0,w,h);for(let i=0;i<7000;i++){c.fillStyle=Math.random()>.5?'#aaa':'#666';c.fillRect(Math.random()*w,Math.random()*h,1,3)}});detail.wrapS=detail.wrapT=THREE.RepeatWrapping;detail.repeat.set(140,95);grass.bumpMap=detail;grass.bumpScale=.027;
 const goals=[];for(const s of [-1,1]){
  const goal=new THREE.Group();stadium.add(goal);goals.push(goal);
  for(const z of [-3.72,3.72])beam(goal,[s*52.5,.06,z],[s*52.5,2.5,z],.06,white);
  beam(goal,[s*52.5,2.5,-3.72],[s*52.5,2.5,3.72],.06,white);
  for(const z of [-3.8,3.8]){beam(goal,[s*52.5,2.5,z],[s*54.85,2.5,z],.035,white);beam(goal,[s*54.85,0,z],[s*54.85,2.5,z],.035,white);}
  const coords=[],add=(a,b)=>coords.push(...a,...b);
  for(let z=-3.8;z<=3.81;z+=.19){add([s*54.85,0,z],[s*54.85,2.5,z]);add([s*52.5,2.5,z],[s*54.85,2.5,z]);}
  for(let y=.05;y<=2.55;y+=.19){add([s*54.85,y,-3.8],[s*54.85,y,3.8]);for(const z of [-3.8,3.8])add([s*52.5,y,z],[s*54.85,y,z]);}
  for(let x=52.5;x<=54.86;x+=.19){for(const z of [-3.8,3.8])add([s*x,0,z],[s*x,2.5,z]);add([s*x,2.5,-3.8],[s*x,2.5,3.8]);}
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));const net=new THREE.LineSegments(geom,new THREE.LineBasicMaterial({color:0xc8d7dd,transparent:true,opacity:.48}));goal.add(net);goal.userData.net={geometry:geom,rest:new Float32Array(coords),side:s,age:2};
  for(const z of [-34,34]){beam(stadium,[s*52.5,0,z],[s*52.5,1.55,z],.025,white);const flag=new THREE.Mesh(new THREE.PlaneGeometry(.5,.33),new THREE.MeshStandardMaterial({color:0xc6ff5d,side:THREE.DoubleSide}));flag.position.set(s*52.5+.24,1.37,z);stadium.add(flag);}
 }
 const adMat=new THREE.MeshStandardMaterial({map:adTexture(),emissive:0xffffff,emissiveMap:adTexture(),emissiveIntensity:.28,roughness:.5});
 for(const s of [-1,1]){const m=box(stadium,0,.55,s*38,112,1.1,.16,adMat);box(stadium,s*58,.55,0,.16,1.1,76,adMat);}
 const crowdGroup=new THREE.Group();stadium.add(crowdGroup);
 const positions=[];for(const s of [-1,1]){
  for(let row=0;row<17;row++){const y=1.4+row*.58,z=s*(42+row*.82);box(stadium,0,y-.42,z,126,.65,1.05,concrete);for(let col=0;col<146;col++){if(col%26<2)continue;positions.push([(col-72.5)*.83,y+.42,z, s<0?0:Math.PI]);}}
  for(let row=0;row<15;row++){const y=1.4+row*.58,x=s*(62+row*.82);box(stadium,x,y-.42,0,1.05,.65,81,concrete);for(let col=0;col<92;col++){if(col%25<2)continue;positions.push([x,y+.42,(col-45.5)*.85,s<0?Math.PI/2:-Math.PI/2]);}}
  box(stadium,0,13,s*56.5,132,.35,13,dark);box(stadium,s*74,11.8,0,12,.35,86,dark);
  for(let x=-62;x<=62;x+=15.5){beam(stadium,[x,2,s*55],[x,14,s*59],.18,metal);beam(stadium,[x,14,s*59],[x,13,s*49],.12,metal);}
  // Upper fascia and illuminated architectural ribbon.
  box(stadium,0,11.4,s*54.5,128,1,.15,dark);box(stadium,0,11.05,s*54.35,128,.09,.08,new THREE.MeshBasicMaterial({color:0x789fa7}));
 }
 // At match distance each spectator spans only a few pixels. Keep every seat,
 // but use compact silhouettes and one cullable batch per stand.
 const bodyGeo=new THREE.SphereGeometry(1,4,3),headGeo=new THREE.SphereGeometry(.11,4,3),dummy=new THREE.Object3D(),color=new THREE.Color();
 const stands=Array.from({length:4},()=>[]);for(const p of positions)stands[Math.abs(p[0])>61?(p[0]<0?0:1):(p[2]<0?2:3)].push(p);
 let seat=0;for(const stand of stands){
  const bodies=new THREE.InstancedMesh(bodyGeo,mat(0xffffff),stand.length),heads=new THREE.InstancedMesh(headGeo,mat(0xc29375),stand.length);
  stand.forEach(([x,y,z,angle],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,angle,0);dummy.scale.set(.2,.31,.13);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);color.set([0x374859,0x567472,0x8c9382,0x8e4638,0xb3c89a,0x263b4c,0x647476][(seat++*13)%7]);bodies.setColorAt(i,color);dummy.position.y=y+.37;dummy.scale.setScalar(1);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);});
  bodies.computeBoundingSphere();heads.computeBoundingSphere();crowdGroup.add(bodies,heads);
 }
 // Four real light gantries, emissive light housings and restrained glow sprites.
 const glowTexture=canvasTexture(64,64,(c)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#e6f6ff');g.addColorStop(.15,'#a6dbff88');g.addColorStop(1,'#9ccaff00');c.fillStyle=g;c.fillRect(0,0,64,64)});
 const lampMaterial=new THREE.MeshBasicMaterial({color:0xe3f0ff});
 for(const x of [-48,48])for(const z of [-43,43]){beam(stadium,[x,0,z],[x,29,z],.28,metal);box(stadium,x,28,z,9,1.8,.45,dark);for(let a=-4;a<=4;a+=1.15)for(const b of [-.5,.2]){box(stadium,x+a,28+b,z-.26,.85,.5,.08,lampMaterial);}const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));spr.position.set(x,28,z);spr.scale.set(18,10,1);stadium.add(spr);}
 for(const x of [-18,18]){box(stadium,x,.38,40,12,.6,1,mat(0x122c21));box(stadium,x,2,41.2,12,.12,2.5,metal);for(let i=-5;i<=5;i++)box(stadium,x+i,.95,40.6,.6,.8,.5,mat(0x315c50));for(const xx of [-6,6])beam(stadium,[x+xx,0,41],[x+xx,2,41],.05,metal);}
 // Large north-stand arena identity.
 const sign=canvasTexture(2048,256,(c,w,h)=>{c.fillStyle='#112721';c.fillRect(0,0,w,h);c.fillStyle='#c6ff5d';c.font='900 italic 140px Arial';c.textAlign='center';c.fillText('TOUCHLINE ARENA',w/2,177);});const signMesh=new THREE.Mesh(new THREE.PlaneGeometry(44,5.5),new THREE.MeshBasicMaterial({map:sign}));signMesh.position.set(0,14,-58);stadium.add(signMesh);
 mergeMeshes(stadium,true);
 return {stadium,field,crowdGroup,sun,goals};
}
export function createBall(){
 const tex=canvasTexture(1024,512,(c,w,h)=>{c.fillStyle='#f5f4df';c.fillRect(0,0,w,h);c.lineWidth=2;c.strokeStyle='#8a9990';for(let y=0;y<7;y++)for(let x=0;x<13;x++){const cx=x*85+(y%2?42:0),cy=y*85;c.beginPath();for(let a=0;a<6;a++){const t=a*Math.PI/3;c.lineTo(cx+47*Math.cos(t),cy+47*Math.sin(t))}c.closePath();c.stroke();if((x+y*2)%4===0){c.fillStyle='#152e23';c.fill();}else if((x+y)%5===0){c.fillStyle='#a4cf48';c.fill();}}});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(FIELD.ballRadius,32,24),new THREE.MeshStandardMaterial({map:tex,roughness:.55}));ball.castShadow=true;return ball;
}
