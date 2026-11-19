import {unitSpec,type UnitKind,type BuildingKind} from './catalog.js';

/** Light helicopter self-defence: six paid rockets, no combat-heli DPS.
 * No automatic target tracking or splash against aircraft. Both factions
 * use exactly the same stock, clock, hit rules and field rearm prices.
 */
export const SCOUT_ROCKETS=Object.freeze({
 maxAmmo:6,cooldown:9,range:235,damage:40,blastRadius:24,
 rearmCost:12,flightSpeed:580
});

export function scoutRocketDamage(
 target:{kind?:UnitKind|BuildingKind;queue?:unknown},
 baseDamage:number,distance:number
):number{
 if(!Number.isFinite(distance)||distance<0||distance>SCOUT_ROCKETS.blastRadius)
  return 0;
 const building='queue' in target;
 const group=building?'structure':unitSpec(target as {kind?:UnitKind}).group;
 if(!building&&unitSpec(target as {kind?:UnitKind}).flying)return 0;
 // Almost harmless against buildings and infantry, modest against vehicles.
 const factor=building?.30:group==='Infanterie'?.55:1;
 return Math.max(0,baseDamage*factor*
  (1-.45*distance/SCOUT_ROCKETS.blastRadius));
}
export function scoutRocketReady(u:{
 kind:UnitKind;rocketAmmo?:number;rocketCooldown?:number;
 airfieldService?:unknown;carrier?:number;hp:number;transport?:{phase?:string}
},distanceToTarget:number,target:{kind?:UnitKind|BuildingKind;queue?:unknown}):boolean{
 return u.kind==='scout'&&u.hp>0&&!u.carrier&&!u.airfieldService&&
  (u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)>0&&
  (u.rocketCooldown??0)<=0&&
  (!u.transport||u.transport.phase==='cruise')&&
  distanceToTarget<=SCOUT_ROCKETS.range&&
  ('queue' in target||!unitSpec(target as {kind?:UnitKind}).flying);
}
