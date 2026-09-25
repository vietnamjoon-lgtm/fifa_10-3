import {celebrationOptions} from './celebrations.js';
import {cleanBody,cleanWeight,cleanBodyType} from './body-shape.js';
import {cleanFace,validFaceTexture} from './face-settings.js';
import {variedFace} from './face-variation.js';
import {roster,clamp} from './config.js';
export const STAT_FIELDS={pace:['최고 속도 · m/s',5,10,.01],acceleration:['가속',8,20,.1],agility:['민첩성',.2,1,.01],balance:['균형',.2,1,.01],control:['볼 컨트롤',.2,1,.01],passing:['짧은 패스',.2,1,.01],longPass:['긴 패스',.2,1,.01],shooting:['슛 정확도',.2,1,.01],power:['슛 파워',.2,1,.01],tackling:['태클',.2,1,.01],strength:['몸싸움',.2,1,.01],reflexes:['골키퍼 반응',.2,1,.01],reach:['골키퍼 도달 거리 · m',1.2,2.1,.01],weakFoot:['약한 발',.2,1,.01],skillMoves:['개인기 · 별',1,5,1]};
const text=(v,f,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n)||f:f;
const numeric=(v,f,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):f;
const color=(v,f)=>/^#[\da-f]{6}$/i.test(v)?v:f;
/** Skill-move stars from ball control and agility: an 85-rated dribbler gets 4 stars, a 60-rated one 2. */
export function defaultSkillMoves(p){const dribble=((p.control??.7)+(p.agility??.7))/2;return dribble>=.9?5:dribble>=.82?4:dribble>=.72?3:dribble>=.6?2:1;}
export function cleanProfile(raw={},fallback=roster(0)[9]){raw=raw&&typeof raw==='object'?raw:{};
 const p={uid:text(raw.uid,fallback.uid||`default-${fallback.id}`,64),name:text(raw.name,fallback.name,24),number:Math.round(numeric(raw.number,fallback.number,1,99)),role:['GK','DEF','MID','FWD'].includes(raw.role)?raw.role:fallback.role,height:numeric(raw.height,fallback.height,1.55,2.1),build:numeric(raw.build,fallback.build,.8,1.25),foot:raw.foot==='left'?'left':'right',skin:color(raw.skin,'#c89572'),hair:color(raw.hair,'#211a15'),boots:color(raw.boots,'#d3ff47'),hairStyle:['short','crop','crest','bald'].includes(raw.hairStyle)?raw.hairStyle:'short',motionStyle:['balanced','compact','power'].includes(raw.motionStyle)?raw.motionStyle:'balanced'};
 for(const [key,[,min,max]]of Object.entries(STAT_FIELDS))p[key]=numeric(raw[key],fallback[key],min,max);
 // Skill-move stars (FC Online's 개인기 1~5성) for players saved before the stat existed come from ball control and agility.
 p.skillMoves=Math.round(numeric(raw.skillMoves,fallback.skillMoves??defaultSkillMoves(p),1,5));
 p.weight=cleanWeight(raw.weight,p);p.body=cleanBody(raw.body);p.bodyType=cleanBodyType(raw.bodyType,raw.body);
 p.celebration=Object.hasOwn(celebrationOptions,raw.celebration)?raw.celebration:'auto';
 p.face=cleanFace(variedFace(raw.face,p.uid||p.name));p.faceTexture=p.face.enabled?validFaceTexture(raw.faceTexture):null;
 return p;
}
export function defaultSquads(){const players=[...roster(0),...roster(1)].map(p=>cleanProfile({...p,uid:`default-${p.id}`,skin:['#bf8561','#976143','#deb18a','#74482f','#c89572','#e1ad88'][p.number%6],hairStyle:p.number%3===0?'crest':'short'}));return {version:1,players,lineups:[players.slice(0,11).map(p=>p.uid),players.slice(11).map(p=>p.uid)]};}
export function cleanLibrary(data){
 if(data?.version!==1||!Array.isArray(data.players)||data.players.length<11||data.players.length>200||!Array.isArray(data.lineups)||data.lineups.length!==2)throw Error('선수 파일 형식을 확인해 주세요.');
 const players=data.players.map(p=>{const clean=cleanProfile(p);delete clean.faceTexture;return clean;}),ids=new Set(players.map(p=>p.uid));if(ids.size!==players.length)throw Error('선수 식별자가 중복됐습니다.');
 const lineups=data.lineups.map(list=>{if(!Array.isArray(list)||list.length!==11||new Set(list).size!==11||list.some(id=>!ids.has(id)))throw Error('각 팀에는 서로 다른 선수 11명이 필요합니다.');return [...list];});
 for(const list of lineups)if(players.find(p=>p.uid===list[0]).role!=='GK'||list.slice(1).some(id=>players.find(p=>p.uid===id).role==='GK'))throw Error('첫 번째 자리는 골키퍼, 나머지는 필드 선수로 구성해 주세요.');
 return {version:1,players,lineups};
}
export const SQUAD_KEY='touchline-player-library-v1';
export function loadSquads(storage=globalThis.localStorage){try{return cleanLibrary(JSON.parse(storage.getItem(SQUAD_KEY)));}catch{return defaultSquads();}}
export function saveSquads(data,storage=globalThis.localStorage){const clean=cleanLibrary(data);storage.setItem(SQUAD_KEY,JSON.stringify(clean));return clean;}
export function lineupProfiles(data,team){return data.lineups[team].map(uid=>({...data.players.find(p=>p.uid===uid)}));}
export function cleanLineup(raw,team=0,network=false){const defaults=roster(team);const result=defaults.map((base,i)=>({...base,...cleanProfile(Array.isArray(raw)&&raw.length===11?raw[i]:base,base),role:i===0?'GK':(raw?.[i]?.role==='GK'?base.role:cleanProfile(raw?.[i]||base,base).role)}));if(network)for(const p of result){p.face.assetId=null;p.faceTexture=validFaceTexture(p.faceTexture,32000);}return result;}
export function applyLineups(match,lineups){for(let team=0;team<2;team++)for(const profile of cleanLineup(lineups?.[team],team))Object.assign(match.players[profile.id],profile);}
