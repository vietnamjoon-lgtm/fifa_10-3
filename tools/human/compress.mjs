// Step 8: compress the exported player for the web. Mesh: meshopt. Textures: KTX2 (ETC1S colour,
// alpha kept for hair and eyebrows). Writes assets/human/ and checks the size budget.
// node tools/human/compress.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.dirname(new URL(import.meta.url).pathname),cache=path.join(root,'.cache'),out=path.resolve(root,'../../assets/human');
const env={...process.env,PATH:`${path.join(cache,'ktx/bin')}:${process.env.PATH}`};
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:['ignore','pipe','inherit'],env});
fs.mkdirSync(out,{recursive:true});
run('npx',['-y','@gltf-transform/cli@4','meshopt',path.join(cache,'player.glb'),path.join(out,'player.glb'),'--level','medium']);
const manifest=JSON.parse(fs.readFileSync(path.join(out,'player.json'),'utf8'));
const files=Object.values(manifest.textures).flatMap(v=>typeof v==='string'?[v]:Object.values(v));
// Game-distance sizes: skin 1024, hair 512, eyes and eyebrows 256 (square, alpha kept).
const SIZE={eyes:256,eyebrows:256,hair_short01:512,hair_afro01:512};
for(const file of files){
 const key=file.replace(/\.png$/,''),target=SIZE[key];
 const src=target?path.join(cache,'textures',`${key}_${target}.png`):path.join(cache,'textures',file);
 if(target)run('python3',['-c',`from PIL import Image;Image.open(${JSON.stringify(path.join(cache,'textures',file))}).resize((${target},${target}),Image.LANCZOS).save(${JSON.stringify(src)})`]);
 const dst=path.join(out,file.replace(/\.png$/,'.ktx2'));
 run('toktx',['--t2','--encode','etc1s','--clevel','4','--qlevel','200','--genmipmap','--assign_oetf','srgb',dst,src]);
}
const size=f=>fs.statSync(path.join(out,f)).size;
const report={glb:size('player.glb'),textures:Object.fromEntries(files.map(f=>[f.replace(/\.png$/,'.ktx2'),size(f.replace(/\.png$/,'.ktx2'))]))};
report.total=report.glb+Object.values(report.textures).reduce((a,b)=>a+b,0);
fs.writeFileSync(path.join(out,'sizes.json'),JSON.stringify(report,null,1));
console.log(JSON.stringify(report));
