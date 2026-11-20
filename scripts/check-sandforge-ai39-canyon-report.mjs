#!/usr/bin/env node
/** Test-only regression guard for 480s paired games; no gameplay effects. */
import {readFileSync} from 'node:fs';
const noDetour={
 25:{guarded:[392,10],contesting:[300,4],'bastion-rush':[55,4]},
 26:{guarded:[1414,14],contesting:[1346,6],'bastion-rush':[305,8]}
};
if(process.argv.length!==3)throw Error('Usage: node check-sandforge-ai39-canyon-report.mjs FILE');
const path=process.argv[2],d=JSON.parse(readFileSync(path,'utf8'));
if(!d.complete||d.finished!==6||d.total!==6||d.runs.length!==6)throw Error('Incomplete A/B batch');
let oldTotal=0,newTotal=0;const metrics=[];
for(const opponent of ['guarded','contesting','bastion-rush']){
 const x=d.runs.find(v=>v.opponent===opponent&&v.variant==='ai36');
 const y=d.runs.find(v=>v.opponent===opponent&&v.variant==='ai38');
 if(!x||!y||x.seed!==y.seed||x.map!==y.map||
  x.initialStateHash!==y.initialStateHash||x.generatorVersion!==4||y.generatorVersion!==4)
  throw Error('Unfair pairing: '+opponent);
 if(!Number.isFinite(y.longStationaryVehicleSeconds)||
  !Number.isFinite(y.commandedVehicleSeconds)||!Number.isFinite(y.shotEvents)||
  y.longStationaryVehicleSeconds<0)throw Error('Invalid diagnostic data');
 if(y.seed===824836862){
  const [oldStalls,oldCaptures]=noDetour[y.map]?.[opponent]??[];
  if(oldStalls===undefined)throw Error('Missing reference for '+y.map+'/'+opponent);
  oldTotal+=oldStalls;newTotal+=y.longStationaryVehicleSeconds;
  if(y.longStationaryVehicleSeconds>oldStalls*1.05)
   throw Error('Navigation regressed on '+opponent);
  if(y.netCaptures<oldCaptures)
   throw Error('Bastion control regressed on '+opponent);
 }
 metrics.push({map:y.map,seed:y.seed,opponent,
  stuck:y.longStationaryVehicleSeconds,noPath:y.stationaryWithoutPath,
  netBastions:y.netCaptures,closestHQ:y.nearestEnemyHQ,
  nearHQSeconds:y.redNearHQSeconds,shots:y.shotEvents,cpuP95:y.cpu.stepMs.p95});
}
if(oldTotal&&newTotal>oldTotal*.85)
 throw Error('Aggregate canyon stall reduction below 15%');
console.log('AI39_CANYON_CHECK '+JSON.stringify({ok:true,metrics,
 baselineStalls:oldTotal||null,newStalls:oldTotal?newTotal:null}));
