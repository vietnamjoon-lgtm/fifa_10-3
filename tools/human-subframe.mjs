import fs from 'node:fs';
import {Match} from '../src/match.js';
import {bodyMetrics} from '../src/body-shape.js';
import {defaults} from '../src/settings.js';
import {sampleMotion} from '../src/motion.js';
import {interpolatePlayer} from '../src/render-state.js';
const subdivisions=Number(process.argv[2]||5000),results=[];
if(!Number.isInteger(subdivisions)||subdivisions<100||subdivisions>10000)throw Error('Use 100–10000 subdivisions');
// Focused scans across idle thresholds, gait wraps and all 8 input directions.
// Not advertised as a full 12-second Match scan or a mesh/ball collision test.
for(const direction of [-1,1])for(const turn of Array.from({length:8},(_,i)=>i*Math.PI/4))for(const speed of [.04,.2,1.3,3.5,8.5])for(const phase of [0,Math.PI,2*Math.PI-.004]){
 const match=new Match({...defaults,userTeam:direction>0?0:1,seed:17});match.start(true);match.state='playing';match.lock=0;match.owner=null;const player=match.controlled;
 Object.assign(player,{x:0,z:0,vx:0,vz:direction*speed,yaw:direction>0?0:Math.PI,height:1.81,motionPhase:phase,action:null});
 const a={...player};match.updatePlayer(player,1/120,{axis:{x:Math.sin(a.yaw+turn),z:Math.cos(a.yaw+turn)},sprint:speed>6});const b={...player};let worst=0,previous=null;

 for(let i=0;i<=subdivisions;i++){const alpha=i/subdivisions,p=interpolatePlayer(a,b,alpha),pose=sampleMotion(p,p.motionPhase,1+alpha/120,null,false,{turn:p.motionTurn,acceleration:p.motionAcceleration}),scale=bodyMetrics(p).scale,coordinates=pose.gaitTargets.flatMap(f=>[(f.x*Math.cos(p.yaw)+f.z*Math.sin(p.yaw))*scale+p.x,f.y*scale,(f.z*Math.cos(p.yaw)-f.x*Math.sin(p.yaw))*scale+p.z]);if(previous)for(let j=0;j<coordinates.length;j+=3)worst=Math.max(worst,Math.hypot(...coordinates.slice(j,j+3).map((v,k)=>v-previous[j+k])));previous=coordinates;}
 results.push({direction,turn,speed,phase,maxTargetStep:worst,pass:worst<.001});
}
const report={subdivisions,secondsPerSample:1/120/subdivisions,scope:'Gait targets from real Match movement steps across 8 direction inputs, thresholds and wraps, both teams; no ball contact or full-match coverage',pass:results.every(r=>r.pass),results};fs.writeFileSync('reports/human-subframe.json',JSON.stringify(report,null,2));console.log({cases:results.length,pass:report.pass,maxStep:Math.max(...results.map(r=>r.maxTargetStep))});
