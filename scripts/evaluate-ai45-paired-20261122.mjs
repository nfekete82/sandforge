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
  rescueCount:p.treatment.rallyRescues??0,
  actualWaveLaunchesControl:p.control.wave?.actualWaveLaunches??null,
  actualWaveLaunchesTreatment:p.treatment.wave?.actualWaveLaunches??null,
  actualWaveLaunchesDelta:p.control.wave?.actualWaveLaunches==null||
   p.treatment.wave?.actualWaveLaunches==null?null:
   p.treatment.wave.actualWaveLaunches-p.control.wave.actualWaveLaunches,
  netCaptureDelta:(p.treatment.progress?.netCaptures??0)-(p.control.progress?.netCaptures??0),
  controlBastionSeconds:p.control.progress?.bastionControlSeconds??null,
  treatmentBastionSeconds:p.treatment.progress?.bastionControlSeconds??null,
  bastionSecondsDelta:p.control.progress?.bastionControlSeconds==null||
   p.treatment.progress?.bastionControlSeconds==null?null:
   p.treatment.progress.bastionControlSeconds-p.control.progress.bastionControlSeconds,
  enemyBuildingDamageDelta:(p.treatment.progress?.enemyBuildingDamage??0)-
   (p.control.progress?.enemyBuildingDamage??0)
 }));
 const totals={
  ...summary,
  affectedPairs:differences.filter(p=>p.rescueCount>0).length,
  improvedPairs:differences.filter(p=>p.scoreDelta>0).length,
  worsenedPairs:differences.filter(p=>p.scoreDelta<0).length,
  totalScoreDelta:differences.reduce((n,p)=>n+p.scoreDelta,0),
  totalHQDamageDelta:differences.reduce((n,p)=>n+p.hqDamageDelta,0),
  totalStalledDelta:differences.reduce((n,p)=>n+p.stalledDelta,0),
  totalAbortedDelta:differences.reduce((n,p)=>n+p.abortedDelta,0),
  totalActualWaveLaunchDelta:differences.some(p=>p.actualWaveLaunchesDelta===null)?null:
   differences.reduce((n,p)=>n+p.actualWaveLaunchesDelta,0),
  totalNetCaptureDelta:differences.reduce((n,p)=>n+p.netCaptureDelta,0),
  totalBastionSecondsDelta:differences.some(p=>p.bastionSecondsDelta===null)?null:
   differences.reduce((n,p)=>n+p.bastionSecondsDelta,0),
  totalEnemyBuildingDamageDelta:differences.reduce((n,p)=>n+p.enemyBuildingDamageDelta,0)
 };
 const verdict=totals.affectedPairs===0?'NO_ACTIVATIONS':
  totals.worsenedPairs>0||totals.totalScoreDelta<0?'REGRESSION_REVIEW':
  totals.improvedPairs>0?'PROMISING_NOT_PROVEN':'INCONCLUSIVE';
 return {verdict,map:report.map,totals,differences,
  // Tactical progress is useful evidence but cannot be counted as a victory.
  measuredTacticalProgress:totals.totalBastionSecondsDelta===null?'unavailable':
   totals.totalBastionSecondsDelta>0?'more-territory-held':
   totals.totalBastionSecondsDelta<0?'less-territory-held':'unchanged',
  note:'Wave counts and Bastion-seconds are observations, not wins. Compare all three maps, defensive losses and full CI before merging.'};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(!process.argv[2])throw Error('Usage: node scripts/evaluate-ai45-paired-20261122.mjs report.json [summary.json]');
 const output=process.argv[3];
 const result=evaluateAI45Report(JSON.parse(readFileSync(resolve(process.argv[2]),'utf8')));
 const payload=JSON.stringify(result,null,2)+'\n';
 if(output)writeFileSync(resolve(output),payload);
 console.log('AI45_EVALUATION '+payload);
}
