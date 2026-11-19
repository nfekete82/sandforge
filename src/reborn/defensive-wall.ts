/** Rotated real navigation blockers matching one 108-wide concrete wall.
 * Extra samples close the gaps between the ends while retaining existing
 * circular building collision and backwards compatible saves.
 */
export type WallFacing=0|1|2|3;
/** A newly constructed gate spans TWO ordinary 109x32 wall sections.
 * Legacy saves missing gateSpan keep the former single-segment size.
 * Pathfinding is faction-sensitive: completed friendly gates are passable,
 * enemy gates remain solid regardless of visual swing animation.
 */
export const isWallLike=(kind:string|undefined):boolean=>
 kind==='wall'||kind==='wallGate';

export function isPassableFriendlyGate(
 base:{kind?:string;owner:number;hp:number;buildRemaining?:number},
 faction:number
):boolean{
 return base.kind==='wallGate'&&base.owner===faction&&
  base.hp>0&&(base.buildRemaining??0)<=0;
}

export function navigableBasesForFaction<T extends {
 kind?:string;owner:number;hp:number;buildRemaining?:number;
}>(bases:readonly T[],faction:number):T[]{
 return bases.filter(b=>!isPassableFriendlyGate(b,faction));
}

/** Real gate posts remain solid even for the owner when the doors open.
 * The previous navigation code deleted the entire friendly gate collision,
 * including both steel pylons. Tanks then planned straight lines through
 * the visible frame and appeared trapped where the ordinary wall joined it.
 * Only the two narrow external posts obstruct traffic, leaving a generous
 * centre lane for tanks, rovers and artillery. Does not close the gateway.
 */
export function friendlyGatePostColliders<T extends {
 kind?:string;owner:number;hp:number;buildRemaining?:number;
 x:number;y:number;facing?:WallFacing;gateSpan?:number;
}>(sites:readonly T[],owner:number):{x:number;y:number;radius:number}[]{
 const result:{x:number;y:number;radius:number}[]=[];
 for(const b of sites){
  if(!isPassableFriendlyGate(b,owner))continue;
  const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][b.facing??0];
  const c=Math.cos(yaw),s=Math.sin(yaw);
  const span=b.gateSpan===2?2:1;
  // Physical steel column centres in the 3D geometry: 51 * span.
  for(const sign of [-1,1]){
   const x=sign*51*span;
   result.push({x:b.x+c*x,y:b.y-s*x,radius:9});
  }
 }
 return result;
}

export const WALL_GATE_UPGRADE_COST=60;

export function wallColliderSamples(p:{x:number;y:number;facing?:WallFacing;kind?:string;gateSpan?:number},
 facing:WallFacing=p.facing??0,radius=24):{x:number;y:number;radius:number}[]{
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const offsets=p.kind==='wallGate'&&p.gateSpan===2?
  [-87,-43.5,0,43.5,87]:[-33,0,33];
 return offsets.map(offset=>({
  x:p.x+offset*c,y:p.y-offset*s,radius
 }));
}


/** A wall is a narrow, terrain-following barrier, NOT a building slab.
 * Check its entire real 109×32 footprint against map bounds, rocks and
 * physically impassable cliff faces. Do not demand a level foundation:
 * gradual height differences along the wall are expected and supported
 * by the renderer's terrain pitch.
 *
 * Unlike World.walkable(), sampling the REAL world boundary admits a
 * perfectly legal perimeter whose concrete ends 0.5m from the map edge;
 * no part of the 3D model may extend into the surrounding black void.
 */
export function wallTerrainPlacementError(
 ground:{
  size:number;blocked:Uint8Array;index(p:{x:number;y:number}):number;
  generated?:{battlefield?:unknown};
  terrainHeight(x:number,y:number):number;
  terrainSlope(x:number,y:number):number;
 },
 p:{x:number;y:number},facing:WallFacing,span:1|2=1
):string|null{
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const c=Math.cos(yaw),s=Math.sin(yaw);
 // Sample on or just inside the actual mesh silhouette. At 9-m steps
 // even a single 15-m navigation rock cell cannot be skipped unnoticed.
 for(const z of [-16,-8,0,8,16]){
  let previousHeight:number|undefined;
  for(let x=-54*span;x<=54*span;x+=9){
   const px=p.x+x*c+z*s,py=p.y-x*s+z*c;
   const q={x:px,y:py},cell=ground.index(q);
   if(px<0||py<0||px>=ground.size||py>=ground.size)
    return 'Mauer ragt über den Kartenrand.';
   if(cell<0||ground.blocked[cell])
    return 'Felsen oder unpassierbare Bergwand blockieren den Mauerverlauf.';
   if(ground.generated?.battlefield){
    const height=ground.terrainHeight(px,py);
    if(!Number.isFinite(height)||ground.terrainSlope(px,py)>1.35)
     return 'Eine steile Felswand blockiert den Mauerverlauf.';
    // Do not bridge an abrupt precipice with one floating rigid segment.
    // Ordinary hills/dunes were previously rejected at 0.24 slope or 24
    // total height change; both limitations are intentionally removed.
    if(previousHeight!==undefined&&Math.abs(height-previousHeight)>9*1.5)
     return 'Eine senkrechte Geländekante unterbricht die Mauer.';
    previousHeight=height;
   }
  }
 }
 return null;
}

/** Visual-only slope of a built wall, matching its rotated local +X axis.
 * This does not change the stored wall facing, physical blockers or save.
 */
export function wallTerrainPitch(
 ground:{terrainHeight(x:number,y:number):number},
 p:{x:number;y:number},facing:WallFacing,span:1|2=1
):number{
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const left=ground.terrainHeight(p.x-49*span*c,p.y+49*span*s);
 const right=ground.terrainHeight(p.x+49*span*c,p.y-49*span*s);
 if(!Number.isFinite(left)||!Number.isFinite(right))return 0;
 return Math.atan2(right-left,98*span);
}
