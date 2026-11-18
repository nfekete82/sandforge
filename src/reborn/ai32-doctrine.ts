/** Sandforge AI 3.2: deterministic, resource-neutral tactical policy.
 * Inputs are own paid units, PUBLIC Bastion ownership and enemy contacts
 * actually observed by RED. No omniscient queries, bonuses or spawned units.
 */
export interface DecisiveContact {
 own:number;enemy:number;visible:number;inRange:number;healthy:number;
 knownTowers:number;artillery:number;
}
/** Continue a local fight where a real, healthy line has >= 1.5:1 power.
 * Known guns require proper artillery and a larger superiority margin.
 */
export function decisiveContact(x:DecisiveContact):boolean {
 if(!Number.isFinite(x.own)||!Number.isFinite(x.enemy)||
    x.own<=0||x.enemy<=0||x.visible<=0||x.inRange<2||x.healthy<2)return false;
 if(x.knownTowers>0&&x.artillery<1)return false;
 return x.own>=x.enemy*(x.knownTowers>0?1.9:1.5);
}

/** Two real mobile soldiers/vehicles may take an unguarded second Bastion
 * while >=5 main attackers and a >=2-unit paid home screen remain.
 * Modern eight-plus Bastion maps alone permit this earlier than older maps.
 * The caller must separately verify a genuinely safe, reachable route.
 */
export interface ParallelFront {
 mapVersion:number;time:number;phase:string;fighters:number;main:number;
 eligible:number;homeGuards:number;homePressure:boolean;
 recentLosses:number;recentFailures:number;emergency:boolean;
}
export function parallelFrontReady(x:ParallelFront):boolean {
 if(x.mapVersion<24||x.time<95||x.phase!=='attack'||x.emergency||
    x.homePressure||x.recentLosses>0||x.recentFailures>0)return false;
 if(x.fighters<10||x.main<5||x.eligible<2||x.homeGuards<2)return false;
 return x.main+2+x.homeGuards<=x.fighters;
}

/** Distribute limited, paid sentries without leaving production unguarded.
 * 2/3 guards -> 1 border; 4+ -> 2 borders, never more than two.
 */
export function frontierGuardPosts(guards:number,frontiers:number):number {
 const ready=Math.max(0,Math.floor(guards));
 if(ready<2||frontiers<=0)return 0;
 return Math.min(Math.max(0,Math.floor(frontiers)),ready>=4?2:1);
}

/** A valuable observed frontline Bastion deserves an extra local reserve,
 * not remote attackers pulled from the main offensive squad.
 */
export function localBastionDefenseMultiplier(income:number,baseEmergency:boolean):number {
 return !baseEmergency&&income>=35?1.4:1.2;
}
