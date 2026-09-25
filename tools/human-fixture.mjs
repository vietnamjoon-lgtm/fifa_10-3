import * as THREE from '../vendor/three.module.js';
import {configureBodyRig} from '../src/body-rig.js';
export function fixture(profile){
 const root=new THREE.Group(),hips=new THREE.Bone(),torso=new THREE.Bone(),head=new THREE.Bone(),arms=[],legs=[];
 root.add(hips);hips.add(torso);torso.add(head);
 for(const sign of [-1,1]){const upper=new THREE.Bone(),lower=new THREE.Bone();torso.add(upper);upper.add(lower);arms.push({upper,lower});const leg=new THREE.Bone(),shin=new THREE.Bone(),foot=new THREE.Bone();hips.add(leg);leg.add(shin);shin.add(foot);legs.push({upper:leg,lower:shin,foot});}
 const rig={root,hips,torso,head,arms,legs,phase:0,eyelids:[],animateFace(){},details:[],lod:[]};configureBodyRig(rig,profile);return rig;
}
