/**
 * Independent owned state for up to four factions.
 *
 * No shared credits, technology, fog buffer, memory or AI clock. The
 * runtime adapter intentionally does not try to instantiate TacticalAI:
 * that class is currently hard-wired to RED/1 and must be migrated before
 * the UI advertises multiple opponents.
 */
import type {MatchSetup,PlayerId,TeamId} from './multiplayer-setup.js';
import {newResearchState,type ResearchState} from './strategic-tech.js';

export interface FactionRuntimeSlot {
 player:PlayerId;
 team:TeamId;
 controller:'human'|'ai';
 credits:number;
 hadBuildings:boolean;
 visible:Uint8Array;
 explored:Uint8Array;
 /** Last actually observed enemy buildings, scoped to THIS faction. */
 memories:{id:number;owner:number;x:number;y:number;seenAt:number}[];
 research:ResearchState;
 /** Independent simulated-time budget for future per-faction TacticalAI. */
 aiClock:number;
}

/** One factory call per player; never Array(n).fill(sharedState). */
export function perPlayerSlots<T>(count:number,create:(id:number)=>T):T[]{
 if(!Number.isInteger(count)||count<2||count>4)
  throw Error('Sandforge supports 2-4 individual participant slots');
 return Array.from({length:count},(_,id)=>create(id));
}

export function createFactionRuntimeSlots(
 setup:MatchSetup,fogCells:number,initialCredits=950
):FactionRuntimeSlot[]{
 if(!Number.isSafeInteger(fogCells)||fogCells<1||fogCells>4_000_000)
  throw Error('Fog buffer length must be a positive bounded integer');
 if(!Number.isSafeInteger(initialCredits)||initialCredits<0)
  throw Error('Initial credits must be a nonnegative integer');
 return perPlayerSlots(setup.playerCount,index=>{
  const s=setup.slots[index];
  if(!s||s.player!==index)throw Error('Malformed faction setup order');
  return {player:s.player,team:s.team,controller:s.controller,
   credits:initialCredits,hadBuildings:false,
   visible:new Uint8Array(fogCells),
   explored:new Uint8Array(fogCells),memories:[],
   research:newResearchState(),aiClock:0};
 });
}

/** Credit transfers are disabled for now, even between allied bots.
 * This updates exactly ONE owner and never issues free material.
 * Future 2v2 resource sharing must be a distinct, paid game rule. */
export function spendFactionCredits(
 states:readonly FactionRuntimeSlot[],player:PlayerId,cost:number
):boolean{
 if(!Number.isSafeInteger(cost)||cost<0)throw Error('Invalid credit cost');
 const state=states.find(s=>s.player===player);
 if(!state)throw Error('Unknown faction wallet');
 if(state.credits<cost)return false;
 state.credits-=cost;
 return true;
}
export function grantFactionIncome(
 states:readonly FactionRuntimeSlot[],player:PlayerId,earned:number
):void{
 if(!Number.isSafeInteger(earned)||earned<0)throw Error('Invalid paid income');
 const state=states.find(s=>s.player===player);
 if(!state)throw Error('Unknown faction wallet');
 state.credits+=earned;
}
