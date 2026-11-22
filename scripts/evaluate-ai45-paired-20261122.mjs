/**
 * Compare one completed AI45 paired report. Never mistake "no AI45 activation"
 * for an improvement, and never recommend a merge from incomplete data.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pairSummary} from './benchmark-ai45-paired-20261122.mjs';

const score=r=>r.outcome==='win'?1:r.outcome==='loss'?-1:0;
export function evaluateAI45Report(report){
 if(!report?.complete||report.expectedRuns!==10||
    report.details?.length!==10||report.requestedSeconds<120)
  throw Error('AI45 evaluation requires 10 completed matches');
 const summary=pairSummary(report.details);
 if(summary.completePairs!==5)throw Error('AI45 evaluation requires five valid pairs');
 const pairs=summary.pairs;
 const differences=pairs.map(p=>({
  map:p.map,opponent:p.opponent,
  scoreDelta:score(p.treatment)-score(p.control),
  hqDamageDelta:(p.treatment.hqDamage??0)-(p.control.hqDamage??0),
  stalledDelta:(p.treatment.stalled??0)-(p.control.stalled??0),
  abortedDelta:(p.treatment.aborted??0)-(p.control.aborted??0),
  rescueCount:p.treatment.rallyRescues??0
 }));
 const totals={
  ...summary,
  affectedPairs:differences.filter(p=>p.rescueCount>0).length,
  improvedPairs:differences.filter(p=>p.scoreDelta>0).length,
  worsenedPairs:differences.filter(p=>p.scoreDelta<0).length,
  totalScoreDelta:differences.reduce((n,p)=>n+p.scoreDelta,0),
  totalHQDamageDelta:differences.reduce((n,p)=>n+p.hqDamageDelta,0),
  totalStalledDelta:differences.reduce((n,p)=>n+p.stalledDelta,0),
  totalAbortedDelta:differences.reduce((n,p)=>n+p.abortedDelta,0)
 };
 const verdict=totals.affectedPairs===0?'NO_ACTIVATIONS':
  totals.worsenedPairs>0||totals.totalScoreDelta<0?'REGRESSION_REVIEW':
  totals.improvedPairs>0?'PROMISING_NOT_PROVEN':'INCONCLUSIVE';
 return {verdict,map:report.map,totals,differences,
  note:'A/B on a single map is not proof of higher overall win rate; inspect all three maps and full CI before merging.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(!process.argv[2])throw Error('Usage: node scripts/evaluate-ai45-paired-20261122.mjs report.json [summary.json]');
 const output=process.argv[3];
 const result=evaluateAI45Report(JSON.parse(readFileSync(resolve(process.argv[2]),'utf8')));
 const payload=JSON.stringify(result,null,2)+'\n';
 if(output)writeFileSync(resolve(output),payload);
 console.log('AI45_EVALUATION '+payload);
}
