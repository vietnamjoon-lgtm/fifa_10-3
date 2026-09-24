import {Quaternion,Vector3} from '../vendor/three.module.js';
const identity=new Quaternion();
export function quaternionLog(q){const sign=q.w<0?-1:1,x=q.x*sign,y=q.y*sign,z=q.z*sign,n=Math.hypot(x,y,z);return n<1e-8?new Vector3():new Vector3(x,y,z).multiplyScalar(2*Math.atan2(n,q.w*sign)/n);}
export function quaternionExp(v){const angle=v.length();return angle<1e-8?new Quaternion():new Quaternion().setFromAxisAngle(v.clone().multiplyScalar(1/angle),angle);}
export function decayOffset(position,velocity,time,lambda=24){return position.clone().addScaledVector(velocity.clone().addScaledVector(position,lambda),time).multiplyScalar(Math.exp(-lambda*time));}
// Preserve angular position and velocity on a state transition, then decay the offset.
export class InertialJoint{
 constructor(){this.previous=null;this.output=null;this.velocity=new Vector3();this.offset=new Vector3();this.offsetVelocity=new Vector3();this.age=1;this.key=null;}
 sample(target,key,dt){dt=Math.max(.001,Math.min(dt,.1));if(!this.previous){this.previous=target.clone();this.output=target.clone();this.key=key;return target;}
  const targetVelocity=quaternionLog(target.clone().multiply(this.previous.clone().invert())).multiplyScalar(1/dt);
  if(key!==this.key){this.offset=quaternionLog(this.output.clone().multiply(target.clone().invert()));this.offsetVelocity=this.velocity.clone().sub(targetVelocity).clampLength(0,24);this.age=0;this.key=key;}
  const correction=this.age<.5?quaternionExp(decayOffset(this.offset,this.offsetVelocity,this.age)):identity;
  const next=correction.clone().multiply(target).normalize();this.velocity=quaternionLog(next.clone().multiply(this.output.clone().invert())).multiplyScalar(1/dt).clampLength(0,30);this.output.copy(next);this.previous.copy(target);this.age+=dt;return next;
 }
}
