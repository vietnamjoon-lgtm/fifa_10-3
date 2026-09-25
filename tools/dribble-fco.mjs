// Measures our dribble on the same items as the FC Online reference clips (docs/research/fco-dribble-measurements.md).
// Every 1/120 s physics step is recorded. Usage: node tools/dribble-fco.mjs [root] ; root defaults to this checkout.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2),sets=args.filter(a=>a.includes('=')),root=path.resolve(args.find(a=>!a.includes('=')&&!a.startsWith('-'))||path.join(path.dirname(new URL(import.meta.url).pathname),'..'));
const only=args.find(a=>a.startsWith('--only='))?.slice(7);
const {Match}=await import(pathToFileURL(path.join(root,'src/match.js')).href);
const {defaults}=await import(pathToFileURL(path.join(root,'src/settings.js')).href);
const {ASSIST}=await import(pathToFileURL(path.join(root,'src/assists.js')).href);
for(const s of sets.filter(a=>!a.startsWith('--'))){const [k,v]=s.split('=');ASSIST[k]=Number(v);}
const DT=1/120,deg=Math.PI/180;
function setup(seed=3){
 const m=new Match({...defaults,userTeam:0,seed});m.start(true);m.state='playing';m.lock=0;m.aiClock=1e6;m.setPiece=null;
 const p=m.controlled,d=m.direction(0);p.cooldown=0;
 for(const q of m.players)if(q!==p){q.x=-45*d;q.z=q.id%2?30:-30;q.target={x:q.x,z:q.z};}
 p.x=-30*d;p.z=0;p.vx=p.vz=0;p.yaw=d*Math.PI/2;m.physics.reset(p.x+d*.5,0);m.owner=p;
 const touches=[];const kick=m.physics.kick.bind(m.physics);m.physics.kick=(...a)=>{touches.push(m.time);return kick(...a)};
 // A drag (the boot turning the ball over a few steps, assists.js startDrag) is one touch.
 let drag=null;const step=m.step.bind(m);m.step=(...a)=>{const r=step(...a);if(p.ballDrag&&p.ballDrag!==drag)touches.push(m.time);drag=p.ballDrag;return r;};
 return {m,p,d,touches};
}
const dir=(d,a)=>({x:Math.cos(a*deg)*d,z:Math.sin(a*deg)});
function sample(m,p){const b=m.physics.ball.position,v=m.physics.ball.velocity;return {t:m.time,x:p.x,z:p.z,vx:p.vx,vz:p.vz,yaw:p.yaw,phase:p.motionPhase||0,bx:b.x,bz:b.z,by:b.y,bvx:v.x,bvz:v.z,owner:m.owner===p};}
const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(f*s.length))]:NaN;};

export function straight({sprint,seconds=5}){
 const {m,p,d,touches}=setup();const A=dir(d,0),rows=[];
 for(let i=0;i<seconds*120;i++){m.step(DT,{axis:A,sprint});rows.push(sample(m,p));}
 const settled=rows.filter(r=>r.t>2),lead=settled.map(r=>(r.bx-r.x)*A.x+(r.bz-r.z)*A.z),side=settled.map(r=>Math.abs((r.bx-r.x)*A.z-(r.bz-r.z)*A.x));
 const tt=touches.filter(t=>t>2),gaps=tt.slice(1).map((t,i)=>t-tt[i]);
 const ph=t=>{const r=rows.reduce((b,r)=>Math.abs(r.t-t)<Math.abs(b.t-t)?r:b);return r.phase;};
 const steps=tt.slice(1).map((t,i)=>(ph(t)-ph(tt[i]))/Math.PI);
 const sp=settled.map(r=>Math.hypot(r.vx,r.vz));
 return {speed:sp.reduce((a,b)=>a+b,0)/sp.length,leadMin:Math.min(...lead),leadMax:Math.max(...lead),sideMax:Math.max(...side),touchGap:gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:null,steps:steps.length?steps.reduce((a,b)=>a+b,0)/steps.length:null,owned:rows.every(r=>r.owner)};
}

export function turn({sprint,angle,before=2.5,after=2}){
 const {m,p,d,touches}=setup();const A=dir(d,0),B=dir(d,angle),rows=[];
 for(let i=0;i<before*120;i++)m.step(DT,{axis:A,sprint});
 const t0=m.time,x0=p.x,z0=p.z,v0=Math.hypot(p.vx,p.vz),bv0=m.physics.ball.velocity.x*A.x+m.physics.ball.velocity.z*A.z;
 for(let i=0;i<after*120;i++){m.step(DT,{axis:B,sprint});rows.push(sample(m,p));}
 const rel=rows.map(r=>({...r,t:r.t-t0,along:r.vx*A.x+r.vz*A.z,balong:r.bvx*A.x+r.bvz*A.z,pos:(r.x-x0)*A.x+(r.z-z0)*A.z,speed:Math.hypot(r.vx,r.vz),head:Math.abs(Math.atan2(Math.sin(Math.atan2(r.vx,r.vz)-Math.atan2(B.x,B.z)),Math.cos(Math.atan2(r.vx,r.vz)-Math.atan2(B.x,B.z))))/deg,face:Math.abs(Math.atan2(Math.sin(r.yaw-Math.atan2(B.x,B.z)),Math.cos(r.yaw-Math.atan2(B.x,B.z))))/deg,bhead:Math.abs(Math.atan2(Math.sin(Math.atan2(r.bvx,r.bvz)-Math.atan2(B.x,B.z)),Math.cos(Math.atan2(r.bvx,r.bvz)-Math.atan2(B.x,B.z))))/deg}));
 const first=(f)=>{const r=rel.find(f);return r?r.t:null;};
 const firstTouch=touches.find(t=>t>t0);
 // Ball turned: for >=90 deg its velocity along the old line reaches 0; below that its heading is within 15 deg of the new stick.
 const ballTurned=angle>=90?first(r=>r.balong<=0):first(r=>r.bhead<15&&Math.hypot(r.bvx,r.bvz)>.5);
 const bodyTurned=angle>=90?first(r=>r.along<=0):first(r=>r.head<10);
 const facing=first(r=>r.face<10);
 let maxDec=0;for(let i=6;i<rel.length;i++){const a=(rel[i-6].speed-rel[i].speed)/(rel[i].t-rel[i-6].t);maxDec=Math.max(maxDec,a);}
 const yawRate=Math.max(...rel.slice(1).map((r,i)=>Math.abs(Math.atan2(Math.sin(r.yaw-rel[i].yaw),Math.cos(r.yaw-rel[i].yaw)))/DT/deg));
 const overshoot=Math.max(...rel.map(r=>r.pos))-(rel.find(r=>r.t>=(ballTurned??0))?.pos??0);
 const w=rel.filter(r=>r.t<(bodyTurned??1)+.8);
 const exitBall=Math.max(...w.map(r=>Math.hypot(r.bvx,r.bvz)));
 const late=rel.filter(r=>r.t>(bodyTurned??1)+.2&&r.t<(bodyTurned??1)+1),lead=late.map(r=>(r.bx-r.x)*B.x+(r.bz-r.z)*B.z);
 return {v0,firstTouch:firstTouch!=null?firstTouch-t0:null,ballTurned,bodyTurned,lag:ballTurned!=null&&bodyTurned!=null?bodyTurned-ballTurned:null,facing,minSpeed:Math.min(...rel.filter(r=>r.t<1.5).map(r=>r.speed)),maxDec,yawRate,overshoot,exitBall,leadMin:Math.min(...lead),leadMax:Math.max(...lead),touches:touches.filter(t=>t>t0&&t<t0+1.5).length,owned:rows.every(r=>r.owner)};
}

// Keyboard play: 8 arrow directions, pressed and released at human rhythms (0.15-0.8 s), sprint toggled now and then.
export function freePlay({seed=1,seconds=30}){
 const {m,p,d,touches}=setup();let s=seed;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 let a=0,until=0,sprint=false;const rows=[];
 for(let i=0;i<seconds*120;i++){
  if(m.time>=until){const r=rnd();a=r<.1?null:Math.round((rnd()*360-180)/45)*45;until=m.time+.15+rnd()*.65;if(rnd()<.25)sprint=!sprint;
   // Keep the run on the pitch: near a line the next key points back in, so no throw-in or goal kick interrupts it.
   if(a!=null&&(Math.abs(p.x)>38||Math.abs(p.z)>24)){const back=Math.atan2(-p.z,-p.x*d)/deg;a=Math.round(back/45)*45;}}
  const axis=a==null?{x:0,z:0}:dir(d,a);m.step(DT,{axis,sprint});rows.push(sample(m,p));
 }
 const r=rows.filter(r=>r.t>1.5),dist=[],behind=[],ahead=[],sideA=[],crab=[],relSpeed=[],yawRate=[],jerk=[];
 for(let i=1;i<r.length;i++){const c=r[i],o=r[i-1],sp=Math.hypot(c.vx,c.vz),dx=c.bx-c.x,dz=c.bz-c.z;dist.push(Math.hypot(dx,dz));
  if(sp>1){const h={x:c.vx/sp,z:c.vz/sp};behind.push((dx*h.x+dz*h.z)<0);ahead.push(dx*h.x+dz*h.z);sideA.push(Math.abs(dx*h.z-dz*h.x));crab.push(Math.abs(Math.atan2(Math.sin(Math.atan2(c.vx,c.vz)-c.yaw),Math.cos(Math.atan2(c.vx,c.vz)-c.yaw)))/deg);}
  relSpeed.push(Math.hypot(c.bvx-c.vx,c.bvz-c.vz));yawRate.push(Math.abs(Math.atan2(Math.sin(c.yaw-o.yaw),Math.cos(c.yaw-o.yaw)))/DT/deg);
  if(i>1){const oo=r[i-2];jerk.push(Math.hypot((c.vx-2*o.vx+oo.vx),(c.vz-2*o.vz+oo.vz))/DT/DT);}}
 return {ahead10:q(ahead,.1),ahead50:q(ahead,.5),side90:q(sideA,.9),close:ahead.filter(a=>a<.3).length/ahead.length,dist50:q(dist,.5),dist95:q(dist,.95),distMax:Math.max(...dist),behind:behind.filter(Boolean).length/behind.length,crab50:q(crab,.5),crab95:q(crab,.95),crabOver45:crab.filter(c=>c>45).length/crab.length,yaw95:q(yawRate,.95),yawMax:Math.max(...yawRate),rel95:q(relSpeed,.95),relMax:Math.max(...relSpeed),touchesPerS:touches.filter(t=>t>1.5).length/(seconds-1.5),jerk95:q(jerk,.95),lost:r.filter(x=>!x.owner).length/r.length};
}

if(process.argv[1]?.endsWith('dribble-fco.mjs')){
 const f=(x,n=2)=>x==null||!Number.isFinite(x)?'   -':x.toFixed(n);
 console.log('# root',root);
 if(!only||only==='straight'){console.log('\n## straight  speed | ball lead min-max | side max | touch gap s | steps/touch | owned');
 for(const sprint of [false,true]){const r=straight({sprint});console.log(`${sprint?'sprint':'jog   '} ${f(r.speed)} | ${f(r.leadMin)}-${f(r.leadMax)} | ${f(r.sideMax)} | ${f(r.touchGap)} | ${f(r.steps,1)} | ${r.owned}`);}}
 if(!only||only==='turn'){console.log('\n## turn  v0 | 1st touch | ball turned | body turned | lag | facing | min speed | max decel | yaw rate max | overshoot | exit ball v | lead after | touches/1.5s | owned');
 for(const sprint of [false,true])for(const angle of [45,90,135,180]){const r=turn({sprint,angle});
  console.log(`${sprint?'S':'J'} ${String(angle).padStart(3)} ${f(r.v0)} | ${f(r.firstTouch)} | ${f(r.ballTurned)} | ${f(r.bodyTurned)} | ${f(r.lag)} | ${f(r.facing)} | ${f(r.minSpeed)} | ${f(r.maxDec,1)} | ${f(r.yawRate,0)} | ${f(r.overshoot)} | ${f(r.exitBall)} | ${f(r.leadMin)}-${f(r.leadMax)} | ${r.touches} | ${r.owned}`);}}
 console.log('\n## free keyboard play (30 s x 4 seeds)  ahead p10/p50 | side p90 | ahead<0.3m % | ball dist p50/p95/max | behind % | crab p50/p95 deg, >45 % | yaw rate p95/max deg/s | ball-body rel speed p95/max | touches/s | body jerk p95 | lost %');
 for(const seed of [1,2,3,4]){const r=freePlay({seed});console.log(`seed ${seed} ${f(r.ahead10)}/${f(r.ahead50)} | ${f(r.side90)} | ${f(r.close*100,0)} | ${f(r.dist50)}/${f(r.dist95)}/${f(r.distMax)} | ${f(r.behind*100,0)} | ${f(r.crab50,0)}/${f(r.crab95,0)}, ${f(r.crabOver45*100,0)} | ${f(r.yaw95,0)}/${f(r.yawMax,0)} | ${f(r.rel95)}/${f(r.relMax)} | ${f(r.touchesPerS)} | ${f(r.jerk95,0)} | ${f(r.lost*100,0)}`);}
}
