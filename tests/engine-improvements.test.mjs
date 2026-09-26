import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {Match} from '../src/match.js';
import {defaults} from '../src/settings.js';
import {kickError,keeperProfile} from '../src/attributes.js';
import {logicalFoot,chooseKickFoot} from '../src/contact-model.js';
import {interpolateFrame,LocalPresentation} from '../src/render-state.js';
import {SnapshotBuffer} from '../src/net-state.js';
import {sampleMotion} from '../src/motion.js';
import {solveFoot,stabilizeFeet} from '../src/foot-plant.js';
import {createSkinnedLimbs} from '../src/skinned-player.js';

function match(){const m=new Match({...defaults,seed:17});m.start(true);m.state='playing';m.aiClock=1e6;m.lock=0;const p=m.controlled;p.x=p.z=0;p.yaw=Math.PI/2;p.action=null;p.cooldown=p.touchCooldown=0;m.physics.reset(.54,-.11);return {m,p};}
function passVelocity(key,value,type='pass'){const {m,p}=match();p[key]=value;m.queueKick(p,type,.5,{x:18,z:4});m.contactKick(p,p.action);const v=m.physics.ball.velocity;return [v.x,v.y,v.z];}
test('short pass and lob use their own skills, independently of shooting',()=>{
 assert.notDeepEqual(passVelocity('passing',.2),passVelocity('passing',1));
 assert.notDeepEqual(passVelocity('longPass',.2,'lob'),passVelocity('longPass',1,'lob'));
 assert.deepEqual(passVelocity('shooting',.2),passVelocity('shooting',1));
 assert.deepEqual(passVelocity('passing',.2,'shoot'),passVelocity('passing',1,'shoot'));
});
test('agility changes turn response and balance changes braking',()=>{
 const run=(key,value)=>{const {m,p}=match();m.owner=null;p[key]=value;p.vx=6;for(let i=0;i<30;i++)m.move(p,key==='balance'?{x:0,z:0}:{x:0,z:1},false,false,1/120);return [p.x,p.z,p.yaw,p.vx,p.vz];};
 assert.notDeepEqual(run('agility',.2),run('agility',1));assert.notDeepEqual(run('balance',.2),run('balance',1));
});
test('pressure, fatigue and weak foot widen error without changing stat identity',()=>{const {p}=match(),a={type:'pass',aim:{x:1,z:0},foot:p.foot};const baseline=kickError(p,a,10);assert.ok(kickError(p,a,.2)>baseline);assert.ok(kickError({...p,stamina:.2},a,10)>baseline);assert.ok(kickError(p,{...a,foot:'left'},10)>baseline);});
test('goalkeeper reflexes and reach change reaction, catch and coverage limits',()=>{const {p}=match();const low=keeperProfile({...p,reflexes:.2,reach:1.4}),high=keeperProfile({...p,reflexes:1,reach:2});assert.ok(high.reaction<low.reaction);assert.ok(high.catchSpeed>low.catchSpeed);assert.ok(high.range>low.range);});
test('preferred feet mirror logical contact and choose the reachable side',()=>{const {p}=match();p.yaw=0;const left=logicalFoot({...p,foot:'left'}),right=logicalFoot({...p,foot:'right'});assert.equal(left.x,-right.x);assert.equal(left.z,right.z);assert.equal(chooseKickFoot(p,{x:-.25,z:.5},{x:0,z:1}),'right');assert.equal(chooseKickFoot(p,{x:.25,z:.5},{x:0,z:1}),'left');});
test('a buffered incoming pass traps when necessary, then releases once with one contact event',()=>{const {m,p}=match();m.owner=null;m.physics.reset(3,-.11);m.physics.kick({x:-1,z:0},18,0);m.input={axis:{x:1,z:0}};assert.equal(m.requestKick(p,'pass',.5),true);for(let i=0;i<180;i++)m.step(1/120,{axis:{x:0,z:0}});assert.equal(m.contacts.length,1);const c=m.contacts[0];assert.ok(c.acceptedTime>c.inputTime);assert.equal(c.contactTime,c.ballReleaseTime);assert.ok(c.logicalError<.49);});
test('a distant outgoing ball never becomes a queued kick or a remote contact',()=>{const {m,p}=match();m.owner=null;m.physics.reset(5,0);m.physics.kick({x:1,z:0},20,0);assert.equal(m.requestKick(p,'shoot'),false);assert.equal(p.intent,null);});

const frame=(time,x,elapsed,hit=false)=>({time,state:'playing',half:1,elapsed:time,timer:0,ball:[x,.11,0,1,0,0,0,0,0,1],players:[{id:0,x,z:0,yaw:0,vx:1,vz:0,active:true,motionPhase:x,action:{id:4,type:'shoot',elapsed,contactAt:.24,hit}}]});
test('position and kick time interpolate on the same contact crossing',()=>{const a=frame(1,0,.20),b=frame(1.08,8/100,.28,true);const before=interpolateFrame(a,b,.25),after=interpolateFrame(a,b,.75);assert.equal(before.players[0].action.hit,false);assert.equal(after.players[0].action.hit,true);assert.ok(Math.abs(before.players[0].action.elapsed-.22)<1e-9);assert.ok(Math.abs(before.ball[0]-.02)<1e-9);});
test('server time interpolation tolerates irregular packet arrival without rewinding',()=>{const buffer=new SnapshotBuffer();buffer.push(frame(1,1,.1),100);buffer.push(frame(1.04,1.04,.14),142);buffer.push(frame(1.08,1.08,.18),215);let previous=-Infinity;for(let t=220;t<310;t+=5){const s=buffer.sample(t);assert.ok(s.time>=previous);assert.ok(Math.abs(s.ball[0]-s.time)<1e-6);previous=s.time;}});
test('offline presentation is independent from physics and contains intermediate positions',()=>{const {m,p}=match();const buffer=new LocalPresentation();buffer.reset(m);m.time+=1/120;p.x=1;m.physics.ball.position.x=2;buffer.step(m);const middle=buffer.sample(.5);assert.equal(middle.players[p.id].x,.5);assert.equal(p.x,1);middle.players[p.id].x=999;assert.equal(p.x,1);});
test('left and right kicks mirror legs while start, stop, turn and receive have distinct poses',()=>{const p={x:0,z:0,vx:0,vz:4,yaw:0,foot:'right',action:{type:'shoot',foot:'right',elapsed:.12,contactAt:.24}},right=sampleMotion(p,1,0),left=sampleMotion({...p,action:{...p.action,foot:'left'}},1,0);assert.deepEqual(right.legs[1].upper[0],left.legs[0].upper[0]);for(const [key,kin]of [['start',{acceleration:7}],['stop',{acceleration:-7}],['turn',{turn:4}]])assert.equal(sampleMotion({...p,action:null},1,0,null,false,kin).state,key);assert.equal(sampleMotion({...p,action:null,receiveUntil:.3},1,.1).state,'receive');});

function rig(){const root=new THREE.Group(),hips=new THREE.Bone(),torso=new THREE.Bone();root.add(hips);hips.position.y=.78;hips.add(torso);const legs=[],arms=[];for(const sign of [-1,1]){const upper=new THREE.Bone(),lower=new THREE.Bone(),foot=new THREE.Bone();hips.add(upper);upper.position.set(sign*.112,-.075,0);upper.add(lower);lower.position.y=-.35;lower.add(foot);foot.position.y=-.4;legs.push({upper,lower,foot});const arm=new THREE.Bone(),fore=new THREE.Bone();torso.add(arm);arm.position.set(sign*.222,.447,0);arm.add(fore);fore.position.y=-.255;arms.push({upper:arm,lower:fore});}return {root,hips,torso,legs,arms,phase:0};}
test('two-bone IK reaches the contact target and clamps impossible targets without stretching',()=>{const r=rig(),target=new THREE.Vector3(.112,.08,.30);assert.ok(solveFoot(r,1,target).error<.001);assert.ok(solveFoot(r,1,new THREE.Vector3(10,0,0)).clamped);assert.equal(r.legs[1].lower.position.y,-.35);assert.equal(r.legs[1].foot.position.y,-.4);});
test('planted foot remains in world space as the body moves',()=>{const r=rig(),p={vx:1,vz:0},pose={state:'run'};stabilizeFeet(r,p,pose,.01);const initial=r.legs[0].foot.getWorldPosition(new THREE.Vector3());r.root.position.x+=.035;stabilizeFeet(r,p,pose,.01);const after=r.legs[0].foot.getWorldPosition(new THREE.Vector3());assert.ok(initial.distanceTo(after)<.001);});
test('continuous limb LODs use normalized multi-bone skin weights and deform with the skeleton',()=>{const r=rig(),c=new THREE.Color('white'),skin=createSkinnedLimbs(r,{skin:c,kit:c,shorts:c,sock:c});assert.ok(skin.near[0].isSkinnedMesh);const weights=skin.near[0].geometry.attributes.skinWeight;let shared=0;for(let i=0;i<weights.count;i++){assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);if(weights.getX(i)>0&&weights.getY(i)>0)shared++;}assert.ok(shared>40);assert.ok(skin.far.geometry.attributes.position.count<skin.near[0].geometry.attributes.position.count);});
