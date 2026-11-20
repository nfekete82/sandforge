/** KI 4.3: use earned Bastion dominance for a REAL, previously observed
 * enemy-HQ siege without discarding an active assault every planning tick.
 * The policy cannot discover hidden enemy buildings or create units/credits.
 */
export interface Ai43HqBreakthroughInput {
 time:number;
 ownedBastions:number;
 totalBastions:number;
 knownLivingHQ:boolean;
 /** An actual visible HQ, or a still-live and recently started real HQ siege. */
 liveHQContact:boolean;
 mobileFighters:number;
 healthyMobile:number;
 artillery:number;
 observedHomeThreat:boolean;
 recentLosses:number;
}
export function ai43OffensiveHqBreakthrough(x:Ai43HqBreakthroughInput):boolean{
 // Do NOT divert a winning Bastion army onto the last hidden HQ while
 // 2-4 strategic sectors are still active. Initial 75% A/B trials turned
 // a genuine Last Stronghold win into a timeout with longer vehicle stalls.
 const securedNeed=x.totalBastions>=12
  ?x.totalBastions-1:Math.ceil(x.totalBastions*.875);
 const enoughBastions=x.ownedBastions>=Math.max(3,securedNeed);
 return x.time>=165&&x.totalBastions>=4&&enoughBastions&&
  x.knownLivingHQ&&x.liveHQContact&&x.mobileFighters>=9&&x.healthyMobile>=7&&
  x.artillery>=1&&!x.observedHomeThreat&&x.recentLosses<4;
}
/** A breakthrough HQ is a valid continuing structure mission even while
 * unrelated Bastions remain unheld. Preserve its since/progressAt so the
 * siege can actually advance: an unchanged mission MUST NOT be recreated
 * on each 3-second macro tick. Stop immediately if HQ intel vanishes or the
 * assault authorisation is revoked, or let existing real-loss logic replan.
 */
export function ai43KeepKnownHqMission(x:{
 breakthrough:boolean;
 rememberedKind:string|undefined;
 rememberedId:number|undefined;
 activeObjective:number|null;
}):boolean{
 return x.breakthrough&&x.rememberedKind==='headquarters'&&
  Number.isInteger(x.rememberedId)&&
  x.rememberedId===x.activeObjective;
}
