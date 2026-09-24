import {FIELD,clamp} from './config.js';
export function boundaryRestart(match,previous){const b=match.physics.ball.position,r=FIELD.ballRadius,xOut=Math.abs(b.x)>FIELD.halfLength+r,zOut=Math.abs(b.z)>FIELD.halfWidth+r;if(!xOut&&!zOut)return null;
 let tx=Infinity,tz=Infinity;if(previous){if(xOut&&b.x!==previous.x)tx=clamp((Math.sign(b.x)*(FIELD.halfLength+r)-previous.x)/(b.x-previous.x),0,1);if(zOut&&b.z!==previous.z)tz=clamp((Math.sign(b.z)*(FIELD.halfWidth+r)-previous.z)/(b.z-previous.z),0,1);}
 if(zOut&&(!xOut||tz<tx||!previous))return {kind:'throw',team:1-match.lastTouchTeam,x:clamp(previous?previous.x+(b.x-previous.x)*tz:b.x,-51,51),z:Math.sign(b.z)*33.7,label:'스로인'};
 const end=Math.sign(b.x),defending=match.direction(0)===end?1:0;return match.lastTouchTeam===defending?{kind:'corner',team:1-defending,x:end*52,z:Math.sign(b.z||1)*33.5,label:'코너킥'}:{kind:'goalkick',team:defending,x:end*47,z:Math.sign(b.z||1)*5,label:'골킥'};
}
export function offsideSnapshot(match,kicker){const dir=match.direction(kicker.team),def=match.players.filter(p=>p.active&&p.team!==kicker.team).map(p=>p.x*dir).sort((a,b)=>b-a),line=Math.max(def[1]??52.5,match.physics.ball.position.x*dir);return new Set(match.players.filter(p=>p.active&&p!==kicker&&p.team===kicker.team&&p.x*dir>0&&p.x*dir>line+.1).map(p=>p.id));}
export function clockText(seconds,half,duration){const minutes=Math.min(45,seconds/duration*45)+(half===2?45:0),total=Math.floor(minutes*60);return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
