#!/usr/bin/env node
/** Known real-battle outcomes: never 'fix' gathering by losing siege wins.
 * Only analyzes externally measured finished simulation artifacts. */
import {readFileSync} from 'node:fs';
if(process.argv.length!==3)throw Error('Usage: node check-sandforge-ai40-offense-results.mjs REPORT');
const d=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(!d.complete||d.finished!==6)throw Error('Unfinished combat matrix');
const rr=d.runs.filter(x=>x.variant==='ai38');
if(rr.length!==3)throw Error('Invalid KI4.0 variant batch');
const map=rr[0].map,seed=rr[0].seed;
const known=map===26&&seed===9999?
 {guarded:{win:true},contesting:{win:true}}:
 map===26&&seed===824836862?
 {guarded:{captures:14},contesting:{captures:6},'bastion-rush':{captures:8}}:{};
for(const r of rr){
 const expectation=known[r.opponent];
 if(!expectation)continue;
 if(expectation.win&&r.outcome!=='win')
  throw Error('Previously victorious siege regressed: '+r.opponent+
   ', actual='+r.outcome);
 if(expectation.captures!==undefined&&r.netCaptures<expectation.captures)
  throw Error('Lost contested Bastion control: '+r.opponent+
   ', actual='+r.netCaptures+', expected='+expectation.captures);
}
console.log('AI40_OFFENSE_GUARD '+JSON.stringify({ok:true,map,seed,
 results:rr.map(r=>({opponent:r.opponent,outcome:r.outcome,
 shots:r.shotEvents,bastions:r.netCaptures,closestHQ:r.nearestEnemyHQ}))}));
