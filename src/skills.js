export const SKILLS={
 'elastico':{name:'엘라스티코',duration:.42,events:[.08,.22]},
 'drag-back':{name:'드래그 백',duration:.56,events:[.10,.34]},
 'ball-roll':{name:'볼 롤',duration:.48,events:[.13,.32]},
 'nutmeg':{name:'방향 넛메그',duration:.4,events:[.10,.24]},
 'heel-flick':{name:'힐 플릭',duration:.46,events:[.09,.26]},
 'drag-to-heel':{name:'드래그 투 힐',duration:.6,events:[.12,.38]},
 'step-over':{name:'스텝 오버',duration:.48,events:[.19,.32]}
};
import {MOVE_BY_KEY} from './skill-moves.js';

/** An FC Online skill move (skill-moves.js) as a feint action: its touches, body turn and pace, played on `side`.
 * Yaw grows toward the player's left, so a turn to the right (+side) lowers it. */
function moveAction(p,axis,id,move){const n=Math.hypot(axis.x,axis.z)||1;
 return {id,type:'feint',skill:move.id,move:move.key,pose:move.pose,side:move.side,foot:move.side>0?'right':'left',elapsed:0,hit:false,duration:move.duration,pace:move.pace,air:!!move.air,
  turn:-(move.turn||0)*move.side*Math.PI/180,yaw0:p.yaw,exitToStick:!!move.exit,exit:{x:axis.x/n,z:axis.z/n},events:move.touches.map((t,i)=>({id:'touch-'+i,at:t[0],stage:i,done:false,spec:t}))};}

export function skillAction(p,axis,id,requested){if(MOVE_BY_KEY[requested])return moveAction(p,axis,id,MOVE_BY_KEY[requested]);const n=Math.hypot(axis.x,axis.z)||1,alignment=(Math.sin(p.yaw)*axis.x+Math.cos(p.yaw)*axis.z)/n,skill=Object.hasOwn(SKILLS,requested)?requested:alignment<-.2?'drag-back':'elastico',config=SKILLS[skill];return {id,type:'feint',skill,foot:p.foot,elapsed:0,hit:false,duration:config.duration,exit:{x:axis.x/n,z:axis.z/n},events:config.events.map((at,i)=>({id:i?'touch-exit':'touch-setup',at,stage:i,done:false}))};}
export function skillImpulse(p,a,stage){
 // A table move: forward/side are relative to where the player faces now (side +1 is the player's right, ↓ in the guide) (a turning move has already turned), and the
 // last touch of a move that exits goes where the stick points when it is played.
 const spec=a.events?.[stage]?.spec;
 if(spec){const [,forward,side,speed,lift]=spec,f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},s={x:-f.z,z:f.x},k=side*a.side,last=stage===a.events.length-1,stick=a.liveAxis,n=Math.hypot(stick?.x||0,stick?.z||0);
  const aim=last&&a.exitToStick&&n>.3?{x:stick.x/n,z:stick.z/n}:{x:f.x*forward+s.x*k,z:f.z*forward+s.z*k};const m=Math.hypot(aim.x,aim.z)||1;
  return {aim:{x:aim.x/m,z:aim.z/m},speed,lift};}
const f={x:Math.sin(p.yaw),z:Math.cos(p.yaw)},s={x:f.z,z:-f.x},sign=a.foot==='left'?-1:1,last=stage===1;let forward=.55,side=sign*(last?-.8:.8),speed=last?3.5:1.7,lift=.015;
 if(a.skill==='drag-back'||a.skill==='drag-to-heel'){forward=last?.4:-1;side=last?sign*.6:0;speed=last?3.1:1.35;}
 if(a.skill==='ball-roll'){forward=.05;side=sign;speed=last?2.7:1.6;}
 if(a.skill==='nutmeg'){forward=last?1:.4;side=last?0:sign*.2;speed=last?5.2:1.0;}
 if(a.skill==='heel-flick'){forward=last?1:-.35;side=0;speed=last?4.2:1.1;lift=last?.65:.015;}
 if(a.skill==='step-over'){forward=.4;side=last?-sign:.1*sign;speed=last?3.8:.7;}
 const aim=last&&a.exit?a.exit:{x:f.x*forward+s.x*side,z:f.z*forward+s.z*side};return {aim,speed,lift};
}
// Poses for table moves, by kind (legs[0] is on the player's right, so a move to the right uses it); `u` runs 0..1 over the move and every weight rises from and returns to 0, so the move
// eases in and out of the stride.
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
function tablePose(pose,a){const u=Math.min(1,a.elapsed/a.duration),w=Math.sin(u*Math.PI),arc=Math.sin(u*Math.PI*2),i=a.side>0?0:1,sign=i?1:-1,leg=pose.legs[i],other=pose.legs[1-i];
 pose.state='skill-'+a.pose;pose.hipY-=.035*w;pose.contacts[i]=0;pose.arms[0].upper[2]=-.35*w-.05;pose.arms[1].upper[2]=.35*w+.05;
 switch(a.pose){
  case 'step-over':case 'step-over-reverse':{const r=a.pose==='step-over'?1:-1;leg.upper[0]=-.42*w;leg.upper[2]=sign*r*arc*.42;leg.lower[0]=.55*w;pose.feet[i][1]=sign*r*.7*arc;pose.torso[2]=-sign*r*arc*.14;break;}
  case 'feint':pose.torso[2]=sign*arc*.22;pose.hips[2]=sign*arc*.08;leg.upper[2]=sign*w*.2;pose.hipY-=.02*w;break;
  case 'double-feint':{const a2=Math.sin(u*Math.PI*4);pose.torso[2]=sign*a2*.2;pose.hips[2]=sign*a2*.07;pose.hipY-=.03*w;break;}
  case 'drag':leg.upper[0]=-.45*w+Math.max(0,u-.5)*.8*w;leg.lower[0]=.45*w;pose.feet[i][0]=-.25*w;pose.torso[0]=-.08*w;break;
  case 'roll':leg.upper[0]=-.28*w;leg.upper[2]=sign*(.25-u*.5)*w;leg.lower[0]=.25*w;pose.feet[i][1]=sign*.55*w;break;
  case 'heel':leg.upper[0]=-.12*w;leg.lower[0]=1.05*w;other.upper[0]=-.18*w;pose.feet[i][0]=-.2*w;pose.torso[0]=.06*w;break;
  case 'lift':leg.upper[0]=-.55*w;leg.lower[0]=.5*w;pose.feet[i][0]=.35*w;pose.torso[0]=-.05*w;break;
  case 'rainbow':leg.upper[0]=.35*w;leg.lower[0]=1.3*w;other.lower[0]=.35*w;pose.torso[0]=.18*w;pose.head[0]=.12*w;break;
  case 'elastico':leg.upper[0]=-.28*w;leg.upper[2]=sign*arc*.32;leg.lower[0]=.4*w;pose.feet[i][1]=sign*arc*.55;pose.torso[2]=-sign*arc*.1;break;
  case 'roulette':leg.upper[0]=-.3*w;leg.lower[0]=.35*w;pose.feet[i][0]=-.2*w;other.upper[0]=.12*w;pose.torso[0]=.05*w;break;
  case 'scoop':leg.upper[0]=-.5*w;leg.lower[0]=.5*w;pose.feet[i][1]=sign*.6*w;pose.torso[2]=sign*.12*w;break;
  case 'rabona':leg.upper[0]=-.3*w;leg.upper[2]=-sign*.35*w;leg.lower[0]=.9*w;pose.torso[1]=sign*.25*w;break;
  case 'jump':{const j=Math.sin(Math.min(1,u*1.4)*Math.PI);pose.hipY+=.12*j;for(const l of pose.legs){l.upper[0]=-.35*j;l.lower[0]=.8*j;}pose.contacts=[0,0];break;}
  case 'juggle':{const k=Math.max(0,Math.sin(u*Math.PI*5));leg.upper[0]=-.5*k;leg.lower[0]=.4*k;pose.feet[i][0]=.25*k;pose.torso[0]=-.04;break;}
  case 'fake-step':leg.upper[0]=-.3*w;leg.lower[0]=.35*w;leg.upper[2]=sign*.15*arc;break;
  case 'side-step':pose.hips[2]=sign*.1*w;pose.torso[2]=-sign*.12*w;leg.upper[2]=sign*.25*w;other.upper[2]=sign*.1*w;break;
 }
}

export function applySkillPose(pose,a){if(a.move){tablePose(pose,a);return;}const config=SKILLS[a.skill];if(!config)return;const u=Math.min(1,a.elapsed/config.duration),w=Math.sin(u*Math.PI),arc=Math.sin(u*Math.PI*2),i=a.foot==='left'?0:1,sign=i?1:-1,leg=pose.legs[i];pose.state='feint';pose.hipY-=.035*w;pose.torso[2]=-sign*arc*.16;pose.arms[0].upper[2]=-.4;pose.arms[1].upper[2]=.4;pose.contacts[i]=0;
 if(a.skill==='elastico'){leg.upper[0]=-.28*w;leg.upper[2]=sign*arc*.3;leg.lower[0]=.4*w;pose.feet[i][1]=sign*arc*.5;}
 if(a.skill==='drag-back'||a.skill==='drag-to-heel'){leg.upper[0]=-.45*w+Math.max(0,u-.5)*.8;leg.lower[0]=.45*w;pose.feet[i][0]=-.25*w;pose.torso[0]=-.08*w;}
 if(a.skill==='ball-roll'){leg.upper[0]=-.28*w;leg.upper[2]=sign*(.2-u*.45);leg.lower[0]=.25;pose.feet[i][1]=sign*.55;}
 if(a.skill==='nutmeg'){leg.upper[0]=-.45*w;leg.lower[0]=.35*w;pose.torso[0]=.18*w;}
 if(a.skill==='heel-flick'){leg.upper[0]=-.15*w;leg.lower[0]=1.05*w;pose.legs[1-i].upper[0]=-.2*w;pose.feet[i][0]=-.2*w;}
 if(a.skill==='step-over'){leg.upper[0]=-.42*w;leg.upper[2]=sign*arc*.4;leg.lower[0]=.55*w;pose.feet[i][1]=sign*.7*arc;}
}
