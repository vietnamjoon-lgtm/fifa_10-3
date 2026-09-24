import {interpolateFrame} from './render-state.js';
const mix=(a,b,t)=>a+(b-a)*t;
const angle=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function applySnapshot(match,s,team){
 match.settings.userTeam=team;match.settings.halfSeconds=s.halfSeconds;match.practice=false;
 for(const key of ['state','half','elapsed','timer','score','stats','goalTeam','lastTouchTeam','addedTime'])match[key]=s[key];
 match.time=s.time;for(const source of s.players)Object.assign(match.players[source.id],source);
 match.controlled=match.players[s.controlled[team]];match.owner=s.owner===null?null:match.players[s.owner];match.heldBy=s.heldBy===null?null:match.players[s.heldBy];
 match.charging=s.charges[team][0];match.charge=s.charges[team][1];match.pressEnergy=s.press[team][0];match.pressHelpers=Array(s.press[team][1]).fill(null);match.advantage=s.advantage?{}:null;
 match.setPiece=s.setPiece?{...s.setPiece,taker:match.players[s.setPiece.taker]}:null;
 const b=match.physics.ball;b.position.set(...s.ball.slice(0,3));b.velocity.set(...s.ball.slice(3,6));b.quaternion.set(...s.ball.slice(6,10));
}
export class SnapshotBuffer{
 constructor(){this.clear();}
 clear(){this.frames=[];this.anchorTime=null;this.anchorReceived=0;this.delay=.065;this.clock=null;}
 push(snapshot,received){
  const last=this.frames.at(-1);if(last&&snapshot.time<last.snapshot.time)this.clear();
  if(last&&snapshot.time===last.snapshot.time){this.frames[this.frames.length-1]={snapshot,received};this.anchorReceived=received;return;}
  this.frames.push({snapshot,received});if(this.frames.length>20)this.frames.shift();
  // Advance by authoritative simulation timestamps. Arrival jitter changes the clock gently.
  if(this.anchorTime===null){this.anchorTime=snapshot.time;this.anchorReceived=received;}
  else {const estimate=this.anchorTime+(received-this.anchorReceived)/1000;this.anchorTime=estimate+Math.max(-.015,Math.min(.015,snapshot.time-estimate));this.anchorReceived=received;}
 }
 sample(now){
  if(!this.frames.length)return null;const latest=this.frames.at(-1).snapshot;
  let target=Math.min(latest.time,this.anchorTime+(now-this.anchorReceived)/1000-this.delay);
  if(this.clock!==null)target=Math.max(this.clock,target);this.clock=target;
  let a=this.frames[0].snapshot,b=a;for(const f of this.frames){if(f.snapshot.time<=target)a=f.snapshot;if(f.snapshot.time>=target){b=f.snapshot;break;}b=f.snapshot;}
  if(a===b)return a;return interpolateFrame(a,b,Math.max(0,Math.min(1,(target-a.time)/(b.time-a.time))));
 }
}
