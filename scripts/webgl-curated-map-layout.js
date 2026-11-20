/** Render-only art direction for Sandforge's three authored battlefields.
 * No Three.js or browser globals. The same pure planner can be tested in Node.
 * Geometric decorations never change World.blocked, routes, fog or saves.
 */
function randomSeed(seed){
 let s=(seed^0xb2a17319)>>>0;
 return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;n=Math.imul(n^(n>>>15),n|1);
  n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function ridgeAt(ridge,x){
 const spine=ridge.spine;if(!spine?.length)return 0;
 if(x<=spine[0].x)return spine[0].y;
 for(let i=1;i<spine.length;i++)if(x<=spine[i].x){
  const a=spine[i-1],b=spine[i];
  return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
 }
 return spine.at(-1).y;
}
function segmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
  ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
export const CURATED_ART_REVISION='art-directed-landmarks-v1-20261120';
export const CURATED_PALETTES=Object.freeze({
 staubkrone:Object.freeze({
  stone:'#d0b082',edge:'#f1d3a2',dark:'#594a3d',
  metal:'#465959',accent:'#59c0bc',moss:'#8f9568',
  ground:'#cfaa70',terrainMix:.12,sunTint:'#ffe2b0',
  identity:'Golden sandstone refinery, weathered aqueducts and palm groves'
 }),
 frostpforte:Object.freeze({
  stone:'#a0afbd',edge:'#e3edf0',dark:'#293742',
  metal:'#667888',accent:'#e7b66c',moss:'#8d9ea4',
  ground:'#a3bdc9',terrainMix:.13,sunTint:'#dbeeff',
  identity:'Glacial watchtowers, fortified mountain pass and winddrifts'
 }),
 schlangenfeste:Object.freeze({
  stone:'#868979',edge:'#c5b69a',dark:'#303c33',
  metal:'#746654',accent:'#76a97c',moss:'#426d46',
  ground:'#55754c',terrainMix:.13,sunTint:'#e1eac3',
  identity:'Ancient mossy cliff temples and thick tropical understory'
 })
});
export function planCuratedMapArt({preset,world,terrain,oases=[]}){
 if(!preset||!CURATED_PALETTES[preset.id]||!world||!terrain)return null;
 // Strong constraints keep scenic silhouettes away from build pads, actual
 // Bastion capture rings, authored roads and the vehicle corridor itself.
 const sites=terrain.sites??[],ruins=terrain.ruins??[],
  ridges=terrain.ridges??[],rng=randomSeed(preset.seed);
 const roadDistance=p=>(terrain.roads??[]).reduce((min,road)=>
  Math.min(min,...road.slice(1).map((b,i)=>segmentDistance(p,road[i],b))),Infinity);
 const siteDistance=p=>Math.min(...sites.map(s=>dist(s,p)),Infinity);
 const ruinDistance=p=>Math.min(...ruins.map(s=>dist(s,p)),Infinity);
 const roadFree=(p,buffer=145)=>roadDistance(p)>buffer;
 const buildFree=(p,buffer=730)=>siteDistance(p)>buffer;
 const within=p=>p.x>260&&p.y>260&&p.x<world.size-260&&p.y<world.size-260;
 const walk=p=>world.walkable(p)&&
  (!world.terrainSlope||world.terrainSlope(p.x,p.y)<.175);
 const landmarks=[],groundAccents=[];
 if(preset.id==='staubkrone'){
  const source=oases.length?oases:
   (terrain.battlefield?.basins??[]).map((p,i)=>({...p,radius:145,id:i}));
  const sorted=[...source].sort((a,b)=>dist(a,{x:world.size/2,y:world.size/2})-
   dist(b,{x:world.size/2,y:world.size/2}));
  for(const oasis of sorted.slice(0,4)){
   let chosen=null;
   for(let i=0;i<24;i++){
    const theta=i/24*Math.PI*2+(rng()-.5)*.22;
    const radius=Math.max(345,(oasis.radius??130)*2.4)+i%3*65;
    const p={x:oasis.x+Math.cos(theta)*radius,
     y:oasis.y+Math.sin(theta)*radius};
    if(!within(p)||!walk(p)||!roadFree(p,190)||
     !buildFree(p,680)||ruinDistance(p)<235||
     landmarks.some(q=>dist(p,q)<600))continue;
    chosen=p;break;
   }
   if(chosen)landmarks.push({...chosen,type:'desert-refinery',
    rotation:rng()*Math.PI*2,scale:.92+rng()*.18});
   if(landmarks.length>=2)break;
  }
 }else{
  // Reuse the actual seeded cliff spine. Every tower must stand ON a
  // blocked cliff ledge, not inside the driving/pass opening.
  const ridge=ridges[0];
  if(ridge)for(const [passIndex,pass] of ridge.ramps.entries()){
   for(const side of [-1,1]){
    let anchor=null;
    for(const extra of [90,130,185,230,310]){
     const x=pass.x+side*(pass.width*.5+ridge.width*.7+extra);
     const p={x,y:ridgeAt(ridge,x)};
     if(!within(p)||!buildFree(p,670)||ruinDistance(p)<130||
      !roadFree(p,125)||world.walkable(p))continue;
     anchor=p;break;
    }
    if(!anchor)continue; // Never plant an impassable monument on a real pass.
    landmarks.push({...anchor,
     type:preset.id==='frostpforte'?'winter-watchtower':'jungle-temple',
     passIndex,side,rotation:side>0?.17:-.17,
     scale:preset.id==='frostpforte'?.9:1.02});
   }
  }
 }
 // Render-only low-profile erosion / snowdrifts / tropical fern clusters.
 // Constrain large map decals to locations without mission or route markers.
 const max= preset.id==='staubkrone'?150:
  preset.id==='frostpforte'?220:480;
 for(let i=0,attempt=0;i<max&&attempt<max*28;attempt++){
  const p={x:280+rng()*(world.size-560),
   y:280+rng()*(world.size-560)};
  if(!within(p)||!roadFree(p,preset.id==='staubkrone'?92:120)||
   !buildFree(p,preset.id==='schlangenfeste'?535:480)||
   ruinDistance(p)<95||
   landmarks.some(l=>dist(p,l)<(preset.id==='staubkrone'?155:120)))continue;
  if(preset.id==='schlangenfeste'&&ridges.length){
   // Jungles grow thickest on canyon flanks rather than open base pads.
   const ridge=ridges[0];
   if(Math.abs(p.y-ridgeAt(ridge,p.x))>980)continue;
   if(!walk(p)&&!(world.index(p)>=0&&world.blocked[world.index(p)]))continue;
  }else if(!walk(p))continue;
  groundAccents.push({...p,rotation:rng()*Math.PI*2,
   scale:.72+rng()*.82,kind:preset.id==='staubkrone'?'dune-stone':
    preset.id==='frostpforte'?'snowdrift':'jungle-fern'});
  i++;
 }
 return {id:preset.id,name:preset.name,palette:CURATED_PALETTES[preset.id],
  landmarks,groundAccents,revision:CURATED_ART_REVISION};
}
