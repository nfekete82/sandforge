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
import {unitSpec,canAttack} from '../dist/src/reborn/catalog.js';
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
  firstBlueHQOrder:null,firstBlueHQFinished:null,firstBlueBarracksFinished:null,
  firstRedHQFinished:null,firstRedAttackPhase:null,
  firstExchange:null,firstFireByFaction:[null,null],
  firstBlueShotContact:null,contactSnapshots:[],firstFireEvents:[],
  firstGroundUnitExchange:null,groundShotsByFaction:[0,0],
  shotsByFaction:[0,0],redShots:0,engagementSeconds:0,
  redCaptureEvents:0,blueCaptureEvents:0,redCaptureSeconds:0,
  firstRedCapture:null,firstBlueCapture:null,
  redArmyPeak:0,blueArmyPeak:0,
  redIdleUnitSeconds:0,redCombatUnitSeconds:0,
  redIdleHeldSeconds:0,redIdleHomeSeconds:0,
  redIdleCapturedBastionSeconds:0,redIdleOpeningSeconds:0,
  redIdleCampaignSeconds:0,redIdleRecoveringSeconds:0,
  redIdleUnassignedSeconds:0,redIdleByKind:{},
  redIdleActualGuardSeconds:0,redIdleStaleHoldSeconds:0,
  redUnitSnapshots:[],
  redPhaseSeconds:{gather:0,attack:0,regroup:0,defend:0},
  capturedScoutHandoffsEligible:0,capturedScoutHandoffsCompleted:0,
  capturedScoutHandoffSeconds:0,capturedScoutHandoffsLost:0,
  redAttackPhaseSeconds:0,redProduced:0,blueProduced:0,
  redOwnedBastions:0,blueOwnedBastions:0,firstBlueAttack:null,
  outcome:'time-limit'};
 const before=g.territories.map(t=>t.owner);
 const countedShots=new WeakSet();
 const pendingHandoffs=new Map();
 // These probes DO NOT influence orders, vision, pathfinding or damage.
 const nearContacts=()=>{
  const reds=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
   !['engineer','medic','scout','drone'].includes(u.kind));
  const blues=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
   !['engineer','medic','scout','drone'].includes(u.kind));
  const snapshots=reds.map(u=>{
   const nearest=blues.slice().sort((a,b)=>length(u,a)-length(u,b)||a.id-b.id)[0];
   const seen=blues.filter(v=>g.canSee(1,v));
   const fireable=seen.filter(v=>canAttack(u,v)&&length(u,v)<=g.range(u)&&
    g.world.line(u,v,g.obstacles().filter(o=>o.id!==v.id)));
   return {id:u.id,kind:u.kind,hp:Math.round(u.hp),
    nearBlue:nearest?Math.round(length(u,nearest)):null,
    visibleBlues:seen.length,fireable:fireable.length,
    order:u.orders[0]?.kind??null,mode:u.orders[0]?.tactical?.mode??null,
    target:u.orders[0]?.target??null,
    hold:u.hold,guardArea:u.guardArea,cooldown:Number(u.cooldown.toFixed(1)),
    combatTarget:u.combatTarget??null,
    at:{x:Math.round(u.x),y:Math.round(u.y)}};
  }).sort((a,b)=>(a.nearBlue??Infinity)-(b.nearBlue??Infinity)||a.id-b.id);
  return {at:Number(g.time.toFixed(2)),blue:blues.length,red:reds.length,
   visibleFromRed:blues.filter(u=>g.canSee(1,u)).length,
   closest:snapshots.slice(0,8),
   redOrders:Object.fromEntries([...new Set(snapshots.map(u=>u.order??'idle'))]
    .map(key=>[key,snapshots.filter(u=>(u.order??'idle')===key).length])),
   redHeld:snapshots.filter(u=>u.hold).length,
   redFireable:snapshots.filter(u=>u.fireable>0).length,
   redWithVisible:snapshots.filter(u=>u.visibleBlues>0).length};
 };

 const dt=.05,steps=Math.round(SECONDS/dt);
 for(let i=0;i<steps&&g.status==='playing';i++){
  if(i%60===0){
   if(paidBlueHeadquarters(g))metrics.firstBlueHQOrder??=Number(g.time.toFixed(2));
   blueBastionRush(g);
  }
  const beforeContests=(g.tactical.state.openingContests??[]).map(e=>({
   unitId:e.unitId,sectorId:e.sectorId
  }));
  g.step(dt);
  metrics.seconds=Number(g.time.toFixed(2));
  if(g.tactical.state.phase==='attack')metrics.firstRedAttackPhase??=metrics.seconds;
  if(g.bases.some(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0&&b.buildRemaining<=0))
   metrics.firstBlueHQFinished??=metrics.seconds;
  if(g.bases.some(b=>b.owner===0&&b.kind==='barracks'&&b.hp>0&&b.buildRemaining<=0))
   metrics.firstBlueBarracksFinished??=metrics.seconds;
  if(g.bases.some(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0&&b.buildRemaining<=0))
   metrics.firstRedHQFinished??=metrics.seconds;
  const red=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&u.kind!=='engineer'&&u.kind!=='medic'),
    blue=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&u.kind!=='engineer'&&u.kind!=='medic');
  metrics.redArmyPeak=Math.max(metrics.redArmyPeak,red.length);
  metrics.blueArmyPeak=Math.max(metrics.blueArmyPeak,blue.length);
  if(g.tactical.state.phase==='attack')metrics.redAttackPhaseSeconds+=dt;
  // Attribute physical idle time without guessing hidden intent. Counts
  // overlap by design: home guards can also be unassigned and holding.
  const idle=red.filter(u=>!u.orders.length&&!u.moving);
  metrics.redIdleUnitSeconds+=idle.length*dt;
  metrics.redCombatUnitSeconds+=red.length*dt;
  metrics.redPhaseSeconds[g.tactical.state.phase]+=dt;
  const redHQ=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
  const opening=new Set((g.tactical.state.openingContests??[]).map(e=>e.unitId));
  const campaign=new Set(g.tactical.state.group);
  const recovery=new Set(g.tactical.state.recovering??[]);
  for(const u of idle){
   if(u.hold)metrics.redIdleHeldSeconds+=dt;
   if(g.tactical.actionGuardIds.has(u.id))metrics.redIdleActualGuardSeconds+=dt;
   if(u.hold&&!g.tactical.actionGuardIds.has(u.id))
    metrics.redIdleStaleHoldSeconds+=dt;
   if(redHQ&&length(u,redHQ)<550)metrics.redIdleHomeSeconds+=dt;
   if(g.territories.some(t=>t.owner===1&&length(u,t.point)<150))
    metrics.redIdleCapturedBastionSeconds+=dt;
   if(opening.has(u.id))metrics.redIdleOpeningSeconds+=dt;
   if(campaign.has(u.id))metrics.redIdleCampaignSeconds+=dt;
   if(recovery.has(u.id))metrics.redIdleRecoveringSeconds+=dt;
   if(!opening.has(u.id)&&!campaign.has(u.id)&&!recovery.has(u.id))
    metrics.redIdleUnassignedSeconds+=dt;
   metrics.redIdleByKind[u.kind]=(metrics.redIdleByKind[u.kind]??0)+dt;
  }
  if([1200,2400,3600].includes(Math.round(g.time*20))){
   const mission=g.tactical.state.commander?.mission;
   metrics.redUnitSnapshots.push({
    at:metrics.seconds,red:red.length,
    guardCount:g.tactical.actionGuardIds.size,
    idle:idle.length,idleHeld:idle.filter(u=>u.hold).length,
    idleActualGuards:idle.filter(u=>g.tactical.actionGuardIds.has(u.id)).length,
    idleStaleHeld:idle.filter(u=>u.hold&&!g.tactical.actionGuardIds.has(u.id)).length,
    idleNearHQ:idle.filter(u=>redHQ&&length(u,redHQ)<550).length,
    opening:(g.tactical.state.openingContests??[]).length,
    recovery:(g.tactical.state.recovering??[]).length,
    campaign:g.tactical.state.group.length,
    phase:g.tactical.state.phase,
    mission:mission?{kind:mission.kind,sector:mission.sector,
     targetOwner:g.territories[mission.sector]?.owner}:null
   });
  }
  // Every damage-dealing event is counted once, even if the visual tracer
  // persists over several frames. No fabricated "first fight" timestamp.
  let fireThisFrame=false,blueFired=false;
  for(const shot of g.shots){
   if(countedShots.has(shot))continue;
   countedShots.add(shot);
   metrics.shotsByFaction[shot.owner]++;
   metrics.firstFireByFaction[shot.owner]??=metrics.seconds;
   // The ordinary first-shot clock also counts bullets fired at scouts,
   // drones, workers and structures. This separate metric requires a REAL
   // ground fighting unit on both ends and resolves the shot's true source.
   const source=g.units.find(u=>u.id===shot.source) ??
    g.bases.find(b=>b.id===shot.source);
   const opponent=g.units.filter(u=>u.owner!==shot.owner&&u.hp>0);
   const closest=opponent.slice().sort((a,b)=>
    length(a,shot.groundTo??shot.to)-length(b,shot.groundTo??shot.to)||a.id-b.id)[0];
   const gap=closest?length(closest,shot.groundTo??shot.to):Infinity;
   if(metrics.firstFireEvents.length<18)
    metrics.firstFireEvents.push({
     at:metrics.seconds,owner:shot.owner,
     sourceId:shot.source,sourceKind:source?.kind??null,
     sourceType:source&&'orders' in source?'unit':'base',
     weapon:shot.weapon,hit:shot.hit,targetClass:shot.targetClass??null,
     nearestTargetKind:closest?.kind??null,
     nearestTargetId:closest?.id??null,
     nearestTargetGap:Number.isFinite(gap)?Math.round(gap):null,
     groundFrom:shot.groundFrom??null,groundTo:shot.groundTo??null
    });
   const combatKinds=new Set(['infantry','heavy','rocket','rover','tank','artillery']);
   if(source&&'orders' in source&&combatKinds.has(source.kind)&&
      closest&&combatKinds.has(closest.kind)&&gap<70){
    metrics.groundShotsByFaction[shot.owner]++;
    metrics.firstGroundUnitExchange??=metrics.seconds;
   }
   if(shot.owner===0)blueFired=true;
   fireThisFrame=true;
  }
  if(blueFired){
   metrics.firstBlueAttack??=metrics.seconds;
   metrics.firstBlueShotContact??=nearContacts();
  }
  if(fireThisFrame){
   metrics.firstExchange??=metrics.seconds;
   metrics.engagementSeconds+=dt;
  }
  if([1200,1800,2100,2400,3000,3600].includes(i+1))
   metrics.contactSnapshots.push(nearContacts());
  for(let t=0;t<g.territories.length;t++){
   const now=g.territories[t].owner;
   if(now!==before[t]){
    if(now===1){
     metrics.redCaptureEvents++;metrics.firstRedCapture??=metrics.seconds;
     for(const e of beforeContests.filter(e=>e.sectorId===t)){
      if(pendingHandoffs.has(e.unitId))continue;
      const soldier=g.units.find(u=>u.id===e.unitId&&u.owner===1&&u.hp>0);
      if(!soldier)continue;
      metrics.capturedScoutHandoffsEligible++;
      pendingHandoffs.set(e.unitId,{at:g.time,sectorId:t});
     }
    }
    if(now===0){metrics.blueCaptureEvents++;metrics.firstBlueCapture??=metrics.seconds;}
    before[t]=now;
   }
   if(now===1)metrics.redCaptureSeconds+=dt;
  }
  for(const [id,entry] of pendingHandoffs){
   const soldier=g.units.find(u=>u.id===id&&u.hp>0&&!u.carrier);
   if(!soldier){metrics.capturedScoutHandoffsLost++;pendingHandoffs.delete(id);continue;}
   const newMission=(g.tactical.state.openingContests??[])
    .find(e=>e.unitId===id&&e.sectorId!==entry.sectorId);
   if(newMission&&soldier.orders[0]?.kind==='attackMove'){
    metrics.capturedScoutHandoffsCompleted++;
    metrics.capturedScoutHandoffSeconds+=g.time-entry.at;
    pendingHandoffs.delete(id);
   }
  }
 }
 metrics.actionRallyDiagnostics={...g.tactical.actionRallyDiagnostics,
  blocks:{...g.tactical.actionRallyDiagnostics.blocks}};
 metrics.capturedScoutHandoffsPending=pendingHandoffs.size;
 metrics.capturedScoutHandoffSeconds=Number(metrics.capturedScoutHandoffSeconds.toFixed(2));
 metrics.capturedScoutHandoffMean=metrics.capturedScoutHandoffsCompleted?
  Number((metrics.capturedScoutHandoffSeconds/metrics.capturedScoutHandoffsCompleted).toFixed(2)):null;
 metrics.status=g.status;
 const blueHQ=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 const blueBarracks=g.bases.find(b=>b.owner===0&&b.kind==='barracks'&&b.hp>0);
 const blueEngineer=g.units.find(u=>u.owner===0&&u.kind==='engineer'&&u.hp>0);
 metrics.blueConstruction={
  hqRemaining:blueHQ?.buildRemaining??null,
  barracksRemaining:blueBarracks?.buildRemaining??null,
  builderPosition:blueEngineer?{x:Number(blueEngineer.x.toFixed(1)),y:Number(blueEngineer.y.toFixed(1))}:null,
  builderOrder:blueEngineer?.orders?.[0]?.kind??null,
  builderTarget:blueEngineer?.orders?.[0]?.target??null,
  builderToHQDistance:blueEngineer&&blueHQ?Number(length(blueEngineer,blueHQ).toFixed(1)):null,
  credits:g.credits[0]
 };
 metrics.redOwnedBastions=g.territories.filter(t=>t.owner===1).length;
 metrics.blueOwnedBastions=g.territories.filter(t=>t.owner===0).length;
 metrics.redProduced=g.stats.factions[1].producedUnits;
 metrics.blueProduced=g.stats.factions[0].producedUnits;
 metrics.outcome=g.status==='playing'?'time-limit':g.status;
 metrics.redIdleFraction=metrics.redCombatUnitSeconds?
  Number((metrics.redIdleUnitSeconds/metrics.redCombatUnitSeconds).toFixed(3)):null;
 for(const k of ['redIdleHeldSeconds','redIdleHomeSeconds',
  'redIdleCapturedBastionSeconds','redIdleOpeningSeconds',
  'redIdleCampaignSeconds','redIdleRecoveringSeconds',
  'redIdleUnassignedSeconds','redIdleActualGuardSeconds',
  'redIdleStaleHoldSeconds'])
  metrics[k]=Number(metrics[k].toFixed(1));
 metrics.redIdleByKind=Object.fromEntries(Object.entries(metrics.redIdleByKind)
  .map(([kind,seconds])=>[kind,Number(seconds.toFixed(1))]));
 metrics.redPhaseSeconds=Object.fromEntries(Object.entries(metrics.redPhaseSeconds)
  .map(([phase,seconds])=>[phase,Number(seconds.toFixed(1))]));
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
  capturedScoutHandoffsDelta:b.capturedScoutHandoffsCompleted-a.capturedScoutHandoffsCompleted,
  capturedScoutPendingDelta:b.capturedScoutHandoffsPending-a.capturedScoutHandoffsPending,
  classicOutcome:a.outcome,actionOutcome:b.outcome});
 save();
}
report.complete=true;save();
console.log('ACTION_PACING_PAIRS '+JSON.stringify(report.pairs));
