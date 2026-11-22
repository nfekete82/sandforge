import test from 'node:test';
import assert from 'node:assert/strict';
import {createAI45WaveEvidence,observeAI45WaveEvidence,snapshotAI45WaveEvidence,ai45ObjectiveProgress}
 from '../scripts/ai45-actual-wave-evidence-20261122.mjs';

const game=(time,phase,groupId,launchedAt,group=[],diagnostics={waveLaunches:0,waveWaits:0})=>({
 time,units:[],tactical:{state:{phase,groupId,launchedAt,group,rally:null,
 commander:{mission:{kind:'capture'}}},diagnostics}
});

test('counts real attack group transitions, even those between one-second samples',()=>{
 const stats=createAI45WaveEvidence();
 observeAI45WaveEvidence(stats,game(.05,'gather',0,0));
 observeAI45WaveEvidence(stats,game(.1,'attack',1,.1,[7,8,9]));
 observeAI45WaveEvidence(stats,game(.15,'regroup',1,.1));
 observeAI45WaveEvidence(stats,game(1.05,'attack',1,.1,[7,8]));
 observeAI45WaveEvidence(stats,game(1.1,'attack',2,1.1,[8,9]));
 observeAI45WaveEvidence(stats,game(1.15,'attack',2,1.1,[8,9]));
 const x=snapshotAI45WaveEvidence(stats);
 assert.equal(x.actualWaveLaunches,2);
 assert.equal(x.firstActualWaveAt,.1);
 assert.equal(x.launchesByMission.capture,2);
 assert.equal(x.coordinatedDefendedWaveLaunches,0);
 assert.equal(x.waveLaunches,0);
 assert.equal(x.phaseSeconds.gather,1);
 assert.equal(x.phaseSeconds.attack,1);
});
test('ignores empty groups, preserves defended-only diagnostic counters and samples rally occupancy',()=>{
 const stats=createAI45WaveEvidence();
 const g=game(.1,'attack',2,.1,[],{waveLaunches:3,waveWaits:2});
 g.tactical.state.rally={x:100,y:100};
 g.units=[{x:100,y:100,owner:1,hp:30,carrier:null},
  {x:200,y:100,owner:1,hp:30,carrier:null},
  {x:200,y:100,owner:0,hp:30,carrier:null}];
 observeAI45WaveEvidence(stats,g,1);
 const x=snapshotAI45WaveEvidence(stats);
 assert.equal(x.actualWaveLaunches,0);
 assert.equal(x.coordinatedDefendedWaveLaunches,3);
 assert.equal(x.coordinatedWaveWaits,2);
 assert.equal(x.maxAtRally,2);
 assert.equal(x.firstRescueAt,0);
});
test('compares strategic Bastion gains, not just HQ damage',()=>{
 const progress=ai45ObjectiveProgress({captures:4,netCaptures:3,redSectors:5,
  bastionControlSeconds:1021,blueUnitsLost:8,enemyBuildingDamage:0,
  attackingSeconds:104,missionCount:2});
 assert.equal(progress.netCaptures,3);
 assert.equal(progress.bastionControlSeconds,1021);
 assert.equal(progress.enemyBuildingDamage,0);
});
