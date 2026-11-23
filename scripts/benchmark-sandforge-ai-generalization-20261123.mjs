/**
 * Batch-run the REAL Simulation on unfamiliar seeds/corners and two PAID
 * scripted BLUE adversaries. This is repeatable adversarial evaluation of
 * the RED director, not same-policy mirrored self-play.
 *
 * Quick: UNIVERSAL_AI_SECONDS=120 UNIVERSAL_AI_MAPS=desert-strike
 *        UNIVERSAL_AI_SEEDS=4101 UNIVERSAL_AI_OPPONENTS=rush npm run benchmark:universal-ai
 *
 * Full:  UNIVERSAL_AI_SECONDS=1200 UNIVERSAL_AI_MAPS=desert-strike,burning-horizon
 *        UNIVERSAL_AI_SEEDS=4101,4102 UNIVERSAL_AI_OPPONENTS=rush,contest
 *        npm run benchmark:universal-ai
 */
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';

const ALLOWED_MAPS=['desert-strike','broken-empire','burning-horizon','last-stronghold'];
const ALLOWED_OPPONENTS=['rush','contest'];
function names(env,defaults,allowed,name){
 const arr=(process.env[env]??defaults).split(',').map(s=>s.trim()).filter(Boolean);
 if(!arr.length||arr.length>8||new Set(arr).size!==arr.length||
  arr.some(s=>!allowed.includes(s)))throw Error('Invalid '+name+': '+arr);
 return arr;
}
const maps=names('UNIVERSAL_AI_MAPS','desert-strike,burning-horizon',ALLOWED_MAPS,'maps');
const opponents=names('UNIVERSAL_AI_OPPONENTS','rush,contest',ALLOWED_OPPONENTS,'opponents');
const seeds=(process.env.UNIVERSAL_AI_SEEDS??'4101,4102').split(',')
 .map(s=>s.trim()).filter(Boolean).map(Number);
if(!seeds.length||seeds.length>8||new Set(seeds).size!==seeds.length||
 seeds.some(s=>!Number.isInteger(s)||s<1||s>4294967295))
 throw Error('UNIVERSAL_AI_SEEDS needs 1-8 distinct uint32 seeds');
const seconds=Number(process.env.UNIVERSAL_AI_SECONDS??300);
if(!Number.isInteger(seconds)||seconds<60||seconds>1200)
 throw Error('UNIVERSAL_AI_SECONDS must be 60-1200');
const output=resolve(process.env.UNIVERSAL_AI_REPORT??'reports/universal-ai-evaluation.json');
const root=dirname(output);
const scenarios=maps.flatMap(map=>seeds.flatMap(seed=>
 opponents.map(opponent=>({map,seed,opponent}))));
const report={schema:'sandforge-universal-ai-evaluation-v1',seconds,
 maps,seeds,opponents,complete:false,
 caveat:'RED director vs separate PAID BLUE scripted adversaries, not symmetric RED-vs-BLUE self-play. Time-limit is NOT a win.',
 results:[],summary:null};
const save=()=>{mkdirSync(root,{recursive:true});
 writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
const mean=(values)=>values.length?
 Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(3)):null;
save();
for(const [index,scenario] of scenarios.entries()){
 const {map,seed,opponent}=scenario;
 const number=index+1;
 console.log(`UNIVERSAL_AI_START ${number}/${scenarios.length} map=${map} seed=${seed} opponent=${opponent}`);
 const filename=resolve(root,`universal-ai-${map}-${seed}-${opponent}.json`);
 // Stream the child output instead of blocking silently in spawnSync.
 // Every completed mode is reported immediately; a heartbeat keeps longer
 // runs visibly active. Both presets still use exactly the same paid
 // simulation and are persisted to the same benchmark JSON.
 const child=spawn(process.execPath,
  ['scripts/benchmark-sandforge-action-20261122.mjs',filename],{
   stdio:['ignore','pipe','pipe'],
   env:{...process.env,ACTION_BENCHMARK_SECONDS:String(seconds),
    ACTION_BENCHMARK_MAPS:map,ACTION_BENCHMARK_SEEDS:String(seed),
    ACTION_BENCHMARK_OPPONENT:opponent}
  });
 let tail='';
 const keepTail=line=>{tail=(tail+line+'\\n').slice(-2400);};
 const stdout=createInterface({input:child.stdout,crlfDelay:Infinity});
 stdout.on('line',line=>{
  if(!line.startsWith('ACTION_MATCH ')){keepTail(line);return;}
  try{
   const mode=JSON.parse(line.slice('ACTION_MATCH '.length));
   console.log('UNIVERSAL_AI_MODE '+JSON.stringify({
    number,total:scenarios.length,map,seed,opponent,
    preset:mode.preset,seconds:mode.seconds,
    groundShotsRed:mode.groundShotsByFaction[1],
    firstGroundContact:mode.firstGroundUnitExchange,
    redOwnedBastions:mode.redOwnedBastions
   }));
  }catch{keepTail(line);}
 });
 const stderr=createInterface({input:child.stderr,crlfDelay:Infinity});
 stderr.on('line',keepTail);
 const started=Date.now();
 const heartbeat=setInterval(()=>
  console.log(`UNIVERSAL_AI_RUNNING ${number}/${scenarios.length} elapsedWallSeconds=${Math.round((Date.now()-started)/1000)}`),
  30000);
 const run=await new Promise(resolve=>{
  child.once('error',error=>resolve({error,status:null}));
  child.once('close',(status,signal)=>resolve({status,signal}));
 });
 clearInterval(heartbeat);
 if(run.error||run.status!==0){
  const detail=String(run.error??run.signal??'')+' '+tail.slice(-1700);
  report.results.push({scenario,status:'failed',detail});
  save();throw Error(`Scenario ${map}/${seed}/${opponent} failed: ${detail}`);
 }
 const observed=JSON.parse(readFileSync(filename,'utf8'));
 if(!observed.complete||observed.rows.length!==2||observed.pairs.length!==1)
  throw Error('Incomplete or mismatched match at '+filename);
 const classic=observed.rows.find(x=>x.preset==='classic');
 const action=observed.rows.find(x=>x.preset==='action');
 if(!classic||!action||classic.seed!==seed||action.seed!==seed||
  JSON.stringify(classic.initial.actualStarts)!==
  JSON.stringify(action.initial.actualStarts))
  throw Error('Unfair match: paid starts or seeds differ '+filename);
 report.results.push({scenario,status:'completed',
  startCorners:action.initial.startCornerIds,
  starts:action.initial.actualStarts,
  classic:{outcome:classic.outcome,redOwned:classic.redOwnedBastions,
   blueOwned:classic.blueOwnedBastions,
   redGroundShots:classic.groundShotsByFaction[1],
   firstGroundContact:classic.firstGroundUnitExchange,
   redIdleFraction:classic.redIdleFraction},
  action:{outcome:action.outcome,redOwned:action.redOwnedBastions,
   blueOwned:action.blueOwnedBastions,
   redGroundShots:action.groundShotsByFaction[1],
   firstGroundContact:action.firstGroundUnitExchange,
   redIdleFraction:action.redIdleFraction}});
 save();
 console.log('UNIVERSAL_AI_SCENARIO '+JSON.stringify(report.results.at(-1)));
}
const action=report.results.map(r=>r.action);
const classic=report.results.map(r=>r.classic);
report.summary={scenarios:report.results.length,
 actionRealGroundContactMatches:action.filter(r=>r.firstGroundContact!==null).length,
 classicRealGroundContactMatches:classic.filter(r=>r.firstGroundContact!==null).length,
 actionFirstGroundContactMean:mean(action.map(r=>r.firstGroundContact).filter(v=>v!==null)),
 classicFirstGroundContactMean:mean(classic.map(r=>r.firstGroundContact).filter(v=>v!==null)),
 actionGroundShotsMean:mean(action.map(r=>r.redGroundShots)),
 classicGroundShotsMean:mean(classic.map(r=>r.redGroundShots)),
 actionRedBastionLeadMean:mean(action.map(r=>r.redOwned-r.blueOwned)),
 classicRedBastionLeadMean:mean(classic.map(r=>r.redOwned-r.blueOwned)),
 actionIdleMean:mean(action.map(r=>r.redIdleFraction).filter(v=>v!==null)),
 classicIdleMean:mean(classic.map(r=>r.redIdleFraction).filter(v=>v!==null)),
 actionFinishedGames:action.filter(r=>r.outcome!=='time-limit').length,
 classicFinishedGames:classic.filter(r=>r.outcome!=='time-limit').length};
report.complete=true;save();
console.log('UNIVERSAL_AI_SUMMARY '+JSON.stringify(report.summary));
