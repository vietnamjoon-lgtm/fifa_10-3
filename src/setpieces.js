import {FIELD,clamp,distance} from './config.js';
import {solveAirKick} from './air-flight.js';
export const RESTART_DISTANCE=9.15;
const place=(p,x,z,yaw)=>{Object.assign(p,{x,z,vx:0,vz:0,yaw,action:null,intent:null,dive:0,down:0,keeperRead:null,touchCooldown:0,target:{x,z}});};
export function arrangeSetPiece(m,s){
 const b=m.physics.ball.position,d=m.direction(s.team),goalX=d*FIELD.halfLength,p=s.taker;
 s.aimZ=0;s.aimHeight=s.kind==='penalty'?.85:1.15;s.readyAt=m.time+.6;s.expires=m.time+(m.isHumanTeam(s.team)?30:2);
 const gk=m.players.find(q=>q.active&&q.team!==s.team&&q.role==='GK');
 s.wall=[];
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
  if(s.kind==='corner'){const runners=m.players.filter(q=>q.active&&q.team===s.team&&q!==p&&q.role==='FWD');runners.forEach((q,i)=>{place(q,d*(42-i*2.2),(i-1)*6,d*Math.PI/2);const defender=defenders[i];if(defender)place(defender,q.x+d*1.2,q.z+.8,-d*Math.PI/2);});if(gk)place(gk,goalX-d*1.2,Math.sign(b.z)*1.1,-d*Math.PI/2);}
 }
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
