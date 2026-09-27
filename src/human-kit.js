// Club kit on the Rocketbox football players (assets/human/rocketbox). The body texture keeps the painted skin,
// boot soles and a neutral fabric shade (grey 128 = 1.0) for the kit; kit-mask.png says which part each texel
// belongs to. Club colours, pattern, trims, numbers, name, sponsor and crest are applied in the shader, so every
// club and player shares the same textures and one shader program.
import * as THREE from 'three';

// Where each decal is drawn in the per-player canvas (x, y, w, h in pixels of a 512 x 512 canvas).
const CELLS={backNumber:[0,256,200,256],backName:[0,0,512,128],sponsor:[0,128,256,128],crest:[256,128,128,128],shortsNumber:[384,128,128,128]};
export const DECALS=Object.keys(CELLS);
const NEUTRAL=.21586; // sRGB 128 in linear light

const SPORT_FONT='"Arial Narrow","Roboto Condensed","Helvetica Neue",Arial,sans-serif';
const luminance=hex=>{const n=parseInt(String(hex).replace('#','').padEnd(6,'0').slice(0,6),16);return (.2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255))/255;};
/**
 * Shirt lettering: bold condensed figures with a thin contrasting outline, names spaced out like printed
 * kit names. `condense` narrows the glyphs, `spacing` adds letter spacing (em).
 */
function fitText(g,text,[x,y,w,h],weight,color,{condense=.86,spacing=0,outline=true}={}){
 x+=6;y+=6;w-=12;h-=12; // keep clear of the neighbouring cells
 g.save();g.textAlign='center';g.textBaseline='middle';let size=h*.9;const font=()=>{g.font=`${weight} ${size}px ${SPORT_FONT}`;if('letterSpacing' in g)g.letterSpacing=`${spacing*size}px`;};font();
 const width=g.measureText(text).width*condense;if(width>w*.94){size*=w*.94/width;font();}
 g.translate(x+w/2,y+h*.53);g.scale(condense,1);
 if(outline){g.lineJoin='round';g.lineWidth=Math.max(2,size*.07);g.strokeStyle=luminance(color)>.5?'rgba(10,12,16,.55)':'rgba(255,255,255,.55)';g.strokeText(text,0,0);}
 g.fillStyle=color;g.fillText(text,0,0);g.restore();
}
function drawCrest(g,crest,[x,y,w,h]){
 const c=crest||{shape:'shield',a:'#c6ff5d',b:'#183b27',glyph:'A'},s=Math.min(w,h)/128;g.save();g.translate(x+(w-128*s)/2,y+(h-128*s)/2);g.scale(s,s);g.beginPath();
 if(c.shape==='round')g.arc(64,64,56,0,Math.PI*2);else{g.moveTo(16,12);g.lineTo(112,12);g.lineTo(112,64);g.quadraticCurveTo(112,100,64,118);g.quadraticCurveTo(16,100,16,64);g.closePath();}
 g.save();g.clip();g.fillStyle=c.a;g.fillRect(0,0,128,128);g.fillStyle=c.b;g.fillRect(64,0,64,128);g.restore();g.lineWidth=7;g.strokeStyle='#fff';g.stroke();
 g.fillStyle='#fff';g.font='900 58px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(c.glyph,64,66);g.restore();
}
/** Surname for the back of the shirt: "J. KANG" -> "KANG". */
export const shirtName=name=>String(name||'').trim().split(/[\s.]+/).filter(Boolean).pop()?.toUpperCase()||'';

/** Numbers, name, sponsor and crest for one player. */
export function drawDecals(canvas,{number,name,text,chest,crest}){
 const g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);
 fitText(g,String(number),CELLS.backNumber,'900',text,{condense:.8});fitText(g,shirtName(name),CELLS.backName,'700',text,{condense:.92,spacing:.12,outline:false});
 fitText(g,chest||'',CELLS.sponsor,'900',text,{condense:.9,spacing:.04,outline:false});drawCrest(g,crest,CELLS.crest);fitText(g,String(number),CELLS.shortsNumber,'900',text,{condense:.8});
}

/**
 * Kit colours for a player: shirt, second (pattern), sleeves, trim, shorts, socks, boots, text, gloves.
 * The trim is the club's second colour, or the text colour when the second colour matches the shirt.
 */
export function kitColours(team,{keeper=false,boots='#dce7f0'}={}){
 const k=team?.kit||{},shirt=keeper?(team?.keeper||'#ecc842'):k.shirt||'#d7edc0',second=keeper?shirt:k.second||shirt;
 const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase(),text=keeper?'#1b1b1b':k.text||'#ffffff';
 return {shirt,second,sleeves:keeper?shirt:k.sleeves||shirt,trim:same(second,shirt)?text:second,shorts:k.shorts||'#141414',socks:keeper?shirt:k.socks||'#f2f2f2',
  boots,text,pattern:keeper?0:k.pattern||0,gloves:keeper?'#2f7de1':null};
}

const vertexHead='#include <common>\nattribute vec3 kitBind;\nvarying vec3 vKitBind;';
const fragmentHead=`#include <common>
varying vec3 vKitBind;
uniform sampler2D kitMask,kitMaskSmooth,kitDecals;
uniform vec3 kitShirt,kitSecond,kitSleeve,kitTrim,kitShorts,kitSocks,kitBoots,kitGloves,skinTint;
uniform float kitPattern,kitKeeper;
uniform vec4 decalRect[${DECALS.length}],decalCell[${DECALS.length}];
uniform float decalFlip[${DECALS.length}];
// Antialiased 50% bands (stripes, hoops): 1 where fract(t) is in [.5, 1), edges blurred over one screen pixel.
float band(float t){float w=fwidth(t)*1.5+1e-4;return smoothstep(.5-w,.5+w,abs(fract(t+.25)*2.0-1.0));}
vec3 shirtColour(){
 float y=vKitBind.y,x=vKitBind.x;
 // 1 vertical stripes, 2 gradient from the second colour at the hem to the shirt colour at the chest, 3 hoops, 4 diamond weave.
 if(kitPattern>.5&&kitPattern<1.5)return mix(kitShirt,kitSecond,band(x*11.0+.25));
 if(kitPattern>1.5&&kitPattern<2.5)return mix(kitSecond,kitShirt,smoothstep(.98,1.34,y));
 if(kitPattern>2.5&&kitPattern<3.5)return mix(kitShirt,kitSecond,band(y*9.0));
 if(kitPattern>3.5){float d=abs(fract(x*9.0)-.5)+abs(fract(y*9.0)-.5),w=fwidth(d)*.75+1e-4;return mix(kitShirt,kitSecond,1.0-smoothstep(.22-w,.22+w,d));}
 return kitShirt;
}`;
const fragmentKit=`#include <map_fragment>
vec4 kitM=texture2D(kitMask,vMapUv),kitS=texture2D(kitMaskSmooth,vMapUv); // part ids unfiltered; trim, skin, shine filtered
float kitPart=floor(kitM.r*255.0/40.0+.5);
float kitRough=mix(.78,.42,kitS.a);
if(kitPart>.5&&kitPart<5.5){
 float shade=diffuseColor.r/${NEUTRAL};
 vec3 c=kitPart<1.5?shirtColour():kitPart<2.5?kitSleeve:kitPart<3.5?kitShorts:kitPart<4.5?kitSocks:kitBoots;
 if(kitPart<4.5)c=mix(c,kitTrim,smoothstep(.3,.7,kitS.g));
 for(int i=0;i<${DECALS.length};i++){
  vec4 r=decalRect[i];vec2 d=(vMapUv-r.xy)/(r.zw-r.xy);
  if(d.x>0.0&&d.x<1.0&&d.y>0.0&&d.y<1.0){if(decalFlip[i]>.5)d=1.0-d;vec4 t=texture2D(kitDecals,decalCell[i].xy+clamp(d,.02,.98)*decalCell[i].zw);c=mix(c,t.rgb,t.a);}
 }
 diffuseColor.rgb=c*shade;
 kitRough=kitPart>4.5?.36:mix(.86,.5,kitS.a);
}else if(kitPart>5.5&&kitKeeper>.5){
 diffuseColor.rgb=kitGloves*clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.2,.35,1.3);kitRough=.62;
}else diffuseColor.rgb*=mix(vec3(1.0),skinTint,smoothstep(.2,.8,kitS.b));`;

// Sheen tinted by the fabric (shirt and shorts more, socks less), clear coat only on boot uppers, none on skin.
const kitPhysical=`#include <lights_physical_fragment>
float kitFabric=kitPart>.5&&kitPart<4.5?(kitPart>3.5?.35:1.0):0.0;
material.sheenColor*=kitFabric*(.1+.5*diffuseColor.rgb);
material.clearcoat*=kitPart>4.5&&kitPart<5.5?1.0:0.0;`;
/** Body material: shared textures, per-player uniforms. */
export function kitMaterial({map,normalMap,mask,maskSmooth,layout},colours,decals,tint){
 // Rocketbox normal maps are DirectX style (green = down): lower lip, nose and chin undersides read >0.5.
 // Physical: fabric sheen on the kit and a clear coat on the boot uppers, both masked per part in the shader.
 const m=new THREE.MeshPhysicalMaterial({map,normalMap,normalScale:new THREE.Vector2(1,-1),roughness:.7,metalness:0,sheen:1,sheenRoughness:.55,sheenColor:0xffffff,clearcoat:1,clearcoatRoughness:.28});
 const u=m.userData.kit={kitMask:{value:mask},kitMaskSmooth:{value:maskSmooth||mask},kitDecals:{value:decals},skinTint:{value:tint.clone()},kitPattern:{value:0},kitKeeper:{value:0},
  decalRect:{value:DECALS.map(k=>new THREE.Vector4(...layout.decals[k]))},decalCell:{value:DECALS.map(k=>{const [x,y,w,h]=CELLS[k];return new THREE.Vector4(x/512,y/512,w/512,h/512);})},
  decalFlip:{value:DECALS.map(k=>layout.flipped.includes(k)?1:0)}};
 for(const key of ['Shirt','Second','Sleeve','Trim','Shorts','Socks','Boots','Gloves'])u['kit'+key]={value:new THREE.Color()};
 setKitColours(m,colours);
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
  shader.vertexShader=shader.vertexShader.replace('#include <common>',vertexHead).replace('#include <begin_vertex>','#include <begin_vertex>\nvKitBind=kitBind;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',fragmentHead).replace('#include <map_fragment>',fragmentKit).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=kitRough;').replace('#include <lights_physical_fragment>',kitPhysical);};
 m.customProgramCacheKey=()=> 'rocketbox-kit-v3';
 return m;
}
export function setKitColours(m,c){
 const u=m.userData.kit;u.kitShirt.value.set(c.shirt);u.kitSecond.value.set(c.second);u.kitSleeve.value.set(c.sleeves);u.kitTrim.value.set(c.trim);
 u.kitShorts.value.set(c.shorts);u.kitSocks.value.set(c.socks);u.kitBoots.value.set(c.boots);u.kitGloves.value.set(c.gloves||'#ffffff');u.kitPattern.value=c.pattern;u.kitKeeper.value=c.gloves?1:0;
}

export const HAIR_STYLES={short:0,crest:0,crop:1,bald:2},BEARDS={none:0,stubble:1,beard:2};
const headFragment=`#include <map_fragment>
vec4 headM=texture2D(hairMask,vMapUv);vec3 base=diffuseColor.rgb;
float grain=fract(sin(dot(floor(vMapUv*1400.0),vec2(12.9898,78.233)))*43758.5453);
vec3 hairC=base*hairTint;
// Crop and bald: the painted hair becomes scalp (with fine stubble for a crop).
if(hairStyle>.5){float shape=clamp(dot(base,vec3(.2126,.7152,.0722))/max(dot(hairRef,vec3(.2126,.7152,.0722)),.005),.55,1.4);vec3 scalp=scalpColor*skinTint*(.84+.08*grain)*mix(1.0,shape,.22);hairC=mix(scalp,hairColor*.55,hairStyle<1.5?.45+.3*grain:.04);}
vec3 col=mix(base*skinTint,hairC,headM.r);
// Stubble or a beard on the jaw, chin and upper lip.
if(beard>.5){float w=headM.b*(beard<1.5?(.25+.35*grain):(.5+.32*grain));col=mix(col,hairColor*(.5+.2*grain),w);}
diffuseColor.rgb=mix(col,base,headM.g);`;
/** Head material: skin tint on the face and neck, hair tint (or scalp for crop/bald) on the painted hair, an
 * optional stubble or beard; eyes, gums and teeth (mask G) keep their colours. */
export function headMaterial({map,normalMap,hairMask,scalp,hairRef},tint,hairTint,{hairStyle=0,beard=0,hair='#211a15'}={}){
 const m=new THREE.MeshStandardMaterial({map,normalMap,normalScale:new THREE.Vector2(1,-1),roughness:.58,metalness:0}); // DirectX-style normal map
 const u={skinTint:{value:tint.clone()},hairTint:{value:(hairTint||tint).clone()},hairMask:{value:hairMask},hairStyle:{value:hairStyle},beard:{value:beard},
  hairColor:{value:new THREE.Color(hair)},scalpColor:{value:new THREE.Color(scalp||'#c18a6f')},hairRef:{value:new THREE.Color(hairRef||'#372619')}};m.userData.kit=u;
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 skinTint,hairTint,hairColor,scalpColor,hairRef;uniform float hairStyle,beard;uniform sampler2D hairMask;')
   .replace('#include <map_fragment>',headFragment);};
 m.customProgramCacheKey=()=> 'rocketbox-head-v5';
 return m;
}

// Photo faces: the editor's atlas (src/face-assets.js bakeFaceAsset, 1024 x 512, front at u = .5) and the
// Rocketbox head texture are both unwrapped by angle around the head. Landmarks (eyes, nose, mouth, chin,
// ears) are matched with piecewise-linear maps, and only the face oval is blended over the painted head.
const ATLAS_V=[0,.205,.44,.59,.775,.92,1],HEAD_V=[.06,.17,.283,.342,.40,.483,.53];
const ATLAS_U=[0,.052,.155,.305,.5],HEAD_U=[0,.071,.17,.246,.5]; // distance from the face centre line
const lerpMap=(x,from,to)=>{if(x<=from[0])return to[0];for(let i=1;i<from.length;i++)if(x<=from[i])return to[i-1]+(to[i]-to[i-1])*(x-from[i-1])/(from[i]-from[i-1]);return to.at(-1);};
/** Head texture position -> atlas position (the inverse of the landmark maps). */
export function headToAtlas(u,v){const d=Math.abs(u-.5),s=u<.5?-1:1;return [.5+s*lerpMap(d,HEAD_U,ATLAS_U),lerpMap(v,HEAD_V,ATLAS_V)];}
/** Blend weight of the photo at a head texture position: the face oval, softened at the edge and around the eyes. */
export function photoWeight(u,v){
 // Oval from under the photo's fringe (v ~.21) to the chin, cheek to cheek.
 const e=((u-.5)/.16)**2+((v-(v<.35?.35:.35))/(v<.35?.14:.15))**2,edge=Math.min(1,Math.max(0,(1-e)/.3));
 const eye=Math.min(...[.435,.571].map(x=>((u-x)/.034)**2+((v-.283)/.016)**2));
 return edge*edge*(3-2*edge)*(eye<1?.55+.45*eye:1);
}
/**
 * One player's head texture with their photo face. The photo is colour-matched per channel to the painted
 * skin on the edge of the oval, so the skin tint the shader applies afterwards treats both alike and the
 * seam disappears; inside the oval the photo keeps its own detail.
 */
export function composePhotoHead(headImage,atlasImage){
 const N=headImage.width||1024,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(headImage,0,0,N,N);
 const a=document.createElement('canvas');a.width=1024;a.height=512;const ga=a.getContext('2d',{willReadFrequently:true});ga.drawImage(atlasImage,0,0,1024,512);
 const src=ga.getImageData(0,0,1024,512).data,x0=Math.floor(N*.32),x1=Math.ceil(N*.68),y0=Math.floor(N*.14),y1=Math.ceil(N*.52),img=g.getImageData(x0,y0,x1-x0,y1-y0),d=img.data;
 const sample=(u,v)=>{const [au,av]=headToAtlas(u,v);return (Math.min(511,Math.max(0,Math.round(av*511)))*1024+Math.min(1023,Math.max(0,Math.round(au*1023))))*4;};
 const base=[0,0,0],photo=[0,0,0];
 for(let y=0;y<img.height;y+=2)for(let x=0;x<img.width;x+=2){const u=(x0+x+.5)/N,v=(y0+y+.5)/N,w=photoWeight(u,v);if(w<.03||w>.4)continue;const i=(y*img.width+x)*4,j=sample(u,v);for(let k=0;k<3;k++){base[k]+=d[i+k];photo[k]+=src[j+k];}}
 const gain=base.map((b,k)=>photo[k]>0?Math.min(1.6,Math.max(.6,b/photo[k])):1);
 for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++){const u=(x0+x+.5)/N,v=(y0+y+.5)/N,w=photoWeight(u,v);if(w<=0)continue;const i=(y*img.width+x)*4,j=sample(u,v);
  for(let k=0;k<3;k++)d[i+k]=d[i+k]*(1-w)+Math.min(255,src[j+k]*gain[k])*w;}
 g.putImageData(img,x0,y0);return c;
}
