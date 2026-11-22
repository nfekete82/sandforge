import test from 'node:test';
import assert from 'node:assert/strict';
import {AI45_MAPS,AI45_VARIANTS,parseOptions,pairSummary}
 from '../scripts/benchmark-ai45-paired-20261122.mjs';
import {readFileSync} from 'node:fs';

test('AI45 uses two variants on three real plateau/canyon maps',()=>{
 assert.deepEqual(AI45_VARIANTS,['off','on']);
 assert.deepEqual(AI45_MAPS,['burning-horizon','plateau-crossroads','mesa-highlands']);
 const args=parseOptions(['--map','burning-horizon','--seconds','480','--output','/tmp/ai45.json']);
 assert.equal(args.map.id,'burning-horizon');
 assert.throws(()=>parseOptions(['--map','desert-strike','--output','/tmp/x.json']));
});
test('paired comparison refuses incomplete, unequal or fake control',()=>{
 const row=ai45=>({mapId:'burning-horizon',opponent:'guarded',ai45,
  initialStateHash:'identical',seed:1907,requestedSeconds:480,
  outcome:ai45==='on'?'win':'timeout',enemyHQDamage:ai45==='on'?100:0,
  stalledMissions:0,abortedMissions:0,ai45SiegeRallyRescues:ai45==='on'?1:0});
 const a=row('off'),b=row('on');
 assert.equal(pairSummary([a,b]).treatmentWins,1);
 assert.equal(pairSummary([a,b]).controlWins,0);
 assert.equal(pairSummary([a,b]).treatmentRallyRescues,1);
 assert.throws(()=>pairSummary([a]),/Incomplete/);
 assert.throws(()=>pairSummary([a,{...b,initialStateHash:'different'}]),/Nonidentical/);
 assert.throws(()=>pairSummary([b,b]),/Nonidentical/);
});
test('same compiled TacticalAI supports a runtime-only OFF control',()=>{
 const ai=readFileSync('src/reborn/tactical-ai.ts','utf8');
 const bench=readFileSync('scripts/benchmark-reborn-ai.mjs','utf8');
 assert.match(ai,/ai45Mode:'off'\|'on'='on'/);
 assert.match(ai,/if\(this\.ai45Mode==='on'&&this\.ai36Enabled/);
 assert.match(bench,/g\.tactical\.ai45Mode=options\.ai45/);
});
