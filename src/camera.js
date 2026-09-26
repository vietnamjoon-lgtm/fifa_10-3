import * as THREE from 'three';
import {clamp} from './config.js';
export class MatchCamera{
 constructor(camera){this.camera=camera;this.target=new THREE.Vector3();this.position=new THREE.Vector3();this.look=new THREE.Vector3();this.lead=new THREE.Vector2();this.initial=false;}
 update(match,mode,dt,time){const c=this.camera;if(match.state==='menu'){this.position.set(3.4+Math.sin(time*.12)*.18,2.15,30.2);this.look.set(-1.55,1.08,24.7);c.position.lerp(this.position,1-Math.exp(-dt*3));this.target.lerp(this.look,1-Math.exp(-dt*3));c.lookAt(this.target);return;}
 const b=match.physics.ball.position,p=match.controlled,dx=b.x-p.x,dz=b.z-p.z,spread=Math.hypot(dx,dz),v=match.physics.ball.velocity;
 // Smooth and bound velocity look-ahead so a kick or rebound cannot throw the view.
 const leadAlpha=1-Math.exp(-Math.min(dt,.1)*2.8);
 this.lead.x+=(clamp(v.x*.13,-2.8,2.8)-this.lead.x)*leadAlpha;
 this.lead.y+=(clamp(v.z*.10,-1.8,1.8)-this.lead.y)*leadAlpha;
 const x=clamp(b.x*.68+p.x*.32+this.lead.x,-41,41),z=clamp(b.z*.65+p.z*.35+this.lead.y,-25,25),extra=clamp((spread-8)*.19,0,8);
 if(match.setPiece&&['free','penalty'].includes(match.setPiece.kind)){const d=(match.setPiece.team===0?1:-1)*(match.half===1?1:-1);const penalty=match.setPiece.kind==='penalty';this.position.set(b.x-d*(penalty?8:12),penalty?4.5:6.5,b.z);this.look.set(penalty?d*52.5:b.x+d*13,penalty?.9:.6,match.setPiece.aimZ||0);}
 else if(match.setPiece?.kind==='corner'&&mode===0){
  // Frame the delivery and the receiving area together, including either touchline.
  const end=Math.sign(b.x)||1,centreZ=b.z*.4;
  // Move infield so the near floodlight tower cannot cover the kicker/goal.
  this.position.set(end*30,38,centreZ+43);this.look.set(end*43,.35,centreZ);
 }
 else if(mode===1){this.position.set(x*.65,68,z*.3+47);this.look.set(x*.65,0,z*.3);}
 else if(mode===2){this.position.set(x-3,9+extra,z+13+extra);this.look.set(x,0,z);}
 else {this.position.set(x,25+extra,z+30+extra);this.look.set(x,.35,z-1.2);}
 const step=Math.min(Math.max(dt,0),.1),alpha=1-Math.exp(-step*3);
 // Limit large switch/set-piece transitions, while retaining smooth exponential tracking.
 const distance=c.position.distanceTo(this.position),move=Math.min(alpha,distance?28*step/distance:alpha);
 c.position.lerp(this.position,move);this.target.lerp(this.look,alpha);c.lookAt(this.target);}
}
