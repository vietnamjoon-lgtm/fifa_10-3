import {STAT_FIELDS} from './squads.js';
const factors={pace:10,acceleration:5,reach:100/2.1,height:100,build:100,skillMoves:1};
export const ratingLabels={pace:'속력',acceleration:'가속력',agility:'민첩성',balance:'균형감각',control:'볼 컨트롤',passing:'짧은 패스',longPass:'긴 패스',shooting:'골결정력',power:'슛 파워',tackling:'태클',strength:'몸싸움',reflexes:'GK 반응',reach:'GK 도달 범위',weakFoot:'약한 발',skillMoves:'개인기 ★'};
export const displayValue=(key,value)=>['height','weight'].includes(key)?Math.round(value*(factors[key]||1)*10)/10:Math.round(value*(factors[key]||(STAT_FIELDS[key]?100:1)));
export const engineValue=(key,value)=>value/(factors[key]||(STAT_FIELDS[key]?100:1));
export function ratingRange(key){const [,min,max]=STAT_FIELDS[key];return [Math.round(min*(factors[key]||100)),Math.round(max*(factors[key]||100)),1];}
export function ratingGrade(value){return value>=90?'최상급':value>=80?'우수':value>=70?'준수':value>=60?'보통':'성장형';}
const mean=(...v)=>Math.round(v.reduce((a,b)=>a+b,0)/v.length);
export function ratingSummary(p){const n=key=>displayValue(key,p[key]);return [{key:'PAC',label:'스피드',value:mean(n('pace'),n('acceleration'))},{key:'SHO',label:'슈팅',value:mean(n('shooting'),n('power'))},{key:'PAS',label:'패스',value:mean(n('passing'),n('longPass'))},{key:'DRI',label:'드리블',value:mean(n('control'),n('agility'),n('balance'))},{key:'DEF',label:'수비',value:n('tackling')},{key:'PHY',label:'피지컬',value:mean(n('strength'),n('balance'))}];}
export function overallRating(p){const weights={FWD:{shooting:.28,pace:.2,control:.17,passing:.12,power:.15,agility:.08},MID:{passing:.26,longPass:.17,control:.22,pace:.12,agility:.13,balance:.1},DEF:{tackling:.3,strength:.2,pace:.18,balance:.18,passing:.14},GK:{reflexes:.5,reach:.3,balance:.2}}[p.role]||{};return Math.round(Object.entries(weights).reduce((n,[key,w])=>n+displayValue(key,p[key])*w,0));}
