/**
 * Same-binary AI 4.5 A/B: identical seed, map, BLUE policy, duration, and
 * initial playable state; the only difference is the runtime-only ai45Mode.
 * 3 maps x 5 opponent policies x 2 variants = 30 complete matches.
 */
import {mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CURRENT_DESERT_MAPS,SCENARIOS,currentWorld} from './benchmark-current-desert-ai-20261122.mjs';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueDefense} from './benchmark-ai-opponent.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {createAI45WaveEvidence,observeAI45WaveEvidence,snapshotAI45WaveEvidence,ai45ObjectiveProgress}
 from './ai45-actual-wave-evidence-20261122.mjs';

export const AI45_MAPS=Object.freeze(['burning-horizon','plateau-crossroads','mesa-highlands']);
export const AI45_VARIANTS=Object.freeze(['off','on']);
export function pairSummary(details){
 const pairs=[];
 for(const [key,rows] of Map.groupBy(details,r=>r.mapId+'|'+r.opponent)){
  if(rows.length!==2)throw Error('Incomplete A/B pair: '+key);
  const control=rows.find(r=>r.ai45==='off'),treatment=rows.find(r=>r.ai45==='on');
  if(!control||!treatment||control.initialStateHash!==treatment.initialStateHash||
   control.seed!==treatment.seed||control.requestedSeconds!==treatment.requestedSeconds)
   throw Error('Nonidentical A/B initial conditions: '+key);
  pairs.push({map:control.mapId,opponent:control.opponent,seed:control.seed,
   initialStateHash:control.initialStateHash,
   control:{outcome:control.outcome,hqDamage:control.enemyHQDamage,
    stalled:control.stalledMissions,aborted:control.abortedMissions,
    rallyRescues:control.ai45SiegeRallyRescues,wave:control.ai45WaveEvidence,progress:ai45ObjectiveProgress(control)},
   treatment:{outcome:treatment.outcome,hqDamage:treatment.enemyHQDamage,
    stalled:treatment.stalledMissions,aborted:treatment.abortedMissions,
    rallyRescues:treatment.ai45SiegeRallyRescues,wave:treatment.ai45WaveEvidence,progress:ai45ObjectiveProgress(treatment)}});
 }
 return {completePairs:pairs.length,controlWins:pairs.filter(p=>p.control.outcome==='win').length,
  treatmentWins:pairs.filter(p=>p.treatment.outcome==='win').length,
  treatmentRallyRescues:pairs.reduce((n,p)=>n+p.treatment.rallyRescues,0),pairs};
}
export function parseOptions(argv){
 const args={};for(let i=0;i<argv.length;i+=2){
  if(!argv[i]?.startsWith('--')||!argv[i+1])throw Error('Expected --map/--seconds/--output values');
  args[argv[i].slice(2)]=argv[i+1];
 }
 if(Object.keys(args).some(x=>!['map','seconds','output'].includes(x)))throw Error('Unknown option');
 const map=CURRENT_DESERT_MAPS.find(m=>m.id===args.map);
 if(!map||!AI45_MAPS.includes(map.id))throw Error('Invalid AI45 map');
 const seconds=Number(args.seconds??480);
 if(!Number.isInteger(seconds)||seconds<120||seconds>900)throw Error('Invalid seconds');
 if(!args.output)throw Error('Missing output');
 return {map,seconds,output:resolve(args.output)};
}
export function runPairedAI45(map,seconds,output){
 const report={schema:'sandforge-ai45-paired-v1',map:map.id,seed:map.seed,
  requestedSeconds:seconds,expectedRuns:SCENARIOS.length*AI45_VARIANTS.length,
  complete:false,details:[],summary:null};
 const save=()=>{report.complete=report.details.length===report.expectedRuns;
  report.summary=report.complete?pairSummary(report.details):null;
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
  renameSync(output+'.tmp',output);
 };
 save();
 for(const scenario of SCENARIOS)for(const ai45 of AI45_VARIANTS){
  let rescueCount=0;
  const waveEvidence=createAI45WaveEvidence();
  const opts={opponent:scenario.opponent,seconds,ai33:'adaptive',
   ai35:'control',ai36:'coordinated',ai45,
   label:'ai45-paired-'+map.id,
   simulationFactory:()=>currentWorld(map,map.seed),
   observe:g=>{
    rescueCount=g.tactical.ai45RallyRescues??0;
    observeAI45WaveEvidence(waveEvidence,g,rescueCount);
   },
   ...(scenario.opponent==='fortified'?{
     defender:g=>blueDefense(g,{holdHome:true,infantryLimit:8,heavyLimit:2})
   }:scenario.opponent==='mobile-defense'?{
     defender:g=>blueDefense(g,{holdHome:false,infantryLimit:8,heavyLimit:2})
   }:{})
  };
  const metrics=runMatch({Simulation,UNITS},opts,map.seed,'director',map.mapVersion);
  metrics.mapId=map.id;metrics.ai45=ai45;metrics.ai45SiegeRallyRescues=rescueCount;
  metrics.ai45WaveEvidence=snapshotAI45WaveEvidence(waveEvidence);
  report.details.push(metrics);save();
  console.log('RESULT '+JSON.stringify({map:map.id,policy:scenario.opponent,
   ai45,outcome:metrics.outcome,hqDamage:metrics.enemyHQDamage,
   stalled:metrics.stalledMissions,aborted:metrics.abortedMissions,
   rallyRescues:rescueCount,wave:metrics.ai45WaveEvidence}));
 }
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const {map,seconds,output}=parseOptions(process.argv.slice(2));
 const r=runPairedAI45(map,seconds,output);
 console.log('PAIRED '+JSON.stringify({map:r.map,complete:r.complete,
  pairs:r.summary?.completePairs,controlWins:r.summary?.controlWins,
  treatmentWins:r.summary?.treatmentWins,
  treatmentRallyRescues:r.summary?.treatmentRallyRescues}));
}
