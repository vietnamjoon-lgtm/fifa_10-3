import {CARD_POOL,TIERS,TIER_ORDER,cardOverall,cardTier,cardProfile} from './card-data.js';
export const PACKS={
 bronze:{id:'bronze',name:'브론즈 팩',price:40,cards:1,note:'브론즈 위주 1장',odds:{bronze:.65,silver:.30,gold:.05,special:0}},
 silver:{id:'silver',name:'실버 팩',price:90,cards:1,note:'실버·골드 중심 1장',odds:{bronze:.20,silver:.55,gold:.23,special:.02}},
 gold:{id:'gold',name:'골드 팩',price:180,cards:1,note:'골드 중심, 스페셜 10%',odds:{bronze:0,silver:.30,gold:.60,special:.10}}
};
export const PACK_ORDER=['bronze','silver','gold'];
export const LIBRARY_LIMIT=200;
let grouped=null;
export function poolByTier(){
 if(!grouped){grouped={bronze:[],silver:[],gold:[],special:[]};for(const card of CARD_POOL)grouped[cardTier(card)].push(card);}
 return grouped;
}
export function drawTier(odds,random=Math.random){
 const roll=random();let sum=0;
 for(const id of TIER_ORDER){sum+=odds[id]||0;if(roll<sum)return id;}
 return TIER_ORDER.findLast(id=>(odds[id]||0)>0)||'bronze';
}
export function drawCard(odds,random=Math.random){
 const groups=poolByTier();let tier=drawTier(odds,random);
 if(!groups[tier].length)tier=TIER_ORDER.find(id=>groups[id].length);
 const list=groups[tier],card=list[Math.min(list.length-1,Math.floor(random()*list.length))];
 return {card,tier,overall:cardOverall(card),walkout:TIERS[tier].walkout};
}
export function openPack(packId,random=Math.random){
 const pack=PACKS[packId];
 if(!pack)throw Error('알 수 없는 팩입니다.');
 return Array.from({length:pack.cards},()=>drawCard(pack.odds,random));
}
// 뽑은 카드를 선수 라이브러리에 새 uid로 추가한 사본을 돌려줍니다. 기존 선수와 팀 구성은 건드리지 않습니다.
export function withPicks(library,picks,makeUid=()=>crypto.randomUUID()){
 if(library.players.length+picks.length>LIBRARY_LIMIT)throw Error(`선수는 최대 ${LIBRARY_LIMIT}명까지 보관할 수 있습니다. 선수 편집에서 정리한 뒤 다시 열어 주세요.`);
 const players=picks.map(pick=>cardProfile(pick.card,makeUid()));
 return {...library,players:[...library.players,...players],lineups:library.lineups.map(list=>[...list])};
}
