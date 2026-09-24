import {overallRating} from './player-ratings.js';
import {tierOf,CARD_POOL} from './card-data.js';
// 구단 관리: 보유 선수를 살펴보고, 쓰지 않는 선수를 방출해 코인으로 돌려받습니다.
// 방출가는 팩 가격보다 낮게 잡아, 팩을 열고 바로 되파는 것이 이득이 되지 않게 합니다.
const BANDS={
 bronze:{floor:55,base:12,step:1},
 silver:{floor:65,base:35,step:2},
 gold:{floor:75,base:85,step:5},
 special:{floor:85,base:260,step:12}
};
export function releaseValue(profile){
 const overall=overallRating(profile),band=BANDS[tierOf(overall)];
 return Math.max(5,Math.round(band.base+Math.max(0,overall-band.floor)*band.step));
}
const byName=new Map(CARD_POOL.map(card=>[card.name,card]));
// 카드로 뽑은 선수는 소속팀·국가를 카드 목록에서 찾아 보여 줍니다. 기본 선수는 정보가 없습니다.
export const cardFor=profile=>byName.get(profile.name)||null;
export const inLineup=(library,uid)=>library.lineups.some(list=>list.includes(uid));
export function releasable(library){
 return library.players.filter(player=>!inLineup(library,player.uid));
}
// 고른 선수들을 빼고 환급액을 함께 돌려줍니다. 원본 라이브러리는 건드리지 않습니다.
export function releasePlayers(library,uids){
 const wanted=new Set(uids);
 if(!wanted.size)throw Error('방출할 선수를 먼저 고르세요.');
 const keep=[],removed=[];
 for(const player of library.players)(wanted.has(player.uid)?removed:keep).push(player);
 if(removed.length!==wanted.size)throw Error('구단에 없는 선수가 섞여 있습니다.');
 // 배치된 선수를 막아 두면 두 팀의 11명은 언제나 구단에 남습니다.
 const playing=removed.find(player=>inLineup(library,player.uid));
 if(playing)throw Error(`${playing.name} 선수는 팀에 배치돼 있습니다. 먼저 다른 선수로 교체해 주세요.`);
 return {
  library:{...library,players:keep,lineups:library.lineups.map(list=>[...list])},
  refund:removed.reduce((sum,player)=>sum+releaseValue(player),0),
  removed
 };
}
// 이름 검색과 포지션 거르기, 정렬을 한 번에 적용합니다.
export function viewPlayers(library,{search='',role='ALL',sort='overall'}={}){
 const text=search.trim().toLowerCase();
 const rows=library.players
  .filter(player=>role==='ALL'||player.role===role)
  .filter(player=>!text||player.name.toLowerCase().includes(text))
  .map(player=>({player,overall:overallRating(player),tier:tierOf(overallRating(player)),playing:inLineup(library,player.uid),value:releaseValue(player)}));
 const order={
  overall:(a,b)=>b.overall-a.overall||a.player.name.localeCompare(b.player.name,'ko'),
  name:(a,b)=>a.player.name.localeCompare(b.player.name,'ko'),
  value:(a,b)=>b.value-a.value||b.overall-a.overall
 };
 return rows.sort(order[sort]||order.overall);
}
export const clubValue=library=>library.players.reduce((sum,player)=>sum+releaseValue(player),0);
