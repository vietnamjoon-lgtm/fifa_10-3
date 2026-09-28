// Player traits and work rates. A trait changes what a player tends to choose, not how good he is at it: no rating
// goes up. Names and descriptions are this game's own wording; the effects and their sizes are our own tuning.
// ai: the trait only steers the AI's choices and never touches a player a person is controlling.
// general: it changes the player's own play whoever controls him. keeper: goalkeepers only.
export const TRAITS={
 longShots:{name:'먼 거리 슈팅',kind:'ai',roles:['MID','FWD','DEF'],text:'25~30 m에서도 슛 길이 보이면 과감하게 때립니다.'},
 earlyCross:{name:'이른 측면 배달',kind:'ai',roles:['DEF','MID','FWD'],text:'측면 끝까지 가지 않고 하프라인 쪽에서도 크로스를 올립니다.'},
 soloPlay:{name:'혼자 해결',kind:'ai',roles:['MID','FWD','DEF'],text:'패스보다 직접 몰고 가는 쪽을 먼저 봅니다.'},
 playmaker:{name:'경기 조율',kind:'ai',roles:['MID','FWD','DEF'],text:'동료들이 공을 더 자주 맡기고, 공을 잡으면 판단이 빠릅니다.'},
 speedDribbler:{name:'질주 드리블',kind:'ai',roles:['MID','FWD','DEF'],text:'앞이 비면 공을 길게 치고 전력으로 달립니다.'},
 runner:{name:'뒷공간 침투',kind:'ai',roles:['MID','FWD','DEF'],text:'수비 라인에 바짝 붙어 있다가 뒷공간으로 자주 뛰어듭니다.'},
 longPasser:{name:'긴 패스 전환',kind:'ai',roles:['DEF','MID','FWD'],text:'멀리 있는 동료와 반대편 측면을 먼저 찾습니다.'},
 teamPlayer:{name:'동료 우선',kind:'ai',roles:['DEF','MID','FWD'],text:'압박이 오면 오래 끌지 않고 가까운 동료에게 안전하게 넘깁니다.'},
 slideTackler:{name:'몸 던지는 수비',kind:'general',roles:['DEF','MID','FWD'],text:'태클을 몸을 던져 하는 편입니다. 닿는 범위가 넓지만 반칙도 잦습니다.'},
 powerHeader:{name:'강한 머리받기',kind:'general',roles:['DEF','MID','FWD'],text:'머리로 맞힌 공이 조금 더 세고 정확합니다.'},
 finesse:{name:'휘감는 마무리',kind:'general',roles:['MID','FWD','DEF'],text:'먼 포스트를 노린 슛의 오차가 줄고 더 크게 휩니다.'},
 tireless:{name:'강철 체력',kind:'general',roles:['DEF','MID','FWD','GK'],text:'많이 뛰어도 체력이 천천히 줄어듭니다.'},
 sweeper:{name:'전진 수문장',kind:'keeper',roles:['GK'],text:'수비 뒷공간으로 온 공을 멀리까지 나와 먼저 처리합니다.'},
 crossClaimer:{name:'공중볼 장악',kind:'keeper',roles:['GK'],text:'높이 올라온 크로스에 자주 나와 잡습니다.'}
};
export const TRAIT_MAX=5;
export const WORK_RATES=['high','mid','low'];
export const WORK_RATE_LABELS={high:'높음',mid:'보통',low:'낮음'};
// Position defaults for players saved before work rates existed and for the built-in squads.
export const ROLE_WORK_RATE={FWD:{attack:'high',defence:'low'},MID:{attack:'mid',defence:'mid'},DEF:{attack:'low',defence:'high'},GK:{attack:'mid',defence:'mid'}};
// Traits that suit each position, for the built-in players.
const ROLE_POOL={FWD:['runner','longShots','speedDribbler','finesse','soloPlay','powerHeader'],MID:['playmaker','longPasser','teamPlayer','longShots','tireless','earlyCross'],DEF:['slideTackler','powerHeader','longPasser','tireless','teamPlayer','earlyCross'],GK:['sweeper','crossClaimer']};
// Built-in players: the default squads, the K League presets and pack cards. Their traits come from their id.
export const builtInId=uid=>typeof uid==='string'&&/^(default-|kleague-|card-)/.test(uid);
export function traitSeed(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
/** One or two traits that suit the position, the same every time for the same id. */
export function defaultTraits(role,seedText){
 const pool=[...(ROLE_POOL[role]||ROLE_POOL.MID)];let h=traitSeed(seedText);const count=1+(h&1),out=[];
 for(let i=0;i<count&&pool.length;i++){h=Math.imul(h^h>>>13,0x5bd1e995)>>>0;out.push(pool.splice(h%pool.length,1)[0]);}
 return out;
}
/** Known, unique trait ids in their given order, at most TRAIT_MAX. Keeper traits need a keeper. */
export function cleanTraits(raw,role){
 if(!Array.isArray(raw))return null;const out=[];
 for(const id of raw)if(typeof id==='string'&&Object.hasOwn(TRAITS,id)&&!out.includes(id)&&(TRAITS[id].kind!=='keeper'||role==='GK')&&out.length<TRAIT_MAX)out.push(id);
 return out;
}
export function cleanWorkRate(raw,role){
 const base=ROLE_WORK_RATE[role]||ROLE_WORK_RATE.MID,pick=(v,f)=>WORK_RATES.includes(v)?v:f;
 return {attack:pick(raw?.attack,base.attack),defence:pick(raw?.defence,base.defence)};
}
/** traits and workRate for a profile; missing values fall back to the position defaults described above. */
export function profileTraits(raw,p,fallback){
 const traits=cleanTraits(raw.traits,p.role)??(builtInId(p.uid)?defaultTraits(p.role,p.uid):cleanTraits(fallback?.traits,p.role)??[]);
 return {traits,workRate:cleanWorkRate(raw.workRate,p.role)};
}
export const hasTrait=(p,id)=>!!p?.traits?.includes(id);
// Work rate as a number: high 1, mid 0, low -1. A player without the field (an old test fixture) is neutral.
export const workLevel=(p,side)=>{const v=p?.workRate?.[side];return v==='high'?1:v==='low'?-1:0;};
export const traitNames=p=>(p?.traits||[]).map(id=>TRAITS[id]?.name).filter(Boolean);
