/** KI 4.3: use earned Bastion dominance for a REAL, previously observed
 * enemy-HQ siege without discarding an active assault every planning tick.
 * The policy cannot discover hidden enemy buildings or create units/credits.
 */
export interface Ai43HqBreakthroughInput {
 time:number;
 ownedBastions:number;
 totalBastions:number;
 knownLivingHQ:boolean;
 mobileFighters:number;
 healthyMobile:number;
 artillery:number;
 observedHomeThreat:boolean;
 recentLosses:number;
}
export function ai43OffensiveHqBreakthrough(x:Ai43HqBreakthroughInput):boolean{
 const enoughBastions=x.ownedBastions>=Math.max(3,Math.ceil(x.totalBastions*.75));
 return x.time>=165&&x.totalBastions>=4&&enoughBastions&&
  x.knownLivingHQ&&x.mobileFighters>=9&&x.healthyMobile>=7&&
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
