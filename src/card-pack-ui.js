import {PACKS,PACK_ORDER,openPack,withPicks} from './card-packs.js';
import {TIERS} from './card-data.js';
import {loadWallet,spendCoins,addCoins} from './wallet.js';
import {CardWalkout} from './card-walkout.js';
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const STAT_ROWS=[['pac','속력'],['sho','슛'],['pas','패스'],['dri','드리블'],['def','수비'],['phy','피지컬']];
const GK_ROWS=[['ref','반응'],['reach','도달'],['dri','안정'],['pas','배급'],['phy','피지컬'],['pac','반사 이동']];
export class CardPackUI{
 constructor(editor){
  this.editor=editor;this.busy=false;this.skipped=false;this.walkout=null;
  $('cards-open').onclick=()=>this.open();
  $('cards-close').onclick=()=>this.close();
  $('cards-skip').onclick=()=>{this.skipped=true;};
  $('cards-again').onclick=()=>this.showShop();
  $('cards-to-editor').onclick=()=>{this.close();this.editor.open();};
  addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('cards-panel').classList.contains('hidden'))this.close();});
 }
 open(){$('cards-panel').classList.remove('hidden');this.showShop();}
 close(){this.skipped=true;this.walkout?.stop();$('cards-panel').classList.add('hidden');}
 status(text){$('cards-status').textContent=text;}
 coins(){const wallet=loadWallet();$('cards-coins').textContent=wallet.coins.toLocaleString('ko-KR');return wallet.coins;}
 showShop(){
  $('cards-stage').classList.add('hidden');$('cards-results').classList.add('hidden');$('cards-shop').classList.remove('hidden');
  this.walkout?.stop();
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
  if(!this.walkout)this.walkout=new CardWalkout($('cards-walkout'));
  for(const pick of picks)await this.revealOne(pick);
  this.walkout.stop();
  $('cards-walkout').classList.remove('live');
  $('cards-stage').classList.remove('walkout');
  $('cards-stage').classList.add('hidden');
  this.showResults(picks);
 }
 async revealOne(pick){
  const flash=$('cards-flash'),stage=$('cards-reveal'),tier=TIERS[pick.tier];
  stage.replaceChildren();flash.replaceChildren();
  $('cards-walkout').classList.remove('live');
  flash.classList.remove('hidden');
  for(const [label,value] of [['포지션',pick.card.role],['국가',pick.card.nation],['소속팀',pick.card.club]]){
   flash.replaceChildren(el('small',label),el('strong',value));
   flash.classList.remove('flash-in');void flash.offsetWidth;flash.classList.add('flash-in');
   if(!await this.wait(340))break;
  }
  flash.classList.add('hidden');
  $('cards-stage').classList.toggle('walkout',!!pick.walkout);
  if(pick.walkout){$('cards-walkout').classList.add('live');this.walkout.play(pick.profile,tier.color);}
  stage.append(this.cardElement(pick));
  await this.countUp(stage.querySelector('.card-ovr'),pick.overall);
  await this.wait(pick.walkout?3200:900);
  this.walkout.stop();
 }
 cardElement(pick,showOverall=false){
  const tier=TIERS[pick.tier],card=el('div',undefined,`player-card tier-${pick.tier}`);
  card.style.setProperty('--tier',tier.color);
  const head=el('div',undefined,'card-head');
  head.append(el('b',showOverall?String(pick.overall):'0','card-ovr'),el('span',pick.card.role,'card-role'),el('small',tier.name,'card-tier'));
  const body=el('div',undefined,'card-body');
  body.append(el('strong',pick.card.name,'card-name'),el('small',`${pick.card.club} · ${pick.card.nation}`,'card-club'));
  const stats=el('div',undefined,'card-stats');
  for(const [key,label] of (pick.card.role==='GK'?GK_ROWS:STAT_ROWS)){
   const cell=el('div');cell.append(el('b',String(pick.card[key]??'-')),el('span',label));stats.append(cell);
  }
  card.append(head,body,stats);
  return card;
 }
 async countUp(node,target){
  const steps=Math.max(6,Math.min(26,target-40));
  for(let i=1;i<=steps;i++){
   node.textContent=String(Math.round(40+(target-40)*(i/steps)));
   if(!await this.wait(26))break;
  }
  node.textContent=String(target);node.classList.add('locked');
 }
 wait(ms){return new Promise(resolve=>{if(this.skipped)return resolve(false);setTimeout(()=>resolve(!this.skipped),this.skipped?0:ms);});}
 showResults(picks){
  const results=$('cards-results'),list=$('cards-result-list');
  list.replaceChildren();
  for(const pick of picks)list.append(this.cardElement(pick,true));
  results.classList.remove('hidden');
  const best=picks.reduce((a,b)=>b.overall>a.overall?b:a);
  this.status(`${picks.length}장을 선수 라이브러리에 담았습니다. 최고 카드는 ${best.card.name} · ${best.overall}입니다.`);
  this.coins();
 }
}
