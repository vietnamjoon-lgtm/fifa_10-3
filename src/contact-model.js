import {clamp,distance} from './config.js';

// +1 = the player's left: facing (sin yaw, cos yaw), left is (cos yaw, -sin yaw). This used to be
// mirrored ('left' at the player's right), matching an animation that drew 'left' on legs[0].
export const footSign=foot=>foot==='left'?1:-1;
export function logicalFoot(p,foot=p.action?.foot||p.foot||'right',yaw=p.yaw){
 const scale=clamp((p.height||1.81)/1.81,.9,1.1),side=footSign(foot)*.11*(p.build||1),forward=.54*scale;
 return {x:p.x+Math.sin(yaw)*forward+Math.cos(yaw)*side,y:.11,z:p.z+Math.cos(yaw)*forward-Math.sin(yaw)*side};
}
export function chooseKickFoot(p,ball,aim){
 const yaw=Math.atan2(aim.x,aim.z),preferred=p.foot||'right';
 const phase=((p.motionPhase||0)/(Math.PI*2))%1,speed=Math.hypot(p.vx||0,p.vz||0);const cost=foot=>distance(logicalFoot(p,foot,yaw),ball)+(foot===preferred?0:.09)+(speed>.5&&((phase+(foot==='left'?0:.5))%1)<.5?.035:0);
 return cost('left')<cost('right')?'left':'right';
}
export function predictContact(p,b,v,maxTime=.6){
 const dx=b.x-p.x,dz=b.z-p.z,rvx=v.x-p.vx,rvz=v.z-p.vz;
 const t=clamp(-(dx*rvx+dz*rvz)/(rvx*rvx+rvz*rvz||1),0,maxTime);
 return {time:t,distance:Math.hypot(dx+rvx*t,dz+rvz*t),height:b.y+v.y*t-4.905*t*t};
}
