import {desertEcoregion} from './webgl-desert-ecoregions.js';
import {desertWaterExclusion} from './webgl-desert-water-plan.js';
/** Seeded locations only. Never constructs gameplay obstacles or uses fogged
 * intel. Every decoration is optional, non-pickable and render-only.
 */
const randomSeed=seed=>{
 let s=(seed^0xc9f36171)>>>0;
 return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;
  return s/4294967296;};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distSegment=(p,a,b)=>{
 const dx=b.x-a.x,dz=b.y-a.y,k=(dx*dx+dz*dz)||1;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dz)/k));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dz);
};
export function planDesertEcoregion({
 mapId,world,terrain=world?.generated,seed=world?.seed??0,lowQuality=false,waterLayout=null
}={}){
 const region=desertEcoregion(mapId);
 if(!region||!world||!terrain?.battlefield)return [];
 const counts={sandstone:region.rocks,saguaro:region.saguaro,joshua:region.joshua};
 const random=randomSeed(seed^Math.imul(region.key.length,0x9e3779b9));
 const sites=terrain.sites??[],ruins=terrain.ruins??[],roads=terrain.roads??[];
 const size=world.size,margin=290,objects=[];
 const avoid=[...sites,...ruins].map((p,i)=>({
  x:p.x,y:p.y,r:i<sites.length?760:Math.max(p.width??0,p.depth??0)*.8+170
 }));
 for(const kind of ['sandstone','saguaro','joshua']){
  const target=lowQuality?Math.ceil(counts[kind]*.48):counts[kind];
  let count=0;
  // Reuse the SAME sculpted PBR GLBs and instance budget. Small natural
  // stands of stone/cacti/trees replace an evenly sprinkled point field.
  // New anchors are accepted real placements, so their patches inherit
  // existing build-pad, road, slope and black-border exclusion rules.
  const patchAnchors=[];
  for(let attempt=0;attempt<target*120&&count<target;attempt++){
   const patchCenter=patchAnchors.length&&random()<.68
    ?patchAnchors[Math.floor(random()*patchAnchors.length)]:null;
   const direction=random()*Math.PI*2;
   const patchRadius=kind==='sandstone'?190+random()*250:145+random()*200;
   const x=patchCenter?patchCenter.x+Math.cos(direction)*patchRadius:
    margin+random()*(size-margin*2);
   const y=patchCenter?patchCenter.y+Math.sin(direction)*patchRadius:
    margin+random()*(size-margin*2);
   if(x<=margin||y<=margin||x>=size-margin||y>=size-margin)continue;
   const p={x,y};
   if(avoid.some(site=>distance(site,p)<site.r))continue;
   // No decorative GLB sandstone, cactus, or trees embedded in the single
   // contiguous plateau/cliff presentation. A clearance band also prevents
   // half-hidden boulders along the sloping talus at the mountain's foot.
   if((terrain.ridges??[]).some(ridge=>
     (ridge.spine??[]).slice(1).some((q,i)=>
       distSegment(p,ridge.spine[i],q)<ridge.width*2.1+(kind==='sandstone'?90:65))))continue;
   // Do not bury small decorative rocks inside the real elevated mesa skin.
   // A generous margin keeps talus and the vehicle ramp free of 3D props.
   if((terrain.plateaus??[]).some(mesa=>
     Math.hypot(x-mesa.center.x,y-mesa.center.y)<mesa.footRadius+130))continue;
   // Prevent all genuine 3D succulents / dry trees / rocks from floating
   // in lagoons, rivers or the muddy banks. Water is planned BEFORE props.
   if(desertWaterExclusion(p,waterLayout,{margin:kind==='sandstone'?26:49}))continue;
   // Plants and rocks cannot sit on an obvious visual vehicle route or
   // a building pad, even though they never change the true pathfinder.
   if(roads.some(road=>road.slice(1).some((q,i)=>
    distSegment(p,road[i],q)<(kind==='sandstone'?180:145))))continue;
   if(!world.walkable(p,[],kind==='sandstone'?20:22))continue;
   const slope=world.terrainSlope(x,y);
   if(slope>(kind==='sandstone'?.27:.135))continue;
   if(kind==='sandstone'&&slope<.025&&random()<.68)continue;
   if(kind==='saguaro'&&slope>.08&&random()<.7)continue;
   const cluster=Math.sin(x*.0027+seed*.00011)*Math.cos(y*.0032-seed*.0001);
   if(kind!=='sandstone'&&cluster<-.31)continue;
   const radius=kind==='sandstone'?190:kind==='saguaro'?135:150;
   if(objects.some(o=>distance(o,p)<(o.kind===kind?radius:radius*.73)))continue;
   const scale=.75+random()*.50;
   objects.push(Object.freeze({
    kind,x,y,angle:random()*Math.PI*2,
    scale,lean:(random()-.5)*.045,mapId
   }));
   // One independently located anchor per small group (~6 instances).
   // This avoids huge artificial rows while preserving sparse open areas.
   if(count%6===0)patchAnchors.push(p);
   count++;
  }
 }
 return objects;
}
