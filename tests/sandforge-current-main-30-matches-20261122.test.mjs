import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CURRENT_DESERT_MAPS,SCENARIOS,optionsFrom,currentWorld,rollup
} from '../scripts/benchmark-current-desert-ai-20261122.mjs';
import {
 MAP_IDS,REQUIRED_OPPONENTS,summarizeCurrentReports
} from '../scripts/report-current-desert-ai-20261122.mjs';

test('30 scenarios cover all six current authored maps using five fair BLUE policies',()=>{
 assert.equal(CURRENT_DESERT_MAPS.length,6);
 assert.deepEqual(CURRENT_DESERT_MAPS.map(m=>m.id),MAP_IDS);
 assert.equal(SCENARIOS.length,5);
 assert.deepEqual([...SCENARIOS.map(s=>s.opponent)].sort(),
  [...REQUIRED_OPPONENTS].sort());
 assert.equal(6*5,30);
 assert.deepEqual(CURRENT_DESERT_MAPS.map(m=>m.generatorVersion),
  [10,10,10,10,10,7]);
 for(const map of CURRENT_DESERT_MAPS){
  const opts=optionsFrom(['--map',map.id,'--seconds','480','--output','/tmp/'+map.id+'.json']);
  assert.equal(opts.map.seed,map.seed);
  assert.equal(opts.map.generatorVersion,map.generatorVersion);
  assert.equal(opts.seconds,480);
 }
 assert.throws(()=>optionsFrom(['--map','unknown','--output','/tmp/a.json']));
 assert.throws(()=>optionsFrom(['--map','desert-strike','--seconds','11','--output','/tmp/a.json']));
});

test('every current map starts with exact live physical terrain, no free armies',()=>{
 for(const map of CURRENT_DESERT_MAPS){
  const g=currentWorld(map,map.seed);
  assert.equal(g.world.generatorVersion,map.generatorVersion);
  assert.equal(g.world.generated.landscapeKind,map.kind);
  assert.equal(g.bases.filter(b=>b.kind==='headquarters'&&b.hp>0).length,2);
  assert.equal(g.units.filter(u=>u.owner===0).length,
   g.units.filter(u=>u.owner===1).length);
  assert.equal(g.tactical.mode,'director');
  assert.equal(g.tactical.ai36Mode,'coordinated');
  assert.equal(g.tactical.ai33Mode,'adaptive');
  assert.equal(g.credits[0],g.credits[1]);
 }
});

test('timeouts cannot be counted as wins even when HQ damage increases',()=>{
 const rows=[
  {outcome:'timeout',enemyHQDamage:750,enemyHQDamaged:true,
   enemyHQDestroyed:false,netCaptures:2,abortedMissions:3,stalledMissions:1,
   aircraftProduced:0,rapidUnitOrderChanges:4,vehicleStallSeconds:50,
   redProducedByKind:{drone:1}},
  {outcome:'win',enemyHQDamage:1000,enemyHQDamaged:true,
   enemyHQDestroyed:true,netCaptures:3,abortedMissions:1,
   stalledMissions:0,aircraftProduced:1,vehicleStallSeconds:20,
   rapidUnitOrderChanges:7,battleRetreats:1,redProducedByKind:{bomber:1}}
 ];
 const r=rollup(rows);
 assert.equal(r.matches,2);
 assert.equal(r.wins,1);
 assert.equal(r.timeouts,1);
 assert.equal(r.hqDamaged,2);
 assert.equal(r.meanVehicleStallSeconds,35);
 assert.equal(r.droneProduced,undefined);
});

test('report rejects partial data and non-paired seeds before publishing',()=>{
 assert.throws(()=>summarizeCurrentReports([]),/6 map reports/);
 const reports=MAP_IDS.map(id=>({
  map:id,complete:true,completedRuns:5,expectedRuns:5,
  generatorVersion:id==='mesa-highlands'?7:10,
  details:REQUIRED_OPPONENTS.map(opponent=>({
   mapId:id,seed:123,opponent,generatorVersion:id==='mesa-highlands'?7:10,
   mode:'director',outcome:'timeout',initialStateHash:'fixed-'+id
  })),
  summary:{matches:5,wins:0,losses:0,timeouts:5}
 }));
 const analysis=summarizeCurrentReports(reports);
 assert.equal(analysis.summary.matches,30);
 assert.equal(analysis.summary.timeouts,30);
 assert.equal(analysis.summary.wins,0);
 assert.match(analysis.markdown,/30 Partien/);
 reports[0].details[0].seed=124;
 assert.throws(()=>summarizeCurrentReports(reports),/Wrong seed/);
});
