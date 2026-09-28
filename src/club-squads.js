import {KLEAGUE_ROSTERS,ROSTER_DATE} from './kleague-rosters.js';
import {roster} from './config.js';
import {cleanProfile} from './squads.js';

export {ROSTER_DATE};
export const clubPlayerId=(club,p)=>`kleague-${club}-${p.id}`;
export function clubProfiles(club){return (KLEAGUE_ROSTERS[club]||[]).map((p,i)=>{
 const slot={GK:0,DEF:2,MID:6,FWD:9}[p.role],base=roster(0)[slot];
 // Only identity, shirt number and broad position are official. Appearance and ratings are game presets.
 return cleanProfile({...base,uid:clubPlayerId(club,p),name:p.name,number:p.number,role:p.role,
  hairStyle:i%3===0?'crop':'short',skin:'#c89572',beard:'none'});
});}
export function initialClubLineup(players){
 const sorted=[...players].sort((a,b)=>a.number-b.number||a.uid.localeCompare(b.uid)),selected=[];
 for(const [role,count] of [['GK',1],['DEF',4],['MID',3],['FWD',3]])selected.push(...sorted.filter(p=>p.role===role).slice(0,count));
 for(const p of sorted)if(selected.length<11&&p.role!=='GK'&&!selected.includes(p))selected.push(p);
 if(selected.length!==11||selected[0].role!=='GK')throw Error('구단 선수단이 부족합니다.');
 return selected.map(p=>p.uid);
}
export function syncClubLineups(data){
 if(!data.clubLineups)return;
 if(data.activeClubs)for(let t=0;t<2;t++)data.clubLineups[data.activeClubs[t]]=[...data.lineups[t]];
 else data.customLineups=data.lineups.map(l=>[...l]);
}
export function selectClubSquads(data,home,away,mode='club'){
 syncClubLineups(data);
 if(!data.clubLineups){data.clubLineups={};data.customLineups=data.lineups.map(l=>[...l]);}
 const ids=new Set(data.players.map(p=>p.uid));
 for(const club of Object.keys(KLEAGUE_ROSTERS)){
  if(data.clubLineups[club]&&KLEAGUE_ROSTERS[club].every(p=>ids.has(clubPlayerId(club,p))))continue;
  const profiles=clubProfiles(club);
  for(const p of profiles)if(!ids.has(p.uid)){data.players.push(p);ids.add(p.uid);}
  data.clubLineups[club]??=initialClubLineup(profiles);
 }
 data.activeClubs=mode==='custom'?null:[home,away];
 data.lineups=(data.activeClubs?data.activeClubs.map(id=>data.clubLineups[id]):data.customLineups).map(l=>[...l]);
 return data;
}
export function visibleClubPlayers(data,team){
 if(!data.activeClubs)return data.players.filter(p=>!p.uid.startsWith('kleague-')||data.lineups.flat().includes(p.uid));
 const prefix=`kleague-${data.activeClubs[team]}-`;
 return data.players.filter(p=>p.uid.startsWith(prefix)||!p.uid.startsWith('kleague-')&&!p.uid.startsWith('default-')||data.lineups[team].includes(p.uid));
}
