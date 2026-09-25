export const SKILLS={
 'elastico':{name:'엘라스티코',duration:.42,events:[.08,.22]},
 'drag-back':{name:'드래그 백',duration:.56,events:[.10,.34]},
 'ball-roll':{name:'볼 롤',duration:.48,events:[.13,.32]},
 'nutmeg':{name:'방향 넛메그',duration:.4,events:[.10,.24]},
 'heel-flick':{name:'힐 플릭',duration:.46,events:[.09,.26]},
 'drag-to-heel':{name:'드래그 투 힐',duration:.6,events:[.12,.38]},
 'step-over':{name:'스텝 오버',duration:.48,events:[.19,.32]},
 'roulette':{name:'마르세유 룰렛',duration:.64,events:[.12,.42]},
 'la-croqueta':{name:'라 크로케타',duration:.34,events:[.06,.19]},
 'rainbow-flick':{name:'레인보우 플릭',duration:.62,events:[.14,.36]}
};
export function skillAction(p,axis,id,requested){const n=Math.hypot(axis.x,axis.z)||1,alignment=(Math.sin(p.yaw)*axis.x+Math.cos(p.yaw)*axis.z)/n,skill=Object.hasOwn(SKILLS,requested)?requested:alignment<-.2?'drag-back':'elastico',config=SKILLS[skill];return {id,type:'feint',skill,foot:p.foot,elapsed:0,hit:false,duration:config.duration,exit:{x:axis.x/n,z:axis.z/n},events:config.events.map((at,i)=>({id:i?'touch-exit':'touch-setup',at,stage:i,done:false}))};}
export function skillImpulse(p,a,stage){const f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},s={x:f.z,z:-f.x},sign=a.foot==='left'?-1:1,last=stage===1;let forward=.55,side=sign*(last?-.8:.8),speed=last?3.5:1.7,lift=.015;
 if(a.skill==='drag-back'||a.skill==='drag-to-heel'){forward=last?.4:-1;side=last?sign*.6:0;speed=last?3.1:1.35;}
 if(a.skill==='ball-roll'){forward=.05;side=sign;speed=last?2.7:1.6;}
 if(a.skill==='nutmeg'){forward=last?1:.4;side=last?0:sign*.2;speed=last?5.2:1.0;}
 if(a.skill==='heel-flick'){forward=last?1:-.35;side=0;speed=last?4.2:1.1;lift=last?.65:.015;}
 if(a.skill==='step-over'){forward=.4;side=last?-sign:.1*sign;speed=last?3.8:.7;}
 // Roulette: the sole drags the ball back across the body during the spin, the other foot pulls it on.
 if(a.skill==='roulette'){forward=last?.6:-.55;side=last?-sign*.5:-sign*.45;speed=last?3.3:1.25;}
 // La croqueta: the inside of one foot slides the ball across to the other, which plays it past.
 if(a.skill==='la-croqueta'){forward=last?.9:.2;side=last?-sign*.25:-sign;speed=last?4.2:2.1;}
 // Rainbow flick: rolled back up the calf, then heeled over the head to drop ahead of the player.
 if(a.skill==='rainbow-flick'){forward=last?1:-.5;side=0;speed=last?5.1:.9;lift=last?6.4:.03;}
 const aim=last&&a.exit?a.exit:{x:f.x*forward+s.x*side,z:f.z*forward+s.z*side};return {aim,speed,lift};
}
export function applySkillPose(pose,a){const config=SKILLS[a.skill];if(!config)return;const u=Math.min(1,a.elapsed/config.duration),w=Math.sin(u*Math.PI),arc=Math.sin(u*Math.PI*2),i=a.foot==='left'?0:1,sign=i?1:-1,leg=pose.legs[i];pose.state='feint';pose.hipY-=.035*w;pose.torso[2]=-sign*arc*.16;pose.arms[0].upper[2]=-.4;pose.arms[1].upper[2]=.4;pose.contacts[i]=0;
 if(a.skill==='elastico'){leg.upper[0]=-.28*w;leg.upper[2]=sign*arc*.3;leg.lower[0]=.4*w;pose.feet[i][1]=sign*arc*.5;}
 if(a.skill==='drag-back'||a.skill==='drag-to-heel'){leg.upper[0]=-.45*w+Math.max(0,u-.5)*.8;leg.lower[0]=.45*w;pose.feet[i][0]=-.25*w;pose.torso[0]=-.08*w;}
 if(a.skill==='ball-roll'){leg.upper[0]=-.28*w;leg.upper[2]=sign*(.2-u*.45);leg.lower[0]=.25;pose.feet[i][1]=sign*.55;}
 if(a.skill==='nutmeg'){leg.upper[0]=-.45*w;leg.lower[0]=.35*w;pose.torso[0]=.18*w;}
 if(a.skill==='heel-flick'){leg.upper[0]=-.15*w;leg.lower[0]=1.05*w;pose.legs[1-i].upper[0]=-.2*w;pose.feet[i][0]=-.2*w;}
 if(a.skill==='step-over'){leg.upper[0]=-.42*w;leg.upper[2]=sign*arc*.4;leg.lower[0]=.55*w;pose.feet[i][1]=sign*.7*arc;}
 if(a.skill==='roulette'){
  // A full turn of the body toward the touching foot's side, sole on the ball in each half.
  const spin=smooth((u-.08)/.8),first=Math.sin(Math.PI*Math.min(1,u/.5)),second=u>.45?Math.sin(Math.PI*Math.min(1,(u-.45)/.55)):0,other=pose.legs[1-i];
  pose.hips[1]=-sign*Math.PI*2*spin;pose.torso[1]=sign*.2*Math.sin(Math.PI*spin);pose.torso[0]=.14;pose.hipY-=.03;pose.contacts=[0,0];
  leg.upper[0]=-.4*first;leg.lower[0]=.45*first;pose.feet[i][0]=-.35*first;other.upper[0]=-.38*second;other.lower[0]=.45*second;pose.feet[1-i][0]=-.35*second;
  pose.arms[0].upper=[-.3,0,-.75];pose.arms[1].upper=[-.3,0,.75];
 }
 if(a.skill==='la-croqueta'){
  // One inside-foot push across the body, caught and played on by the other foot; hips sway with it.
  const first=Math.sin(Math.PI*Math.min(1,u/.5)),second=u>.4?Math.sin(Math.PI*Math.min(1,(u-.4)/.6)):0,other=pose.legs[1-i];
  leg.upper[0]=-.32*first;leg.upper[1]=sign*.6*first;leg.upper[2]=sign*.42*first;leg.lower[0]=.35*first;pose.feet[i][1]=sign*.8*first;
  other.upper[0]=-.36*second;other.upper[1]=-sign*.6*second;other.upper[2]=-sign*.38*second;other.lower[0]=.35*second;pose.feet[1-i][1]=-sign*.8*second;
  pose.hips[2]=sign*.16*(first-second);pose.torso[2]=-sign*.2*(first-second);pose.torso[0]=.12;pose.hipY-=.05;pose.arms[0].upper=[-.25,0,-.55-.25*first];pose.arms[1].upper=[-.25,0,.55+.25*second];
 }
 if(a.skill==='rainbow-flick'){
  // Roll the ball back, then the heel kicks up behind the body and flicks it over the head.
  const roll=Math.sin(Math.PI*Math.min(1,u/.35)),flick=u>.3?Math.sin(Math.PI*Math.min(1,(u-.3)/.5)):0,other=pose.legs[1-i];
  leg.upper[0]=-.3*roll+.55*flick;leg.lower[0]=.3*roll+2.1*flick;pose.feet[i][0]=-.3*roll+.6*flick;
  other.lower[0]+=.2*flick;pose.torso[0]=.12+.3*flick;pose.head[0]=.15*flick;pose.hipY-=.03+.03*flick;
  pose.arms[0].upper=[-.2,0,-.5-.4*flick];pose.arms[1].upper=[-.2,0,.5+.4*flick];
 }
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
