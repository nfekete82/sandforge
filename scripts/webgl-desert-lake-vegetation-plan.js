import {desertWaterExclusion} from './webgl-desert-water-plan.js';

/** Deterministic natural lake-bank planting: lush water fringe, sparse desert
 * edge, no trees or dry cacti in water. Uses the SAME immutable lake layout
 * as the visible water mesh, without adding collision or save-game state.
 */
const ZONES=Object.freeze({
 'desert-strike':Object.freeze({palm:10,reeds:42,grass:32,shrub:18}),
 'broken-empire':Object.freeze({palm:7,reeds:34,grass:26,shrub:16})
});
const rand=seed=>{
 let x=(seed^0x43e8a9b7)>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
 ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};
function shorelinePoint(lake,angle,distanceRatio){
 const c=Math.cos(lake.rotation),s=Math.sin(lake.rotation);
 const contour=1+.095*Math.sin(angle*3+lake.phase)+
  .058*Math.sin(angle*7-lake.phase*1.5)+.026*Math.sin(angle*13+lake.phase*.9);
 const dx=Math.cos(angle)*lake.radius*distanceRatio*contour;
 const dy=Math.sin(angle)*lake.radius*(lake.aspect??1)*distanceRatio*contour;
 return {x:lake.x+dx*c-dy*s,y:lake.y+dx*s+dy*c};
}
export function planDesertLakeVegetation({
 world,terrain=world?.generated,layout,mapId,seed=world?.seed??0,lowQuality=false
}={}){
 const targets=ZONES[mapId],lakes=layout?.lakes??[];
 if(!targets||!lakes.length||!world||!terrain?.battlefield)return [];
 const r=rand(seed^0x8db26d4e),out=[];
 const roads=terrain.roads??[],sites=terrain.sites??[],ruins=terrain.ruins??[];
 for(const [lakeIndex,lake] of lakes.entries()){
  for(const kind of ['reeds','grass','shrub','palm']){
   const target=lowQuality?Math.ceil(targets[kind]*.55):targets[kind];
   const region=kind==='reeds'?[1.51,1.75]:
    kind==='grass'?[1.58,1.95]:
    kind==='shrub'?[1.72,2.18]:[1.79,2.26];
   // Several small overlapping natural stands, never a symmetrical ring.
   const arcCenters=Array.from({length:kind==='palm'?3:5},()=>r()*Math.PI*2);
   let placed=0;
   for(let attempt=0;attempt<target*170&&placed<target;attempt++){
    const focus=arcCenters[Math.floor(r()*arcCenters.length)];
    const angle=r()<.77?focus+(r()-.5)*1.2:r()*Math.PI*2;
    const p=shorelinePoint(lake,angle,region[0]+r()*(region[1]-region[0]));
    const margin=kind==='palm'?16:kind==='shrub'?10:0;
    // Reject all shoreline intersections, even in the conservative
    // worst-case ripple contour and beyond the outer wet-bank mesh.
    if(desertWaterExclusion(p,layout,{margin}))continue;
    const b=kind==='palm'?48:15;
    if(p.x<b+140||p.y<b+140||p.x>world.size-b-140||p.y>world.size-b-140)continue;
    if(sites.some(s=>distance(s,p)<(kind==='palm'?450:350)))continue;
    if(ruins.some(s=>distance(s,p)<Math.max(s.width??0,s.depth??0)*.6+65))continue;
    if(roads.some(road=>road.slice(1).some((b,i)=>
      segmentDistance(p,road[i],b)<(kind==='palm'?120:65))))continue;
    if(!world.walkable(p,[],kind==='palm'?18:8))continue;
    if(world.terrainSlope(p.x,p.y)>(kind==='palm'?.105:.16))continue;
    const gap=kind==='palm'?59:kind==='shrub'?27:kind==='reeds'?13:14;
    if(out.some(v=>distance(v,p)<(v.kind==='palm'?gap*.95:gap)))continue;
    out.push(Object.freeze({
     ...p,kind,lakeId:lake.id,lakeIndex,
     rotation:r()*Math.PI*2,
     scale:kind==='palm'?.73+r()*.31:
      kind==='reeds'?.63+r()*.64:
      kind==='grass'?.65+r()*.65:.80+r()*.64,
     tint:.80+r()*.20,tilt:kind==='palm'?(r()-.5)*.055:0
    }));
    placed++;
   }
  }
 }
 return Object.freeze(out);
}
