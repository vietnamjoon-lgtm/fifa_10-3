import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleMotion} from '../src/motion.js';
import {LEFT,RIGHT,sideIndex} from '../src/sides.js';

// The rig faces +z and legs[0]/arms[0] sit at x<0, i.e. on the player's right.
const kickPose=(type,foot,elapsed)=>sampleMotion({x:0,z:0,vx:0,vz:3,yaw:0,id:1,action:{id:1,type,foot,elapsed,contactAt:.24,power:.6}},0,1,{x:0,y:.11,z:.45});
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,`${msg}: ${a} vs ${b}`);

test('side index: left is legs[1] (x>0), right is legs[0] (x<0)',()=>{
 assert.equal(RIGHT,0);assert.equal(LEFT,1);
 assert.equal(sideIndex('left'),LEFT);assert.equal(sideIndex('right'),RIGHT);
});

test('a left-foot pass swings the left leg and a right-foot pass the right leg',()=>{
 for(const [foot,k] of [['left',LEFT],['right',RIGHT]]){
  const pose=kickPose('pass',foot,.09); // back-swing: the kicking knee is bent, the plant knee is not
  assert.ok(pose.legs[k].lower[0]>pose.legs[1-k].lower[0]+.2,`${foot}: kick knee ${pose.legs[k].lower[0]} plant knee ${pose.legs[1-k].lower[0]}`);
 }
});

test('a right-foot kick is the mirror image of a left-foot kick',()=>{
 for(const type of ['pass','shoot']){
  for(const elapsed of [.05,.12,.24,.4]){
   const l=kickPose(type,'left',elapsed),r=kickPose(type,'right',elapsed);
   for(let i=0;i<2;i++){
    close(r.legs[i].upper[0],l.legs[1-i].upper[0],`${type} ${elapsed} leg ${i} x`);
    close(r.legs[i].upper[1],-l.legs[1-i].upper[1],`${type} ${elapsed} leg ${i} y`);
    close(r.legs[i].upper[2],-l.legs[1-i].upper[2],`${type} ${elapsed} leg ${i} z`);
    close(r.legs[i].lower[0],l.legs[1-i].lower[0],`${type} ${elapsed} knee ${i}`);
    close(r.arms[i].upper[0],l.arms[1-i].upper[0],`${type} ${elapsed} arm ${i} x`);
    close(r.arms[i].upper[2],-l.arms[1-i].upper[2],`${type} ${elapsed} arm ${i} z`);
   }
   close(r.torso[1],-l.torso[1],`${type} ${elapsed} torso twist`);
  }
 }
});

test('every left/right to index conversion goes through sides.js',()=>{
 for(const f of fs.readdirSync('src').filter(f=>f.endsWith('.js')&&f!=='sides.js')){
  const src=fs.readFileSync('src/'+f,'utf8');
  assert.equal((src.match(/foot===?'(left|right)'\?[01]:[01]/g)||[]).length,0,f);
 }
});
