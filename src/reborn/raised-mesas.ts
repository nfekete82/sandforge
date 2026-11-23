import type {Point} from './config.js';

/** New, opt-in v7 physical mesas. Old maps and save geometry never use these. */
export interface RaisedMesa {
 center:Point; topRadius:number; footRadius:number;
 height:number; rampEnd:number; rampWidth:number;
 direction:Point; ramps?:Point[]; seed:number; siteIndex:number;
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};

/** Shared 9/5-fold eroded outline for the actual heightfield AND cliff facade. */
export function mesaRadiusFactor(theta:number,mesa:RaisedMesa):number{
 const phase=mesa.seed*.00047+mesa.siteIndex*1.7;
 return 1+.045*Math.sin(theta*5+phase)+.025*Math.cos(theta*9-phase*.8);
}
export function mesaLocation(p:Point,mesa:RaisedMesa){
 const dx=p.x-mesa.center.x,dy=p.y-mesa.center.y;
 const angle=Math.atan2(dy,dx);
 const radius=Math.hypot(dx,dy)/mesaRadiusFactor(angle,mesa);
 const along=dx*mesa.direction.x+dy*mesa.direction.y;
 const lateral=Math.abs(dx*mesa.direction.y-dy*mesa.direction.x);
 return {radius,along,lateral,angle};
}
/** A physical, staged approach via a REAL authored vehicle ramp.
 * A* otherwise returns a short partial route to the nearest cliff lip and
 * tanks drive into that same inaccessible edge for the rest of the game.
 *
 * This is stateless: location determines the current ramp stage. Never invent
 * an entrance, ignore cliff collision, or modify historical generator maps.
 * The caller must verify full vehicle clearance and real terrain slope.
 */
export function raisedMesaRouteWaypoint(
 from:Point,goal:Point,mesas:readonly RaisedMesa[],
 valid:(p:Point)=>boolean,lane=0
):Point|undefined {
 const d=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(const mesa of mesas){
  const startRadius=d(from,mesa.center),goalRadius=d(goal,mesa.center);
  const onTop=startRadius<mesa.topRadius*.96;
  const targetOnTop=goalRadius<mesa.topRadius*.96;
  if(onTop&&targetOnTop)continue;
  // Do not alter unrelated routes that skirt a mesa on driveable sand.
  const dx=goal.x-from.x,dy=goal.y-from.y,den=dx*dx+dy*dy;
  const t=den>0?Math.max(0,Math.min(1,
   ((mesa.center.x-from.x)*dx+(mesa.center.y-from.y)*dy)/den)):0;
  const approach={x:from.x+dx*t,y:from.y+dy*t};
  if(!onTop&&!targetOnTop&&d(approach,mesa.center)>mesa.footRadius-45)
   continue;
  // A tank advancing UP a ramp may be 300m from the initial outer marker.
  // The old radius-105 switch sent it BACK to that marker on the next A*
  // partial-route replan: outer -> inner -> outer -> ... at the cliff edge.
  // Classify occupancy of the actual authored corridor from physical
  // coordinates, never from the last path's ephemeral endpoint.
  const candidates=mesaRampDirections(mesa).map(direction=>{
   // Convoys may use 5 parallel driveable lanes. All are carved through
   // the existing ramp; this does not create new entrances or teleport
   // vehicles through the cliff. Default zero retains historical paths.
   let perp={x:-direction.y,y:direction.x};
   if(Math.abs(perp.y)>=Math.abs(perp.x)?perp.y<0:perp.x<0)
    perp={x:-perp.x,y:-perp.y};
   const lateralOffset=Math.max(-2,Math.min(2,lane))*
    Math.min(55,mesa.rampWidth*.13);
   const offset={x:perp.x*lateralOffset,y:perp.y*lateralOffset};
   const outer={x:mesa.center.x+direction.x*(mesa.rampEnd-140)+offset.x,
    y:mesa.center.y+direction.y*(mesa.rampEnd-140)+offset.y};
   const inner={x:mesa.center.x+direction.x*mesa.topRadius*.75+offset.x,
    y:mesa.center.y+direction.y*mesa.topRadius*.75+offset.y};
   const x=from.x-mesa.center.x,y=from.y-mesa.center.y;
   const along=x*direction.x+y*direction.y;
   const lateral=Math.abs(x*direction.y-y*direction.x);
   const inside=along>=mesa.topRadius*.73&&along<=mesa.rampEnd+70&&
    lateral<=mesa.rampWidth*.42;
   return {outer,inner,inside};
  }).filter(x=>valid(x.outer)&&valid(x.inner));
  if(!candidates.length)continue;
  // On the destination side of the rim, we are DESCENDING, not beginning
  // another ascent. Distinguish entrance and exit by current physical side,
  // so a mixed convoy does not bounce between the two ramp markers.
  const goalVector={x:goal.x-mesa.center.x,y:goal.y-mesa.center.y};
  const towardGoal=(from.x-mesa.center.x)*goalVector.x+
   (from.y-mesa.center.y)*goalVector.y>0;
  const leaving=!targetOnTop&&(onTop||
   startRadius<=mesa.footRadius+85&&towardGoal);
  // Inbound: preserve the current ramp. On the summit, however, the
  // incoming ramp is on the WRONG side of an across-mesa destination.
  // Outbound: switch to the target-side exit once, then keep that corridor.
  const stayInCurrentRamp=!leaving||towardGoal;
  candidates.sort((a,b)=>
   (stayInCurrentRamp?(a.inside===b.inside?0:a.inside?-1:1):0)||
   (leaving?d(a.outer,goal)-d(b.outer,goal):
    d(a.outer,from)-d(b.outer,from))||
   d(a.inner,goal)-d(b.inner,goal));
  const chosen=candidates[0];
  if(leaving){
   // Stay with the same real exit corridor after crossing the summit.
   return chosen.inside&&startRadius>=mesa.topRadius*.82
    ?chosen.outer
    :d(from,chosen.inner)>105?chosen.inner:chosen.outer;
  }
  // Once inside the entering corridor, NEVER reverse to the outer marker
  // just because the next A* segment ended or was budget-limited.
  return chosen.inside||d(from,chosen.outer)<=105?chosen.inner:chosen.outer;
 }
}

/** Explicit multi-entry plateaus are opt-in for v10; old saves still
 * have the original single direction and regenerate byte-identically. */
export function mesaRampDirections(mesa:RaisedMesa):readonly Point[]{
 return mesa.ramps?.length?mesa.ramps:[mesa.direction];
}
function directionCoverage(p:Point,mesa:RaisedMesa,d:Point){
 const dx=p.x-mesa.center.x,dy=p.y-mesa.center.y;
 const along=dx*d.x+dy*d.y;
 const lateral=Math.abs(dx*d.y-dy*d.x);
 if(along<mesa.topRadius-80||along>mesa.rampEnd+80)return 0;
 return 1-smooth((lateral-mesa.rampWidth*.56)/(mesa.rampWidth*.36));
}
export function mesaRampCoverage(p:Point,mesa:RaisedMesa):number{
 let coverage=0;
 for(const d of mesaRampDirections(mesa))
  coverage=Math.max(coverage,directionCoverage(p,mesa,d));
 return coverage;
}
export function raisedMesaHeight(base:number,p:Point,mesa:RaisedMesa):number{
 const {radius}=mesaLocation(p,mesa);
 if(radius>mesa.rampEnd+100)return base;
 const cliff=1-smooth((radius-mesa.topRadius)/(mesa.footRadius-mesa.topRadius));
 // Exact historical single-ramp formulation is preserved for old v7-v9
 // mesas. V10 picks the most open authored entrance on each cliff side.
 let coverage=0,along=0;
 for(const d of mesaRampDirections(mesa)){
  const c=directionCoverage(p,mesa,d);
  if(c>coverage){
   coverage=c;
   along=(p.x-mesa.center.x)*d.x+(p.y-mesa.center.y)*d.y;
  }
 }
 const ramp=clamp((mesa.rampEnd-along)/(mesa.rampEnd-mesa.topRadius));
 const lift=cliff*(1-coverage)+ramp*coverage;
 return base+(mesa.height-base)*lift;
}
/** Physically impassable cliff band surrounding an otherwise buildable top.
 * Never gate cliff collision on sampled per-triangle slope: that created
 * unblocked single cells *inside* the steep rocky wall, which were cut off
 * from the entire battlefield and failed the isolated-ground validation.
 *
 * The only opening is the same authored, wide downhill vehicle ramp whose
 * physical height profile is shared with WebGL. No invisible new shortcuts.
 */
export function raisedMesaCliffBlocked(p:Point,mesa:RaisedMesa,_slope:number):boolean{
 const {radius}=mesaLocation(p,mesa);
 if(radius<mesa.topRadius-45||radius>mesa.footRadius+55)return false;
 if(mesaRampCoverage(p,mesa)>.72)return false;
 return true;
}
