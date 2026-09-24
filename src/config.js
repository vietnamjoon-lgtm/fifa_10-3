export const FIELD={halfLength:52.5,halfWidth:34,goalHalf:3.66,goalHeight:2.44,ballRadius:.11};
export const TUNING={step:1/120,jog:5.8,sprint:8.6,acceleration:14,deceleration:19,turn:7,pass:16,shotMin:19,shotMax:34,rollingDrag:.52,airDensity:1.225,dragCoefficient:.25,magnus:.00034,controlRadius:.78,tackleRange:1.25,tackleCooldown:1.1,aiInterval:.16,staminaDrain:.065,staminaRecovery:.033};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function turnToward(a,b,amount){let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+clamp(d,-amount,amount);}
const formation=[[-48,0],[-32,-24],[-35,-9],[-35,9],[-32,24],[-18,-17],[-23,0],[-18,17],[-4,-24],[-2,0],[-4,24]];
const names=[['M. VALE','D. PARK','L. MOREAU','S. OKAFOR','N. REED','T. SILVA','H. SEO','E. COSTA','R. SANTOS','J. KANG','A. DIAZ'],['I. NOVAK','M. KATO','A. COLE','L. DIALLO','R. LEE','J. TORRES','K. WOLF','F. ROSSI','D. MORENO','N. STORM','Y. ARDA']];
const numbers=[1,2,4,5,3,8,6,7,11,10,9];
export const TEAMS=[{name:'APEX FC',short:'APX',color:'#c6ff5d'},{name:'VOLT UNITED',short:'VLT',color:'#ee7258'}];
export function roster(team){return formation.map(([x,z],i)=>({id:team*11+i,team,index:i,name:names[team][i],number:numbers[i],role:i===0?'GK':i<5?'DEF':i<8?'MID':'FWD',homeX:x,homeZ:z,height:1.74+((i*7+team*3)%15)/100,build:.93+((i*3+team)%6)*.026,foot:i%4===0?'left':'right',weakFoot:.68+(i%4)*.07,pace:8.05+(i%4)*.22,acceleration:13+(i%3),agility:.76+(i%4)*.05,balance:.77+(i%3)*.06,control:.76+(i%5)*.04,passing:.76+(i%4)*.05,longPass:.71+(i%3)*.08,shooting:.72+(i%5)*.05,power:.85+(i%3)*.06,tackling:i<5?.9:.7,strength:i<5?.87:.75,reflexes:.8,reach:1.7}));}
