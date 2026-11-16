/** Wall-chain gesture planner shared by preview and click-to-commit.
 * One continuous cardinal row of authentic 109-unit wall sections.
 * It never writes to the simulation: authoritative per-segment buildError()
 * checks rocks, buildings, terrain, credits and military placement rules.
 */
export const WALL_CHAIN_PITCH=109;
export const WALL_CHAIN_MAX=90;
export const WALL_CHAIN_DRAG_THRESHOLD=13;
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
 const startPos=clamp(primaryStart,64,mapSize-64);
 const endPos=clamp(primaryEnd,64,mapSize-64);
 const cross=clamp(crossStart,26,mapSize-26);
 const sign=endPos<startPos?-1:1;
 const span=Math.abs(endPos-startPos);
 const count=Math.min(Math.max(1,Math.floor(limit)),Math.floor(span/WALL_CHAIN_PITCH)+1);
 const facing=dominant==='x'?0:2;
 return Array.from({length:count},(_,i)=>({
  point:dominant==='x'?
   {x:startPos+sign*i*WALL_CHAIN_PITCH,y:cross}:
   {x:cross,y:startPos+sign*i*WALL_CHAIN_PITCH},
  facing
 }));
}

/** Results have a strictly contiguous buildable prefix. Once an obstruction
 * is met, continue DRAWING red segments beyond it so players see why the
 * line stops, but never skip a rock and build invisibly on its far side.
 */
export function validatedWallDrag(game,start,end,owner=0,{axis=null,limit=WALL_CHAIN_MAX}={}){
 const candidates=wallDragSegments(start,end,game.world.size,{axis,limit});
 const price=75; // kept in sync with the authoritative wall spec
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
