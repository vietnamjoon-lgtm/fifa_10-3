// Phone face scan (textured OBJ or GLB) -> Touchline face pack (.tlface, src/face-scan.js), in one command:
//   node tools/human/scan/make-face-pack.mjs <scan.obj|scan.glb> [--avatar asian_01] [--out face.tlface]
// Needs Blender (BLENDER=... or /Applications/Blender.app) and the calibration venv with MediaPipe
// (tools/human/rocketbox/requirements.txt in tools/human/rocketbox/.cache/venv); docs/FACE-SCAN.md has the setup.
//  1. the scan's largest piece is rendered from 24 directions; MediaPipe finds the face in the most frontal one,
//  2. its 468 points are cast onto the scan and the scan is fitted to the head's calibration points
//     (assets/human/rocketbox/face-landmarks-3d.json) by scale, rotation and position, then once more from the
//     head calibration's own frontal camera,
//  3. the head's vertices follow the landmarks (src/face-shape3d.js landmarkField: compact RBF, nothing moves at
//     the back of the head, the scalp or the neck seam), face vertices are then pulled onto the nearest scan surface,
//  4. the scan's colour is baked into the head's UVs and blended over the head texture (compose_texture.py),
//  5. offsets in the game's vertex order, the texture and a small online copy go into one file.
// Work files stay in tools/human/scan/.cache/<scan name>/ (ignored by git, like scans and packs).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {gameHead} from './game-head.mjs';
const {similarity,applySimilarity,landmarkField,meshOffsets}=await import('../../../src/face-shape3d.js');
const {encodeOffsets,cleanFacePack,FACE_PACK_KIND,FACE_PACK_MAX,SCAN_TEXTURE_MAX,SCAN_ONLINE_MAX}=await import('../../../src/face-scan.js');

const here=path.dirname(new URL(import.meta.url).pathname);
const args=process.argv.slice(2),option=(flag,fallback)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:fallback;};
const scan=path.resolve(args.find((a,i)=>!a.startsWith('--')&&!['--avatar','--out'].includes(args[i-1]))||'');
if(!fs.existsSync(scan)||!/\.(obj|glb|gltf)$/i.test(scan)){console.error('usage: node tools/human/scan/make-face-pack.mjs <scan.obj|scan.glb> [--avatar asian_01|asian_02|male_02|male_03] [--out face.tlface]');process.exit(1);}
const avatar=option('--avatar','asian_01'),out=path.resolve(option('--out',scan.replace(/\.[^.]+$/,'.tlface')));
const work=path.join(here,'.cache',path.basename(scan).replace(/\.[^.]+$/,''));fs.mkdirSync(work,{recursive:true});
const blenderApp=process.env.BLENDER||'/Applications/Blender.app/Contents/MacOS/Blender',python=path.resolve(here,'../rocketbox/.cache/venv/bin/python');
const run=(cmd,list)=>execFileSync(cmd,list,{stdio:['ignore','pipe','pipe'],maxBuffer:1<<26}).toString();
const say=text=>console.log('·',text);
let jobs=0;
function blender(job){const file=path.join(work,`job-${++jobs}.json`);fs.writeFileSync(file,JSON.stringify({scan,...job}));
 const log=run(blenderApp,['--background','--python',path.join(here,'scan_blender.py'),'--',file]);for(const line of log.split('\n'))if(/^(CLEAN|VIEWS|HITS|PULLED|BAKED)/.test(line))say(line);}
function detect(dir){run(python,[path.join(here,'detect_views.py'),path.join(dir,'views.json'),path.join(dir,'faces.json')]);
 const views=JSON.parse(fs.readFileSync(path.join(dir,'views.json'))),faces=JSON.parse(fs.readFileSync(path.join(dir,'faces.json')));
 let best=-1;faces.forEach((f,i)=>{if(f&&(best<0||f.score>faces[best].score))best=i;});
 if(best<0)throw Error('스캔에서 얼굴을 찾지 못했습니다. 얼굴 전체가 찍힌 텍스처 스캔인지 확인해 주세요.');
 return {view:views[best],landmarks:faces[best].landmarks,score:faces[best].score,found:faces.filter(Boolean).length,of:faces.length};}
const flat=points=>Float64Array.from(points.flatMap(p=>p||[0,0,0]));
const toMatrix=({s,R,t})=>R.map((row,r)=>[...row.map(v=>v*s),t[r]]).concat([[0,0,0,1]]);
const compose=(a,b)=>a.map((row,r)=>b[0].map((_,c)=>row.reduce((sum,v,k)=>sum+v*b[k][c],0)));
/** Scan points (glTF axes) -> the head's calibration points: the fit and its rms (mm) over the usable landmarks. */
function fitTo(hits,head){
 const use=[];hits.forEach((p,i)=>{if(p&&head.landmarks[i])use.push(i);});
 const target=flat(head.landmarks),T=similarity(flat(hits),target,use),moved=applySimilarity(T,flat(hits));
 const rms=Math.sqrt(use.reduce((s,i)=>s+[0,1,2].reduce((a,k)=>a+(moved[i*3+k]-target[i*3+k])**2,0),0)/use.length)*1000;
 return {T,use,rms,moved};
}

const head=await gameHead(avatar);
say(`게임 머리 ${avatar}: 머리 정점 ${head.head.count}, 머리카락 ${head.hair?.count??0}`);
// 1-2. Find the face, fit coarsely, then again from the calibration camera.
blender({mode:'views',out:path.join(work,'views')});
const first=detect(path.join(work,'views'));say(`얼굴 검출: 렌더 ${first.of}장 중 ${first.found}장, 가장 정면 점수 ${first.score.toFixed(2)}`);
blender({mode:'raycast',out:work,view:first.view,landmarks:first.landmarks});
let fit=fitTo(JSON.parse(fs.readFileSync(path.join(work,'hits.json'))),head),transform=toMatrix(fit.T);
say(`1차 정렬: 점 ${fit.use.length}개, 오차 ${fit.rms.toFixed(1)} mm, 크기 x${fit.T.s.toFixed(3)}`);
blender({mode:'views',out:path.join(work,'front'),transform,frontal:[0,1.686,.094]});
const second=detect(path.join(work,'front'));
blender({mode:'raycast',out:work,view:second.view,landmarks:second.landmarks,transform});
const hits=JSON.parse(fs.readFileSync(path.join(work,'hits.json')));fit=fitTo(hits,head);transform=compose(toMatrix(fit.T),transform);
say(`정면 재정렬: 점 ${fit.use.length}개, 오차 ${fit.rms.toFixed(1)} mm`);
// A ray that grazed the scan's silhouette lands far behind the face: landmarks that would move more than three
// times the median (and over 15 mm) are left out.
const moves=hits.map((p,i)=>p&&head.landmarks[i]?Math.hypot(...[0,1,2].map(k=>fit.moved[i*3+k]-head.landmarks[i][k])):null);
const median=[...moves.filter(v=>v!==null)].sort((a,b)=>a-b)[Math.floor(moves.filter(v=>v!==null).length/2)],limit=Math.max(.015,3*median);
const targets=hits.map((p,i)=>p&&moves[i]!==null&&moves[i]<=limit?[fit.moved[i*3],fit.moved[i*3+1],fit.moved[i*3+2]]:null);
say(`랜드마크 목표: ${targets.filter(Boolean).length}개 (중앙 이동 ${(median*1000).toFixed(1)} mm, ${hits.filter(Boolean).length-targets.filter(Boolean).length}개 제외)`);
// 3. Landmark field, then the face onto the scan surface.
const field=landmarkField(head.calibration,targets,head.canonical,{seam:Float32Array.from(head.seam)});
if(!field)throw Error('스캔에서 쓸 수 있는 얼굴 점이 너무 적습니다.');
const rigid=new Set(head.head.rigid.flat()),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const p1=(mesh,rigidList=[])=>{const {offsets}=meshOffsets(field,Float32Array.from(mesh.rest),rigidList);return mesh.rest.map((v,i)=>v+offsets[i]);};
const headP1=p1(head.head,head.head.rigid),at=(list,i)=>[list[i*3],list[i*3+1],list[i*3+2]];
const weight=i=>rigid.has(i)?0:field.mask(...at(head.head.rest,i));
const snap=Array.from({length:head.head.count},(_,i)=>weight(i)),texture=snap.map(w=>smooth((w-.35)/.5));
const chin=head.landmarks[152][1];
blender({mode:'fit',out:work,transform,below:chin-.07,head:{points:Array.from({length:head.head.count},(_,i)=>at(headP1,i)),snap,texture,uv:head.head.uv,index:head.head.index}});
const fitted=JSON.parse(fs.readFileSync(path.join(work,'fitted.json'))).flat();
// Eyeballs and teeth keep the landmark field's move (they were not pulled), shared across their piece already.
const headOffsets=fitted.map((v,i)=>v-head.head.rest[i]),hairOffsets=head.hair?p1(head.hair).map((v,i)=>v-head.hair.rest[i]):null;
let largest=0;for(let i=0;i<headOffsets.length;i+=3)largest=Math.max(largest,Math.hypot(headOffsets[i],headOffsets[i+1],headOffsets[i+2]));
const over=[];for(let i=0;i<headOffsets.length;i+=3)if(Math.hypot(headOffsets[i],headOffsets[i+1],headOffsets[i+2])>.02)over.push(i/3);
say(`머리 정점 이동: 최대 ${(largest*1000).toFixed(1)} mm, 2 cm 넘는 정점 ${over.length}개 (팩에는 축마다 ±31.75 mm까지)`);
if(process.env.SCAN_DEBUG)for(const i of over.slice(0,12))say(`  #${i} rest ${at(head.head.rest,i).map(v=>v.toFixed(3))} snap ${snap[i].toFixed(2)} p1 ${at(headP1,i).map((v,k)=>((v-head.head.rest[i*3+k])*1000).toFixed(1))} mm`);
// 4. Texture.
const composed=JSON.parse(run('python3',[path.join(here,'compose_texture.py'),head.headTexture,path.join(work,'bake.png'),path.join(work,'mask.png'),work,String(SCAN_TEXTURE_MAX),String(SCAN_ONLINE_MAX)]));
say(`텍스처: 피부색 ${composed.skin}, 밝기 맞춤 ${composed.gain.join('/')}, JPEG 품질 ${composed.quality.join('/')}`);
const dataURL=file=>'data:image/jpeg;base64,'+fs.readFileSync(path.join(work,file)).toString('base64');
// 5. The pack, checked by the game's own function before it is written.
const pack={kind:FACE_PACK_KIND,version:1,avatar,head:{count:head.head.count,offsets:encodeOffsets(headOffsets)},hair:hairOffsets&&{count:head.hair.count,offsets:encodeOffsets(hairOffsets)},
 texture:dataURL('texture.jpg'),online:dataURL('online.jpg'),skin:composed.skin,createdAt:new Date().toISOString()};
const text=JSON.stringify(cleanFacePack(pack));
if(text.length>FACE_PACK_MAX)throw Error(`face pack is ${text.length} characters, over ${FACE_PACK_MAX}`);
fs.writeFileSync(out,text);
say(`얼굴 팩: ${out} (${Math.round(text.length/1024)} KB). 선수 편집 → 3D 스캔 얼굴 불러오기에서 여세요.`);
