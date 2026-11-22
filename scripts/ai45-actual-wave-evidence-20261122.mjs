/**
 * Passive AI45 benchmark telemetry. Never gives the director information or orders.
 * Count real assault launches via live state transitions (not only the
 * coordinated + defended subset in TacticalDiagnostics.waveLaunches).
 */
export function createAI45WaveEvidence(){
 return {lastSample:-1,seenGroupKeys:new Set(),phaseSeconds:{gather:0,attack:0,regroup:0,defend:0},
  maxAtRally:0,firstAttackAt:null,firstRescueAt:null,
  actualWaveLaunches:0,firstActualWaveAt:null,launchesByMission:{},
  coordinatedDefendedWaveLaunches:0,coordinatedWaveWaits:0};
}

export function observeAI45WaveEvidence(stats,g,rescues=0){
 const s=g.tactical.state;
 // Do this on EVERY simulation tick: one-second sampling can miss a fast
 // launch -> aborted/regroup transition entirely.
 if(s.phase==='attack'&&s.group?.length&&Number.isFinite(s.launchedAt)&&Number.isInteger(s.groupId)){
  const key=s.groupId+':'+s.launchedAt;
  if(!stats.seenGroupKeys.has(key)){
   stats.seenGroupKeys.add(key);
   stats.actualWaveLaunches++;
   stats.firstActualWaveAt??=Number(s.launchedAt.toFixed(3));
   const mission=s.commander?.mission?.kind??(s.objective==null?'capture':'structure');
   stats.launchesByMission[mission]=(stats.launchesByMission[mission]??0)+1;
  }
 }
 const tick=Math.floor(g.time+1e-8);
 if(tick===stats.lastSample)return;
 stats.lastSample=tick;
 if(Object.hasOwn(stats.phaseSeconds,s.phase))stats.phaseSeconds[s.phase]++;
 if(s.phase==='attack'&&stats.firstAttackAt===null)stats.firstAttackAt=tick;
 if(rescues>0&&stats.firstRescueAt===null)stats.firstRescueAt=tick;
 if(s.rally){
  const count=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
   Math.hypot(u.x-s.rally.x,u.y-s.rally.y)<330).length;
  stats.maxAtRally=Math.max(stats.maxAtRally,count);
 }
 // These existing counters are narrower than all actual launches: they
 // increment ONLY when the coordinated mode attacks a defended objective.
 stats.coordinatedDefendedWaveLaunches=Math.max(stats.coordinatedDefendedWaveLaunches,g.tactical.diagnostics.waveLaunches??0);
 stats.coordinatedWaveWaits=Math.max(stats.coordinatedWaveWaits,g.tactical.diagnostics.waveWaits??0);
}

export function snapshotAI45WaveEvidence(stats){
 return {phaseSeconds:{...stats.phaseSeconds},maxAtRally:stats.maxAtRally,
  firstAttackAt:stats.firstAttackAt,firstRescueAt:stats.firstRescueAt,
  actualWaveLaunches:stats.actualWaveLaunches,firstActualWaveAt:stats.firstActualWaveAt,
  launchesByMission:{...stats.launchesByMission},
  coordinatedDefendedWaveLaunches:stats.coordinatedDefendedWaveLaunches,
  coordinatedWaveWaits:stats.coordinatedWaveWaits,
  // Backward-compatible legacy fields; DO NOT interpret as every attack.
  waveLaunches:stats.coordinatedDefendedWaveLaunches,waveWaits:stats.coordinatedWaveWaits};
}

export function ai45ObjectiveProgress(metrics){
 return {captures:metrics.captures,netCaptures:metrics.netCaptures,
  redSectors:metrics.redSectors,bastionControlSeconds:metrics.bastionControlSeconds,
  blueUnitsLost:metrics.blueUnitsLost,enemyBuildingDamage:metrics.enemyBuildingDamage,
  attackingSeconds:metrics.attackingSeconds,missionCount:metrics.missionCount};
}
