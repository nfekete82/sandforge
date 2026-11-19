import {distance,type Point} from './config.js';
import {unitSpec} from './catalog.js';
import type {Base,Unit} from './simulation.js';

/** Garrisoned soldiers remain paid, real units, not cloned turrets.
 * Their original HP/cooldowns/veterancy survive unloading and saving.
 */
export const BUNKER_CAPACITY=5;
export const BUNKER_MAX_FIRE_RANGE=390;
export const BUNKER_APPROACH_MARGIN=44;
export const BUNKER_EXIT_DISTANCE=101;

export function bunkerGarrisonedUnits(b:Base,units:readonly Unit[]):Unit[]{
 if(b.kind!=='bunker'||b.hp<=0)return [];
 const ids=new Set(b.garrison??[]);
 return units.filter(u=>ids.has(u.id)&&u.carrier===b.id&&
  u.hp>0&&u.owner===b.owner&&unitSpec(u).group==='Infanterie');
}

export function bunkerCanBoard(b:Base,u:Unit,units:readonly Unit[]):boolean{
 if(b.kind!=='bunker'||b.hp<=0||b.buildRemaining>0||
    u.owner!==b.owner||u.hp<=0||u.carrier||
    unitSpec(u).group!=='Infanterie')return false;
 const claimed=(b.garrison?.length??0)+units.filter(v=>
  v.hp>0&&!v.carrier&&v.orders[0]?.kind==='garrison'&&
  v.orders[0].target===b.id).length;
 return claimed<BUNKER_CAPACITY;
}

export function bunkerApproach(b:Base,u:Point):Point{
 const dx=u.x-b.x,dy=u.y-b.y,angle=Math.atan2(dy,dx);
 const gap=b.radius+BUNKER_APPROACH_MARGIN;
 return {x:b.x+Math.cos(angle)*gap,y:b.y+Math.sin(angle)*gap};
}

/** Check persisted garrison manifests without confusing them with rovers'
 * and helicopters' separate, existing cargo systems.
 */
export function validBunkerGarrisons(bases:readonly Base[],units:readonly Unit[]):boolean{
 const seen=new Set<number>();
 for(const b of bases){
  if(b.garrison===undefined)continue;
  if(b.kind!=='bunker'||!Array.isArray(b.garrison)||
   b.garrison.length>BUNKER_CAPACITY||new Set(b.garrison).size!==b.garrison.length)
   return false;
  for(const id of b.garrison){
   if(!Number.isSafeInteger(id)||id<0||seen.has(id))return false;
   const u=units.find(p=>p.id===id);
   if(!u||u.hp<=0||u.owner!==b.owner||u.carrier!==b.id||
    unitSpec(u).group!=='Infanterie')return false;
   seen.add(id);
  }
 }
 for(const u of units){
  if(u.orders.some(o=>o.kind==='garrison'&&
    (!Number.isSafeInteger(o.target)||!bases.some(b=>
      b.id===o.target&&b.kind==='bunker'&&b.owner===u.owner&&b.hp>0))))
   return false;
  const b=bases.find(b=>b.id===u.carrier&&b.kind==='bunker');
  if(b&&!seen.has(u.id))return false;
 }
 return true;
}

export function bunkerTargetRange(u:Unit):number{
 return Math.min(BUNKER_MAX_FIRE_RANGE,unitSpec(u).range+45);
}
export function bunkerExitPoints(b:Base):Point[]{
 return Array.from({length:20},(_,i)=>{
  const a=i*Math.PI*2/20+Math.PI/10;
  return {x:b.x+Math.cos(a)*BUNKER_EXIT_DISTANCE,
   y:b.y+Math.sin(a)*BUNKER_EXIT_DISTANCE};
 });
}
