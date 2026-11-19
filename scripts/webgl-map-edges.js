/** Shared camera/terrain-edge policy for the 3D renderer; never changes simulation bounds. */
export const edgeOverscan=size=>Math.min(160,Math.max(80,size*.025));
export const cameraEdgeReach=size=>Math.min(140,Math.max(70,size*.022));
/** For hard-black WebGL maps, let the CAMERA centre travel over the void.
 * Unit movement, minimap orders and the actual playable square stay fixed.
 * Capped so the user cannot lose the entire map through excessive panning. */
export const cameraBlackOverscan=size=>Math.min(750,Math.max(350,size*.145));

/** A right-click slightly beyond the visible sand should still select a legal
 * destination. Far-out clicks stay invalid, as do nonfinite intersections.
 * Obstacles/connected components are still resolved by Simulation.command(). */
export function snapToPlayableEdge(point,size,overscan=edgeOverscan(size)){
 if(!point||!Number.isFinite(size)||size<=24||!Number.isFinite(point.x)||!Number.isFinite(point.y))
  return null;
 if(point.x< -overscan||point.y< -overscan||
    point.x>size+overscan||point.y>size+overscan)return null;
 const limit=12;
 return {x:Math.min(size-limit,Math.max(limit,point.x)),
  y:Math.min(size-limit,Math.max(limit,point.y))};
}

/** Convert a camera ground-plane corner into a minimap coordinate.
 * Camera X/Z and simulation X/Y share exactly one world origin at size/2. */
export function worldToMinimap(x,z,size,width,height){
 return {x:(x+size/2)*width/size,y:(z+size/2)*height/size};
}


/** Convert a pointer on the *CSS-sized* minimap to authoritative world XY.
 * The canvas can be stretched by the bottom tactical HUD. Using its CSS
 * bounds, not the backing bitmap size, keeps orders pixel-perfect.
 * Null outside the actual minimap; clamp edge pixels into the playable
 * 12-unit margin (same safety as right-clicking a terrain border).
 */
export function minimapPointerToWorld(clientX,clientY,rect,size){
 if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||
    !Number.isFinite(size)||size<=24||!rect||
    !Number.isFinite(rect.left)||!Number.isFinite(rect.top)||
    !Number.isFinite(rect.width)||!Number.isFinite(rect.height)||
    rect.width<=0||rect.height<=0)return null;
 const nx=(clientX-rect.left)/rect.width;
 const ny=(clientY-rect.top)/rect.height;
 if(nx<0||ny<0||nx>1||ny>1)return null;
 return snapToPlayableEdge({x:nx*size,y:ny*size},size,0);
}
