import {distance,clamp,type Point} from './config.js';
import type {Simulation} from './simulation.js';

/** Explicit KI3.6 opt-in. No changes to legacy saves or KI3.5 A/B behavior. */
export function ai36AirDoctrineEnabled(g:Simulation):boolean{
 return g.tactical.mode==='director'&&g.tactical.ai36Mode==='coordinated'&&
  g.tactical.ai35Mode==='control'&&g.tactical.ai33Mode==='adaptive'&&
  (g.world.mapVersion===24||g.world.mapVersion===26);
}

/** A single cheap, genuinely paid R-01 can survey unobserved approaches.
 * Never replace a builder, defense or opening assault with a drone.
 * Existing paid queue is counted by the caller; 4 purchases maximum/game.
 */
export function shouldBuyReconDrone(x:{
 enabled:boolean;time:number;headquartersReady:boolean;barracksReady:boolean;
 workers:number;fighters:number;existing:number;totalPurchased:number;
 creditsAfterReserve:number;underAttack:boolean;room:number;
 needsIntel:boolean;
}):boolean{
 return x.enabled&&x.time>=35&&x.headquartersReady&&x.barracksReady&&
  x.workers>=1&&x.fighters>=3&&x.existing===0&&x.totalPurchased<4&&
  x.creditsAfterReserve>=280&&!x.underAttack&&x.room>=2&&x.needsIntel;
}

/** Optional first bomber for support of a *real, paid* ground army. Public
 * contested Bastions justify a support aircraft even before armored enemies
 * have been spotted. No fogged enemy actors or fictitious resources.
 */
export function bomberSupportQuota(x:{
 enabled:boolean;airfieldReady:boolean;fighters:number;groundVehicles:number;
 income:number;time:number;underAttack:boolean;enemyAir:number;
 contestedBastions:boolean;finishing:boolean;
}):number{
 if(!(x.enabled&&x.airfieldReady&&x.fighters>=6&&x.groundVehicles>=2&&
   x.income>=45&&x.time>=120&&!x.underAttack&&x.enemyAir<2&&
   !x.finishing&&x.contestedBastions))return 0;
 // Real, earned late-game air superiority: two paid bombers can service
 // different observed armor clusters while a substantial ground screen moves.
 // Never add free aircraft, and never use unseen opponent unit counts.
 return x.time>=285&&x.income>=85&&x.fighters>=11&&
   x.groundVehicles>=4?2:1;
}

/** The R-01 surveys the area directly ahead of its *public/memorized*
 * objective. It stops short of the center; no target acquisition occurs here.
 */
export function droneFrontierPoint(home:Point,objective:Point,size:number,
 standOff=480):Point{
 const dx=objective.x-home.x,dy=objective.y-home.y,d=Math.hypot(dx,dy)||1;
 return {x:clamp(objective.x-dx/d*standOff,50,size-50),
  y:clamp(objective.y-dy/d*standOff,50,size-50)};
}

/** Input MUST be an independently visibility-filtered list. The selector
 * only scores observed ground targets near the friendly operational front.
 * Aircraft never get omniscient targeting from this function.
 */
export function observedBomberSupportTarget<T extends Point&{id:number;kind:string;hp:number}>(
 observed:readonly T[],front:Point,maxRadius=1350,
 eligible?:(target:T)=>boolean
):T|undefined{
 const priority=(kind:string)=>({
  tank:450,artillery:440,rover:300,turret:330,headquarters:270,
  factory:235,airfield:220,rocket:185,heavy:115,infantry:60,
  barracks:130,generator:80
 } as Record<string,number>)[kind]??20;
 const ranked=observed.filter(t=>t.hp>0&&distance(t,front)<maxRadius)
  .slice().sort((a,b)=>(distance(a,front)-priority(a.kind))-
   (distance(b,front)-priority(b.kind))||a.id-b.id);
 // The first high-value contact may be unsupported (AA or armor cluster).
 // Keep looking among equally *observed* candidates instead of idling a
 // bomber that could strike an isolated tank closer to its real ground front.
 return eligible?ranked.find(eligible):ranked[0];
}


/** KI3.6 bomber sortie gate. Only known, *currently visible* hostile ground
 * threats may be passed by the caller. No invisible anti-air units, no
 * arbitrary escort requirement when a truly lone tank is exposed.
 *
 * A bomber cannot be the first unit over a defended front. It may strike
 * once a REAL nearby ground screen has arrived, not merely because that
 * screen was purchased or is sitting on the other side of the map.
 */
export function bomberCloseAirSupportAllowed<
 T extends Point&{id:number;kind:string;hp:number},
 A extends Point&{kind:string;hp:number}
>(target:T,observed:readonly T[],groundArmy:readonly A[]):boolean{
 if(!target||target.hp<=0)return false;
 const at=observed.some(v=>v.id===target.id);
 if(!at)return false; // Target must be currently observed, not remembered.
 const hostiles=observed.filter(v=>v.hp>0&&distance(v,target)<=430);
 const grounded=groundArmy.filter(u=>u.hp>0&&distance(u,target)<=500&&
  !['medic','engineer','drone','scout','bomber'].includes(u.kind));
 const adjacent=hostiles.filter(v=>distance(v,target)<=365);
 const isBuilding=['turret','headquarters','factory','airfield','barracks',
  'generator','research','silo','interceptor'].includes(target.kind);
 const hostileAA=hostiles.some(v=>
  (v.kind==='rocket'||v.kind==='turret'||v.kind==='interceptor')&&
  distance(v,target)<=410);
 // A single isolated tank/rover/artillery or foot soldier can be bombed
 // without sending an entire armored column. Never solo a defended site.
 if(!isBuilding&&!hostileAA&&adjacent.length===1)return true;
 const vehicles=grounded.filter(u=>
  ['tank','rover','artillery'].includes(u.kind)).length;
 const guns=grounded.reduce((sum,u)=>sum+
  (u.kind==='tank'?2:u.kind==='artillery'?1.8:u.kind==='rover'?1.2:
   u.kind==='rocket'?1.25:u.kind==='heavy'?1.0:.65),0);
 return (grounded.length>=3||vehicles>=2)&&guns>=3.3&&
  (!hostileAA||(grounded.length>=4||vehicles>=2&&guns>=4));
}


/** AI3.6 single-Jeep air disengage. A Humvee's weak small arms cannot
 * win a sustained duel with a helicopter. Avoid throwing away an isolated
 * paid vehicle when there is no REAL nearby AA screen. Targets and allies
 * must already have been filtered by the owner's own vision.
 */
export function loneRoverAirDisengage(input:{
 roverKind:string;enemyKind:string;enemyVisible:boolean;distance:number;
 aaCover:boolean;
}):boolean{
 return input.roverKind==='rover'&&input.enemyKind==='scout'&&
  input.enemyVisible&&input.distance<=500&&!input.aaCover;
}
