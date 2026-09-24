import {captureRender,interpolateFrame} from './render-state.js';
export class Replay{
 constructor(){this.frames=[];this.clock=0;this.playback=null;}
 record(match,dt){if(match.state!=='playing')return;this.clock+=dt;if(this.clock<.05)return;this.clock%=.05;const frame=captureRender(match);if(this.frames.at(-1)?.time>=frame.time)return;this.frames.push(frame);if(this.frames.length>90)this.frames.shift();}
 begin(){this.playback=this.frames.slice();}
 clear(){this.frames=[];this.clock=0;this.playback=null;}
 sample(elapsed){if(!this.playback?.length)return null;const frames=this.playback,time=frames[0].time+Math.max(0,elapsed)*.75;let i=1;while(i<frames.length&&frames[i].time<time)i++;const a=frames[Math.max(0,i-1)],b=frames[Math.min(i,frames.length-1)],frame=interpolateFrame(a,b,Math.min(1,Math.max(0,(time-a.time)/(b.time-a.time||1))));return {...frame,players:frame.players.map(p=>({...p,speed:Math.hypot(p.vx,p.vz)})),ball:{x:frame.ball[0],y:frame.ball[1],z:frame.ball[2],q:{x:frame.ball[6],y:frame.ball[7],z:frame.ball[8],w:frame.ball[9]}}};}
}
