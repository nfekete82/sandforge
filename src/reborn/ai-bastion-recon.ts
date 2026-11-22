import type {Point} from './config.js';

/** Public Bastion positions are known, but their unobserved garrison isn't.
 * Delay only a NEW major attack against an enemy-owned, unvisited Bastion.
 * Old fights, neutral expansion and legacy maps are never interrupted.
 */
export const BASTION_RECON_MAX_WAIT=75;
export const BASTION_RECON_AIR_SCOUT_GRACE=24;

export interface BastionReconSituation {
 mapVersion:number;
 kind:'capture'|'structure'|'hunt';
 owner:number;
 visible:boolean;
 explored:boolean;
 continuing:boolean;
 time:number;
 missionSince:number;
}

export function bastionReconRequired(x:BastionReconSituation):boolean{
 return x.mapVersion>=23&&x.kind==='capture'&&x.owner===0&&
  !x.visible&&!x.explored&&!x.continuing&&
  Number.isFinite(x.missionSince)&&x.time>=x.missionSince&&
  x.time-x.missionSince<BASTION_RECON_MAX_WAIT;
}

/** A real paid unit receives a REAL, route-checked observation order.
 * Never use enemy structures/units hidden behind fog to choose the post.
 * If the ridge is disconnected, return undefined instead of claiming a path.
 */
export function bastionReconVantage(x:{
 from:Point;target:Point;sight:number;
 walkable:(p:Point)=>boolean;
 reachable:(p:Point)=>boolean;
 danger:(p:Point)=>number;
}):Point|undefined{
 const d=Math.hypot(x.from.x-x.target.x,x.from.y-x.target.y);
 const heading=d>1?Math.atan2(x.from.y-x.target.y,x.from.x-x.target.x):0;
 const radius=Math.min(300,Math.max(120,x.sight*.55));
 for(const r of [radius,radius*.78]){
  for(const turn of [0,.48,-.48,.96,-.96,1.48,-1.48,Math.PI]){
   const a=heading+turn;
   const p={x:x.target.x+Math.cos(a)*r,y:x.target.y+Math.sin(a)*r};
   if(x.walkable(p)&&x.danger(p)<5&&x.reachable(p))return p;
  }
 }
 return undefined;
}
