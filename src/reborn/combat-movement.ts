import {distance,type Point} from './config.js';

/** Actual short-range threat, not a remote unit inferred through fog.
 * Caller supplies ONLY a currently visible ground vehicle and checks normal
 * walking/collision and line of sight. Pure; can be tested without gameplay.
 */
export interface RocketStandoffOptions {
 soldier:Point;enemy:Point;range:number;
 reachable:(candidate:Point)=>boolean;
 clearShot:(candidate:Point)=>boolean;
}
/** Choose a longer-range rocket firing position while a ground vehicle is
 * almost on top of a fragile soldier. Ground motion remains ordinary move().
 * Prefer straight retreat, then modest side angles (never blind teleport).
 */
export function rocketStandoffPoint(x:RocketStandoffOptions):Point|null {
 const near=distance(x.soldier,x.enemy);
 if(!Number.isFinite(near)||near<1||near>=160||x.range<220)return null;
 const heading=Math.atan2(x.soldier.y-x.enemy.y,x.soldier.x-x.enemy.x);
 const preferred=Math.min(x.range-65,275);
 const radius=Math.max(near+85,preferred);
 for(const turn of [0,.28,-.28,.52,-.52,.8,-.8]){
  const a=heading+turn;
  const p={x:x.enemy.x+Math.cos(a)*radius,y:x.enemy.y+Math.sin(a)*radius};
  // Never step CLOSER to the threat; maintain genuine rocket fire range.
  if(distance(p,x.soldier)<65||distance(p,x.enemy)>x.range-22||
     distance(p,x.enemy)<=near+65)continue;
  if(x.reachable(p)&&x.clearShot(p))return p;
 }
 return null;
}
/** Fire is more important than kiting when a rocket is ready, the player
 * gave an explicit direct order, the unit is holding a point, or there is
 * no safe firing lane. This gate is intentionally an AI-only opt-in.
 */
export function shouldRocketReposition(x:{
 ownedByAI:boolean;mapVersion:number;enemyVehicle:boolean;held:boolean;
 directMove:boolean;readyToFire:boolean;threatDistance:number;
}):boolean {
 return x.ownedByAI&&x.mapVersion>=23&&x.enemyVehicle&&!x.held&&
  !x.directMove&&!x.readyToFire&&x.threatDistance>0&&x.threatDistance<160;
}
/** Only reciprocal living units of one genuine tactical assault may share
 * the march limiter. Never assign support or vehicle extraction commands.
 */
export function coordinatedFrontMarch(x:{
 modern:boolean;assault:boolean;frontCount:number;allGround:boolean;
}):boolean {
 return x.modern&&x.assault&&x.frontCount>=2&&x.allGround;
}
