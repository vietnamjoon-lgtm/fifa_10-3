// Headless broadcast-camera measurement. Runs an AI match through the same fixed-step
// simulation + LocalPresentation interpolation as main.js, feeds the camera director
// with jittered frame times and reports per-frame translation/rotation changes.
// Usage: node tools/camera-metrics.mjs [path/to/camera.js] [--seconds 120] [--seed 7] [--mode 0]
import {register} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
register('./three-loader.mjs',import.meta.url);
const THREE=await import('../vendor/three.module.js');
const {Match}=await import('../src/match.js');
const {defaults}=await import('../src/settings.js');
const {TUNING}=await import('../src/config.js');
const {LocalPresentation}=await import('../src/render-state.js');
const args=process.argv.slice(2),flag=(name,value)=>{const i=args.indexOf('--'+name);return i<0?value:Number(args[i+1]);};
const modulePath=args[0]&&!args[0].startsWith('--')?path.resolve(args[0]):path.resolve(path.dirname(new URL(import.meta.url).pathname),'../src/camera.js');
const {MatchCamera}=await import(pathToFileURL(modulePath).href);
const seconds=flag('seconds',120),seed=flag('seed',7),mode=flag('mode',0);

export function measure(){
 const match=new Match({...defaults,halfSeconds:600,seed},()=>{});match.start(false);match.autoplay=true;
 const camera=new THREE.PerspectiveCamera(43,16/9,.08,250),director=new MatchCamera(camera),presentation=new LocalPresentation();presentation.reset(match);
 let rng=seed*9301+49297;const random=()=>((rng=(rng*1103515245+12345)%2147483648)/2147483648);
 let accumulator=0,time=0,previous=null,switches=0,lastControlled=match.controlled;
 const rows=[],forward=new THREE.Vector3(),ndc=new THREE.Vector3();
 while(time<seconds){
  // 60 Hz display with +-25% jitter and a 33 ms hitch every ~2 s (browser GC / tab work).
  const dt=random()<.008?1/30:(1/60)*(.75+random()*.5);time+=dt;
  accumulator+=Math.min(dt,.05);
  while(accumulator>=TUNING.step){match.step(TUNING.step,{axis:{x:0,z:0}});presentation.step(match);accumulator-=TUNING.step;}
  const display=presentation.sample(accumulator/TUNING.step),controlled=display.players[match.controlled.id];
  if(match.controlled!==lastControlled){switches++;lastControlled=match.controlled;}
  const ball={x:display.ball[0],y:display.ball[1],z:display.ball[2]};
  director.update({...match,controlled,physics:{ball:{position:ball,velocity:match.physics.ball.velocity}}},mode,dt,time);
  camera.updateMatrixWorld();camera.getWorldDirection(forward);
  const yaw=Math.atan2(forward.x,-forward.z),pitch=Math.asin(forward.y);
  const onScreen=p=>{ndc.set(p.x,p.y,p.z).project(camera);return Math.abs(ndc.x)<=1&&Math.abs(ndc.y)<=1&&ndc.z<1;};
  const row={t:time,dt,x:camera.position.x,y:camera.position.y,z:camera.position.z,fx:forward.x,fy:forward.y,fz:forward.z,yaw,pitch,fov:camera.fov,
   ballVisible:onScreen(ball),ndcX:ndc.x,ndcY:ndc.y,playerVisible:onScreen({x:controlled.x,y:1,z:controlled.z}),pndc:[+ndc.x.toFixed(2),+ndc.y.toFixed(2)],px:controlled.x,pz:controlled.z,bx:ball.x,by:ball.y,bz:ball.z,setPiece:match.setPiece?.kind,state:match.state,ballSpeed:match.physics.ball.velocity.length()};
  if(previous){
   row.move=Math.hypot(row.x-previous.x,row.y-previous.y,row.z-previous.z);row.speed=row.move/dt;
   row.vx=(row.x-previous.x)/dt;row.vy=(row.y-previous.y)/dt;row.vz=(row.z-previous.z)/dt;
   row.turnRate=Math.acos(Math.min(1,row.fx*previous.fx+row.fy*previous.fy+row.fz*previous.fz))/dt*180/Math.PI;
   row.yawRate=Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw))/dt*180/Math.PI;row.pitchRate=(pitch-previous.pitch)/dt*180/Math.PI;
   if(previous.yawRate!==undefined){row.yawAccel=(row.yawRate-previous.yawRate)/dt;row.accel=(row.speed-previous.speed)/dt;}
  }
  rows.push(row);previous=row;
 }
 return {rows,switches};
}
const pct=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor((s.length-1)*p))]||0;};
const rms=values=>Math.sqrt(values.reduce((a,b)=>a+b*b,0)/(values.length||1));
// Shake: frame velocity minus its own +-100 ms centred average. A smooth pan or dolly
// scores ~0 however fast it is; frame-to-frame wobble and hitches score high.
function shake(live,key){const out=[];for(let i=6;i<live.length-6;i++){let n=0;for(let j=i-6;j<=i+6;j++)n+=live[j][key];out.push(live[i][key]-n/13);}return rms(out);}
function shakeVector(live){const out=[];for(let i=6;i<live.length-6;i++){let x=0,y=0,z=0;for(let j=i-6;j<=i+6;j++){x+=live[j].vx;y+=live[j].vy;z+=live[j].vz;}out.push(Math.hypot(live[i].vx-x/13,live[i].vy-y/13,live[i].vz-z/13));}return rms(out);}
export function summarize({rows,switches}){
 const live=rows.filter(r=>r.state==='playing'&&r.yawAccel!==undefined);
 const yawRates=live.map(r=>Math.abs(r.yawRate)),pitchRates=live.map(r=>Math.abs(r.pitchRate)),moves=live.map(r=>r.move),speeds=live.map(r=>r.speed);
 // Direction reversals of a meaningful pan (> 1 deg/s) within 0.25 s read as shake, not a deliberate pan.
 let reversals=0,lastSign=0,lastAt=-1;for(const r of live){if(Math.abs(r.yawRate)<1)continue;const s=Math.sign(r.yawRate);if(lastSign&&s!==lastSign&&r.t-lastAt<.25)reversals++;lastSign=s;lastAt=r.t;}
 const fovs=live.map(r=>r.fov);
 return {frames:rows.length,livePlayFrames:live.length,controlSwitches:switches,
  translationPerFrameM:{p50:+pct(moves,.5).toFixed(4),p95:+pct(moves,.95).toFixed(4),max:+Math.max(...moves).toFixed(4)},
  translationSpeedMs:{p95:+pct(speeds,.95).toFixed(2),max:+Math.max(...speeds).toFixed(2)},
  yawRateDegS:{p50:+pct(yawRates,.5).toFixed(2),p95:+pct(yawRates,.95).toFixed(2),max:+Math.max(...yawRates).toFixed(2)},
  pitchRateDegS:{p95:+pct(pitchRates,.95).toFixed(2),max:+Math.max(...pitchRates).toFixed(2)},
  turnRateDegS:{p50:+pct(live.map(r=>r.turnRate),.5).toFixed(2),p95:+pct(live.map(r=>r.turnRate),.95).toFixed(2),max:+Math.max(...live.map(r=>r.turnRate)).toFixed(2)},
  translationShakeRmsMs:+shakeVector(live).toFixed(3),
  rotationShakeRmsDegS:+Math.hypot(shake(live,'yawRate'),shake(live,'pitchRate')).toFixed(3),
  yawAccelRmsDegS2:+rms(live.map(r=>r.yawAccel)).toFixed(1),
  translationAccelRmsMs2:+rms(live.map(r=>r.accel)).toFixed(2),
  panReversalsPerMin:+(reversals/(live.length?live.at(-1).t-live[0].t:1)*60).toFixed(2),
  fovDeg:{min:+Math.min(...fovs).toFixed(1),max:+Math.max(...fovs).toFixed(1)},
  ballOnScreenPct:+(100*live.filter(r=>r.ballVisible).length/live.length).toFixed(2),
  controlledOnScreenPct:+(100*live.filter(r=>r.playerVisible).length/live.length).toFixed(2)};
}
// --debug lists every stretch of live play where the ball left the frame.
export function offscreenRuns(rows){const runs=[];let run=null;for(const r of rows){if(r.state==='playing'&&!r.ballVisible){if(!run)runs.push(run={from:+r.t.toFixed(2),frames:0,ball:[r.bx,r.by,r.bz].map(n=>+n.toFixed(1)),ndc:[+r.ndcX.toFixed(2),+r.ndcY.toFixed(2)],camX:+r.x.toFixed(1),fov:+r.fov.toFixed(1),setPiece:r.setPiece});run.frames++;}else run=null;}return runs;}
if(import.meta.url===pathToFileURL(process.argv[1]).href&&args.includes('--debug')){const result=measure();console.log(offscreenRuns(result.rows).map(r=>JSON.stringify(r)).join('\n'));}
else if(import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify({camera:path.relative(process.cwd(),modulePath),seconds,seed,mode,...summarize(measure())},null,1));
