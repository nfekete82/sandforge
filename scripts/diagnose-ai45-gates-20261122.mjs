/**
 * Read-only diagnosis for AI45 "NO_ACTIVATIONS" results on full-size desert
 * maps. Records only RED's own units, public Bastion ownership and RED's
 * observed enemy memories. Nothing changes AI decisions, orders or resources.
 *
 * npm run build
 * node scripts/diagnose-ai45-gates-20261122.mjs \
 *   --map burning-horizon --seconds 480 --output reports/ai45-gates.json
 */
import {writeFileSync,mkdirSync,renameSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {CURRENT_DESERT_MAPS,currentWorld} from './benchmark-current-desert-ai-20261122.mjs';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,unitSpec} from '../dist/src/reborn/catalog.js';

/** Ordered, observable preconditions, not an assertion about private AI gates. */
export function classifyAI45Prerequisites(x){
 if(!x.supportedTerrain)return 'unsupported-terrain';
 if(!x.enabled)return 'ai45-disabled';
 if(!x.mission)return 'no-mission';
 if(x.mission.kind!=='structure')return 'not-structure-mission';
 if(!x.observedTarget)return 'structure-not-in-observed-memory';
 if(!x.rally)return 'no-rally';
 if(x.phase!=='gather')return 'not-gathering';
 if(x.groundFighters<8)return 'fewer-than-eight-ground-fighters';
 if(x.gatherSeconds<95)return 'gather-under-95-seconds';
 return 'visible-prerequisites-met';
}
export function observeAI45Prerequisites(g){
 const t=g.tactical,s=t.state,m=s.commander?.mission;
 const observedTarget=m?.objective!==null&&m?.objective!==undefined&&
  g.memories[1].some(b=>b.owner===0&&b.hp>0&&b.id===m.objective);
 const groundFighters=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
  !unitSpec(u).flying&&
  !['medic','engineer','scout','supply','drone'].includes(u.kind)).length;
 return {
  time:Math.round(g.time),mapVersion:g.world.mapVersion,
  generatorVersion:g.world.generatorVersion,seed:g.seed,
  supportedTerrain:(g.world.generatorVersion===10&&g.world.mapVersion>=24)||
   (g.world.generatorVersion===7&&g.world.mapVersion===26&&g.seed===271121),
  enabled:t.ai45Mode==='on'&&t.mode==='director'&&t.ai36Mode==='coordinated'&&
   t.ai35Mode==='control'&&t.ai33Mode==='adaptive',
  mission:m?{kind:m.kind,objective:m.objective,sector:m.sector}:null,
  observedTarget:!!observedTarget,
  rally:!!s.rally,phase:s.phase,gatherSeconds:Math.max(0,g.time-s.phaseAt),
  groundFighters,
  observedHQ:g.memories[1].some(b=>b.owner===0&&b.hp>0&&b.kind==='headquarters'),
  redBastions:g.territories.filter(x=>x.owner===1).length,
  totalBastions:g.territories.length,
  rallyRescues:t.ai45RallyRescues??0
 };
}
export function summarizeSamples(samples){
 const counts={},transitions=[];
 let prev=null;
 for(const item of samples){
  const gate=classifyAI45Prerequisites(item);
  counts[gate]=(counts[gate]??0)+1;
  if(gate!==prev){
   transitions.push({second:item.time,gate,phase:item.phase,
    mission:item.mission?.kind??null,groundFighters:item.groundFighters,
    redBastions:item.redBastions,observedHQ:item.observedHQ});
   prev=gate;
  }
 }
 return {samples:samples.length,secondsByObservableGate:counts,
  visibleReadySamples:counts['visible-prerequisites-met']??0,
  maxGroundFighters:Math.max(0,...samples.map(s=>s.groundFighters)),
  maxRedBastions:Math.max(0,...samples.map(s=>s.redBastions)),
  observedHQSeconds:samples.filter(s=>s.observedHQ).length,
  rallyRescues:samples.at(-1)?.rallyRescues??0,
  transitions:transitions.slice(0,150)};
}
export function parseOptions(args){
 const x={};for(let i=0;i<args.length;i+=2){
  if(!args[i]?.startsWith('--')||!args[i+1])throw Error('Expected --name value');
  const key=args[i].slice(2);
  if(!['map','seconds','output'].includes(key))throw Error('Unknown argument: '+key);
  x[key]=args[i+1];
 }
 const map=CURRENT_DESERT_MAPS.find(m=>m.id===x.map);
 if(!map)throw Error('Unknown map');
 const seconds=Number(x.seconds??480);
 if(!Number.isInteger(seconds)||seconds<120||seconds>900)throw Error('Invalid seconds');
 if(!x.output)throw Error('Missing --output');
 return {map,seconds,output:resolve(x.output)};
}
export function diagnose({map,seconds,output}){
 const samples=[];
 let lastSecond=-1;
 let latestGateTrace=[];
 const opts={opponent:'guarded',seconds,ai33:'adaptive',ai35:'control',
  ai36:'coordinated',ai45:'on',label:'ai45-gate-diagnostic-'+map.id,
  simulationFactory:()=>currentWorld(map,map.seed),
  observe:g=>{
   g.tactical.rallyGateTraceEnabled=true;
   latestGateTrace=g.tactical.rallyGateTrace;
   const second=Math.floor(g.time+1e-8);
   if(second===lastSecond)return;
   lastSecond=second;
   samples.push(observeAI45Prerequisites(g));
  }
 };
 const metrics=runMatch({Simulation,UNITS},opts,map.seed,'director',map.mapVersion);
 const report={schema:'ai45-visible-gate-diagnostic-v1',map:map.id,seed:map.seed,
  seconds,policy:'guarded',outcome:metrics.outcome,
  enemyHQDamage:metrics.enemyHQDamage,summary:summarizeSamples(samples),
  tacticalGateTrace:{samples:latestGateTrace.length,
   blockedReasons:latestGateTrace.reduce((out,x)=>{
    for(const reason of x.blockedBy??[])out[reason]=(out[reason]??0)+1;
    return out;
   },{}),
   siegeWindow:latestGateTrace.filter(x=>x.missionSince>=0&&x.phase==='gather').slice(-35)},
  note:'Observable prerequisites only; private home-pressure, route checks and tactical gate reasons are not inferred. No hidden enemy state consulted.'};
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output+'.tmp',JSON.stringify(report,null,2)+'\n');
 renameSync(output+'.tmp',output);
 return report;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const report=diagnose(parseOptions(process.argv.slice(2)));
 console.log('AI45_GATE_DIAGNOSTIC '+JSON.stringify(report));
}
