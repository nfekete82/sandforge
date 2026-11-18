/** Experimental KI 3.6: coordinate PAID soldiers to retake exposed Bastions.
 * Pure public-sector policy; enemy troop strength must be passed by caller
 * from actually visible combatants. No assets, credits or map knowledge added.
 */
export type AI36Mode='off'|'coordinated';
export interface RecaptureReadiness {
 mapVersion:number;time:number;ownSectors:number;enemySectors:number;
 eligible:number;homeUnderAttack:boolean;recentlyLost:boolean;
}
/** A detachment is legal only if it leaves >=2/3 paid HQ defenders and
 * >=2/3 other fighters for the campaign. Early 4/12-Bastion policy unchanged. */
export function recaptureDetachmentSize(x:RecaptureReadiness):number {
 if(![24,26].includes(x.mapVersion)||x.time<85||
    x.homeUnderAttack||x.enemySectors<2||x.ownSectors<1||
    !(x.enemySectors>=x.ownSectors||x.recentlyLost))return 0;
 if(x.mapVersion===24)return x.eligible>=7?2:0;
 return x.eligible>=10?3:0;
}
/** Prefer a recently lost Bastion and economic value; penalize actual
 * reachable travel and observed risk. Never use hidden units or omniscient HP.
 */
export function recaptureObjectiveScore(x:{
 routeLength:number;routeRisk:number;income:number;recentLoss:boolean;
 visibleDefenders:number;alreadyAssigned:boolean;
}):number {
 return x.routeLength + x.routeRisk*90 +
  x.visibleDefenders*250 - x.income*10 -
  (x.recentLoss?550:0)-(x.alreadyAssigned?160:0);
}
/** Don't launch two fragile infantry into visible tank/rocket defenders. */
export function recaptureThreatPermits(
 squadPower:number,observedEnemyPower:number,knownTurret:boolean
):boolean{
 return !knownTurret&&squadPower>0&&
  (observedEnemyPower<=0||squadPower>=observedEnemyPower*1.3);
}
