import * as THREE from 'three';
import {FIELD} from './config.js';
import {mergeMeshes} from './geometry.js';
const materials=new Map();
const mat=(color,roughness=.85)=>{const key=color+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness}));return materials.get(key);};
function box(parent,x,y,z,w,h,d,material){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function beam(parent,a,b,r,material){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),material);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());parent.add(m);return m;}
function canvasTexture(width,height,draw){const c=document.createElement('canvas');c.width=width;c.height=height;draw(c.getContext('2d'),width,height);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const textureLoader=new THREE.TextureLoader();
function loadTexture(name,anisotropy,srgb=false){const t=textureLoader.load(new URL('./textures/'+name,import.meta.url).href);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=anisotropy;t.minFilter=THREE.LinearMipmapLinearFilter;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
// Pitch surface is shaded procedurally in world space: mowing stripes (anti-aliased, view dependent
// like real mown turf), two rotated grass-detail scales blended by a 57 m macro map so no repeat is
// visible from the gantry, a tangent-space grass normal map that fades out with distance, and the
// FIFA markings as an analytic distance field. Line coverage is box-filtered against the pixel
// footprint, so 12 cm lines stay crisp near the camera and fade (never flicker) when sub-pixel.
const PITCH_FRAGMENT_PARS=`
uniform sampler2D grassAlbedo,grassNormal,pitchMacro;uniform vec3 grassColor,lineColor;uniform float stripeStrength,normalStrength;
varying vec3 vPitchWorld;
// Distance to the nearest marking (x) and that marking's unit normal (yz), in the folded quadrant.
vec3 pitchSegment(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return vec3(length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.)),normalize(vec2(-ba.y,ba.x)));}
vec3 pitchRing(vec2 p,vec2 c,float r){vec2 v=p-c;float l=length(v);return vec3(abs(l-r),l>1e-4?v/l:vec2(1.,0.));}
vec3 pitchSpot(vec2 p,vec2 c,float r){vec2 v=p-c;float l=length(v);return vec3(max(l-r,0.),l>1e-4?v/l:vec2(1.,0.));}
vec3 pitchNearest(vec3 a,vec3 b){return a.x<b.x?a:b;}
vec3 pitchLines(vec2 q){vec3 d=pitchSegment(q,vec2(0.,34.),vec2(52.5,34.));
 d=pitchNearest(d,pitchSegment(q,vec2(52.5,0.),vec2(52.5,34.)));d=pitchNearest(d,vec3(q.x,1.,0.));
 d=pitchNearest(d,pitchSegment(q,vec2(36.,0.),vec2(36.,20.16)));d=pitchNearest(d,pitchSegment(q,vec2(36.,20.16),vec2(52.5,20.16)));
 d=pitchNearest(d,pitchSegment(q,vec2(47.,0.),vec2(47.,9.16)));d=pitchNearest(d,pitchSegment(q,vec2(47.,9.16),vec2(52.5,9.16)));
 d=pitchNearest(d,pitchRing(q,vec2(0.),9.15));
 if(q.x<36.)d=pitchNearest(d,pitchRing(q,vec2(41.5,0.),9.15));
 if(q.x<52.5&&q.y<34.)d=pitchNearest(d,pitchRing(q,vec2(52.5,34.),1.));
 d=pitchNearest(d,pitchSpot(q,vec2(0.),.1));d=pitchNearest(d,pitchSpot(q,vec2(41.5,0.),.1));
 return d;}
// Box-filter a line of half width h against the pixel footprint measured along the line normal.
// Using the analytic normal (not fwidth of an unsigned distance, which vanishes on the line centre)
// keeps thin far lines continuous instead of dashed.
float pitchCoverage(vec2 w,float h){vec3 d=pitchLines(abs(w));vec2 n=d.yz*sign(w);
 float px=max(length(vec2(dot(n,dFdx(w)),dot(n,dFdy(w)))),1e-4);
 return clamp((min(d.x+px*.5,h)-max(d.x-px*.5,-h))/px,0.,1.);}
`;
const PITCH_MAP=`
vec2 pitchXZ=vPitchWorld.xz;
vec3 pitchMacroSample=texture2D(pitchMacro,pitchXZ/57.).rgb;
vec2 pitchUv1=pitchXZ/2.4;mat2 pitchRot=mat2(.8,-.6,.6,.8);vec2 pitchUv2=pitchRot*pitchXZ/3.7+vec2(.31,.17);
float pitchBlend=smoothstep(.32,.68,pitchMacroSample.g);
vec3 pitchDetail=mix(texture2D(grassAlbedo,pitchUv1).rgb,texture2D(grassAlbedo,pitchUv2).rgb,pitchBlend)/.3;
// Mowing bands every 105/18 m across the length; blades lean +-z so contrast depends on view.
float pitchBand=sin((pitchXZ.x+52.5)*3.14159265/5.8333);float pitchStripe=clamp(pitchBand/(fwidth(pitchBand)*1.5+1e-4),-1.,1.);
vec3 pitchView=normalize(cameraPosition-vPitchWorld);
float pitchSheen=1.+stripeStrength*pitchStripe*(.06+.1*abs(pitchView.z));
float pitchWear=smoothstep(.55,.8,pitchMacroSample.b)*(1.-smoothstep(4.,11.,length(vec2(abs(pitchXZ.x)-49.5,pitchXZ.y*.8))))+.35*(1.-smoothstep(1.,6.,length(pitchXZ)));
vec3 pitchColor=grassColor*pitchDetail*mix(.86,1.14,pitchMacroSample.r)*pitchSheen;
pitchColor=mix(pitchColor,pitchColor*vec3(1.45,1.08,.62),clamp(pitchWear,0.,1.)*.55);
float pitchLine=pitchCoverage(pitchXZ,.06);
diffuseColor.rgb=mix(pitchColor,lineColor,pitchLine*.94);
`;
const PITCH_NORMAL=`
#ifdef PITCH_NORMALS
{vec3 n1=texture2D(grassNormal,pitchUv1).xyz*2.-1.,n2=texture2D(grassNormal,pitchUv2).xyz*2.-1.;n2.xy=transpose(pitchRot)*n2.xy;
 vec3 tn=normalize(mix(n1,n2,pitchBlend));float fade=normalStrength*(1.-smoothstep(18.,70.,length(cameraPosition-vPitchWorld)))*(1.-pitchLine);
 tn.xy*=fade;normal=normalize((viewMatrix*vec4(normalize(vec3(tn.x,tn.z,tn.y)),0.)).xyz);}
#endif
`;
export function pitchMaterial(anisotropy=8){
 const material=new THREE.MeshLambertMaterial({color:0xffffff});
 const uniforms={grassAlbedo:{value:loadTexture('grass-albedo.png',anisotropy,true)},grassNormal:{value:loadTexture('grass-normal.png',anisotropy)},pitchMacro:{value:loadTexture('pitch-macro.png',4)},
  grassColor:{value:new THREE.Color(0x2f7a38)},lineColor:{value:new THREE.Color(0xeef3ec)},stripeStrength:{value:1},normalStrength:{value:.6}};
 material.defines={PITCH_NORMALS:''};material.userData.uniforms=uniforms;
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vPitchWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPitchWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=PITCH_FRAGMENT_PARS+shader.fragmentShader.replace('#include <map_fragment>',PITCH_MAP).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+PITCH_NORMAL);};
 material.customProgramCacheKey=()=>'touchline-pitch';
 return material;
}
function adTexture(){return canvasTexture(2048,128,(c,w,h)=>{c.fillStyle='#c6ff5d';c.fillRect(0,0,w,h);c.fillStyle='#0c261c';c.font='900 italic 58px Arial';c.textBaseline='middle';for(let x=25;x<w;x+=500)c.fillText(x%1000<500?'TOUCHLINE /':'OWN THE MOMENT',x,67);});}
// Goal net as a textured grid (back, roof, two sides) with slight sag: mipmapped alpha-blended
// meshes stay soft at distance where 1-px line segments shimmered. Vertex spacing (~.19 m) matches the
// old line net, so animateNets' ripple keeps the same resolution.
function goalNetGeometry(s){const positions=[],uvs=[],index=[],cell=.12;
 const panel=(nu,nv,point)=>{const base=positions.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const [x,y,z,u,v]=point(i/nu,j/nv);positions.push(x,y,z);uvs.push(u/cell,v/cell);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=base+j*(nu+1)+i;index.push(a,a+1,a+nu+2,a,a+nu+2,a+nu+1);}};
 const sag=(u,v)=>Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
 panel(40,13,(u,v)=>{const z=-3.8+7.6*u,y=2.5*v;return [s*(54.85+.16*Math.sin(Math.PI*u)*Math.sin(Math.PI*Math.min(1,v*1.15))),y,z,z,y];});
 panel(40,12,(u,v)=>{const z=-3.8+7.6*u,x=52.5+2.35*v;return [s*x,2.5-.13*sag(u,v),z,z,x];});
 for(const side of [-1,1])panel(12,13,(u,v)=>{const x=52.5+2.35*u,y=2.5*v;return [s*x,y,side*(3.8+.07*sag(u,v)),x,y];});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;}
export function buildStadium(scene,{anisotropy=8}={}){
 scene.background=new THREE.Color(0x0c1a25);scene.fog=new THREE.FogExp2(0x112d2c,.0024);
 const hemi=new THREE.HemisphereLight(0xb9d3e0,0x274c22,2.0);scene.add(hemi);
 // Key light: the only real shadow caster. Its frustum is refitted to the players in view each
 // frame (fitShadowToAction), so the map's texels are spent around the action, not the stands.
 const sun=new THREE.DirectionalLight(0xffeed8,3.15);sun.position.set(-35,70,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:52,bottom:-52,near:5,far:180});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;sun.shadow.radius=2;scene.add(sun,sun.target);
 const rim=new THREE.DirectionalLight(0x9acbff,1.1);rim.position.set(30,35,-35);scene.add(rim);
 const fill=new THREE.DirectionalLight(0xe8f0ff,0);fill.position.set(45,32,40);scene.add(fill);
 const stadium=new THREE.Group();scene.add(stadium);
 const asphalt=mat(0x16332b),concrete=mat(0x263b39),metal=mat(0x455e60,.46),white=mat(0xe9eee8,.46),dark=mat(0x101e24);
 box(stadium,0,-.3,0,180,.5,142,asphalt);
 // Grass is diffuse at match distance: Lambert keeps received shadows and the per-pixel grass
 // normal without paying for the player/kit PMREM reflection lookup across the entire pitch.
 const grass=pitchMaterial(anisotropy);
 const field=new THREE.Mesh(new THREE.PlaneGeometry(116,78),grass);field.rotation.x=-Math.PI/2;field.position.y=.004;field.receiveShadow=true;stadium.add(field);
 // Plain alpha blending: the mip-averaged string coverage fades the net naturally with distance.
 const netMaterial=new THREE.MeshLambertMaterial({color:0xf2f6f8,map:loadTexture('goal-net.png',anisotropy),transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide});
 const goals=[];for(const s of [-1,1]){
  const goal=new THREE.Group();stadium.add(goal);goals.push(goal);
  for(const z of [-3.72,3.72])beam(goal,[s*52.5,.06,z],[s*52.5,2.5,z],.06,white);
  beam(goal,[s*52.5,2.5,-3.72],[s*52.5,2.5,3.72],.06,white);
  for(const z of [-3.8,3.8]){beam(goal,[s*52.5,2.5,z],[s*54.85,2.5,z],.035,white);beam(goal,[s*54.85,0,z],[s*54.85,2.5,z],.035,white);}
  const geom=goalNetGeometry(s),net=new THREE.Mesh(geom,netMaterial);net.userData.keepSeparate=true;goal.add(net);
  goal.userData.net={geometry:geom,rest:Float32Array.from(geom.attributes.position.array),side:s,age:2};
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
 const lampMaterial=new THREE.MeshBasicMaterial({color:0xe3f0ff}),glows=[];
 for(const x of [-48,48])for(const z of [-43,43]){beam(stadium,[x,0,z],[x,29,z],.28,metal);box(stadium,x,28,z,9,1.8,.45,dark);for(let a=-4;a<=4;a+=1.15)for(const b of [-.5,.2]){box(stadium,x+a,28+b,z-.26,.85,.5,.08,lampMaterial);}const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));spr.position.set(x,28,z);spr.scale.set(18,10,1);stadium.add(spr);glows.push(spr);}
 for(const x of [-18,18]){box(stadium,x,.38,40,12,.6,1,mat(0x122c21));box(stadium,x,2,41.2,12,.12,2.5,metal);for(let i=-5;i<=5;i++)box(stadium,x+i,.95,40.6,.6,.8,.5,mat(0x315c50));for(const xx of [-6,6])beam(stadium,[x+xx,0,41],[x+xx,2,41],.05,metal);}
 // Large north-stand arena identity.
 const sign=canvasTexture(2048,256,(c,w,h)=>{c.fillStyle='#112721';c.fillRect(0,0,w,h);c.fillStyle='#c6ff5d';c.font='900 italic 140px Arial';c.textAlign='center';c.fillText('TOUCHLINE ARENA',w/2,177);});const signMesh=new THREE.Mesh(new THREE.PlaneGeometry(44,5.5),new THREE.MeshBasicMaterial({map:sign}));signMesh.position.set(0,14,-58);stadium.add(signMesh);
 mergeMeshes(stadium,true);
 return {stadium,field,grass,crowdGroup,sun,rim,fill,hemi,goals,glows,lampMaterial,netMaterial};
}
export function createBall(){
 const tex=canvasTexture(1024,512,(c,w,h)=>{c.fillStyle='#f5f4df';c.fillRect(0,0,w,h);c.lineWidth=2;c.strokeStyle='#8a9990';for(let y=0;y<7;y++)for(let x=0;x<13;x++){const cx=x*85+(y%2?42:0),cy=y*85;c.beginPath();for(let a=0;a<6;a++){const t=a*Math.PI/3;c.lineTo(cx+47*Math.cos(t),cy+47*Math.sin(t))}c.closePath();c.stroke();if((x+y*2)%4===0){c.fillStyle='#152e23';c.fill();}else if((x+y)%5===0){c.fillStyle='#a4cf48';c.fill();}}});
 const ball=new THREE.Mesh(new THREE.SphereGeometry(FIELD.ballRadius,32,24),new THREE.MeshStandardMaterial({map:tex,roughness:.55}));ball.castShadow=true;return ball;
}
// Image-based lighting: a procedural sky, the pitch below and (at night) four warm floodlight banks,
// baked once per lighting preset into a PMREM so skin, kit, ball and posts get soft reflections.
const environmentTextures=new Map();
export function stadiumEnvironment(renderer,preset='night'){
 if(environmentTextures.has(preset))return environmentTextures.get(preset);
 const day=preset==='day',env=new THREE.Scene();
 const sky=new THREE.Mesh(new THREE.SphereGeometry(60,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
  vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec3 vDir;void main(){float h=vDir.y;vec3 top=${day?'vec3(.32,.52,.85)':'vec3(.03,.05,.09)'},horizon=${day?'vec3(.85,.9,.95)':'vec3(.2,.24,.26)'},ground=${day?'vec3(.12,.3,.1)':'vec3(.04,.12,.05)'};vec3 c=h>0.0?mix(horizon,top,pow(h,.55)):mix(horizon,ground,pow(-h,.35));gl_FragColor=vec4(c,1.0);}`}));
 env.add(sky);
 const lamp=new THREE.MeshBasicMaterial({color:day?new THREE.Color(1,.97,.9).multiplyScalar(40):new THREE.Color(1,.94,.84).multiplyScalar(16)});
 if(day){const sun=new THREE.Mesh(new THREE.SphereGeometry(3,16,8),lamp);sun.position.copy(DAY_SUN).setLength(50);env.add(sun);}
 else for(const [x,z] of [[-34,-26],[34,-26],[-34,26],[34,26]]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(12,4.5),lamp);panel.position.set(x,24,z);panel.lookAt(0,0,0);env.add(panel);}
 const stand=new THREE.MeshBasicMaterial({color:day?new THREE.Color(.25,.28,.3):new THREE.Color(.05,.07,.08),side:THREE.BackSide});const ring=new THREE.Mesh(new THREE.CylinderGeometry(52,46,16,32,1,true),stand);ring.position.y=4;env.add(ring);
 const pitch=new THREE.Mesh(new THREE.CircleGeometry(46,32),new THREE.MeshBasicMaterial({color:day?new THREE.Color(.1,.3,.1):new THREE.Color(.05,.18,.06)}));pitch.rotation.x=-Math.PI/2;pitch.position.y=-2;env.add(pitch);
 const pmrem=new THREE.PMREMGenerator(renderer),texture=pmrem.fromScene(env,.03).texture;pmrem.dispose();environmentTextures.set(preset,texture);
 env.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});return texture;
}
// Lighting presets. Day: high afternoon sun from behind the main stand. Night: the near-left
// floodlight tower is the shadow-casting key light, the opposite tower a fill; the other towers'
// shadows are cheap projected decals (FloodShadows) instead of three more shadow-map passes.
const DAY_SUN=new THREE.Vector3(-38,74,52).normalize();
export const FLOODLIGHTS=[[-48,29,43],[48,29,43],[-48,29,-43],[48,29,-43]];
export const LIGHTING={
 day:{background:0x9cc3e2,fog:[0xb5cfdf,.0019],hemi:[0xd8e8f6,0x4c6b35,1.35],key:{color:0xfff1dc,intensity:3.4,direction:DAY_SUN},
  rim:[0xcfe2ff,.55,[30,40,-35]],fill:[0xffffff,0],exposure:.92,environment:.55,lamps:0x9aa4a8,glow:false,grass:0x3a7034,stripes:1,towerShadows:0},
 night:{background:0x08121b,fog:[0x0e2127,.0026],hemi:[0xa9bfd2,0x22401f,1.25],key:{color:0xf4f7ff,intensity:4.4,direction:new THREE.Vector3(-48,29,43).normalize()},
  rim:[0xa8d0ff,1.1,[48,29,-43]],fill:[0xf0f4ff,1.6,[48,29,43]],exposure:1.12,environment:.6,lamps:0xe3f0ff,glow:true,grass:0x336a34,stripes:1.1,towerShadows:.32}
};
export function applyLighting(scene,stadium,renderer,preset='night',quality='high'){
 const L=LIGHTING[preset]||LIGHTING.night;
 scene.background=new THREE.Color(L.background);scene.fog.color.setHex(L.fog[0]);scene.fog.density=L.fog[1];
 stadium.hemi.color.setHex(L.hemi[0]);stadium.hemi.groundColor.setHex(L.hemi[1]);stadium.hemi.intensity=L.hemi[2];
 stadium.sun.color.setHex(L.key.color);stadium.sun.intensity=L.key.intensity;stadium.sun.userData.direction=L.key.direction.clone();
 stadium.rim.color.setHex(L.rim[0]);stadium.rim.intensity=L.rim[1];stadium.rim.position.set(...L.rim[2]);
 stadium.fill.color.setHex(L.fill[0]);stadium.fill.intensity=L.fill[1];stadium.fill.visible=L.fill[1]>0;if(L.fill[2])stadium.fill.position.set(...L.fill[2]);
 stadium.lampMaterial.color.setHex(L.lamps);for(const g of stadium.glows)g.visible=L.glow;
 const u=stadium.grass.userData.uniforms;u.grassColor.value.setHex(L.grass);u.stripeStrength.value=L.stripes;
 const normals=quality!=='low';if(('PITCH_NORMALS' in stadium.grass.defines)!==normals){if(normals)stadium.grass.defines.PITCH_NORMALS='';else delete stadium.grass.defines.PITCH_NORMALS;stadium.grass.needsUpdate=true;}
 renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=L.exposure;
 scene.environment=quality==='low'?null:stadiumEnvironment(renderer,preset);scene.environmentIntensity=L.environment*(quality==='high'?1:.8);
 // PCF with a wider radius on the tight, player-fitted frustum gives a soft penumbra without VSM bleeding.
 renderer.shadowMap.type=THREE.PCFShadowMap;stadium.sun.shadow.radius=quality==='high'?3:2;
 stadium.preset=preset;stadium.towerShadows=L.towerShadows;
}
// Fit the key light's orthographic shadow frustum around the given points (players and ball in
// view). Size is quantised to 4 m steps and only shrinks slowly; the centre snaps to whole texels,
// so the map neither shimmers while panning nor pumps resolution from frame to frame.
const lightView=new THREE.Matrix4(),lightInverse=new THREE.Matrix4(),point=new THREE.Vector3(),origin=new THREE.Vector3();
export function fitShadowToAction(sun,points,dt=1/60){
 const dir=sun.userData.direction||sun.position.clone().normalize();
 lightView.lookAt(origin,dir.clone().negate(),Math.abs(dir.y)>.99?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0));lightInverse.copy(lightView).invert();
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of points)for(const h of [0,2.2]){point.set(p.x,(p.y||0)+h,p.z).applyMatrix4(lightInverse);minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);minZ=Math.min(minZ,point.z);maxZ=Math.max(maxZ,point.z);}
 if(!Number.isFinite(minX)){minX=minY=minZ=-20;maxX=maxY=maxZ=20;}
 const pad=3.5,wanted=Math.max(28,maxX-minX+pad*2,maxY-minY+pad*2),state=sun.userData.fit||(sun.userData.fit={size:wanted});
 const quantised=Math.ceil(wanted/4)*4;state.size=quantised>state.size?quantised:Math.max(quantised,state.size-dt*6);
 const size=Math.ceil(state.size/4)*4,texel=size/sun.shadow.mapSize.x;
 const cx=Math.round((minX+maxX)/2/texel)*texel,cy=Math.round((minY+maxY)/2/texel)*texel;
 // Centre on the ground plane along the light ray through the light-space centre.
 point.set(cx,cy,0).applyMatrix4(lightView);const t=-point.y/dir.y;point.addScaledVector(dir,t);
 sun.target.position.copy(point);sun.position.copy(point).addScaledVector(dir,100);sun.target.updateMatrixWorld();
 // Depth range from the casters' light-space depth; receivers lie up to ~6 m further from the light.
 const lightZ=point.applyMatrix4(lightInverse).z+100,near=Math.max(.5,Math.floor(lightZ-maxZ-4)),far=Math.ceil(lightZ-minZ+14);
 const cam=sun.shadow.camera;if(cam.right!==size/2||cam.near!==near||cam.far!==far){cam.left=cam.bottom=-size/2;cam.right=cam.top=size/2;cam.near=near;cam.far=far;cam.updateProjectionMatrix();}
 return size;
}
// Soft contact shadows under every player plus, at night, faint shadows cast away from the three
// non-key floodlight towers. Two instanced draws in total.
export class FloodShadows{
 constructor(scene,max=26){
  const tex=new THREE.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(0,0,0,1)');r.addColorStop(.55,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return c;})());
  // Tower shadow: darkest at the feet (canvas top = feet end), fading towards the tip, soft sides.
  const streak=new THREE.CanvasTexture((()=>{const c=document.createElement('canvas');c.width=32;c.height=128;const g=c.getContext('2d'),img=g.createImageData(32,128);for(let y=0;y<128;y++)for(let x=0;x<32;x++){const across=Math.exp(-Math.pow((x-15.5)/7.5,2)*2.2),along=Math.pow(1-y/127,1.4)*Math.min(1,y/6+.35);img.data[(y*32+x)*4+3]=Math.round(255*across*along);}g.putImageData(img,0,0);return c;})());
  const geo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),make=(map,opacity,count)=>{const m=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({map,color:0x000000,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),count);m.frustumCulled=false;m.renderOrder=1;m.count=0;scene.add(m);return m;};
  this.contact=make(tex,.3,max);this.tower=make(streak,.2,max*3);this.dummy=new THREE.Object3D();
 }
 update(players,stadium){const d=this.dummy;let n=0,t=0;const strength=stadium.towerShadows||0;this.tower.material.opacity=strength;
  for(const p of players){d.position.set(p.x,.014,p.z);d.rotation.set(0,0,0);d.scale.set(.95,1,.95);d.updateMatrix();this.contact.setMatrixAt(n++,d.matrix);
   if(strength>0)for(let i=1;i<FLOODLIGHTS.length;i++){const [lx,ly,lz]=FLOODLIGHTS[i],dx=p.x-lx,dz=p.z-lz,dist=Math.hypot(dx,dz),length=Math.min(3.4,1.6*dist/ly)+.3;
    d.position.set(p.x+dx/dist*(length*.5-.15),.013,p.z+dz/dist*(length*.5-.15));d.rotation.set(0,Math.atan2(dx,dz),0);d.scale.set(.62,1,length);d.updateMatrix();this.tower.setMatrixAt(t++,d.matrix);}}
  this.contact.count=n;this.tower.count=t;this.contact.instanceMatrix.needsUpdate=true;this.tower.instanceMatrix.needsUpdate=true;}
 set visible(v){this.contact.visible=this.tower.visible=v;}
}
