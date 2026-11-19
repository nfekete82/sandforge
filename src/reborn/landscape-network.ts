import type {Point} from './config.js';
import type {CanyonRidge} from './canyon-front.js';
import {streamSeed} from './battlefield-terrain.js';

/** Seeded road topology and physical mountain passes for generator v3.
 * Roads are visual guides on the *real* navigation surface; ridge gaps are
 * openings in World.blocked, not an independent or decorative collision map. */
export interface LandscapeNetwork {
  ridges:CanyonRidge[];
  roads:Point[][];
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
  columns:number,rows:number,candidate=0):LandscapeNetwork{
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
