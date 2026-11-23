/** Sandforge balance variants. Classic and saved historical data remain
 * unchanged; modifiers apply ONLY to a deliberately selected new match.
 * Values are simulated seconds, not UI fast-forward.
 */
export type BalancePreset='classic'|'action';
export const balancePresetValid=(x:unknown):x is BalancePreset=>
 x==='classic'||x==='action';
export const ACTION_BALANCE=Object.freeze({
 openingCredits:1.20,
 constructionRate:1.25,
 infantryProductionRate:1.30,
 vehicleProductionRate:1.20,
 airProductionRate:1.0,
 groundSpeed:1.12,
 openingContestSeconds:220,
 earlyProbeMinimumFighters:2,
 reconScanCredits:180,
 reconScanCooldown:90,
 reconScanDuration:9,
 reconScanRadius:630
});
export const initialActionCredits=(credits:number):number=>
 Math.round(credits*ACTION_BALANCE.openingCredits);
export const constructionRate=(preset:BalancePreset):number=>
 preset==='action'?ACTION_BALANCE.constructionRate:1;
export const productionRate=(preset:BalancePreset,kind:'Infanterie'|'Fahrzeuge'|'Luftunterstützung'):number=>
 preset!=='action'?1:kind==='Infanterie'?ACTION_BALANCE.infantryProductionRate:
 kind==='Fahrzeuge'?ACTION_BALANCE.vehicleProductionRate:ACTION_BALANCE.airProductionRate;
export const groundSpeedRate=(preset:BalancePreset,flying:boolean):number=>
 preset==='action'&&!flying?ACTION_BALANCE.groundSpeed:1;
export const actionBastionProbePolicy=(x:{
 preset:BalancePreset;mapVersion:number;time:number;available:number;
 blue:number;red:number;frontierEnemy?:number;observedHomeThreat:boolean;
}):{slots:number;counter:boolean}=>{
 if(x.preset!=='action'||x.mapVersion<23||
  x.time<18||x.time>ACTION_BALANCE.openingContestSeconds||
  x.available<ACTION_BALANCE.earlyProbeMinimumFighters||x.observedHomeThreat)return {slots:0,counter:false};
 // Frontier ownership is public map information; no unseen enemy units,
 // structures, cached omniscient destinations or free troops are consulted.
 const threatenedFrontier=(x.frontierEnemy??0)>0;
 const counter=x.time>=50&&x.available>=4&&(
   x.blue-x.red>=2&&x.blue>=3||
   // Challenge a publicly owned Bastion next to our territory even when
   // RED is ahead. Otherwise large maps become parallel neutral land-grabs.
   threatenedFrontier&&x.blue>0);
 // Reserve at least two real troops for the base and other commanders.
 const slots=x.available>=9?4:x.available>=6?3:x.available>=4?2:1;
 return {slots,counter};
};
/** Lower wins. Frontline bias keeps early forces fighting for a shared
 * reachable objective rather than wandering towards far-away neutral income.
 * Only known Bastion ownership and physical A* distance are inputs. */
export function actionBastionGoalScore(x:{
 pathDistance:number;income:number;owner:-1|0|1;
 frontierRed:boolean;frontierBlue:boolean;counter:boolean;
}):number {
 if(!Number.isFinite(x.pathDistance)||x.pathDistance<0)return Infinity;
 return x.pathDistance-Math.min(30,Math.max(0,x.income))*8
  -(x.counter&&x.owner===0?480:0)
  -(x.frontierRed?250:0)
  +(x.frontierBlue&&!x.frontierRed?75:0);
}

/** A small Action detachment may fight one or two actually SEEN soldiers.
 * Never rush known HQs/turrets, massed defenders or an observed HQ assault.
 * Classic opening scouting keeps its historical zero-threat tolerance. */
export function actionContestedBastionSafe(x:{
 preset:BalancePreset;counter:boolean;available:number;visibleEnemies:number;
 knownHq:boolean;knownTurret:boolean;
}):boolean{
 if(x.knownHq||x.knownTurret||x.visibleEnemies<0)return false;
 if(x.visibleEnemies===0)return true;
 return x.preset==='action'&&x.counter&&x.available>=4&&x.visibleEnemies<=2;
}

/** Select a REAL same-goal squad, preserving paid-unit order and avoiding
 * phantom two-unit counterattacks when only one route is traversable.
 * No game state, fog data or extra units are created by this selector. */
export function selectReachableOpeningSquad<T>(
 units:readonly T[],required:number,canReach:(unit:T)=>boolean
):T[]{
 if(!Number.isInteger(required)||required<1||required>units.length)return [];
 const squad:T[]=[];
 for(const unit of units)if(canReach(unit)){
  squad.push(unit);
  if(squad.length===required)break;
 }
 return squad.length===required?squad:[];
}
