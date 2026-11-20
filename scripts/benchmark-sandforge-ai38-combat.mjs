#!/usr/bin/env node
/** Deterministic 8/12/16-Bastion KI36 versus KI38, in one build with one
 * world and one paid BLUE opponent. Simulations are HEADLESS; not GPU FPS.
 * Usage: node scripts/benchmark-sandforge-ai38-combat.mjs
 *   --maps 24 --seeds 824836862,9999
 *   --opponents guarded,contesting,bastion-rush --seconds 480
 *   --output reports/ai38-map24.json
 */
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Simulation as NativeSimulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ai38InfrastructurePlan} from '../dist/src/reborn/ai38-investment-doctrine.js';
import {runMatch} from './benchmark-reborn-ai.mjs';

class SimulationV4 extends NativeSimulation {
 constructor(seed,mapVersion){
  // Same real v4 biome/canyon procedural generator as the browser's network maps.
  super(seed,mapVersion,false,false,undefined,4);
 }
}
const round=(n,d=2)=>Number(n.toFixed(d));
const avg=(rows,key)=>rows.length?round(rows.reduce((s,r)=>s+r[key],0)/rows.length):null;
const sum=(rows,key)=>rows.reduce((s,r)=>s+(r[key]??0),0);
const opts={maps:[24,25,26],seeds:[824836862,9999],opponents:['guarded','contesting','bastion-rush'],
 seconds:420,output:resolve('reports/ai38-combat.json')};
function parse(argv){
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],v=argv[i+1];
  if(!v)throw Error('Missing value after '+key);
  if(key==='--maps')opts.maps=v.split(',').map(Number);
  else if(key==='--seeds')opts.seeds=v.split(',').map(Number);
  else if(key==='--opponents')opts.opponents=v.split(',');
  else if(key==='--seconds')opts.seconds=Number(v);
  else if(key==='--output')opts.output=resolve(v);
  else throw Error('Unknown option '+key);
 }
 if(!opts.maps.length||opts.maps.some(x=>![24,25,26].includes(x))||
   !opts.seeds.length||opts.seeds.some(x=>!Number.isInteger(x)||x<0)||
   !opts.opponents.length||opts.opponents.some(x=>!['guarded','contesting','bastion-rush'].includes(x))||
   !Number.isInteger(opts.seconds)||opts.seconds<120||opts.seconds>1200)
  throw Error('Invalid test suite arguments');
}
function observeFactory(){
 let startOfCombat=null,lastCombat=null,largestQuiet=0,shots=0,
  bunkerMax=0,bunkerSeatSeconds=0,bunkerBuildingSeconds=0,
  upgradeSeconds=0,upgradesPeak=0,
  stationaryCommandSeconds=0,stationaryVehicles=0,
  commandedVehicleSeconds=0,stationaryWithoutPath=0,
  stallByKind={},stallByOrder={},stallByUnit=new Map(),
  lastSample=-1,vehiclePositions=new Map(),oldPositions=new Map(),immobileTimes=new Map(),
  mobileCount=0,pointCount=0,redIncomeSeconds=0,blueIncomeSeconds=0,contactTicks=0,
  nearestEnemyHQ=Infinity,redNearHQSeconds=0,maxRedNearHQ=0,
  eligibleBunkerSeconds=0,eligibleUpgradeSeconds=0,maxFreeCredits=0,
  maxCreditsWhileBunkerEligible=0,firstBunkerAt=null,firstUpgradeAt=null;
 const observe=g=>{
  // Record only REAL weapon events. No effects fabricated by the telemetry.
  for(const s of g.shots)if(s.owner===1&&s.at!==undefined&&Math.abs(s.at-g.time)<.0001){
   shots++;if(startOfCombat===null)startOfCombat=g.time;
   if(lastCombat!==null)largestQuiet=Math.max(largestQuiet,g.time-lastCombat);
   lastCombat=g.time;
  }
  const sec=Math.floor(g.time+.00001);
  if(sec===lastSample)return;
  lastSample=sec;
  const bunkers=g.bases.filter(b=>b.hp>0&&b.kind==='bunker'&&b.owner===1);
  maxFreeCredits=Math.max(maxFreeCredits,g.credits[1]);
  if(bunkers.length&&firstBunkerAt===null)firstBunkerAt=g.time;
  const fighters=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
   !['medic','engineer','scout','supply','drone'].includes(u.kind));
  // Offline-only full-state telemetry. Never passed into any AI policy.
  const enemyHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
  if(enemyHQ&&fighters.length){
   const distances=fighters.map(u=>Math.hypot(u.x-enemyHQ.x,u.y-enemyHQ.y));
   nearestEnemyHQ=Math.min(nearestEnemyHQ,...distances);
   const inside=distances.filter(d=>d<850).length;
   redNearHQSeconds+=inside;
   maxRedNearHQ=Math.max(maxRedNearHQ,inside);
  }
  const buildings=g.bases.filter(b=>b.owner===1&&b.hp>0);
  const observedRaiders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u));
  const investment=ai38InfrastructurePlan({
   time:g.time,income:g.income(1),
   ownedBastions:g.territories.filter(t=>t.owner===1).length,
   fieldFighters:fighters.length,
   availableInfantry:fighters.filter(u=>UNITS[u.kind].group==='Infanterie').length,
   headquartersReady:buildings.some(b=>b.kind==='headquarters'&&b.buildRemaining<=0),
   barracksReady:buildings.some(b=>b.kind==='barracks'&&b.buildRemaining<=0),
   factoryReady:buildings.some(b=>b.kind==='factory'&&b.buildRemaining<=0),
   airfieldReady:buildings.some(b=>b.kind==='airfield'&&b.buildRemaining<=0),
   totalBastions:g.territories.length,
   bunkerCount:bunkers.length,
   artilleryReady:fighters.some(u=>u.kind==='artillery')||
     buildings.some(b=>b.queueTypes.includes('artillery')),
   hasUpgradeTarget:g.territories.some(t=>t.owner===1&&t.upgradeLevel!==2&&
    !buildings.some(b=>b.kind==='headquarters'&&b.territory===t.id)),
   homeThreat:observedRaiders.some(u=>buildings.some(b=>Math.hypot(u.x-b.x,u.y-b.y)<650)),
   finishing:g.tactical.state.commander?.enemyHQEliminatedAt!==undefined
  });
  if(investment.goal==='bunker'){
   eligibleBunkerSeconds++;
   maxCreditsWhileBunkerEligible=Math.max(maxCreditsWhileBunkerEligible,g.credits[1]);
  }
  if(investment.goal==='bastion-upgrade')eligibleUpgradeSeconds++;
  const completed=bunkers.filter(b=>b.buildRemaining<=0);
  const seats=completed.reduce((s,b)=>s+(b.garrison?.length??0),0);
  bunkerMax=Math.max(bunkerMax,seats);
  bunkerSeatSeconds+=seats;
  bunkerBuildingSeconds+=completed.length;
  const upgrades=g.territories.filter(t=>t.owner===1&&t.upgradeLevel===2).length;
  upgradesPeak=Math.max(upgradesPeak,upgrades);
  if(upgrades>0&&firstUpgradeAt===null)firstUpgradeAt=g.time;
  upgradeSeconds+=upgrades;
  redIncomeSeconds+=g.income(1);blueIncomeSeconds+=g.income(0);pointCount++;
  const previous=vehiclePositions;vehiclePositions=new Map();
  const vehicles=fighters.filter(u=>['tank','rover','artillery'].includes(u.kind));
  mobileCount=Math.max(mobileCount,vehicles.length);
  for(const u of vehicles){
   vehiclePositions.set(u.id,{x:u.x,y:u.y});
   if(!u.orders.length||u.hold||u.defendUntil>g.time){
    immobileTimes.delete(u.id);continue;
   }
   const goal=u.orders[0];
   if(Math.hypot(goal.x-u.x,goal.y-u.y)<90){
    immobileTimes.delete(u.id);continue;
   }
   const old=previous.get(u.id);
   if(!old)continue;
   commandedVehicleSeconds++;
   const stalled=Math.hypot(old.x-u.x,old.y-u.y)<3?
    (immobileTimes.get(u.id)??0)+1:0;
   immobileTimes.set(u.id,stalled);
   if(stalled>=4){
    stationaryCommandSeconds++;if(stalled===4)stationaryVehicles++;
    const key=goal.kind??'unknown';
    stallByKind[u.kind]=(stallByKind[u.kind]??0)+1;
    stallByOrder[key]=(stallByOrder[key]??0)+1;
    if(!u.path?.length)stationaryWithoutPath++;
    const existing=stallByUnit.get(u.id)??{
     id:u.id,kind:u.kind,seconds:0,maxConsecutive:0,
     firstTime:Math.floor(g.time),lastTime:Math.floor(g.time)
    };
    existing.seconds++;existing.maxConsecutive=Math.max(existing.maxConsecutive,stalled);
    existing.lastTime=Math.floor(g.time);
    existing.order=key;existing.pathLength=u.path?.length??0;
    existing.distanceToOrder=Math.round(Math.hypot(goal.x-u.x,goal.y-u.y));
    existing.x=Math.round(u.x);existing.y=Math.round(u.y);
    existing.goalX=Math.round(goal.x);existing.goalY=Math.round(goal.y);
    existing.repath=Math.round((u.repath??0)*10)/10;
    stallByUnit.set(u.id,existing);
   }
  }
 };
 return {observe,finish:()=>({firstActualShotAt:startOfCombat===null?null:round(startOfCombat),
  shotEvents:shots,maxCombatQuietSeconds:shots<2?null:round(largestQuiet),
  peakGarrisonOccupants:bunkerMax,bunkerSeatSeconds,bunkerBuildingSeconds,
  upgradedBastionSeconds:upgradeSeconds,peakUpgradedBastions:upgradesPeak,
  longStationaryVehicleSeconds:stationaryCommandSeconds,stationaryVehicleIncidents:stationaryVehicles,
  commandedVehicleSeconds,
  stationaryVehicleFraction:commandedVehicleSeconds?
   round(stationaryCommandSeconds/commandedVehicleSeconds):0,
  stationaryWithoutPath,
  nearestEnemyHQ:Number.isFinite(nearestEnemyHQ)?round(nearestEnemyHQ):null,
  redNearHQSeconds,maxRedNearHQ,
  stallByKind,stallByOrder,
  worstStalledVehicles:[...stallByUnit.values()]
   .sort((a,b)=>b.seconds-a.seconds||a.id-b.id).slice(0,6),
  maxMobileVehicles:mobileCount,
  meanRedIncome:pointCount?round(redIncomeSeconds/pointCount):0,
  meanBlueIncome:pointCount?round(blueIncomeSeconds/pointCount):0,
  eligibleBunkerSeconds,eligibleUpgradeSeconds,maxFreeCredits,
  maxCreditsWhileBunkerEligible,
  firstBunkerAt:firstBunkerAt===null?null:round(firstBunkerAt),
  firstUpgradeAt:firstUpgradeAt===null?null:round(firstUpgradeAt)})};
}
function compact(run){
 return {map:run.map,seed:run.seed,opponent:run.opponent,variant:run.variant,
  landscape:run.landscape,win:run.outcome==='win',loss:run.outcome==='loss',
  timeout:run.outcome==='timeout',played:run.elapsedSeconds,
  firstContact:run.firstEnemyContact,firstShot:run.firstActualShotAt,
  shots:run.shotEvents,captures:run.captures,netCaptures:run.netCaptures,
  blueDeaths:run.blueUnitsLost,redDeaths:run.redUnitsLost,
  enemyHQDamage:run.enemyHQDamage,
  produced:run.redProducedByKind,
  paidBuildings:run.paidBuildingsByKind,
  garrisonPeak:run.peakGarrisonOccupants,upgradesPeak:run.peakUpgradedBastions,
  eligibleBunkerSeconds:run.eligibleBunkerSeconds,
  maxCreditsWhileBunkerEligible:run.maxCreditsWhileBunkerEligible,
  firstBunkerAt:run.firstBunkerAt,firstUpgradeAt:run.firstUpgradeAt,
  stuckVehicleSeconds:run.longStationaryVehicleSeconds,
  commandedVehicleSeconds:run.commandedVehicleSeconds,
  stallFraction:run.stationaryVehicleFraction,
  noPathStallSeconds:run.stationaryWithoutPath,
  stallByKind:run.stallByKind,
  stallByOrder:run.stallByOrder,
  worstStalledVehicles:run.worstStalledVehicles,
  closestRedToEnemyHQ:run.nearestEnemyHQ,
  redFighterSecondsNearHQ:run.redNearHQSeconds,
  peakRedFightersNearHQ:run.maxRedNearHQ,
  stalledMissions:run.stalledMissions,abortedMissions:run.abortedMissions,
  attackingSeconds:run.attackingSeconds,p95TickMs:round(run.cpu.stepMs.p95,3)};
}
function summary(runs){
 const rows=[];
 for(const map of opts.maps)for(const opponent of opts.opponents)
  for(const variant of ['ai36','ai38']){
   const rs=runs.filter(r=>r.map===map&&r.opponent===opponent&&r.variant===variant);
   if(!rs.length)continue;
   rows.push({map,opponent,variant,count:rs.length,
    wins:rs.filter(r=>r.outcome==='win').length,
    losses:rs.filter(r=>r.outcome==='loss').length,
    timeouts:rs.filter(r=>r.outcome==='timeout').length,
    meanShots:avg(rs,'shotEvents'),meanCaptures:avg(rs,'captures'),
    meanBlueDeaths:avg(rs,'blueUnitsLost'),meanRedDeaths:avg(rs,'redUnitsLost'),
    meanHQDamage:avg(rs,'enemyHQDamage'),
    meanStalled:avg(rs,'stalledMissions'),
    meanVehicleStuckSeconds:avg(rs,'longStationaryVehicleSeconds'),
    meanGarrisonPeak:avg(rs,'peakGarrisonOccupants'),
    meanUpgradePeak:avg(rs,'peakUpgradedBastions'),
    meanAttackingSeconds:avg(rs,'attackingSeconds'),
    meanP95TickMs:round(rs.reduce((s,r)=>s+r.cpu.stepMs.p95,0)/rs.length,3)});
  }
 return rows;
}
function paired(runs){
 const pairs=[];
 for(const map of opts.maps)for(const seed of opts.seeds)
  for(const opponent of opts.opponents){
   const a=runs.find(r=>r.map===map&&r.seed===seed&&r.opponent===opponent&&r.variant==='ai36');
   const b=runs.find(r=>r.map===map&&r.seed===seed&&r.opponent===opponent&&r.variant==='ai38');
   if(!a||!b)continue;
   if(a.initialStateHash!==b.initialStateHash)throw Error('A/B started from different map state');
   pairs.push({map,seed,opponent,landscape:a.landscape,
    before:a.outcome,after:b.outcome,sameStartingState:true,
    deltaShots:b.shotEvents-a.shotEvents,
    deltaCaptures:b.captures-a.captures,
    deltaBastionHold:b.netCaptures-a.netCaptures,
    deltaBlueDeaths:b.blueUnitsLost-a.blueUnitsLost,
    deltaRedDeaths:b.redUnitsLost-a.redUnitsLost,
    deltaHQDamage:round(b.enemyHQDamage-a.enemyHQDamage),
    deltaStalls:b.stalledMissions-a.stalledMissions,
    deltaVehicleStuckSeconds:b.longStationaryVehicleSeconds-a.longStationaryVehicleSeconds,
    deltaGarrisonSeats:b.peakGarrisonOccupants-a.peakGarrisonOccupants,
    deltaUpgradePeak:b.peakUpgradedBastions-a.peakUpgradedBastions,
    deltaAttackSeconds:round(b.attackingSeconds-a.attackingSeconds)});
  }
 return pairs;
}
async function main(){
 parse(process.argv.slice(2));
 const runs=[],begin=performance.now();
 const total=opts.maps.length*opts.seeds.length*opts.opponents.length*2;
 const persist=complete=>{
  mkdirSync(dirname(opts.output),{recursive:true});
  writeFileSync(opts.output,JSON.stringify({
   schemaVersion:1,complete,total,finished:runs.length,settings:opts,
   wallSeconds:round((performance.now()-begin)/1000),
   summary:summary(runs),pairs:paired(runs),runs},null,2)+'\n');
 };
 persist(false);
 for(const map of opts.maps)for(const seed of opts.seeds)for(const opponent of opts.opponents)
  for(const variant of ['ai36','ai38']){
   const recorder=observeFactory();
   const Simulation=class extends SimulationV4{
    constructor(a,b){super(a,b);this.tactical.ai37Mode=variant==='ai38'?'coordinated':'off';}
   };
   const result=runMatch({Simulation,UNITS},{opponent,seconds:opts.seconds,
    ai33:'adaptive',ai35:'control',ai36:'coordinated',observe:recorder.observe,
    label:variant},seed,'director',map);
   const world=new SimulationV4(seed,map);
   const run={...result,...recorder.finish(),variant,map,seed,opponent,
    landscape:world.world.generated?.landscapeKind??'unknown',
    generatorVersion:world.world.generatorVersion};
   if(run.generatorVersion!==4)throw Error('Not a current v4 WebGL landscape');
   runs.push(run);persist(false);
   console.log('AI38_SIM '+JSON.stringify(compact(run)));
  }
 persist(true);
 console.log('AI38_SUMMARY '+JSON.stringify(summary(runs)));
 console.log('AI38_PAIRED '+JSON.stringify(paired(runs)));
 console.log('AI38_DONE '+JSON.stringify({finished:runs.length,total,
  seconds:round((performance.now()-begin)/1000),output:opts.output}));
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 await main();
