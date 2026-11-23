/**
 * Match elimination/victory rules for classic 1v1 and future 3/4-player FFA
 * and team games. No speculative enemies, units, income or fog shortcuts.
 *
 * A faction is defeated when it has no living units or buildings, OR it
 * previously had a building but its last structure has been destroyed.
 * Thus an HQ-less opening does not instantly defeat a living participant.
 * Boarded soldiers count as alive but cannot save a base-eliminated faction.
 */
export interface FactionAsset {
 owner:number;
 hp:number;
 carrier?:number;
 buildRemaining?:number;
}
export type MatchOutcome='playing'|'victory'|'defeat';
export interface OutcomeSeat {player:number;team:number}
export interface TeamMatchOutcome {
 outcome:MatchOutcome;
 winningTeam:number|null;
 livingTeams:readonly number[];
 eliminatedPlayers:readonly number[];
 /** Dead teammates do not end a 2v2 while their ally is still alive. */
 localPlayerEliminated:boolean;
}
export function hasFactionAssets(
 units:readonly FactionAsset[],bases:readonly FactionAsset[],owner:number
):boolean {
 return units.some(u=>u.owner===owner&&u.hp>0)||
  bases.some(b=>b.owner===owner&&b.hp>0);
}
export function hasFactionBuildings(
 bases:readonly FactionAsset[],owner:number
):boolean {
 return bases.some(b=>b.owner===owner&&b.hp>0);
}

/** The shared engine outcome implementation. All data is actual simulated
 * HP, persisted construction history and PUBLIC team membership.
 *
 * If all teams die simultaneously, the local player loses (legacy 1v1).
 * In 2v2 a fallen human may still win if their living AI ally prevails.
 */
export function resolveTeamElimination(
 units:readonly FactionAsset[],
 bases:readonly FactionAsset[],
 seats:readonly OutcomeSeat[],
 hadBuildings:readonly boolean[],
 localPlayer=0
):TeamMatchOutcome {
 if(seats.length<2||seats.length>4||
    new Set(seats.map(s=>s.player)).size!==seats.length||
    seats.some(s=>!Number.isSafeInteger(s.player)||s.player<0||
     !Number.isSafeInteger(s.team)||s.team<0))
  throw Error('Invalid independent faction/team roster');
 const local=seats.find(s=>s.player===localPlayer);
 if(!local)throw Error('Local player missing from match roster');
 const eliminatedPlayers=seats.filter(s=>
  !hasFactionAssets(units,bases,s.player)||
  (Boolean(hadBuildings[s.player])&&!hasFactionBuildings(bases,s.player))
 ).map(s=>s.player);
 const remaining=seats.filter(s=>!eliminatedPlayers.includes(s.player));
 const livingTeams=[...new Set(remaining.map(s=>s.team))].sort((a,b)=>a-b);
 const localTeamAlive=livingTeams.includes(local.team);
 const winningTeam=livingTeams.length===1?livingTeams[0]:null;
 const outcome:MatchOutcome=!localTeamAlive?'defeat':
  winningTeam===local.team?'victory':'playing';
 return {outcome,winningTeam,livingTeams,eliminatedPlayers,
  localPlayerEliminated:eliminatedPlayers.includes(local.player)};
}

/** Compatibility bridge for the actual legacy 1v1 Simulation and saves.
 * The 3-state status envelope is unchanged. Simultaneous elimination remains
 * a defeat rather than an accidental victory, including HQ-less starts.
 */
export function eliminationOutcome(
 units:readonly FactionAsset[],bases:readonly FactionAsset[],
 hadBuildings:readonly [boolean,boolean]=[false,false]
):MatchOutcome {
 return resolveTeamElimination(units,bases,
  [{player:0,team:0},{player:1,team:1}],hadBuildings,0).outcome;
}
