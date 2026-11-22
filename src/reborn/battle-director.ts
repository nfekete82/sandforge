/** Sandforge Battle Director – pure, deterministic *tempo* supervision.
 *
 * No unit spawning, resource alteration or unseen enemy observations.
 * The tactical AI still decides the objective, path, exact attackers, combat
 * and paid production. This layer prevents long idle periods and prioritizes
 * recovering captured territory when the existing army is genuinely ready.
 */
export interface BattleDirectorState {
 lastContactAt:number;
 lastBastionLossAt:number;
 previousOwned:number;
 lastLaunchAt:number;
}
export interface BattleDirectorInput {
 time:number;
 owns:number;
 enemyOwns:number;
 bastions:number;
 frontContact:boolean;
 lastLaunchAt:number;
 readyFighters:number;
 recentLosses:number;
 homeThreat:boolean;
}
export interface BattleDirectorOrder {
 state:BattleDirectorState;
 posture:'opening'|'pressure'|'counterattack'|'combat'|'recover';
 pressure:boolean;
 accelerateRally:boolean;
 promoteRecapture:boolean;
 allowEarlyRaid:boolean;
 quietSeconds:number;
}
/** Simulated-time only: the same seed, observations and orders produce the
 * same state. Ownership is public; front contact must be prefiltered through
 * Simulation.canSee(AI, enemy), never the omniscient simulation roster.
 */
export function battleDirectorPulse(
 input:BattleDirectorInput,previous?:BattleDirectorState
):BattleDirectorOrder{
 const now=Math.max(0,input.time);
 const old=previous??{
  lastContactAt:0,lastBastionLossAt:-1000,
  previousOwned:input.owns,lastLaunchAt:0
 };
 const lost=Math.max(0,old.previousOwned-input.owns);
 const state:BattleDirectorState={
  lastContactAt:input.frontContact?now:old.lastContactAt,
  lastBastionLossAt:lost>0?now:old.lastBastionLossAt,
  previousOwned:input.owns,
  lastLaunchAt:Math.max(old.lastLaunchAt,input.lastLaunchAt)
 };
 const quietSeconds=now-state.lastContactAt;
 const unfinished=input.owns<input.bastions;
 const viable=input.readyFighters>=3;
 const counter=unfinished&&input.enemyOwns>0&&
  now-state.lastBastionLossAt<=100&&viable;
 // Retreats, defense and assembly remain meaningful when the AI has only
 // one badly wounded unit. Pressure never invents a tactical advantage.
 const pressure=now>=52&&unfinished&&viable&&!input.homeThreat&&
  (quietSeconds>=48||counter);
 const recentlyAttacked=input.recentLosses>=3&&quietSeconds<20;
 const posture=input.homeThreat||recentlyAttacked?'recover':
  input.frontContact?'combat':counter?'counterattack':
  pressure?'pressure':now<52?'opening':'recover';
 return {
  state,posture,pressure,
  accelerateRally:pressure&&input.recentLosses<3,
  promoteRecapture:counter,
  allowEarlyRaid:pressure&&now>=85&&input.readyFighters>=8&&
   input.owns>=2&&input.enemyOwns>=1&&input.recentLosses<2,
  quietSeconds
 };
}
export function validBattleDirector(value:unknown,time:number,bastions:number):boolean {
 if(value===undefined)return true;
 const s=value as BattleDirectorState;
 return !!s&&[s.lastContactAt,s.lastBastionLossAt,s.lastLaunchAt].every(v=>
  Number.isFinite(v)&&v<=time+.001&&v>=-1000)&&
  Number.isInteger(s.previousOwned)&&s.previousOwned>=0&&
  s.previousOwned<=bastions;
}
