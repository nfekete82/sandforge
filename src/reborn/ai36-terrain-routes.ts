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

export function rankTerrainRecaptureSquad<T extends Point&{id:number}>(
 units:readonly T[],target:Point,ridges:readonly CanyonRidge[],count:number
):T[]{
 return units.slice().sort((a,b)=>
  terrainAwareTravelEstimate(a,target,ridges)-
   terrainAwareTravelEstimate(b,target,ridges)||
  length(a,target)-length(b,target)||a.id-b.id
 ).slice(0,Math.max(0,Math.floor(count)));
}
