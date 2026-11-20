#!/usr/bin/env node
/** Offline policy tournament: compare real, paid AI variants per locked map.
 * This does NOT change live AI weights or leak full-state telemetry into bots.
 * Output is a reproducible scorecard for future manual/CI doctrine improvements.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import './webgl-map-presets.js';
const input=process.argv[2],output=process.argv[3];
if(!input)throw Error('Usage: node scripts/score-sandforge-curated-training.mjs <report.json> [scorecard.json]');
const report=JSON.parse(readFileSync(resolve(input),'utf8'));
if(!report.complete)throw Error('Training run incomplete');
const ids=report.settings?.presets??[];
if(ids.length!==1)throw Error('One named battlefield per scorecard');
const p=globalThis.SandforgeMapPresets.byId(ids[0]);
if(!p)throw Error('Unknown named battlefield');
const runs=report.runs;
const opponents=report.settings.opponents;
if(runs.length!==opponents.length*2)throw Error('Missing paired combat data');
const get=v=>runs.filter(x=>x.variant===v);
const score=v=>{
 const matches=get(v);
 if(matches.some(x=>x.seed!==p.seed||x.map!==p.mapVersion||
  x.generatorVersion!==5||x.terrain!==p.terrain||
  x.landscape!==p.archetype))throw Error('Map identity changed during AI training');
 const wins=matches.filter(x=>x.outcome==='win').length;
 const losses=matches.filter(x=>x.outcome==='loss').length;
 const timeouts=matches.filter(x=>x.outcome==='timeout').length;
 const hq=matches.reduce((n,x)=>n+(x.enemyHQDamage||0),0);
 const bastions=matches.reduce((n,x)=>n+(x.netCaptures||0),0);
 const stuck=matches.reduce((n,x)=>n+(x.longStationaryVehicleSeconds||0),0);
 const noPath=matches.reduce((n,x)=>n+(x.stationaryWithoutPath||0),0);
 const shots=matches.reduce((n,x)=>n+(x.shotEvents||0),0);
 // Reward actual victories and HQ damage over simple Bastion occupation.
 // Vehicle stalls are penalized, not silently discarded as a pathfinder issue.
 return {variant:v,wins,losses,timeouts,enemyHQDamage:hq,bastions,
  stuckVehicleSeconds:stuck,noPathSeconds:noPath,shots,
  score:Math.round(wins*100000+ hq*20 + bastions*125 +
   shots*.5 - losses*120000 - noPath*12 - stuck*3)};
};
const previous=score('ai36'),current=score('ai38');
const result={schemaVersion:1,presetId:p.id,mapName:p.name,
 seed:p.seed,archetype:p.archetype,bastions:p.bastions,biome:p.biome,
 seconds:report.settings.seconds,opponents,
 previous,current,preferred:current.score>=previous.score?'ai38':'ai36',
 deltaScore:current.score-previous.score,
 diagnosis:current.wins<opponents.length?
  current.noPathSeconds>200?'Physische Wegfindung priorisieren':
  current.enemyHQDamage===0?'Angriffskontakt/HQ-Belagerung priorisieren':
  'Kampf- und Makroentscheidungen prüfen':'Gefechte gewonnen – Kontrollkarten gegenprüfen'};
if(output)writeFileSync(resolve(output),JSON.stringify(result,null,2)+'\n');
console.log('CURATED_AI_TRAINING '+JSON.stringify(result));
