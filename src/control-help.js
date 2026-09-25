import {MOVES} from './skill-moves.js';

export function updateControlLabels(settings){
 const legacy=settings.controls==='legacy',tactical=settings.defence==='tactical';
 const rows=legacy?[
  ['이동','WASD / 방향키'],['질주','Shift'],['패스 / 슛','J / K'],['스루 / 로빙 패스','L / I'],['태클 / 선수 변경','Space / Q'],['감아차기 / 칩슛','E+K / X+K'],['카메라','C / F2']
 ]:[
  ['이동 / 질주','방향키 / E'],['패스 / 스루 / 크로스','S / W / A'],['슛 · 누르고 놓기','D'],['감아차기 / 칩슛','Z+D / Q+D'],['낮은 슛 · 발 접촉 전','D 놓고 D'],['로빙 스루 / 침투 스루','Q+W / Z+W'],['패스 후 침투 / 강한 패스','Q+S / Z+S'],['얼리 크로스 / 바운싱 로빙','Q+A / Z+A'],['땅볼 / 낮은 크로스','A 두 번 / 세 번'],['슛·패스 페이크','D 또는 A 후 S'],['동작 취소 / 공 보호','E+C / C'],['짧은 터치 / 녹온','Space / Ctrl+방향'],['개인기 · FC 온라인 입력','Shift + 방향키 (아래 표)'],['노 터치 페인팅 · 작게 / 크게','Q / E+Q'],['개인기 번호 선택','Shift + 1~7'],['방향 개인기','Shift + 방향키'],['프리킥 궤적 선택','1~7'],['침투 / 지원 요청','Q / Z'],['수비 · 선수 변경',tactical?'Q':'S'],['수비 · 자동 수비 자세 / 접근','D 유지'],['수비 · 압박 / 슬라이딩',tactical?'S 유지 / A':'D 유지 / A'],['수비 · 슬라이딩 / 견제','A / C'],['수비 · 협력 압박',tactical?'Z 유지':'Q 유지 · 두 번+유지'],['골키퍼 돌진','W 유지'],['키퍼 소유 · 패스 / 킥 / 놓기','S / A·D / W'],['세트피스 · 패스 / 크로스 / 슛','S / A / D'],['카메라 / 도움말 / 일시정지','F2 / H / Esc']
 ];
 document.querySelector('.help-grid').innerHTML=rows.map(([label,key])=>`<span>${label}</span><kbd>${key}</kbd>`).join('');
 // Skill moves as in FC Online's guide: arrows are for attacking to the right (→ forward, ↑ the player's left).
 const grid=document.querySelector('.help-grid');let skills=document.querySelector('.help-skills');
 if(!legacy&&grid){if(!skills){skills=document.createElement('div');skills.className='help-grid help-skills';grid.after(skills);}
  const seen=new Set(),list=MOVES.filter(m=>{const key=m.id+(m.labels?m.side:'');if(seen.has(key))return false;seen.add(key);return true;});
  skills.innerHTML='<span><b>개인기 (오른쪽으로 공격할 때 기준 · 반대쪽은 방향 반대)</b></span><kbd></kbd>'+list.map(m=>`<span>${'★'.repeat(m.stars)} ${m.sided&&!m.labels?m.name+' (좌우)':m.label}</span><kbd>${moveKeys(m)}</kbd>`).join('');}
 else if(skills)skills.remove();
 document.querySelector('.help-dialog p').innerHTML=legacy?'기존 조작 방식입니다. 매치 센터에서 온라인 키 배치로 바꿀 수 있습니다.':'공격·수비 상황에 따라 같은 키의 기능이 바뀝니다. 기본 수비/전략 수비는 매치 센터에서 선택하세요.<br>패드: LS 이동 · RT 질주 · A 패스 · B 슛 · X 크로스 · Y 스루 · LB 조합 · RB 감아차기.<br>개인기 1~7: 엘라스티코 · 드래그 백 · 볼 롤 · 넛메그 · 힐 플릭 · 드래그 투 힐 · 스텝 오버.<br>세리머니는 선수 편집에서 고르고, 동작 자세히 보기에서 확인할 수 있습니다.';
 const hints=legacy?[['WASD','이동'],['SHIFT','질주'],['J','패스'],['K','슛'],['L','스루'],['SPACE','태클'],['Q','변경']]:[['↑↓←→','이동'],['E','질주'],['S','패스'],['D','슛·태클'],['A','크로스·슬라이딩'],['W','스루'],['H','조작표']];
 document.querySelector('.bottom-controls').innerHTML=hints.map(([key,label])=>`<span><kbd>${key}</kbd> ${label}</span>`).join('');
 document.querySelector('#camera-button kbd').textContent=legacy?'C':'F2';
}

const ARROW={F:'→',B:'←',L:'↑',R:'↓',FL:'↗',FR:'↘',BL:'↖',BR:'↙'};
/** A move's keyboard input written like the guide's keyboard column. */
export function moveKeys(m){const k=m.keys,a=d=>d.startsWith('hold:')?ARROW[d.slice(5)]+'(길게)':ARROW[d];
 const mods=(k.mods||'').split('').filter(Boolean).map(x=>({q:'Q',c:'C',z:'Z',e:'E'})[x]+' 누른 채 ').join('');
 if(k.special==='z-tap')return mods+'Z 탭';if(k.special==='z-hold')return mods+'Z 길게';if(k.special==='backquote')return '` 탭';
 if(k.special==='q-tap')return (k.mods==='e'?'E 누른 채 ':'')+'Q 탭';if(k.special==='fake')return mods+'D 또는 A 후 S + '+(k.side==='B'?'←':'↑/↓');
 if(k.plain)return mods+ARROW[k.plain];
 const body=k.sweep?k.sweep.map(a).join(''):k.hold?a(k.hold)+' 길게':k.taps?'탭 '+k.taps.map(a).join(' '):k.holds?k.holds.map(a).join(' 길게, ')+' 길게':k.holdTap?a(k.holdTap[0])+' 길게 후 '+a(k.holdTap[1])+' 탭':'';
 return mods+'Shift + '+body;}
