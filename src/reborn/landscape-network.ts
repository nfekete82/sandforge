import type {Point} from './config.js';
import type {CanyonRidge} from './canyon-front.js';
import {streamSeed,TERRAIN_GRADING_V3} from './battlefield-terrain.js';

/** Seeded road topology and physical mountain passes for generator v3.
 * Roads are visual guides on the *real* navigation surface; ridge gaps are
 * openings in World.blocked, not an independent or decorative collision map. */
export type LandscapeKind='open-basin'|'broken-escarpment'|'diagonal-ridge'|'serpentine-canyon';
export const LANDSCAPE_LABELS:Record<LandscapeKind,string>={
 'open-basin':'Weites Dünenmeer',
 'broken-escarpment':'Felsdurchbruch',
 'diagonal-ridge':'Diagonalkamm',
 'serpentine-canyon':'Schlangenpass'
};
export interface LandscapeNetwork {
  ridges:CanyonRidge[];
  roads:Point[][];
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
