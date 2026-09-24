import {identityFromLandmarks} from './face-identity.js';
import {cleanFace} from './face-settings.js';
// Fit shape proportions only. A single image cannot determine the hidden skull surface.
export function proportionsFromLandmarks(points,width,height){if(!Array.isArray(points)||points.length<468)throw Error('얼굴 윤곽을 찾지 못했습니다. 정면 사진을 사용해 주세요.');if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('얼굴 위치를 읽지 못했습니다.');
 const p=i=>({x:points[i].x*width,y:points[i].y*height,z:points[i].z*width}),dist=(a,b)=>Math.hypot(p(a).x-p(b).x,p(a).y-p(b).y),avg=(a,b,k)=>(p(a)[k]+p(b)[k])/2;
 const fw=dist(234,454),fh=dist(10,152);if(fw<40||fh<55)throw Error('사진에서 얼굴이 너무 작습니다. 얼굴을 더 크게 잘라 주세요.');
 const eyeL={x:avg(33,133,'x'),y:avg(33,133,'y')},eyeR={x:avg(362,263,'x'),y:avg(362,263,'y')};
 if(Math.abs(p(1).x-(eyeL.x+eyeR.x)/2)>fw*.22)throw Error('앞모습은 카메라를 정면으로 보는 사진을 사용해 주세요.');
 const shape=cleanFace().shape,identity=identityFromLandmarks(points,width,height);
 if(!identity)throw Error('얼굴 비율을 안정적으로 읽지 못했습니다. 정면 사진을 사용해 주세요.');
 return {shape,identity,anchors:{cheeks:[p(205),p(425)],forehead:p(151)},landmarkCount:points.length};
}
let worker,sequence=0;const pending=new Map();
export function fitPhoto(image){if(!worker){worker=new Worker(new URL('./face-fit-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const item=pending.get(data.id);if(!item)return;pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(data.error)):item.resolve(data.result);};worker.onerror=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('얼굴 분석을 시작하지 못했습니다. 사진 정렬과 윤곽 조절은 계속 사용할 수 있습니다.'));}pending.clear();worker.terminate();worker=null;};}
 return createImageBitmap(image).then(bitmap=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('얼굴 분석 시간이 초과됐습니다. 다시 시도해 주세요.'));},60000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,image:bitmap},[bitmap]);}));
}
