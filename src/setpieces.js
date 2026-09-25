import {FIELD,clamp,distance} from './config.js';
import {solveAirKick} from './air-flight.js';
export const RESTART_DISTANCE=9.15;
const place=(p,x,z,yaw)=>{Object.assign(p,{x,z,vx:0,vz:0,yaw,action:null,intent:null,dive:0,down:0,keeperRead:null,touchCooldown:0,target:{x,z}});};
const PENALTY_AREA={depth:16.5,halfWidth:20.16};
// Restart shapes. The play stops for a set piece, so both teams are placed in a shape for it instead of freezing where
// they stood (a goal kick used to leave attackers inside the kicking team's penalty area). Positions are in the
// restarting team's attacking frame: u runs toward the goal it attacks (+52.5 is that goal line), z is the pitch
// width. Role slots follow the 4-3-3 roster order: 1-4 defenders, 5-7 midfielders, 8-10 forwards.
export function restartShape(m,s){
 const b=m.physics.ball.position,d=m.direction(s.team),bu=b.x*d,side=Math.sign(b.z)||1,out=new Map();
 const set=(q,u,z)=>{if(q&&q.active&&q!==s.taker)out.set(q.id,{x:clamp(u,-51,51)*d,z:clamp(z,-32.5,32.5)});};
 const attackers=m.players.filter(q=>q.team===s.team),defenders=m.players.filter(q=>q.team!==s.team),slot=(team,i)=>team.find(q=>q.index===i);
 // Default: each team's home shape shifted toward the ball, as the AI covers in open play.
 for(const q of m.players){if(q.role==='GK')continue;const own=q.team===s.team,u=own?bu:-bu,shift=clamp(u*.5+(own?14:4),-8,30),home=(q.homeX+shift),x=own?home:-home;set(q,x,q.homeZ*.9+b.z*.2);}
 const gkA=slot(attackers,0),gkD=slot(defenders,0);set(gkA,-51,0);set(gkD,51,0);
 if(s.kind==='goalkick'){
  // Kicking team builds out: centre-backs split either side of the box, full-backs high and wide.
  [[1,-30,-27],[2,-39,-14],[3,-39,14],[4,-30,27],[5,-19,-16],[6,-25,0],[7,-19,16],[8,-5,-24],[9,-3,0],[10,-5,24]].forEach(([i,u,z])=>set(slot(attackers,i),u,z));
  // Opponents press from outside the penalty area.
  [[1,2,-22],[2,4,-8],[3,4,8],[4,2,22],[5,-16,-15],[6,-19,0],[7,-16,15],[8,-31,-13],[9,-32,0],[10,-31,13]].forEach(([i,u,z])=>set(slot(defenders,i),u,z));
 }else if(s.kind==='corner'){
  // Attackers crowd the box (near post, spot, far post, edge), one short option stays near the corner, two stay back.
  [[9,45,side*3],[8,41.5,-side*.5],[10,44.5,-side*5],[2,43,-side*1.8],[6,35,0],[side>0?7:5,46,side*25],[side>0?5:7,33,-side*11],[3,4,0],[1,-2,-14],[4,-2,14]].forEach(([i,u,z])=>set(slot(attackers,i),u,z));
  // Defenders mark the box runners goal-side, guard the near post and the edge, and leave one forward up for a counter.
  const box=[9,8,10,2].map(i=>slot(attackers,i)).filter(q=>q?.active&&q!==s.taker);
  [1,2,3,4].forEach((i,k)=>{const r=box[k];if(r)set(slot(defenders,i),out.get(r.id).x*d+1.1,out.get(r.id).z+.7*side);});
  [[6,36,1.5],[5,50.2,side*3.8],[7,39,-side*8],[8,20,-side*10],[9,0,0],[10,22,side*6]].forEach(([i,u,z])=>set(slot(defenders,i),u,z));
  set(gkD,51.3,side*1.1);
 }else if(['free','indirect'].includes(s.kind)&&bu>18){
  // Attacking free kick: the defending line holds in front of its box; attackers wait on that line, onside.
  const line=clamp(bu+11,34,41),lineZ=[-10,-5,0,5,10].map(z=>clamp(z+b.z*.25,-18,18));
  [1,2,3,4,7].forEach((i,k)=>set(slot(defenders,i),line+.6,lineZ[k]));
  [[9,line-.8,lineZ[1]+1],[8,line-.8,lineZ[3]+1],[10,line-.8,lineZ[4]-1.5],[2,line-.8,lineZ[0]+1.5],[3,line-2.5,lineZ[2]]].forEach(([i,u,z])=>set(slot(attackers,i),u,z));
  [[6,bu-7,b.z-side*6],[side>0?7:5,bu-3,b.z-side*12],[side>0?5:7,bu-12,-side*16],[1,-4,-12],[4,-4,12]].forEach(([i,u,z])=>set(slot(attackers,i),u,z));
  [[6,bu+10,b.z*.3],[5,bu+2,-side*16],[8,8,-8],[9,4,6],[10,14,side*14]].forEach(([i,u,z])=>set(slot(defenders,i),u,z));
 }else if(s.kind==='throw'){
  // Two short options for the thrower, each with a marker; everyone else in the shifted shape.
  const inward=-side,near=[...attackers].filter(q=>q.role!=='GK'&&q!==s.taker).sort((a,c)=>distance(a,b)-distance(c,b)).slice(0,2);
  const spots=[[bu+9,b.z+inward*5],[bu-4,b.z+inward*12]];
  near.forEach((q,k)=>{const [u,z]=spots[k];set(q,u,z);const marker=[...defenders].filter(r=>r.role!=='GK'&&!r.markedThrow).sort((a,c)=>distance(a,{x:u*d,z})-distance(c,{x:u*d,z}))[0];if(marker){marker.markedThrow=true;set(marker,u+1.2,z+inward*.8);}});
  for(const q of defenders)delete q.markedThrow;
 }
 return out;
}
// Keep the law's distances from a restart: outside the kicking team's penalty area at a goal kick, 2 m from a throw.
function lawfulRestart(m,s){
 const b=m.physics.ball.position,d=m.direction(s.team);
 for(const q of m.players){if(!q.active||q===s.taker||q.team===s.team)continue;const u=q.x*d;
  if(s.kind==='goalkick'&&u<-(FIELD.halfLength-PENALTY_AREA.depth)+.8&&Math.abs(q.z)<PENALTY_AREA.halfWidth+.8)q.x=(-(FIELD.halfLength-PENALTY_AREA.depth)+1.2)*d;
  if(s.kind==='throw'&&distance(q,b)<2.4){const dx=q.x-b.x,dz=q.z-b.z,l=Math.hypot(dx,dz)||1;q.x=b.x+dx/l*2.4;q.z=clamp(b.z+dz/l*2.4,-33,33);}}
}
// Players never stand on one another; a free-kick wall keeps its shoulder-to-shoulder spacing.
function separate(m,wall=[]){const list=m.players.filter(q=>q.active);for(let pass=0;pass<3;pass++)for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],c=list[j],dx=c.x-a.x,dz=c.z-a.z,l=Math.hypot(dx,dz);if(l<.9&&!(wall.includes(a.id)&&wall.includes(c.id))){const push=(.9-l)/2,ux=l>1e-6?dx/l:1,uz=l>1e-6?dz/l:0;a.x-=ux*push;a.z-=uz*push;c.x+=ux*push;c.z+=uz*push;}}}
export function arrangeSetPiece(m,s){
 const b=m.physics.ball.position,d=m.direction(s.team),goalX=d*FIELD.halfLength,p=s.taker;
 s.aimZ=0;s.aimHeight=s.kind==='penalty'?.85:1.15;s.readyAt=m.time+.6;s.expires=m.time+(m.isHumanTeam(s.team)?30:2);
 const gk=m.players.find(q=>q.active&&q.team!==s.team&&q.role==='GK');
 s.wall=[];
 if(s.kind!=='penalty'){const shape=restartShape(m,s);for(const q of m.players){const at=shape.get(q.id);if(at)place(q,at.x,at.z,Math.atan2(b.x-at.x,b.z-at.z));}separate(m);lawfulRestart(m,s);}
 if(s.kind==='penalty'){
  if(gk)place(gk,goalX,0,-d*Math.PI/2);
  let index=0;for(const q of m.players){if(!q.active||q===p||q===gk)continue;const column=index%10,row=Math.floor(index/10);place(q,d*(30.6-row*1.2),(column-4.5)*2.15,d*Math.PI/2);index++;}
 }else if(['free','indirect','corner'].includes(s.kind)){
  const gx=goalX-b.x,gz=-b.z,n=Math.hypot(gx,gz)||1,ux=gx/n,uz=gz/n;
  const wallCount=s.kind==='free'&&n>10&&n<36?4:0;
  const defenders=m.players.filter(q=>q.active&&q.team!==s.team&&q.role!=='GK').sort((a,c)=>distance(a,b)-distance(c,b));
  for(let i=0;i<wallCount;i++){const q=defenders[i];if(!q)break;const side=(i-(wallCount-1)/2)*.73;place(q,b.x+ux*9.6-uz*side,b.z+uz*9.6+ux*side,Math.atan2(-ux,-uz));s.wall.push(q.id);}
  for(const q of m.players){if(!q.active||q===p||s.wall.includes(q.id))continue;
   if(q.team!==s.team&&distance(q,b)<9.5){const dx=q.x-b.x,dz=q.z-b.z,l=Math.hypot(dx,dz)||1;place(q,clamp(b.x+dx/l*9.6,-52.1,52.1),clamp(b.z+dz/l*9.6,-33.6,33.6),Math.atan2(b.x-q.x,b.z-q.z));
    if(distance(q,b)<9.15){for(let k=0;k<32;k++){const angle=k*Math.PI/16,x=b.x+Math.cos(angle)*9.6,z=b.z+Math.sin(angle)*9.6;if(Math.abs(x)<52.2&&Math.abs(z)<33.7){place(q,x,z,Math.atan2(b.x-x,b.z-z));break;}}}}
   if(q.team===s.team&&s.wall.some(id=>distance(q,m.players[id])<1.5))place(q,clamp(b.x-uz*4+ux*5,-51,51),clamp(b.z+ux*4+uz*5,-32,32),d*Math.PI/2);
  }
  if(s.kind==='corner'&&gk)place(gk,goalX-d*1.2,Math.sign(b.z)*1.1,-d*Math.PI/2);
 }
 if(s.kind!=='penalty'){separate(m,s.wall);for(const q of m.players)if(q.active&&q!==p&&q.team!==s.team&&['free','indirect','corner'].includes(s.kind)&&distance(q,b)<9.2){const dx=q.x-b.x,dz=q.z-b.z,l=Math.hypot(dx,dz)||1;q.x=b.x+dx/l*9.2;q.z=b.z+dz/l*9.2;}}
 // The taker waits beside a stationary ball; the existing kick approach provides the final step.
 place(p,b.x-d*.54,b.z+.11*d,d*Math.PI/2);
 for(const q of m.players)if(q.active){q.vx=q.vz=0;q.action=null;q.intent=null;q.target={x:q.x,z:q.z};}
 s.positions=m.players.filter(q=>q.active).map(q=>({id:q.id,x:q.x,z:q.z,yaw:q.yaw}));
}
export function updateSetPiece(m,dt){const s=m.setPiece;if(!s)return;
 if(['free','penalty'].includes(s.kind)&&!s.taker.action){const a=m.inputForTeam(s.team).axis||{};s.aimZ=clamp((s.aimZ||0)+(a.x||0)*m.direction(s.team)*2.4*dt,-4.5,4.5);s.aimHeight=clamp((s.aimHeight||.85)-(a.z||0)*1.4*dt,.18,3.1);}
}
export function restartShotTarget(m,p){const s=m.setPiece;if(s?.taker!==p||!['free','penalty'].includes(s.kind))return null;return {x:m.direction(p.team)*(FIELD.halfLength+.2),z:s.aimZ||0,y:s.aimHeight??.85};}
export function penaltyFlight(a,p,b){const time=a.distance/((21+9*a.power)*(.9+.1*p.power));return solveAirKick(a.distance,(a.target?.y??.85)+Math.max(0,a.power-.85)*5.5,time,b.y,0);}
export function secondTouch(m,p){if(m.restartOrigin?.player!==p.id)return false;m.beginRestart({kind:'indirect',team:1-p.team,x:p.x,z:p.z,label:'두 번 터치 · 간접 프리킥'});return true;}
