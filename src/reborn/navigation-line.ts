import type {Point} from './config.js';
const probes=Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}));

/** Movement uses a centre and eight clearance probes. Traverse every grid cell
 * touched by those probes instead of sampling a long segment: samples can miss
 * a very short intersection with a cliff corner. Combat/vision rays stay separate. */
export function navigationLine(a:Point,b:Point,cell:number,columns:number,blocked:Uint8Array,
 obstacles:readonly (Point&{radius:number})[],radius:number,clearance:number):boolean {
 // A* uses this for each short grid-edge candidate, repeatedly comparing
 // against dozens of wall, vehicle-decor and building circles. Reject distant
 // candidates with an AABB before computing squared point-segment distance.
 // Exact inequality matches segmentDistance < combinedRadius (no extra gaps).
 const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x);
 const minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
 const dx=b.x-a.x,dy=b.y-a.y,denom=dx*dx+dy*dy||1;
 for(const o of obstacles){
  const limit=o.radius+radius+clearance;
  if(o.x+limit<minX||o.x-limit>maxX||
     o.y+limit<minY||o.y-limit>maxY)continue;
  const vx=o.x-a.x,vy=o.y-a.y;
  const t=Math.max(0,Math.min(1,(vx*dx+vy*dy)/denom));
  const ex=vx-dx*t,ey=vy-dy*t;
  if(ex*ex+ey*ey<limit*limit)return false;
 }
 const clear=(x:number,y:number)=>x>=0&&y>=0&&x<columns&&y<columns&&!blocked[y*columns+x];
 const ray=(ox:number,oy:number)=>{
  const ax=a.x+ox,ay=a.y+oy,bx=b.x+ox,by=b.y+oy,dx=bx-ax,dy=by-ay;
  let x=Math.floor(ax/cell),y=Math.floor(ay/cell);const endX=Math.floor(bx/cell),endY=Math.floor(by/cell);
  if(!clear(x,y)||!clear(endX,endY))return false;
  const sx=Math.sign(dx),sy=Math.sign(dy),tx=dx?cell/Math.abs(dx):Infinity,ty=dy?cell/Math.abs(dy):Infinity;
  let nx=dx?((sx>0?x+1:x)*cell-ax)/dx:Infinity,ny=dy?((sy>0?y+1:y)*cell-ay)/dy:Infinity;
  while(x!==endX||y!==endY){
   if(x===endX)nx=Infinity;if(y===endY)ny=Infinity;
   // Include both sides of an exact corner; floating point movement must not
   // depend on which side of the boundary a single tick happens to land.
   if(Math.abs(nx-ny)<1e-12){if(!clear(x+sx,y)||!clear(x,y+sy))return false;x+=sx;y+=sy;nx+=tx;ny+=ty;}
   else if(nx<ny){x+=sx;nx+=tx;}else{y+=sy;ny+=ty;}
   if(!clear(x,y))return false;
  }
  return true;
 };
 if(!ray(0,0))return false;
 if(clearance>0)for(const p of probes)if(!ray(p.x*clearance,p.y*clearance))return false;
 return true;
}
