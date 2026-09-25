import {defaultSkillMoves} from './squads.js';

// FC Online skill moves (개인기) from the official control guide (docs/research/fco-skill-moves.md).
// Directions are relative to the attack, as in the guide ("왼쪽에서 우측으로 이동할 때 기준"):
// F = → forward, B = ← back, L = ↑ the player's left, R = ↓ the player's right, and the diagonals FL ↗, FR ↘, BL ↖, BR ↙.
// The same input can mean different moves; the player gets the highest-star move his skill-move stars allow.

export const HOLD=.22;
const MIRROR={L:'R',R:'L',FL:'FR',FR:'FL',BL:'BR',BR:'BL',F:'F',B:'B'};
const CARDINAL=new Set(['F','B','L','R']);

// A touch: [time, forward, side, speed, lift]. `side` is toward the move's side (+1 right variant, -1 left variant).
// `turn` is the body's rotation over the move in degrees toward that side; `pace` caps the run speed during it.
// `exit` marks the last touch as going where the stick points when it is played (if it points anywhere).
const base=[
 // ★
 {id:'ball-juggle',name:'볼 저글링(서 있을 때)',stars:1,state:'stand',keys:{mods:'c',special:'z-tap'},duration:1.3,pace:.6,pose:'juggle',air:true,touches:[[.14,.05,0,.3,3.1],[.66,.05,0,.3,2.9],[1.12,.35,0,1,.02]]},
 {id:'foot-fake',name:'풋 페이크(서 있을 때)',stars:1,state:'stand',keys:{mods:'q',special:'z-tap'},duration:.6,pace:.6,pose:'fake-step',touches:[]},
 // ★★
 {id:'side-heel-flick',name:'측면 힐 플릭',stars:2,sided:true,keys:{mods:'q',taps:['L','R']},duration:.5,pace:2.6,pose:'heel',turn:20,touches:[[.22,-.1,1,4.2,.02]],exit:true},
 {id:'feint-chain',name:'연속 속임 동작 후 이동',stars:2,sided:true,keys:{mods:'q',sweep:['L','BL','B','BR','R']},duration:.78,pace:2.4,pose:'double-feint',touches:[[.56,.6,1,3.8,.02]],exit:true},
 {id:'body-feint',name:'속임 동작',stars:2,sided:true,keys:{taps:['R']},duration:.5,pace:3.2,pose:'feint',touches:[[.32,.55,.8,3.2,.02]],exit:true},
 {id:'step-over',name:'스텝오버',stars:2,sided:true,keys:{sweep:['F','FR','R']},duration:.5,pace:3.4,pose:'step-over',touches:[[.44,.95,-.25,3,.02]]},
 {id:'reverse-step-over',name:'역스텝오버',stars:2,sided:true,keys:{sweep:['R','FR','F']},duration:.5,pace:3.4,pose:'step-over-reverse',touches:[[.44,.95,.25,3,.02]]},
 {id:'side-step',name:'사이드 스텝',stars:2,sided:true,keys:{hold:'L'},duration:.6,pace:2,pose:'side-step',drift:1.2,touches:[[.2,.05,1,1.6,.02],[.46,.1,.4,1.2,.02]]},
 {id:'drag-back',name:'드래그 백',stars:2,keys:{mods:'z',plain:'B'},duration:.56,pace:2.4,pose:'drag',touches:[[.1,-1,0,1.35,.02],[.34,.4,0,3.1,.02]],exit:true},
 // ★★★
 {id:'drag-back-spin',name:'드래그 백 스핀',stars:3,sided:true,keys:{mods:'q',taps:['B','R']},duration:.62,pace:2,pose:'drag',turn:180,touches:[[.1,-1,0,1.3,.02],[.44,-.15,1,3.4,.02]],exit:true},
 {id:'three-touch-roulette',name:'3 터치 룰렛',stars:3,sided:true,keys:{mods:'c',taps:['B','R']},duration:.7,pace:1.8,pose:'roulette',turn:90,touches:[[.1,-.3,.6,1.3,.02],[.3,-.1,.9,1.5,.02],[.52,.3,1,3.2,.02]],exit:true},
 {id:'phantom-dribble',name:'팬텀 드리블',stars:3,sided:true,keys:{mods:'q',hold:'R'},duration:.62,pace:2.6,pose:'roll',touches:[[.16,.1,1,1.8,.02],[.46,.6,.6,3.2,.02]],exit:true},
 {id:'drag-turn',name:'볼 끌기 이후 턴',stars:3,sided:true,keys:{mods:'q',sweep:['B','BR','R','FR','F']},duration:.7,pace:2,pose:'drag',turn:60,touches:[[.12,-1,0,1.3,.02],[.5,.8,.6,3.4,.02]],exit:true},
 {id:'heel-flick',name:'힐 플릭',stars:3,keys:{taps:['F','B']},duration:.55,pace:4,pose:'heel',touches:[[.26,1,0,5.4,.35]]},
 {id:'ball-lift',name:'볼 띄우기',stars:3,keys:{taps:['F','F','F']},duration:.62,pace:2,pose:'lift',air:true,touches:[[.2,.25,0,.9,3.4]]},
 {id:'roulette',name:'룰렛',stars:3,sided:true,keys:{sweep:['B','BL','L','FL','F','FR','R']},duration:.72,pace:2.2,pose:'roulette',turn:360,touches:[[.16,-.3,.3,1.2,.02],[.48,.9,.2,3.2,.02]],exit:true},
 {id:'feint-exit',name:'속임 동작 후 이동',stars:3,sided:true,keys:{sweep:['L','BL','B','BR','R']},duration:.56,pace:3,pose:'feint',touches:[[.36,.5,1,3.4,.02]],exit:true},
 // ★★★★
 {id:'flick-up-jump',name:'양발에 볼 끼고 점프(정지 상태)',stars:4,state:'stand',keys:{special:'backquote'},duration:.8,pace:.5,pose:'jump',air:true,touches:[[.26,.1,0,.5,4.2]]},
 {id:'heel-flick-2',name:'힐 플릭2',stars:4,keys:{taps:['F','B']},duration:.5,pace:4.4,pose:'heel',touches:[[.22,1,0,6,.45]]},
 {id:'rainbow',name:'레인보우',stars:4,keys:{taps:['B','F','F']},duration:.66,pace:4,pose:'rainbow',air:true,touches:[[.3,1,0,6.2,5]]},
 {id:'advanced-rainbow',name:'고급 레인보우',stars:4,keys:{taps:['B','hold:F','F']},duration:.7,pace:4,pose:'rainbow',air:true,touches:[[.32,1,0,7,5.8]]},
 {id:'feint-knock',name:'속임 동작 후 치고 달리기',stars:4,sided:true,keys:{sweep:['L','BL','B','BR','R']},duration:.52,pace:4.2,pose:'feint',touches:[[.33,.65,1,6.4,.02]],exit:true},
 {id:'spin',name:'돌기',stars:4,sided:true,keys:{taps:['BR','BR']},duration:.66,pace:2.6,pose:'roulette',turn:360,touches:[[.2,.4,.2,2.2,.02],[.54,.8,0,3.4,.02]],exit:true},
 {id:'stop-turn',name:'멈춘 다음 턴(달리는 도중)',stars:4,sided:true,state:'run',keys:{taps:['F','R']},duration:.62,pace:1.2,pose:'drag',turn:90,touches:[[.1,0,0,0,0],[.46,0,1,3.4,.02]],exit:true},
 {id:'ball-roll-cut',name:'볼 롤 컷',stars:4,sided:true,keys:{holds:['L','R']},duration:.66,pace:2,pose:'roll',touches:[[.16,0,-1.1,1.8,.02],[.5,.2,1,3.4,.02]],exit:true},
 {id:'heel-chop',name:'힐 춉(달리는 도중)',stars:4,sided:true,state:'run',keys:{mods:'c',special:'fake',side:'R'},duration:.6,pace:2.2,pose:'heel',turn:90,touches:[[.3,-.2,1,3.6,.02]],exit:true},
 {id:'scoop-turn',name:'스쿱 턴(정지 상태)',stars:4,sided:true,state:'stand',keys:{special:'fake',side:'R'},duration:.72,pace:1.2,pose:'scoop',turn:120,air:true,touches:[[.26,-.3,.8,2.2,.35],[.56,.2,1,3,.02]],exit:true},
 {id:'heel-flick-turn',name:'힐 플릭 턴',stars:4,keys:{mods:'z',taps:['F','B']},duration:.6,pace:2,pose:'heel',turn:180,touches:[[.26,-.8,0,4,.02]],exit:true},
 // ★★★★★
 {id:'elastico',name:'엘라스티코',stars:5,sided:true,labels:{right:'역 엘라스티코',left:'엘라스티코'},keys:{sweep:['L','BL','B','BR','R']},duration:.42,pace:3.4,pose:'elastico',touches:[[.08,.1,-.8,1.6,.02],[.2,.5,1,4.2,.02]],exit:true},
 {id:'quick-ball-roll',name:'퀵 볼 롤',stars:5,keys:{hold:'B'},duration:.5,pace:1.6,pose:'roll',touches:[[.14,0,1,1.5,.02],[.38,0,1,1.5,.02]]},
 {id:'hocus-pocus',name:'호커스 포커스',stars:5,side:1,keys:{sweep:['B','BL','L','BL','B','BR','R']},duration:.72,pace:2.4,pose:'elastico',turn:90,touches:[[.14,-.4,-.3,1.4,.02],[.48,.2,1,3.6,.02]],exit:true},
 {id:'triple-elastico',name:'트리플 엘라스티코',stars:5,side:-1,keys:{sweep:['B','BR','R','BR','B','BL','L']},duration:.6,pace:3,pose:'elastico',touches:[[.1,.1,-.7,1.4,.02],[.26,.1,.7,1.4,.02],[.42,.5,1,4,.02]],exit:true},
 {id:'roll-flick',name:'볼 굴린 후 휙 움직이기',stars:5,sided:true,state:'run',keys:{holdTap:['R','F']},duration:.6,pace:2.8,pose:'roll',touches:[[.18,.1,1,1.8,.02],[.46,.9,-.4,4.2,.02]]},
 {id:'cancel-lift',name:'캔슬 리프팅(정지 상태)',stars:5,state:'stand',keys:{taps:['F','F','B']},duration:.9,pace:.6,pose:'lift',air:true,touches:[[.2,.25,0,.9,3],[.72,-.2,0,.8,.02]]},
 {id:'turn-spin',name:'턴 스핀',stars:5,sided:true,state:'run',keys:{taps:['F','R']},duration:.5,pace:2,pose:'roulette',turn:90,touches:[[.08,0,0,0,0],[.32,.2,1,4,.02]],exit:true},
 {id:'ball-roll-fake',name:'볼 롤 속임 동작(정지 상태)',stars:5,sided:true,state:'stand',keys:{holdTap:['R','L']},duration:.7,pace:1.2,pose:'roll',touches:[[.18,0,1,1.4,.02],[.55,0,-.8,1.6,.02]]},
 {id:'rabona-fake',name:'라보나 속임 동작(이동 중)',stars:5,keys:{mods:'c',special:'fake',side:'B'},duration:.66,pace:2.6,pose:'rabona',touches:[[.38,.4,1,3.4,.02]],exit:true},
 {id:'elastico-chop',name:'엘라스티코 촙',stars:5,sided:true,keys:{taps:['B','R']},duration:.46,pace:3,pose:'elastico',touches:[[.12,-.2,-.6,1.2,.02],[.3,.3,1,3.6,.02]],exit:true},
 {id:'scoop-turn-run',name:'스쿱 턴(달리는 도중)',stars:5,sided:true,state:'run',keys:{special:'fake',side:'R'},duration:.66,pace:2,pose:'scoop',turn:120,air:true,touches:[[.24,-.3,.8,2.4,.35],[.52,.2,1,3.2,.02]],exit:true},
 {id:'juggling',name:'저글링',stars:5,keys:{mods:'c',special:'z-hold'},duration:1.6,pace:.8,pose:'juggle',air:true,touches:[[.14,.05,0,.3,3.1],[.64,.05,0,.3,2.9],[1.14,.05,0,.3,2.9],[1.52,.4,0,1.2,.02]]},
 {id:'sombrero',name:'오코차 솜브레로(정지 상태)',stars:5,state:'stand',keys:{hold:'F'},duration:.7,pace:1.5,pose:'lift',air:true,touches:[[.3,.6,0,3,4]]},
 {id:'neymar-step-over',name:'네이마르 스텝 오버(정지 상태)',stars:5,sided:true,state:'stand',keys:{holdTap:['R','F']},duration:1.05,pace:1,pose:'step-over',touches:[[.9,.9,.2,3.2,.02]],exit:true},
 {id:'bolasie-flick',name:'볼라시 플릭',stars:5,keys:{mods:'z',taps:['F']},duration:.56,pace:2.6,pose:'heel',touches:[[.1,-.2,0,1.2,.02],[.34,.9,0,4,.02]],exit:true},
 {id:'bolasie-flick-side',name:'볼라시 플릭',stars:5,sided:true,keys:{mods:'z',taps:['R']},duration:.56,pace:2.4,pose:'heel',touches:[[.1,-.2,0,1.2,.02],[.34,.3,1,3.6,.02]],exit:true},
 // No-touch feints and stops from the basic movement controls.
 {id:'no-touch-feint',name:'노 터치 작은 페인팅',stars:1,keys:{special:'q-tap'},duration:.4,pace:4,pose:'feint',touches:[]},
 {id:'no-touch-big-feint',name:'노 터치 큰 페인팅',stars:1,keys:{special:'q-tap',mods:'e'},duration:.62,pace:3.6,pose:'double-feint',touches:[]},
];

function mirrorKeys(keys){const m=d=>typeof d==='string'&&d.startsWith('hold:')?'hold:'+MIRROR[d.slice(5)]:MIRROR[d]||d,out={...keys};
 for(const k of ['taps','sweep','holds','holdTap'])if(keys[k])out[k]=keys[k].map(m);for(const k of ['hold','plain','side'])if(keys[k])out[k]=m(keys[k]);return out;}
/** Every move, keyed 'fco-<id>' (':right'/':left' for sided moves) so the older skill ids stay distinct. The guide lists right-hand inputs; the left variant
 * mirrors them. */
export const MOVES=base.flatMap(m=>m.sided?[{...m,key:'fco-'+m.id+':right',side:1,label:m.labels?.right||'오른쪽 '+m.name},{...m,key:'fco-'+m.id+':left',side:-1,label:m.labels?.left||'왼쪽 '+m.name,keys:mirrorKeys(m.keys)}]:[{...m,key:'fco-'+m.id,side:m.side??1,label:m.name}]);
export const MOVE_BY_KEY=Object.fromEntries(MOVES.map(m=>[m.key,m]));

export function skillStars(p){return Math.round(p.skillMoves??defaultSkillMoves(p));}

/** Screen arrow direction (x right, z down) to the relative code for a team attacking along +x (d=1) or -x (d=-1). */
export function relativeDir(x,z,d){const f=Math.sign(x*d),r=Math.sign(z*d);if(!f&&!r)return null;return (f>0?'F':f<0?'B':'')+(r>0?'R':r<0?'L':'')||null;}
const codeOf=d=>({F:'F',B:'B',L:'L',R:'R',FR:'FR',FL:'FL',BR:'BR',BL:'BL'})[d.length===2?d:d]||d;
const normal=d=>d.length===2?{FR:'FR',RF:'FR',FL:'FL',LF:'FL',BR:'BR',RB:'BR',BL:'BL',LB:'BL'}[d]:d;

/** Groups of arrow activity separated by releases: each has the directions visited in order with how long each was held. */
export function strokes(events,end){
 const groups=[];let cur=null;
 events.forEach((e,i)=>{const until=i+1<events.length?events[i+1].t:end;
  if(!e.dir){cur=null;return;}if(!cur){cur=[];groups.push(cur);}
  const d=normal(codeOf(e.dir)),last=cur[cur.length-1];if(last&&last.dir===d)last.held+=until-e.t;else cur.push({dir:d,held:until-e.t});});
 return groups;
}
const skeleton=g=>g.map(s=>s.dir).filter(d=>CARDINAL.has(d)).filter((d,i,a)=>i===0||a[i-1]!==d);
const sameSweep=(g,want)=>{const s=skeleton(g),w=want.filter(d=>CARDINAL.has(d));if(s.length!==w.length||s.some((d,i)=>d!==w[i]))return false;
 // Diagonals that were visited must be the ones between the cardinals (a sweep, not a jump across).
 const diag=g.map(x=>x.dir).filter(d=>!CARDINAL.has(d)),wd=want.filter(d=>!CARDINAL.has(d));return diag.every(d=>wd.includes(d));};
// The direction of one press: pressing a diagonal on a keyboard passes briefly through one of its arrows, so the
// direction held for most of the press counts.
const single=g=>{if(g.length===1)return g[0].dir;const total=g.reduce((a,x)=>a+x.held,0),top=[...g].sort((a,b)=>b.held-a.held)[0];if(top.held>=total*.7)return top.dir;
 const s=skeleton(g);return s.length===1&&g.every(x=>CARDINAL.has(x.dir)||x.held<.06)?s[0]:null;};

/** Whether the recorded strokes are exactly this move's keyboard gesture. */
export function matchesGesture(keys,groups){
 if(keys.sweep)return groups.length===1&&groups[0].length>=2&&sameSweep(groups[0],keys.sweep);
 if(keys.hold)return groups.length===1&&single(groups[0])===keys.hold&&groups[0].reduce((a,s)=>a+s.held,0)>=HOLD;
 if(keys.taps){if(groups.length!==keys.taps.length)return false;
  return keys.taps.every((want,i)=>{const hold=want.startsWith('hold:'),dir=hold?want.slice(5):want,g=groups[i],d=single(g),t=g.reduce((a,s)=>a+s.held,0);return d===dir&&(hold?t>=HOLD:t<HOLD);});}
 if(keys.holds){const [a,b]=keys.holds,flat=groups.flat();return flat.length>=2&&flat[0].dir===a&&flat[0].held>=HOLD&&flat.some((s,i)=>i>0&&s.dir===b&&s.held>=HOLD*.6);}
 if(keys.holdTap){const [a,b]=keys.holdTap,flat=groups.flat();if(!(flat[0]?.dir===a&&flat[0].held>=HOLD))return false;
  // The second key is a tap: held briefly, whether or not the first was released first.
  const rest=flat.slice(1);return rest.some(s=>(s.dir===b||s.dir===normal(a+b))&&s.held<HOLD)&&!rest.some(s=>s.dir===b&&s.held>=HOLD);}
 return false;
}

/** The move for a finished gesture: {events:[{dir:'FR'|...|null,t}], end, mods:{q,c,z,e}, special}, already relative
 * to the attack. The highest-star match the player can perform wins; unmatched or too hard gestures give null. */
export function resolveGesture(g,p){
 const stars=skillStars(p),speed=Math.hypot(p.vx||0,p.vz||0),standing=speed<1.2,groups=g.special?[]:strokes(g.events||[],g.end);
 const mods=g.mods||{},modKey=['q','c','z'].filter(k=>mods[k]).join('');
 const fits=MOVES.filter(m=>{const k=m.keys;if(m.stars>stars)return false;if(m.state==='stand'&&!standing||m.state==='run'&&standing)return false;
  if((k.mods||'').replace('e','')!==modKey&&!(k.special&&k.mods==='e'&&!modKey))return false;
  if(k.special||g.special){if(k.special!==g.special)return false;if(k.mods==='e'!==!!mods.e&&k.special==='q-tap')return false;if(k.side&&k.side!==g.side)return false;return true;}
  if(k.plain)return g.plain===k.plain;
  return !g.plain&&matchesGesture(k,groups);});
 fits.sort((a,b)=>b.stars-a.stars);return fits[0]||null;
}
