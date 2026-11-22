/** KI 3.8: a bounded, deterministic REAL-credit infrastructure envelope.
 * Returning a reserve never creates credits. It prevents the ordinary macro
 * producer from spending money earmarked for one affordable strategic task.
 * Health/visible threats are evaluated by the caller using its own vision.
 */
export interface Ai38InvestmentInput {
  time:number;income:number;
  ownedBastions:number;fieldFighters:number;availableInfantry:number;
  barracksReady:boolean;factoryReady:boolean;airfieldReady:boolean;headquartersReady:boolean;
  totalBastions:number;
  bunkerCount:number;
  /** At least one real siege weapon is alive or already in a paid queue. */
  artilleryReady:boolean;
  hasUpgradeTarget:boolean;
  homeThreat:boolean;
  finishing:boolean;
}
export type Ai38InfrastructureGoal='bunker'|'bastion-upgrade'|null;
export interface Ai38InfrastructurePlan {
  goal:Ai38InfrastructureGoal;
  reserve:number;
  minFreeAfterPurchase:number;
}
/** Only reserve after a meaningful paid offensive group exists.
 * Keep a small, genuine post-purchase operating budget. Under threat or
 * during confirmed final cleanup, refund ALL optional budget to recruitment.
 */
export function ai38InfrastructurePlan(x:Ai38InvestmentInput):Ai38InfrastructurePlan{
  const none:Ai38InfrastructurePlan={goal:null,reserve:0,minFreeAfterPurchase:0};
  if(x.homeThreat||x.finishing||!x.headquartersReady||
     !x.barracksReady||!x.factoryReady||x.ownedBastions<2||
     x.fieldFighters<8||x.income<50)return none;
  // KI 3.9: early bunker saving stalled the offensive in paired battles.
  // Preserve a genuinely paid siege group before buying permanent defenses.
  if(x.bunkerCount===0&&x.availableInfantry>=6&&x.time>=310&&
     x.artilleryReady&&x.fieldFighters>=18&&x.income>=75&&
     x.ownedBastions>=Math.max(3,Math.ceil(x.totalBastions*.5))){
    // Paid 650-credit Bunker + 200 operating credits; no free funds.
    return {goal:'bunker',reserve:850,minFreeAfterPurchase:200};
  }
  // Sector reinvestment is optional: unlike the first Bunker, it must NOT
  // reserve the army's money before aircraft/armor are operational.
  // A 750-credit upgrade often has >200 simulated seconds payback.
  if(x.bunkerCount>0&&x.hasUpgradeTarget&&x.time>=235&&
     x.airfieldReady&&x.income>=90&&x.fieldFighters>=14&&
     x.ownedBastions>=Math.ceil(x.totalBastions*.60)){
    return {goal:'bastion-upgrade',reserve:0,minFreeAfterPurchase:450};
  }
  return none;
}

/** An exposed fortified sector should be attacked only after there is a
 * real and observed target, a working siege escort and sufficient *mobile*
 * fighters. Does NOT create a new victory condition or reveal enemy HQs.
 */
export function ai38DecisiveAssault(x:{
  time:number;totalBastions:number;ownedBastions:number;
  visibleOrRememberedHQ:boolean;
  mobileFighters:number;healthyMobile:number;artillery:number;
  homeThreat:boolean;recentLosses:number;
}):boolean{
 return x.time>=180&&x.totalBastions>=4&&
  x.ownedBastions>=Math.ceil(x.totalBastions*.66)&&
  x.visibleOrRememberedHQ&&x.mobileFighters>=10&&
  x.healthyMobile>=7&&x.artillery>=1&&
  !x.homeThreat&&x.recentLosses<4;
}
