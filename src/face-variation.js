import {FACE_SHAPE} from './face-settings.js';
// 선수마다 다른 얼굴이 나오도록 식별자에서 얼굴 형태를 만들어 냅니다. 같은 선수는 항상 같은 얼굴입니다.
const hash=text=>{let h=2166136261;for(const ch of String(text))h=Math.imul(h^ch.codePointAt(0),16777619);return h>>>0;};
const SPREAD=.62;
export function faceVariation(seed){
 let state=hash(seed)||1;
 const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const shape={};
 for(const [key,[,min,max]] of Object.entries(FACE_SHAPE)){
  // 균등 난수 세 번을 평균해 가운데로 모으면 과장된 얼굴이 덜 나옵니다.
  const bell=(next()+next()+next())/3;
  shape[key]=min+(max-min)*(.5+(bell-.5)*SPREAD);
 }
 return shape;
}
const KEYS=Object.keys(FACE_SHAPE);
// 14개 값이 모두 정확히 1이면 예전 기본 얼굴이므로 직접 고른 얼굴로 보지 않습니다.
const untouched=shape=>!shape||typeof shape!=='object'||KEYS.every(key=>shape[key]===undefined||shape[key]===1);
export function variedFace(raw,seed){
 const face=raw&&typeof raw==='object'?raw:{};
 // 직접 다듬은 값은 그대로 두고, 손대지 않은 항목만 생성한 얼굴로 채웁니다.
 const saved=untouched(face.shape)?{}:face.shape;
 return {...face,shape:{...faceVariation(seed),...saved}};
}
