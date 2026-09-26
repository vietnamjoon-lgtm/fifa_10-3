// Generates the pitch and goal-net textures in src/textures/ (dedicated to CC0, see CREDITS.md).
// Pure Node (zlib PNG encoder), deterministic seed, every map tiles seamlessly.
// Usage: node tools/make-pitch-textures.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../src/textures');fs.mkdirSync(out,{recursive:true});
let seed=20260926;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function png(file,w,h,channels,pixel){
 const raw=Buffer.alloc((w*channels+1)*h);
 for(let y=0;y<h;y++){raw[y*(w*channels+1)]=0;for(let x=0;x<w;x++){const v=pixel(x,y);for(let c=0;c<channels;c++)raw[y*(w*channels+1)+1+x*channels+c]=Math.max(0,Math.min(255,Math.round(v[c]*255)));}}
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=[0,0,4,2,6][channels];
 fs.writeFileSync(path.join(out,file),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));
 console.log(file,fs.statSync(path.join(out,file)).size,'bytes');
}
// Periodic value noise: lattice wraps at `period`, so the map tiles.
function noise(period){const g=Float32Array.from({length:period*period},rand);const at=(x,y)=>g[((y%period+period)%period)*period+((x%period+period)%period)];
 return (x,y)=>{const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  return (at(x0,y0)*(1-sx)+at(x0+1,y0)*sx)*(1-sy)+(at(x0,y0+1)*(1-sx)+at(x0+1,y0+1)*sx)*sy;};}
function fbm(size,base,octaves){const layers=Array.from({length:octaves},(_,i)=>noise(base<<i));
 return (x,y)=>{let v=0,a=.5,n=0;for(let i=0;i<octaves;i++){v+=layers[i](x/size*(base<<i),y/size*(base<<i))*a;n+=a;a*=.5;}return v/n;};}
// Grass: a height field of thousands of short blades (wrapped), then albedo + normal from it.
const S=512,height=new Float32Array(S*S),tint=new Float32Array(S*S);
const clump=fbm(S,8,4);
for(let i=0;i<52000;i++){
 const x0=rand()*S,y0=rand()*S,len=4+rand()*9,angle=-Math.PI/2+(rand()-.5)*1.1,h=.35+rand()*.65,t=rand();
 for(let s=0;s<len;s+=.5){const x=Math.floor(x0+Math.cos(angle)*s),y=Math.floor(y0+Math.sin(angle)*s),k=((y%S+S)%S)*S+((x%S+S)%S),v=h*(.55+.45*s/len);
  if(v>height[k]){height[k]=v;tint[k]=t;}}
}
const H=(x,y)=>height[((y%S+S)%S)*S+((x%S+S)%S)];
png('grass-albedo.png',S,S,3,(x,y)=>{const h=H(x,y),c=clump(x,y),t=tint[y*S+x];
 // Linear-ish multiplier around 1.0 once decoded: the shader multiplies it with the pitch colour.
 const l=.42+h*.34+(c-.5)*.22,dry=Math.max(0,t-.82)*1.6;
 return [l*(.9+dry*.5),l*(1.0-dry*.12),l*(.86-dry*.2)];});
png('grass-normal.png',S,S,3,(x,y)=>{const dx=(H(x+1,y)-H(x-1,y))*1.6,dy=(H(x,y+1)-H(x,y-1))*1.6,l=Math.hypot(dx,dy,1);
 return [.5-dx/l*.5,.5+dy/l*.5,.5+.5/l];});
// Macro variation (R: broad tone, G: blend mask between two detail scales, B: wear) at 256^2.
const macroA=fbm(256,4,4),macroB=fbm(256,3,3),macroC=fbm(256,6,4);
png('pitch-macro.png',256,256,3,(x,y)=>[macroA(x,y),macroB(x,y),macroC(x,y)]);
// Goal net: one knotted square mesh cell with soft edges (alpha), tiles per cell.
const N=64;png('goal-net.png',N,N,2,(x,y)=>{const d=Math.min(Math.abs(x-N/2+.5),Math.abs(y-N/2+.5)),knot=Math.hypot(x-N/2+.5,y-N/2+.5)<4?1:0;const a=Math.max(knot,Math.max(0,Math.min(1,(3.2-d)/1.4)));return [.95,a];});
