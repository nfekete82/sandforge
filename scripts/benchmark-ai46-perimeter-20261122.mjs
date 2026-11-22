/**
 * Guarded KI4.6 A/B on the SAME compiled binary and fixed current desert maps.
 * No extra units, credits, map knowledge, hidden defender data or altered saves.
 * Narrow experiment: 2 maps x 1 BLUE policy x 2 variants = 4 matches.
 * Short games are diagnostic and may all legitimately time out.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {CURRENT_DESERT_MAPS,currentWorld} from './benchmark-current-desert-ai-20261122.mjs';
import {runMatch} from './benchmark-reborn-ai.mjs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

const MAPS=['mesa-highlands','burning-horizon'];
const SECONDS=360;
const out=resolve(process.argv[2]??'reports/ai46-bastion-ring-ab.json');
const report={schema:'sandforge-ai46-bastion-ring-ab-v1',seconds:SECONDS,
 criteria:'Equal initial world and paid BLUE defender; 2 maps x ON/OFF',
 complete:false,pairs:[]};
function save(){mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
save();
for(const id of MAPS){
 const map=CURRENT_DESERT_MAPS.find(m=>m.id===id);
 if(!map)throw Error('Missing current authored terrain: '+id);
 const versions=[];
 for(const ai46 of ['off','on']){
  let vanguardOrders=0;
  const result=runMatch({Simulation,UNITS},{
    opponent:'guarded',seconds:SECONDS,ai33:'adaptive',ai35:'control',
    ai36:'coordinated',ai45:'on',ai46,
    label:'ai46-capture-ring-ab-'+id,
    simulationFactory:()=>currentWorld(map,map.seed),
    observe:g=>{vanguardOrders=g.tactical.ai46VanguardOrders??0}
  },map.seed,'director',map.mapVersion);
  versions.push({ai46,map:id,seed:result.seed,initialStateHash:result.initialStateHash,
   outcome:result.outcome,netCaptures:result.netCaptures,
   bastionControlSeconds:result.bastionControlSeconds,
   redUnitsLost:result.redUnitsLost,blueUnitsLost:result.blueUnitsLost,
   enemyHQDamage:result.enemyHQDamage,
   enemyBuildingDamage:result.enemyBuildingDamage,
   firstAssault:result.firstAssault,
   abortedMissions:result.abortedMissions,
   stalledMissions:result.stalledMissions,
   vanguardOrders});
  console.log('AI46_RESULT '+JSON.stringify(versions.at(-1)));
 }
 const [control,treatment]=versions;
 if(control.initialStateHash!==treatment.initialStateHash||
   control.seed!==treatment.seed)throw Error('Unfair paired starting state: '+id);
 report.pairs.push({map:id,control,treatment,
  captureDelta:treatment.netCaptures-control.netCaptures,
  bastionSecondsDelta:treatment.bastionControlSeconds-control.bastionControlSeconds,
  enemyBuildingDamageDelta:treatment.enemyBuildingDamage-control.enemyBuildingDamage,
  lostUnitsDelta:treatment.redUnitsLost-control.redUnitsLost});
 save();
}
report.complete=true;save();
console.log('AI46_PAIRS '+JSON.stringify({complete:report.complete,
 pairs:report.pairs.map(p=>({map:p.map,orders:p.treatment.vanguardOrders,
  captureDelta:p.captureDelta,bastionSecondsDelta:p.bastionSecondsDelta,
  lostUnitsDelta:p.lostUnitsDelta}))}));
