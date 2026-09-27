import {FACE_ANCHORS,identityFromLandmarks} from './face-identity.js';
import {cleanFace,FACE_SHAPE} from './face-settings.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// A slider ratio of 1 is this same proportion measured on FACE_ANCHORS itself (the game's neutral head, also
// used by identityWarp) -- so a photo shaped like the neutral head measures as neutral, and the photo's own
// ratio divided by this reference is clamped into FACE_SHAPE's [min,max] for a matching deviation. Only
// proportions a single frontal photo can read off the image plane are estimated (width, jaw width,
// lower-face/nose length, nose and mouth width, eye spacing); depth, cheek fullness, lip thickness and brow
// height need a profile or shading cues a flat photo does not give reliably, so they stay at 1
// (identityFromLandmarks separately warps the legacy sculpted head's actual geometry).
const REFERENCE=(()=>{const p=id=>({x:FACE_ANCHORS[id][0],y:FACE_ANCHORS[id][1]}),dist=(a,b)=>Math.hypot(p(a).x-p(b).x,p(a).y-p(b).y),avg=(a,b,k)=>(p(a)[k]+p(b)[k])/2;
 const fw=dist(234,454),fh=dist(10,152),eyes=Math.hypot(avg(33,133,'x')-avg(362,263,'x'),avg(33,133,'y')-avg(362,263,'y')),lowerFace=Math.hypot(p(152).x-avg(13,14,'x'),p(152).y-avg(13,14,'y'));
 return {widthToHeight:fw/fh,jawToWidth:dist(172,397)/fw,lowerFaceToHeight:lowerFace/fh,noseLenToHeight:dist(6,2)/fh,noseWidthToEyes:dist(129,358)/eyes,mouthToEyes:dist(61,291)/eyes,eyesToWidth:eyes/fw};
})();
function estimateShape(points,width,height,fw,fh){
 const p=i=>({x:points[i].x*width,y:points[i].y*height}),dist=(a,b)=>Math.hypot(p(a).x-p(b).x,p(a).y-p(b).y),avg=(a,b,k)=>(p(a)[k]+p(b)[k])/2;
 const eyes=Math.hypot(avg(33,133,'x')-avg(362,263,'x'),avg(33,133,'y')-avg(362,263,'y'));
 const lowerFace=Math.hypot(p(152).x-avg(13,14,'x'),p(152).y-avg(13,14,'y')),noseLen=dist(6,2),jaw=dist(172,397),noseWidth=dist(129,358),mouth=dist(61,291);
 const shape=cleanFace().shape;
 const set=(key,measured,reference)=>{const [,min,max]=FACE_SHAPE[key],ratio=measured/reference;shape[key]=Number.isFinite(ratio)?clamp(ratio,min,max):1;};
 set('width',fw/fh,REFERENCE.widthToHeight);set('jaw',jaw/fw,REFERENCE.jawToWidth);set('chin',lowerFace/fh,REFERENCE.lowerFaceToHeight);
 set('nose',noseLen/fh,REFERENCE.noseLenToHeight);set('noseWidth',noseWidth/eyes,REFERENCE.noseWidthToEyes);
 set('mouth',mouth/eyes,REFERENCE.mouthToEyes);set('eyes',eyes/fw,REFERENCE.eyesToWidth);
 return shape;
}
// Fit shape proportions. A single image cannot determine the hidden skull surface (depth, cheek fullness,
// lip thickness, brow height stay neutral), but face width, jaw width, lower-face/nose length, nose and
// mouth width and eye spacing are read off the image plane and drive both the legacy sculpted head's shape
// sliders and, through them, the Rocketbox model's face_* morphs (src/human-body.js faceShape()).
export function proportionsFromLandmarks(points,width,height){if(!Array.isArray(points)||points.length<468)throw Error('얼굴 윤곽을 찾지 못했습니다. 정면 사진을 사용해 주세요.');if(points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))throw Error('얼굴 위치를 읽지 못했습니다.');
 const p=i=>({x:points[i].x*width,y:points[i].y*height,z:points[i].z*width}),dist=(a,b)=>Math.hypot(p(a).x-p(b).x,p(a).y-p(b).y),avg=(a,b,k)=>(p(a)[k]+p(b)[k])/2;
 const fw=dist(234,454),fh=dist(10,152);if(fw<40||fh<55)throw Error('사진에서 얼굴이 너무 작습니다. 얼굴을 더 크게 잘라 주세요.');
 const eyeL={x:avg(33,133,'x'),y:avg(33,133,'y')},eyeR={x:avg(362,263,'x'),y:avg(362,263,'y')};
 if(Math.abs(p(1).x-(eyeL.x+eyeR.x)/2)>fw*.22)throw Error('앞모습은 카메라를 정면으로 보는 사진을 사용해 주세요.');
 const shape=estimateShape(points,width,height,fw,fh),identity=identityFromLandmarks(points,width,height);
 if(!identity)throw Error('얼굴 비율을 안정적으로 읽지 못했습니다. 정면 사진을 사용해 주세요.');
 return {shape,identity,anchors:{cheeks:[p(205),p(425)],forehead:p(151)},landmarkCount:points.length};
}
// Landmarks the studio needs to line a photo up with the head oval (MediaPipe face mesh indices): upper
// forehead, chin, eye corners, under the nose, lips.
export const CROP_POINTS=[10,152,33,133,362,263,2,13,14];
/**
 * Crop settings (src/face-assets.js drawCrop, 4:5 canvas) that put a detected face in the head oval: level
 * eyes, crown to chin filling the oval, and the eye, nose and mouth guides on the photo's features.
 * `points` are normalized image coordinates by landmark index. Pure, so it can be tested.
 */
export function autoCrop(points,iw,ih){
 const P=i=>({x:points[i].x*iw,y:points[i].y*ih}),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2}),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const eyeA=mid(P(33),P(133)),eyeB=mid(P(362),P(263)),left=eyeA.x<eyeB.x?eyeA:eyeB,right=left===eyeA?eyeB:eyeA;
 const rotation=clamp(-Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI,-30,30),r=rotation*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r);
 // The mesh's top point is the upper forehead; the crown is about 0.3 face heights above it.
 const top=P(10),chin=P(152),fh=Math.hypot(top.x-chin.x,top.y-chin.y),crown={x:top.x+(top.x-chin.x)*.3,y:top.y+(top.y-chin.y)*.3};
 const w=1,h=1.25,base=Math.max(w/iw,h/ih),zoom=clamp(.96*h/(1.3*fh)/base,1,8),s=base*zoom;
 const place=p=>{const dx=p.x-iw/2,dy=p.y-ih/2;return {x:(dx*cos-dy*sin)*s,y:(dx*sin+dy*cos)*s};};
 const centre=place(mid(crown,chin)),x=clamp(-centre.x/w,-1,1),y=clamp((-.01*h-centre.y)/h,-1,1);
 const at=p=>.5+y+place(p).y/h;
 return {zoom,x,y,rotation,eyes:clamp(at(mid(eyeA,eyeB)),.3,.59),nose:clamp(at(P(2)),.6,.76),mouth:clamp(at(mid(P(13),P(14))),.77,.91),flip:false};
}
let worker,sequence=0;const pending=new Map();
export function fitPhoto(image){if(!worker){worker=new Worker(new URL('./face-fit-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const item=pending.get(data.id);if(!item)return;pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(data.error)):item.resolve(data.result);};worker.onerror=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('얼굴 분석을 시작하지 못했습니다. 사진 정렬과 윤곽 조절은 계속 사용할 수 있습니다.'));}pending.clear();worker.terminate();worker=null;};}
 return createImageBitmap(image).then(bitmap=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('얼굴 분석 시간이 초과됐습니다. 다시 시도해 주세요.'));},60000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,image:bitmap},[bitmap]);}));
}
