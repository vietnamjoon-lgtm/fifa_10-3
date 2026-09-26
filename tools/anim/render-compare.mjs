// Render the same scripted scene (tools/anim/compare-scene.js) from two checkouts and put them side by side.
// Usage: node tools/anim/render-compare.mjs <before-root> <after-root> <out.mp4> [frames-dir]
//   e.g. git archive origin/fix/left-right | tar -x -C /tmp/before && cp tools/anim/compare* /tmp/before/tools/anim/
// Needs Playwright (global install is fine) and an ffmpeg binary (FFMPEG, or the imageio-ffmpeg pip package).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const [beforeRoot,afterRoot,out,framesArg]=process.argv.slice(2);
if(!out)throw Error('usage: render-compare.mjs <before-root> <after-root> <out.mp4> [frames-dir]');
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(execFileSync('npm',['root','-g']).toString().trim(),'playwright'));}
const ffmpeg=process.env.FFMPEG||execFileSync('python3',['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.bin':'application/octet-stream','.wasm':'application/wasm'};
function serve(root){return new Promise(done=>{const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));if(!file.startsWith(path.resolve(root))||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(fs.readFileSync(file));}).listen(0,'127.0.0.1',()=>done(server));});}
const framesDir=framesArg||fs.mkdtempSync(path.join(os.tmpdir(),'clips-'));
const browser=await playwright.chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [name,root,label] of [['before',beforeRoot,'BEFORE · CMU clips'],['after',afterRoot,'AFTER · 100STYLE Neutral']]){
 const server=await serve(path.resolve(root)),page=await browser.newPage({viewport:{width:640,height:540}});
 page.on('pageerror',e=>console.error(name,e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/anim/compare.html?label=${encodeURIComponent(label)}`);
 await page.waitForFunction(()=>window.sceneReady,null,{timeout:120000});
 const dir=path.join(framesDir,name);fs.mkdirSync(dir,{recursive:true});const log=[];
 for(let i=0;;i++){const r=await page.evaluate(()=>window.renderFrame());log.push(r);await page.screenshot({path:path.join(dir,String(i).padStart(5,'0')+'.png')});if(r.done)break;}
 fs.writeFileSync(path.join(dir,'log.json'),JSON.stringify(log));console.log(name,log.length,'frames');await page.close();server.close();
}
await browser.close();
execFileSync(ffmpeg,['-y','-loglevel','error','-framerate','60','-i',path.join(framesDir,'before','%05d.png'),'-framerate','60','-i',path.join(framesDir,'after','%05d.png'),
 '-filter_complex','[0:v][1:v]hstack=inputs=2,format=yuv420p','-c:v','libx264','-crf','20','-preset','slow','-movflags','+faststart',out],{stdio:'inherit'});
console.log('wrote',out,'frames in',framesDir);
