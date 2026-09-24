import {clamp} from './config.js';
import {solveAirKick} from './air-flight.js';
export const SETPIECE_STYLES={inside:'안쪽 감아차기',outside:'바깥쪽 감아차기',knuckle:'무회전',chip:'칩',lowInside:'낮은 안쪽 회전',lowOutside:'낮은 바깥쪽 회전',lowStraight:'낮은 직선'};
export function setpieceFlight(style,p,a,ball){
 if(!Object.hasOwn(SETPIECE_STYLES,style))return null;
 const sign=a.foot==='left'?-1:1,low=style.startsWith('low'),outside=style.toLowerCase().includes('outside'),inside=style.toLowerCase().includes('inside'),spin=(outside?-20:inside?20:0)*sign;
 const time=clamp(a.distance/(15+a.power*8),.45,1.85)*(style==='chip'?1.3:low?.72:1);
 const height=low?.18:(a.target?.y??1.15)+Math.max(0,a.power-.85)*5;
 return {...solveAirKick(a.distance,height,time,ball.y,spin),style};
}
