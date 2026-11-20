import {distance,type Point} from './config.js';

/** Move an old, physically inaccessible offensive rally back onto a LEGAL
 * cluster of real paid combat units. This is a planning decision only:
 * all soldiers must still walk to the point using their ordinary routes.
 * The caller passes only friendly living fighters and real terrain/gun data.
 */
export function ai40ClusterRallyRecovery<T extends Point&{
  id:number;hp:number;kind:string;
}>(x:{
  units:readonly T[];oldRally:Point;mission:Point;
  stalledSeconds:number;trappedMoveOrders:number;siegeRequired:boolean;
  viable:(p:Point)=>boolean;
}):Point|undefined{
 // Long rally travel is normal, especially on 16-Bastion maps. A retry
 // requires actual missing paths in the CURRENT unit orders, not just time.
 if(x.stalledSeconds<95||x.units.length<8)return undefined;
 const living=x.units.filter(u=>u.hp>0);
 const minimum=Math.min(4,Math.max(3,Math.ceil(living.length*.14)));
 if(living.length<minimum||
    x.trappedMoveOrders<Math.max(3,Math.ceil(living.length*.35)))return undefined;
 // Do not shift an already assembled wave because of a harmless clock.
 const ready=living.filter(u=>distance(u,x.oldRally)<330).length;
 if(ready>=minimum)return undefined;
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
