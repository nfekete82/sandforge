import type {Territory} from './world.js';
import type {Base} from './simulation.js';

export const BASTION_UPGRADE_COST=750;
export const BASTION_MAX_LEVEL=2;
/** One paid double-income tier. A captured or contested bastion cannot
 * be upgraded. The fixed starting home sectors never qualify.
 */
export function bastionEffectiveIncome(t:Territory):number {
 return t.income*(t.upgradeLevel===2?2:1);
}
export function bastionUpgradable(t:Territory,owner:0|1,
 bases:readonly Base[],homeIds:readonly number[]=[]):boolean{
 return !homeIds.includes(t.id)&&t.owner===owner&&t.upgradeLevel!==2&&
  (t.capturing===-1||t.capturing===owner)&&t.progress<=0&&
  !bases.some(b=>b.kind==='headquarters'&&b.territory===t.id);
}
export function bastionUpgradePaybackSeconds(t:Territory):number{
 return Math.round(BASTION_UPGRADE_COST*10/t.income);
}
export function validBastionUpgradeState(t:Territory):boolean{
 return t.upgradeLevel===undefined||t.upgradeLevel===1||
  t.upgradeLevel===2&&t.owner>=0;
}
