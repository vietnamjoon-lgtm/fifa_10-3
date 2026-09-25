import {captureRender,interpolateFrame} from './render-state.js';
// speed: replay playback rate; tail: seconds recorded after the goal so the ball is seen in the net; frames: buffer size (0.05 s each).
export const REPLAY={speed:.75,tail:1.1,frames:120,duration:5};
export class Replay{
 constructor(){this.frames=[];this.clock=0;this.playback=null;this.goalTime=null;this.stopped=false;}
 record(match,dt){
  // Keep recording briefly after the goal: the frames that show the ball crossing the line arrive after the state change.
  const afterGoal=this.goalTime!==null&&!this.playback&&match.state==='goal'&&match.time-this.goalTime<=REPLAY.tail;
  if(match.state!=='playing'&&!afterGoal)return;this.clock+=dt;if(this.clock<.05)return;this.clock%=.05;const frame=captureRender(match);if(this.frames.at(-1)?.time>=frame.time)return;this.frames.push(frame);if(this.frames.length>REPLAY.frames)this.frames.shift();}
 // Marks the goal; the playback is cut from the buffer when it starts, after the post-goal frames are in.
 begin(goalTime=null){this.goalTime=goalTime;this.playback=null;this.stopped=false;}
 stop(){this.playback=null;this.stopped=true;}
 clear(){this.frames=[];this.clock=0;this.playback=null;this.goalTime=null;this.stopped=false;}
 // The replay window ends just after the goal and covers what `duration` seconds of slow motion can show before it.
 // Playing from the start of the buffer instead ran out of time before the ball reached the net.
 sample(elapsed,duration=REPLAY.duration){
  if(this.stopped)return null;if(!this.playback){if(!this.frames.length)return null;this.playback=this.frames.slice();}
  const frames=this.playback,last=frames.at(-1).time,end=this.goalTime===null?last:Math.min(last,this.goalTime+REPLAY.tail),start=Math.max(frames[0].time,end-duration*REPLAY.speed),time=Math.min(end,start+Math.max(0,elapsed)*REPLAY.speed);
  let i=1;while(i<frames.length&&frames[i].time<time)i++;const a=frames[Math.max(0,i-1)],b=frames[Math.min(i,frames.length-1)],frame=interpolateFrame(a,b,Math.min(1,Math.max(0,(time-a.time)/(b.time-a.time||1))));return {...frame,players:frame.players.map(p=>({...p,speed:Math.hypot(p.vx,p.vz)})),ball:{x:frame.ball[0],y:frame.ball[1],z:frame.ball[2],q:{x:frame.ball[6],y:frame.ball[7],z:frame.ball[8],w:frame.ball[9]}}};}
}
