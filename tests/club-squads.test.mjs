import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSquads,cleanLibrary,cleanLineup} from '../src/squads.js';
import {selectClubSquads,syncClubLineups,visibleClubPlayers} from '../src/club-squads.js';
import {KLEAGUE_ROSTERS,ROSTER_SOURCES} from '../src/kleague-rosters.js';
test('all twelve current official club lists have legal lineups, reserves and Korean identities',()=>{
 let data=defaultSquads();for(const [club,players] of Object.entries(KLEAGUE_ROSTERS)){
  assert.ok(players.length>=18);assert.ok(ROSTER_SOURCES[club].asOf);assert.ok(players.every(p=>/[가-힣]/.test(p.name)));
  selectClubSquads(data,club,club==='seoul'?'bucheon':'seoul');data=cleanLibrary(data);
  assert.equal(data.lineups[0].length,11);assert.equal(new Set(data.lineups[0]).size,11);
  assert.ok(data.lineups[0].every(id=>id.startsWith(`kleague-${club}-`)));
  assert.equal(visibleClubPlayers(data,0).length,players.length);
  assert.equal(cleanLineup(data.lineups[0].map(id=>data.players.find(p=>p.uid===id)),0,true)[0].role,'GK');
 }
});
test('club switches and save round-trips preserve edited profiles, reserve choices and the original custom team',()=>{
 let data=defaultSquads();data.players[9].name='MY ORIGINAL';data.players[9].face.assetId='local-fixture';const original=structuredClone(data);
 selectClubSquads(data,'bucheon','seoul');const uid=data.lineups[0][9],p=data.players.find(p=>p.uid===uid);p.name='EDITED';
 const reserve=visibleClubPlayers(data,0).find(q=>q.role==='FWD'&&!data.lineups[0].includes(q.uid));data.lineups[0][9]=reserve.uid;syncClubLineups(data);
 data=cleanLibrary(JSON.parse(JSON.stringify(data)));selectClubSquads(data,'ulsan','jeonbuk');selectClubSquads(data,'bucheon','seoul');
 assert.equal(data.lineups[0][9],reserve.uid);assert.equal(data.players.find(p=>p.uid===uid).name,'EDITED');
 selectClubSquads(data,'bucheon','seoul','custom');assert.deepEqual(data.lineups,original.lineups);assert.equal(data.players.find(p=>p.uid==='default-9').face.assetId,'local-fixture');
 assert.equal(data.players.find(p=>p.uid==='default-9').name,'MY ORIGINAL');
});
