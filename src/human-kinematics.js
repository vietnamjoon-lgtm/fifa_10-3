import {gaitTargets} from './gait.js';
// Same legacy-side contract on browser and server. Pure animation target, no scene.
const surfaces={instep:[0,.016,.085],inside:[.061,-.015,.071],outside:[-.061,-.015,.071],sole:[0,-.075,.073],toe:[0,-.036,.185]};
export function predictFoot(p,phase,foot='left'){
 const i=foot==='left'||foot==='R'||foot===0?0:1,gait=gaitTargets(p,phase),g=gait.feet[i],m=gait.metrics,yaw=p.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),world=([x,y,z])=>({x:(p.x||0)+(x*c+z*s)*m.scale,y:y*m.scale,z:(p.z||0)+(z*c-x*s)*m.scale});
 const position=world([g.x,g.y,g.z]);return {...position,anatomical:i===0?'R':'L',swing:!gait.contacts[i],surfaces:Object.fromEntries(Object.entries(surfaces).map(([name,v])=>[name,world([g.x+v[0]*(i===0?1:-1)*m.foot,g.y+v[1],g.z+v[2]*m.foot])]))};
}
// Swing/twist decomposition, evaluated before any limit enforcement. Diagnostic
// failures stay visible instead of silently clamping impossible source poses.
export function jointExcursion(q,axis=[1,0,0]){
 const dot=q.x*axis[0]+q.y*axis[1]+q.z*axis[2],length=Math.hypot(dot,q.w),twist=length>1e-9?2*Math.atan2(dot/length,q.w/length):0,wrapped=Math.atan2(Math.sin(twist),Math.cos(twist));
 return {twist:wrapped,swing:2*Math.acos(Math.min(1,Math.max(0,length)))};
}
export function jointViolations(rig){const failures=[],deg=180/Math.PI;for(let i=0;i<2;i++){for(const [name,bone,min,max]of [['knee',rig.legs[i].lower,-5,140],['elbow',rig.arms[i].lower,-150,0]]){const value=jointExcursion(bone.quaternion).twist*deg;if(value<min-.01||value>max+.01)failures.push({joint:name,side:i===0?'R':'L',degrees:value,min,max});}}return failures;}
export function bodyCenterOfMass(rig){
 const a=rig.comScratchA??=rig.root.position.clone(),b=rig.comScratchB??=rig.root.position.clone(),sum={x:0,y:0,z:0};let total=0;
 // Only the 13 controls contribute. Update them once, parent before child,
 // without traversing hidden faces or the 74-bone deformation hierarchy.
 const controls=rig.comControls??=[rig.hips,rig.torso,rig.head,...rig.arms.flatMap(arm=>[arm.upper,arm.lower]),...rig.legs.flatMap(leg=>[leg.upper,leg.lower,leg.foot])];
 rig.root.updateWorldMatrix(true,false);for(const bone of controls)bone.updateWorldMatrix(false,false);
 const add=(mass)=>{sum.x+=a.x*mass;sum.y+=a.y*mass;sum.z+=a.z*mass;total+=mass;};
 const segment=(first,last,mass,fraction=.5)=>{a.setFromMatrixPosition(first.matrixWorld);b.setFromMatrixPosition(last.matrixWorld);a.lerp(b,fraction);add(mass);};
 segment(rig.hips,rig.head,.497);segment(rig.head,rig.head,.081);
 for(let i=0;i<2;i++){
  const arm=rig.arms[i],leg=rig.legs[i],m=rig.bodyMetrics;segment(arm.upper,arm.lower,.028,.436);
  a.set(0,-(m?.lowerArm||.24)*.43,0).applyMatrix4(arm.lower.matrixWorld);add(.016);
  a.set(0,-(m?.lowerArm||.24)-.065*(m?.body.handSize||100)/100,0).applyMatrix4(arm.lower.matrixWorld);add(.006);
  segment(leg.upper,leg.lower,.100,.433);segment(leg.lower,leg.foot,.0465,.433);segment(leg.foot,leg.foot,.0145);
 }
 return {x:sum.x/total,y:sum.y/total,z:sum.z/total};
}
