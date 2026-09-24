import * as THREE from 'three';
import {clamp} from './config.js';
export class MatchCamera{
 constructor(camera){this.camera=camera;this.target=new THREE.Vector3();this.position=new THREE.Vector3();this.look=new THREE.Vector3();this.initial=false;}
 update(match,mode,dt,time){const c=this.camera;if(match.state==='menu'){this.position.set(3.4+Math.sin(time*.12)*.18,2.15,30.2);this.look.set(-1.55,1.08,24.7);c.position.lerp(this.position,1-Math.exp(-dt*3));this.target.lerp(this.look,1-Math.exp(-dt*3));c.lookAt(this.target);return;}
 const b=match.physics.ball.position,p=match.controlled,dx=b.x-p.x,dz=b.z-p.z,spread=Math.hypot(dx,dz);let x=clamp(b.x*.67+p.x*.33+match.physics.ball.velocity.x*.2,-42,42),z=clamp(b.z*.6+p.z*.4,-25,25);const extra=clamp(spread*.25,0,12);
 if(mode===1){this.position.set(x*.65,68,z*.3+47);this.look.set(x*.65,0,z*.3);}
 else if(mode===2){this.position.set(x-3,9+extra,z+13+extra);this.look.set(x,0,z);}
 else {this.position.set(x,30+extra,z+36+extra);this.look.set(x,0,z-2);}
 const alpha=1-Math.exp(-dt*3);c.position.lerp(this.position,alpha);this.target.lerp(this.look,alpha);c.lookAt(this.target);}
}
