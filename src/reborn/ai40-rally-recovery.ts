import {distance,type Point} from './config.js';

/** Move an old, physically inaccessible offensive rally back onto a LEGAL
 * cluster of real paid combat units. This is a planning decision only:
 * all soldiers must still walk to the point using their ordinary routes.
 * The caller passes only friendly living fighters and real terrain/gun data.
 */
/** A majority of paid soldiers is physically unable to reach the rally:
 * shorten only THAT impossible gathering phase. Ordinary slow/healthy
 * marching retains the longer 95-second recovery threshold. */
export function ai40RecoveryWaitThreshold(total:number,blocked:number):number{
 return blocked>=Math.max(4,Math.ceil(total*.45))?60:95;
}
/** Cheap, exact preflight shared by the runtime and candidate scanner:
 * only a real, unpathable, under-assembled paid army can start a rescue.
 * The expensive walkability validation starts AFTER this check, never
 * arming a retry timer merely because a macro planning pulse happened. */
/** Rescue moves only a real Bastion capture wave. Relocating a KNOWN HQ
 * siege group does not prove the canyon path to a structure is passable.
 * A home-defense interdiction similarly must not be bypassed by a rally.
 */
export function ai41RallyMissionPermitsRescue(x:{
 kind:'capture'|'structure'|'hunt';
 homePressure:boolean;time:number;notBefore:number;
}):boolean{
 return x.kind==='capture'&&!x.homePressure&&x.time>=x.notBefore;
}
export function ai40ShouldAttemptRecovery(x:{
  fighters:number;blockedOrders:number;elapsed:number;readyAtRally:number;
}):boolean{
 const minimum=Math.min(4,Math.max(3,Math.ceil(x.fighters*.14)));
 return x.fighters>=8&&
  x.elapsed>=ai40RecoveryWaitThreshold(x.fighters,x.blockedOrders)&&
  x.blockedOrders>=Math.max(3,Math.ceil(x.fighters*.35))&&
  x.readyAtRally<minimum;
}
export function ai40ClusterRallyRecovery<T extends Point&{
  id:number;hp:number;kind:string;
}>(x:{
  units:readonly T[];oldRally:Point;mission:Point;
  stalledSeconds:number;trappedMoveOrders:number;siegeRequired:boolean;
  viable:(p:Point)=>boolean;
}):Point|undefined{
 // Long rally travel is normal, especially on 16-Bastion maps. A retry
 // requires actual missing paths in the CURRENT unit orders, not just time.
 const living=x.units.filter(u=>u.hp>0);
 // Do not shift an already assembled wave, or an army with healthy paths.
 const ready=living.filter(u=>distance(u,x.oldRally)<330).length;
 const minimum=Math.min(4,Math.max(3,Math.ceil(living.length*.14)));
 if(!ai40ShouldAttemptRecovery({
  fighters:living.length,blockedOrders:x.trappedMoveOrders,
  elapsed:x.stalledSeconds,readyAtRally:ready
 }))return undefined;
 const candidates=living.filter(u=>x.viable(u)).map(u=>{
  const neighbors=living.filter(v=>distance(u,v)<330);
  const siege=neighbors.some(v=>v.kind==='artillery'&&v.hp>0);
  return {u,neighbors:neighbors.length,siege,
   score:neighbors.length*100+
    (x.siegeRequired&&siege?140:0)-
    distance(u,x.mission)*.012};
 }).filter(v=>v.neighbors>=minimum&&
  distance(v.u,x.oldRally)>260);
 candidates.sort((a,b)=>b.score-a.score||
  a.u.id-b.u.id);
 const chosen=candidates[0];
 if(!chosen)return undefined;
 return {x:chosen.u.x,y:chosen.u.y};
}

/** Count only genuine, unpathable march orders for THIS tactical rally.
 * Formation slots mutate order.x/y, while tactical.goal keeps the exact
 * commander-issued rally center. Reading order.x/y alone undercounts large
 * (4-column) formations and prevents recovery even when the army is stuck.
 * No strategic enemy knowledge and no simulated side effects are involved.
 */
export function ai40CountBlockedRallyOrders<T extends Point&{
  orders:readonly {x:number;y:number;kind:string;
    tactical?:{goal?:Point;mode?:string}}[];
  path:readonly Point[];repath:number;
}>(units:readonly T[],rally:Point):number{
 let count=0;
 for(const u of units){
  const order=u.orders[0];
  if(!order||order.kind!=='move'&&order.kind!=='attackMove')continue;
  const intent=order.tactical?.goal??order;
  if(distance(intent,rally)<230&&distance(u,rally)>500&&
     !u.path.length&&u.repath>0)count++;
 }
 return count;
}
