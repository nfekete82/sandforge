/** Modern desert AI: protect real production before sacrificing paid infantry.
 * Pure policy: observed pressure, own losses and recorded failed fronts only.
 * No opponent roster, fog query, resources or free reinforcements.
 */
export interface HomeDefenseInput {
 fighters:number;time:number;recentLosses:number;recentFailures:number;
 lastFailureAt:number;observedHomePressure:boolean;defendedTarget:boolean;
 confirmedEndgame:boolean;tempoPressure?:boolean;
}
export interface HomeDefensePlan {
 guards:number;minimumReady:number;notBefore:number;allowSecondaryRaids:boolean;
 mode:'cleanup'|'defense'|'recover'|'buildup'|'probe';
}
export function homeDefensePlan(x:HomeDefenseInput):HomeDefensePlan {
 if(x.confirmedEndgame)return {guards:0,minimumReady:0,notBefore:0,allowSecondaryRaids:true,mode:'cleanup'};
 const fighters=Math.max(0,Math.floor(x.fighters));
 const failures=Math.max(0,Math.floor(x.recentFailures));
 const losses=Math.max(0,Math.floor(x.recentLosses));
 const setback=failures>0||losses>=2;
 // A 180-second forced buildup and 2-5 stationary sentries made the AI
 // look passive even after it had bought a valid paid attack group.
 // Keep a genuine garrison, but release useful combat troops sooner.
 const early=x.time<(x.tempoPressure?95:125);
 const base=fighters>=14?4:fighters>=9?3:fighters>=6?2:fighters>=3?1:fighters;
 // A beaten force needs surviving screens at the headquarters; a visible
 // intruder earns more guards, never imaginary instant defenders.
 const guards=Math.min(fighters,Math.max(1,base)+(setback?1:0)+(x.observedHomePressure?2:0));
 // An unguarded neutral bastion is not a fortified assault: a pair of
 // available troops may secure it after the opening delay while the real
 // base garrison stays home. Requiring four *after* reserving two guards
 // deadlocked the 4-bastion campaign on both live user seeds (no captures
 // at 220 seconds even though the neutral front and rally were reachable).
 // Keep higher thresholds for observed defenders and recent setbacks.
 const minimumReady=setback?(x.defendedTarget?6:5):x.defendedTarget?5:2;
 const cooldown=failures?Math.max(0,x.lastFailureAt)+Math.min(75,32+failures*13):
  losses>=2?x.time+12:0;
 return {
  guards,minimumReady,
  notBefore:Math.max(early?(x.tempoPressure?37:50):0,cooldown),
  allowSecondaryRaids:(!early||x.tempoPressure)&&!setback&&!x.observedHomePressure&&fighters>=10,
  mode:x.observedHomePressure?'defense':setback?'recover':early?'buildup':'probe'
 };
}
