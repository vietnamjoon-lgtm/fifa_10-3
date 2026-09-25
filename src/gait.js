import {bodyMetrics} from './body-shape.js';
import {clamp} from './config.js';
import {locomotionCadence,stanceFraction} from './motion-planner.js';
const smooth=t=>t*t*(3-2*t);
// The relative foot velocity at both ends of swing must match stance. A
// zero-relative-velocity smoothstep made the foot hit the turf at player speed.
const swingTravel=(t,stride,stance)=>{const s=smooth(t),tangent=-2*stride*(1-stance)/stance;return -stride+2*stride*s+tangent*(2*t*t*t-3*t*t+t);};
// Match stance-foot travel to actual ground speed; sprinting has a flight phase.
export function gaitTargets(p,phase){
 const speed=Math.hypot(p.vx||0,p.vz||0),m=bodyMetrics(p),cycles=locomotionCadence(speed,p.motionStyle,p)/(2*Math.PI),stance=stanceFraction(speed),stride=cycles?Math.min(.46*m.leg,speed*.22,speed*stance/(2*cycles*m.scale))*smooth(clamp((speed-.04)/.16,0,1)):0;
 const yaw=p.yaw||0,forward=speed?((p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw))/speed:1,side=speed?((p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw))/speed:0;
 let hipY=.898-.013*smooth(clamp(speed/.5,0,1))-Math.min(speed/8,1)*.025;
 const feet=[],contacts=[];for(let i=0;i<2;i++){const cycle=((phase/(2*Math.PI)+i*.5)%1+1)%1,planted=speed<.04||cycle<stance,t=planted?cycle/stance:(cycle-stance)/(1-stance),travel=planted?stride*(1-2*t):swingTravel(t,stride,stance),lift=planted?0:Math.sin(t*Math.PI)**2*clamp(.09+speed*.024,0,.27)*smooth(clamp(speed/.8,0,1));contacts.push(planted?1:0);feet.push({x:(i===0?-1:1)*m.hipX+side*travel,y:.075+lift,z:forward*travel});}
 for(let i=0;i<2;i++)if(contacts[i]){const f=feet[i],travel=Math.hypot(f.x-(i===0?-1:1)*m.hipX,f.z);hipY=Math.min(hipY,f.y+.075+Math.sqrt(Math.max(.1,(m.upperLeg+m.lowerLeg-.006)**2-travel**2))-m.hipOffset);}
 return {feet,contacts,hipY,metrics:m};
}
