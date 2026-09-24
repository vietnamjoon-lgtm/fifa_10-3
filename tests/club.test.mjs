import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseValue,releasePlayers,viewPlayers,releasable,inLineup,clubValue,cardFor} from '../src/club.js';
import {defaultSquads,cleanLibrary} from '../src/squads.js';
import {CARD_POOL,cardProfile,cardOverall,cardTier} from '../src/card-data.js';
import {PACKS} from '../src/card-packs.js';
const withCards=(names)=>{
 const library=defaultSquads();
 const added=names.map((name,i)=>cardProfile(CARD_POOL.find(card=>card.name===name),`card-${i}`));
 return {...library,players:[...library.players,...added]};
};
test('a better player is worth more coins when released',()=>{
 const messi=cardProfile(CARD_POOL.find(c=>c.name==='리오넬 메시'),'a');
 const rookie=cardProfile(CARD_POOL.find(c=>c.name==='엘리엇 앤더슨'),'b');
 assert.ok(releaseValue(messi)>releaseValue(rookie)*5,'특급 선수가 훨씬 비싸야 합니다.');
 assert.ok(releaseValue(rookie)>=5);
});
test('release values stay below pack prices so reselling never prints coins',()=>{
 const groups={bronze:[],silver:[],gold:[],special:[]};
 for(const card of CARD_POOL)groups[cardTier(card)].push(releaseValue(cardProfile(card,'x'+card.name)));
 const mean=list=>list.reduce((a,b)=>a+b,0)/list.length;
 for(const [id,pack] of Object.entries(PACKS)){
  const expected=Object.entries(pack.odds).reduce((sum,[tier,odds])=>sum+odds*(groups[tier].length?mean(groups[tier]):0),0);
  assert.ok(expected<pack.price,`${id} 팩은 기대 환급 ${Math.round(expected)}이 가격 ${pack.price}보다 낮아야 합니다.`);
 }
});
test('releasing returns the coins and removes only the chosen players',()=>{
 const library=withCards(['리오넬 메시','얀 오블라크']);
 const messi=library.players.at(-2),oblak=library.players.at(-1);
 const before=library.players.length;
 const {library:next,refund,removed}=releasePlayers(library,[messi.uid]);
 assert.equal(next.players.length,before-1);
 assert.equal(refund,releaseValue(messi));
 assert.equal(removed.length,1);
 assert.ok(next.players.some(p=>p.uid===oblak.uid),'고르지 않은 선수는 남아야 합니다.');
 assert.equal(library.players.length,before,'원본은 그대로여야 합니다.');
 assert.doesNotThrow(()=>cleanLibrary(next));
});
test('releasing several at once adds their values together',()=>{
 const library=withCards(['리오넬 메시','얀 오블라크','해리 케인']);
 const picked=library.players.slice(-3);
 const {refund,library:next}=releasePlayers(library,picked.map(p=>p.uid));
 assert.equal(refund,picked.reduce((sum,p)=>sum+releaseValue(p),0));
 assert.equal(next.players.length,library.players.length-3);
});
test('a player in the starting eleven cannot be released',()=>{
 const library=defaultSquads();
 const playing=library.lineups[0][5];
 assert.equal(inLineup(library,playing),true);
 assert.throws(()=>releasePlayers(library,[playing]),/배치돼 있습니다/);
});
test('releasing everything spare still leaves both starting elevens intact',()=>{
 const library=withCards(['리오넬 메시','얀 오블라크','해리 케인']);
 const spare=releasable(library).map(p=>p.uid);
 assert.equal(spare.length,3,'기본 선수 22명은 모두 배치돼 있어 방출 대상이 아닙니다.');
 const {library:next}=releasePlayers(library,spare);
 assert.equal(next.players.length,22);
 assert.doesNotThrow(()=>cleanLibrary(next),'두 팀의 11명이 그대로 남아야 합니다.');
});
test('unknown or empty selections are refused',()=>{
 const library=defaultSquads();
 assert.throws(()=>releasePlayers(library,[]),/먼저 고르세요/);
 assert.throws(()=>releasePlayers(library,['없는-선수']),/구단에 없는/);
});
test('search, position filter and sorting narrow the club list',()=>{
 const library=withCards(['리오넬 메시','얀 오블라크','해리 케인']);
 const byName=viewPlayers(library,{search:'메시'});
 assert.equal(byName.length,1);
 assert.equal(byName[0].player.name,'리오넬 메시');
 const keepers=viewPlayers(library,{role:'GK'});
 assert.ok(keepers.every(row=>row.player.role==='GK'));
 assert.ok(keepers.some(row=>row.player.name==='얀 오블라크'));
 const ranked=viewPlayers(library,{sort:'overall'});
 for(let i=1;i<ranked.length;i++)assert.ok(ranked[i-1].overall>=ranked[i].overall,'종합 능력치 내림차순이어야 합니다.');
 const priced=viewPlayers(library,{sort:'value'});
 for(let i=1;i<priced.length;i++)assert.ok(priced[i-1].value>=priced[i].value);
});
test('the club list marks who is currently in a lineup',()=>{
 const library=defaultSquads();
 const rows=viewPlayers(library);
 assert.equal(rows.filter(row=>row.playing).length,22);
});
test('club value is the sum of every player it holds',()=>{
 const library=withCards(['리오넬 메시']);
 assert.equal(clubValue(library),library.players.reduce((sum,p)=>sum+releaseValue(p),0));
});
test('pulled cards can find their club and nation again',()=>{
 const library=withCards(['손흥민']);
 const card=cardFor(library.players.at(-1));
 assert.equal(card.club,'로스앤젤레스 FC');
 assert.equal(card.nation,'대한민국');
 assert.equal(cardFor(library.players[0]),null,'기본 선수는 카드 정보가 없습니다.');
});
test('the card and the saved profile agree on overall rating',()=>{
 const card=CARD_POOL.find(c=>c.name==='킬리안 음바페');
 const rows=viewPlayers(withCards(['킬리안 음바페']),{search:'음바페'});
 assert.equal(rows[0].overall,cardOverall(card));
});
