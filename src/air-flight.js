import {FIELD,TUNING,clamp} from './config.js';
const drag=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2/.43;
const magnus=.5*TUNING.airDensity*Math.PI*FIELD.ballRadius**3/.43;
// Predict free flight only: same drag, side-spin cap and spin decay as the ball.
// Used once at impact; never steers a ball already in flight.
export function sampleFlight(speed,lift,time,height=.11,spin=0){
 let x=0,y=height,z=0,vx=speed,vy=lift,vz=0,w=spin;const steps=Math.ceil(time*240),dt=time/steps;
 for(let i=0;i<steps;i++){const s=Math.hypot(vx,vy,vz);let fx=w*vz*magnus,fz=-w*vx*magnus;const n=Math.hypot(fx,fz),limit=.5*TUNING.airDensity*Math.PI*FIELD.ballRadius**2*TUNING.liftCoefficientMax*s*s/.43;if(n>limit){fx*=limit/n;fz*=limit/n;}vx+=(-drag*s*vx+fx)*dt;vy+=(-9.81-drag*s*vy)*dt;vz+=(-drag*s*vz+fz)*dt;x+=vx*dt;y+=vy*dt;z+=vz*dt;w*=Math.pow(.84,dt);}
 return {x,y,z,vx,vy,vz};
}
export function solveAirKick(distance,height,time,startHeight=.11,spin=0){
 let speed=distance/time,lift=(height-startHeight+4.905*time*time)/time;
 for(let i=0;i<12;i++){const p=sampleFlight(speed,lift,time,startHeight,spin);speed=clamp(speed+(distance-Math.hypot(p.x,p.z))/time*1.18,3,43);lift=clamp(lift+(height-p.y)/time*1.12,.05,17);}
 const p=sampleFlight(speed,lift,time,startHeight,spin);return {speed,lift,curve:spin,aimOffset:-Math.atan2(p.z,p.x),flightTime:time};
}
