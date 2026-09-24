import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
const report=[];
for(let run=0;run<3;run++){
 const events={};const m=new Match({...defaults,halfSeconds:120,seed:100+run},(t)=>events[t]=(events[t]||0)+1);m.start(false);m.autoplay=true;const start=performance.now();let minY=100,maxSpeed=0,steps=0;
 while(m.state!=='fulltime'&&steps<120*600){m.step(1/120,{axis:{x:0,z:0}});steps++;minY=Math.min(minY,m.physics.ball.position.y);maxSpeed=Math.max(maxSpeed,m.physics.ball.velocity.length());if(![m.physics.ball.position.x,m.physics.ball.position.y,m.physics.ball.position.z,...m.players.flatMap(p=>[p.x,p.z,p.vx,p.vz,p.yaw])].every(Number.isFinite))throw Error('Nonfinite world');}
 report.push({run:run+1,state:m.state,simulationSeconds:steps/120,score:m.score,stats:m.stats,events,minBallY:minY,maxBallSpeed:maxSpeed,cpuSeconds:(performance.now()-start)/1000});
 if(m.state!=='fulltime')throw Error('Match did not complete');
}
console.log(JSON.stringify(report,null,2));
