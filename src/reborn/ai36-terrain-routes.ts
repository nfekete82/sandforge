import type {Point} from './config.js';
import type {CanyonRidge} from './canyon-front.js';

const length=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Deterministic, allocation-light cost estimate for choosing PAID attackers
 * across procedural-v3 canyon walls. This is NOT a pathfinder. World.path
 * remains the authority for collision, obstacles, risk and the final order.
 *
 * The cost follows public static terrain, never hidden enemy units. Only
 * callers explicitly on generator v3 may apply it, so old maps/AI A/B runs
 * preserve their established unit-selection order and save structure.
 */
export function ridgeHeightAtX(ridge:Pick<CanyonRidge,'spine'>,x:number):number{
 const line=ridge.spine;
 if(!line.length)return 0;
 if(x<=line[0].x)return line[0].y;
 for(let i=1;i<line.length;i++)if(x<=line[i].x){
  const a=line[i-1],b=line[i],dx=b.x-a.x;
  if(Math.abs(dx)<1e-6)return (a.y+b.y)*.5;
  const t=Math.min(1,Math.max(0,(x-a.x)/dx));
  return a.y+(b.y-a.y)*t;
 }
 return line[line.length-1].y;
}

export function terrainAwareTravelEstimate(from:Point,to:Point,
 ridges:readonly CanyonRidge[]):number{
 let estimate=length(from,to);
 for(const ridge of ridges){
  if(!ridge.ramps.length||ridge.spine.length<2)continue;
  const fromSide=from.y-ridgeHeightAtX(ridge,from.x);
  const toSide=to.y-ridgeHeightAtX(ridge,to.x);
  // If a point is already ON the cliff, defer to World.path. This also
  // prevents meaningless penalties near the protected flat Bastion pads.
  if(fromSide*toSide>=0||
    Math.abs(fromSide)<ridge.width*.5||
    Math.abs(toSide)<ridge.width*.5)continue;
  // If the direct line already uses a real pass (or a protected Bastion
  // clearing), there is no extra canyon detour to charge. Similarly a
  // route outside the ridge endpoints can go around the natural cliff tip.
  let lo=0,hi=1;
  for(let i=0;i<14;i++){
   const t=(lo+hi)*.5;
   const p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
   if((p.y-ridgeHeightAtX(ridge,p.x))*fromSide>0)lo=t;
   else hi=t;
  }
  const crossing={x:from.x+(to.x-from.x)*(lo+hi)*.5,
   y:from.y+(to.y-from.y)*(lo+hi)*.5};
  if(crossing.x<ridge.spine[0].x-ridge.width||
     crossing.x>ridge.spine[ridge.spine.length-1].x+ridge.width||
     ridge.ramps.some(pass=>Math.abs(crossing.x-pass.x)<pass.width*.5)||
     ridge.clearings?.some(zone=>length(crossing,zone.point)<zone.radius+ridge.width))
   continue;
  const side=Math.sign(fromSide);
  const offset=ridge.width+70;
  let through=Infinity;
  for(const pass of ridge.ramps){
   const y=ridgeHeightAtX(ridge,pass.x);
   const before={x:pass.x,y:y+side*offset};
   const after={x:pass.x,y:y-side*offset};
   const cost=length(from,before)+2*offset+length(after,to);
   through=Math.min(through,cost);
  }
  if(Number.isFinite(through))estimate=Math.max(estimate,through);
 }
 return estimate;
}

/** On large v3 maps a bounded A* can repeatedly terminate on a canyon
 * face instead of finding a distant legal pass. Return a deterministic
 * *temporary* navigation goal, never a teleport or an obstacle bypass.
 * Movement still uses World.path/line and the real slope/collision rules.
 * No knowledge of enemy units, bases or Fog of War is required.
 */
export function canyonPassWaypoint(from:Point,to:Point,
 ridges:readonly CanyonRidge[],clearance=0,
 traversable?:(near:Point,far:Point)=>boolean):Point|undefined{
 let best:{point:Point;cost:number}|undefined;
 for(const ridge of ridges){
  if(ridge.spine.length<2||!ridge.ramps.length)continue;
  const a=from.y-ridgeHeightAtX(ridge,from.x);
  const b=to.y-ridgeHeightAtX(ridge,to.x);
  const margin=ridge.width*.5+Math.max(24,clearance);
  // A unit embedded in the cliff needs the ordinary collision recovery.
  if(a*b>=0||Math.abs(a)<margin*.55||Math.abs(b)<margin*.55)continue;
  let lo=0,hi=1;
  for(let i=0;i<16;i++){
   const t=(lo+hi)*.5;
   const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;
   if((y-ridgeHeightAtX(ridge,x))*a>0)lo=t;
   else hi=t;
  }
  const x=from.x+(to.x-from.x)*(lo+hi)*.5;
  const first=ridge.spine[0].x,last=ridge.spine[ridge.spine.length-1].x;
  // Crossing around a ridge tip or already through a pass is legitimate.
  if(x<first-ridge.width||x>last+ridge.width||
    (!traversable&&ridge.ramps.some(pass=>Math.abs(x-pass.x)<pass.width*.42)))continue;
  const crossing={x,y:ridgeHeightAtX(ridge,x)};
  if(ridge.clearings?.some(zone=>length(crossing,zone.point)<zone.radius+ridge.width))continue;
  const side=Math.sign(a),offset=ridge.width*.5+Math.max(105,clearance+65);
  for(const pass of ridge.ramps){
   const y=ridgeHeightAtX(ridge,pass.x);
   const near={x:pass.x,y:y+side*offset};
   const far={x:pass.x,y:y-side*offset};
   // A physical movement caller may reject a shorter but untraversable
   // pass using the real slope/collision rules. Older callers are unchanged.
   if(traversable&&!traversable(near,far))continue;
   // First reach a flat pass entrance, then cross the ramp. Once the unit
   // is beyond it, a new call goes straight to its original target.
   const goal=length(from,near)>Math.max(52,clearance+42)?near:far;
   const cost=length(from,near)+2*offset+length(far,to);
   if(!best||cost<best.cost)best={point:goal,cost};
  }
 }
 return best?.point;
}

export function rankTerrainRecaptureSquad<T extends Point&{id:number}>(
 units:readonly T[],target:Point,ridges:readonly CanyonRidge[],count:number
):T[]{
 return units.slice().sort((a,b)=>
  terrainAwareTravelEstimate(a,target,ridges)-
   terrainAwareTravelEstimate(b,target,ridges)||
  length(a,target)-length(b,target)||a.id-b.id
 ).slice(0,Math.max(0,Math.floor(count)));
}
