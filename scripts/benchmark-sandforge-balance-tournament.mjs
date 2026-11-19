#!/usr/bin/env node
/**
 * Paired, deterministic Sandforge balance tournament on GENERATOR V4.
 *
 * Usage:
 *   npx tsc -p tsconfig.json
 *   node scripts/benchmark-sandforge-balance-tournament.mjs \
 *     --maps 24,25,26 --seeds 824836862,20261119,20261120 \
 *     --opponents guarded,contesting --seconds 300 \
 *     --presets baseline,tuned --output /tmp/sandforge-balance.json
 *
 * Exactly the same procedural 8/12/16-Bastion world, AI policy, neutral
 * Bastions and defensive opponent are played with both balance presets.
 * Both factions always use the SAME prices/stats within a given match.
 * No hidden resources, fabricated victories, renderer FPS claims or AI
 * knowledge from this observer. Timeouts remain timeouts, never wins.
 */
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Simulation as NativeSimulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {runMatch} from './benchmark-reborn-ai.mjs';

export const BALANCE_PRESETS=Object.freeze({
 baseline:Object.freeze({heavyCost:250,rocketHp:95,turretCost:175,researchCost:950}),
 tuned:Object.freeze({heavyCost:300,rocketHp:110,turretCost:300,researchCost:700})
});
export const MAP_LABELS=Object.freeze({24:'8 Bastionen',25:'12 Bastionen',26:'16 Bastionen'});
export const TOURNAMENT_OPPONENTS=Object.freeze(['guarded','contesting','bastion-rush']);
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const round=(n,d=2)=>Math.round(n*10**d)/10**d;
const tally=(rows,key)=>Object.fromEntries([...new Set(rows.flatMap(r=>Object.keys(r[key]??{})))].sort()
 .map(k=>[k,rows.reduce((n,r)=>n+(r[key]?.[k]??0),0)]));

export function parseTournamentArgs(args){
 const options={maps:[24,25,26],seeds:[824836862,20261119,20261120],
  opponents:['guarded','contesting'],seconds:300,presets:['baseline','tuned'],
  output:null,markdown:null};
 for(let i=0;i<args.length;i+=2){
  const key=args[i],value=args[i+1];
  if(!key?.startsWith('--')||!value||value.startsWith('--'))throw Error('Option needs a value: '+key);
  if(key==='--maps')options.maps=value.split(',').map(Number);
  else if(key==='--seeds')options.seeds=value.split(',').map(Number);
  else if(key==='--opponents')options.opponents=value.split(',');
  else if(key==='--seconds')options.seconds=Number(value);
  else if(key==='--presets')options.presets=value.split(',');
  else if(key==='--output')options.output=resolve(value);
  else if(key==='--markdown')options.markdown=resolve(value);
  else throw Error('Unknown option '+key);
 }
 const distinct=a=>new Set(a).size===a.length;
 if(!options.maps.length||!distinct(options.maps)||options.maps.some(x=>!Object.hasOwn(MAP_LABELS,x))||
   !options.seeds.length||options.seeds.length>24||!distinct(options.seeds)||
   options.seeds.some(x=>!Number.isSafeInteger(x)||x<0||x>4294967295)||
   !options.opponents.length||!distinct(options.opponents)||
   options.opponents.some(x=>!TOURNAMENT_OPPONENTS.includes(x))||
   !options.presets.length||!distinct(options.presets)||
   options.presets.some(x=>!Object.hasOwn(BALANCE_PRESETS,x))||
   !Number.isInteger(options.seconds)||options.seconds<60||options.seconds>3600)
  throw Error('Invalid maps, seeds, opponents, presets or duration.');
 return options;
}

/** The catalog is intentionally mutable only in this isolated Node process.
 * These preset changes are never applied to a running browser or game save. */
export function applyBalancePreset(name,units=UNITS,buildings=BUILDINGS){
 const preset=BALANCE_PRESETS[name];if(!preset)throw Error('Unknown preset '+name);
 units.heavy.cost=preset.heavyCost;
 units.rocket.hp=preset.rocketHp;
 buildings.turret.cost=preset.turretCost;
 buildings.research.cost=preset.researchCost;
 return preset;
}

class TournamentSimulation extends NativeSimulation {
 constructor(seed,version){
  // Native constructor takes the generator as sixth argument. The current
  // WebGL player uses v4; the historical AI benchmark default is v2.
  super(seed,version,false,false,undefined,4);
 }
}

function observedMatch({preset,version,seed,opponent,seconds}){
 applyBalancePreset(preset);
 let game=null,shotCount=0,firstCombatAt=null,lastCombatAt=null,longestGap=0;
 let incomeAdvantageIntegral=0,observedTicks=0,redMaxIncome=0,blueMaxIncome=0;
 const started=performance.now();
 const observer=g=>{
  game=g;
  if(g.world.generatorVersion!==4)throw Error('Benchmark must use v4 terrain');
  const red=g.income(1),blue=g.income(0);
  redMaxIncome=Math.max(redMaxIncome,red);blueMaxIncome=Math.max(blueMaxIncome,blue);
  incomeAdvantageIntegral+=(red-blue)*.05;observedTicks++;
  const shots=g.shots.filter(s=>s.at!==undefined&&Math.abs(s.at-g.time)<1e-5).length;
  if(shots){
   if(firstCombatAt!==null)longestGap=Math.max(longestGap,g.time-lastCombatAt);
   firstCombatAt??=g.time;lastCombatAt=g.time;shotCount+=shots;
  }
 };
 const result=runMatch({Simulation:TournamentSimulation,UNITS},{
  label:preset,opponent,seconds,ai33:'adaptive',ai35:'control',
  ai36:'coordinated',observe:observer
 },seed,'director',version);
 if(!game)throw Error('Simulation produced no ticks');
 const stats=game.stats?.factions;
 return {
  version,bas:MAP_LABELS[version],seed,opponent,preset,
  generator:game.world.generatorVersion,landscape:game.world.generated.landscapeKind??'legacy',
  outcome:result.outcome,win:result.win,loss:result.loss,
  elapsedSeconds:result.elapsedSeconds,wallMs:Math.round(performance.now()-started),
  firstContact:result.firstEnemyContact,firstAssault:result.firstOrganizedAttack,
  firstEnemyHQDamage:result.firstEnemyHQDamage,
  captures:result.captures,netCaptures:result.netCaptures,
  territoriesLost:result.territoriesLost,redFinalBastions:result.redSectors,
  redUnitsLost:result.redUnitsLost,blueUnitsLost:result.blueUnitsLost,
  redUnitDamage:result.redUnitDamage,blueUnitDamage:result.blueUnitDamage,
  enemyHQDamage:result.enemyHQDamage,
  redPaidRecruitCredits:result.paidRecruitCredits,
  bluePaidRecruitCredits:result.bluePaidRecruitCredits,
  redPaidBuildCredits:result.paidBuildCredits,
  bluePaidBuildCredits:result.bluePaidBuildCredits,
  redProducedByKind:result.redProducedByKind,
  blueProducedByKind:result.blueProducedByKind,
  redLossesByKind:result.redLossesByKind,
  blueLossesByKind:result.blueLossesByKind,
  damageByRedKind:result.damageByRedKind,
  paidBuildingsByKind:result.paidBuildingsByKind,
  bluePaidBuildingsByKind:result.bluePaidBuildingsByKind,
  maxIncome:{red:redMaxIncome,blue:blueMaxIncome},
  averageIncomeAdvantage:round(incomeAdvantageIntegral/(observedTicks*.05)),
  earnedCredits:stats?stats.map(x=>x.earnedCredits):null,
  peakArmy:result.peakArmy,attackingSeconds:result.attackingSeconds,
  firstTank:result.firstTank,firstAircraft:result.firstAircraft,
  battleEvents:shotCount,
  longestCombatGapSeconds:firstCombatAt===null?null:round(longestGap),
  firstCombatAt:firstCombatAt===null?null:round(firstCombatAt),
  p95SimulationTickMs:round(result.cpu.stepMs.p95,3),
  meanSimulationTickMs:round(result.cpu.stepMs.mean,3),
  idleFraction:result.productionSeconds,
  initialStateHash:result.initialStateHash
 };
}

export function tournamentSummary(runs){
 const groups=new Map();
 for(const r of runs){
  const key=r.version+'|'+r.opponent+'|'+r.preset;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 return [...groups].map(([key,data])=>{
  const [version,opponent,preset]=key.split('|');
  return {version:Number(version),opponent,preset,runs:data.length,
   wins:data.filter(r=>r.outcome==='win').length,
   losses:data.filter(r=>r.outcome==='loss').length,
   timeouts:data.filter(r=>r.outcome==='timeout').length,
   meanPlayedSeconds:round(mean(data.map(r=>r.elapsedSeconds))),
   meanFirstContact:(()=>{const times=data.map(r=>r.firstContact).filter(Number.isFinite);
    return times.length?round(mean(times)):null;})(),
   matchesWithCombat:data.filter(r=>r.battleEvents>0).length,
   meanBattleEvents:round(mean(data.map(r=>r.battleEvents))),
   meanCombatGap:(()=>{const gaps=data.map(r=>r.longestCombatGapSeconds).filter(Number.isFinite);
    return gaps.length?round(mean(gaps)):null;})(),
   meanNetCaptures:round(mean(data.map(r=>r.netCaptures))),
   meanEnemyHQDamage:round(mean(data.map(r=>r.enemyHQDamage))),
   meanAIIncomeAdvantage:round(mean(data.map(r=>r.averageIncomeAdvantage))),
   meanAILosses:round(mean(data.map(r=>r.redUnitsLost))),
   meanP95TickMs:round(mean(data.map(r=>r.p95SimulationTickMs)),3),
   redProducedByKind:tally(data,'redProducedByKind'),
   redPaidBuildings:tally(data,'paidBuildingsByKind')
  };
 }).sort((a,b)=>a.version-b.version||a.opponent.localeCompare(b.opponent)||
 a.preset.localeCompare(b.preset));
}

export function pairedComparison(runs){
 const pairs=new Map();
 for(const r of runs){
  const key=[r.version,r.seed,r.opponent].join(':');
  if(!pairs.has(key))pairs.set(key,{version:r.version,seed:r.seed,opponent:r.opponent});
  pairs.get(key)[r.preset]=r;
 }
 return [...pairs.values()].filter(pair=>pair.baseline&&pair.tuned).map(pair=>{
  const a=pair.baseline,b=pair.tuned;
  if(a.initialStateHash!==b.initialStateHash)throw Error(
   'Presets must start on identical playable worlds: '+pair.seed);
  return {version:pair.version,seed:pair.seed,opponent:pair.opponent,
   landscape:a.landscape,baseline:a.outcome,tuned:b.outcome,
   deltaNetCaptures:b.netCaptures-a.netCaptures,
   deltaEnemyHQDamage:round(b.enemyHQDamage-a.enemyHQDamage),
   deltaBattleEvents:b.battleEvents-a.battleEvents,
   deltaRedLosses:b.redUnitsLost-a.redUnitsLost,
   deltaEarnedCredits:b.earnedCredits?.[1]-a.earnedCredits?.[1]??null,
   sameInitialWorld:true};
 });
}
const lines=(rows)=>rows.map(row=>'| '+row.map(value=>String(value??'—').replaceAll('|','/')).join(' | ')+' |').join('\n');

export function tournamentMarkdown(report){
 const summary=report.summary,paired=report.paired;
 return [
  '# Sandforge – Balance-Turnier',
  '',
  'Headless Node-Simulation (20 Hz), **kein WebGL-FPS-Test**. Ausgänge „timeout“ bleiben unentschieden. Beide Fraktionen verwenden im jeweiligen Lauf dieselben Werte; Gegner KI ist unverändert. Neue Karten nutzen Generator v4.',
  '',
  '## Verglichene Werte',
  '',
  '| Parameter | Vorher | Angepasst |',
  '| --- | ---: | ---: |',
  '| Geschützturm / Credits | 175 | 300 |',
  '| Schwere Infanterie / Credits | 250 | 300 |',
  '| Raketenwerfer-Soldat / LP | 95 | 110 |',
  '| Forschungszentrum / Credits | 950 | 700 |',
  '',
  '## Ergebnisse pro Kartengröße und Gegnerstrategie',
  '',
  '| Karte | Gegner | Preset | Siege | Niederlagen | Zeitlimits | Kontaktpartien | Schüsse (Ø) | Bastionsdifferenz (Ø) | HQ-Schaden (Ø) |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  lines(summary.map(s=>[MAP_LABELS[s.version],s.opponent,s.preset,
   s.wins,s.losses,s.timeouts,s.matchesWithCombat,s.meanBattleEvents,s.meanNetCaptures,s.meanEnemyHQDamage])),
  '',
  '## Gepaarte Differenzen (angepasst minus vorher)',
  '',
  '| Karte | Seed | Gegner | Landschaft | Δ Bastionen | Δ HQ-Schaden | Δ Kampfereignisse | Δ AI-Verluste |',
  '| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |',
  lines(paired.map(p=>[MAP_LABELS[p.version],p.seed,p.opponent,p.landscape,
   p.deltaNetCaptures,p.deltaEnemyHQDamage,p.deltaBattleEvents,p.deltaRedLosses])),
  '',
  'Hinweis: Ein einzelnes Turnier ersetzt weder menschliche Playtests noch lang laufende Partien. Die Ergebnisse erlauben vor allem *relative*, reproduzierbare Vergleiche.',
  ''
 ].join('\n');
}

export function runTournament(options,observer){
 const rows=[],started=performance.now();
 try{
  for(const version of options.maps)for(const seed of options.seeds)
   for(const opponent of options.opponents)for(const preset of options.presets){
    const r=observedMatch({version,seed,opponent,preset,seconds:options.seconds});
    rows.push(r);observer?.(r);
    if(options.output){
     mkdirSync(dirname(options.output),{recursive:true});
     writeFileSync(options.output,JSON.stringify({schemaVersion:1,complete:false,
      config:options,completed:rows.length,planned:options.maps.length*options.seeds.length*
      options.opponents.length*options.presets.length,results:rows},null,2)+'\n');
    }
   }
  const report={schemaVersion:1,complete:true,config:options,completed:rows.length,
   planned:rows.length,wallSeconds:round((performance.now()-started)/1000),
   summary:tournamentSummary(rows),paired:pairedComparison(rows),results:rows};
  if(options.output)writeFileSync(options.output,JSON.stringify(report,null,2)+'\n');
  if(options.markdown){mkdirSync(dirname(options.markdown),{recursive:true});
   writeFileSync(options.markdown,tournamentMarkdown(report));}
  return report;
 }finally{applyBalancePreset('tuned');}
}

async function main(){
 const opts=parseTournamentArgs(process.argv.slice(2));
 const report=runTournament(opts,r=>console.log(
  'BALANCE_RUN',MAP_LABELS[r.version],r.seed,r.opponent,r.preset,
  'outcome='+r.outcome,'sectors='+r.redFinalBastions,
  'battles='+r.battleEvents,'HQdamage='+Math.round(r.enemyHQDamage),
  'duration='+r.elapsedSeconds,'ms='+r.wallMs));
 console.log('BALANCE_SUMMARY '+JSON.stringify(report.summary));
 console.log('BALANCE_PAIRED '+JSON.stringify(report.paired));
 console.log('BALANCE_COMPLETED '+report.completed+'/'+report.planned+
  ' in '+report.wallSeconds+'s');
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 await main();
