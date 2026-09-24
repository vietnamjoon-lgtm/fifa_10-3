export const WALLET_KEY='touchline-wallet-v1';
export const STARTING_COINS=1000;
export const MAX_COINS=9999999;
export const MATCH_REWARDS={win:150,draw:50,loss:20};
const memory={value:null};
export function cleanWallet(raw){
 const coins=typeof raw?.coins==='number'&&Number.isFinite(raw.coins)?Math.min(MAX_COINS,Math.max(0,Math.round(raw.coins))):STARTING_COINS;
 return {version:1,coins};
}
export function loadWallet(storage=globalThis.localStorage){
 let stored;
 // 저장소를 아예 쓸 수 없으면(시크릿 모드 등) 이번 세션 동안만 기억합니다.
 try{stored=storage.getItem(WALLET_KEY);}catch{return cleanWallet(memory.value||{});}
 if(stored===null)return saveWallet({coins:STARTING_COINS},storage);
 // 저장값이 깨졌으면 기본 지급으로 되돌립니다.
 try{return cleanWallet(JSON.parse(stored));}catch{return saveWallet({coins:STARTING_COINS},storage);}
}
export function saveWallet(wallet,storage=globalThis.localStorage){
 const clean=cleanWallet(wallet);memory.value=clean;
 try{storage.setItem(WALLET_KEY,JSON.stringify(clean));}catch{}
 return clean;
}
export function addCoins(amount,storage=globalThis.localStorage){
 const wallet=loadWallet(storage);
 return saveWallet({coins:wallet.coins+Math.max(0,Math.round(amount||0))},storage);
}
// 잔액이 모자라면 차감하지 않고 null을 돌려줍니다.
export function spendCoins(amount,storage=globalThis.localStorage){
 const price=Math.max(0,Math.round(amount||0)),wallet=loadWallet(storage);
 if(wallet.coins<price)return null;
 return saveWallet({coins:wallet.coins-price},storage);
}
export function matchReward(score,userTeam){
 const mine=score[userTeam],theirs=score[1-userTeam];
 return mine>theirs?MATCH_REWARDS.win:mine===theirs?MATCH_REWARDS.draw:MATCH_REWARDS.loss;
}
