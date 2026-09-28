// Face packs: a phone 3D face scan fitted onto one of the game heads by tools/human/scan/make-face-pack.mjs.
//
// File (.tlface, JSON text, at most FACE_PACK_MAX characters):
//   {kind:'touchline-face-pack', version:1, avatar, head:{count, offsets}, hair:{count, offsets}|null,
//    texture, online, skin, createdAt}
// `offsets`: how far each vertex of the head's (or its hair cards') geometry moves from its rest position, in the
// game's own vertex order (the tool reads the model the way the game does), 3 signed bytes per vertex in 0.25 mm
// steps (+-31.75 mm), base64. `texture`: the head texture with the scan's face baked in (1024 px JPEG), `online`
// a 256 px copy for friend matches, `skin` the face's median colour.
// In the game the pack becomes a face asset (`scan`, src/face-assets.js) and each player's runtime profile gets
// `faceScan` {avatar, head, hair, texture, skin} (src/player-editor.js lineups); online only the small texture goes.
// Pure (no DOM, no three.js) so it can be tested and used by the tool in Node.
import {validFaceTexture,FACE_BASES} from './face-settings.js';
export const FACE_PACK_KIND='touchline-face-pack',FACE_PACK_MAX=560000,SCAN_TEXTURE_MAX=440000,SCAN_ONLINE_MAX=30000,OFFSET_STEP=.00025;
const MAX_VERTICES=6000;

export function encodeOffsets(offsets){ // metres (flat xyz) -> base64 of signed bytes
 let text='';for(const v of offsets){const q=Math.max(-127,Math.min(127,Math.round(v/OFFSET_STEP)));text+=String.fromCharCode(q&255);}
 return btoa(text);
}
export function decodeOffsets(value,count){
 const text=atob(value),out=new Float32Array(count*3);
 for(let i=0;i<count*3;i++){const b=text.charCodeAt(i);out[i]=(b>127?b-256:b)*OFFSET_STEP;}
 return out;
}
const validOffsets=raw=>{
 if(!raw||typeof raw!=='object'||!Number.isInteger(raw.count)||raw.count<1||raw.count>MAX_VERTICES||typeof raw.offsets!=='string')return null;
 // 3 bytes per vertex are exactly 4 base64 characters.
 return raw.offsets.length===raw.count*4&&/^[A-Za-z0-9+/]*={0,2}$/.test(raw.offsets)?{count:raw.count,offsets:raw.offsets}:null;
};
const validAvatar=id=>typeof id==='string'&&id!=='auto'&&Object.hasOwn(FACE_BASES,id)?id:null;
const validSkin=hex=>/^#[\da-f]{6}$/i.test(hex||'')?hex:'#c89572';

/** A player's scan face ({avatar, head, hair, texture, skin}), or null. `max`: the texture size allowed here. */
export function cleanFaceScan(raw,max=SCAN_TEXTURE_MAX){
 if(!raw||typeof raw!=='object')return null;
 const avatar=validAvatar(raw.avatar),head=validOffsets(raw.head),texture=validFaceTexture(raw.texture,max);
 if(!avatar||!head||!texture)return null;
 return {avatar,head,hair:raw.hair?validOffsets(raw.hair):null,texture,skin:validSkin(raw.skin)};
}
/** A face pack file's content, checked; throws with a message for the player editor otherwise. */
export function cleanFacePack(raw){
 if(typeof raw==='string'){if(raw.length>FACE_PACK_MAX)throw Error('얼굴 팩 파일이 너무 큽니다.');try{raw=JSON.parse(raw);}catch{throw Error('얼굴 팩 파일을 읽을 수 없습니다.');}}
 if(!raw||raw.kind!==FACE_PACK_KIND||raw.version!==1)throw Error('Touchline 얼굴 팩(.tlface) 파일이 아닙니다.');
 const scan=cleanFaceScan(raw),online=validFaceTexture(raw.online,SCAN_ONLINE_MAX);
 if(!scan)throw Error('얼굴 팩의 머리 모델·이동값·텍스처 형식을 확인해 주세요.');
 if(!online)throw Error('얼굴 팩의 온라인용 텍스처가 없거나 너무 큽니다.');
 return {kind:FACE_PACK_KIND,version:1,...scan,online,createdAt:typeof raw.createdAt==='string'?raw.createdAt.slice(0,30):new Date().toISOString()};
}
/** The online form of a scan face: the same offsets with the small texture, or null. */
export function networkFaceScan(scan,online){const small=validFaceTexture(online,SCAN_ONLINE_MAX);return scan&&small?cleanFaceScan({...scan,texture:small},SCAN_ONLINE_MAX):null;}
