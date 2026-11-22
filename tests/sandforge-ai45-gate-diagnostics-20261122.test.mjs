import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyAI45Prerequisites,summarizeSamples,parseOptions}
 from '../scripts/diagnose-ai45-gates-20261122.mjs';
const base={time:200,supportedTerrain:true,enabled:true,
 mission:{kind:'structure',objective:101,sector:2},observedTarget:true,
 rally:true,phase:'gather',groundFighters:9,gatherSeconds:100,
 redBastions:4,totalBastions:16,observedHQ:true,rallyRescues:0};
test('observable gates distinguish no objective, no paid army, and waiting',()=>{
 assert.equal(classifyAI45Prerequisites(base),'visible-prerequisites-met');
 assert.equal(classifyAI45Prerequisites({...base,mission:{kind:'capture'}}),'not-structure-mission');
 assert.equal(classifyAI45Prerequisites({...base,groundFighters:4}),'fewer-than-eight-ground-fighters');
 assert.equal(classifyAI45Prerequisites({...base,gatherSeconds:12}),'gather-under-95-seconds');
 assert.equal(classifyAI45Prerequisites({...base,observedTarget:false}),'structure-not-in-observed-memory');
});
test('sample summary never claims zero activations prove higher win rate',()=>{
 const x=summarizeSamples([{...base,time:0,mission:{kind:'capture'}},base,
  {...base,time:201,rallyRescues:1}]);
 assert.equal(x.visibleReadySamples,2);
 assert.equal(x.rallyRescues,1);
 assert.equal(x.maxGroundFighters,9);
 assert.equal(x.transitions.length,2);
});
test('diagnostics do not access hidden live enemy bases or units',()=>{
 const s=readFileSync('scripts/diagnose-ai45-gates-20261122.mjs','utf8');
 assert.match(s,/g\.memories\[1\]/);
 assert.doesNotMatch(s,/g\.bases\.filter\(/);
 assert.doesNotMatch(s,/g\.units\.filter\(u=>u\.owner===0/);
 assert.equal(parseOptions(['--map','burning-horizon','--seconds','480','--output','/tmp/gates.json']).seconds,480);
 assert.throws(()=>parseOptions(['--map','missing','--output','/tmp/gates.json']));
});

test('AI45-specific runtime decisions are recorded independently of AI40',()=>{
 const ai=readFileSync('src/reborn/tactical-ai.ts','utf8');
 const report=readFileSync('scripts/diagnose-ai45-gates-20261122.mjs','utf8');
 assert.match(ai,/ai45DecisionTrace:Array</);
 assert.match(ai,/const shouldRelocate=ai45CanRelocateStuckSiege/);
 assert.match(ai,/if\(this\.rallyGateTraceEnabled\)\{/);
 assert.match(ai,/no-reachable-artillery-approach/);
 assert.match(report,/latestAI45Decisions=g\.tactical\.ai45DecisionTrace/);
 assert.match(report,/ai45DecisionTrace:\{samples:latestAI45Decisions\.length/);
});
