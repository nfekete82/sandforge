/**
 * 30 headless, paid-unit matches on the current MAIN code and current actual
 * desert terrain generator, not the archived AI3.2-3.6 tournament branches.
 * 6 exact fixed desert maps x 5 reproducible BLUE policies each.
 *
 * Run (after npm run build):
 * node scripts/benchmark-current-desert-ai-20261122.mjs --map desert-strike --seconds 480 --output /tmp/desert-strike.json
 *
 * Prebuilt HQs on BOTH sides, for apples-to-apples RTS midgame AI evaluation.
 * This is a benchmark configuration; the actual user campaign begins without
 * built HQs. No cheating, extra credits, free units or hidden enemy intel.
 * ALL five opponents use the exact authored seed and 3D terrain on each map.
 * Terrain and starting armies are identical for the five strategies.
 */
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import './webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {blueDefense} from './benchmark-ai-opponent.mjs';

export const CURRENT_DESERT_MAPS=Object.freeze(
 globalThis.SandforgeDesertMaps.maps.map(x=>Object.freeze({...x}))
);
export const SCENARIOS=Object.freeze([
 Object.freeze({opponent:'guarded'}),
 Object.freeze({opponent:'contesting'}),
 Object.freeze({opponent:'bastion-rush'}),
 Object.freeze({opponent:'fortified'}),
 Object.freeze({opponent:'mobile-defense'})
]);
const hash=x=>createHash('sha256').update(x).digest('hex');
export function optionsFrom(argv){
 const args={};for(let i=0;i<argv.length;i+=2){
  if(!argv[i]?.startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))
   throw Error('Expected --name value pairs');
  if(!['map','seconds','output'].includes(argv[i].slice(2)))
   throw Error('Unknown argument '+argv[i]);
  args[argv[i].slice(2)]=argv[i+1];
 }
 if(!CURRENT_DESERT_MAPS.some(m=>m.id===args.map))
  throw Error('Select --map from '+CURRENT_DESERT_MAPS.map(m=>m.id).join(','));
 const seconds=Number(args.seconds??480);
 if(!Number.isInteger(seconds)||seconds<120||seconds>900)
  throw Error('Seconds must be an integer 120..900');
 if(!args.output)throw Error('--output required');
 return {map:CURRENT_DESERT_MAPS.find(m=>m.id===args.map),
  seconds,output:resolve(args.output)};
}
export function currentWorld(map,seed){
 const g=new Simulation(seed,map.mapVersion,false,false,map.terrain,map.generatorVersion);
 if(g.world.generatorVersion!==map.generatorVersion)
  throw Error('Wrong terrain generator in benchmark');
 if(g.world.generated?.landscapeKind!==map.kind)
  throw Error('Wrong current-map landscape kind '+g.world.generated?.landscapeKind);
 if(g.world.validation?.valid===false)
  throw Error('Invalid current battlefield '+JSON.stringify(g.world.validation));
 if(g.bases.filter(b=>b.kind==='headquarters'&&b.hp>0).length!==2)
  throw Error('Both teams must start with a real paid-scenario HQ');
 return g;
}
export function rollup(details){
 const mean=key=>details.reduce((n,r)=>n+(Number(r[key])||0),0)/Math.max(1,details.length);
 return {
  matches:details.length,
  wins:details.filter(x=>x.outcome==='win').length,
  losses:details.filter(x=>x.outcome==='loss').length,
  timeouts:details.filter(x=>x.outcome==='timeout').length,
  hqSeen:details.filter(x=>x.enemyHQSeen).length,
  hqDamaged:details.filter(x=>x.enemyHQDamaged).length,
  hqDestroyed:details.filter(x=>x.enemyHQDestroyed).length,
  meanEnemyHQDamage:Number(mean('enemyHQDamage').toFixed(1)),
  meanNetCaptures:Number(mean('netCaptures').toFixed(2)),
  meanStalledMissions:Number(mean('stalledMissions').toFixed(2)),
  meanAbortedMissions:Number(mean('abortedMissions').toFixed(2)),
  meanFirstOrganizedAttack:Number(mean('firstOrganizedAttack').toFixed(1)),
  meanAircraftProduced:Number(mean('aircraftProduced').toFixed(2)),
  meanVehicleDeaths:Number(mean('vehicleDeaths').toFixed(2)),
  meanRapidOrderChanges:Number(mean('rapidUnitOrderChanges').toFixed(2)),
  meanVehicleStallSeconds:Number(mean('vehicleStallSeconds').toFixed(1)),
  matchesWithBlockedVehicles:details.filter(x=>x.vehicleStallSeconds>0).length,
  meanUnexplainedIdle:Number((details.reduce((n,r)=>n+
   (Number(r.productionIdleReasons?.['unexplained-idle'])||0),0)/Math.max(details.length,1)).toFixed(1)),
  totalBattleRetreats:details.reduce((n,r)=>n+r.battleRetreats,0)
 };
}
export async function runCurrentDesertBenchmark(map,seconds,output){
 const report={
  schema:'sandforge-current-deserts-headless-v1',
  source:'current main-derived integration branch; uses exact 2026-11-22 live terrain generator and TacticalAI',
  sha:process.env.GITHUB_SHA??null,
  simulationSourceHash:hash(readFileSync(new URL('../dist/src/reborn/simulation.js',import.meta.url))),
  mode:'director',
  setup:'Prebuilt HQs on both sides (not campaign bootstrap); no free resources; no fog-of-war exemption',
  notes:'All five policies use EXACT fixed-map seed/terrain. No run changes opponent resources or fog rules; only paid BLUE strategy. No timeouts counted as wins.',
  map:map.id,mapVersion:map.mapVersion,terrain:map.terrain,generatorVersion:map.generatorVersion,
  requestedSeconds:seconds,expectedRuns:SCENARIOS.length,complete:false,
  completedRuns:0,details:[],summary:null
 };
 const save=()=>{
  report.completedRuns=report.details.length;
  report.complete=report.completedRuns===report.expectedRuns;
  report.summary=rollup(report.details);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
  renameSync(output+'.tmp',output);
 };
 save();
 for(const scenario of SCENARIOS){
  const seed=map.seed;
  const stalls=new Map();
  let lastSampledSecond=-1,vehicleStallSeconds=0,siegeRallyRescues=0;
  // Passive observer only. Never changes unit orders, route requests,
  // targeting or resources. Counts 10s+ immobility during a genuine
  // long-distance MOVE mission, not a tank standing and firing.
  const observe=g=>{
   siegeRallyRescues=g.tactical.ai45RallyRescues??0;
   const second=Math.floor(g.time+1e-8);
   if(second===lastSampledSecond)return;
   lastSampledSecond=second;
   const alive=new Set();
   for(const unit of g.units){
    if(unit.owner!==1||unit.hp<=0||unit.carrier||
       !['tank','artillery','rover'].includes(unit.kind))continue;
    alive.add(unit.id);
    const order=unit.orders?.[0];
    if(!order||!['move','attackMove'].includes(order.kind)||
       Math.hypot(unit.x-order.x,unit.y-order.y)<220){
      stalls.delete(unit.id);continue;
    }
    const previous=stalls.get(unit.id);
    if(!previous){
     stalls.set(unit.id,{x:unit.x,y:unit.y,stopped:0});
     continue;
    }
    const advance=Math.hypot(previous.x-unit.x,previous.y-unit.y);
    if(advance<7)previous.stopped++;
    else previous.stopped=0;
    if(previous.stopped>=10)vehicleStallSeconds++;
    previous.x=unit.x;previous.y=unit.y;
   }
   for(const id of stalls.keys())if(!alive.has(id))stalls.delete(id);
  };
  const opts={
   opponent:scenario.opponent,seconds,ai33:'adaptive',
   ai35:'control',ai36:'coordinated',
   label:'main-live-terrain-'+map.id,
   simulationFactory:()=>currentWorld(map,seed),
   observe,
   ...(scenario.opponent==='fortified'?{
    defender:g=>blueDefense(g,{holdHome:true,infantryLimit:8,heavyLimit:2})
   }:scenario.opponent==='mobile-defense'?{
    defender:g=>blueDefense(g,{holdHome:false,infantryLimit:8,heavyLimit:2})
   }:{})
  };
  const metrics=runMatch({Simulation,UNITS},opts,seed,'director',map.mapVersion);
  metrics.mapId=map.id;metrics.generatorVersion=map.generatorVersion;
  metrics.terrainProfile=map.terrain;
  metrics.vehicleStallSeconds=vehicleStallSeconds;
  metrics.ai45SiegeRallyRescues=siegeRallyRescues;
  report.details.push(metrics);save();
  console.log('RESULT '+JSON.stringify({
   map:map.id,seed,opponent:scenario.opponent,
   outcome:metrics.outcome,simulatedSeconds:metrics.elapsedSeconds,
   captures:metrics.netCaptures,hqDamage:metrics.enemyHQDamage,
   hqDestroyed:metrics.enemyHQDestroyed,
   stalled:metrics.stalledMissions,aborted:metrics.abortedMissions,
   bomberCount:metrics.redProducedByKind.bomber??0,
   droneCount:metrics.redProducedByKind.drone??0,
   stalledOrders:metrics.rapidUnitOrderChanges,
   siegeRallyRescues:metrics.ai45SiegeRallyRescues,
   wallMs:metrics.wallMs
  }));
 }
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const options=optionsFrom(process.argv.slice(2));
 const result=await runCurrentDesertBenchmark(options.map,options.seconds,options.output);
 console.log('SUMMARY '+JSON.stringify({map:result.map,...result.summary}));
}
