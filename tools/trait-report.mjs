// Markdown tables from a tools/trait-measure.mjs result: node tools/trait-report.mjs measure.json > report.md
import fs from 'node:fs';
import {TRAITS} from '../src/traits.js';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),runs=data.runs;
const by=mode=>runs.filter(r=>r.mode===mode),modes=[...new Set(runs.map(r=>r.mode))];
const sum=a=>a.reduce((x,y)=>x+y,0),mean=a=>a.length?sum(a)/a.length:NaN,f=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'–';
const outfield=r=>r.players.filter(p=>p.role!=='GK'),all=(rs,pick)=>rs.flatMap(r=>outfield(r).flatMap(pick));
const perMatch=(rs,pick)=>sum(rs.map(r=>sum(r.players.map(pick))))/rs.length;
// Standard error of the per-match mean, to show how much of a difference is noise.
const se=a=>{if(a.length<2)return NaN;const m=mean(a);return Math.sqrt(sum(a.map(x=>(x-m)**2))/(a.length-1)/a.length);};
const out=[];const row=cells=>out.push('| '+cells.join(' | ')+' |');
out.push(`AI 대 AI, 고정 시드 ${data.seeds}판씩, 전후반 각 ${data.halfSeconds}초(게임 기본 길이), CPU ${data.cpuSeconds}초.`,'');
out.push('### 1. 전체 경기 지표 (경기당 평균)','');
row(['설정','득점(±표준오차)','홈 득점','원정 득점','홈 점유율','슛','패스','반칙','슬라이딩','오프사이드','필드 선수 종료 체력']);row(Array(11).fill('---'));
for(const mode of modes){const rs=by(mode),goals=rs.map(r=>r.score[0]+r.score[1]),poss=rs.map(r=>r.possession[0]/Math.max(1e-9,r.possession[0]+r.possession[1]));
 row([mode,`${f(mean(goals),2)} ± ${f(se(goals),2)}`,f(mean(rs.map(r=>r.score[0])),2),f(mean(rs.map(r=>r.score[1])),2),f(mean(poss)*100,1)+'%',f(mean(rs.map(r=>r.shots[0]+r.shots[1])),1),f(mean(rs.map(r=>r.passes[0]+r.passes[1])),1),f(mean(rs.map(r=>r.fouls[0]+r.fouls[1])),2),f(perMatch(rs,p=>p.slides),2),f(mean(rs.map(r=>r.offsides)),2),f(mean(rs.flatMap(r=>r.staminaEnd.filter((_,i)=>i%11!==0))),3)]);}
out.push('','### 2. 특성 하나만 양 팀 해당 선수 전원에게 줬을 때 (neutral 대비)','');
row(['특성','지표','neutral','특성 적용']);row(['---','---','---','---']);
const n=by('neutral');
const metrics={
 longShots:[['25 m 이상 슛/경기',rs=>perMatch(rs,p=>p.shots.filter(d=>d>=25).length)],['평균 슛 거리 m',rs=>mean(all(rs,p=>p.shots))],['슛/경기',rs=>perMatch(rs,p=>p.shots.length)]],
 earlyCross:[['측면 크로스/경기',rs=>perMatch(rs,p=>p.crosses.length)],['크로스 위치(상대 쪽 m, 0=하프라인)',rs=>mean(all(rs,p=>p.crosses))],['16 m 전 크로스/경기',rs=>perMatch(rs,p=>p.crosses.filter(x=>x<16).length)],['이른 크로스 판단/경기',rs=>perMatch(rs,p=>p.earlyCrosses||0)]],
 soloPlay:[['드리블 m/경기(필드 22명 합)',rs=>perMatch(rs,p=>p.dribble)],['패스/경기',rs=>mean(rs.map(r=>r.passes[0]+r.passes[1]))]],
 playmaker:[['패스/경기',rs=>mean(rs.map(r=>r.passes[0]+r.passes[1]))],['드리블 m/경기',rs=>perMatch(rs,p=>p.dribble)]],
 speedDribbler:[['드리블 m/경기',rs=>perMatch(rs,p=>p.dribble)],['공 가진 동안 평균 속도 m/s',rs=>perMatch(rs,p=>p.dribble)/perMatch(rs,p=>p.dribbleTime||0)],['뛴 거리 m/선수/경기',rs=>mean(all(rs,p=>[p.run]))]],
 runner:[['침투 달리기/경기',rs=>perMatch(rs,p=>p.runs)],['오프사이드/경기',rs=>mean(rs.map(r=>r.offsides))]],
 longPasser:[['평균 패스 길이 m',rs=>mean(all(rs,p=>p.passLengths||[]))],['30 m 이상 패스/경기',rs=>perMatch(rs,p=>(p.passLengths||[]).filter(d=>d>=30).length)]],
 teamPlayer:[['드리블 m/경기',rs=>perMatch(rs,p=>p.dribble)],['패스/경기',rs=>mean(rs.map(r=>r.passes[0]+r.passes[1]))]],
 slideTackler:[['슬라이딩/경기',rs=>perMatch(rs,p=>p.slides)],['반칙/경기',rs=>mean(rs.map(r=>r.fouls[0]+r.fouls[1]))],['경고+퇴장/경기',rs=>mean(rs.map(r=>sum(r.yellows)+sum(r.reds)))]],
 powerHeader:[['헤딩/경기',rs=>perMatch(rs,p=>p.headers.length)],['헤딩 공 속도 m/s',rs=>mean(all(rs,p=>p.headers))]],
 finesse:[['먼 포스트 슛/경기',rs=>perMatch(rs,p=>p.farShots)],['먼 포스트 슛 득점률',rs=>perMatch(rs,p=>p.farGoals)/perMatch(rs,p=>p.farShots)]],
 tireless:[['필드 선수 종료 체력',rs=>mean(rs.flatMap(r=>r.staminaEnd.filter((_,i)=>i%11!==0)))],['뛴 거리 m/선수/경기',rs=>mean(all(rs,p=>[p.run]))]],
 sweeper:[['키퍼 전진 처리 시도/경기',rs=>perMatch(rs,p=>p.sweeps)],['득점/경기',rs=>mean(rs.map(r=>r.score[0]+r.score[1]))]],
 crossClaimer:[['키퍼 공중볼 나옴/경기',rs=>perMatch(rs,p=>p.claims)],['선방·잡기/경기',rs=>perMatch(rs,p=>p.saves)],['득점/경기',rs=>mean(rs.map(r=>r.score[0]+r.score[1]))]]
};
for(const [id,list] of Object.entries(metrics)){const rs=by('only:'+id);if(!rs.length)continue;for(const [label,fn] of list)row([`${TRAITS[id].name} (${id})`,label,f(fn(n),2),f(fn(rs),2)]);}
out.push('','### 3. 공격·수비 가담 (필드 선수 전원, 특성 없음)','');
row(['설정','득점','슛','뛴 거리 m/선수','종료 체력','침투 달리기/경기']);row(Array(6).fill('---'));
for(const mode of ['neutral','work:high/mid','work:low/mid','work:mid/high','work:mid/low','workrate']){const rs=by(mode);if(!rs.length)continue;
 row([mode,f(mean(rs.map(r=>r.score[0]+r.score[1])),2),f(mean(rs.map(r=>r.shots[0]+r.shots[1])),1),f(mean(all(rs,p=>[p.run])),0),f(mean(rs.flatMap(r=>r.staminaEnd.filter((_,i)=>i%11!==0))),3),f(perMatch(rs,p=>p.runs),2)]);}
out.push('','### 4. 기본 선수단 선수별 비교 (같은 자리, neutral → 기본 특성·가담)','');
const t=by('traits');
row(['자리','포지션','특성','가담(공/수)','슛 수','평균 슛 거리','크로스 수','평균 크로스 위치','패스 받음','드리블 m','슬라이딩','반칙','뛴 거리 m']);row(Array(13).fill('---'));
const slot=(rs,id,pick)=>rs.map(r=>r.players.find(p=>p.id===id)).map(pick);
const pair=(id,pick,d=0,avg=false)=>{const a=slot(n,id,pick),b=slot(t,id,pick);return avg?`${f(mean(a.flat()),d)} → ${f(mean(b.flat()),d)}`:`${f(sum(a)/n.length,d)} → ${f(sum(b)/t.length,d)}`;};
const L={high:'상',mid:'중',low:'하'};
for(let id=0;id<(t.length?22:0);id++){const r=t[0],p=r.players.find(p=>p.id===id);
 row([`${id<11?'홈':'원정'} ${id%11+1}`,p.role,r.traits[id].map(x=>TRAITS[x].name).join(', ')||'–',`${L[r.workRate[id].attack]}/${L[r.workRate[id].defence]}`,pair(id,p=>p.shots.length,2),pair(id,p=>p.shots,1,true),pair(id,p=>p.crosses.length,2),pair(id,p=>p.crosses,1,true),pair(id,p=>p.received,1),pair(id,p=>p.dribble,0),pair(id,p=>p.slides,2),pair(id,p=>p.fouls,2),pair(id,p=>p.run,0)]);}
out.push('','슛·크로스·패스 받음·드리블·슬라이딩·반칙·뛴 거리는 경기당 평균입니다. 평균 슛 거리·크로스 위치는 해당 판 전체의 평균입니다.');
console.log(out.join('\n'));
