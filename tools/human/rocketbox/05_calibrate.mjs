// Face-landmark calibration for the shipped Rocketbox heads, steps 03 + detect + 04 in one go:
//   1. a plain (meshopt-decoded) copy of assets/human/rocketbox/<id>.glb for Blender's importer,
//   2. 03_render_face.py: a straight-on render of the face with its own head texture,
//   3. detect_landmarks.py: MediaPipe's 468 points on that render (tools/human/rocketbox/.cache/venv, requirements.txt),
//   4. 04_raycast_uv.py: each point's head-texture UV and its 3D position on the rest-pose head.
// Then merges assets/human/rocketbox/face-landmarks-uv.json (UV, src/human-kit.js composePhotoHead) and
// face-landmarks-3d.json (src/face-shape3d.js): the hit positions and, as a stored face shape, MediaPipe's own
// 3D reading of the render (a photo's reading is compared with it, not with the hits directly). A render and its landmarks are reused when they are
// already in .cache (so an existing avatar's UV table does not move); --render redoes them.
//   node tools/human/rocketbox/05_calibrate.mjs male_02 male_03 asian_01 asian_02 [--render]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {encodeFaceShape} from '../../../src/face-shape3d.js';

const here=path.dirname(new URL(import.meta.url).pathname),cache=path.join(here,'.cache'),assets=path.resolve(here,'../../../assets/human');
const blender=process.env.BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',python=path.join(cache,'venv/bin/python');
const args=process.argv.slice(2),fresh=args.includes('--render'),ids=args.filter(a=>!a.startsWith('--'));
const run=(cmd,list)=>execFileSync(cmd,list,{stdio:['ignore','pipe','inherit']}).toString();
const at=(...p)=>path.join(cache,...p);
const readJSON=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const uvFile=path.join(assets,'rocketbox/face-landmarks-uv.json'),pointsFile=path.join(assets,'rocketbox/face-landmarks-3d.json');
const uvTable=readJSON(uvFile,{}),pointsTable=readJSON(pointsFile,{}),canonical=readJSON(path.join(assets,'canonical-face.json'));

for(const id of ids){
 const plain=at(`${id}-plain.glb`),png=at(`${id}-face.png`),camera=at(`${id}-camera.json`),landmarks=at(`${id}-landmarks.json`),calib=at(`${id}-uv-calib.json`);
 if(!fs.existsSync(plain))run('npx',['-y','@gltf-transform/cli@4','copy',path.join(assets,'rocketbox',`${id}.glb`),plain]);
 if(fresh||!fs.existsSync(landmarks)){
  run(blender,['--background','--python',path.join(here,'03_render_face.py'),'--',plain,path.join(assets,'rocketbox',`${id}-head.jpg`),id]);
  run(python,[path.join(here,'detect_landmarks.py'),png,landmarks]);
 }
 const out=run(blender,['--background','--python',path.join(here,'04_raycast_uv.py'),'--',plain,camera,landmarks,id,calib,path.join(assets,'canonical-face.json')]);
 const result=JSON.parse(fs.readFileSync(calib,'utf8'));
 uvTable[id]=result.uv;
 const seen=JSON.parse(fs.readFileSync(landmarks,'utf8'));
 pointsTable[id]={points:result.points,shape:encodeFaceShape({front:{landmarks:seen.points,width:seen.width,height:seen.height}},canonical).shape};
 console.log(out.split('\n').find(l=>l.startsWith('{"avatar"')));
}
fs.writeFileSync(uvFile,JSON.stringify(uvTable));
fs.writeFileSync(pointsFile,JSON.stringify({...pointsTable,source:'tools/human/rocketbox/05_calibrate.mjs. points: MediaPipe landmark rays on each rest-pose head (metres, +Y up, face along +Z; null = the ray missed the head). shape: MediaPipe\'s own 3D reading of the same render (src/face-shape3d.js format).'}));
