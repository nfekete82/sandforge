/** Compact single-unit commands: camera selection, hold/guard, go home.
 * Orders flow through the actual Simulation.command(), preserving collision
 * navigation, vehicle/aircraft takeoff, existing transport cargo and saves.
 */
export const FIELD_UNIT_COMMANDS=Object.freeze(['stop','return-base','select-all']);

/** Prefer the operative HQ, never a wall or an enemy base.
 * A completed production facility is a fallback after HQ destruction. */
export function returnBaseForUnit(unit,bases){
 const friendly=bases.filter(b=>b.owner===unit.owner&&b.hp>0&&
  b.buildRemaining<=0&&b.kind!=='wall'&&b.kind!=='turret');
 const headquarters=friendly.filter(b=>b.kind==='headquarters');
 const options=headquarters.length?headquarters:friendly;
 return options.sort((a,b)=>
  Math.hypot(unit.x-a.x,unit.y-a.y)-Math.hypot(unit.x-b.x,unit.y-b.y)||a.id-b.id)[0]??null;
}

/** One route per unit avoids formation stalls at HQ gates. Nearest/walkability
 * corrections happen inside Simulation.command; never issue a target through
 * a solid building or teleport a unit/aircraft out of a maintenance garage.
 * A short guard ring spreads arrivals around the building.
 */
export function orderReturnToBase(game,unitIds,owner=0){
 let accepted=0,missing=0;
 const ids=new Set(unitIds);
 for(const unit of game.units){
  if(!ids.has(unit.id)||unit.owner!==owner||unit.hp<=0||unit.carrier)continue;
  const base=returnBaseForUnit(unit,game.bases);
  if(!base){missing++;continue;}
  const d=Math.atan2(unit.y-base.y,unit.x-base.x);
  const angle=d+((unit.id%7)-3)*.12;
  const safeRadius=Math.max(160,(base.radius??60)+85);
  const size=game.world.size;
  const target={
   x:Math.min(size-14,Math.max(14,base.x+Math.cos(angle)*safeRadius)),
   y:Math.min(size-14,Math.max(14,base.y+Math.sin(angle)*safeRadius))
  };
  accepted+=game.command([unit.id],{kind:'move',...target,guardOnArrival:true});
 }
 return {accepted,missing};
}
