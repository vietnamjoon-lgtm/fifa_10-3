import {bodyMetrics} from './body-shape.js';
import {clamp} from './config.js';
import {locomotionCadence,stanceFraction} from './motion-planner.js';
import {Euler,Matrix4,Quaternion,Vector3} from '../vendor/three.module.js';
const TAU=Math.PI*2,SOLE=.075,BALL=.12,HEEL=.076;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
// Small stable per-player differences so a team does not run in lockstep.
export function motionVariation(p){let h=(Math.imul((p.id??p.number??0)+1,2654435761)^0x5bd1e995)>>>0;const r=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296;};
 return {arm:.9+r()*.22,elbow:(r()-.5)*.24,lean:(r()-.5)*.05,bounce:.85+r()*.3,width:.9+r()*.2,idle:r()*TAU,stagger:r()<.5?1:-1};}
// Ground contact: a heel pivot after a walking heel strike, a flat foot, then a
// ball-of-foot pivot while the heel rises. The pivot point moves with the ground.
function stanceFoot(flat,tau,g){
 // The heel rise accelerates into toe-off, so the toe leaves the grass instead of dragging.
 const strike=g.strike*(1-smooth(tau/.16)),rise=clamp((tau-g.liftStart)/(1-g.liftStart),0,1),lift=rise*rise*g.toeOff,f=g.foot;
 if(strike>1e-4){const heel=flat-HEEL*f;return {a:heel+HEEL*f*Math.cos(strike)-SOLE*Math.sin(strike),y:HEEL*f*Math.sin(strike)+SOLE*Math.cos(strike),pitch:-strike};}
 const ball=flat+BALL*f;return {a:ball-BALL*f*Math.cos(lift)+SOLE*Math.sin(lift),y:BALL*f*Math.sin(lift)+SOLE*Math.cos(lift),pitch:lift};
}
function hermite(p0,p1,m0,m1,t,h){const t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*p0+(t3-2*t2+t)*h*m0+(-2*t3+3*t2)*p1+(t3-t2)*h*m1;}
// Piecewise cubic through [time,value] keys with given end slopes.
function spline(keys,s,v0,v1){let k=0;while(k<keys.length-2&&s>keys[k+1][0])k++;const slope=j=>j===0?v0:j===keys.length-1?v1:((keys[j+1][1]-keys[j][1])/(keys[j+1][0]-keys[j][0])+(keys[j][1]-keys[j-1][1])/(keys[j][0]-keys[j-1][0]))/2;
 const [t0,p0]=keys[k],[t1,p1]=keys[k+1];return hermite(p0,p1,slope(k),slope(k+1),(s-t0)/(t1-t0),t1-t0);}
// Foot targets in root space (unscaled rig units), hip height and pelvis motion.
function plan(p,phase,time,kin){
 const speed=Math.hypot(p.vx||0,p.vz||0),m=bodyMetrics(p),v=motionVariation(p),cycles=locomotionCadence(speed,p.motionStyle,p)/TAU,beta=stanceFraction(speed);
 const yaw=p.yaw||0,fw=speed>1e-4?((p.vx||0)*Math.sin(yaw)+(p.vz||0)*Math.cos(yaw))/speed:1,sd=speed>1e-4?((p.vx||0)*Math.cos(yaw)-(p.vz||0)*Math.sin(yaw))/speed:0;
 const run=smooth((speed-1.9)/1.3),sprint=smooth((speed-6.3)/2.1),forwardness=smooth((fw-.25)/.6),shape=run*forwardness,move=smooth((speed-.04)/.45);
 const defend=p.defending?1:0,keeper=p.role==='GK'?1:0,tight=p.closeControl||p.shield?1:0,carry=p.dribbleAim||p.dribbleStop?1:0,style=p.motionStyle||'balanced';
 const acc=clamp((kin.acceleration||0)/9,-1,1),omega=clamp(kin.turn||0,-9,9),bank=clamp(Math.atan(speed*omega/9.81)*.75,-.32,.32)*move;
 const u=speed/m.scale,accel=clamp(kin.acceleration||0,-20,20)/m.scale*move,period=cycles>1e-6?Math.min(2,1/cycles):0,Lg=m.leg,kTD=lerp(.52,.4,shape)-acc*.12;
 // Contact point relative to the hip, from the speed at touchdown and the travel since:
 // speeding up or braking inside one step no longer drags the planted foot.
 const flatAt=(since,elapsed)=>{const start=clamp(u-accel*since,0,u+2.5);return kTD*start*beta*period-Math.max(0,start*elapsed+.5*accel*elapsed*elapsed);},Ls=u*beta*period,aTD=kTD*Ls;
 // A planted foot stays put while the body turns over it.
 const spin=(x,z,angle)=>[x*Math.cos(angle)+z*Math.sin(angle),-x*Math.sin(angle)+z*Math.cos(angle)],turnSpin=t=>clamp(-omega*t,-.8,.8);
 // Heel and toe roll only happen along the foot; side and back steps stay flat-footed.
 const footRoll=smooth((fw-.1)/.5),g={foot:m.foot,strike:.26*(1-run)*footRoll,liftStart:lerp(.5,.36,run),toeOff:(lerp(.72,1,run)+sprint*.12)*footRoll};
 const width=lerp(lerp(.92,.6,run)-sprint*.08,1.9,defend*.9)*lerp(1,1.5,keeper)*v.width,rec=(.24+.04*clamp(speed,2.5,9))*Lg,reach=lerp(.06,.14,sprint);
 const sway=Math.sin(time*TAU/3.6+v.idle),c0=((phase/TAU)%1+1)%1,feet=[],contacts=[];
 for(let i=0;i<2;i++){const c=(c0+i*.5)%1,s=i===0?-1:1,since=Math.min(.8,c*period);let a,y,pitch,relax=0,flex=0,contact=1,angle=0,drift=0,sg=0;
  if(c<beta){({a,y,pitch}=stanceFoot(flatAt(since,since),c/beta,g));angle=turnSpin(since);drift=.5*u*omega*since*since;}
  else{sg=(c-beta)/(1-beta);const stance=beta*period,next=Math.max(0,u+accel*(1-c)*period),td=stanceFoot(kTD*next*beta*period,0,g),to=stanceFoot(flatAt(since,stance),1,g),eps=.02,pre=stanceFoot(flatAt(since,stance*(1-eps)),1-eps,g),ratio=(1-beta)/Math.max(beta,.05);contact=0;angle=turnSpin(stance)*(1-smooth(sg));drift=.5*u*omega*stance*stance*(1-smooth(sg));
   const walk=[[0,to.a,to.y],[.3,lerp(to.a,td.a,.25),SOLE+.09],[.6,lerp(to.a,td.a,.62),SOLE+.065],[.86,td.a+.012,td.y+.045],[1,td.a,td.y]];
   const runKeys=[[0,to.a,to.y],[.3,lerp(to.a,0,.25),rec],[.58,lerp(-.08,.02,sprint)*Lg,rec*lerp(.62,.7,sprint)],[.83,td.a+reach,SOLE+lerp(.08,.13,sprint)],[1,td.a,td.y]];
   const lift=(1-shape)*clamp((speed-2)*.03,0,.09)*(1-defend*.6);
   const keys=walk.map((k,j)=>[k[0],lerp(k[1],runKeys[j][1],shape),lerp(k[2],runKeys[j][2],shape)+(j>0&&j<4?lift:0)]);
   const slopeA=(to.a-pre.a)/eps*ratio,slopeY=(to.y-pre.y)/eps*ratio;
   // Touch down with the foot already moving back at ground speed (no skid on landing).
   a=spline(keys.map(k=>[k[0],k[1]]),sg,slopeA,-lerp(.85,1,shape)*Ls*ratio);y=Math.max(SOLE*.9,spline(keys.map(k=>[k[0],k[2]]),sg,slopeY,-lerp(.45,.6,shape)));
   relax=smooth(sg/.18)*(1-smooth((sg-.7)/.3))*footRoll;flex=lerp(-.55,-.08,shape);pitch=lerp(to.pitch,td.pitch,smooth((sg-.55)/.45));}
  // Standing: feet a little apart, one slightly ahead. Weight shifts move the pelvis, never the feet.
  const idleX=s*(m.hipX+.03)*(defend||keeper?1.55:1),idleZ=s*v.stagger*.045;
  const stagger=Math.abs(sd)*s*.09,[x,z]=spin(s*m.hipX*width+sd*a-bank*.72-drift,fw*a+stagger,angle);
  feet.push({x:lerp(idleX,x,move),y:lerp(SOLE,y,move),z:lerp(idleZ,z,move),pitch:pitch*move,yaw:s*lerp(.1,.04,run)+angle*move,relax:relax*move,flex,contact:move<.5?1:contact,swing:sg});contacts.push(move<.5?1:contact);}
 // Pelvis: forward rotation with the swing leg, drop on the swing side, lean into curves.
 const aYaw=(lerp(.07,.12,run)+sprint*.04)*lerp(.4,1,forwardness)*move,aRoll=lerp(.05,.07,run)*(1-defend*.6)*move;
 let roll=0;for(let i=0;i<2;i++){const c=(c0+i*.5)%1;if(c<beta)roll+=(i===0?-1:1)*aRoll*Math.sin(Math.PI*c/beta);}
 const hips=[lerp(.03,.08,run)*move+sprint*.05+defend*.14+keeper*.1+acc*.05,aYaw*Math.cos(TAU*(c0-.02)),roll-bank+(1-move)*sway*.03];
 // Vertical motion: vaulting over the stance leg when walking, compress-and-fly when running.
 const h=c0%.5,flight=.5-beta,fly=flight>.01?Math.min(.045,9.81*(flight/Math.max(cycles,.1))**2/8/m.scale):0;
 const runBob=h<beta?-.032*Math.sin(Math.PI*h/beta):fly*Math.sin(Math.PI*(h-beta)/Math.max(flight,.01)),walkBob=.012*Math.cos(2*TAU*(c0-beta/2));
 let hipY=.885-(run*.015+sprint*.012)*move-defend*.085-keeper*.07-tight*.03-carry*.018*move-(1-move)*.008-Math.abs(acc)*.025+lerp(walkBob,runBob,run)*v.bounce*move;
 // Never ask a planted leg for more length than it has.
 const q=new Quaternion().setFromEuler(new Euler(hips[0],hips[1],hips[2],'XYZ')),L=(m.upperLeg+m.lowerLeg)*.995,floor=hipY-.15;
 // The limit fades in before touchdown and out after toe-off, so the pelvis never jumps.
 for(let i=0;i<2;i++){const t=feet[i],w=t.contact?1:t.swing<.25?1-smooth(t.swing/.25):smooth((t.swing-.7)/.3);if(w<=0)continue;const o=new Vector3((i===0?-1:1)*m.hipX,-.075,0).applyQuaternion(q),dx=o.x-t.x,dz=o.z-t.z,limit=t.y-o.y+Math.sqrt(Math.max(0,L*L-dx*dx-dz*dz))-m.hipOffset;hipY=Math.min(hipY,lerp(hipY,limit,w));}
 // A target out of reach lets that foot hang short; the body never folds to fetch it.
 hipY=Math.max(hipY,floor);
 return {feet,contacts,hipY,hips,metrics:m,variation:v,run,sprint,shape,move,defend,keeper,carry,acc,bank,beta,c0,sway,forwardness,style};
}
export function gaitTargets(p,phase,kin={},time=0){const g=plan(p,phase,time,kin);return {feet:g.feet,contacts:g.contacts,hipY:g.hipY,metrics:g.metrics};}
const e=new Euler(),hq=new Quaternion(),uq=new Quaternion(),lq=new Quaternion(),fq=new Quaternion(),mat=new Matrix4(),hip=new Vector3(),dv=new Vector3(),kv=new Vector3(),tv=new Vector3(),xv=new Vector3(),yv=new Vector3(),zv=new Vector3(),shank=new Vector3();
// Analytic two-bone IK in the pelvis frame. The knee points where the foot points;
// the foot keeps its root-space pitch, or follows the shank while swinging (relax).
export function legIK(pose,m,i,target,pitch=0,yaw=0,relax=0,flex=0){
 hq.setFromEuler(e.set(pose.hips[0],pose.hips[1],pose.hips[2],'XYZ'));const inverse=hq.clone().invert();
 hip.set((i===0?-1:1)*m.hipX,-.075,0).applyQuaternion(hq);hip.y+=pose.hipY+m.hipOffset;
 dv.set(target.x,target.y,target.z).sub(hip).applyQuaternion(inverse);
 const a=m.upperLeg,b=m.lowerLeg,length=dv.length(),r=clamp(length,Math.abs(a-b)+1e-3,a+b-1e-3);if(length<1e-6)dv.set(0,-1,0);dv.normalize();
 kv.set(Math.sin(yaw),0,Math.cos(yaw)).applyQuaternion(inverse);kv.addScaledVector(dv,-kv.dot(dv));if(kv.lengthSq()<1e-8)kv.set(0,0,1).addScaledVector(dv,-dv.z);kv.normalize();
 const ca=clamp((a*a+r*r-b*b)/(2*a*r),-1,1),sa=Math.sqrt(1-ca*ca);
 tv.copy(dv).multiplyScalar(ca).addScaledVector(kv,sa);zv.copy(dv).multiplyScalar(-sa).addScaledVector(kv,ca);yv.copy(tv).negate();xv.crossVectors(yv,zv);
 uq.setFromRotationMatrix(mat.makeBasis(xv,yv,zv));e.setFromQuaternion(uq,'XYZ');const knee=Math.PI-Math.acos(clamp((a*a+b*b-r*r)/(2*a*b),-1,1));
 pose.legs[i].upper=[e.x,e.y,e.z];pose.legs[i].lower=[knee,0,0];
 const chain=hq.clone().multiply(uq).multiply(lq.setFromEuler(e.set(knee,0,0,'XYZ')));shank.set(0,-1,0).applyQuaternion(chain);
 const finalPitch=lerp(pitch,Math.atan2(-shank.z,-shank.y)+flex,relax);fq.setFromEuler(e.set(finalPitch,yaw,0,'YXZ'));
 e.setFromQuaternion(chain.invert().multiply(fq),'XYZ');pose.feet[i]=[e.x,e.y,e.z];return {stretch:length-r,pitch:finalPitch};
}
// Full-body locomotion: legs from the foot plan, a counter-rotating trunk, a
// level head and arms swinging against the legs.
export function locomotionPose(pose,p,phase,time,kin={}){
 const g=plan(p,phase,time,kin),{metrics:m,variation:v,run,sprint,move,defend,keeper,carry,acc,bank,c0,sway,style}=g;
 pose.hipY=g.hipY;pose.hips=g.hips;pose.contacts=g.contacts;pose.gaitTargets=g.feet;pose.rootRoll=0;pose.rootY=0;pose.feet=[[0,0,0],[0,0,0]];
 const power=style==='power'?1.12:style==='compact'?.85:1,breathe=.012*Math.sin(time*1.7+v.idle);
 // Ball carriers lean a little over the ball.
 const lean=move*(lerp(.035,.1,run)+sprint*.08+carry*.04)+defend*.2+keeper*.12+acc*(acc>0?.24:.16)+v.lean+(1-move)*.02+breathe+(style==='power'?.03:style==='compact'?-.015:0)-.05*move*clamp(-g.forwardness,0,1);
 const turn=clamp((kin.turn||0)*.035,-.25,.25)*move,gaitRoll=g.hips[2]+bank-(1-move)*sway*.03;
 pose.torso=[lean-g.hips[0],-g.hips[1]*lerp(1.5,2,run)+turn,-gaitRoll*.8-bank*.25];
 // Standing players breathe, bob slightly on the knees and scan the pitch.
 const still=1-move;pose.hipY+=still*.006*Math.sin(time*2.1+v.idle);
 pose.head=[-(g.hips[0]+pose.torso[0])*.7+.04,-(g.hips[1]+pose.torso[1])*.85+turn*.8+still*.18*Math.sin(time*.55+v.idle*1.7),-(g.hips[2]+pose.torso[2])*.75];
 const aFwd=move*(lerp(.3,.6,run)+sprint*.35)*v.arm*power*(1+Math.max(0,acc)*.35),aBack=move*(lerp(.24,.42,run)+sprint*.22)*v.arm*power;
 for(let i=0;i<2;i++){const wave=Math.cos(TAU*(c0+i*.5+.04)),forward=Math.max(0,-wave),swing=wave>0?wave*aBack:wave*aFwd;
  const elbow=move*(lerp(.35,1.3,run)+sprint*.22+v.elbow)+(1-move)*.28+forward*.2*run-Math.max(0,wave)*.12*run;
  const abduction=move*(lerp(.1,.14,run)+sprint*.06-forward*.04)+(1-move)*(.1+(i===0?1:-1)*sway*.015)+defend*.5+keeper*.2+carry*.06;
  const arm=pose.arms[i];arm.upper=[lerp(swing+(1-move)*.04,-.25+swing*.3,defend),0,(i===0?1:-1)*abduction];arm.lower=[-lerp(elbow,.95,defend),0,0];}
 for(let i=0;i<2;i++){const f=g.feet[i],solved=legIK(pose,m,i,f,f.pitch,f.yaw,f.relax,f.flex);f.pitch=solved.pitch;}
 return g;
}
