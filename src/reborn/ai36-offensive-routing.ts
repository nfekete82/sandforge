import {distance,type Point} from './config.js';

/** AI3.6 only: geometric centroid can fall inside a canyon, behind walls,
 * or in another disconnected terrain component, even though every paid
 * assault unit stands on real navigable ground. Strategic A* must start from
 * an ACTUAL soldier/vehicle, not a fictitious blocked mean position.
 * The nearest valid living army member is deterministic (ID tie-breaker).
 * All callers supply their own faction's real soldiers and public terrain.
 */
export function groundedAssaultRouteOrigin<T extends Point&{id:number;hp:number}>(
 units:readonly T[],centroid:Point,walkable:(p:Point)=>boolean
):Point{
 const valid=units.filter(u=>u.hp>0&&walkable(u))
  .sort((a,b)=>distance(a,centroid)-distance(b,centroid)||a.id-b.id);
 const selected=valid[0];
 return selected?{x:selected.x,y:selected.y}:centroid;
}
