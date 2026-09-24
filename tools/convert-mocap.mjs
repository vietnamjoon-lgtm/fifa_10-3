import fs from 'node:fs';
import {Vector3,Quaternion,Euler,Matrix4} from '../vendor/three.module.js';
const rad=Math.PI/180,scale=.0254/.45,down=new Vector3(0,-1,0),up=new Vector3(0,1,0);
const rotation=angles=>new Quaternion().setFromEuler(new Euler(...angles.map(a=>a*rad),'ZYX'));
function load(subject,trial){
 const asf=fs.readFileSync(`assets-source/${subject}.asf`,'utf8'),bones={};
 for(const block of asf.split(':bonedata')[1].split(':hierarchy')[0].matchAll(/begin([\s\S]*?)end/g)){
  const info={dof:[],axis:[0,0,0]};for(const line of block[1].trim().split('\n')){const [key,...values]=line.trim().split(/\s+/);if(key==='name')info.name=values[0];if(key==='direction')info.direction=new Vector3(...values.map(Number));if(key==='length')info.length=Number(values[0]);if(key==='axis')info.axis=values.slice(0,3).map(Number);if(key==='dof')info.dof=values;}
  info.C=rotation(info.axis);bones[info.name]=info;
 }
 const hierarchy=asf.split(':hierarchy')[1].split('\n').map(line=>line.trim().split(/\s+/)).filter(parts=>parts.length>1);for(const [parent,...children]of hierarchy)for(const child of children)bones[child].parent=parent;
 const frames=[];let frame;for(const line of fs.readFileSync(`assets-source/${subject}_${trial}.amc`,'utf8').split('\n')){if(/^\d+$/.test(line.trim())){frame={};frames.push(frame);}else if(frame){const [name,...values]=line.trim().split(/\s+/);if(name)frame[name]=values.map(Number);}}
 return frames.map(values=>{
  const positions={root:new Vector3(...values.root.slice(0,3))},rotations={root:rotation(values.root.slice(3))};
  for(const [parent,...children]of hierarchy)for(const name of children){const bone=bones[name],angles=[0,0,0];bone.dof.forEach((key,i)=>angles[['rx','ry','rz'].indexOf(key)]=values[name]?.[i]||0);const q=rotations[parent].clone().multiply(bone.C).multiply(rotation(angles)).multiply(bone.C.clone().invert());rotations[name]=q;positions[name]=positions[parent].clone().add(bone.direction.clone().multiplyScalar(bone.length).applyQuaternion(q));}
  for(const v of Object.values(positions)){v.multiplyScalar(scale);v.x=-v.x;}
  positions.sourceDirections=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,[-b.direction.x,b.direction.y,b.direction.z]]));positions.sourceRotations=Object.fromEntries(Object.entries(rotations).map(([name,q])=>[name,[q.x,-q.y,-q.z,q.w]]));return positions;
 });
}
function basis(right,vertical){const x=right.clone().normalize(),z=new Vector3().crossVectors(x,vertical).normalize(),y=new Vector3().crossVectors(z,x).normalize();return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));}
function retarget(pos,floor){
 const right=pos.rhipjoint.clone().sub(pos.lhipjoint),yaw=Math.atan2(-right.z,right.x),unheading=new Quaternion().setFromAxisAngle(up,-yaw);
 const vector=(a,b)=>pos[b].clone().sub(pos[a]).applyQuaternion(unheading);
 const oriented=(name,axis=down)=>unheading.clone().multiply(new Quaternion().fromArray(pos.sourceRotations[name])).multiply(new Quaternion().setFromUnitVectors(axis,new Vector3(...pos.sourceDirections[name]).normalize()));
 const hip=basis(right.applyQuaternion(unheading),vector('root','lowerback'));
 const chest=basis(vector('lclavicle','rclavicle'),vector('lowerback','lowerneck'));
 const head=new Quaternion().setFromUnitVectors(up,vector('upperneck','head').normalize());
 const quats=[hip,hip.clone().invert().multiply(chest),chest.clone().invert().multiply(head)],feet=[];
 for(const prefix of ['l','r']){
  const thigh=oriented(prefix+'femur');
  const shin=oriented(prefix+'tibia');
  quats.push(hip.clone().invert().multiply(thigh),thigh.clone().invert().multiply(shin));
  const foot=new Vector3(prefix==='l'?-.112:.112,-.075,0).applyQuaternion(hip).add(new Vector3(0,-.35,0).applyQuaternion(thigh)).add(new Vector3(0,-.459,.055).applyQuaternion(shin));feet.push(foot);
 }
 for(const prefix of ['l','r']){const upper=oriented(prefix+'humerus'),lower=oriented(prefix+'radius');quats.push(chest.clone().invert().multiply(upper),upper.clone().invert().multiply(lower));}
 const flight=Math.max(0,Math.min(pos.ltoes.y,pos.rtoes.y)-floor-.018)*.9;
 const hipY=Math.max(.55,Math.min(1.06,-Math.min(...feet.map(v=>v.y))+.025+flight));
 const data=[hipY,...quats.flatMap(q=>{const e=new Euler().setFromQuaternion(q,'XYZ');return[e.x,e.y,e.z];})].map(n=>Math.round(n*10000)/10000);
 return {data,rotations:quats.map(q=>q.toArray()),sourceRotations:pos.sourceRotations,root:[pos.root.x,pos.root.y,pos.root.z,yaw],ankles:['l','r'].map(prefix=>{const shin=oriented(prefix+'tibia');const forward=vector(prefix+'foot',prefix+'toes').normalize();return shin.invert().multiply(oriented(prefix+'toes',new Vector3(0,0,1))).toArray();}),contacts:[pos.ltoes.y-floor<.065?1:0,pos.rtoes.y-floor<.065?1:0],leftZ:vector('root','ltibia').z,rightZ:vector('root','rtibia').z,leftY:pos.ltibia.y-floor,rightY:pos.rtibia.y-floor};
}
const output={source:'Carnegie Mellon University Graphics Lab Motion Capture Database',url:'https://mocap.cs.cmu.edu/',fps:60,schemaVersion:2,rigVersion:'touchline-2',contactConfidence:'estimated_from_foot_height_and_velocity'};
const report={};
for(const [name,subject,trial]of [['run','09','01'],['kick','10','01']]){
 const raw=load(subject,trial),floor=raw.map(p=>Math.min(p.ltoes.y,p.rtoes.y)).sort((a,b)=>a-b)[Math.floor(raw.length*.05)],poses=raw.map(p=>retarget(p,floor));
 const peaks=[];for(let i=4;i<poses.length-4;i++){const value=poses[i].leftZ-poses[i].rightZ;if(value>0&&value>poses[i-4].leftZ-poses[i-4].rightZ&&value>=poses[i+4].leftZ-poses[i+4].rightZ&&(!peaks.length||i-peaks.at(-1)>20))peaks.push(i);}
 let contact=0,velocity=0,foot='right';for(let i=2;i<poses.length-2;i++)for(const side of ['left','right']){const v=(poses[i+2][side+'Z']-poses[i-2][side+'Z'])*30;if(v>velocity&&poses[i][side+'Y']<.5){contact=i;velocity=v;foot=side;}}
 let cycle=[0,poses.length-1],bestError=Infinity;if(name==='run'){for(let a=0;a<poses.length-65;a++)for(let b=a+65;b<Math.min(poses.length,a+125);b++){let error=0;for(let k=1;k<34;k++){const d=Math.atan2(Math.sin(poses[a].data[k]-poses[b].data[k]),Math.cos(poses[a].data[k]-poses[b].data[k]));error+=d*d*(k>=10?2:1);}if(error<bestError){bestError=error;cycle=[a,b];}}}
 const start=name==='kick'?Math.max(0,contact-38):cycle[0],end=name==='kick'?Math.min(poses.length-1,contact+52):cycle[1];
 const frames=[],contacts=[],localRotations=[],ankleRotations=[],rootTrajectory=[],sourceJointRotations=[];
 for(let i=start;i<=end;i+=2){frames.push([...poses[i].data]);localRotations.push(poses[i].rotations);ankleRotations.push(poses[i].ankles);sourceJointRotations.push(poses[i].sourceRotations);const root=poses[i].root,previous=poses[Math.max(0,i-1)].root;rootTrajectory.push({time:(i-start)/120,position:root.slice(0,3),heading:root[3],velocity:root.slice(0,3).map((n,j)=>(n-previous[j])*120)});contacts.push(poses[i].contacts.map((on,side)=>{const key=side?'rtoes':'ltoes',a=raw[Math.max(0,i-1)][key],b=raw[Math.min(raw.length-1,i+1)][key];return on&&Math.abs(b.y-a.y)*60<.9?1:0;}));}
 const duration=(frames.length-1)/60;
 // Correct every tracked joint, including arms; enforce equal boundary pose and angular velocity.
 if(name==='run'){
  for(const tracks of [localRotations,ankleRotations])for(let j=0;j<tracks[0].length;j++){
   const first=new Quaternion().fromArray(tracks[0][j]),last=new Quaternion().fromArray(tracks.at(-1)[j]),correction=last.clone().invert().multiply(first);
   for(let i=1;i<tracks.length;i++){const t=i/(tracks.length-1),blend=t*t*(3-2*t);tracks[i][j]=new Quaternion().fromArray(tracks[i][j]).multiply(new Quaternion().slerp(correction,blend)).normalize().toArray();}
   tracks[tracks.length-1][j]=first.toArray();const delta=first.clone().invert().multiply(new Quaternion().fromArray(tracks[1][j]));const before=first.clone().multiply(delta.invert());
   for(let i=tracks.length-5;i<tracks.length-1;i++){const goal=before.clone();tracks[i][j]=new Quaternion().fromArray(tracks[i][j]).slerp(goal,((i-(tracks.length-5))/3)**2).toArray();}
  }
  const difference=frames[0][0]-frames.at(-1)[0];for(let i=0;i<frames.length;i++){const t=i/(frames.length-1);frames[i][0]+=difference*t*t*(3-2*t);}frames[frames.length-2][0]=2*frames[0][0]-frames[1][0];contacts[contacts.length-1]=[...contacts[0]];
 }
 for(let i=0;i<frames.length;i++)frames[i]=[frames[i][0],...localRotations[i].flatMap(a=>{const e=new Euler().setFromQuaternion(new Quaternion().fromArray(a),'XYZ');return [e.x,e.y,e.z];})];
 const eventTime=name==='kick'?Math.max(0,Math.min(duration,(contact-start)/120)):null;
 output[name]={id:'cmu-'+subject+'_'+trial,source:subject+'_'+trial,sourceRate:120,frames,localRotations,ankleRotations,sourceJointRotations,rootTrajectory,localTranslations:frames.map(f=>[0,f[0],0]),contacts,duration,contact:eventTime,foot,events:eventTime===null?[]:[{id:'ball-contact-estimate',time:eventTime,confidence:'kinematic_estimate'}],tags:{action:name,foot:name==='kick'?foot:'both'},warpLimits:{time:[.75,1.4],translation:.22,rotation:.5},partnerAnchors:[],reference:{type:'CMU motion capture',ballTracked:false}};
 report[name]={rawFrames:raw.length,start,end,contact,foot,velocity,peaks,first:frames[0],last:frames.at(-1)};
}
fs.writeFileSync('src/mocap-data.js','// Retargeted CMU 09_01 running and 10_01 soccer kick. See licenses/CMU-MOCAP.txt.\nexport const mocap='+JSON.stringify(output)+';\n');
fs.writeFileSync('reports/mocap-conversion.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
