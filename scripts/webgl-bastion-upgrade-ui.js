/**
 * Presentation-only status for a Bastion clicked on the WebGL battlefield.
 * Authoritative credits / capture / ownership checks stay in Simulation.
 * No changes to RTS economy or save formats.
 */
export const BASTION_UI_UPGRADE_COST=750;
export function bastionUpgradeStatus(territory,{
 credits=0,homeIds=[],headquartersTerritories=[],playing=true
}={}){
 if(!territory)return null;
 const level=territory.upgradeLevel===2?2:1;
 const home=homeIds.includes(territory.id)||
  headquartersTerritories.includes(territory.id);
 let reason='';
 if(!playing)reason='Die Partie ist bereits beendet.';
 else if(territory.owner!==0)
  reason=territory.owner===1?'Erst die gegnerische Bastion erobern.':
   'Erst die neutrale Bastion erobern.';
 else if(home)reason='Die Heimatbastion kann nicht verbessert werden. Erobere eine weitere Bastion.';
 else if(level===2)reason='Stufe 2 erreicht: Einkommen bereits verdoppelt.';
 else if(territory.progress>0||
  (territory.capturing!==-1&&territory.capturing!==0))
  reason='Die Bastion wird gerade umkämpft.';
 else if(credits<BASTION_UI_UPGRADE_COST)
  reason='Es fehlen '+(BASTION_UI_UPGRADE_COST-credits)+' Credits.';
 const upgradable=reason==='';
 return {
  id:territory.id,level,home,upgradable,
  cost:BASTION_UI_UPGRADE_COST,
  currentIncome:territory.income*(level===2?2:1),
  nextIncome:territory.income*2,
  reason,
  buttonLabel:level===2?'STUFE 2 ✓':
   'BASTION VERBESSERN · '+BASTION_UI_UPGRADE_COST,
  label:territory.name||'Bastion '+(territory.id+1)
 };
}
