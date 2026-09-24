import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_POOL,TIERS,TIER_ORDER,cardProfile,cardOverall,cardTier} from '../src/card-data.js';
import {PACKS,PACK_ORDER,drawTier,openPack,withPicks,poolByTier,LIBRARY_LIMIT} from '../src/card-packs.js';
import {cleanLibrary,defaultSquads} from '../src/squads.js';
import {overallRating} from '../src/player-ratings.js';
import {loadWallet,saveWallet,addCoins,spendCoins,matchReward,STARTING_COINS,WALLET_KEY} from '../src/wallet.js';
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};
const fakeStorage=()=>{const map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
test('every card survives profile cleaning and keeps its authored identity',()=>{
 for(const card of CARD_POOL){const profile=cardProfile(card,'test-'+card.name);
  assert.equal(profile.name,card.name);assert.equal(profile.role,card.role);assert.equal(profile.number,card.number);
  assert.ok(profile.height>=1.55&&profile.height<=2.1,`${card.name} height ${profile.height}`);
  for(const key of ['pace','shooting','passing','control','tackling','strength','reflexes','reach'])assert.equal(typeof profile[key],'number');}
});
test('authored ratings land inside the tier band the card is meant to sit in',()=>{
 for(const card of CARD_POOL){const overall=cardOverall(card),tier=TIERS[cardTier(card)];
  assert.ok(overall>=tier.min&&overall<=tier.max,`${card.name} ${overall} outside ${tier.name}`);}
});
test('the pool covers every position and every tier with enough goalkeepers for a lineup',()=>{
 const groups=poolByTier();
 for(const id of TIER_ORDER)assert.ok(groups[id].length>0,`${id} tier is empty`);
 for(const role of ['GK','DEF','MID','FWD'])assert.ok(CARD_POOL.filter(c=>c.role===role).length>=3,`${role} is too thin`);
 assert.equal(CARD_POOL.length,new Set(CARD_POOL.map(c=>c.name)).size);
});
test('pack odds add up and every pack can only draw tiers it advertises',()=>{
 for(const id of PACK_ORDER){const odds=PACKS[id].odds,sum=Object.values(odds).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(sum-1)<1e-9,`${id} odds sum ${sum}`);
  const random=seeded(7);
  for(let i=0;i<2000;i++)assert.ok(odds[drawTier(odds,random)]>0,`${id} drew a tier with zero odds`);}
});
test('drawn tiers follow the published probability table within 3 percentage points',()=>{
 for(const id of PACK_ORDER){const odds=PACKS[id].odds,random=seeded(id.length*97+13),counts={bronze:0,silver:0,gold:0,special:0},runs=20000;
  for(let i=0;i<runs;i++)counts[drawTier(odds,random)]++;
  for(const tier of TIER_ORDER){const seen=counts[tier]/runs;
   assert.ok(Math.abs(seen-odds[tier])<=.03,`${id} ${tier} drew ${(seen*100).toFixed(1)}% against ${odds[tier]*100}%`);}}
});
test('opening a pack returns the advertised number of playable cards',()=>{
 const random=seeded(2026);
 for(const id of PACK_ORDER){const picks=openPack(id,random);
  assert.equal(picks.length,PACKS[id].cards);
  for(const pick of picks){assert.ok(CARD_POOL.includes(pick.card));assert.equal(pick.tier,cardTier(pick.card));assert.equal(pick.walkout,TIERS[pick.tier].walkout);}}
});
test('unknown pack ids are rejected instead of drawing a card',()=>{assert.throws(()=>openPack('platinum'),/알 수 없는 팩/);});
test('picked cards join the library as new players without touching saved lineups',()=>{
 const library=defaultSquads(),before=library.players.length,picks=openPack('gold',seeded(5));
 let n=0;const next=withPicks(library,picks,()=>`pack-uid-${n++}`);
 assert.equal(next.players.length,before+picks.length);
 assert.deepEqual(next.lineups,library.lineups);
 assert.equal(library.players.length,before,'the original library must not be mutated');
 assert.equal(new Set(next.players.map(p=>p.uid)).size,next.players.length);
 for(const [i,pick] of picks.entries())assert.equal(next.players[before+i].name,pick.card.name);
 assert.doesNotThrow(()=>cleanLibrary(next));
});
test('duplicate pulls of the same player become separate cards',()=>{
 const library=defaultSquads(),card=CARD_POOL[0],picks=[{card},{card}];
 let n=0;const next=withPicks(library,picks,()=>`dup-${n++}`);
 const added=next.players.slice(-2);
 assert.equal(added[0].name,added[1].name);
 assert.notEqual(added[0].uid,added[1].uid);
});
test('a full library refuses new cards instead of dropping saved players',()=>{
 const library=defaultSquads();
 library.players=Array.from({length:LIBRARY_LIMIT},(_,i)=>({...library.players[0],uid:`full-${i}`}));
 assert.throws(()=>withPicks(library,openPack('bronze',seeded(1))),/최대 200명/);
});
test('card ratings stay consistent between the pool and the saved profile',()=>{
 for(const card of CARD_POOL)assert.equal(overallRating(cardProfile(card,'x')),cardOverall(card));
});
test('a new wallet starts funded and survives a storage round trip',()=>{
 const storage=fakeStorage();
 assert.equal(loadWallet(storage).coins,STARTING_COINS);
 assert.equal(JSON.parse(storage.getItem(WALLET_KEY)).coins,STARTING_COINS);
 saveWallet({coins:640},storage);
 assert.equal(loadWallet(storage).coins,640);
});
test('damaged or hostile wallet values fall back to a sane balance',()=>{
 const storage=fakeStorage();
 storage.setItem(WALLET_KEY,'{oops');
 assert.equal(loadWallet(storage).coins,STARTING_COINS);
 storage.setItem(WALLET_KEY,JSON.stringify({coins:-999}));
 assert.equal(loadWallet(storage).coins,0);
 storage.setItem(WALLET_KEY,JSON.stringify({coins:'무한'}));
 assert.equal(loadWallet(storage).coins,STARTING_COINS);
});
test('coins are added and spent exactly, and a short balance is left untouched',()=>{
 const storage=fakeStorage();
 saveWallet({coins:300},storage);
 assert.equal(addCoins(150,storage).coins,450);
 assert.equal(spendCoins(PACKS.bronze.price,storage).coins,350);
 assert.equal(spendCoins(9999,storage),null);
 assert.equal(loadWallet(storage).coins,350);
});
test('match rewards follow the result for either side of the tie',()=>{
 assert.equal(matchReward([3,1],0),150);
 assert.equal(matchReward([3,1],1),20);
 assert.equal(matchReward([2,2],0),50);
});
