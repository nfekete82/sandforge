import type {Point} from './config.js';
import type {CanyonRidge} from './canyon-front.js';
import type {RaisedMesa} from './raised-mesas.js';
import {streamSeed,TERRAIN_GRADING_V3} from './battlefield-terrain.js';

/** Seeded road topology and physical mountain passes for generator v3.
 * Roads are visual guides on the *real* navigation surface; ridge gaps are
 * openings in World.blocked, not an independent or decorative collision map. */
export type LandscapeKind='open-basin'|'broken-escarpment'|'diagonal-ridge'|'serpentine-canyon'|'plateau-crossroads'|'mesa-highlands';
export const LANDSCAPE_LABELS:Record<LandscapeKind,string>={
 'open-basin':'Weites Dünenmeer',
 'broken-escarpment':'Felsdurchbruch',
 'diagonal-ridge':'Diagonalkamm',
 'serpentine-canyon':'Schlangenpass',
 'plateau-crossroads':'Plateau-Kreuzung',
 'mesa-highlands':'Mesa-Hochland'
};
export interface LandscapeNetwork {
  ridges:CanyonRidge[];
  roads:Point[][];
  plateaus?:RaisedMesa[];
  kind?:LandscapeKind;
}

function random(seed:number):()=>number{
  let state=seed>>>0;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let n=state;
    n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
    return ((n^(n>>>14))>>>0)/4294967296;};
}
function ridgeHeightAt(ridge:CanyonRidge,x:number):number{
  const line=ridge.spine;
  if(x<=line[0].x)return line[0].y;
  for(let i=1;i<line.length;i++)if(x<=line[i].x){
    const a=line[i-1],b=line[i],t=(x-a.x)/(b.x-a.x);
    return a.y+(b.y-a.y)*t;
  }
  return line[line.length-1].y;
}
function distance(a:Point,b:Point):number{return Math.hypot(a.x-b.x,a.y-b.y);}

/** The road graph is connected through all neighboring Bastion sites.
 * The mountains deliberately interrupt direct lanes, so some paths bend to
 * a visible pass instead of painting roads across an impassable cliff. */
export function generateLandscapeNetwork(seed:number,size:number,sites:readonly Point[],
  columns:number,rows:number,candidate=0,homes:readonly Point[]=[],version=3):LandscapeNetwork{
  // Generator 3 is frozen for existing saves and benchmark seeds.
  if(version===8)return expandedClassicHighlands(seed,size,sites,columns,rows,candidate,homes);
  if(version===7)return playableMesaHighlands(seed,size,sites,columns,rows,candidate,homes);
  if(version===6)return authoredPlateauNetwork(seed,size,sites,columns,rows,candidate,homes);
  if(version>=4)return variedLandscape(seed,size,sites,columns,rows,candidate,homes);
  const r=random(streamSeed(seed,'landscape-network',candidate));
  const seamRow=Math.max(1,Math.floor(rows/2));
  const seam=size*seamRow/rows;
  const phase=r()*Math.PI*2,phase2=r()*Math.PI*2,sign=r()<.5?-1:1;
  const spine=Array.from({length:35},(_,i)=>{
    const t=i/34,x=size*(.075+t*.85);
    return {x,y:seam+sign*(Math.sin(t*Math.PI*2+phase)*72+
      Math.sin(t*Math.PI*6+phase2)*24)};
  });
  const upper=seamRow-1,lower=seamRow;
  // Opposing start corners receive mirrored crossing choices.
  const passes=columns<=2?[0,1]:r()<.5?[0,3]:[1,2];
  const width=Math.max(340,Math.min(620,size/columns*.37));
  const ridge:CanyonRidge={
    spine,width:118,height:122,
    // The exact same protected circles are respected by collision and WebGL.
    clearings:[
      ...sites.map(point=>({point,radius:TERRAIN_GRADING_V3.bastionFlatRadius+140})),
      ...homes.map(point=>({point,radius:TERRAIN_GRADING_V3.homeFlatRadius+150}))
    ],
    ramps:passes.map(col=>{
      const x=(sites[upper*columns+col].x+sites[lower*columns+col].x)*.5;
      return {x:Math.max(size*.12,Math.min(size*.88,x)),width};
    }).sort((a,b)=>a.x-b.x)
  };
  const roads:Point[][]=[];
  for(let i=0;i<sites.length;i++){
    for(const next of [i%columns<columns-1?i+1:-1,i+columns<sites.length?i+columns:-1]){
      if(next<0)continue;
      const a=sites[i],b=sites[next];
      const crossing=(a.y-seam)*(b.y-seam)<0;
      if(crossing){
        const midX=(a.x+b.x)*.5;
        const gap=ridge.ramps.reduce((best,p)=>
          Math.abs(p.x-midX)<Math.abs(best.x-midX)?p:best,ridge.ramps[0]);
        const gy=ridgeHeightAt(ridge,gap.x);
        const direction=a.y<seam?-1:1;
        // Approach and leave each crossing on the proper side of the ridge.
        roads.push([a,{x:gap.x,y:gy+direction*290},
          {x:gap.x,y:gy},{x:gap.x,y:gy-direction*290},b]);
      }else{
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        const offset=(r()-.5)*Math.min(100,len*.11);
        const mid={x:(a.x+b.x)*.5-dy/len*offset,y:(a.y+b.y)*.5+dx/len*offset};
        roads.push([a,mid,b]);
      }
    }
  }
  // Keep deterministic ordering and avoid tiny duplicate roads.
  return {ridges:[ridge],roads:roads.filter(path=>distance(path[0],path[path.length-1])>100)};
}


/** Four distinct strategic map identities for NEW generator-v4 battles.
 * The identity is chosen from the seed without a save migration. Generator
 * v3 remains byte-for-byte unchanged; no old saved map shifts its cliffs.
 * Every pass is a real hole in the shared collision grid and both factions
 * get identical construction clearance around their starting locations.
 */
function variedLandscape(seed:number,size:number,sites:readonly Point[],
 columns:number,rows:number,candidate:number,homes:readonly Point[]):LandscapeNetwork{
 const types:LandscapeKind[]=['open-basin','broken-escarpment','diagonal-ridge','serpentine-canyon'];
 const kind=types[streamSeed(seed,'landscape-archetype')%types.length];
 const rand=random(streamSeed(seed,'landscape-v4',candidate));
 const central=size*(Math.max(1,Math.floor(rows/2))/rows);
 const phase=rand()*Math.PI*2,phase2=rand()*Math.PI*2;
 const drift=(rand()-.5)*size*.075;
 const centerY=central+drift;
 const width=104+rand()*55,height=90+rand()*62;
 const xStart=kind==='broken-escarpment'?.22:.065;
 const xEnd=kind==='broken-escarpment'?.78:.935;
 const amplitude=kind==='serpentine-canyon'?size*(.075+rand()*.025):
  kind==='diagonal-ridge'?size*.015:
  kind==='broken-escarpment'?size*.018:0;
 const incline=kind==='diagonal-ridge'?(rand()<.5?-1:1)*size*(.12+rand()*.035):0;
 const spine=kind==='open-basin'?[]:Array.from({length:39},(_,i)=>{
  const t=i/38;
  const x=size*(xStart+(xEnd-xStart)*t);
  const wave=kind==='serpentine-canyon'
   ?Math.sin(t*Math.PI*3.25+phase)*amplitude+
    Math.sin(t*Math.PI*7+phase2)*size*.009
   :Math.sin(t*Math.PI*2.4+phase)*amplitude;
  return {x,y:centerY+(t-.5)*incline*2+wave};
 });
 const ridges:CanyonRidge[]=[];
 if(spine.length){
  const passWidth=Math.max(345,Math.min(650,size/columns*(.27+rand()*.11)));
  // A short escarpment can be flanked at either end. Long canyon maps
  // receive two or three real passes with seed-dependent tactical positions.
  const passCount=kind==='broken-escarpment'?1:
   kind==='serpentine-canyon'?3:2;
  const ramps=Array.from({length:passCount},(_,i)=>{
   const fraction=(i+1)/(passCount+1)+(rand()-.5)*.11;
   const x=size*(xStart+(xEnd-xStart)*fraction);
   return {x:Math.max(size*.10,Math.min(size*.90,x)),width:passWidth};
  }).sort((a,b)=>a.x-b.x);
  ridges.push({spine,width,height,ramps,
   clearings:[
    ...sites.map(point=>({point,radius:TERRAIN_GRADING_V3.bastionFlatRadius+140})),
    ...homes.map(point=>({point,radius:TERRAIN_GRADING_V3.homeFlatRadius+150}))
   ]});
 }
 const roads:Point[][]=[];
 const ridge=ridges[0];
 for(let i=0;i<sites.length;i++)for(const next of [
  i%columns<columns-1?i+1:-1,i+columns<sites.length?i+columns:-1
 ]){
  if(next<0)continue;
  const a=sites[i],b=sites[next],dx=b.x-a.x,dy=b.y-a.y;
  const crossing=ridge&&
   (a.y-ridgeHeightAt(ridge,a.x))*
   (b.y-ridgeHeightAt(ridge,b.x))<0;
  if(crossing){
   const midpoint=(a.x+b.x)*.5;
   const gap=ridge.ramps.reduce((best,pass)=>
    Math.abs(pass.x-midpoint)<Math.abs(best.x-midpoint)?pass:best,
    ridge.ramps[0]);
   const y=ridgeHeightAt(ridge,gap.x);
   const side=a.y<ridgeHeightAt(ridge,a.x)?-1:1;
   const offset=ridge.width*.5+210;
   roads.push([a,{x:gap.x,y:y+side*offset},
    {x:gap.x,y},{x:gap.x,y:y-side*offset},b]);
  }else{
   const length=Math.hypot(dx,dy)||1;
   const curvature=kind==='open-basin'?Math.min(length*.24,300):
    kind==='serpentine-canyon'?Math.min(length*.16,210):Math.min(length*.12,145);
   const sway=(rand()-.5)*2*curvature;
   const point=(t:number,scale:number):Point=>({
    x:a.x+dx*t-dy/length*sway*scale,
    y:a.y+dy*t+dx/length*sway*scale
   });
   // Different meandering road motifs instead of the same grid lines.
   roads.push([a,point(.32,.65),point(.67,1),b]);
  }
 }
 return {kind,ridges,roads:roads.filter(road=>
  distance(road[0],road[road.length-1])>100)};
}


/**
 * Version 6 is deliberately a NEW fixed-map ruleset. The older procedural
 * layouts (v1–v5) remain unchanged for their saved campaigns.
 *
 * Three staggered high sandstone plateaus divide the desert into tactical
 * corridors like a classic handcrafted RTS map. The spines, choke-point
 * openings and visual roads are all derived from one deterministic plan.
 * Mountain collision and line of sight still come from World.blocked.
 */
function authoredPlateauNetwork(seed:number,size:number,sites:readonly Point[],
 columns:number,rows:number,candidate:number,homes:readonly Point[]):LandscapeNetwork{
 const randomizer=random(streamSeed(seed,'authored-plateau-v6',candidate));
 const protectedZones=[
  ...sites.map(point=>({point,radius:TERRAIN_GRADING_V3.bastionFlatRadius+140})),
  ...homes.map(point=>({point,radius:TERRAIN_GRADING_V3.homeFlatRadius+150}))
 ];
 const designs=[
  {x0:.055,x1:.545,y:.255,curve:.019,width:202,height:143,passes:[.265]},
  {x0:.18,x1:.855,y:.502,curve:-.023,width:224,height:160,passes:[.445,.685]},
  {x0:.445,x1:.945,y:.747,curve:.021,width:196,height:150,passes:[.705]}
 ];
 const ridges:CanyonRidge[]=designs.map((d,index)=>{
  const phase=.62+index*1.69;
  const spine=Array.from({length:41},(_,i)=>{
   const t=i/40,x=size*(d.x0+(d.x1-d.x0)*t);
   const z=size*(d.y+Math.sin(t*Math.PI*2+phase)*d.curve+
    Math.sin(t*Math.PI*5.4+phase*.7)*.005);
   return {x,y:z};
  });
  const ramps=d.passes.map(frac=>({
   x:size*frac,width:Math.min(560,Math.max(390,size/columns*.26))
  }));
  return {spine,width:d.width,height:d.height,ramps,clearings:protectedZones};
 });
 const roads:Point[][]=[];
 // Link every Bastion to neighboring territories. Where the link meets a
 // plateau, guide it through a real pass with broad vehicle approaches.
 for(let i=0;i<sites.length;i++)for(const neighbor of [
  i%columns<columns-1?i+1:-1,
  i+columns<sites.length?i+columns:-1
 ]){
  if(neighbor<0)continue;
  const a=sites[i],b=sites[neighbor];
  const midpointX=(a.x+b.x)*.5;
  const crossed=ridges.flatMap((ridge,index)=>{
   const left=ridge.spine[0].x,right=ridge.spine.at(-1)!.x;
   const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x);
   if(midpointX<left-160||midpointX>right+160||
     maxX<left-160||minX>right+160)return [];
   const da=a.y-ridgeHeightAt(ridge,a.x),db=b.y-ridgeHeightAt(ridge,b.x);
   if(da*db>=0)return [];
   const gap=ridge.ramps.reduce((best,pass)=>
     Math.abs(pass.x-midpointX)<Math.abs(best.x-midpointX)?pass:best,ridge.ramps[0]);
   const y=ridgeHeightAt(ridge,gap.x);
   return [{ridge,index,x:gap.x,y,fromNorth:da<0,
    t:Math.abs((y-a.y)/(b.y-a.y||1))}];
  }).sort((p,q)=>p.t-q.t);
  if(crossed.length){
   const road:Point[]=[a];
   for(const crossing of crossed){
    const side=crossing.fromNorth?-1:1;
    const shoulder=crossing.ridge.width*1.35+235;
    road.push({x:crossing.x,y:crossing.y+side*shoulder},
     {x:crossing.x,y:crossing.y},
     {x:crossing.x,y:crossing.y-side*shoulder});
   }
   roads.push([...road,b]);
  }else{
   const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
   const sway=(randomizer()-.5)*Math.min(195,len*.14);
   const via=(t:number,k:number):Point=>({
    x:a.x+dx*t-dy/len*sway*k,
    y:a.y+dy*t+dx/len*sway*k
   });
   roads.push([a,via(.3,.85),via(.68,1),b]);
  }
 }
 return {kind:'plateau-crossroads',ridges,
  roads:roads.filter(route=>distance(route[0],route.at(-1)!)>100)};
}

/** V7 new game mode: actual elevated buildable mesas, not impassable ridges. */
function playableMesaHighlands(seed:number,size:number,sites:readonly Point[],
 columns:number,rows:number,candidate:number,homes:readonly Point[]):LandscapeNetwork{
 const indices=[columns+1,columns*(rows-2)+(columns-2)];
 // Symmetric pair on the interior diagonals; neither is a headquarters.
 const plateaus:RaisedMesa[]=indices.map((siteIndex,i)=>({
  siteIndex,center:{...sites[siteIndex]},
  topRadius:495,footRadius:735,height:177,rampEnd:1610,rampWidth:340,
  direction:i===0?{x:0,y:1}:{x:0,y:-1},seed
 }));
 const roadAnchor=(index:number):Point[]=>{
  const mesa=plateaus.find(p=>p.siteIndex===index);
  if(!mesa)return [sites[index]];
  const d=mesa.direction,c=mesa.center;
  return [
   c,
   {x:c.x+d.x*(mesa.topRadius*.78),y:c.y+d.y*(mesa.topRadius*.78)},
   {x:c.x+d.x*(mesa.topRadius+280),y:c.y+d.y*(mesa.topRadius+280)},
   {x:c.x+d.x*(mesa.topRadius+630),y:c.y+d.y*(mesa.topRadius+630)},
   {x:c.x+d.x*mesa.rampEnd,y:c.y+d.y*mesa.rampEnd}
  ];
 };
 const roads:Point[][]=[];
 for(let i=0;i<sites.length;i++)for(const next of [
  i%columns<columns-1?i+1:-1,i+columns<sites.length?i+columns:-1
 ]){
  if(next<0)continue;
  const from=roadAnchor(i),to=roadAnchor(next);
  const start=from.at(-1)!,end=to.at(-1)!;
  const middle={x:(start.x+end.x)*.5,y:(start.y+end.y)*.5};
  roads.push([...from,middle,...to.slice().reverse()]);
 }
 return {kind:'mesa-highlands',ridges:[],roads,plateaus};
}


/**
 * V8: the CURRENT named maps retain their original mountain/ridge identity
 * while gaining actual, connected, buildable high ground. Older v4-v7 saves
 * still regenerate their historical geometry with the original versions.
 *
 * The existing 2D/3D terrain, cliff collision and AI all use the same two
 * (occasionally three) raised mesas. Their site-specific ramp roads are part
 * of the same deterministic road network, not texture-only shortcuts.
 */
function expandedClassicHighlands(seed:number,size:number,sites:readonly Point[],
 columns:number,rows:number,candidate:number,homes:readonly Point[]):LandscapeNetwork{
 const original=seed===260621
  ?authoredPlateauNetwork(seed,size,sites,columns,rows,candidate,homes)
  :variedLandscape(seed,size,sites,columns,rows,candidate,homes);
 const kind=original.kind??'open-basin';
 const rng=random(streamSeed(seed,'authored-highland-expansion-v8',candidate));
 const total=sites.length;
 const homeClear=homes.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 const siteIds=kind==='open-basin'
  ?[1,columns*(rows-1)+(columns-2)]
  :kind==='broken-escarpment'
   ?[columns+1,columns+(columns-2)]
   :kind==='plateau-crossroads'
    ?[columns+1,(rows-2)*columns+(columns-2)]
    :[columns+1,(rows-2)*columns+(columns-2),columns+(columns-2)];
 const plateaus:RaisedMesa[]=[];
 for(const siteIndex of siteIds){
  if(siteIndex<0||siteIndex>=total||plateaus.some(p=>p.siteIndex===siteIndex))continue;
  const center=sites[siteIndex],row=Math.floor(siteIndex/columns);
  const radius=kind==='open-basin'?460:
    kind==='serpentine-canyon'?530:kind==='broken-escarpment'?535:505;
  // Higher relief on badlands, gentler rocky mesas on the open dunes.
  const height=kind==='open-basin'?138:
    kind==='serpentine-canyon'?226:kind==='plateau-crossroads'?210:
     kind==='broken-escarpment'?192:175;
  const footRadius=radius+230;
  const rampEnd=radius+(kind==='open-basin'?1000:1200);
  const rampWidth=kind==='open-basin'?430:400;
  // Exit away from the central spine where possible, without pointing a
  // ramp through a rival plateau or directly into the map's black boundary.
  let dy=row<(rows-1)/2?-1:1;
  if(rows===2)dy=row===0?1:-1;
  let direction:Point={x:0,y:dy};
  if(center.y+dy*rampEnd<220||center.y+dy*rampEnd>size-220)
   direction={x:0,y:-dy};
  const mesa:RaisedMesa={
   siteIndex,center:{...center},topRadius:radius,footRadius,
   rampEnd,height,rampWidth,direction,seed
  };
  const overlaps=plateaus.some(other=>
   distance(center,other.center)<mesa.footRadius+other.footRadius+165);
  const unsafeHome=homeClear.some(home=>distance(center,home)<radius+330);
  if(overlaps||unsafeHome)continue;
  plateaus.push(mesa);
 }
 const routeAnchors=(siteIndex:number):Point[]=>{
  const mesa=plateaus.find(p=>p.siteIndex===siteIndex);
  if(!mesa)return [];
  const {center:c,direction:d,topRadius:r,rampEnd:e}=mesa;
  return [
   {x:c.x+d.x*(r*.74),y:c.y+d.y*(r*.74)},
   {x:c.x+d.x*(r+240),y:c.y+d.y*(r+240)},
   {x:c.x+d.x*(r+620),y:c.y+d.y*(r+620)},
   {x:c.x+d.x*e,y:c.y+d.y*e}
  ];
 };
 const roads=original.roads.map(road=>{
  if(road.length<2)return road;
  const a=sites.findIndex(p=>distance(road[0],p)<.01);
  const b=sites.findIndex(p=>distance(road[road.length-1],p)<.01);
  const start=a<0?[]:routeAnchors(a),finish=b<0?[]:routeAnchors(b);
  return [road[0],...start,...road.slice(1,-1),
   ...finish.slice().reverse(),road[road.length-1]];
 });
 return {...original,kind,ridges:original.ridges,roads,plateaus};
}
