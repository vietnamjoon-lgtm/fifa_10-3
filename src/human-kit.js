// Club kit on the Rocketbox football players (assets/human/rocketbox). The body texture keeps the painted skin,
// boot soles and a neutral fabric shade (grey 128 = 1.0) for the kit; kit-mask.png says which part each texel
// belongs to. Club colours, pattern, trims, numbers, name, sponsor and crest are applied in the shader, so every
// club and player shares the same textures and one shader program.
import * as THREE from 'three';

// Where each decal is drawn in the per-player canvas (x, y, w, h in pixels of a 512 x 512 canvas).
const CELLS={backNumber:[0,256,200,256],backName:[0,0,512,128],sponsor:[0,128,256,128],crest:[256,128,128,128],shortsNumber:[384,128,128,128]};
export const DECALS=Object.keys(CELLS);
const NEUTRAL=.21586; // sRGB 128 in linear light

function fitText(g,text,[x,y,w,h],weight,color){
 x+=6;y+=6;w-=12;h-=12; // keep clear of the neighbouring cells
 g.save();g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';let size=h*.86;g.font=`${weight} ${size}px Arial`;
 const width=g.measureText(text).width;if(width>w*.94){size*=w*.94/width;g.font=`${weight} ${size}px Arial`;}
 g.fillText(text,x+w/2,y+h*.53);g.restore();
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
 fitText(g,String(number),CELLS.backNumber,'900',text);fitText(g,shirtName(name),CELLS.backName,'800',text);
 fitText(g,chest||'',CELLS.sponsor,'900',text);drawCrest(g,crest,CELLS.crest);fitText(g,String(number),CELLS.shortsNumber,'900',text);
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
uniform sampler2D kitMask,kitDecals;
uniform vec3 kitShirt,kitSecond,kitSleeve,kitTrim,kitShorts,kitSocks,kitBoots,kitGloves,skinTint;
uniform float kitPattern,kitKeeper;
uniform vec4 decalRect[${DECALS.length}],decalCell[${DECALS.length}];
uniform float decalFlip[${DECALS.length}];
vec3 shirtColour(){
 float y=vKitBind.y,x=vKitBind.x;
 // 1 vertical stripes, 2 gradient from the second colour at the hem to the shirt colour at the chest, 3 hoops, 4 diamond weave.
 if(kitPattern>.5&&kitPattern<1.5)return mix(kitShirt,kitSecond,step(.5,fract(x*11.0+.25)));
 if(kitPattern>1.5&&kitPattern<2.5)return mix(kitSecond,kitShirt,smoothstep(.98,1.34,y));
 if(kitPattern>2.5&&kitPattern<3.5)return mix(kitShirt,kitSecond,step(.5,fract(y*9.0)));
 if(kitPattern>3.5)return mix(kitShirt,kitSecond,1.0-step(.22,abs(fract(x*9.0)-.5)+abs(fract(y*9.0)-.5)));
 return kitShirt;
}`;
const fragmentKit=`#include <map_fragment>
vec4 kitM=texture2D(kitMask,vMapUv);
float kitPart=floor(kitM.r*255.0/40.0+.5);
float kitRough=mix(.78,.42,kitM.a);
if(kitPart>.5&&kitPart<5.5){
 float shade=diffuseColor.r/${NEUTRAL};
 vec3 c=kitPart<1.5?shirtColour():kitPart<2.5?kitSleeve:kitPart<3.5?kitShorts:kitPart<4.5?kitSocks:kitBoots;
 if(kitM.g>.5&&kitPart<4.5)c=kitTrim;
 for(int i=0;i<${DECALS.length};i++){
  vec4 r=decalRect[i];vec2 d=(vMapUv-r.xy)/(r.zw-r.xy);
  if(d.x>0.0&&d.x<1.0&&d.y>0.0&&d.y<1.0){if(decalFlip[i]>.5)d=1.0-d;vec4 t=texture2D(kitDecals,decalCell[i].xy+clamp(d,.02,.98)*decalCell[i].zw);c=mix(c,t.rgb,t.a);}
 }
 diffuseColor.rgb=c*shade;
 kitRough=kitPart>4.5?.36:mix(.86,.5,kitM.a);
}else if(kitPart>5.5&&kitKeeper>.5){
 diffuseColor.rgb=kitGloves*clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.2,.35,1.3);kitRough=.62;
}else if(kitM.b>.5)diffuseColor.rgb*=skinTint;`;

/** Body material: shared textures, per-player uniforms. */
export function kitMaterial({map,normalMap,mask,layout},colours,decals,tint){
 const m=new THREE.MeshStandardMaterial({map,normalMap,roughness:.7,metalness:0});
 const u=m.userData.kit={kitMask:{value:mask},kitDecals:{value:decals},skinTint:{value:tint.clone()},kitPattern:{value:0},kitKeeper:{value:0},
  decalRect:{value:DECALS.map(k=>new THREE.Vector4(...layout.decals[k]))},decalCell:{value:DECALS.map(k=>{const [x,y,w,h]=CELLS[k];return new THREE.Vector4(x/512,y/512,w/512,h/512);})},
  decalFlip:{value:DECALS.map(k=>layout.flipped.includes(k)?1:0)}};
 for(const key of ['Shirt','Second','Sleeve','Trim','Shorts','Socks','Boots','Gloves'])u['kit'+key]={value:new THREE.Color()};
 setKitColours(m,colours);
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
  shader.vertexShader=shader.vertexShader.replace('#include <common>',vertexHead).replace('#include <begin_vertex>','#include <begin_vertex>\nvKitBind=kitBind;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',fragmentHead).replace('#include <map_fragment>',fragmentKit).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=kitRough;');};
 m.customProgramCacheKey=()=> 'rocketbox-kit-v1';
 return m;
}
export function setKitColours(m,c){
 const u=m.userData.kit;u.kitShirt.value.set(c.shirt);u.kitSecond.value.set(c.second);u.kitSleeve.value.set(c.sleeves);u.kitTrim.value.set(c.trim);
 u.kitShorts.value.set(c.shorts);u.kitSocks.value.set(c.socks);u.kitBoots.value.set(c.boots);u.kitGloves.value.set(c.gloves||'#ffffff');u.kitPattern.value=c.pattern;u.kitKeeper.value=c.gloves?1:0;
}

/** Head material: skin tint everywhere except the eyes and teeth corner. */
export function headMaterial({map,normalMap,eyes},tint){
 const m=new THREE.MeshStandardMaterial({map,normalMap,roughness:.58,metalness:0});const u={skinTint:{value:tint.clone()},eyesRect:{value:new THREE.Vector4(...eyes)}};m.userData.kit=u;
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 skinTint;uniform vec4 eyesRect;')
   .replace('#include <map_fragment>','#include <map_fragment>\nif(!(vMapUv.x>eyesRect.x&&vMapUv.x<eyesRect.z&&vMapUv.y>eyesRect.y&&vMapUv.y<eyesRect.w))diffuseColor.rgb*=skinTint;');};
 m.customProgramCacheKey=()=> 'rocketbox-head-v1';
 return m;
}
