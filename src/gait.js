import {bodyMetrics} from './body-shape.js';
import {clamp} from './config.js';
import {locomotionCadence,stanceFraction} from './motion-planner.js';
const smooth=t=>t*t*(3-2*t);
// Match stance-foot travel to actual ground speed; sprinting has a flight phase.
export function gaitTargets(p,phase){
 const speed=Math.hypot(p.vx||0,p.vz||0),m=bodyMetrics(p),cycles=locomotionCadence(speed,p.motionStyle,p)/(2*Math.PI),stance=stanceFraction(speed),stride=cycles?Math.min(.46*m.leg,speed*stance/(2*cycles*m.scale)):0;
 const yaw=p.yaw||0,forward=speed?((p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw))/speed:1,side=speed?((p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw))/speed:0;
 const hipY=Math.min(.885-Math.min(speed/8,1)*.035,.075+.075+Math.sqrt(Math.max(.1,(m.upperLeg+m.lowerLeg-.005)**2-stride**2))-m.hipOffset);
 const feet=[],contacts=[];for(let i=0;i<2;i++){const cycle=((phase/(2*Math.PI)+i*.5)%1+1)%1,planted=speed<.04||cycle<stance,t=planted?cycle/stance:(cycle-stance)/(1-stance),travel=planted?stride*(1-2*t):stride*(2*smooth(t)-1),lift=planted?0:Math.sin(t*Math.PI)*clamp(.09+speed*.024,0,.27);contacts.push(planted?1:0);feet.push({x:(i===0?-1:1)*m.hipX+side*travel,y:.075+lift,z:forward*travel});}
 return {feet,contacts,hipY,metrics:m};
}
