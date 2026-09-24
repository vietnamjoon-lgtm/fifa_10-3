import {PACKS,PACK_ORDER,openPack,withPicks} from './card-packs.js';
import {TIERS,leagueOf,flagUrl} from './card-data.js';
import {loadWallet,spendCoins,addCoins} from './wallet.js';
import {CardReveal} from './card-reveal.js';
import {CardPortrait} from './card-portrait.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const STAT_ROWS=[['pac','PAC'],['sho','SHO'],['pas','PAS'],['dri','DRI'],['def','DEF'],['phy','PHY']];
const GK_ROWS=[['ref','DIV'],['reach','HAN'],['pas','KIC'],['dri','REF'],['pac','SPD'],['phy','POS']];
export class CardPackUI{
 constructor(editor,audio,onWalletChange=()=>{}){
  this.editor=editor;this.audio=audio;this.onWalletChange=onWalletChange;this.busy=false;this.skipped=false;this.cinema=null;
  $('cards-open').onclick=()=>this.open();
  $('cards-close').onclick=()=>this.close();
  $('cards-skip').onclick=()=>{this.skipped=true;this.cinema?.finish();};
  $('cards-again').onclick=()=>this.showShop();
  $('cards-to-editor').onclick=()=>{this.close();this.editor.open();};
  addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('cards-panel').classList.contains('hidden'))this.close();});
 }
 open(){$('cards-panel').classList.remove('hidden');this.showShop();}
 close(){this.skipped=true;this.cinema?.stop();$('cards-white').style.opacity='0';$('cards-panel').classList.add('hidden');}
 status(text){$('cards-status').textContent=text;}
 coins(){const wallet=loadWallet();$('cards-coins').textContent=wallet.coins.toLocaleString('ko-KR');this.onWalletChange();return wallet.coins;}
 showShop(){
  $('cards-stage').classList.add('hidden');$('cards-results').classList.add('hidden');$('cards-shop').classList.remove('hidden');
  this.cinema?.stop();
  const balance=this.coins(),shop=$('cards-shop');shop.replaceChildren();
  for(const id of PACK_ORDER){
   const pack=PACKS[id],card=el('button',undefined,'pack-tile');card.dataset.pack=id;card.disabled=balance<pack.price;
   card.append(el('span',pack.name,'pack-name'),el('small',pack.note,'pack-note'),el('b',`${pack.price.toLocaleString('ko-KR')} 코인`,'pack-price'));
   const odds=el('small',undefined,'pack-odds');
   odds.textContent=Object.entries(pack.odds).filter(([,v])=>v>0).map(([tier,v])=>`${TIERS[tier].name} ${Math.round(v*100)}%`).join(' · ');
   card.append(odds);
   card.onclick=()=>this.buy(id);
   shop.append(card);
  }
  this.status(balance<PACKS.bronze.price?'코인이 부족합니다. 킥오프에서 경기를 마치면 코인을 받습니다.':'팩을 골라 열어 보세요. 뽑은 선수는 바로 선수 라이브러리에 들어갑니다.');
 }
 async buy(packId){
  if(this.busy)return;
  const pack=PACKS[packId];
  if(!spendCoins(pack.price)){this.status('코인이 부족합니다.');return;}
  let picks,library;
  try{picks=openPack(packId);library=withPicks(this.editor.data,picks);}
  catch(error){addCoins(pack.price);this.status(error.message);return;}
  try{this.editor.applyLibrary(library);}
  catch(error){addCoins(pack.price);this.status(error.message);return;}
  const profiles=library.players.slice(-picks.length);
  picks.forEach((pick,i)=>pick.profile=profiles[i]);
  this.busy=true;this.skipped=false;
  try{await this.reveal(picks);}finally{this.busy=false;}
 }
 async reveal(picks){
  $('cards-shop').classList.add('hidden');$('cards-results').classList.add('hidden');$('cards-stage').classList.remove('hidden');
  this.coins();
  this.cinema??=new CardReveal($('cards-walkout'));
  for(const pick of picks)await this.revealOne(pick);
  this.clearStage();
  this.showResults(picks);
 }
 clearStage(){
  this.cinema?.stop();
  $('cards-continue').classList.add('hidden');
  $('cards-headline').classList.add('hidden');
  $('cards-walkout').classList.remove('live');
  $('cards-white').style.opacity='0';
  $('cards-stage').classList.add('hidden');
  $('cards-reveal').replaceChildren();
 }
 // 카메라가 초록 복도 → 문 통과 → 회색 터널 → 스타디움으로 이어 달리는 동안
 // 화면 쪽 카드는 마지막 스타디움 구간에서 맞춰 띄웁니다.
 revealOne(pick){
  const stage=$('cards-reveal'),white=$('cards-white');
  stage.replaceChildren();
  $('cards-walkout').classList.add('live');
  return new Promise(settle=>{
   this.cinema.play(pick,{
    color:TIERS[pick.tier].color,
    onWhite:value=>{white.style.opacity=String(value);},
    onPhase:async id=>{
     if(id==='charge')this.sound('tunnel');
     else if(id==='tunnel')this.sound('cut');
     else if(id==='stadium'){
      this.sound('walkout');
      // 실제 개봉 화면처럼 등급과 이름을 큰 글씨로 한 줄 띄웁니다.
      const headline=$('cards-headline');
      headline.textContent=`${TIERS[pick.tier].name} · ${pick.card.name}`;
      headline.style.setProperty('--tier',TIERS[pick.tier].color);
      headline.classList.remove('hidden');
      stage.replaceChildren(...this.revealCluster(pick));
      await this.countUp([...stage.querySelectorAll('.card-ovr,.side-ovr')],pick.overall);
      // 자동으로 넘어가지 않고, 충분히 본 뒤 직접 확인을 눌러야 끝납니다.
      await this.waitForContinue();
      settle();
     }
    }
   });
  }).then(()=>{
   this.cinema.stop();
   $('cards-walkout').classList.remove('live');
   white.style.opacity='0';
  });
 }
 portraitInto(art,profile){
  this.portrait??=new CardPortrait();
  this.portrait.imageFor(profile).then(url=>{
   if(!url||!art.isConnected)return;
   const image=el('img',undefined,'card-face');image.alt='';image.src=url;
   art.prepend(image);
  }).catch(()=>{});
 }
 // 카드 양옆에 큰 종합 능력치와 세부 스탯 패널을 세워 실제 개봉 화면 구성을 따릅니다.
 revealCluster(pick){
  const rows=pick.card.role==='GK'?GK_ROWS:STAT_ROWS;
  const left=el('div',undefined,'reveal-side left'),right=el('div',undefined,'reveal-side right');
  left.append(el('b','0','side-ovr'),el('small',pick.card.role,'side-role'));
  right.append(el('b','0','side-ovr'));
  const grid=el('div',undefined,'side-stats');
  for(const [key,label] of rows){const cell=el('div');cell.append(el('b',String(pick.card[key]??'-')),el('span',label));grid.append(cell);}
  right.append(grid);
  return [left,this.cardElement(pick),right];
 }
 sound(kind){
  const audio=this.audio;
  if(!audio)return;
  try{
   if(kind==='cut')audio.tone(880,.06,.05,'square',1180);
   else if(kind==='tunnel')audio.noise(.5,.08,420);
   else if(kind==='walkout')audio.goal();
  }catch{}
 }
 cardElement(pick,showOverall=false){
  const tier=TIERS[pick.tier],card=el('div',undefined,`player-card tier-${pick.tier}`);
  card.style.setProperty('--tier',tier.color);
  const head=el('div',undefined,'card-head');
  head.append(el('b',showOverall?String(pick.overall):'0','card-ovr'),el('span',pick.card.role,'card-role'));
  // 선수 사진 자리에는 이 게임의 3D 선수 모델을 그려 넣습니다.
  const art=el('div',undefined,'card-art');
  art.append(el('span',tier.name,'card-tier'));
  if(pick.profile)this.portraitInto(art,pick.profile);
  const name=el('strong',pick.card.name,'card-name');
  const meta=el('div',undefined,'card-meta');
  const nation=el('span',undefined,'card-nation');
  const flag=flagUrl(pick.card.nation);
  if(flag){const image=el('img',undefined,'card-flag');image.alt='';image.src=flag;nation.append(image);}
  nation.append(el('i',pick.card.nation));
  meta.append(nation,el('span',leagueOf(pick.card.club)),el('span',pick.card.club));
  const stats=el('div',undefined,'card-stats');
  for(const [key,label] of (pick.card.role==='GK'?GK_ROWS:STAT_ROWS)){
   const cell=el('div');cell.append(el('span',label),el('b',String(pick.card[key]??'-')));stats.append(cell);
  }
  card.append(head,art,name,meta,stats);
  return card;
 }
 async countUp(nodes,target){
  const list=[].concat(nodes),steps=Math.max(6,Math.min(26,target-40));
  for(let i=1;i<=steps;i++){
   const value=String(Math.round(40+(target-40)*(i/steps)));
   for(const node of list)node.textContent=value;
   if(!await this.wait(26))break;
  }
  for(const node of list){node.textContent=String(target);node.classList.add('locked');}
 }
 wait(ms){return new Promise(resolve=>{if(this.skipped)return resolve(false);setTimeout(()=>resolve(!this.skipped),this.skipped?0:ms);});}
 // 확인을 누르거나 건너뛰기를 누를 때까지 스타디움 화면을 그대로 둡니다.
 waitForContinue(){
  const button=$('cards-continue');
  if(this.skipped)return Promise.resolve();
  button.classList.remove('hidden');
  return new Promise(resolve=>{
   const done=()=>{clearInterval(watch);button.classList.add('hidden');button.onclick=null;resolve();};
   button.onclick=done;
   const watch=setInterval(()=>{if(this.skipped)done();},120);
  });
 }
 showResults(picks){
  const results=$('cards-results'),list=$('cards-result-list');
  list.replaceChildren();
  for(const pick of picks)list.append(this.cardElement(pick,true));
  results.classList.remove('hidden');
  const best=picks.reduce((a,b)=>b.overall>a.overall?b:a);
  this.status(picks.length===1
   ?`${best.card.name} · ${best.overall}을(를) 선수 라이브러리에 담았습니다.`
   :`${picks.length}장을 선수 라이브러리에 담았습니다. 최고 카드는 ${best.card.name} · ${best.overall}입니다.`);
  this.coins();
 }
}
