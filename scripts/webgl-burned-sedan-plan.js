/** Seeded cosmetic Sedan wreck placements for the four named desert maps.
 * This planner NEVER touches Simulation, World.blocked, roads, terrain, or saves.
 * Every car stands entirely inside the playable boundary, out of the road
 * centerline and away from the HQ, Bastion and build clearings.
 */
export const BURNED_SEDAN_ART_VERSION='burned-sedan-3d-v1-20261120';
export const BURNED_SEDAN_COUNTS=Object.freeze({
 'desert-strike':3,'broken-empire':4,
 'burning-horizon':5,'last-stronghold':6
});
const sq=(x,y)=>x*x+y*y;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy||1;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
function randomFrom(seed){
 let x=(seed^0x55a33d29)>>>0;
 return ()=>{
  x=(Math.imul(x,1664525)+1013904223)>>>0;
  return x/4294967296;
 };
}
export function planBurnedSedans({world,terrain=world?.generated,seed=world?.seed??0,mapId=null,lowQuality=false}={}){
 const count=BURNED_SEDAN_COUNTS[mapId];
 if(!count||!world||!terrain?.battlefield||!terrain?.sites)return [];
 const random=randomFrom(seed^Math.imul(count,0x9e3779b9));
 const target=lowQuality?Math.max(2,Math.ceil(count*.50)):count;
 const sites=terrain.sites,ruins=terrain.ruins??[],roads=terrain.roads??[];
 const out=[],size=world.size,margin=240;
 for(let attempt=0;attempt<1400&&out.length<target;attempt++){
  const besideRuin=ruins.length>0&&attempt<950;
  const ruin=besideRuin?ruins[Math.floor(random()*ruins.length)]:null;
  const bearing=random()*Math.PI*2,
   offset=ruin?(Math.max(ruin.width,ruin.depth)*.68+112+random()*105):0;
  const x=ruin?ruin.x+Math.cos(bearing)*offset:
   margin+random()*(size-2*margin);
  const y=ruin?ruin.y+Math.sin(bearing)*offset:
   margin+random()*(size-2*margin);
  const p={x,y};
  if(x<margin||y<margin||x>size-margin||y>size-margin)continue;
  // Keep Bastion capture circles, possible HQ building pads, and bases clear.
  if(sites.some(site=>distance(site,p)<940))continue;
  if(ruins.some(r=>distance(p,r)<Math.max(r.width,r.depth)*.60+75))continue;
  // The textured tracks are visual, but don't park a wreck directly
  // in a road centerline so friendly tanks won't drive through it.
  if(roads.some(road=>road.slice(1).some((b,i)=>
   segmentDistance(p,road[i],b)<115)))continue;
  if(out.some(v=>sq(v.x-x,v.y-y)<245*245))continue;
  if(!world.walkable(p,[],38)||world.terrainSlope(x,y)>.135)continue;
  const lean=(random()-.5)*.045;
  out.push(Object.freeze({
   x,y,angle:random()*Math.PI*2,
   scale:.87+random()*.20,lean,
   variant:(out.length+(Math.floor(random()*3)===0?1:0))%2,
   ruinAdjacent:Boolean(ruin)
  }));
 }
 return out;
}
