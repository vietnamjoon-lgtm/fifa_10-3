import * as CANNON from '../vendor/cannon-es.js';
import { FIELD, TUNING, clamp } from './config.js';
import {cleanGameplay} from './gameplay-settings.js';
export { FIELD };
export function createPhysics(options={}) {
  let tuning=cleanGameplay(options);
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 12;
  const turf = new CANNON.Material('turf'), leather = new CANNON.Material('leather'), metal = new CANNON.Material('post');
  const turfContact=new CANNON.ContactMaterial(turf, leather, { friction: .24, restitution: .56*tuning.ballBounce/100 });
  world.addContactMaterial(turfContact);
  world.addContactMaterial(new CANNON.ContactMaterial(metal, leather, { friction: .12, restitution: .72 }));
  const ground = new CANNON.Body({mass:0,material:turf,collisionFilterGroup:1});
  ground.addShape(new CANNON.Plane()); ground.quaternion.setFromEuler(-Math.PI/2,0,0); world.addBody(ground);
  const ball = new CANNON.Body({mass:.43,material:leather,shape:new CANNON.Sphere(FIELD.ballRadius),position:new CANNON.Vec3(0,.115,0),linearDamping:.012,angularDamping:.16,collisionFilterGroup:2,collisionFilterMask:5,allowSleep:true,sleepSpeedLimit:.035,sleepTimeLimit:.7});
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
    ball.angularVelocity.set(direction.z/n*speed/FIELD.ballRadius,curve,-direction.x/n*speed/FIELD.ballRadius);if(style==='knuckle')ball.angularVelocity.setZero();ball.wakeUp();
  }
  function step(dt) {
    const steps=Math.max(1,Math.ceil(ball.velocity.length()*dt/.08)),h=dt/steps;
    // Travel-limited substeps prevent a fast ball crossing the thin goalposts.
    for(let i=0;i<steps;i++){
      const v=ball.velocity,s=v.length();
      if(ball.position.y<FIELD.ballRadius+.025&&Math.abs(v.y)<.5){const f=Math.exp(-TUNING.rollingDrag*100/tuning.ballRoll*h);v.x*=f;v.z*=f;ball.angularVelocity.x=v.z/FIELD.ballRadius;ball.angularVelocity.z=-v.x/FIELD.ballRadius;}
      const drag=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2*s;
      ball.force.set(-drag*v.x,-drag*v.y,-drag*v.z);
      if(ball.position.y>.15){const w=ball.angularVelocity;ball.force.x+=clamp((w.y*v.z-w.z*v.y)*TUNING.magnus,-1.5,1.5);ball.force.y+=clamp((w.z*v.x-w.x*v.z)*TUNING.magnus*.08,-.5,.5);ball.force.z+=clamp((w.x*v.y-w.y*v.x)*TUNING.magnus,-1.5,1.5);}
      if(flightStyle==='knuckle'&&ball.position.y>.3){flightAge+=h;const wobble=Math.sin(flightAge*31)*Math.sin(flightAge*13)*Math.min(.14,s*.004),n=Math.hypot(v.x,v.z)||1;ball.force.x+=v.z/n*wobble;ball.force.z-=v.x/n*wobble;}
      world.step(h);
      // Exact half-space constraint for the flat pitch, including a step that first crosses it.
      // Only the incoming vertical velocity is reflected; no energy is added.
      if(ball.position.y<FIELD.ballRadius){ball.position.y=FIELD.ballRadius;if(ball.velocity.y<-.5)ball.velocity.y*=-turfContact.restitution;else if(ball.velocity.y<0)ball.velocity.y=0;}
    }
  }
  function configure(options){tuning=cleanGameplay(options);turfContact.restitution=.56*tuning.ballBounce/100;}
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
