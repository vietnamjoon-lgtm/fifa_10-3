import {TRAITS,TRAIT_MAX,WORK_RATES,WORK_RATE_LABELS,cleanTraits,cleanWorkRate} from './traits.js';
// Player editor section for traits (up to TRAIT_MAX, each with a one-line description) and attack/defence work rates.
const el=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
const KIND_LABEL={ai:'AI 판단',general:'플레이',keeper:'골키퍼'};
export class TraitPicker{
 constructor(parent,onChange=()=>{}){
  this.onChange=onChange;this.role='FWD';this.boxes=new Map();
  const root=el('div',undefined,'trait-picker');root.id='player-traits';
  const head=el('div',undefined,'trait-head');head.append(el('span','PLAY STYLE','eyebrow'),el('h3','특성 · 공격/수비 가담'));this.count=el('small',undefined,'trait-count');head.append(this.count);
  const rates=el('div',undefined,'work-rates');this.rates={};
  for(const [side,label] of [['attack','공격 가담'],['defence','수비 가담']]){const wrap=el('label',label),select=el('select');select.id='edit-work-'+side;select.setAttribute('aria-label',label);
   for(const v of WORK_RATES){const o=el('option',WORK_RATE_LABELS[v]);o.value=v;select.append(o);}select.onchange=()=>this.onChange();wrap.append(select);rates.append(wrap);this.rates[side]=select;}
  const note=el('p','특성은 능력치를 올리지 않고 판단하는 경향만 바꿉니다. AI 판단 특성은 직접 조작하는 동안에는 적용되지 않습니다.','trait-note');
  const list=el('div',undefined,'trait-list');list.setAttribute('role','group');list.setAttribute('aria-label','선수 특성');
  for(const [id,t] of Object.entries(TRAITS)){const row=el('label',undefined,'trait-option'),box=el('input');box.type='checkbox';box.value=id;box.id='trait-'+id;
   box.onchange=()=>{this.limit();this.onChange();};
   const text=el('span');text.append(el('b',t.name),el('em',KIND_LABEL[t.kind],'trait-kind'),el('small',t.text));row.append(box,text);list.append(row);this.boxes.set(id,{box,row});}
  root.append(head,rates,note,list);parent.after(root);this.root=root;
 }
 /** Shows a profile's traits and work rates. */
 set(p){this.role=p.role;const traits=cleanTraits(p.traits,p.role)||[],rate=cleanWorkRate(p.workRate,p.role);for(const [id,{box}] of this.boxes)box.checked=traits.includes(id);this.rates.attack.value=rate.attack;this.rates.defence.value=rate.defence;this.limit();}
 /** Keeper traits only for a keeper; no more than TRAIT_MAX ticked. */
 setRole(role){this.role=role;this.limit();}
 limit(){const picked=this.picked().length;
  for(const [id,{box,row}] of this.boxes){const keeperOnly=TRAITS[id].kind==='keeper',allowed=keeperOnly===(this.role==='GK')||!keeperOnly&&TRAITS[id].roles.includes(this.role);
   if(!allowed)box.checked=false;row.hidden=!allowed;box.disabled=!allowed||!box.checked&&picked>=TRAIT_MAX;}
  this.count.textContent=`${this.picked().length} / ${TRAIT_MAX}`;}
 picked(){return [...this.boxes].filter(([,{box}])=>box.checked).map(([id])=>id);}
 read(){return {traits:cleanTraits(this.picked(),this.role)||[],workRate:cleanWorkRate({attack:this.rates.attack.value,defence:this.rates.defence.value},this.role)};}
}
/** Trait names as small chips, for player cards. */
export function traitChips(p,className='trait-chips'){const box=el('div',undefined,className);for(const id of p?.traits||[]){const t=TRAITS[id];if(!t)continue;const chip=el('span',t.name,'trait-chip');chip.title=t.text;box.append(chip);}return box;}
