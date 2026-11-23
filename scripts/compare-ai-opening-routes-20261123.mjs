#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [before,after]=process.argv.slice(2);
if(!before||!after)throw Error('Use: compare baseline.log candidate.log');
const read=(file)=>fs.readFileSync(file,'utf8').split('\n')
 .filter(s=>s.startsWith('OPENING_MATCH '))
 .map(s=>JSON.parse(s.slice('OPENING_MATCH '.length)));
const a=read(before),b=read(after);
assert.ok(a.length&&a.length===b.length,'equal and nonempty A/B scenarios');
let improvements=0,losses=0;
for(let i=0;i<a.length;i++){
 const old=a[i],next=b[i];
 assert.equal(old.map,next.map,'same named map');
 assert.equal(old.seed,next.seed,'identical terrain seed');
 assert.equal(old.seconds,next.seconds,'identical simulated time');
 assert.equal(old.bluePaidHQ,true,'baseline must fund BLUE HQ');
 assert.equal(next.bluePaidHQ,true,'candidate must fund BLUE HQ');
 const capturedDelta=next.redCaptures-old.redCaptures;
 if(capturedDelta>0)improvements++;
 if(capturedDelta<0)losses++;
 const result={map:old.map,seed:old.seed,
  firstCaptureBaseline:old.firstRedCapture,firstCaptureCandidate:next.firstRedCapture,
  firstGroundDamageBaseline:old.firstRedFight,firstGroundDamageCandidate:next.firstRedFight,
  redCapturesBaseline:old.redCaptures,redCapturesCandidate:next.redCaptures,
  redOwnedBaseline:old.redOwned,redOwnedCandidate:next.redOwned,
  blueOwnedBaseline:old.blueOwned,blueOwnedCandidate:next.blueOwned,
  redGroundUnitsBaseline:old.redUnits,redGroundUnitsCandidate:next.redUnits,
  AStarBaseline:old.totalPathRequests,AStarCandidate:next.totalPathRequests};
 console.log('OPENING_AB '+JSON.stringify(result));
}
console.log('OPENING_SUMMARY '+JSON.stringify({maps:a.length,captureImprovements:improvements,captureRegressions:losses,benchmarkOnly:true}));
