/** Wall-chain gesture planner shared by preview and click-to-commit.
 * One continuous cardinal row of authentic 109-unit wall sections.
 * It never writes to the simulation: authoritative per-segment buildError()
 * checks rocks, buildings, terrain, credits and military placement rules.
 */
export const WALL_CHAIN_PITCH=109;
export const WALL_CHAIN_MAX=90;
export const WALL_CHAIN_DRAG_THRESHOLD=13;
export const WALL_EDGE_LONG=55;  // real panel is 109 wide; half-width 54.5
export const WALL_EDGE_SHORT=17; // real footing is 32 deep; half-depth 16

/** Clamp a single wall placement onto the nearest legal edge-aligned center.
 * Existing obstacles, cliff cells and gameplay costs are still validated by
 * the authoritative Simulation.buildError(). This only solves clicks near
 * the map edge where the mouse is closer than half a panel to the border.
 */
export function snapWallSiteToMap(point,facing,mapSize,kind='wall'){
 const long=kind==='wallGate'?110:WALL_EDGE_LONG;
 if(!point||![point.x,point.y,mapSize].every(Number.isFinite)||
  mapSize<=long*2)return null;
 const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
 const horizontal=facing===0||facing===1;
 const xMargin=horizontal?long:WALL_EDGE_SHORT;
 const yMargin=horizontal?WALL_EDGE_SHORT:long;
 return {x:clamp(point.x,xMargin,mapSize-xMargin),
  y:clamp(point.y,yMargin,mapSize-yMargin)};
}
export function wallDragSegments(start,end,mapSize,{axis=null,limit=WALL_CHAIN_MAX}={}){
 if(!start||!end||![start.x,start.y,end.x,end.y,mapSize].every(Number.isFinite)||
    mapSize<160)return [];
 const dominant=axis??(Math.abs(end.x-start.x)>=Math.abs(end.y-start.y)?'x':'y');
 if(dominant!=='x'&&dominant!=='y')return [];
 const primaryStart=dominant==='x'?start.x:start.y;
 const primaryEnd=dominant==='x'?end.x:end.y;
 const crossStart=dominant==='x'?start.y:start.x;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 // 109-long, 30-deep walls extend to the last few pixels of playable sand.
 // The sim checks rock/mesa pixels across the WHOLE rotated footprint.
 const startPos=clamp(primaryStart,WALL_EDGE_LONG,mapSize-WALL_EDGE_LONG);
 const endPos=clamp(primaryEnd,WALL_EDGE_LONG,mapSize-WALL_EDGE_LONG);
 const cross=clamp(crossStart,WALL_EDGE_SHORT,mapSize-WALL_EDGE_SHORT);
 const sign=endPos<startPos?-1:1;
 const span=Math.abs(endPos-startPos);
 const maxCount=Math.max(1,Math.floor(limit));
 const target=sign>0?mapSize-WALL_EDGE_LONG:WALL_EDGE_LONG;
 const nearEdge=Math.abs(endPos-target)<=WALL_EDGE_LONG;
 const count=nearEdge?
  Math.min(maxCount,Math.max(1,Math.round(span/WALL_CHAIN_PITCH)+1)):
  Math.min(maxCount,Math.floor(span/WALL_CHAIN_PITCH)+1);
 // Keep true 109-unit spacing and align the final wall against the edge.
 const alignedStart=nearEdge&&count<maxCount?
  clamp(target-sign*(count-1)*WALL_CHAIN_PITCH,WALL_EDGE_LONG,mapSize-WALL_EDGE_LONG):startPos;
 const facing=dominant==='x'?0:2;
 return Array.from({length:count},(_,i)=>({
  point:dominant==='x'?
   {x:alignedStart+sign*i*WALL_CHAIN_PITCH,y:cross}:
   {x:cross,y:alignedStart+sign*i*WALL_CHAIN_PITCH},
  facing
 }));
}

/** Results have a strictly contiguous buildable prefix. Once an obstruction
 * is met, continue DRAWING red segments beyond it so players see why the
 * line stops, but never skip a rock and build invisibly on its far side.
 */
export function validatedWallDrag(game,start,end,owner=0,{axis=null,limit=WALL_CHAIN_MAX,wallCost=75}={}){
 const candidates=wallDragSegments(start,end,game.world.size,{axis,limit});
 const price=Math.max(0,wallCost); // supplied from the authoritative catalogue
 let stopped=false,stopReason=null,buildable=0;
 const segments=candidates.map(({point,facing})=>{
  let reason=stopped?'Abschnitt hinter einem Hindernis':null;
  if(!stopped){
   reason=game.credits[owner]<(buildable+1)*price?'Zu wenig Credits':
    game.buildError(owner,'wall',point,facing);
   if(reason){stopped=true;stopReason=reason;}
   else buildable++;
  }
  return {point,facing,valid:!reason,reason};
 });
 return {segments,buildable,stopReason};
}

/** Non-mutating lookup of two adjoining completed walls for gate retrofit. */
export function gateRetrofitAt(game,point,owner=0){
 if(!point)return null;
 let best=null;
 for(const wall of game.bases??[]){
  if(wall.owner!==owner||wall.kind!=='wall'||wall.hp<=0||wall.buildRemaining>0)continue;
  const partner=game.findWallGatePartner(owner,wall.id);
  if(!partner)continue;
  const center={x:(wall.x+partner.x)*.5,y:(wall.y+partner.y)*.5};
  const distance=Math.hypot(center.x-point.x,center.y-point.y);
  if(distance>80||(best&&distance>=best.distance))continue;
  best={wall,partner,center,distance,facing:wall.facing??0};
 }
 return best;
}
