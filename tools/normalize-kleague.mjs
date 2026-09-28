// The official club list can contain multiple registration IDs for the same player.
// Ulsan lists both the Korean and truncated Portuguese name for number 27 (페드링요).
export function normalizeRoster(rows){
 const seen=new Set();return rows.map(p=>p.id==='20260050'?{...p,name:'페드링요'}:p).filter(p=>{
  const key=`${p.name}|${p.number}|${p.role}`;if(seen.has(key))return false;seen.add(key);return true;
 });
}
