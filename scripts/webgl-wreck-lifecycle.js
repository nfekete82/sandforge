/** Cosmetic destruction never changes the authoritative simulation.
 * Kind-specific durations keep heavy armor readable longer than light
 * vehicles. Limits are fixed to prevent visual accumulation in long matches.
 */
export const WRECK_LIFETIME_SECONDS=28;
export const WRECK_LIFETIMES=Object.freeze({
 supply:18,rover:21,scout:27,artillery:32,tank:35,bomber:35
});
export const WRECK_CAP=24;
export const WRECK_CAP_LITE=12;
export const CRASH_LIFETIME_SECONDS=2.1;
export const CRASH_CAP=6;
export const isWreckableUnit=kind=>
 ['tank','rover','supply','artillery','scout','bomber'].includes(kind);
export const isAircraftWreck=kind=>kind==='scout'||kind==='bomber';
export const wreckDurationFor=kind=>
 WRECK_LIFETIMES[kind]??WRECK_LIFETIME_SECONDS;
export function addWreckRecord(records,unit,max=WRECK_CAP){
 if(!isWreckableUnit(unit.kind)||!Number.isFinite(unit.x)||!Number.isFinite(unit.y))return false;
 records.push({kind:unit.kind,x:unit.x,y:unit.y,yaw:unit.angle??unit.yaw??0,
  age:0,ttl:wreckDurationFor(unit.kind)});
 if(records.length>max)records.shift();
 return true;
}
export function advanceWreckRecords(records,dt){
 if(!(dt>0))return false;
 let updated=false;
 for(const wreck of records){wreck.age+=dt;updated=true;}
 for(let i=records.length-1;i>=0;i--)
  if(records[i].age>=records[i].ttl)records.splice(i,1);
 return updated;
}
export const wreckSink=record=>{
 const left=record.ttl-record.age;
 return left<2.5?Math.max(0,2.5-left)*3.4:0;
};
/** Smoke and a tiny ember dissipate without holding GPU emitters for 35s. */
export const wreckSmokeFraction=record=>
 Math.max(0,Math.min(1,1-record.age/
  (record.kind==='tank'||record.kind==='bomber'?8:5)));
