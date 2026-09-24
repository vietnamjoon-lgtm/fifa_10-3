import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {distance} from '../src/config.js';
const idle={axis:{x:0,z:0}};
function training(){const events={};const m=new Match({...defaults},type=>events[type]=(events[type]||0)+1);m.start(true);m.state='playing';const p=m.controlled;p.x=-20;p.z=0;m.physics.reset(-19.46,-.11);m.owner=p;return {m,p,events};}
function run(m,seconds,input=idle){for(let i=0;i<seconds*120;i++)m.step(1/120,input);}
const report={};
for(const sprint of [false,true]){const {m,p}=training();let retained=0,maxDistance=0,n=0;for(const axis of [{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:0,z:0}])for(let i=0;i<180;i++){m.step(1/120,{axis,sprint});retained+=m.owner===p?1:0;maxDistance=Math.max(maxDistance,distance(p,m.physics.ball.position));n++;}report[sprint?'sprintTurns':'jogTurns']={possessionPercent:Math.round(retained/n*100),maxDistance:+maxDistance.toFixed(2),endingDistance:+distance(p,m.physics.ball.position).toFixed(2)};}
{let kicks=0,misses=0;for(const sprint of [false,true])for(const kind of ['pass','shoot'])for(const turn of [0,.5,-.5,1]){const {m,p,events}=training();run(m,1.2,{axis:{x:1,z:0},sprint});m.input={axis:{x:1,z:turn}};m.queueKick(p,kind,.6);run(m,.8,idle);kicks+=events.kick||0;misses+=events.miss||0;}report.movingKicks={attempts:16,kicks,misses};}
{const {m,p}=training();p.x=38;p.z=10;m.physics.reset(38.54,9.89);m.input={axis:{x:1,z:1}};m.queueKick(p,'shoot',.65);run(m,.24);const b=m.physics.ball;report.diagonalShot={crossingZ:+(b.position.z+b.velocity.z/b.velocity.x*(52.5-b.position.x)).toFixed(2),speed:+b.velocity.length().toFixed(1)};}
console.log(JSON.stringify(report,null,2));
