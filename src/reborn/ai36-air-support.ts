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
 return x.enabled&&x.airfieldReady&&x.fighters>=6&&x.groundVehicles>=2&&
  x.income>=45&&x.time>=120&&!x.underAttack&&x.enemyAir<2&&
  !x.finishing&&x.contestedBastions?1:0;
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
 observed:readonly T[],front:Point,maxRadius=1350
):T|undefined{
 const priority=(kind:string)=>({
  tank:450,artillery:440,rover:300,turret:330,headquarters:270,
  factory:235,airfield:220,rocket:185,heavy:115,infantry:60,
  barracks:130,generator:80
 } as Record<string,number>)[kind]??20;
 return observed.filter(t=>t.hp>0&&distance(t,front)<maxRadius)
  .slice().sort((a,b)=>(distance(a,front)-priority(a.kind))-
   (distance(b,front)-priority(b.kind))||a.id-b.id)[0];
}
