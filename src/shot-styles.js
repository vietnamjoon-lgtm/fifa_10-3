import {clamp,FIELD,TUNING} from './config.js';
// Ball mass in the physics world (kg); drag deceleration is DRAG * v^2.
const BALL_MASS=.43;
import {skill} from './attributes.js';
// Finesse ("ZD" / "DZ") and power ("FD") shots. The ball physics (drag, Magnus with a saturating lift
// coefficient, knuckle wobble) is unchanged; these only choose how the ball is struck.
//
// Real reference ranges: curled inside-foot shots leave the boot at about 20-26 m/s with 5-8 rev/s side
// spin (30-50 rad/s); full instep power drives reach 33-40 m/s (120-145 km/h) with little spin. FC Online:
// Z then D curls lower and softer, D then Z higher, faster and with more bend; F+D is a power shot with a
// long wind-up, a manual (less assisted) aim, lower accuracy and a cancel on S.
export const SHOT_STYLE={
 finesse:{speed:.84,lateSpeed:.92,spinBase:26,spinSkill:18,lateSpin:1.25,height:.7,lateHeight:1.45,error:.75,errorSkill:.25,lateError:1.15},
 power:{speed:1.16,windup:1.35,error:4,errorSkill:2,knuckleFrom:.85,height:.8,heightPerCharge:.9,aimWidth:3.3}
};
/** Curling technique 0..1: a `curve` rating when a profile has one, otherwise long passing and finishing. */
export function curveSkill(p){return skill(p,'curve',(skill(p,'longPass')+skill(p,'shooting'))/2);}
// Launch lift that passes the goal line at `height` metres for this speed and distance.
// Height of a non-spinning ball after `distance` m of travel, integrating the same quadratic air drag and
// gravity as the physics (small fixed steps). Magnus only bends these shots sideways, so this is the arc.
const DRAG=.5*TUNING.airDensity*TUNING.dragCoefficient*Math.PI*FIELD.ballRadius**2/BALL_MASS;
export function arcHeight(distance,speed,lift,ballY=FIELD.ballRadius){let x=0,y=ballY,vh=speed,vy=lift;const h=.004;
 for(let i=0;i<1000&&x<distance;i++){const v=Math.hypot(vh,vy);vh-=DRAG*v*vh*h;vy-=(9.81+DRAG*v*vy)*h;x+=vh*h;y+=vy*h;}return y;}
// Launch lift that passes the goal line at `height` metres (`path` > 1 lengthens a bending flight),
// found by bisection on arcHeight; a fixed speed ratio made long shots land short of the line.
function liftFor(a,ballY,speed,height,path=1){if(!a.target)return null;const d=a.distance*path;let lo=.5,hi=11;
 for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(arcHeight(d,speed,mid,ballY)<height)lo=mid;else hi=mid;}return (lo+hi)/2;}
/** Inside-foot curler. Spin sign follows the kicking foot: a right foot bends the ball to the shooter's left. */
export function finesseFlight(p,a,speed,lift,ballY){const F=SHOT_STYLE.finesse,late=!!a.curveLate,technique=curveSkill(p);
 speed*=late?F.lateSpeed:F.speed;
 const spin=(F.spinBase+F.spinSkill*technique)*(late?F.lateSpin:1)*(a.foot==='left'?-1:1);
 return {speed,lift:liftFor(a,ballY,speed,late?F.lateHeight:F.height,1.02)??lift*(late?1.15:.9),curve:spin,error:(F.error-F.errorSkill*technique)*(late?F.lateError:1)};}
/** Full instep drive: fastest shot, little spin (a knuckling flight when struck at full charge), less accurate. */
export function powerShotFlight(p,a,speed,lift,ballY){const P=SHOT_STYLE.power;speed*=P.speed;
 return {speed,lift:liftFor(a,ballY,speed,P.height+P.heightPerCharge*Math.max(0,a.power-.5))??lift,curve:0,knuckle:a.power>=P.knuckleFrom,error:P.error+(1-skill(p,'shooting'))*P.errorSkill};}
/** Manual aim: the stick picks the side (up to just inside the post); no input shoots straight at goal. */
export function powerShotTarget(match,p,axis={x:0,z:0}){const dir=match.direction(p.team);if((axis.x||0)*dir<-.25)return null;
 const z=Math.abs(axis.z||0)>.2?clamp(axis.z,-1,1)*SHOT_STYLE.power.aimWidth:clamp(-p.z*.1,-1,1);return {x:dir*(FIELD.halfLength+.25),z};}
