/** Sandforge AI 3.3: map-size-aware decisions, using ONLY paid red units,
 * observed contact, publicly known territory and the existing safe routes.
 * The paid opening also covers 12-Bastion maps; other 3.2 tactics stay intact.
 * Pure and deterministic so opt-out comparisons use identical worlds.
 */
export type AI33Mode='off'|'adaptive';

/** Bastion-control opening for modern 8-, 12- and 16-Bastion maps.
 * Sector ownership is public. Soldiers must be paid, healthy, available
 * and routed by TacticalAI; the policy never reads hidden enemies.
 * The proven four-sector opener remains unchanged. */
export function mapBastionContestOpening(
 mapVersion:number,time:number,blue:number,red:number,available:number
):{slots:number;counter:boolean}{
 if(mapVersion<24||mapVersion>26||available<1||
    time>(mapVersion===24?210:mapVersion===25?230:255))return {slots:0,counter:false};
 const total=mapVersion===24?8:mapVersion===25?12:16;
 const behind=blue-red>=2&&blue>=Math.max(3,Math.ceil(total*.30));
 const counter=behind&&time>=30&&available>=3;
 // One pioneer is never pulled from construction. With >=3 combat units
 // contest two public Bastions, or use a paid two-unit squad for recapture.
 return {slots:available>=3?2:1,counter};
}
export interface MapRaidReadiness {
 mapVersion:number;phase:string;time:number;fighters:number;main:number;
 eligible:number;homeGuards:number;homePressure:boolean;
 recentLosses:number;recentFailures:number;emergency:boolean;
}
/** This gate is applied IN ADDITION to AI 3.2's ordinary attack readiness:
 * a raid can never be funded by pulling defenders or spawing free troops.
 * A small eight-Bastion map favors a decisive single axis.
 * A large sixteen-Bastion map avoids distant, premature detachments.
 */
export function mapRaidReady(x:MapRaidReadiness):boolean {
 if(x.mapVersion!==24&&x.mapVersion!==26)return true;
 if(x.phase!=='attack'||x.homePressure||x.emergency||x.recentLosses>0||
    x.recentFailures>0||x.eligible<2)return false;
 if(x.mapVersion===24)return x.time>=175&&x.fighters>=14&&
  x.main>=8&&x.homeGuards>=3&&x.fighters>=x.main+x.homeGuards+2;
 return x.time>=155&&x.fighters>=14&&x.main>=7&&
  x.homeGuards>=3&&x.fighters>=x.main+x.homeGuards+2;
}
/** The visible, known-risk route is the only distance input. The larger
 * battlefield cannot steal units for an open-ended cross-map detour.
 */
export function mapRaidRouteReady(mapVersion:number,travel:number,risk:number):boolean{
 if(!Number.isFinite(travel)||travel<=0||!Number.isFinite(risk)||risk<0)return false;
 if(mapVersion===26)return travel<=1950&&risk<5.5;
 if(mapVersion===24)return travel<=1400&&risk<6.5;
 return risk<8;
}
/** In small battles avoid spreading a tiny defense across several sites;
 * in large battles keep at least three guards at or near the HQ before
 * manning distant frontier positions. All posted guards already exist.
 */
export function mapFrontierPosts(mapVersion:number,guards:number,frontiers:number,legacy:number):number{
 if(mapVersion!==24&&mapVersion!==26)return legacy;
 const ready=Math.max(0,Math.floor(guards)),sites=Math.max(0,Math.floor(frontiers));
 // AI 3.3 left exposed captured Bastions unmanned until five reserves
 // existed, often conceding the entire economy to an infantry rush.
 // Keep at least TWO paid sentries at the HQ at all times.
 if(mapVersion===24)return Math.min(ready>=6?2:ready>=3?1:0,sites);
 return Math.min(ready>=6?2:ready>=4?1:0,sites);
}

/** Distance along a real completed path, not a misleading straight line.
 * A* may stop on a grid-cell centre. Endpoints more than 1.5 cells from
 * the chosen capture-ring point do NOT count as physically reachable.
 * This is terrain-only public information; no fogged enemy information. */
export function openingCaptureRouteLength(
 start:{x:number;y:number},goal:{x:number;y:number},
 route:readonly {x:number;y:number}[],cell:number
):number{
 if(!route.length||!Number.isFinite(cell)||cell<=0)return Infinity;
 const d=(a:{x:number;y:number},b:{x:number;y:number})=>
  Math.hypot(a.x-b.x,a.y-b.y);
 if(d(route[route.length-1],goal)>Math.max(35,cell*1.5))return Infinity;
 let len=0,from=start;
 for(const to of route){
  if(![to.x,to.y].every(Number.isFinite))return Infinity;
  len+=d(from,to);from=to;
 }
 return len;
}

/** An opening scout that is ALREADY physically inside an uncontested
 * neutral Bastion's capture ring must not be ordered to march to its own
 * feet every 3s. Keep the original active-order guard, and allow genuine
 * counterattacks on BLUE sectors to issue commands normally.
 *
 * A small margin avoids claiming capture while barely outside the ring
 * because the physical unit/collider has a finite size. No path, fog or
 * mission data are inferred by this pure check. */
export function openingScoutNeedsCaptureMove(x:{
 sectorOwner:number;distanceToSector:number;
 capturePresenceRadius:number;existingCaptureOrder:boolean;
}):boolean{
 if(x.existingCaptureOrder)return false;
 if(x.sectorOwner===-1&&Number.isFinite(x.distanceToSector)&&
    x.distanceToSector<=x.capturePresenceRadius-8)return false;
 return true;
}
