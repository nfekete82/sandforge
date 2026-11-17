/** WebGL hit routing is UI-only; the Simulation remains responsible for
 * transport capacity, pathfinding, transfer, destruction, and savegames. */
export const BOARDABLE_INFANTRY=new Set(['infantry','medic','engineer','heavy','rocket']);
export function selectedInfantryForTransport(units,selected,carrier){
 if(!carrier||!['rover','scout'].includes(carrier.kind)||carrier.hp<=0||carrier.carrier)return [];
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&u.id!==carrier.id&&u.owner===carrier.owner&&
  u.hp>0&&!u.carrier&&BOARDABLE_INFANTRY.has(u.kind)).map(u=>u.id);
}
/** Right-click a friendly infantry while ONE Humvee/helicopter is selected.
 * A carrier-initiated pickup must not depend on infantry being selected;
 * Simulation.transports.collect moves the carrier to the target instead.
 */
export function selectedCarrierForPickup(units,selected,passenger){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 if(!passenger||passenger.hp<=0||passenger.carrier||
  !BOARDABLE_INFANTRY.has(passenger.kind)||chosen.size!==1)return null;
 return units.find(u=>chosen.has(u.id)&&u.id!==passenger.id&&
  ['rover','scout'].includes(u.kind)&&u.owner===passenger.owner&&u.owner===0&&
  u.hp>0&&!u.carrier)??null;
}
export function selectedLoadedTransports(units,selected){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 return units.filter(u=>chosen.has(u.id)&&['rover','scout'].includes(u.kind)&&u.owner===0&&u.hp>0&&
  !u.carrier&&(u.transport?.cargo?.length??0)>0);
}
// Backwards-compatible alias for existing Humvee acceptance tests.
export const selectedLoadedRovers=selectedLoadedTransports;

/** Passenger slots reflect the actual authoritative cargo array, never
 * proximity on the ground or pending pickup orders. Stable IDs survive
 * boarding, an individual unload and save/load. */
export function selectedTransportManifest(units,selected){
 const chosen=selected instanceof Set?selected:new Set(selected??[]);
 if(chosen.size!==1)return null;
 const carrier=units.find(u=>chosen.has(u.id)&&u.owner===0&&u.hp>0&&
  !u.carrier&&['rover','scout'].includes(u.kind));
 if(!carrier)return null;
 const capacity=carrier.kind==='scout'?10:4;
 const ids=carrier.transport?.cargo??[];
 const pendingIds=carrier.transport?.pickup??[];
 const pending=Math.max(0,Math.min(capacity-ids.length,pendingIds.length));
 const slots=Array.from({length:capacity},(_,i)=>{
  const passenger=units.find(u=>u.id===ids[i]&&u.carrier===carrier.id&&u.hp>0);
  return passenger?{id:passenger.id,kind:passenger.kind,hp:passenger.hp}:null;
 });
 return {carrier,capacity,occupied:slots.filter(Boolean).length,pending,
  available:Math.max(0,capacity-ids.length-pending),slots};
}
