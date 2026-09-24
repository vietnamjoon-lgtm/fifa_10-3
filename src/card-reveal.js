import * as THREE from 'three';
import {createPlayer,animatePlayer,disposePlayerRig} from './player.js';
import {flagUrl} from './card-data.js';
// FC 온라인 개봉 화면을 참고한 시네마틱. 카메라가 멈추지 않고 세 공간을 통과합니다.
// 초록 복도 → 문 통과와 화이트아웃 → 회색 터널(국가·포지션·소속팀) → 스타디움 피날레.
const HALL={x:2.6,y:3.4,front:4,back:-16};
const TUNNEL={x:3.2,y:4.2,front:-22,back:-46};
const STAGE={z:-57,floor:-48};
const RUN_TIME=4.2,RUN_FROM=-11.4,RUN_DISTANCE=10.6;
const TIER_LABEL={bronze:'bronze',silver:'silver',gold:'gold',special:'special'};
// 전체를 천천히 보여 주려고 구간 길이를 한꺼번에 늘립니다.
const PACE=1.5;
const PHASES=[
 {id:'pack',time:.9*PACE},
 {id:'charge',time:1.5*PACE},
 {id:'whiteout',time:.25*PACE},
 {id:'tunnel',time:2.4*PACE},
 {id:'exit',time:1*PACE},
 {id:'stadium',time:99}
];
const ease=t=>t<.5?2*t*t:1-((-2*t+2)**2)/2;
const easeIn=t=>t*t*t;
// 국기 이미지를 패널 가운데에 맞춰 그립니다. 못 불러오면 나라 이름 글자로 돌아갑니다.
function flagTexture(image,label){
 const width=1024,height=768;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#0b0f0d';ctx.fillRect(0,0,width,height);
 const box=width*.66,scale=Math.min(box/image.width,box/image.height);
 const w=image.width*scale,h=image.height*scale;
 ctx.drawImage(image,(width-w)/2,(height-h)/2-40,w,h);
 ctx.fillStyle='#e9f2ea';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font="700 78px 'Barlow Condensed',Impact,sans-serif";
 ctx.fillText(String(label),width/2,(height+h)/2+22);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 return texture;
}
// 관중석에 쓸 점묘 질감. 멀리서 보면 사람들이 앉아 있는 것처럼 보입니다.
function crowdTexture(){
 const size=256;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#14181c';ctx.fillRect(0,0,size,size);
 let seed=97;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let row=0;row<26;row++)for(let i=0;i<70;i++){
  const shade=120+Math.floor(next()*90);
  ctx.fillStyle=`rgba(${shade},${shade-16},${shade-34},${.32+next()*.4})`;
  ctx.fillRect(next()*size,row*10+next()*5,2.4,2.4);
 }
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(16,1);
 return texture;
}
const flagCache=new Map();
function loadFlag(url){
 if(!url)return Promise.resolve(null);
 if(!flagCache.has(url))flagCache.set(url,new Promise(resolve=>{
  const image=new Image();
  image.onload=()=>resolve(image);image.onerror=()=>resolve(null);
  image.src=url;
 }));
 return flagCache.get(url);
}
function panelTexture(lines,color='#ffffff',background='#0b0f0d'){
 const width=1024,height=768;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
 ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
 const items=[].concat(lines);
 items.forEach((text,i)=>{
  ctx.font=`700 ${i?92:240}px 'Barlow Condensed',Impact,sans-serif`;
  ctx.fillText(String(text),width/2,items.length>1?(i?516:340):384);
 });
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
 return texture;
}
export class CardReveal{
 constructor(canvas){
  this.canvas=canvas;this.rig=null;this.frame=null;this.neon=[];this.sparks=[];
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();
  // 옅은 안개로 깊이를 살려 복도와 스타디움이 납작해 보이지 않게 합니다.
  this.scene.fog=new THREE.Fog(0x05080a,14,72);
  this.camera=new THREE.PerspectiveCamera(46,1,.05,140);
  this.buildLights();this.buildHall();this.buildTunnel();this.buildStadium();
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas);
 }
 buildLights(){
  this.scene.add(new THREE.HemisphereLight(0xcfe4ff,0x1a1d18,1.2));
  const key=new THREE.DirectionalLight(0xfff4e6,2.6);key.position.set(-2,4,6);this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xe9f4ff,1.2);fill.position.set(3,2,4);this.scene.add(fill);
  // 스타디움 전용 주광만 그림자를 만들어 선수 발밑이 떠 보이지 않게 합니다.
  const stageKey=new THREE.DirectionalLight(0xfff6ea,2.2);
  stageKey.position.set(-3,7,STAGE.z+7);stageKey.target.position.set(.6,0,STAGE.z);
  stageKey.castShadow=true;stageKey.shadow.mapSize.set(1024,1024);
  stageKey.shadow.camera.near=1;stageKey.shadow.camera.far=22;
  for(const [edge,value] of [['left',-7],['right',7],['top',7],['bottom',-5]])stageKey.shadow.camera[edge]=value;
  stageKey.shadow.bias=-.0012;
  this.scene.add(stageKey.target);this.scene.add(stageKey);
  this.glow=new THREE.PointLight(0xffffff,20,26,2);this.glow.position.set(0,1.9,HALL.back);this.scene.add(this.glow);
  this.stageLight=new THREE.PointLight(0xffffff,26,30,2);this.stageLight.position.set(0,3.4,STAGE.z+3);this.scene.add(this.stageLight);
 }
 // 1구역: 벽에 큰 패널이 걸린 초록 네온 복도와, 끝의 문 안에 떠 있는 팩.
 buildHall(){
  const shell=new THREE.MeshStandardMaterial({color:0x0d1210,roughness:.92,side:THREE.DoubleSide});
  const depth=HALL.front-HALL.back;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HALL.x*2,depth),shell);
  floor.rotation.x=-Math.PI/2;floor.position.z=(HALL.front+HALL.back)/2;this.scene.add(floor);
  const ceiling=floor.clone();ceiling.position.y=HALL.y;ceiling.rotation.x=Math.PI/2;this.scene.add(ceiling);
  const brand=panelTexture(['TOUCHLINE','THE CLUB IS YOURS'],'#eafff0','#12271c');
  for(const side of [-1,1]){
   const wall=new THREE.Mesh(new THREE.PlaneGeometry(depth,HALL.y),shell);
   wall.rotation.y=side*Math.PI/2;wall.position.set(side*HALL.x,HALL.y/2,(HALL.front+HALL.back)/2);this.scene.add(wall);
   const panel=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),new THREE.MeshBasicMaterial({map:brand}));
   panel.rotation.y=side*Math.PI/2;panel.position.set(side*(HALL.x-.02),1.85,-5.5);this.scene.add(panel);
  }
  const strip=new THREE.BoxGeometry(.06,.06,depth);
  for(const x of [-HALL.x,HALL.x])for(const y of [.04,HALL.y-.04]){
   const mat=new THREE.MeshBasicMaterial({color:0xffffff});this.neon.push(mat);
   const line=new THREE.Mesh(strip,mat);line.position.set(x,y,(HALL.front+HALL.back)/2);this.scene.add(line);
  }
  // 복도 끝 네온 문틀과 그 안에서 도는 팩.
  this.door=new THREE.Group();this.door.position.z=HALL.back;this.scene.add(this.door);
  const frame=new THREE.BoxGeometry(.09,2.9,.09),bar=new THREE.BoxGeometry(1.9,.09,.09);
  for(const x of [-.95,.95]){const mat=new THREE.MeshBasicMaterial({color:0xffffff});this.neon.push(mat);const post=new THREE.Mesh(frame,mat);post.position.set(x,1.45,0);this.door.add(post);}
  for(const y of [.02,2.88]){const mat=new THREE.MeshBasicMaterial({color:0xffffff});this.neon.push(mat);const cross=new THREE.Mesh(bar,mat);cross.position.set(0,y,0);this.door.add(cross);}
  // 문 안에 뜨는 팩. 앞면에 등급 이름이 찍혀 있어 그냥 상자처럼 보이지 않습니다.
  this.packFaceMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.42,metalness:.25});
  this.packMat=new THREE.MeshStandardMaterial({color:0x2a1c10,roughness:.5,metalness:.3});
  this.pack=new THREE.Mesh(new THREE.BoxGeometry(.78,1.12,.05),[this.packMat,this.packMat,this.packMat,this.packMat,this.packFaceMat,this.packMat]);
  this.pack.position.set(0,1.5,-.3);this.door.add(this.pack);
  this.flare=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}));
  this.flare.position.set(0,1.5,-.25);this.door.add(this.flare);
 }
 // 2구역: 회색 갈비뼈 터널. 끝 패널에 국가·포지션·소속팀이 차례로 뜹니다.
 buildTunnel(){
  const shell=new THREE.MeshStandardMaterial({color:0x2b2f31,roughness:.85,side:THREE.DoubleSide});
  const depth=TUNNEL.front-TUNNEL.back,mid=(TUNNEL.front+TUNNEL.back)/2;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(TUNNEL.x*2,depth),new THREE.MeshStandardMaterial({color:0x3a3d3f,roughness:.9}));
  floor.rotation.x=-Math.PI/2;floor.position.z=mid;this.scene.add(floor);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(TUNNEL.x*2,depth),shell);
  ceiling.rotation.x=Math.PI/2;ceiling.position.set(0,TUNNEL.y,mid);this.scene.add(ceiling);
  for(const side of [-1,1]){
   const wall=new THREE.Mesh(new THREE.PlaneGeometry(depth,TUNNEL.y),shell);
   wall.rotation.y=side*Math.PI/2;wall.position.set(side*TUNNEL.x,TUNNEL.y/2,mid);this.scene.add(wall);
  }
  const ribGeometry=new THREE.BoxGeometry(.12,.12,TUNNEL.x*2.1),ribMat=new THREE.MeshBasicMaterial({color:0xd6e2e8});
  for(let z=TUNNEL.front;z>TUNNEL.back;z-=2.2){
   const rib=new THREE.Mesh(ribGeometry,ribMat);rib.rotation.y=Math.PI/2;rib.position.set(0,TUNNEL.y-.12,z);this.scene.add(rib);
   for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.1,TUNNEL.y,.1),ribMat);post.position.set(side*(TUNNEL.x-.06),TUNNEL.y/2,z);this.scene.add(post);}
  }
  this.panelMat=new THREE.MeshBasicMaterial({map:panelTexture(['']),transparent:true});
  this.panel=new THREE.Mesh(new THREE.PlaneGeometry(3.4,2.55),this.panelMat);
  this.panel.position.set(0,2,TUNNEL.back+.1);this.scene.add(this.panel);
 }
 // 3구역: 터널을 빠져나오면 펼쳐지는 스타디움. 관중석, 조명탑, 스크린, 단상, 불꽃이 있습니다.
 buildStadium(){
  const grass=new THREE.Mesh(new THREE.PlaneGeometry(70,40),new THREE.MeshStandardMaterial({color:0x1f4a22,roughness:.95}));
  grass.rotation.x=-Math.PI/2;grass.position.z=STAGE.floor-16;grass.receiveShadow=true;this.scene.add(grass);
  // 잔디 줄무늬와 흰 라인으로 경기장 느낌을 냅니다.
  const stripe=new THREE.MeshStandardMaterial({color:0x245227,roughness:.95});
  for(let i=-5;i<=5;i+=2){
   const band=new THREE.Mesh(new THREE.PlaneGeometry(70,3.6),stripe);
   band.rotation.x=-Math.PI/2;band.position.set(0,.01,STAGE.z+4+i*3.6);this.scene.add(band);
  }
  const lineMat=new THREE.MeshBasicMaterial({color:0xdcefdc,transparent:true,opacity:.5});
  for(const z of [STAGE.z+9,STAGE.z-11]){
   const line=new THREE.Mesh(new THREE.PlaneGeometry(52,.16),lineMat);
   line.rotation.x=-Math.PI/2;line.position.set(0,.02,z);this.scene.add(line);
  }
  // 관중석을 세 단으로 쌓고 점점이 박힌 관중 질감을 입힙니다.
  const crowd=new THREE.MeshStandardMaterial({map:crowdTexture(),roughness:1,side:THREE.BackSide});
  for(const [i,radius] of [23,26,29].entries()){
   const tier=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,4.5,48,1,true),crowd);
   tier.position.set(0,2.6+i*4.2,STAGE.z-6);this.scene.add(tier);
  }
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(30,30,.5,48,1,true),new THREE.MeshStandardMaterial({color:0x15181c,roughness:1,side:THREE.BackSide}));
  roof.position.set(0,15.4,STAGE.z-6);this.scene.add(roof);
  // 조명탑 네 개가 스타디움 모서리에서 빛납니다.
  const lampMat=new THREE.MeshBasicMaterial({color:0xfff6dc});
  for(const [x,z] of [[-15,STAGE.z+9],[15,STAGE.z+9],[-15,STAGE.z-17],[15,STAGE.z-17]]){
   const mast=new THREE.Mesh(new THREE.CylinderGeometry(.18,.26,13,8),new THREE.MeshStandardMaterial({color:0x2a2f33,roughness:.8}));
   mast.position.set(x,6.5,z);this.scene.add(mast);
   const head=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.1,.35),lampMat);
   head.position.set(x,13.2,z);head.lookAt(0,2,STAGE.z);this.scene.add(head);
  }
  this.screenMat=new THREE.MeshBasicMaterial();
  this.screen=new THREE.Mesh(new THREE.PlaneGeometry(11.5,3.4),this.screenMat);
  this.screen.position.set(0,4.3,STAGE.z-5.2);this.scene.add(this.screen);
  for(const side of [-1,1]){
   const wing=new THREE.Mesh(new THREE.PlaneGeometry(4,3.4),this.screenMat);
   wing.position.set(side*7.3,4.3,STAGE.z-3.8);wing.rotation.y=-side*.42;this.scene.add(wing);
  }
  // 선수가 올라설 작은 단상. 카드가 가운데를 차지하므로 오른쪽에 둡니다.
  const podium=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.2,.3,32),new THREE.MeshStandardMaterial({color:0x4a0d18,roughness:.8}));
  podium.position.set(1.35,.15,STAGE.z-.8);podium.receiveShadow=true;podium.castShadow=true;this.scene.add(podium);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.08,.035,8,40),new THREE.MeshBasicMaterial({color:0xffd9a0}));
  rim.rotation.x=Math.PI/2;rim.position.set(1.35,.31,STAGE.z-.8);this.scene.add(rim);
  this.buildFireworks();
 }
 // 불꽃 하나마다 사방으로 퍼지는 입자 묶음을 만들어 둡니다.
 buildFireworks(){
  const spots=[[-5.6,2.4,STAGE.z-3.2],[5.6,2.6,STAGE.z-3.6],[-2.6,3.4,STAGE.z-7],[3.2,3.2,STAGE.z-7.4]];
  const colors=[0xffd27a,0xfff0c4,0xffb4d8,0xa8e8ff];
  for(const [index,spot] of spots.entries()){
   const count=70,positions=new Float32Array(count*3),directions=[];
   let seed=index*911+37;
   const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   for(let i=0;i<count;i++){
    const theta=next()*Math.PI*2,phi=Math.acos(2*next()-1),reach=.55+next()*.45;
    directions.push([Math.sin(phi)*Math.cos(theta)*reach,Math.abs(Math.cos(phi))*reach*.9+.2,Math.sin(phi)*Math.sin(theta)*reach]);
   }
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   const material=new THREE.PointsMaterial({color:colors[index],size:.26,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true,fog:false});
   const burst=new THREE.Points(geometry,material);
   burst.position.set(...spot);
   burst.userData={directions,count,offset:index*1.35};
   this.sparks.push(burst);this.scene.add(burst);
  }
 }
 // 천천히 퍼졌다가 아래로 처지며 사그라듭니다.
 updateFireworks(since){
  const cycle=5.4;
  for(const burst of this.sparks){
   const {directions,count,offset}=burst.userData;
   const phase=((since+offset)%cycle)/cycle;
   const grow=(phase-.06)/.62;
   if(grow<0||grow>1){burst.material.opacity=0;continue;}
   burst.material.opacity=Math.min(1,grow*6)*(1-grow)**1.5;
   const spread=3.6*(1-(1-grow)**2.4),fall=2.6*grow*grow;
   const array=burst.geometry.attributes.position.array;
   for(let i=0;i<count;i++){
    const direction=directions[i];
    array[i*3]=direction[0]*spread;
    array[i*3+1]=direction[1]*spread-fall;
    array[i*3+2]=direction[2]*spread;
   }
   burst.geometry.attributes.position.needsUpdate=true;
  }
 }
 tint(color){
  const tone=new THREE.Color(color);
  for(const mat of this.neon)mat.color.copy(tone);
  this.glow.color.copy(tone);this.stageLight.color.copy(tone).lerp(new THREE.Color(0xffffff),.5);
  this.packMat.color.copy(tone).multiplyScalar(.45);
 }
 setPanel(lines,color){if(this.panelMat.map)this.panelMat.map.dispose();this.panelMat.map=panelTexture(lines,color);this.panelMat.needsUpdate=true;}
 setFlagPanel(image,label){if(this.panelMat.map)this.panelMat.map.dispose();this.panelMat.map=flagTexture(image,label);this.panelMat.needsUpdate=true;}
 setScreen(lines,color){
  if(this.screenMat.map)this.screenMat.map.dispose();
  this.screenMat.map=panelTexture(lines,color,'#2a1208');
  this.screenMat.needsUpdate=true;
 }
 // pick: {card, tier, profile, overall}. onPhase로 화면의 카드 표시를 맞춥니다.
 play(pick,{color='#c6ff5d',onPhase=()=>{},onWhite=()=>{}}={}){
  this.stop();
  this.tint(color);
  this.setScreen([pick.overall,pick.card.club],color);
  if(this.packFaceMat.map)this.packFaceMat.map.dispose();
  this.packFaceMat.map=panelTexture(['PACK',(TIER_LABEL[pick.tier]||'').toUpperCase()],'#f4f8f2','#151a16');
  this.packFaceMat.needsUpdate=true;
  this.cues=[['국가',pick.card.nation],['포지션',pick.card.role],['소속팀',pick.card.club]];
  this.cueIndex=-1;this.flag=null;
  loadFlag(flagUrl(pick.card.nation)).then(image=>{
   this.flag=image;
   // 국기가 늦게 도착해도 국가 화면이 아직 떠 있으면 바로 바꿔 줍니다.
   if(image&&this.phase==='tunnel'&&this.cueIndex===0)this.setFlagPanel(image,pick.card.nation);
  });
  this.pick=pick;this.color=color;this.onPhase=onPhase;this.onWhite=onWhite;
  this.started=performance.now()/1000;this.last=this.started;this.phase=null;this.skipped=false;
  this.frame=requestAnimationFrame(now=>this.tick(now));
 }
 phaseAt(elapsed){
  let start=0;
  for(const phase of PHASES){
   if(elapsed<start+phase.time)return {id:phase.id,t:(elapsed-start)/phase.time,start};
   start+=phase.time;
  }
  return {id:'stadium',t:1,start};
 }
 tick(now){
  this.frame=requestAnimationFrame(next=>this.tick(next));
  const time=now/1000,dt=Math.min(.05,Math.max(.012,time-this.last));this.last=time;
  const elapsed=time-this.started,{id,t}=this.phaseAt(elapsed);
  if(id!==this.phase){this.phase=id;this.onPhase(id);}
  if(id==='pack'){
   this.camera.position.set(0,1.55,2.2);this.camera.lookAt(0,1.5,HALL.back);
   this.pack.rotation.y=elapsed*1.1;
  }else if(id==='charge'){
   const k=easeIn(t);
   this.camera.position.set(0,1.55+k*.05,2.2+(HALL.back+.6-2.2)*k);
   this.camera.lookAt(0,1.5,HALL.back-1);
   this.pack.rotation.y=elapsed*(1.1+k*26);
   this.pack.scale.setScalar(1+k*.5);
   this.flare.material.opacity=Math.max(0,(t-.45)/.55);
   this.onWhite(Math.max(0,(t-.72)/.28));
  }else if(id==='whiteout'){
   this.onWhite(1);
   this.camera.position.set(0,1.7,TUNNEL.front);this.camera.lookAt(0,2,TUNNEL.back);
   this.pack.scale.setScalar(1);this.flare.material.opacity=0;
  }else if(id==='tunnel'){
   this.panel.visible=true;
   this.onWhite(Math.max(0,1-t/.18));
   this.camera.position.set(0,1.7,TUNNEL.front+(TUNNEL.back+4-TUNNEL.front)*t);
   this.camera.lookAt(0,2,TUNNEL.back);
   const cue=Math.min(this.cues.length-1,Math.floor(t*this.cues.length));
   if(cue!==this.cueIndex){
    this.cueIndex=cue;
    if(cue===0&&this.flag)this.setFlagPanel(this.flag,this.cues[0][1]);
    else this.setPanel(this.cues[cue][1],'#ffffff');
   }
  }else{
   // 터널 패널은 지나온 뒤라 시야를 가리지 않게 치웁니다.
   this.panel.visible=false;
   const k=id==='exit'?ease(t):1;
   this.camera.position.set(0,1.75-k*.45,(TUNNEL.back+4)+(STAGE.z+4.3-(TUNNEL.back+4))*k);
   this.camera.lookAt(0,1.15,STAGE.z-.6);
   if(id==='stadium')this.runStadium(elapsed,dt,time);
  }
  this.draw();
 }
 runStadium(elapsed,dt,time){
  const since=elapsed-PHASES.slice(0,5).reduce((sum,p)=>sum+p.time,0);
  if(!this.rig&&this.pick.profile){
   const rig=this.rig=createPlayer(0,this.pick.profile.number,this.pick.profile.role==='GK',this.pick.profile);
   rig.root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
   rig.root.position.set(1.35,0,STAGE.z+RUN_FROM);this.scene.add(rig.root);
   this.playerStart=time;
  }
  if(this.rig){
   // 멀리서 천천히 걸어 나와 단상 위에 선 뒤 세리머니로 넘어갑니다.
   const run=Math.min(1,(time-this.playerStart)/RUN_TIME),running=run<1;
   const z=STAGE.z+RUN_FROM+RUN_DISTANCE*run;
   // 걸음 속도를 실제 이동량에서 뽑아 다리 움직임과 어긋나지 않게 합니다.
   const speed=RUN_DISTANCE/RUN_TIME;
   // 마지막 구간에서만 단상 높이로 올라서게 합니다.
   const lift=.3*Math.max(0,(run-.88)/.12);
   this.rig.root.position.set(1.35,lift,z);
   this.rig.root.rotation.y=running?0:Math.sin(since*.4)*.16;
   const state={...this.pick.profile,id:this.pick.profile.number,x:1.35,z,yaw:0,vx:0,vz:running?speed:0,stamina:1};
   if(!running)state.celebrationStart=this.playerStart+RUN_TIME;
   animatePlayer(this.rig,running?speed:0,dt,time,!running,state);
  }
  this.updateFireworks(since);
  // 멈춰 선 뒤에도 카메라가 아주 천천히 다가가 정지 화면처럼 보이지 않게 합니다.
  const drift=Math.min(1,since/6);
  this.camera.position.set(Math.sin(since*.18)*.35,1.3-drift*.1,STAGE.z+4.3-drift*1.1);
  this.camera.lookAt(0,1.15,STAGE.z-.6);
  for(const [i,spark] of this.sparks.entries()){
   const phase=(since*.75+i*.19)%1.6;
   const live=Math.min(1,phase/.9);
   spark.material.opacity=phase<.9?Math.sin(live*Math.PI)*.8:0;
   spark.scale.set(1,.7+live*1.1,1);
   spark.position.y=.9+live*2.2;
  }
 }
 draw(){
  const w=this.canvas.clientWidth||520,h=this.canvas.clientHeight||360;
  if(!w||!h)return;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.render(this.scene,this.camera);
 }
 // 연출을 건너뛸 때 마지막 상태로 바로 맞춥니다.
 finish(){
  this.started=performance.now()/1000-PHASES.slice(0,5).reduce((sum,p)=>sum+p.time,0)-.01;
 }
 stop(){
  if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;
  if(this.rig){disposePlayerRig(this.rig);this.rig=null;}
  for(const spark of this.sparks)spark.material.opacity=0;
  this.phase=null;
 }
}
