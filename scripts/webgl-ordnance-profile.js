/** Visual-only weapon signatures. All timings, damage, scatter and blast
 * ownership are still governed by Simulation.missiles / Simulation.blasts.
 * Keep the bright effects short enough to read from the RTS camera.
 */
export const ORDNANCE_TRAIL_SEGMENTS=6;
export const ORDNANCE_VISUALS=Object.freeze({
 tank:Object.freeze({body:.76,exhaust:.83,streak:.95,smokeRate:.085,smokeSize:12,muzzleFlash:37,impactScale:.87}),
 artillery:Object.freeze({body:1.18,exhaust:1.32,streak:1.35,smokeRate:.048,smokeSize:19,muzzleFlash:30,impactScale:1.06}),
 rocket:Object.freeze({body:.56,exhaust:.66,streak:.64,smokeRate:.085,smokeSize:10,muzzleFlash:16,impactScale:.76}),
 scoutRocket:Object.freeze({body:.40,exhaust:.46,streak:.42,smokeRate:.13,smokeSize:7,muzzleFlash:12,impactScale:.40}),
 bomb:Object.freeze({body:1.0,exhaust:0,streak:0,smokeRate:.10,smokeSize:9,muzzleFlash:0,impactScale:1.23}),
 default:Object.freeze({body:.85,exhaust:1.0,streak:.83,smokeRate:.07,smokeSize:12,muzzleFlash:24,impactScale:1})
});
export function ordnanceVisualKind(missile,sourceKind){
 if(missile?.type==='bomb')return 'bomb';
 if(missile?.type==='scoutRocket')return 'scoutRocket';
 if(sourceKind==='tank'||sourceKind==='artillery'||sourceKind==='rocket')
  return sourceKind;
 return 'default';
}
export function ordnanceVisualProfile(missile,sourceKind){
 return ORDNANCE_VISUALS[ordnanceVisualKind(missile,sourceKind)];
}
/** Bound retained points to prevent unbounded work after artillery barrages.
 * A new point is appended at ~7 world units of travel to avoid tiny segments.
 */
export function appendOrdnanceTrail(history,point,max=ORDNANCE_TRAIL_SEGMENTS){
 const list=history??[];
 const last=list[0];
 if(!last||last.distanceToSquared(point)>49){
  list.unshift(point.clone());
  if(list.length>max)list.length=max;
 }
 return list;
}
