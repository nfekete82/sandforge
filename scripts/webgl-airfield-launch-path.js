/** Deterministic visual departure policy for ONE real produced aircraft.
 * Never changes production cost, queue timing, collision, orders or saves.
 * The Simulation places the authoritative actor at the final handoff point;
 * the WebGL presenter holds it there until this animation reaches that point.
 */
export const AIRFIELD_LAUNCH_TIMING=Object.freeze({
 warning:.25,opening:1.05,bomberTaxi:6.5,heliTaxi:3.35,
 bomberClimb:2.5,heliClimb:2.2,closing:.8
});
export const AIRFIELD_LAUNCH_REVISION='pbr-aircraft-departure-v1';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
export function airfieldLaunchDuration(kind){
 if(kind!=='scout'&&kind!=='bomber')return 0;
 const t=AIRFIELD_LAUNCH_TIMING;
 return t.warning+t.opening+(kind==='bomber'?t.bomberTaxi:t.heliTaxi)+
  (kind==='bomber'?t.bomberClimb:t.heliClimb)+t.closing;
}
export function airfieldLaunchPose(kind,age){
 const t=AIRFIELD_LAUNCH_TIMING;
 const total=airfieldLaunchDuration(kind);
 if(!total)return null;
 const taxi=kind==='bomber'?t.bomberTaxi:t.heliTaxi;
 const climb=kind==='bomber'?t.bomberClimb:t.heliClimb;
 const openEnd=t.warning+t.opening,taxiEnd=openEnd+taxi,climbEnd=taxiEnd+climb;
 const a=Math.max(0,age);
 if(a<t.warning)
  return {stage:'warning',open:0,taxi:0,lift:0,done:false,visible:false};
 if(a<openEnd)
  return {stage:'opening',open:smooth((a-t.warning)/t.opening),
   taxi:0,lift:0,done:false,visible:false};
 if(a<taxiEnd)
  return {stage:'taxi',open:1,taxi:clamp((a-openEnd)/taxi),
   lift:0,done:false,visible:true};
 if(a<climbEnd)
  return {stage:'takeoff',open:1-smooth((a-taxiEnd)/Math.min(.85,climb)),
   taxi:1,lift:smooth((a-taxiEnd)/climb),done:false,visible:true};
 return {stage:a>=total?'done':'closing',open:0,taxi:1,
  lift:1,done:a>=total,visible:true};
}
/** Positions are in the authoritative airfield-maintenance waypoint system.
 * Helicopters take off just ahead of the hangar; bombers taxi to the runway,
 * line up and accelerate along it. No additional hangar slot is created.
 */
export function airfieldLaunchLeg(kind,pose){
 if(!pose)return null;
 if(pose.stage==='takeoff'||pose.stage==='closing'||pose.stage==='done')
  return kind==='bomber'?{from:'taxi',to:'departure',t:pose.lift}:
   {from:'lineup',to:'lineup',t:1};
 const stops=kind==='bomber'?[
  {from:'dock',to:'door',end:.38},
  {from:'door',to:'lineup',end:.63},
  {from:'lineup',to:'taxi',end:1}
 ]:[
  {from:'dock',to:'door',end:.60},
  {from:'door',to:'lineup',end:1}
 ];
 let previous=0;
 for(const stage of stops){
  if(pose.taxi<=stage.end)
   return {from:stage.from,to:stage.to,
    t:clamp((pose.taxi-previous)/(stage.end-previous))};
  previous=stage.end;
 }
 return {from:stops.at(-1).to,to:stops.at(-1).to,t:1};
}
