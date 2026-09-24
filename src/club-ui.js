import {viewPlayers,releasePlayers,releaseValue,clubValue,cardFor} from './club.js';
import {TIERS,flagUrl,leagueOf} from './card-data.js';
import {loadWallet,addCoins} from './wallet.js';
import {LIBRARY_LIMIT} from './card-packs.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const coins=n=>n.toLocaleString('ko-KR');
// 구단 화면: 보유 선수를 훑어보고, 쓰지 않는 선수를 골라 방출해 코인으로 바꿉니다.
export class ClubUI{
 constructor(editor,onWalletChange=()=>{}){
  this.editor=editor;this.onWalletChange=onWalletChange;
  this.picked=new Set();
  this.filters={search:'',role:'ALL',sort:'overall'};
  $('club-open').onclick=()=>this.open();
  $('club-close').onclick=()=>this.close();
  $('club-search').oninput=e=>{this.filters.search=e.target.value;this.render();};
  $('club-role').onchange=e=>{this.filters.role=e.target.value;this.render();};
  $('club-sort').onchange=e=>{this.filters.sort=e.target.value;this.render();};
  $('club-release').onclick=()=>this.release();
  $('club-clear').onclick=()=>{this.picked.clear();this.render();};
  addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('club-panel').classList.contains('hidden'))this.close();});
 }
 open(){$('club-panel').classList.remove('hidden');this.picked.clear();this.render();}
 close(){$('club-panel').classList.add('hidden');}
 status(text){$('club-status').textContent=text;}
 render(){
  const library=this.editor.data,rows=viewPlayers(library,this.filters);
  // 걸러진 목록에서 사라진 선수는 선택에서도 빼 줍니다.
  const visible=new Set(rows.map(row=>row.player.uid));
  for(const uid of [...this.picked])if(!visible.has(uid))this.picked.delete(uid);
  $('club-count').textContent=`${library.players.length} / ${LIBRARY_LIMIT} 명`;
  $('club-value').textContent=coins(clubValue(library));
  $('club-coins').textContent=coins(loadWallet().coins);
  const list=$('club-list');list.replaceChildren();
  if(!rows.length)list.append(el('p','조건에 맞는 선수가 없습니다.','club-empty'));
  for(const row of rows)list.append(this.rowElement(row));
  this.renderPicked();
 }
 rowElement(row){
  const tier=TIERS[row.tier],card=cardFor(row.player);
  const item=el('button',undefined,`club-card tier-${row.tier}`);
  item.style.setProperty('--tier',tier.color);
  item.dataset.uid=row.player.uid;
  item.classList.toggle('picked',this.picked.has(row.player.uid));
  item.classList.toggle('playing',row.playing);
  const head=el('div',undefined,'club-card-head');
  head.append(el('b',String(row.overall),'club-ovr'),el('span',row.player.role,'club-role'));
  if(row.playing)head.append(el('small','출전 중','club-playing'));
  const name=el('strong',row.player.name,'club-name');
  const meta=el('div',undefined,'club-meta');
  if(card){
   const flag=flagUrl(card.nation);
   if(flag){const image=el('img',undefined,'club-flag');image.alt='';image.src=flag;meta.append(image);}
   meta.append(el('span',`${card.club} · ${leagueOf(card.club)}`));
  }else meta.append(el('span','기본 선수'));
  const price=el('div',undefined,'club-price');
  price.append(el('span','방출가'),el('b',coins(row.value)));
  item.append(head,name,meta,price);
  item.onclick=()=>this.toggle(row);
  return item;
 }
 toggle(row){
  if(row.playing){this.status(`${row.player.name} 선수는 팀에 배치돼 있어 방출할 수 없습니다. 선수 · 팀 편집에서 먼저 교체해 주세요.`);return;}
  const uid=row.player.uid;
  if(this.picked.has(uid))this.picked.delete(uid);else this.picked.add(uid);
  const node=$('club-list').querySelector(`[data-uid="${uid}"]`);
  if(node)node.classList.toggle('picked',this.picked.has(uid));
  this.renderPicked();
 }
 renderPicked(){
  const library=this.editor.data;
  const chosen=library.players.filter(player=>this.picked.has(player.uid));
  const refund=chosen.reduce((sum,player)=>sum+releaseValue(player),0);
  $('club-picked').textContent=chosen.length?`${chosen.length}명 선택 · ${coins(refund)} 코인`:'선택한 선수 없음';
  $('club-release').disabled=!chosen.length;
  $('club-clear').disabled=!chosen.length;
 }
 release(){
  const chosen=[...this.picked];
  if(!chosen.length)return;
  const names=this.editor.data.players.filter(p=>this.picked.has(p.uid)).map(p=>p.name);
  if(!confirm(`${names.length}명을 방출합니다. 되돌릴 수 없습니다.\n\n${names.join(', ')}`))return;
  try{
   const {library,refund}=releasePlayers(this.editor.data,chosen);
   this.editor.applyLibrary(library);
   addCoins(refund);
   this.onWalletChange();
   this.picked.clear();
   this.render();
   this.status(`${names.length}명을 방출하고 ${coins(refund)} 코인을 받았습니다.`);
  }catch(error){this.status(error.message);}
 }
}
