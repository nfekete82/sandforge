import type {Point} from './config.js';

/** Physically validated approach to a PUBLIC Bastion capture ring.
 * This function knows only geometry and caller-approved routes. No enemy data.
 */
export function ai46ReachableBastionApproach(x:{
  center:Point;from:Point;worldSize:number;captureRadius:number;
  walkable:(p:Point)=>boolean;
  completeRoute:(p:Point)=>boolean;
}):Point|undefined{
 const {center,from,worldSize,captureRadius}=x;
 if(!Number.isFinite(captureRadius)||captureRadius<80)return;
 const angle=Math.atan2(from.y-center.y,from.x-center.x);
 const offsets=[0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,
  Math.PI/2,-Math.PI/2,Math.PI,2*Math.PI/3,-2*Math.PI/3];
 // 3D Bastion footprint occupies its exact center. Stay in the real
 // 125-unit capture ring but clear of the tower and vehicle hulls.
 for(const radius of [captureRadius-24,captureRadius-13]){
  for(const offset of offsets){
   const a=angle+offset,p={x:center.x+Math.cos(a)*radius,
     y:center.y+Math.sin(a)*radius};
   if(p.x<35||p.y<35||p.x>worldSize-35||p.y>worldSize-35)continue;
   if(!x.walkable(p)||!x.completeRoute(p))continue;
   return p;
  }
 }
}
