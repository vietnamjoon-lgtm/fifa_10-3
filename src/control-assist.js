import {clamp,distance} from './config.js';
export const assistanceDefaults={passFollow:true,looseBallAssist:true,receiveAssist:true,autoSwitch:'aerial',switchCarry:'none',passAssist:'auto',crossAssist:'semi',throughAssist:'auto',analogSprint:false,defenceAssist:true,runType:3};
export function cleanAssistance(raw={}){const out={...assistanceDefaults};for(const [key,values]of Object.entries({autoSwitch:['aerial','defence','all','manual'],switchCarry:['none','low','high'],passAssist:['auto','semi','manual'],crossAssist:['auto','semi','manual'],throughAssist:['auto','semi','manual']}))if(values.includes(raw[key]))out[key]=raw[key];for(const key of ['analogSprint','defenceAssist','looseBallAssist','receiveAssist','passFollow'])if(typeof raw[key]==='boolean')out[key]=raw[key];if([1,2,3].includes(raw.runType))out.runType=raw.runType;return out;}
export function selectControlled(m,p,reason='possession'){
 if(!p?.active||p.team!==m.settings.userTeam||m.controlled===p)return false;
 if(reason==='possession'&&(m.time<(m.manualSwitchUntil||0)||m.time<(m.controlLockUntil||0)))return false;
 const keep=m.settings.switchCarry||'none';m.carryInput=keep==='none'?null:{axis:{...m.input.axis},until:m.time+(keep==='high'?.35:.15)};
 m.controlled=p;m.charging=false;m.charge=0;
 if(reason==='manual'){m.manualSwitchUntil=m.time+.7;m.controlLockUntil=m.time+.7;m.receiving=null;}
 if(reason==='pass')m.controlLockUntil=m.time+.85;
 if(reason==='aerial'||reason==='defence')m.controlLockUntil=m.time+.9;
 return true;
}
export function updateAutoControl(m){
 if(m.autoplay||m.practice||m.setPiece||!m.controlled)return;
 const team=m.settings.userTeam,b=m.physics.ball.position;
 if(m.heldBy?.team===team){selectControlled(m,m.heldBy,'keeper');return;}
 // The human controls the keeper only while he holds or carries the ball. Once he releases it control returns to an
 // outfield player, so the keeper's own positioning and diving take over again; left on the keeper, a human who was
 // not steering him kept him frozen off his line.
 const dropped=distance(m.controlled,b)<2.5&&m.physics.ball.velocity.length()<4&&m.lastTouch===m.controlled;
 if(m.controlled.role==='GK'&&m.owner!==m.controlled&&!dropped){const next=m.players.filter(p=>p.active&&p.team===team&&p.role!=='GK'&&p.down<=0).sort((a,c)=>distance(a,b)-distance(c,b))[0];if(next){selectControlled(m,next,'release');return;}}
 if(m.owner?.team===team){if(m.time-(m.owner.possessedAt??m.time)>.14)selectControlled(m,m.owner);return;}
 if(m.time<(m.manualSwitchUntil||0)||m.time<(m.controlLockUntil||0))return;
 const mode=m.settings.autoSwitch||'aerial',air=b.y>1.1&&m.physics.ball.velocity.y<5;
 if(mode==='manual'||mode==='aerial'&&!air||mode==='defence'&&m.owner?.team===team)return;
 if(!air&&mode!=='all'&&mode!=='defence')return;
 if(m.receiving&&m.time<m.receiving.expires)return;
 const v=m.physics.ball.velocity,target={x:b.x+v.x*.25,z:b.z+v.z*.25};
 const candidate=m.players.filter(p=>p.active&&p.team===team&&p.role!=='GK'&&p.down<=0).sort((a,c)=>distance(a,target)-distance(c,target))[0];
 if(candidate&&candidate!==m.controlled&&distance(candidate,target)+2.5<distance(m.controlled,target))selectControlled(m,candidate,air?'aerial':'defence');
}
export function runTarget(m,p){
 const dir=m.direction(p.team),type=m.settings.runType||3;
 if(type===1)return {x:clamp(p.x+dir*14,-49,49),z:p.z};
 if(type===2)return {x:clamp(p.x+dir*12,-49,49),z:clamp(p.z*.55,-30,30)};
 let best=null,score=-Infinity;for(const offset of [-9,-4,0,4,9]){const target={x:clamp(p.x+dir*13,-48,48),z:clamp(p.z+offset,-29,29)},space=Math.min(15,...m.players.filter(q=>q.active&&q.team!==p.team).map(q=>distance(q,target)));const value=space-Math.abs(offset)*.12-Math.abs(target.z)*.04;if(value>score){score=value;best=target;}}
 return best;
}
