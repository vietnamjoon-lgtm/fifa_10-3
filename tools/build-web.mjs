import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(root,'.vercel','output');
// Validate the exact output directory before clearing this generated build.
if(output!==path.join(root,'.vercel','output')||!output.startsWith(root+path.sep))throw Error('Invalid build output directory');
fs.rmSync(output,{recursive:true,force:true});
const staticRoot=path.join(output,'static');fs.mkdirSync(staticRoot,{recursive:true});
for(const name of ['index.html','style.css','src','vendor','licenses'])fs.cpSync(path.join(root,name),path.join(staticRoot,name),{recursive:true,filter:source=>!source.includes(path.join('vendor','mediapipe'))||fs.statSync(source).isDirectory()||['vision-module.js','face_landmarker.task','vision_wasm_module_internal.js','vision_wasm_module_internal.wasm'].includes(path.basename(source))});
fs.writeFileSync(path.join(staticRoot,'src','qa.js'),'// Production build: developer scene controls are disabled.\nexport function installQA(){}\n');
fs.writeFileSync(path.join(output,'config.json'),JSON.stringify({version:3,routes:[
 {src:'/(.*)',headers:{'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'public, max-age=0, must-revalidate'},continue:true},
 {handle:'filesystem'},
 {src:'/(.*)',status:404,dest:'/404.html'}
]},null,2));
fs.writeFileSync(path.join(staticRoot,'404.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><title>TOUCHLINE</title><p>페이지를 찾을 수 없습니다.</p><a href="/">게임 시작 화면</a></html>');
const files=[];function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())scan(file);else files.push(file);}}scan(staticRoot);
const forbidden=files.filter(f=>/node\.exe|auth\.json|project\.json|\.env|\.test\.|reports|screenshots/.test(f));if(forbidden.length)throw Error('Unexpected private/build file in static output');
console.log(JSON.stringify({output,files:files.length,bytes:files.reduce((sum,f)=>sum+fs.statSync(f).size,0),qaEnabled:false},null,2));
