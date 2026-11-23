/** Paired same-scene visual acceptance: report measured change, never infer
 * statistical significance from two repeats. Can flag material regressions.
 * "before" loads the identical main renderer modules over the PR-built game.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const file=process.argv[2],out=process.argv[3];
if(!file)throw Error('Usage: node scripts/compare-visual-polish31-acceptance.mjs report.json [summary.json]');
const input=JSON.parse(readFileSync(file,'utf8'));
const results=input.reports||[];
assert.ok(results.length>0,'missing browser results');
assert.deepEqual(input.errors||[],[],'renderer/shader/page errors');
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);
 return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const maps=[...new Set(results.map(r=>r.map))];
const summary=[];
for(const map of maps){
 const group=results.filter(r=>r.map===map);
 const before=group.filter(r=>r.variant==='before'),after=group.filter(r=>r.variant==='after');
 const required=group[0].stress?1:2;
 assert.ok(before.length>=required&&after.length>=required,
  map+' must have '+required+' interleaved sample(s) per variant');
 for(const run of group){
  assert.equal(run.metrics.glError,0,map+' WebGL error');
  assert.ok(run.metrics.initialDetails===run.actorCount,map+' missing real vehicle GLBs');
  assert.ok(run.metrics.shots>0,map+' no observed combat');
 }
 const controls=before[0];
 for(const run of group){
  assert.deepEqual(run.scene,controls.scene,map+' altered camera/seed/GPU');
  assert.deepEqual(run.metrics.simulation,controls.metrics.simulation,map+' altered simulation');
  assert.equal(run.metrics.drawCalls,controls.metrics.drawCalls,
   map+' changed draw calls');
  assert.equal(run.metrics.triangles,controls.metrics.triangles,
   map+' changed triangles');
 }
 const software=!!controls.softwareQA;
 assert.ok(group.every(r=>!!r.softwareQA===software),'mixed RAF and software cadence');
 assert.ok(group.every(r=>r.screenWidth===controls.screenWidth&&r.screenHeight===controls.screenHeight),
  'mixed viewport sizes');
 const stats=(variants,key)=>median(variants.map(r=>r.metrics[key]));
 const fpsA=software?null:stats(before,'fps'),fpsB=software?null:stats(after,'fps'),
  lowA=software?null:stats(before,'lowFps'),lowB=software?null:stats(after,'lowFps'),
  workA=stats(before,'workMs'),workB=stats(after,'workMs');
 const meanChangePct=100*(workB/workA-1);
 const row={map,stress:!!controls.stress,totalVehicles:controls.actorCount+controls.enemyCount,
  viewport:controls.screenWidth+'x'+controls.screenHeight,
  softwareRendererBench:software,
  repeatedPairs:Math.min(before.length,after.length),
  measurementConfidence:controls.stress?'single-pair descriptive stress':'two-pair descriptive visual',
  fpsMain:fpsA,fpsVisual:fpsB,low1PercentMain:lowA,low1PercentVisual:lowB,
  workMsMain:workA,workMsVisual:workB,workChangePct:meanChangePct,
  lowChangePct:software?null:100*(lowB/lowA-1),
  draws:controls.metrics.drawCalls,triangles:controls.metrics.triangles,
  status:software?'software-render-work-descriptive-not-GPU-approval':
   meanChangePct>5?'review-performance':'within-5-percent-mean-budget'};
 summary.push(row);
 console.log('VISUAL_POLISH31_AB '+JSON.stringify(row));
}
const output={source:file,warning:'Software-rendered Chromium measurements are not GPU-device performance. Two repeats (stress: one) do not prove changes in 1%-lows, cross-hardware FPS or sustained performance.',results:summary};
if(out)writeFileSync(out,JSON.stringify(output,null,2)+'\n');
if(process.env.POLISH31_REJECT_SLOW==='1'&&summary.some(x=>x.workChangePct>5))
 throw Error('Mean frame work exceeded 5% on at least one matched scene; keep PR Draft');
