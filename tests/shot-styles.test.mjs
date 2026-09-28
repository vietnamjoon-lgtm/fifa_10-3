import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('../tools/three-loader.mjs',import.meta.url);
const {Match}=await import('../src/match.js');
const {defaults}=await import('../src/settings.js');
const {Input}=await import('../src/input.js');
const {SHOT_STYLE,finesseFlight,powerShotFlight,arcHeight}=await import('../src/shot-styles.js');
const {FIELD}=await import('../src/config.js');

// One shot from (x, z) toward the far corner with the keeper and outfield opponents removed.
function strike(options,{foot='right',x=30,z=-6,seed=3,aimZ=0}={}){
 const m=new Match({...defaults,halfSeconds:600,seed},()=>{});m.start(false);m.state='playing';m.setPiece=null;m.restartOrigin=null;
 const p=m.controlled,d=m.direction(p.team);p.foot=foot;p.x=d*x;p.z=z;p.vx=p.vz=0;p.yaw=d*Math.PI/2;
 for(const q of m.players)if(q!==p&&(q.team!==p.team||q.role==='GK'))q.active=false;
 m.physics.reset(p.x+d*.5,p.z+(foot==='right'?1:-1)*.14*d);m.owner=p;m.lock=0;m.input={axis:{x:d,z:aimZ}};
 assert.ok(m.queueKick(p,'shoot',.9,null,null,options));const b=m.physics.ball;let launch=null,windup=null,start=null,side=0,line=null;
 for(let i=0;i<900&&!line;i++){m.step(1/120,{axis:m.input.axis});
  if(!launch&&b.velocity.length()>8){launch=b.velocity.length();windup=p.action?.contactAt;start={x:b.position.x,z:b.position.z,vx:b.velocity.x,vz:b.velocity.z};}
  if(launch){const n=Math.hypot(start.vx,start.vz),s=((b.position.z-start.z)*start.vx-(b.position.x-start.x)*start.vz)/n;if(Math.abs(s)>Math.abs(side))side=s;
   if(Math.abs(b.position.x)>=FIELD.halfLength)line={y:b.position.y,z:b.position.z};}}
 return {launch,windup,left:-side,line,foot:p.action?.foot??foot};
}

test('ZD curls with the kicking foot: right foot to the shooter\'s left, left foot to the right',()=>{
 const right=strike({curve:true}),left=strike({curve:true},{foot:'left'});
 assert.ok(right.left>2,JSON.stringify(right));assert.ok(left.left<-2,JSON.stringify(left));
 assert.ok(right.line&&Math.abs(right.line.z)<FIELD.goalHalf&&right.line.y<FIELD.goalHeight);
});
test('DZ (Z after D) is faster, spins harder and passes the line higher than ZD; both slower than a normal shot',()=>{
 const zd=strike({curve:true}),dz=strike({curve:true,curveLate:true}),d=strike({});
 assert.ok(dz.launch>zd.launch&&d.launch>dz.launch,JSON.stringify({zd:zd.launch,dz:dz.launch,d:d.launch}));
 assert.ok(dz.left>zd.left&&dz.line.y>zd.line.y+.3,JSON.stringify({zd,dz}));
 // Real curled shots: roughly 20-27 m/s off the boot.
 assert.ok(zd.launch>19&&zd.launch<27&&dz.launch<28);
});
test('FD power shot: fastest, longer wind-up, flat and unassisted, less accurate than the same aim as a normal shot',()=>{
 const fd=strike({powerShot:true}),d=strike({});
 assert.ok(fd.launch>d.launch*1.12&&fd.launch*3.6<150,JSON.stringify({fd:fd.launch,d:d.launch}));
 assert.ok(Math.abs(fd.windup/d.windup-SHOT_STYLE.power.windup)<.01,JSON.stringify({fd:fd.windup,d:d.windup}));
 assert.ok(Math.abs(fd.left)<.5,'no side spin');assert.ok(fd.line.y>.5&&fd.line.y<2,JSON.stringify(fd.line));
 const p={shooting:.8,longPass:.7,power:1};
 assert.ok(powerShotFlight(p,{power:1,distance:25,target:{}},30,3,.11).error>finesseFlight(p,{distance:25,target:{},foot:'right'},30,3,.11).error*3);
});
test('arc planner matches the drag model: a planned height is reached at the line',()=>{
 for(const [d,v] of [[16,24],[30,24],[30,33]]){const f=finesseFlight({longPass:.8,shooting:.8},{distance:d,target:{x:0,z:0},foot:'right'},v/.84,4,.11);
  assert.ok(Math.abs(arcHeight(d*1.02,f.speed,f.lift,.11)-SHOT_STYLE.finesse.height)<.05);}
});
test('keyboard: F+D charges a power shot (no skill move on F release), S cancels it, Z after D makes DZ',()=>{
 const events=[],input=new Input({...defaults},(action,options)=>events.push([action,options]),()=>({attack:true}),{target:{addEventListener(){}},getPads:()=>[]});input.enabled=true;
 input.keyDown('KeyF');input.keyDown('KeyD');assert.equal(events.at(-1)[0],'charge');assert.equal(events.at(-1)[1].powerShot,true);assert.equal(events.at(-1)[1].curve,false);
 input.keyDown('KeyS');assert.equal(events.at(-1)[0],'cancel');input.keyUp('KeyD');input.keyUp('KeyS');input.keyUp('KeyF');
 assert.ok(!events.some(([a])=>a==='skill'),'releasing F after FD must not fire a skill move');
 events.length=0;input.keyDown('KeyD');input.keyDown('KeyZ');input.keyUp('KeyZ');input.keyUp('KeyD');
 const shot=events.find(([a])=>a==='shoot');assert.ok(shot&&shot[1].curve&&shot[1].curveLate,JSON.stringify(events));
 events.length=0;input.lastShot=-1e6;input.keyDown('KeyZ');input.keyDown('KeyD');input.keyUp('KeyD');input.keyUp('KeyZ');
 const zd=events.find(([a])=>a==='shoot');assert.ok(zd&&zd[1].curve&&!zd[1].curveLate,JSON.stringify(events));
});
test('online: power-shot and DZ flags survive command sanitising, unknown fields do not',async()=>{
 const {DuelMatch}=await import('../src/duel.js');const m=new DuelMatch();m.start();m.state='playing';m.aiClock=1e5;
 const p=m.selected(0);m.owner=p;m.physics.reset(p.x+.4,p.z);
 m.command(0,'charge',{powerShot:true,curveLate:'yes',evil:'<script>'});
 assert.equal(m.chargeOptions.powerShot,true);assert.equal('curveLate' in m.chargeOptions,false);assert.equal('evil' in m.chargeOptions,false);
});
