/**
 * Ownership and diplomacy for 2, 3 and 4 independent factions.
 *
 * This module is a game-rule building block, not a second game engine.
 * The current 1v1 loop retains its existing behavior until the full
 * Simulation, bot controllers and renderer support all participants.
 *
 * Team membership is public. Units and buildings remain PRIVATE to their
 * controlling faction. No invisible enemy data enters these decisions.
 */
import type {MatchSetup,PlayerId,TeamId} from './multiplayer-setup.js';

export interface Participant {
 player:PlayerId;team:TeamId;
}
export type PublicOwner=-1|PlayerId;

export function participant(setup:MatchSetup,player:PlayerId):Participant{
 const slot=setup.slots.find(s=>s.player===player);
 if(!slot)throw Error('Unknown match participant '+player);
 return {player:slot.player,team:slot.team};
}

/** Only the same explicit team is friendly; FFA has no implicit alliances. */
export function factionHostile(setup:MatchSetup,actor:PlayerId,target:PlayerId):boolean{
 return participant(setup,actor).team!==participant(setup,target).team;
}

export function factionFriendly(setup:MatchSetup,actor:PlayerId,target:PlayerId):boolean{
 return !factionHostile(setup,actor,target);
}

/** Neutral sectors can always be claimed; allied land cannot be stolen. */
export function sectorCaptureAllowed(
 setup:MatchSetup,attacker:PlayerId,currentOwner:PublicOwner
):boolean{
 participant(setup,attacker);
 return currentOwner===-1||factionHostile(setup,attacker,currentOwner);
}

/** Used by combat/target acquisition once the additional factions exist.
 * A unit can never deliberately damage an ally, even after a target switch.
 * Visiblity MUST be checked separately with that actor's own fog data. */
export function enemyTargetAllowed(
 setup:MatchSetup,attacker:PlayerId,target:{owner:PlayerId;hp:number}
):boolean{
 return target.hp>0&&factionHostile(setup,attacker,target.owner);
}

/** Only observed hostile assets may enter an AI threat decision. */
export function observedHostiles<T extends {owner:PlayerId;hp:number}>(
 setup:MatchSetup,actor:PlayerId,assets:readonly T[],
 observed:(asset:T)=>boolean
):T[]{
 return assets.filter(asset=>asset.hp>0&&
  factionHostile(setup,actor,asset.owner)&&observed(asset));
}

/** Teamwide score (not a private omniscient intelligence report).
 * Supply only PUBLIC sector ownerships to this function. */
export function publicTeamTerritoryCounts(
 setup:MatchSetup,owners:readonly PublicOwner[]
):Map<TeamId,number>{
 const totals=new Map<TeamId,number>();
 for(const slot of setup.slots)totals.set(slot.team,0);
 for(const owner of owners){
  if(owner===-1)continue;
  const team=participant(setup,owner).team;
  totals.set(team,(totals.get(team)??0)+1);
 }
 return totals;
}
