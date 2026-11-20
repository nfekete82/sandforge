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
 'desert-strike':Object.freeze({lakes:2,rivers:1,min:185,max:255}),
 'broken-empire':Object.freeze({lakes:1,rivers:1,min:155,max:205})
});
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
 // A river joins the largest real lagoon, runs within legal open terrain
 // and ends before it reaches any road, HQ, Bastion or cliff. It is NOT a
 // decorative line across the tactical map or the black world boundary.
 for(const lake of lakes.slice(0,type.rivers)){
  let selected=null;
  for(let attempt=0;attempt<160&&!selected;attempt++){
   const a=random()*Math.PI*2,len=380+random()*310,phase=random()*6.283;
   const dx=Math.cos(a),dy=Math.sin(a),sx=-dy,sy=dx;
   const bend=65+random()*95,width=25+random()*17;
   const points=[];
   let valid=true;
   for(let i=0;i<=22;i++){
    const t=i/22;
    const d=lake.radius*.55+t*len;
    const sideways=(Math.sin(t*4.3+phase)-Math.sin(phase))*
      bend*t*(1-.45*t);
    const p={x:lake.x+dx*d+sx*sideways,y:lake.y+dy*d+sy*sideways};
    // River head overlaps its lagoon. Samples farther downstream use the
    // same hard constraints as the lake, with a narrower bank clearance.
    if(t>.22&&!safe(p,width+34,lake)){valid=false;break;}
    if(p.x<95||p.y<95||p.x>size-95||p.y>size-95){valid=false;break;}
    points.push(Object.freeze(p));
   }
   if(valid){
    selected=Object.freeze({id:'river-'+rivers.length,
     lakeId:lake.id,points:Object.freeze(points),
     width,phase,seed:Math.floor(random()*0xffffffff)});
   }
  }
  if(selected)rivers.push(selected);
 }
 return Object.freeze({mapId,lakes:Object.freeze(lakes),rivers:Object.freeze(rivers)});
}
