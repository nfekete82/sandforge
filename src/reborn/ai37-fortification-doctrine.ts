/** KI 3.7: paid, practical fortifications built and staffed with REAL units.
 *
 * Only own credits, units, structures and public Bastion ownership determine
 * policy. Known hostile pressure is supplied by the caller via canSee(1,x).
 * There are no free units, permanent garrison buffs or fog-of-war shortcuts.
 */
export interface FortificationEconomy {
 time:number;
 credits:number;
 income:number;
 completedHeadquarters:boolean;
 completedBarracks:boolean;
 builders:number;
 activeInfantry:number;
 mobileFighters:number;
 ownedBastions:number;
 bunkers:number;
 turrets:number;
 underAttack:boolean;
}
export type FortificationChoice='bunker'|'turret'|null;
export function ai37FortificationChoice(s:FortificationEconomy):FortificationChoice{
 if(!s.completedHeadquarters||!s.completedBarracks||s.builders<1||
    s.mobileFighters<8||s.ownedBastions<2||s.time<125||
    s.underAttack||s.income<50)return null;
 // KI 3.8: an affordable *paid* Bunker must be reachable in normal
 // income games. The old 1,520-credit threshold never fired because macro
 // recruitment spent all income as soon as it was earned.
 if(s.bunkers<1&&s.activeInfantry>=3&&s.credits>=850)return 'bunker';
 // Further fortifications are optional, behind paid forward army and cores.
 if(s.time>=250&&s.bunkers>=1&&s.turrets<2&&
    s.mobileFighters>=11&&s.credits>=950&&s.income>=70)return 'turret';
 if(s.time>=330&&s.bunkers<2&&s.mobileFighters>=14&&
    s.activeInfantry>=6&&s.credits>=1300&&s.income>=100)return 'bunker';
 return null;
}

export interface GarrisonReadiness {
 activeInfantry:number;
 fieldFighters:number;
 bunkerCount:number;
 homeThreat:boolean;
 frontlineOrders:number;
}
/** Target *total* bunker occupants across all active pillboxes.
 * Never strip more than one third of genuine frontline soldiers.
 * Rocket and heavy infantry still use their own normal weapon stats.
 */
export function ai37GarrisonQuota(x:GarrisonReadiness):number{
 if(!x.bunkerCount||x.activeInfantry<3||x.fieldFighters<7)return 0;
 const available=Math.min(x.activeInfantry,
  Math.max(0,x.fieldFighters-5),
  Math.max(0,Math.floor(x.fieldFighters/4)));
 // Keep active assaults staffed: a new pillbox cannot steal two
 // expensive infantry from the only forward group.
 const planned=x.homeThreat?Math.min(3,Math.max(2,Math.floor(x.fieldFighters/6))):
  x.frontlineOrders>=5?1:x.fieldFighters>=18?2:1;
 return Math.max(0,Math.min(available,planned,x.bunkerCount*5));
}

/** A paid upgraded Bastion is worth more to defend than an ordinary neutral
 * expansion. Public ownership and actually seen nearby enemies only.
 */
export function ai37BastionDefenseValue(x:{
 income:number;upgradeLevel?:1|2;visibleRaiders:number;
 contestProgress:number;enemyAdjacent:boolean;
}):number{
 return Math.max(0,x.income)*(x.upgradeLevel===2?2:1)*9+
  (x.upgradeLevel===2?250:0)+
  Math.min(5,Math.max(0,x.visibleRaiders))*210+
  (x.contestProgress>0?1100+Math.min(8,x.contestProgress)*65:0)+
  (x.enemyAdjacent?220:0);
}

/** Avoid economizing away an active defense. When offered a safe owned sector,
 * prioritize its productive payback, not an arbitrary sector number.
 */
export function ai37UpgradeScore(x:{
 income:number;enemyAdjacent:boolean;visibleRaiders:number;
 contested:boolean;alreadyUpgraded:boolean;
}):number{
 if(x.contested||x.alreadyUpgraded||x.visibleRaiders>0)return -Infinity;
 return Math.max(0,x.income)*10-(x.enemyAdjacent?185:0);
}
