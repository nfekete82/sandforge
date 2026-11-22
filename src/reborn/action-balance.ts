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
 earlyProbeMinimumFighters:2
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
 blue:number;red:number;observedHomeThreat:boolean;
}):{slots:number;counter:boolean}=>{
 if(x.preset!=='action'||x.mapVersion<23||
  x.time<18||x.time>ACTION_BALANCE.openingContestSeconds||
  x.available<ACTION_BALANCE.earlyProbeMinimumFighters||x.observedHomeThreat)return {slots:0,counter:false};
 const counter=x.blue-x.red>=2&&x.blue>=3&&x.time>=50&&x.available>=4;
 return {slots:x.available>=4?2:1,counter};
};
