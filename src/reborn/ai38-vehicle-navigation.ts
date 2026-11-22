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

/** KI 3.9: A* can legally return no path when a long, steep canyon
 * temporarily requires a move away from the ultimate goal. The actual
 * vehicle must drive this SHORT candidate under its normal collision,
 * terrain/slope and spacing validator. Never teleport or ignore walls.
 *
 * Alternating the preferred side and excluding the last recovery origin
 * prevents repeatedly choosing the same failed two-way sidestep.
 */
export function ai39NoPathRecoveryWaypoint(input:{
  from:Point;goal:Point;unitId:number;attempt:number;
  avoid?:Point;clear:(p:Point)=>boolean;
}):Point|undefined{
 const {from,goal,unitId,attempt,avoid,clear}=input;
 if(!Number.isFinite(from.x+from.y+goal.x+goal.y))return undefined;
 const heading=Math.atan2(goal.y-from.y,goal.x-from.x);
 const side=(unitId+Math.max(0,Math.floor((attempt-1)/2)))%2===0?1:-1;
 const angles=[
  side*Math.PI*.5,-side*Math.PI*.5,
  side*Math.PI*.32,-side*Math.PI*.32,
  side*Math.PI*.72,-side*Math.PI*.72,
  0,Math.PI
 ];
 // Some canyon approaches require a short move away from the enemy before
 // reaching the real pass. Bound the probe to 315 map units per attempt.
 for(const radius of attempt>2?[205,125,315,75]:[125,205,75,315]){
  for(const turn of angles){
   const angle=heading+turn;
   const p={x:from.x+Math.cos(angle)*radius,
    y:from.y+Math.sin(angle)*radius};
   if(distance(p,goal)>distance(from,goal)+Math.max(240,radius*.92)||
      avoid&&distance(p,avoid)<Math.min(105,radius*.65))continue;
   if(clear(p))return p;
  }
 }
 return undefined;
}
