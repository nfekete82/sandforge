/** Deterministic, simulation-owned flightline and single-hangar geometry.
 * Local +Z is the apron/front of the hangar, matching buildingFacingAngle.
 * No Three.js dependency: saved aircraft retain their exact docking positions. */
export type AirfieldBay=0|1;
export type AirfieldPhase='approach'|'landing'|'taxi'|'repair'|'ready'|'takeoff';
export interface AirfieldPoint {x:number;y:number}
export interface AirfieldSite extends AirfieldPoint {facing?:0|1|2|3}

/** Flightline rendering uses a 0.90×0.82 compact yard displaced by X=95.
 * The hangar's baked facade is centred at local (-151,-77), not at the
 * original building anchor; a single centre circle lets soldiers cut across
 * the roof and tower. These few bounded circles match only SOLID hangar and
 * fuel/tower geometry; the open runway/apron remains walkable for infantry.
 * The same cardinals as airfieldPoint rotate every real collision point.
 */
export function airfieldGroundStructureColliders(site:AirfieldSite,vehicle=false):
 {x:number;y:number;radius:number}[]{
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][site.facing??0];
 const cs=Math.cos(yaw),sn=Math.sin(yaw);
 const rotate=(x:number,z:number,radius:number)=>{
  const localX=AIRFIELD_COMPACT_OFFSET_X+x*AIRFIELD_COMPACT_X;
  const localZ=z*AIRFIELD_COMPACT_Z;
  return {x:site.x+localX*cs+localZ*sn,
   y:site.y-localX*sn+localZ*cs,
   radius:radius+(vehicle?7:0)};
 };
 return [
  rotate(-151,-127,71), // rear half of long arched hangar
  rotate(-151,-38,72),  // front facade and roll-up door columns
  rotate(-250,-89,53), // tower, utility huts and fenced fuel service
  rotate(-276,75,43)   // barrels, manifolds and field maintenance store
 ];
}
export interface AirfieldService {
  baseId:number;bay:AirfieldBay;phase:AirfieldPhase;elapsed:number;
  /** World-space start of the current landing leg. */
  from?:AirfieldPoint;
  /** Previously paid-for HP remaining; no free repairs between credits. */
  paidHp:number;
}
// One new service bay; legacy bay 1 remains loadable.
export const AIRFIELD_BAYS=1;
export const AIRFIELD_COMPACT_X=.90,AIRFIELD_COMPACT_Z=.82,AIRFIELD_COMPACT_OFFSET_X=95;
export const AIRFIELD_REPAIR_HP_PER_CREDIT=4;
export const AIRFIELD_REPAIR_FRACTION_PER_SECOND=.01;
export const AIRFIELD_LANDING_SECONDS=3.4;
export const AIRFIELD_TAXI_SECONDS=8;
export const AIRFIELD_TAKEOFF_SECONDS=8;
const headings=[0,Math.PI,Math.PI/2,Math.PI*1.5] as const;
const dockX=(_bay:AirfieldBay)=>-151;
export type AirfieldWaypoint='approach'|'touchdown'|'taxi'|'lineup'|'door'|'dock'|'departure';
export function airfieldPoint(base:AirfieldSite,waypoint:AirfieldWaypoint,bay:AirfieldBay=0):AirfieldPoint {
 const local={
  // The visible asphalt continues well beyond the hangars, so aircraft
  // land on the long strip before taxiing onto the side apron.
  approach:{x:12,z:225},touchdown:{x:12,z:130},
  // First turn OUTSIDE the hangar: an aircraft that rotates at z=24
  // sweeps its wing and tail through the entrance column/wall at z=18.
  // Align on the apron (z=95) before driving straight through the door.
  taxi:{x:12,z:95},lineup:{x:dockX(bay),z:95},
  door:{x:dockX(bay),z:20},
  // Drive the whole fuselage deeper into the actual hangar, beyond the
  // doorway; rear bulkhead stays at z=-171 with ~54 units clearance.
  dock:{x:dockX(bay),z:-117},departure:{x:12,z:225}
 }[waypoint];
 const yaw=headings[base.facing??0],c=Math.cos(yaw),s=Math.sin(yaw);
 const x=AIRFIELD_COMPACT_OFFSET_X+local.x*AIRFIELD_COMPACT_X,z=local.z*AIRFIELD_COMPACT_Z;
 return {x:base.x+x*c+z*s,y:base.y-x*s+z*c};
}
export function airfieldLerp(a:AirfieldPoint,b:AirfieldPoint,t:number):AirfieldPoint {
 const f=Math.max(0,Math.min(1,t));
 return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
export function airfieldTaxiPoint(base:AirfieldSite,bay:AirfieldBay,fraction:number,depart=false):AirfieldPoint {
 const t=Math.max(0,Math.min(1,fraction));
 const sections:AirfieldWaypoint[]=depart
  ?['dock','door','lineup','taxi','departure']
  :['touchdown','taxi','lineup','door','dock'];
 // Four continuous segments: descend runway, turn across an OPEN apron,
 // align while clear of both wall columns, then enter/leave along the
 // exact door centerline. Departure reverses the identical safe geometry.
 const stops=[0,.18,.51,.69,1];
 const i=t<stops[1]?0:t<stops[2]?1:t<stops[3]?2:3;
 return airfieldLerp(airfieldPoint(base,sections[i],bay),
  airfieldPoint(base,sections[i+1],bay),(t-stops[i])/(stops[i+1]-stops[i]));
}
export function validAirfieldService(service:unknown,size:number):service is AirfieldService {
 if(!service||typeof service!=='object')return false;
 const s=service as Partial<AirfieldService>;
 const point=(p:AirfieldPoint)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=0&&p.y>=0&&p.x<=size&&p.y<=size;
 return Number.isSafeInteger(s.baseId)&&s.baseId!>=0&&(s.bay===0||s.bay===1)&&
  ['approach','landing','taxi','repair','ready','takeoff'].includes(s.phase??'')&&
  Number.isFinite(s.elapsed)&&s.elapsed!>=0&&s.elapsed!<=12&&
  Number.isFinite(s.paidHp)&&s.paidHp!>=0&&s.paidHp!<AIRFIELD_REPAIR_HP_PER_CREDIT+1e-6&&
  (s.from===undefined||point(s.from));
}
