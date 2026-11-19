import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {parseTournamentArgs,applyBalancePreset,tournamentSummary,
 pairedComparison,tournamentMarkdown,BALANCE_PRESETS} from
 '../scripts/benchmark-sandforge-balance-tournament.mjs';

test('CLI accepts 8/12/16 Bastions and paired reproducible map seeds',()=>{
 const o=parseTournamentArgs(['--maps','24,25,26','--seeds','12,13,14',
  '--opponents','guarded,contesting','--seconds','240',
  '--presets','baseline,tuned']);
 assert.deepEqual(o.maps,[24,25,26]);
 assert.deepEqual(o.opponents,['guarded','contesting']);
 assert.deepEqual(o.presets,['baseline','tuned']);
 assert.equal(o.maps.length*o.seeds.length*o.opponents.length*o.presets.length,36);
 for(const args of [
  ['--maps','3'],['--maps','24,24'],['--seeds','12,12'],
  ['--seeds','-1'],['--seconds','NaN'],['--seconds','10'],
  ['--opponents','cheating'],['--presets','unknown'],['--secret','a']
 ])assert.throws(()=>parseTournamentArgs(args));
});

test('baseline and tuned presets affect exactly four intended public costs/stats',()=>{
 const before={heavy:UNITS.heavy.cost,rocket:UNITS.rocket.hp,
  turret:BUILDINGS.turret.cost,research:BUILDINGS.research.cost};
 try{
  const old=applyBalancePreset('baseline');
  assert.deepEqual(old,BALANCE_PRESETS.baseline);
  assert.deepEqual([UNITS.heavy.cost,UNITS.rocket.hp,
   BUILDINGS.turret.cost,BUILDINGS.research.cost],[250,95,175,950]);
  const tuned=applyBalancePreset('tuned');
  assert.deepEqual(tuned,BALANCE_PRESETS.tuned);
  assert.deepEqual([UNITS.heavy.cost,UNITS.rocket.hp,
   BUILDINGS.turret.cost,BUILDINGS.research.cost],[300,110,300,700]);
 }finally{
  UNITS.heavy.cost=before.heavy;UNITS.rocket.hp=before.rocket;
  BUILDINGS.turret.cost=before.turret;BUILDINGS.research.cost=before.research;
 }
});

const fixture=(preset,extra={})=>({
 version:24,seed:42,opponent:'guarded',preset,outcome:'timeout',
 firstContact:25,elapsedSeconds:60,battleEvents:12,netCaptures:2,
 enemyHQDamage:100,redUnitsLost:3,
 averageIncomeAdvantage:13,p95SimulationTickMs:0.9,
 redProducedByKind:{infantry:2,tank:1},paidBuildingsByKind:{barracks:1},
 initialStateHash:'same-world',earnedCredits:[300,450],...extra
});

test('no artificial wins: timeout stays timeout; metrics count only measured events',()=>{
 const rows=[fixture('baseline'),fixture('tuned',{battleEvents:16,netCaptures:3,
  enemyHQDamage:210,redUnitsLost:2,redProducedByKind:{tank:2}})];
 const summary=tournamentSummary(rows);
 assert.equal(summary.length,2);
 assert.ok(summary.every(x=>x.wins===0&&x.losses===0&&x.timeouts===1));
 assert.equal(summary.find(x=>x.preset==='baseline').redProducedByKind.infantry,2);
 const paired=pairedComparison(rows);
 assert.equal(paired.length,1);
 assert.deepEqual(paired[0],{version:24,seed:42,opponent:'guarded',
  landscape:undefined,baseline:'timeout',tuned:'timeout',deltaNetCaptures:1,
  deltaEnemyHQDamage:110,deltaBattleEvents:4,deltaRedLosses:-1,
  deltaEarnedCredits:0,sameInitialWorld:true});
 const doc=tournamentMarkdown({summary,paired});
 assert.match(doc,/8 Bastionen/);assert.match(doc,/Zeitlimits/);
 assert.match(doc,/Forschungszentrum/);assert.match(doc,/kein WebGL-FPS-Test/);
});

test('paired comparison rejects mismatched starting worlds rather than fabricating improvements',()=>{
 assert.throws(()=>pairedComparison([fixture('baseline'),fixture('tuned',{
  initialStateHash:'different'
 })]),/identical playable worlds/);
 assert.deepEqual(pairedComparison([fixture('baseline')]),[]);
});
