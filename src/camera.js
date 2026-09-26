import * as THREE from 'three';
import {clamp} from './config.js';
// Critically damped spring (SmoothDamp). Frame-rate independent, never overshoots its
// target and carries velocity, so a new target eases in instead of snapping the view.
export function smoothDamp(state,key,target,smoothTime,dt,maxSpeed=Infinity){
 const velocity=key+'V',omega=2/Math.max(1e-4,smoothTime),x=omega*dt,decay=1/(1+x+.48*x*x+.235*x*x*x);
 const current=state[key],limit=maxSpeed*smoothTime,change=clamp(current-target,-limit,limit),goal=current-change;
 const temp=((state[velocity]||0)+omega*change)*dt;state[velocity]=((state[velocity]||0)-omega*temp)*decay;
 let next=goal+(change+temp)*decay;
 if((target-current>0)===(next>target)){next=target;state[velocity]=0;}
 return state[key]=next;
}
const smoothstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
// Tuning for the broadcast (mode 0) view. Measured with tools/camera-metrics.mjs.
export const BROADCAST={
 // Follow the ball slightly late, like a human operator; control switches re-frame twice as fast.
 focusTime:.42,focusMaxSpeed:34,depthTime:1,playerWeight:.2,switchTime:.8,switchScale:.5,
 // Look ahead ~0.5 s along the (smoothed) ball velocity.
 velocityTime:.3,lead:.5,leadMaxX:9,leadMaxZ:3.5,
 // Gantry height and set-back; x dolly < 1 pans slightly towards each goal. Wide spreads crane up/back.
 height:19.5,back:31,dolly:.86,pullFrom:12,pullRate:.16,pullMax:6,
 // Zoom: out for fast balls (counters, long passes), in near either penalty area. Degrees.
 fov:43,fovFast:5.5,fovBox:-4.5,fovMin:36,fovMax:54,fovTime:.9,fovMaxRate:7,
 // Pan limits in deg/s and deg/s^2: no sudden whip pans.
 maxTurn:32,maxTurnAccel:110,
 // Framing windows: ball/controlled player stay inside 70% of the width; depth limits in metres.
 safeX:.7,ballNear:9,ballFar:14,playerNear:11.5,playerFar:17,depthSpread:20,depthZoom:.45
};
const forward=new THREE.Vector3(),wanted=new THREE.Vector3(),axis=new THREE.Vector3(),rotation=new THREE.Quaternion();
export class MatchCamera{
 constructor(camera){this.camera=camera;this.baseFov=camera.fov;this.target=new THREE.Vector3();this.position=new THREE.Vector3();this.look=new THREE.Vector3();this.lead=new THREE.Vector2();this.initial=false;
  this.focus={x:0,z:0,xV:0,zV:0};this.ballVelocity={x:0,z:0,xV:0,zV:0};this.zoom={fov:camera.fov,fovV:0};this.turnSpeed=0;this.direction=new THREE.Vector3(0,-.5,-1).normalize();this.broadcast=false;}
 update(match,mode,dt,time){const c=this.camera;const step=Math.min(Math.max(dt,0),.1);
 if(match.state==='menu'){this.position.set(3.4+Math.sin(time*.12)*.18,2.15,30.2);this.look.set(-2.75,1.12,24.7);c.position.lerp(this.position,1-Math.exp(-dt*3));this.target.lerp(this.look,1-Math.exp(-dt*3));this.setFov(this.baseFov,step,true);c.lookAt(this.target);c.getWorldDirection(this.direction);this.broadcast=false;this.initial=false;this.lastState='menu';return;}
 const b=match.physics.ball.position,p=match.controlled,dx=b.x-p.x,dz=b.z-p.z,spread=Math.hypot(dx,dz),v=match.physics.ball.velocity;
 // Smooth and bound velocity look-ahead so a kick or rebound cannot throw the view.
 const leadAlpha=1-Math.exp(-Math.min(dt,.1)*2.8);
 this.lead.x+=(clamp(v.x*.13,-2.8,2.8)-this.lead.x)*leadAlpha;
 this.lead.y+=(clamp(v.z*.10,-1.8,1.8)-this.lead.y)*leadAlpha;
 const x=clamp(b.x*.68+p.x*.32+this.lead.x,-41,41),z=clamp(b.z*.65+p.z*.35+this.lead.y,-25,25),extra=clamp((spread-8)*.19,0,8);
 let broadcast=false,fov=this.baseFov;
 if(match.setPiece&&['free','penalty'].includes(match.setPiece.kind)){const d=(match.setPiece.team===0?1:-1)*(match.half===1?1:-1);const penalty=match.setPiece.kind==='penalty';this.position.set(b.x-d*(penalty?8:12),penalty?4.5:6.5,b.z);this.look.set(penalty?d*52.5:b.x+d*13,penalty?.9:.6,match.setPiece.aimZ||0);}
 else if(match.setPiece?.kind==='corner'&&mode===0){
  // Frame the delivery and the receiving area together, including either touchline.
  const end=Math.sign(b.x)||1,centreZ=b.z*.4;
  // Move infield so the near floodlight tower cannot cover the kicker/goal.
  this.position.set(end*30,38,centreZ+43);this.look.set(end*43,.35,centreZ);
 }
 else if(mode===1){this.position.set(x*.65,68,z*.3+47);this.look.set(x*.65,0,z*.3);}
 else if(mode===2){this.position.set(x-3,9+extra,z+13+extra);this.look.set(x,0,z);}
 else {broadcast=true;fov=this.broadcastFraming(b,p,v,step);}
 this.broadcast=broadcast;
 // Coming from the menu is a cut, as in a real broadcast: no long swoop across the stadium.
 if(this.lastState==='menu'){this.lastState=match.state;c.position.copy(this.position);this.target.copy(this.look);this.setFov(fov,step,true);c.lookAt(this.target);c.getWorldDirection(this.direction);this.turnSpeed=0;return;}
 this.lastState=match.state;
 // Broadcast targets are already spring-smoothed, so follow them closely; other views
 // keep their original exponential tracking. Large jumps stay speed-limited.
 const alpha=1-Math.exp(-step*(broadcast?12:3));
 const distance=c.position.distanceTo(this.position),move=Math.min(alpha,distance?28*step/distance:alpha);
 // While a long move is speed-limited, advance the look target by the same fraction so the
 // pan stays monotonic instead of swinging past and back.
 c.position.lerp(this.position,move);this.target.lerp(this.look,distance>1.5?Math.max(move,alpha*.25):alpha);
 this.setFov(fov,step);this.turnLimited(broadcast?BROADCAST.maxTurn:90,broadcast?BROADCAST.maxTurnAccel:360,step);}
 // Ball-led framing: damped focus, velocity look-ahead, speed/box zoom, controlled player kept in frame.
 broadcastFraming(b,p,v,step){const B=BROADCAST,f=this.focus,bv=this.ballVelocity,aspect=this.camera.aspect||16/9,range=Math.hypot(B.back,B.height);
  if(!this.initial){f.x=b.x;f.z=b.z;f.xV=f.zV=0;this.initial=true;}
  smoothDamp(bv,'x',v.x||0,B.velocityTime,step);smoothDamp(bv,'z',v.z||0,B.velocityTime,step);
  const speed=Math.hypot(bv.x,bv.z);
  // Penalty-area proximity: 1 inside either box, fading out over 9 m.
  const outside=Math.max(36-Math.abs(b.x),Math.abs(b.z)-20.16,0),box=1-smoothstep(0,9,outside);
  let fov=B.fov+B.fovFast*smoothstep(10,24,speed)+B.fovBox*box;
  const halfWidth=value=>Math.tan(value*Math.PI/360)*aspect*range;
  const w=B.playerWeight;let fx=b.x+(p.x-b.x)*w+clamp(bv.x*B.lead,-B.leadMaxX,B.leadMaxX),fz=(b.z+(p.z-b.z)*w)*.8+clamp(bv.z*B.lead*.6,-B.leadMaxZ,B.leadMaxZ);
  // Keep the controlled player on screen: zoom out only as far as needed, then shift towards them.
  // The ball always wins; the player constraint is applied first and may be overridden.
  const needed=Math.abs(p.x-b.x)/(2*B.safeX)+2,depth=Math.abs(p.z-b.z);
  if(needed>halfWidth(fov))fov=Math.atan(needed/(aspect*range))*360/Math.PI;
  if(depth>B.depthSpread)fov+=(depth-B.depthSpread)*B.depthZoom;
  fov=clamp(fov,B.fovMin,B.fovMax);const safe=halfWidth(fov)*B.safeX,widen=fov/B.fov;
  if(p.x>fx+safe)fx=p.x-safe;else if(p.x<fx-safe)fx=p.x+safe;
  if(b.x>fx+safe)fx=b.x-safe;else if(b.x<fx-safe)fx=b.x+safe;
  // Screen bottom is nearer the camera than the top, so the depth window is asymmetric.
  const keep=(value,near,far)=>{if(value>fz+near*widen)fz=value-near*widen;else if(value<fz-far*widen)fz=value+far*widen;};
  keep(p.z,B.playerNear,B.playerFar);keep(b.z,B.ballNear,B.ballFar);
  fx=clamp(fx,-44,44);fz=clamp(fz,-24,24);
  // A control switch re-frames faster for a moment so the new player appears promptly.
  if(p.id!==undefined&&p.id!==this.controlledId){if(this.controlledId!==undefined)this.switchBoost=B.switchTime;this.controlledId=p.id;}
  this.switchBoost=Math.max(0,(this.switchBoost||0)-step);const quick=this.switchBoost>0?B.switchScale:1;
  smoothDamp(f,'x',fx,B.focusTime*quick,step,B.focusMaxSpeed);smoothDamp(f,'z',fz,B.focusTime*B.depthTime*quick,step,B.focusMaxSpeed*.6);
  // Wide ball-to-player spreads also crane the camera up and back (as the old view did).
  f.pull=f.pull||0;smoothDamp(f,'pull',clamp((Math.hypot(p.x-b.x,p.z-b.z)-B.pullFrom)*B.pullRate,0,B.pullMax),B.focusTime*2,step);
  this.position.set(f.x*B.dolly,B.height+f.pull*.7,f.z*.82+B.back+f.pull*.8);this.look.set(f.x,.4,f.z-1);
  return fov;}
 setFov(target,step,immediate=false){const c=this.camera,z=this.zoom;
  if(immediate){z.fov=target;z.fovV=0;}else smoothDamp(z,'fov',target,BROADCAST.fovTime,step,BROADCAST.fovMaxRate);
  if(Math.abs(c.fov-z.fov)>1e-4){c.fov=z.fov;c.updateProjectionMatrix();}}
 // Rotate towards the look target with bounded angular speed and acceleration.
 turnLimited(maxTurn,maxAccel,step){const c=this.camera;wanted.copy(this.target).sub(c.position).normalize();
  forward.copy(this.direction);const angle=Math.acos(clamp(forward.dot(wanted),-1,1));
  maxTurn*=1+3*smoothstep(.26,.8,angle);maxAccel*=1+3*smoothstep(.26,.8,angle); // 15-45 deg re-framings (set pieces) may turn faster
  // Trapezoidal profile: bounded speed, bounded acceleration and a braking ramp before the target.
  const allowed=Math.min(maxTurn,this.turnSpeed+maxAccel*step,Math.sqrt(2*maxAccel*angle*180/Math.PI)+maxAccel*step*.5)*Math.PI/180*step;
  if(angle>allowed&&angle>1e-6){axis.crossVectors(forward,wanted);if(axis.lengthSq()<1e-12)axis.set(0,1,0);rotation.setFromAxisAngle(axis.normalize(),allowed);forward.applyQuaternion(rotation).normalize();this.turnSpeed=allowed/Math.max(step,1e-6)*180/Math.PI;}
  else{forward.copy(wanted);this.turnSpeed=step>0?angle/step*180/Math.PI:0;}
  this.direction.copy(forward);c.lookAt(wanted.copy(c.position).add(forward));}
}
