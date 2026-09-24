import {bodyMetrics} from './body-shape.js';
// Rebuild bind positions before creating the weighted body so edited limbs stay attached.
export function configureBodyRig(rig,profile){const m=rig.bodyMetrics=bodyMetrics(profile);rig.root.scale.setScalar(m.scale);rig.hips.position.y=m.hipY;rig.head.position.y=1.585-m.hipY;
 for(const child of rig.head.children)child.scale.multiplyScalar(m.head);
 rig.arms.forEach((a,i)=>{a.upper.position.set((i===0?-1:1)*m.shoulderX,m.shoulderY-m.hipY,0);a.lower.position.y=-m.upperArm;});
 rig.legs.forEach((l,i)=>{l.upper.position.set((i===0?-1:1)*m.hipX,-.075,0);l.lower.position.y=-m.upperLeg;l.foot.position.y=-m.lowerLeg;for(const child of l.foot.children){child.position.x*=m.foot;child.position.z*=m.foot;child.scale.x*=m.foot;child.scale.z*=m.foot;}});
 for(const label of rig.details||[]){label.position.y=m.mapY(.91+label.position.y)-m.hipY;label.position.x*=m.width;label.position.z*=m.width*(profile.body?.chest||100)/100;label.scale.x*=m.width;}
 return m;
}
