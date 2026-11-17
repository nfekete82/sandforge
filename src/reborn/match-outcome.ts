/** Sandforge ends when the opposing army is eliminated OR all of its
 * buildings are destroyed after it has established a base. The second rule
 * uses persisted building history because both WebGL factions start HQ-less:
 * two living armies with zero buildings at time zero must NOT instantly win.
 *
 * Boarded troops count toward army survival, but cannot prolong the match
 * once their faction has lost its last structure. Unfinished construction
 * counts while HP > 0. Destroyed HQ capture stubs (HP=0) never count.
 * Symmetric across both factions; simultaneous elimination is a defeat.
 */
export interface FactionAsset {
 owner:number;
 hp:number;
 carrier?:number;
 buildRemaining?:number;
}
export type MatchOutcome='playing'|'victory'|'defeat';
export function hasFactionAssets(
 units:readonly FactionAsset[],bases:readonly FactionAsset[],owner:0|1
):boolean {
 return units.some(u=>u.owner===owner&&u.hp>0)||
  bases.some(b=>b.owner===owner&&b.hp>0);
}
export function hasFactionBuildings(
 bases:readonly FactionAsset[],owner:0|1
):boolean {
 return bases.some(b=>b.owner===owner&&b.hp>0);
}
export function eliminationOutcome(
 units:readonly FactionAsset[],bases:readonly FactionAsset[],
 hadBuildings:readonly [boolean,boolean]=[false,false]
):MatchOutcome {
 // The optional flag is kept off for historical callers. Live Simulation
 // always supplies its persisted history for the new base-elimination rule.
 const eliminated=(owner:0|1)=>!hasFactionAssets(units,bases,owner)||
  (hadBuildings[owner]&&!hasFactionBuildings(bases,owner));
 // A simultaneous loss is not a blue victory. Preserve existing 3-state
 // save schema and prioritize the player's defeat in this rare case.
 if(eliminated(0))return 'defeat';
 if(eliminated(1))return 'victory';
 return 'playing';
}
