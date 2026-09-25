const mix=(a,b,t)=>a+(b-a)*t;
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function interpolatePlayer(a,b,t){
 if(!a||a.active!==b.active||Math.hypot(a.x-b.x,a.z-b.z)>5)return {...b};
 const out={...a,x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),yaw:angle(a.yaw,b.yaw,t)};
 for(const key of ['vx','vz','dive','down','motionPhase','motionAcceleration','motionTurn','stamina'])if(Number.isFinite(a[key])&&Number.isFinite(b[key]))out[key]=mix(a[key],b[key],t);
 if(a.action&&b.action&&(a.action.id===b.action.id||a.action.id===undefined&&a.action.type===b.action.type)){
  const elapsed=mix(a.action.elapsed,b.action.elapsed,t),contactAt=b.action.contactAt;
  out.action={...b.action,elapsed,hit:b.action.hit&&elapsed>=contactAt};
 }else if(t>=1)out.action=b.action?{...b.action}:null;
 else if(a.action){out.action={...a.action,elapsed:a.action.elapsed+t*(b.sampleTime-a.sampleTime||0)};}
 return out;
}
export function interpolateFrame(a,b,t){
 if(a.state!==b.state||a.half!==b.half)return b;
 const duration=b.time-a.time;
 const q0=a.ball.slice(6,10),q1=b.ball.slice(6,10),dot=q0.reduce((v,n,i)=>v+n*q1[i],0);
 const q=q1.map((n,i)=>mix(q0[i],dot<0?-n:n,t)),length=Math.hypot(...q)||1;
 return {...(t<1?a:b),time:mix(a.time,b.time,t),elapsed:mix(a.elapsed,b.elapsed,t),timer:mix(a.timer,b.timer,t),
  ball:[...b.ball.slice(0,6).map((n,i)=>mix(a.ball[i],n,t)),...q.map(n=>n/length)],
  players:b.players.map((p,i)=>interpolatePlayer({...a.players[i],sampleTime:0},{...p,sampleTime:duration},t))};
}
export function captureRender(match){const b=match.physics.ball;return {time:match.time,state:match.state,half:match.half,elapsed:match.elapsed,timer:match.timer,
 players:match.players.map(p=>({...p,rig:undefined,action:p.action?{...p.action,contactTarget:p.action.contactTarget?{...p.action.contactTarget}:null}:null})),
 ball:[b.position.x,b.position.y,b.position.z,b.velocity.x,b.velocity.y,b.velocity.z,b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w]};}
export class LocalPresentation{
 reset(match){this.before=this.after=captureRender(match);}
 step(match){this.before=this.after||captureRender(match);this.after=captureRender(match);}
 sample(alpha){return this.after?interpolateFrame(this.before,this.after,Math.max(0,Math.min(1,alpha))):null;}
}
