import {clamp} from './config.js';

export const GAMEPLAY_FIELDS=[
 {key:'acceleration',label:'출발 반응',help:'높이면 달리기 속도가 더 빨리 붙습니다.'},
 {key:'braking',label:'멈춤 반응',help:'높이면 방향키를 놓았을 때 더 짧게 멈춥니다.'},
 {key:'turnResponse',label:'방향 전환',help:'높이면 몸을 새 방향으로 더 빠르게 돌립니다.'},
 {key:'ballRoll',label:'공 굴러가는 거리',help:'높이면 잔디에서 공이 더 오래 굴러갑니다.'},
 {key:'ballBounce',label:'공 튀는 높이',help:'높이면 땅에 닿은 공이 더 높이 튑니다.'},
 {key:'firstTouch',label:'첫 터치 안정감',help:'높이면 받는 순간 공의 속도를 더 부드럽게 줄입니다.'}
];
export const gameplayDefaults=Object.freeze({...Object.fromEntries(GAMEPLAY_FIELDS.map(f=>[f.key,100])),referee:'standard'});
export function cleanGameplay(raw){const out={...gameplayDefaults};if(!raw||typeof raw!=='object')return out;for(const {key} of GAMEPLAY_FIELDS)if(typeof raw[key]==='number'&&Number.isFinite(raw[key]))out[key]=Math.round(clamp(raw[key],80,120));if(['lenient','standard','strict'].includes(raw.referee))out.referee=raw.referee;return out;}
export const gameplayValue=(match,key)=>(match.gameplay?.[key]??100)/100;
export const foulThreshold=match=>match.gameplay?.referee==='strict'?.9:match.gameplay?.referee==='lenient'?1.1:1;
