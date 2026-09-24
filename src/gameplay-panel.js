import {GAMEPLAY_FIELDS,cleanGameplay,gameplayDefaults} from './gameplay-settings.js';
export class GameplayPanel{
 constructor(settings,save){
  this.settings=settings;this.save=save;
  const panel=this.panel=document.createElement('div');panel.id='gameplay-panel';panel.className='overlay hidden';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','gameplay-title');
  panel.innerHTML=`<section class="dialog gameplay-dialog"><span class="eyebrow">PLAY YOUR WAY</span><h2 id="gameplay-title">플레이 감각, 세밀하게.</h2><p>100은 권장 균형입니다. 다음 경기부터 적용됩니다.<br>친구 대전에서는 방장의 설정을 두 팀에 똑같이 적용합니다.</p><div class="gameplay-fields">${GAMEPLAY_FIELDS.map(f=>`<label for="gameplay-${f.key}"><span>${f.label}<output id="gameplay-value-${f.key}">100</output></span><small>${f.help}</small><input id="gameplay-${f.key}" type="range" min="80" max="120" step="1"><span class="range-ends"><small>80 · 낮게</small><small>120 · 높게</small></span></label>`).join('')}</div><label class="referee-setting">파울 엄격도<select id="gameplay-referee"><option value="lenient">관대하게 · 몸 경합 허용 폭 넓게</option><option value="standard">표준 · 추천</option><option value="strict">엄격하게 · 무리한 경합 일찍 판정</option></select></label><p class="gameplay-note">공을 먼저 건드려도 위험한 태클은 파울입니다. 패스 정확도 100 설정은 매치 센터에서 따로 유지됩니다.</p><div class="gameplay-actions"><button id="gameplay-reset" class="text-button">권장값으로 되돌리기</button><button id="gameplay-close" class="secondary">취소</button><button id="gameplay-apply" class="primary">설정 저장 ✓</button></div><p id="gameplay-status" role="status"></p></section>`;
  document.body.append(panel);const open=document.createElement('button');open.id='gameplay-open';open.className='secondary';open.textContent='플레이 감각 · 파울 세부 설정 ↗';document.getElementById('setup-start').before(open);open.onclick=()=>this.open();
  for(const {key} of GAMEPLAY_FIELDS)panel.querySelector('#gameplay-'+key).oninput=e=>{this.draft[key]=Number(e.target.value);panel.querySelector('#gameplay-value-'+key).textContent=this.draft[key];};
  panel.querySelector('#gameplay-referee').onchange=e=>this.draft.referee=e.target.value;
  panel.querySelector('#gameplay-reset').onclick=()=>{this.draft={...gameplayDefaults};this.render();};
  panel.querySelector('#gameplay-close').onclick=()=>this.close();panel.querySelector('#gameplay-apply').onclick=()=>{settings.gameplay=cleanGameplay(this.draft);save();this.close();};
 }
 open(){this.draft=cleanGameplay(this.settings.gameplay);this.render();this.panel.classList.remove('hidden');document.getElementById('setup').inert=true;this.panel.querySelector('#gameplay-acceleration').focus();}
 render(){for(const {key} of GAMEPLAY_FIELDS){this.panel.querySelector('#gameplay-'+key).value=this.draft[key];this.panel.querySelector('#gameplay-value-'+key).textContent=this.draft[key];}this.panel.querySelector('#gameplay-referee').value=this.draft.referee;}
 close(){this.panel.classList.add('hidden');document.getElementById('setup').inert=false;document.getElementById('gameplay-open').focus();}
}
