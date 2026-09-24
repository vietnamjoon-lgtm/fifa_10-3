import * as CANNON from '../vendor/cannon-es.js';
import { FIELD, TUNING } from './config.js';
import {cleanGameplay} from './gameplay-settings.js';
export { FIELD };
// Ground roll: dv/dt = -(AIR*v^2 + b*v + c). The constant term is turf rolling resistance,
// the linear term is grass drag and the quadratic term is air drag. Closed forms keep the
// simulation and every trajectory prediction on the same curve.
const AIR=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2/.43;
const MAGNUS=.5*TUNING.airDensity*Math.PI*FIELD.ballRadius**3;
function roll(scale){const a=AIR,b=TUNING.rollDamping*scale,c=TUNING.rollResistance*scale,shift=b/(2*a),disc=b*b-4*a*c;
 if(disc<-1e-9){const w=Math.sqrt(-disc)/(2*a),phase=v=>Math.atan((v+shift)/w);return {a,b,shift,time:(v0,v)=>(phase(v0)-phase(v))/(a*w),speed:(v0,t)=>w*Math.tan(phase(v0)-a*w*t)-shift,travel:(v0,t)=>Math.log(Math.cos(phase(v0)-a*w*t)/Math.cos(phase(v0)))/a-shift*t};}
 const w=Math.sqrt(Math.max(disc,1e-9))/(2*a),phase=v=>.5*Math.log((v+shift+w)/(v+shift-w));
 return {a,b,shift,time:(v0,v)=>(phase(v)-phase(v0))/(a*w),speed:(v0,t)=>w/Math.tanh(phase(v0)+a*w*t)-shift,travel:(v0,t)=>Math.log(Math.sinh(phase(v0)+a*w*t)/Math.sinh(phase(v0)))/a-shift*t};
}
const rollScale=ballRoll=>100/(ballRoll||100);
/** Speed and distance of a rolling ball after t seconds on the pitch. */
export function rollAfter(speed,t,ballRoll=100){if(!(speed>0)||!(t>0))return {speed:Math.max(0,speed||0),travel:0};const m=roll(rollScale(ballRoll)),stop=m.time(speed,0);if(t>=stop)return {speed:0,travel:m.travel(speed,stop)};return {speed:Math.max(0,m.speed(speed,t)),travel:m.travel(speed,t)};}
/** Distance rolled while slowing from `speed` to `arrival`. */
export function rollDistance(speed,arrival=0,ballRoll=100){if(!(speed>arrival))return 0;const m=roll(rollScale(ballRoll));return m.travel(speed,m.time(speed,Math.max(0,arrival)));}
/** Launch speed that rolls `distance` metres and still arrives at `arrival` m/s. */
export function rollLaunchSpeed(distance,arrival=0,ballRoll=100){let lo=Math.max(0,arrival),hi=80;if(!(distance>0))return lo;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(rollDistance(mid,arrival,ballRoll)<distance)lo=mid;else hi=mid;}return (lo+hi)/2;}
/** Approximate sideways bend (m) of a lofted kick with side spin `curve` over `distance`. */
export function curveDrift(speed,curve,distance){if(!curve||!(speed>0)||!(distance>0))return 0;const t=distance/(speed*.85),force=Math.min(MAGNUS*Math.abs(curve)*speed,.5*TUNING.airDensity*Math.PI*FIELD.ballRadius**2*TUNING.liftCoefficientMax*speed*speed);return Math.min(distance*.2,.375*force/.43*t*t);}
export function createPhysics(options={}) {
  let tuning=cleanGameplay(options);
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 12;
  const turf = new CANNON.Material('turf'), leather = new CANNON.Material('leather'), metal = new CANNON.Material('post');
  // The pitch is resolved analytically in step(); the plane stays out of the ball's collision mask.
  let restitution=TUNING.turfRestitution*tuning.ballBounce/100;
  world.addContactMaterial(new CANNON.ContactMaterial(metal, leather, { friction: .12, restitution: .72 }));
  const ground = new CANNON.Body({mass:0,material:turf,collisionFilterGroup:8});
  ground.addShape(new CANNON.Plane()); ground.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(ground);
  const ball = new CANNON.Body({mass:.43,material:leather,shape:new CANNON.Sphere(FIELD.ballRadius),position:new CANNON.Vec3(0,.115,0),linearDamping:0,angularDamping:.16,collisionFilterGroup:2,collisionFilterMask:5,allowSleep:true,sleepSpeedLimit:.035,sleepTimeLimit:.7});
  world.addBody(ball);
  function box(x,y,z,hx,hy,hz,material=metal) {
    const b=new CANNON.Body({mass:0,material,position:new CANNON.Vec3(x,y,z),collisionFilterGroup:1}); b.addShape(new CANNON.Box(new CANNON.Vec3(hx,hy,hz))); world.addBody(b); return b;
  }
  for(const s of [-1,1]) {
    for(const z of [-3.72,3.72]) box(s*52.5,1.22,z,.06,1.22,.06);
    box(s*52.5,2.50,0,.06,.06,3.78);
    // Flexible net approximated with low-restitution, invisible static panels.
    const net=new CANNON.Material('net'); world.addContactMaterial(new CANNON.ContactMaterial(net,leather,{friction:.8,restitution:.12}));
    box(s*54.85,1.25,0,.035,1.25,3.78,net);
    box(s*53.67,1.25,-3.8,1.17,1.25,.035,net); box(s*53.67,1.25,3.8,1.17,1.25,.035,net);
    box(s*53.67,2.55,0,1.17,.035,3.8,net);
  }
  let flightStyle=null,flightAge=0;
  function reset(x=0,z=0,y=.115) {flightStyle=null;flightAge=0; ball.position.set(x,y,z); ball.previousPosition.copy(ball.position);ball.interpolatedPosition.copy(ball.position);ball.velocity.setZero();ball.angularVelocity.setZero();ball.force.setZero();ball.torque.setZero();ball.quaternion.set(0,0,0,1);ball.wakeUp(); }
  function kick(direction,speed,lift=0,curve=0,style=null) {flightStyle=style;flightAge=0;
    const n=Math.hypot(direction.x,direction.z)||1;
    const desired=new CANNON.Vec3(direction.x/n*speed,lift,direction.z/n*speed);
    const impulse=desired.vsub(ball.velocity);impulse.scale(ball.mass,impulse);ball.applyImpulse(impulse);
    // A struck ball leaves the foot with side spin only; ground kicks start rolling at once.
    const rolling=lift<=1?speed/FIELD.ballRadius:0;
    ball.angularVelocity.set(direction.z/n*rolling,curve,-direction.x/n*rolling);if(style==='knuckle')ball.angularVelocity.setZero();ball.wakeUp();
  }
  function step(dt) {
    const steps=Math.max(1,Math.ceil(ball.velocity.length()*dt/.08)),h=dt/steps;
    // Travel-limited substeps prevent a fast ball crossing the thin goalposts.
    for(let i=0;i<steps;i++){
      const v=ball.velocity,s=v.length();
      const grounded=ball.position.y<FIELD.ballRadius+.025&&Math.abs(v.y)<.5;
      if(grounded){const g=Math.hypot(v.x,v.z),f=g>1e-6?rollAfter(g,h,tuning.ballRoll).speed/g:0;v.x*=f;v.z*=f;ball.angularVelocity.x=v.z/FIELD.ballRadius;ball.angularVelocity.z=-v.x/FIELD.ballRadius;}
      const drag=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2*s;
      // Rolling already includes air drag in rollAfter().
      ball.force.set(grounded?0:-drag*v.x,-drag*v.y,grounded?0:-drag*v.z);
      if(ball.position.y>.15){
        // Magnus force k(w x v) with k = rho*pi*r^3/2, so the lift coefficient equals the spin ratio r*w/v; it saturates near 0.35.
        const w=ball.angularVelocity;let fx=(w.y*v.z-w.z*v.y)*MAGNUS,fy=(w.z*v.x-w.x*v.z)*MAGNUS,fz=(w.x*v.y-w.y*v.x)*MAGNUS;
        const size=Math.hypot(fx,fy,fz),limit=.5*TUNING.airDensity*Math.PI*FIELD.ballRadius**2*TUNING.liftCoefficientMax*s*s;
        if(size>limit){const k=limit/size;fx*=k;fy*=k;fz*=k;}
        ball.force.x+=fx;ball.force.y+=fy;ball.force.z+=fz;
      }
      if(flightStyle==='knuckle'&&ball.position.y>.3){flightAge+=h;const wobble=Math.sin(flightAge*31)*Math.sin(flightAge*13)*Math.min(.14,s*.004),n=Math.hypot(v.x,v.z)||1;ball.force.x+=v.z/n*wobble;ball.force.z-=v.x/n*wobble;}
      world.step(h);
      // Exact half-space constraint for the flat pitch, including a step that first crosses it.
      // A bounce reflects part of the vertical speed. Turf friction then reduces the contact-point slip
      // (hollow sphere, I=2/3 m r^2), so a ball without topspin checks up on landing. No energy is added.
      if(ball.position.y<FIELD.ballRadius){ball.position.y=FIELD.ballRadius;const u=ball.velocity;
        if(u.y<-.5){const impact=-u.y,w=ball.angularVelocity,r=FIELD.ballRadius;u.y=impact*restitution;
          const sx=u.x+r*w.z,sz=u.z-r*w.x,slip=Math.hypot(sx,sz);
          if(slip>1e-6){const dv=Math.min(TUNING.turfFriction*(1+restitution)*impact,.4*slip),dx=-dv*sx/slip,dz=-dv*sz/slip;u.x+=dx;u.z+=dz;w.x-=1.5*dz/r;w.z+=1.5*dx/r;}}
        else if(u.y<0)u.y=0;}
    }
  }
  function configure(options){tuning=cleanGameplay(options);restitution=TUNING.turfRestitution*tuning.ballBounce/100;}
  return {world,ball,reset,kick,step,configure};
}
export function detectGoal(previous,current) {
  const line=FIELD.halfLength+FIELD.ballRadius;
  for(const side of [-1,1]) {
    if(previous.x*side<=line&&current.x*side>line){
      const t=(side*line-previous.x)/(current.x-previous.x);
      const z=previous.z+(current.z-previous.z)*t,y=previous.y+(current.y-previous.y)*t;
      if(Math.abs(z)<FIELD.goalHalf-FIELD.ballRadius&&y<FIELD.goalHeight-FIELD.ballRadius&&y>=FIELD.ballRadius*.5)return side===1?0:1;
    }
  }
  return -1;
}
