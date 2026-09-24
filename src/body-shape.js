// Original body controls. Percentages describe modelling sliders, not medical measurements.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(v,f,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):f;
export const BODY_FIELDS={
 muscle:['근육량',0,100,50,'전체 체형'],softness:['몸의 볼륨',0,100,35,'전체 체형'],
 shoulders:['어깨 너비',85,120,100,'상체'],chest:['가슴 둘레 비율',80,125,100,'상체'],waist:['허리 둘레 비율',75,130,100,'상체'],hips:['골반 너비',85,120,100,'상체'],
 armLength:['팔 길이',90,110,100,'팔 · 손'],upperArm:['위팔 두께',75,135,100,'팔 · 손'],forearm:['아래팔 두께',80,125,100,'팔 · 손'],handSize:['손 크기',85,115,100,'팔 · 손'],
 legLength:['다리 길이',92,108,100,'다리 · 발'],thigh:['허벅지 두께',75,130,100,'다리 · 발'],calf:['종아리 두께',75,130,100,'다리 · 발'],footSize:['발 크기',85,115,100,'다리 · 발'],
 neckWidth:['목 두께',85,120,100,'머리 · 목'],headSize:['머리 크기',90,110,100,'머리 · 목']
};
export function cleanBody(raw={}){raw=raw&&typeof raw==='object'?raw:{};return Object.fromEntries(Object.entries(BODY_FIELDS).map(([key,[,min,max,base]])=>[key,number(raw[key],base,min,max)]));}
export const defaultWeight=p=>Math.round(78*(number(p?.height,1.81,1.55,2.1)/1.81)**2);
export const cleanWeight=(value,p)=>number(value,defaultWeight(p),45,125);
export const BODY_PRESETS={balanced:{label:'균형',values:{}},slim:{label:'슬림',values:{muscle:32,softness:18,chest:94,waist:89,upperArm:91,thigh:93}},athletic:{label:'탄탄한 체형',values:{muscle:76,softness:24,shoulders:106,waist:94,upperArm:106,thigh:106}},power:{label:'두꺼운 체형',values:{muscle:86,softness:44,shoulders:112,chest:112,waist:104,upperArm:116,thigh:115,calf:108}}};
export function bodyMetrics(profile={}){
 const b=cleanBody(profile.body),height=number(profile.height,1.81,1.55,2.1),weight=cleanWeight(profile.weight,profile),build=number(profile.build,1,.8,1.25);
 const massWidth=clamp(Math.sqrt(weight/(78*(height/1.81)**2)),.78,1.26),width=build*massWidth,muscle=(b.muscle-50)/50,soft=(b.softness-35)/65;
 const leg=b.legLength/100,arm=b.armLength/100,hipOffset=.75*(leg-1),mapY=y=>y<.085?y:y<=.835?.085+(y-.085)*leg:y<1.585?y+hipOffset*(1-(y-.835)/.75):y;
 const head=b.headSize/100,scale=height/(1.585+.159663*head*number(profile.face?.shape?.length,1,.85,1.15));
 return {body:b,height,weight,width,muscle,soft,leg,arm,head,scale,mapY,hipOffset,hipY:.91+hipOffset,shoulderY:mapY(1.357),shoulderX:.222*width*b.shoulders/100,hipX:.112*width*b.hips/100,
  upperLeg:.35*leg,lowerLeg:.4*leg,upperArm:.255*arm,lowerArm:.24*arm,handReach:.24*arm+.03*b.handSize/100,foot:b.footSize/100};
}
const bell=(v,s)=>Math.exp(-((v/s)**2));
export function bodyPoint(x,y,z,bone,m){
 const b=m.body,side=[3,4,7,8,9].includes(bone)?-1:1;
 if(bone>=3&&bone<=6){const upper=bone===3||bone===5,baseY=upper?1.357:1.102,newY=upper?m.shoulderY:m.shoulderY-m.upperArm,hand=clamp((.90-y)/.06,0,1),radius=m.width*(1+m.muscle*(upper?.13:.075)+m.soft*.05)*(upper?b.upperArm:b.forearm)/100;
  const thickness=radius*(1-hand)+b.handSize/100*hand,dy=!upper&&y<.862?-.24*m.arm+(y-.862)*b.handSize/100:(y-baseY)*m.arm;
  return [side*m.shoulderX+(x-side*.222)*thickness,newY+dy,z*thickness];
 }
 if(bone>=7){const hip=bone===7||bone===10,knee=bone===8||bone===11,baseY=hip?.835:knee?.485:.085,newY=hip?.835+m.hipOffset:knee?.085+m.lowerLeg:.085;
  const radius=m.width*(1+m.muscle*(hip?.13:.075)+m.soft*.055)*(hip?b.thigh:knee?b.calf:100)/100,foot=hip||knee?1:m.foot;
  return [side*m.hipX+(x-side*.112)*radius*foot,newY+(y-baseY)*(hip||knee?m.leg:1),z*radius*foot];
 }
 if(bone===2)return [x*(m.head+(b.neckWidth/100-m.head)*clamp((1.57-y)/.10,0,1)),1.585+(y-1.585)*m.head,z*m.head];
 const chest=bell(y-1.30,.14),waist=bell(y-1.02,.12),hip=bell(y-.86,.12),neck=clamp((y-1.40)/.17,0,1);
 const torsoWidth=m.width*(1+(b.chest/100-1)*chest+(b.shoulders/100-1)*bell(y-1.40,.10)*.7+(b.waist/100-1)*waist+(b.hips/100-1)*hip+m.muscle*.06*chest+m.soft*.12*waist);
 const width=torsoWidth*(1-neck)+b.neckWidth/100*neck,depth=m.width*(1+(b.chest/100-1)*chest+(b.waist/100-1)*waist+m.muscle*.09*chest+m.soft*.22*waist);
 return [x*width,m.mapY(y),z*(depth*(1-neck)+b.neckWidth/100*neck)];
}
export function bodyContactMass(p){return (.5+(p.strength??.8))*clamp(Math.sqrt(cleanWeight(p.weight,p)/78),.78,1.28);}
