import {distance,type Point} from './config.js';

/** A deterministic, low-cost local recovery waypoint for vehicles which
 * have repeatedly stalled at one impassable node. The caller enforces the
 * exact SAME terrain, slope, building and vehicle colliders as movement.
 * Candidates are short physical detours, NEVER teleports or ghost paths.
 */
export function ai38VehicleRecoveryWaypoint(input:{
  from:Point;goal:Point;
  unitId:number;attempt:number;
  clear:(p:Point)=>boolean;
}):Point|undefined{
 const {from,goal,unitId,attempt,clear}=input;
 const bearing=Math.atan2(goal.y-from.y,goal.x-from.x);
 // Start with a short lateral movement to clear walls and traffic; alternate
 // the preferred side when a first physical detour did not unblock the lane.
 const side=(unitId+attempt)%2===0?1:-1;
 const turns=[side*Math.PI*.5,-side*Math.PI*.5,
  side*Math.PI*.36,-side*Math.PI*.36,
  side*Math.PI*.72,-side*Math.PI*.72,Math.PI];
 for(const radius of [95,145,195]){
  for(const turn of turns){
   const angle=bearing+turn,p={
    x:from.x+Math.cos(angle)*radius,
    y:from.y+Math.sin(angle)*radius
   };
   if(distance(p,goal)>distance(from,goal)+260)continue;
   if(clear(p))return p;
  }
 }
 return undefined;
}

/** A movable convoy cannot abandon a working attack merely because its
 * hull is turning. Only a sustained stalled order triggers a recovery. */
export function ai38CanRecoverVehicle(input:{
 ai:boolean;modernMap:boolean;orderKind:string;
 turning:boolean;hasCargo:boolean;inCombat:boolean;
 sinceProgress:number;attempt:number;
}):boolean{
 return input.ai&&input.modernMap&&
  (input.orderKind==='move'||input.orderKind==='attackMove')&&
  !input.turning&&!input.hasCargo&&!input.inCombat&&
  input.sinceProgress>=3.3&&input.attempt>=1;
}
