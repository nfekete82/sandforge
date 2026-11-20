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
    s.mobileFighters<6||s.ownedBastions<2||s.time<90||
    s.underAttack||s.income<55)return null;
 // First a genuinely staffed pillbox, then at most one additional
 // local turret. Keep meaningful funds for production and upgrades.
 if(s.bunkers<1&&s.activeInfantry>=5&&s.credits>=1520)return 'bunker';
 if(s.time>=230&&s.bunkers>=1&&s.turrets<2&&
    s.mobileFighters>=9&&s.credits>=1650&&s.income>=70)return 'turret';
 if(s.time>=330&&s.bunkers<2&&s.mobileFighters>=13&&
    s.activeInfantry>=8&&s.credits>=2350&&s.income>=95)return 'bunker';
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
  Math.max(0,Math.floor(x.fieldFighters/3)));
 const planned=x.homeThreat?Math.max(2,Math.floor(x.fieldFighters/4)):
  x.fieldFighters>=14?4:x.fieldFighters>=10?3:2;
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
  Math.max(0,x.contestProgress)*65+
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
