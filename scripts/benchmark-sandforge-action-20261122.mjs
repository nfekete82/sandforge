/**
 * Same-source, paid 4-map Action-vs-Classic pacing survey.
 * Fixed authored world seeds, HQ-less initial state and neutral Bastions.
 * BLUE uses a visible-information opponent that must pay for every HQ,
 * building and infantry unit. Action changes resource/time rules for BOTH.
 *
 * Typical CI: 4 maps × 2 modes × 360 seconds, exact 50-ms fixed ticks.
 * This is an early-game balance probe, NOT proof of a 15-20 minute result.
 * Set ACTION_BENCHMARK_SECONDS=1200 for a full 20-minute local survey.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import './webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {blueBastionRush} from './benchmark-ai-opponent.mjs';

const ALL_MAP_IDS=['desert-strike','broken-empire','burning-horizon','last-stronghold'];
const MAP_IDS=(process.env.ACTION_BENCHMARK_MAPS||ALL_MAP_IDS.join(','))
 .split(',').map(s=>s.trim()).filter(Boolean);
if(!MAP_IDS.length||MAP_IDS.some(id=>!ALL_MAP_IDS.includes(id))||
 new Set(MAP_IDS).size!==MAP_IDS.length)throw Error('Invalid Action benchmark map selection');
const SECONDS=Math.min(1200,Math.max(60,Number(process.env.ACTION_BENCHMARK_SECONDS)||360));
const OUTPUT=resolve(process.argv[2]??'reports/sandforge-action-pacing-20261122.json');
const maps=MAP_IDS.map(id=>{
 const m=globalThis.SandforgeDesertMaps.byId(id);
 if(!m)throw Error('Missing authored desert map '+id);
 return m;
});
const report={schema:'sandforge-action-pacing-v1',elapsedTargetSeconds:SECONDS,
 modes:['classic','action'],maps:MAP_IDS,complete:false,
 caveat:'CI checks early-game tactical pacing. A 15–20-minute game is a target, not a guarantee.',
 rows:[],pairs:[]};
const save=()=>{mkdirSync(dirname(OUTPUT),{recursive:true});writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n')};
save();
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function paidBlueHeadquarters(g){
 if(!g.needsHeadquarters(0))return true;
 const worker=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 if(!worker||!g.credits[0])return false;
 const home=g.startRegions[0].center;
 for(const r of [0,85,155,215,280,340])for(let k=0;k<24;k++){
  const theta=k*Math.PI/12,p={x:home.x+Math.cos(theta)*r,y:home.y+Math.sin(theta)*r};
  if(g.buildError(0,'headquarters',p))continue;
  if(g.build(0,'headquarters',p,[worker.id]))return true;
 }
 return false;
}
function run(map,preset){
 const g=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 g.configureBalancePreset(preset);
 const initial={seed:g.seed,mapVersion:g.world.mapVersion,
  generatorVersion:g.world.generatorVersion,bastions:g.territories.length,
  blueCredits:g.credits[0],redCredits:g.credits[1],
  blueCombat:g.units.filter(u=>u.owner===0&&u.kind==='infantry').length,
  redCombat:g.units.filter(u=>u.owner===1&&u.kind==='infantry').length};
 const metrics={map:map.id,preset,initial,seconds:0,status:'playing',
  firstBlueHQOrder:null,firstRedHQFinished:null,firstRedAttackPhase:null,
  firstExchange:null,firstFireByFaction:[null,null],
  shotsByFaction:[0,0],redShots:0,engagementSeconds:0,
  redCaptureEvents:0,blueCaptureEvents:0,redCaptureSeconds:0,
  firstRedCapture:null,firstBlueCapture:null,
  redArmyPeak:0,blueArmyPeak:0,
  redIdleUnitSeconds:0,redCombatUnitSeconds:0,
  redAttackPhaseSeconds:0,redProduced:0,blueProduced:0,
  redOwnedBastions:0,blueOwnedBastions:0,firstBlueAttack:null,
  outcome:'time-limit'};
 const before=g.territories.map(t=>t.owner);
 const countedShots=new WeakSet();
 const dt=.05,steps=Math.round(SECONDS/dt);
 for(let i=0;i<steps&&g.status==='playing';i++){
  if(i%60===0){
   if(paidBlueHeadquarters(g))metrics.firstBlueHQOrder??=Number(g.time.toFixed(2));
   blueBastionRush(g);
  }
  g.step(dt);
  metrics.seconds=Number(g.time.toFixed(2));
  if(g.tactical.state.phase==='attack')metrics.firstRedAttackPhase??=metrics.seconds;
  if(g.bases.some(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0&&b.buildRemaining<=0))
   metrics.firstRedHQFinished??=metrics.seconds;
  const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&u.kind!=='engineer'&&u.kind!=='medic'),
    blue=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&u.kind!=='engineer'&&u.kind!=='medic');
  metrics.redArmyPeak=Math.max(metrics.redArmyPeak,red.length);
  metrics.blueArmyPeak=Math.max(metrics.blueArmyPeak,blue.length);
  if(g.tactical.state.phase==='attack')metrics.redAttackPhaseSeconds+=dt;
  metrics.redIdleUnitSeconds+=red.filter(u=>!u.orders.length&&!u.moving).length*dt;
  metrics.redCombatUnitSeconds+=red.length*dt;
  // Every damage-dealing event is counted once, even if the visual tracer
  // persists over several frames. No fabricated "first fight" timestamp.
  let fireThisFrame=false,blueFired=false;
  for(const shot of g.shots){
   if(countedShots.has(shot))continue;
   countedShots.add(shot);
   metrics.shotsByFaction[shot.owner]++;
   metrics.firstFireByFaction[shot.owner]??=metrics.seconds;
   if(shot.owner===0)blueFired=true;
   fireThisFrame=true;
  }
  if(blueFired)metrics.firstBlueAttack??=metrics.seconds;
  if(fireThisFrame){
   metrics.firstExchange??=metrics.seconds;
   metrics.engagementSeconds+=dt;
  }
  for(let t=0;t<g.territories.length;t++){
   const now=g.territories[t].owner;
   if(now!==before[t]){
    if(now===1){metrics.redCaptureEvents++;metrics.firstRedCapture??=metrics.seconds;}
    if(now===0){metrics.blueCaptureEvents++;metrics.firstBlueCapture??=metrics.seconds;}
    before[t]=now;
   }
   if(now===1)metrics.redCaptureSeconds+=dt;
  }
 }
 metrics.status=g.status;
 metrics.redOwnedBastions=g.territories.filter(t=>t.owner===1).length;
 metrics.blueOwnedBastions=g.territories.filter(t=>t.owner===0).length;
 metrics.redProduced=g.stats.factions[1].producedUnits;
 metrics.blueProduced=g.stats.factions[0].producedUnits;
 metrics.outcome=g.status==='playing'?'time-limit':g.status;
 metrics.redIdleFraction=metrics.redCombatUnitSeconds?
  Number((metrics.redIdleUnitSeconds/metrics.redCombatUnitSeconds).toFixed(3)):null;
 metrics.redCaptureSeconds=Number(metrics.redCaptureSeconds.toFixed(1));
 metrics.redAttackPhaseSeconds=Number(metrics.redAttackPhaseSeconds.toFixed(1));
 metrics.engagementSeconds=Number(metrics.engagementSeconds.toFixed(2));
 return metrics;
}
for(const map of maps){
 const rows=[];
 for(const preset of report.modes){
  const row=run(map,preset);report.rows.push(row);rows.push(row);
  save();console.log('ACTION_MATCH '+JSON.stringify(row));
 }
 const [a,b]=rows;
 if(a.initial.seed!==b.initial.seed||a.initial.mapVersion!==b.initial.mapVersion||
    a.initial.generatorVersion!==b.initial.generatorVersion||
    a.initial.bastions!==b.initial.bastions||
    a.initial.blueCombat!==b.initial.blueCombat||
    a.initial.redCombat!==b.initial.redCombat)
  throw Error('Mismatched fixed map / paid initial unit composition '+map.id);
 report.pairs.push({map:map.id,firstExchangeDelta:
  b.firstExchange===null||a.firstExchange===null?null:
  Number((b.firstExchange-a.firstExchange).toFixed(2)),
  combatSecondsDelta:Number((b.engagementSeconds-a.engagementSeconds).toFixed(1)),
  redCaptureEventsDelta:b.redCaptureEvents-a.redCaptureEvents,
  redCaptureControlSecondsDelta:Number((b.redCaptureSeconds-a.redCaptureSeconds).toFixed(1)),
  redIdleFractionDelta:a.redIdleFraction===null||b.redIdleFraction===null?null:
   Number((b.redIdleFraction-a.redIdleFraction).toFixed(3)),
  redProducedDelta:b.redProduced-a.redProduced,
  classicOutcome:a.outcome,actionOutcome:b.outcome});
 save();
}
report.complete=true;save();
console.log('ACTION_PACING_PAIRS '+JSON.stringify(report.pairs));
