// Authored pose sequences inspired by the reference storyboards, not extracted FC animation data.
const live12=[
 ['회전 인사','wings','point','wings'],['한 팔 비행','wings','sky','wings'],['다이빙 인사','crouch','dive','point'],['가벼운 댄스','step','twist','step'],['가슴 펴기','wings','cross','open'],['리듬 지휘','cross','conductor','sky'],['가슴 하트','step','heart','heart'],['스텝 터치','step','twist','point'],['힘 자랑','flex','step','flex'],['런 앤 보우','step','bow','sky'],['차분한 인사','cross','bow','cross'],['앞구르기','crouch','roll','crouch'],['사이드 포인트','step','twist','point'],['환호 점프','sky','step','leap'],['무릎 슬라이드','kneel','open','sky'],['하늘을 향해','step','sky','sky'],['푸시업','crouch','pushup','point'],['무릎 인사','kneel','bow','kneel'],['가슴 모으기','wings','heart','heart']
];
const live11=[
 ['점프 포인트','jump','step','sky'],['비행 후 환호','wings','sky','flex'],['슬라이드와 인사','kneel','cross','bow'],['머리 위 박수','step','clap','clap'],['키스 인사','cross','kiss','sky'],['쉿','wings','shush','shush'],['턴 스텝','step','twist','step'],['팔짱 댄스','cross','twist','cross'],['리듬 워크','step','dance','step'],['무릎 위 환호','kneel','cross','sky'],['측면 돌기','twist','step','wings'],['앉아서 세리머니','sit','sitkick','sit'],['가부좌','sit','meditate','meditate'],['키스와 손짓','kiss','point','sky'],['부드러운 댄스','twist','dance','step'],['점프 랜딩','jump','crouch','cross'],['관중 박수','kiss','clap','clap'],['승리 포즈','step','flex','point'],['앞구르기 환호','clap','roll','crouch'],['한 손 인사','step','kiss','sky'],['기울여 돌기','lean','twist','lean'],['두 손 환호','step','flex','clap'],['무릎 들기','knee','kiss','wings']
];
export const CELEBRATIONS=[...live12.map((v,i)=>({id:`c12-${i+1}`,reference:`fco12-live-${String(57+i).padStart(3,'0')}`,name:v[0],sequence:v.slice(1)})),...live11.map((v,i)=>({id:`c11-${i+1}`,reference:`fco11-live-${String(51+i).padStart(3,'0')}`,name:v[0],sequence:v.slice(1)}))];
export const celebrationOptions={auto:'선수별 자동',...Object.fromEntries(CELEBRATIONS.map((v,i)=>[v.id,`${String(i+1).padStart(2,'0')} · ${v.name}`]))};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),smooth=t=>(t=clamp(t,0,1),t*t*(3-2*t));
function frame(kind,t){const p={hipY:.885,rootY:0,rootRoll:0,hips:[0,0,0],torso:[.02,0,0],head:[0,0,0],legs:[{upper:[0,0,0],lower:[.12,0,0]},{upper:[0,0,0],lower:[.12,0,0]}],arms:[{upper:[0,0,-.14],lower:[-.25,0,0]},{upper:[0,0,.14],lower:[-.25,0,0]}],feet:[[0,0,0],[0,0,0]]},wave=Math.sin(t*Math.PI*2);
 const arms=(a,b=a)=>{p.arms[0].upper=[a[0],a[1]||0,-a[2]];p.arms[1].upper=[b[0],-(b[1]||0),b[2]];};
 const fold=n=>{for(const a of p.arms)a.lower[0]=-n;};
 if(kind==='wings')arms([-.1,0,1.45]);
 if(kind==='sky'){arms([-.2,0,2.8],[0,0,.5]);p.head[0]=-.15;}
 if(kind==='point'){arms([-1.5,-.3,.4],[0,0,.3]);p.torso[1]=-.2;}
 if(kind==='open'){arms([.25,0,1.1]);p.torso[0]=-.2;}
 if(kind==='flex'){arms([0,0,1.6]);fold(1.9);}
 if(kind==='cross'){arms([-.7,-.65,.25]);fold(1.55);}
 if(kind==='heart'){arms([-.6,-.45,.1]);fold(2.0);}
 if(kind==='kiss'||kind==='shush'){arms([-.7,-.3,.1],[0,0,.25]);p.arms[0].lower[0]=-2.0;p.head[0]=.08;}
 if(kind==='clap'){arms([-.8,-.22,2.2]);fold(.8+Math.abs(wave)*.35);}
 if(kind==='conductor'){arms([-1.1,0,.8],[-.4,0,2.3]);fold(.6);}
 if(kind==='bow'){p.torso[0]=.7;p.head[0]=.25;arms([-.2,0,.2]);}
 if(['step','twist','dance','lean'].includes(kind)){const a=kind==='twist'?.5:.25;p.hips[1]=wave*a;p.torso[1]=-wave*a;p.hips[2]=wave*.1;p.legs[0].upper[0]=wave*.28;p.legs[1].upper[0]=-wave*.28;arms([-.2+wave*.35,0,.6],[-.2-wave*.35,0,.6]);fold(.9);if(kind==='lean')p.rootRoll=wave*.4;}
 if(['crouch','kneel'].includes(kind)){p.hipY=kind==='kneel'?.44:.58;p.legs.forEach(l=>{l.upper[0]=kind==='kneel'?-.12:-.8;l.lower[0]=kind==='kneel'?1.6:1.5;});p.torso[0]=.1;arms([-.1,0,.6]);}
 if(['sit','sitkick','meditate'].includes(kind)){p.hipY=.24;p.torso[0]=-.08;p.legs.forEach((l,i)=>{l.upper=[-1.2,0,(i?1:-1)*(kind==='meditate'?.5:.2)];l.lower[0]=kind==='sitkick'?.45+Math.sin(t*8+i)*.35:1.5;});arms([-.6,0,.6]);fold(1.4);}
 if(['dive','pushup','roll'].includes(kind)){p.hipY=.27;p.hips[0]=kind==='roll'?Math.PI*2*smooth(t):1.4;p.torso[0]=.05;arms([-1.0,0,.4]);fold(kind==='pushup'?.6+Math.abs(wave)*.6:.2);p.legs.forEach(l=>l.lower[0]=kind==='roll'?2:.25);if(kind==='roll'){p.hipY=.4;p.rootY=Math.sin(t*Math.PI)*.15;}}
 if(['jump','leap','knee'].includes(kind)){p.rootY=kind==='knee'?0:Math.max(0,Math.sin(t*Math.PI))*.22;p.legs[0].upper[0]=-.7;p.legs[0].lower[0]=1.1;arms([-.3,0,kind==='leap'?2.6:1.2]);}
 return p;
}
export function applyCelebration(pose,p,time){const clip=CELEBRATIONS.find(x=>x.id===p.celebration)||CELEBRATIONS[Math.abs(p.id||p.number||0)%CELEBRATIONS.length],elapsed=Math.max(0,time-(p.celebrationStart??0)),u=clamp(elapsed/4.5,0,.999),segment=u*clip.sequence.length,index=Math.floor(segment),t=segment-index,previous=frame(index?clip.sequence[index-1]:'step',1),next=frame(clip.sequence[index],t),blend=smooth(t/.3);
 pose.state='celebrate';pose.contacts=[0,0];
 for(const key of ['hipY','rootY','rootRoll'])pose[key]=previous[key]+(next[key]-previous[key])*blend;
 for(const key of ['hips','torso','head'])pose[key]=next[key].map((v,i)=>previous[key][i]+(v-previous[key][i])*blend);
 for(const key of ['legs','arms'])for(let i=0;i<2;i++)for(const part of ['upper','lower'])pose[key][i][part]=next[key][i][part].map((v,k)=>previous[key][i][part][k]+(v-previous[key][i][part][k])*blend);
 pose.feet=next.feet;return clip.id;
}
