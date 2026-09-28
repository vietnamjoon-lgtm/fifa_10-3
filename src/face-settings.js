import {cleanIdentity} from './face-identity.js';
import {validFaceShape} from './face-shape3d.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Heads a player can be drawn with (assets/human/rocketbox/rocketbox.json); 'auto' lets src/human-body.js humanLook pick.
export const FACE_BASES={auto:'자동',male_02:'서양 A',male_03:'서양 B(레게 머리)',asian_01:'동양 A(옆가르마)',asian_02:'동양 B(앞머리)'};
export const FACE_SHAPE={width:['얼굴 폭',.8,1.2],jaw:['턱 너비',.7,1.3],chin:['턱 길이',.8,1.2],cheek:['광대',.8,1.2],nose:['코 높이',.6,1.5],eyes:['눈 간격',.85,1.15],depth:['두상 깊이',.8,1.25],noseWidth:['코 너비',.7,1.3],mouth:['입 너비',.75,1.3],eyeSize:['눈 크기',.8,1.2],eyeHeight:['눈 높이',.85,1.15],brow:['눈썹 높이',.8,1.2],lips:['입술 두께',.65,1.4],length:['얼굴 길이',.85,1.15]};
// `fitShape`: the slider values the photo analysis set (src/face-studio.js fit). With a 3D face shape the head
// already has the photo's proportions, so only the person's own slider changes after that are added
// (src/human-body.js faceShape); null for faces never fitted.
const cleanShape=raw=>{const shape={};for(const [key,[,min,max]]of Object.entries(FACE_SHAPE))shape[key]=typeof raw?.[key]==='number'&&Number.isFinite(raw[key])?clamp(raw[key],min,max):1;return shape;};
export function cleanFace(raw={}){raw=raw&&typeof raw==='object'?raw:{};const shape=cleanShape(raw.shape);return {fitShape:raw.fitShape&&typeof raw.fitShape==='object'?cleanShape(raw.fitShape):null,enabled:raw.enabled!==false,mode:raw.mode==='photo'?'photo':'sculpt',fitted:raw.fitted===true,identity:cleanIdentity(raw.identity),assetId:typeof raw.assetId==='string'&&/^[a-z\d-]{1,64}$/i.test(raw.assetId)?raw.assetId:null,photoHair:raw.photoHair===true,shape};}
export function validFaceTexture(value,max=180000){return typeof value==='string'&&value.length<=max&&value.length>30&&value.startsWith('data:image/jpeg;base64,/9j/')&&/^data:image\/jpeg;base64,[a-z\d+/]+=*$/i.test(value)?value:null;}
export function cleanCrop(raw={}){raw=raw&&typeof raw==='object'?raw:{};const number=(key,f,a,b)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])?clamp(raw[key],a,b):f;return {zoom:number('zoom',1,1,8),x:number('x',0,-1,1),y:number('y',0,-1,1),rotation:number('rotation',0,-30,30),eyes:number('eyes',.444,.3,.59),nose:number('nose',.603,.6,.76),mouth:number('mouth',.797,.77,.91),flip:raw.flip===true};}
// Orthographic multi-view projection; front at U=.5, back at the atlas seam.
export function projectionSample(u,v){const angle=(u-.5)*Math.PI*2,s=Math.sin(angle),c=Math.cos(angle),front=Math.max(0,c)**2,side=Math.abs(s)**8*.35,back=Math.max(0,-c)**2,total=front+side+back,silhouette=Math.max(.025,Math.sin(Math.PI*v)**.45);return {front:{u:clamp(.5+s*.40*silhouette,.04,.96),v,weight:front/total},side:{u:clamp(.5+c*.46*silhouette,.04,.96),v,weight:side/total},back:{u:clamp(.5-s*.40*silhouette,.04,.96),v,weight:back/total}};}

export function networkFace(profile,texture,share=false,faceUVTexture=null,shape3d=null){const face=cleanFace(profile.face),allowed=share&&face.enabled;return {...profile,skin:!allowed&&face.fitted?'#c89572':profile.skin,face:allowed?{...face,assetId:null}:cleanFace(),faceTexture:allowed?validFaceTexture(texture,32000):null,faceUV:allowed?validFaceTexture(faceUVTexture,28000):null,faceShape3d:allowed?validFaceShape(shape3d):null};}

export function facePreviewProfile(profile,face,baked,compare=false){return {...profile,face:{...cleanFace(face),identity:compare?null:cleanFace(face).identity,enabled:true},faceTexture:baked?.atlas||null,faceUV:baked?.faceUV||null,faceShape3d:baked?.shape3d||null,skin:face.fitted?profile.skin:baked?.skin||profile.skin};}
