import type {Point} from './config.js';

/** Equal per-shot accuracy for both factions, deterministic across saves,
 * platforms and fixed-step simulation replays. No mutable RNG state.
 */
export const UNIT_MISS_CHANCE=.25;
function fold(state:number,value:number):number{
 let h=(state^Math.imul(value|0,0x9e3779b1))>>>0;
 h=Math.imul(h^(h>>>16),0x85ebca6b)>>>0;
 h=Math.imul(h^(h>>>13),0xc2b2ae35)>>>0;
 return (h^(h>>>16))>>>0;
}
export function unitShotRoll(seed:number,shooter:number,target:number,time:number,ordinal=0):number{
 let h=fold(seed>>>0,shooter);
 h=fold(h,target);
 h=fold(h,Math.round(time*1000));
 h=fold(h,ordinal);
 return h/4294967296;
}
export function unitShotMisses(seed:number,shooter:number,target:number,time:number,ordinal=0):boolean{
 return unitShotRoll(seed,shooter,target,time,ordinal)<UNIT_MISS_CHANCE;
}
export function missedGroundPoint(
 source:Point,target:Point,targetRadius:number,worldSize:number,random:number
):Point{
 // A clearly missed shot: splash OUTSIDE the hitbox instead of punching a
 // bloodless hole through a unit. Prefer lateral miss in the firing direction
 // so dust still appears near the battle.
 const aim=Math.atan2(target.y-source.y,target.x-source.x);
 const side=random<.5?-1:1;
 const swing=.75+(random*7%1)*.9;
 const angle=aim+side*(Math.PI*.5+swing*.30);
 const radius=Math.max(9,targetRadius)+29+random*26;
 const safe=(v:number)=>Math.max(2,Math.min(worldSize-2,v));
 let x=safe(target.x+Math.cos(angle)*radius);
 let y=safe(target.y+Math.sin(angle)*radius);
 if(Math.hypot(x-target.x,y-target.y)<Math.max(9,targetRadius)+8){
  // Near a map edge: use the inward free side, never accidentally land on
  // the very target that the simulation has already counted as missed.
  const inX=target.x>worldSize*.5?-1:1;
  const inY=target.y>worldSize*.5?-1:1;
  x=safe(target.x+inX*radius*.77);
  y=safe(target.y+inY*radius*.77);
 }
 return {x,y};
}
