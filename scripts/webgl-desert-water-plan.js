/** Seeded, render-only placement of large natural water bodies.
 * Does not change authoritative World, terrain heights, collision, routes,
 * construction, fog, saves or faction information. In this first pass these
 * are shallow fordable floodplain waters, not strategic impassable barriers.
 */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const randomSeed=seed=>{
 let s=(seed^0x5a17d40b)>>>0;
 return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
};
const segmentDistance=(p,a,b)=>{
 const vx=b.x-a.x,vy=b.y-a.y,len=vx*vx+vy*vy||1;
 const t=clamp(((p.x-a.x)*vx+(p.y-a.y)*vy)/len,0,1);
 return Math.hypot(p.x-a.x-vx*t,p.y-a.y-vy*t);
};
const PLANS=Object.freeze({
 'desert-strike':Object.freeze({lakes:2,rivers:0,min:185,max:255}),
 'broken-empire':Object.freeze({lakes:1,rivers:0,min:155,max:205})
});
/** Use the exact visual footprint of lakes and winding rivers for vegetation
 * exclusion. The outer wet bank can extend 1.24x past the water's edge;
 * ripple contour can add 18%. No cactus, Joshua tree or dry scrub may touch
 * the bank or water, including after GLB scaling/rotation.
 */
export function desertWaterExclusion(point,layout,{margin=42}={}){
 if(!layout)return false;
 for(const lake of layout.lakes??[]){
  const dx=point.x-lake.x,dy=point.y-lake.y;
  const co=Math.cos(lake.rotation),si=Math.sin(lake.rotation);
  const a=dx*co+dy*si,b=-dx*si+dy*co;
  const radius=Math.hypot(a,b/(lake.aspect||1));
  // Rendered contour never exceeds 1+.095+.058+.026, and wet
  // shore reaches 1.24. Conservative margin for sculpted vegetation.
  if(radius<=lake.radius*1.24*1.18+margin)return true;
 }
 for(const river of layout.rivers??[]){
  const points=river.points??[];
  for(let i=1;i<points.length;i++){
   // Bank extends 1.48x beyond a variable-width stream. Tapered ends
   // are covered by this more conservative capsule test.
   if(segmentDistance(point,points[i-1],points[i])<=river.width*1.48*1.08+margin)
    return true;
  }
 }
 return false;
}

export function planDesertWaterways({mapId,world,terrain=world?.generated,
 seed=world?.seed??0,oases=[],lowQuality=false}={}){
 const type=PLANS[mapId];
 if(!type||!world?.generated?.battlefield||!terrain?.sites?.length)return {lakes:[],rivers:[],mapId};
 const random=randomSeed(seed^mapId.length*0x76f1563);
 const size=world.size,lakes=[],rivers=[],roads=terrain.roads??[],
  ruins=terrain.ruins??[],sites=terrain.sites??[],
  clearings=(terrain.ridges??[]).flatMap(r=>r.clearings??[]);
 const safe=(point,r,excludeLake=null)=>{
  if(point.x<r+105||point.y<r+105||point.x>size-r-105||point.y>size-r-105)return false;
  if(sites.some(p=>distance(p,point)<r+580))return false;
  if(ruins.some(p=>distance(p,point)<r+Math.max(p.width??0,p.depth??0)*.6+130))return false;
  if(clearings.some(p=>distance(p.point,point)<r+p.radius+65))return false;
  if(roads.some(road=>road.slice(1).some((end,i)=>segmentDistance(point,road[i],end)<r+110)))return false;
  if((terrain.corridors??[]).some(([a,b])=>segmentDistance(point,a,b)<r+85))return false;
  if(oases.some(p=>distance(p,point)<r+p.radius+85))return false;
  if(lakes.some(l=>l!==excludeLake&&distance(l,point)<r+l.radius*1.5+75))return false;
  // Check actual traversable terrain, not only the ellipse centre.
  for(let j=0;j<9;j++){
   const a=j*6.28318530718/8,off=j===8?0:r*.85;
   const p={x:point.x+Math.cos(a)*off,y:point.y+Math.sin(a)*off};
   if(!world.walkable(p,[],8)||world.terrainSlope(p.x,p.y)>.22)return false;
  }
  return true;
 };
 const basins=terrain.battlefield.basins??[];
 const wanted=lowQuality?Math.min(1,type.lakes):type.lakes;
 for(let attempt=0;attempt<2800&&lakes.length<wanted;attempt++){
  const basin=basins.length&&attempt<basins.length*4?
   basins[attempt%basins.length]:null;
  const r=type.min+random()*(type.max-type.min),angle=random()*Math.PI*2;
  const x=basin?basin.x+Math.cos(angle)*(25+random()*125):size*(.09+random()*.82);
  const y=basin?basin.y+Math.sin(angle)*(25+random()*125):size*(.09+random()*.82);
  const ellipse={id:'lake-'+lakes.length,x,y,radius:r,
   aspect:.70+random()*.40,rotation:random()*Math.PI,
   phase:random()*Math.PI*2,seed:Math.floor(random()*0xffffffff)};
  if(safe(ellipse,r*1.12))lakes.push(Object.freeze(ellipse));
 }
 // Intentionally no rivers. The ribbon streams did not look natural;
 // lakes and planted natural oasis shorelines are the only surface water.
 return Object.freeze({mapId,lakes:Object.freeze(lakes),rivers:Object.freeze(rivers)});
}
