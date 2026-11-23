/**
 * One paid combatant, one macro-level order owner per planning pulse.
 *
 * The existing AI has separately capable emergency defenders, Bastion
 * openers, coordinated recapture groups, raiders and campaign armies.
 * This arbiter prevents those controllers from claiming the same soldier
 * after a higher-priority controller has legitimately overridden its order.
 *
 * Pure and deterministic: no fog access, units spawned, saved fields, timers
 * or special map identifiers. Lower-priority missions may retry next pulse.
 */
export type CombatDuty='defense'|'opening'|'recapture'|'raid'|'campaign';

export interface CombatDutyRequests {
 defense:ReadonlySet<number>;
 opening:ReadonlySet<number>;
 recapture:ReadonlySet<number>;
 raid:ReadonlySet<number>;
}

export interface CombatDutyConflict {
 id:number;winner:Exclude<CombatDuty,'campaign'>;
 displaced:Exclude<CombatDuty,'campaign'>;
}

export interface CombatDutyPlan {
 defense:Set<number>;opening:Set<number>;recapture:Set<number>;
 raid:Set<number>;campaign:Set<number>;
 owners:ReadonlyMap<number,CombatDuty>;
 conflicts:readonly CombatDutyConflict[];
}

/**
 * Priority is about legality of orders, not the value of each mission.
 * An observed raid on a real owned Bastion can preempt a neutral scout;
 * a recapture cannot steal a soldier actively protecting our HQ; and a
 * secondary raid cannot repeatedly seize an assault or recapture member.
 */
export function planCombatDuties(
 available:readonly number[],requested:CombatDutyRequests
):CombatDutyPlan{
 const live=new Set(available.filter(id=>Number.isInteger(id)&&id>=0));
 const owners=new Map<number,CombatDuty>();
 const conflicts:CombatDutyConflict[]=[];
 const groups={
  defense:new Set<number>(),opening:new Set<number>(),
  recapture:new Set<number>(),raid:new Set<number>(),campaign:new Set<number>()
 };
 for(const duty of ['defense','opening','recapture','raid'] as const){
  // Sort to avoid Set insertion-order-dependent decisions. Each unit is
  // considered exactly once per requested duty.
  for(const id of [...requested[duty]].sort((a,b)=>a-b)){
   if(!live.has(id))continue;
   const occupied=owners.get(id);
   if(occupied){
    if(occupied!=='campaign')
     conflicts.push({id,winner:occupied,displaced:duty});
    continue;
   }
   owners.set(id,duty);
   groups[duty].add(id);
  }
 }
 for(const id of [...live].sort((a,b)=>a-b)){
  if(owners.has(id))continue;
  groups.campaign.add(id);
  owners.set(id,'campaign');
 }
 return {...groups,owners,conflicts};
}
