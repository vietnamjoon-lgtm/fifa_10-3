import {SKILLS} from './skills.js';
// Skill guide: every skill with its keys, difficulty and use, played back by the menu's
// 3D motion preview (the same pose and ball touches the match uses) when it is picked.
export const SKILL_GUIDE=[
 {id:'step-over',stars:2,how:'공을 발 앞에 둔 채 발을 공 바깥으로 넘겨 속인 뒤, 반대쪽으로 빠져나갑니다.',use:'수비수와 1:1로 마주 섰을 때 가장 기본적인 페인트.'},
 {id:'ball-roll',stars:2,how:'발바닥으로 공을 옆으로 굴려 몸 앞을 가로질러 옮깁니다.',use:'측면에서 안쪽으로 파고들거나 각도를 만들 때.'},
 {id:'drag-back',stars:2,how:'발바닥으로 공을 뒤로 끌어 멈춘 뒤, 방향을 바꿔 다시 출발합니다.',use:'앞이 막혔을 때 공을 지키며 돌아서기.'},
 {id:'nutmeg',stars:3,how:'수비수 다리 사이로 공을 짧게 찔러 넣고 뒤로 돌아 들어갑니다.',use:'수비수가 다리를 벌리고 달려들 때.'},
 {id:'heel-flick',stars:3,how:'뒤꿈치로 공을 앞쪽으로 튕겨 수비수의 타이밍을 빼앗습니다.',use:'등지고 있다가 빠르게 앞으로 공을 보낼 때.'},
 {id:'drag-to-heel',stars:4,how:'발바닥으로 끌어온 공을 디딤발 뒤로 뒤꿈치로 쳐서 옆으로 빼냅니다.',use:'측면에서 수비수를 제치고 안쪽으로 방향 전환.'},
 {id:'roulette',stars:4,how:'발바닥으로 공을 끌며 몸을 한 바퀴 돌리고, 반대발로 공을 이어 빼냅니다.',use:'바로 앞의 수비수를 몸으로 막으며 옆으로 돌아 나가기.'},
 {id:'la-croqueta',stars:4,how:'발 안쪽으로 공을 반대발 쪽으로 빠르게 옮기고, 그 발로 바로 치고 나갑니다.',use:'좁은 공간에서 한 명을 옆으로 빠르게 제칠 때.'},
 {id:'rainbow-flick',stars:4,how:'공을 뒤로 굴려 종아리 뒤로 올린 뒤, 뒤꿈치로 머리 위로 넘깁니다.',use:'앞의 수비수를 공중으로 넘길 때. 공이 떠 있는 동안 빼앗기기 쉽습니다.'},
 {id:'elastico',stars:5,how:'발 바깥쪽으로 공을 밀었다가 같은 발 안쪽으로 순식간에 반대로 끌어옵니다.',use:'수비수가 한쪽으로 체중을 실었을 때 반대쪽으로 빠지기.'}
];
// Keys in this game: Shift + the skill's number (the 10th is Shift + 0).
export function skillKeys(id){const index=Object.keys(SKILLS).indexOf(id);return index<0?'':`Shift + ${(index+1)%10}`;}
const css=`
#skill-guide{position:absolute;left:18px;top:18px;bottom:18px;width:min(360px,calc(100vw - 36px));z-index:16;display:flex;flex-direction:column;gap:12px;pointer-events:auto;background:#0b1c17ed;border:1px solid #69816455;border-radius:9px;padding:18px;color:#f0f6e7;font-size:12px}
#skill-guide.hidden{display:none}
#skill-guide h2{font-size:24px;letter-spacing:-1px;margin:4px 0 2px}
#skill-guide .eyebrow{font-size:10px;letter-spacing:3px;color:var(--lime,#c6ff5d)}
#skill-guide p{margin:0;color:#bdcfba;line-height:1.6}
#skill-guide .list{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px}
#skill-guide .skill{display:grid;grid-template-columns:1fr auto;gap:4px 10px;text-align:left;padding:10px 12px;background:#1d3228;border:1px solid #6b825455;border-radius:7px;color:inherit;cursor:pointer;font:inherit}
#skill-guide .skill:hover{border-color:#c6ff5d88}
#skill-guide .skill.active{border-color:var(--lime,#c6ff5d);background:#26402f}
#skill-guide .skill b{font-size:13px}
#skill-guide .stars{color:var(--lime,#c6ff5d);letter-spacing:1px;font-size:11px}
#skill-guide kbd{justify-self:end;align-self:center;grid-row:span 2;padding:5px 8px;border:1px solid #9bb18e66;border-radius:5px;background:#0b1c17;font-size:11px;white-space:nowrap}
#skill-guide .detail{border-top:1px solid #69816455;padding-top:12px;display:flex;flex-direction:column;gap:6px}
#skill-guide .detail strong{color:var(--lime,#c6ff5d);font-size:11px;letter-spacing:1px}
#skill-guide .note{font-size:10px;color:#9bb18e}
#motion-preview.guide-mode>div:first-child{visibility:hidden}
@media (max-width:760px),(max-height:620px){#skill-guide{top:auto;height:52vh;padding:12px;gap:8px}#skill-guide>div:first-child p,#skill-guide .note{display:none}#skill-guide h2{font-size:18px}#skill-guide .list{min-height:40%}}
`;
// Adds the menu button and the guide panel; preview.show(kind) plays the chosen skill.
export function initSkillGuide(preview){
 const $=id=>document.getElementById(id),menuButton=$('motion-open');if(!menuButton||$('skill-guide-open'))return;
 const style=document.createElement('style');style.textContent=css;document.head.append(style);
 const open=document.createElement('button');open.id='skill-guide-open';open.textContent='개인기 가이드 ↗';menuButton.after(open);
 const panel=document.createElement('section');panel.id='skill-guide';panel.className='hidden';
 panel.innerHTML=`<div><span class="eyebrow">SKILL GUIDE</span><h2>개인기 가이드</h2><p>개인기를 누르면 선수가 직접 보여 줍니다. 오른쪽에서 왼발·오른발, 느린 재생, 카메라 각도를 바꿀 수 있어요.</p></div><div class="list"></div><div class="detail"></div><p class="note">공을 가진 상태에서 Shift를 누른 채 숫자키를 누릅니다. Shift + 방향키는 방향에 맞는 개인기(앞: 엘라스티코, 뒤: 드래그 백)를 씁니다.</p>`;
 document.body.append(panel);const list=panel.querySelector('.list'),detail=panel.querySelector('.detail');
 const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
 const select=item=>{for(const b of list.children)b.classList.toggle('active',b.dataset.id===item.id);
  detail.innerHTML=`<strong>${SKILLS[item.id].name} · ${skillKeys(item.id)}</strong><p>${item.how}</p><p><b>언제</b> ${item.use}</p>`;preview.show(item.id);};
 for(const item of SKILL_GUIDE){if(!SKILLS[item.id])continue;const b=document.createElement('button');b.className='skill';b.dataset.id=item.id;
  b.innerHTML=`<b>${SKILLS[item.id].name}</b><kbd>${skillKeys(item.id)}</kbd><span class="stars">${stars(item.stars)}</span>`;b.onclick=()=>select(item);list.append(b);}
 open.onclick=()=>{panel.classList.remove('hidden');$('motion-preview').classList.add('guide-mode');select(SKILL_GUIDE[0]);};
 preview.onClose.push(()=>{panel.classList.add('hidden');$('motion-preview').classList.remove('guide-mode');});
}
