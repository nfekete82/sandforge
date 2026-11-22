import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAI45Report} from '../scripts/evaluate-ai45-paired-20261122.mjs';
const report=(rescues=0,outcome='timeout')=>({
 complete:true,expectedRuns:10,requestedSeconds:480,map:'burning-horizon',
 details:Array.from({length:5},(_,i)=>['off','on'].map(ai45=>({
  mapId:'burning-horizon',opponent:['guarded','contesting','bastion-rush','fortified','mobile-defense'][i],
  seed:123,requestedSeconds:480,initialStateHash:'same-'+i,ai45,
  outcome:ai45==='on'?outcome:'timeout',enemyHQDamage:0,
  stalledMissions:0,abortedMissions:0,ai45SiegeRallyRescues:ai45==='on'?rescues:0
 }))).flat()
});
test('no AI45 rescue is explicitly not a proven improvement',()=>{
 const result=evaluateAI45Report(report());
 assert.equal(result.verdict,'NO_ACTIVATIONS');
 assert.equal(result.totals.affectedPairs,0);
});
test('paired benchmark recognizes actual activations but does not claim proof',()=>{
 const result=evaluateAI45Report(report(1,'win'));
 assert.equal(result.verdict,'PROMISING_NOT_PROVEN');
 assert.equal(result.totals.improvedPairs,5);
});
test('bad or unequal match pairs cannot produce release assessment',()=>{
 const bad=report(1);
 bad.details.pop();
 assert.throws(()=>evaluateAI45Report(bad),/10 completed/);
 const unequal=report(1);
 unequal.details[1].initialStateHash='different';
 assert.throws(()=>evaluateAI45Report(unequal),/Nonidentical/);
});

test('reports actual wave launches and territory control independently of HQ wins',()=>{
 const fixture=report(1);
 for(let i=0;i<fixture.details.length;i++){
  const row=fixture.details[i],on=row.ai45==='on';
  row.ai45WaveEvidence={actualWaveLaunches:on?3:1};
  row.netCaptures=on?2:1;
  row.bastionControlSeconds=on?900:720;
  row.enemyBuildingDamage=on?50:20;
 }
 const result=evaluateAI45Report(fixture);
 assert.equal(result.verdict,'INCONCLUSIVE');
 assert.equal(result.totals.totalActualWaveLaunchDelta,10);
 assert.equal(result.totals.totalNetCaptureDelta,5);
 assert.equal(result.totals.totalBastionSecondsDelta,900);
 assert.equal(result.totals.totalEnemyBuildingDamageDelta,150);
 assert.equal(result.measuredTacticalProgress,'more-territory-held');
 assert.equal(result.totals.improvedPairs,0);
});
