import { profiler } from './performance.js';
import type { SectorChoice, StrategicBrief } from './qwen-plan.js';
import {RULES,distance,clamp,type Point} from './config.js';
import {UNITS,unitSpec,buildingSpec,canAttack,type UnitKind} from './catalog.js';
import {developArmy,validEconomy,type EconomyState} from './army-economy.js';
import {selectObservedCounterTarget} from './ai-counter-doctrine.js';
import {assaultDecision,abortAssault} from './ai-director.js';
import {battleDirectorPulse,validBattleDirector,type BattleDirectorState,type BattleDirectorOrder} from './battle-director.js';
import {selectiveRaidAllowed} from './selective-raids.js';
import {newCampaign,campaignPhase,refreshIntelligence,chooseMission,reconGoal,validCampaign,knownBuildings,type CampaignState} from './campaign-commander.js';
import {segmentDistance} from './world-generation.js';
import {newBattle,assessBattle,fightingPower,hasDecisiveLocalAdvantage,shouldCommitFirefight,fightInsteadOfFleeing,retreatCorridorSafe,recordFailure,retryFront,validBattle,type BattleState} from './battle-response.js';
import {newAdaptive,updateAdaptive,validAdaptive,type AdaptiveState} from './adaptive-strategy.js';
import {newExperience,validExperience,finishExperience,canOverrun,observeOwnedLosses,lessonScore,type Experience} from './battle-learning.js';
import {rankLegacyFrontiers} from './legacy-campaign.js';
import {canCaptureSector,comebackPressure,chooseComebackOpportunity} from './territory-warfare.js';
import {chooseTacticalManeuver,flankCandidate,type TacticalChoice} from './tactical-search.js';
import {assignScreen,assignFlank,flankRouteScore,isContinuingFlank} from './battle-squads.js';
import {assaultWaveDecision,reinforcementStagingPoint} from './assault-wave.js';
import {homeDefensePlan} from './home-defense-doctrine.js';
import {chooseSiegeShot,chooseRaidFront,allowSecondaryPressure,type SiegeShot,type RaidFront} from './ai25-doctrine.js';
import {decisiveContact,parallelFrontReady,frontierGuardPosts,localBastionDefenseMultiplier} from './ai32-doctrine.js';
import {mapRaidReady,mapRaidRouteReady,mapFrontierPosts,mapBastionContestOpening,type AI33Mode} from './ai33-map-doctrine.js';
import {bastionGuardPriority,bastionGarrisonReserve,observedDefensePriority,publicBastionDeficit} from './ai35-bastion-doctrine.js';
import {recaptureDetachmentSize,recaptureObjectiveScore,recaptureThreatPermits,type AI36Mode} from './ai36-recapture-doctrine.js';
import {rankTerrainRecaptureSquad,canyonPassWaypoint} from './ai36-terrain-routes.js';
import {droneFrontierPoint,observedBomberSupportTarget,bomberCloseAirSupportAllowed,loneRoverAirDisengage,ai42BreakoutAllowed,ai42HqLookout,ai42DirectVisibleStrike,ai42DroneOverwatchPoint} from './ai36-air-support.js';
import {groundedAssaultRouteOrigin} from './ai36-offensive-routing.js';
import {preserveAI36Assault,ai36JoinActiveFront,maintainAI36FrontOnRetarget} from './ai36-assault-continuity.js';
import {coordinatedFrontMarch} from './combat-movement.js';
import {formationSlotPitch} from './vehicle-spacing.js';
import type {Simulation,Unit,Base,Memory} from './simulation.js';
import {friendlyGatePostColliders} from './defensive-wall.js';
import {ai37GarrisonQuota,ai37BastionDefenseValue} from './ai37-fortification-doctrine.js';
import {bastionEffectiveIncome} from './bastion-upgrades.js';
import {BUNKER_CAPACITY,BUNKER_MAX_FIRE_RANGE} from './bunker-garrison.js';
import {ai38DecisiveAssault} from './ai38-investment-doctrine.js';
import {ai43OffensiveHqBreakthrough} from './ai43-hq-breakthrough.js';
import {ai45ChooseReachableSiegeRally,ai45CanRelocateStuckSiege} from './ai45-reachable-siege-rally.js';
import {selectDesertAIDoctrine,fixedDesertLateAirSupport} from './desert-ai-doctrine.js';
import {ai40ClusterRallyRecovery,ai40CountBlockedRallyOrders,ai40RecoveryWaitThreshold,ai40ShouldAttemptRecovery,ai41RallyMissionPermitsRescue} from './ai40-rally-recovery.js';
export type TacticalPhase='gather'|'attack'|'regroup'|'defend';
export interface KnownTurret extends Point {id:number;hp:number;seenAt:number;range:number}
export interface Loss extends Point {id:number;at:number;strength:number}
export interface Attempt {sector:number;losses:number;until:number}
export interface TacticalOrder {group:number;mode:'safe'|'assault'|'defend';goal?:Point}
export interface TacticalDiagnostics {
 evaluated:number;choices:Record<'assault'|'flank'|'siege'|'regroup',number>;
 delegatedSieges:number;issuedSieges:number;screenOrders:number;flankGroups:number;flankOrders:number;mainOrders:number;
 flankOpportunities:number;flankNoSquad:number;flankNoRoute:number;
 waveWaits:number;waveLaunches:number;combatReadyWaveLaunches:number;reinforcementStagingOrders:number;
 siegeAngles:number;secondaryRaids:number;secondaryRaidOrders:number;
 last:{at:number;sector:number;allies:number;visible:number;guns:number;choice:string;reason:string}|null;
}
const newDiagnostics=():TacticalDiagnostics=>({evaluated:0,choices:{assault:0,flank:0,siege:0,regroup:0},delegatedSieges:0,issuedSieges:0,screenOrders:0,flankGroups:0,flankOrders:0,mainOrders:0,
 flankOpportunities:0,flankNoSquad:0,flankNoRoute:0,waveWaits:0,waveLaunches:0,combatReadyWaveLaunches:0,reinforcementStagingOrders:0,siegeAngles:0,secondaryRaids:0,secondaryRaidOrders:0,last:null});
export interface TacticalState {
 adaptive?:AdaptiveState;experience?:Experience;
 /** Persistent simulated-time Battle Director history; optional for old saves. */
 battleDirector?:BattleDirectorState;
 battle?:BattleState;
 commander?:CampaignState;
 /** Real paid infantry contesting public Bastions; persisted with AI orders. */
 openingContests?:{unitId:number;sectorId:number;since:number}[];
 economy?:EconomyState;recovering?:number[];version:1;phase:TacticalPhase;phaseAt:number;lastPlan:number;target:number|null;rally:Point|null;route:Point[];
 savingSince:number|null;savingFor:UnitKind|null;group:number[];groupId:number;launchSize:number;launchedAt:number;objective:number|null;
 knownTurrets:KnownTurret[];losses:Loss[];attempts:Attempt[];productionSerial:number;lastProgress:number;progressAt:number;
 airliftAt?:number;airlift?:{heli:number;target:Point;phase:'pickup'|'delivery';since:number;passengers?:number[]};
}
/** Only the observed current objective can trigger siege discipline.
 * Troop quantity alone cannot replace paid artillery at a known battery. */
export function holdForSiegeWeapon(objectiveKind:string|undefined,overrun:boolean,artilleryCount:number):boolean{
 return objectiveKind==='turret'&&!overrun&&artilleryCount===0;
}
/** Keep a safe, observed firing lane during endgame squad assembly. */
export function keepEndgameBatteryFiring(x:{
 confirmedEndgame:boolean;visibleTurret:boolean;livingGun:boolean;
 healthyGun:boolean;distanceToTurret:number;turretRange:number;
 artilleryRange:number;clearLine:boolean;mobileThreat:boolean;
}):boolean{
 return x.confirmedEndgame&&x.visibleTurret&&x.livingGun&&x.healthyGun
  &&x.distanceToTurret>x.turretRange+25
  &&x.distanceToTurret<=x.artilleryRange-10&&x.clearLine&&!x.mobileThreat;
}
/** Select an observed turret's safe standoff lookout from public terrain and
 * *previously observed* guns only. The caller verifies real ground navigation
 * and sight geometry. No unseen structure or unit is inspected. */
export function chooseEndgameVisionPost(x:{
 origin:Point;target:Point&{id:number};known:readonly (Point&{id:number;range:number})[];
 unitRange:number;unitSight:number;size:number;
 walkable:(p:Point)=>boolean;clearLine:(p:Point)=>boolean;
 route:(p:Point)=>{length:number;safe:boolean}|undefined;
}):Point|undefined{
 const minR=RULES.turret.range+42,maxR=Math.min(x.unitRange-12,x.unitSight-70);
 if(maxR<minR||x.known.some(t=>t.id===x.target.id&&t.range>=maxR-20))return;
 const heading=Math.atan2(x.origin.y-x.target.y,x.origin.x-x.target.x),points:Point[]=[];
 for(const radius of [maxR-4,maxR-18])if(radius>=minR)for(let i=0;i<12;i++){
  const a=heading+(i%2?-1:1)*Math.ceil(i/2)*Math.PI/12;
  const p={x:x.target.x+Math.cos(a)*radius,y:x.target.y+Math.sin(a)*radius};
  if(p.x<35||p.y<35||p.x>x.size-35||p.y>x.size-35)continue;
  if(x.known.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<t.range+32))continue;
  if(!x.walkable(p)||!x.clearLine(p))continue;
  points.push(p);
 }
 points.sort((a,b)=>distance(a,x.origin)-distance(b,x.origin)||a.y-b.y||a.x-b.x);
 let best:{p:Point;score:number}|undefined;
 for(const p of points.slice(0,7)){
  const path=x.route(p);
  if(!path||!path.safe||path.length>distance(x.origin,x.target)*1.6+280)continue;
  const score=path.length+distance(p,x.origin)*.15;
  if(!best||score<best.score)best={p,score};
 }
 return best?.p;
}
/** A failed 4.4 unconditional single-gun detour cost five wins. Restrict
 * experiments to confirmed cleanup with a previously observed gun and a
 * demonstrably obstructed current firing line. Never infer unseen guns. */
export function attemptEndgameStandoff(confirmedCleanup:boolean,observedObjective:boolean,directLineClear:boolean):boolean{
 return confirmedCleanup&&observedObjective&&!directLineClear;
}
const combat=(u:Unit)=>u.hp>0&&!u.carrier&&!['medic','engineer','scout','supply','drone'].includes(u.kind);
const frontRole=(u:Unit)=>combat(u)&&u.kind!=='artillery'&&!unitSpec(u).flying;
export const combatStrength=(u:Unit)=>u.kind==='drone'?0:u.hp/100*Math.pow((unitSpec(u).damage/unitSpec(u).cooldown)/(17/.85),.35);
/** Earlier retreats require a real living medic and confirmed enemy HQ loss. */
export function infantryRecoveryThreshold(endgame:boolean,medicAvailable:boolean):number{
 return endgame && medicAvailable ? 0.48 : 0.30;
}
/** Keep one healthy replacement screen for larger cleanup formations. */
export function cleanupReserveSize(endgame:boolean,fighters:number):number{
 return endgame&&fighters>=9?1:!endgame&&fighters>=7?1:0;
}
/** Keep a *paid* home guard while a modern army advances. An unobserved
 * transport may flank a base, so do not commit every combat unit to one front.
 * A legitimate ten-man landing can still win if it defeats the real garrison.
 * Existing endgame cleanup and legacy AI reserve policy stay unchanged. */
export function homeGarrisonSize(fighters:number,endgame:boolean):number{
 if(endgame)return cleanupReserveSize(true,fighters);
 return fighters>=14?3:fighters>=8?2:fighters>=6?1:0;
}
const fresh=():TacticalState=>({version:1,phase:'gather',phaseAt:0,lastPlan:-3,target:null,rally:null,route:[],savingSince:null,savingFor:null,group:[],groupId:0,launchSize:0,launchedAt:0,objective:null,knownTurrets:[],losses:[],attempts:[],productionSerial:0,lastProgress:0,progressAt:0});
/** Knowledge, plans and production use simulated time and the red faction's own observations. */
export class TacticalAI {
 /** Benchmark override; normal gameplay always uses the director. */
 mode:'baseline'|'director'='director';
 /** Benchmark-only A/B switch; classic director remains available. */
 planningMode:'classic'|'tactical'='tactical';
 /** Benchmark-only policy toggle: legacy Tactical AI 2.3 versus coordinated 2.4. */
 waveMode:'legacy'|'coordinated'='coordinated';
 /** 2.4/2.5 paired comparison; affects strategy only, never serialized. */
 doctrineMode:'legacy'|'intelligent'='intelligent';
 /** Opt-in: paid barracks before standard 25s strategic opening. */
 earlyEconomyMode:'classic'|'barracks-first'='classic';
 /** Experimental ablations: opt-in per-component doctrine comparisons. */
 missionPlannerMode:'inherit'|'legacy'='inherit';
 siegeEvaluationMode:'inherit'|'legacy'='inherit';
 raidDetachmentMode:'inherit'|'off'|'selective'='inherit';
 /** Runtime-only benchmark ablation: off restores exact AI 3.2 tactics. */
 ai33Mode:AI33Mode='adaptive';
 /** AI 3.5 experiment: can be switched OFF on the same map and same binary. */
 ai35Mode:'off'|'control'='control';
 /** Same-binary A/B: OFF retains exact AI 3.5, coordinated = KI 3.6. */
 ai36Mode:AI36Mode='coordinated';
 /** Same-compiled-binary A/B benchmark: KI3.7 fortification and staffing. */
 ai37Mode:'off'|'coordinated'='coordinated';
 /** Experimental same-binary A/B switch. The player receives calibrated
  * behavior only for exact, known, fixed desert maps. Never serialized. */
 hqBreakthroughMode:'baseline'|'calibrated'='calibrated';
 /** Benchmark-only control switch; OFF retains the existing rally controller. */
 ai45Mode:'off'|'on'='on';
 private recaptureMission:{sector:number;ids:number[];since:number;securedAt:number|null}|null=null;
 private recaptureRetryAt=0;
 private roverAirEscapeRetryAt=new Map<number,number>();
 private battleDirective:BattleDirectorOrder|undefined;
 private get ai36Enabled():boolean{
  return this.mode==='director'&&this.ai36Mode==='coordinated'&&
   this.ai35Enabled;
 }
 private get lateAirSupportEnabled():boolean{
  const w=this.g.world;
  const doctrine=selectDesertAIDoctrine({
   seed:this.g.seed,mapVersion:w.mapVersion,
   profile:w.generated?.battlefield?.profile,
   kind:w.generated?.landscapeKind,
   generatorVersion:w.generatorVersion
  });
  return fixedDesertLateAirSupport(doctrine,this.ai37Mode==='coordinated');
 }
 private get ai35Enabled():boolean{
  return this.ai35Mode==='control'&&this.ai33Mode==='adaptive'&&
   (this.g.world.mapVersion===24||this.g.world.mapVersion===26||
    // KI 3.8 enables the same recapture/air-support doctrine for
    // previously skipped 12-Bastion games, preserving the AI3.6 baseline.
    this.g.world.mapVersion===25&&this.ai37Mode==='coordinated');
 }
 /** Runtime-only diagnostics: never influence simulation or serialize in saves. */
 diagnostics:TacticalDiagnostics=newDiagnostics();
 state=fresh();private risk:Float32Array|undefined;private riskAt=-1;private routeCache=new Map<string,Point[]>();private routeSignature='';
 private strategyOptions: SectorChoice[]=[];
 private sectorPreference: {sectorId:number;until:number}|null=null;
 /** Transient cooldown: regroup decisions must never reset the wave timer
  * or write ephemeral A/B test state into a save. */
 private ai40RallyRetryAt=0;
 private ai45SiegeRallyRetryAt=-1e6;
 private ai45RecoveredMissionSince=-1;
 ai45RallyRescues=0;
 /** Passive AI45-only gate decisions, recorded only when benchmark tracing is enabled. */
 ai45DecisionTrace:Array<{at:number;reason:string;fighters:number;readyAtRally:number;canReachRally:number;needed:number;gatherSeconds:number}>=[];
 /** Only one verified recovery per actual military objective. */
 private ai40RecoveredMissionSince=-1;
 /** Explicitly opt-in ONLY for headless benchmark observation. No saves. */
 rallyGateTraceEnabled=false;
 rallyGateTrace:Array<{
  at:number;phase:TacticalPhase;phaseSeconds:number;missionSince:number;
  map:number;generator:number;blockedBy:string[];
  pool:number;blockedOrders:number;requiredBlocked:number;recoveryWaitRequired:number;
  alreadyAtRally:number;neededAtRally:number;
  cluster330:number;cluster720:number;legal330:number;legal720:number;
  nearestRally:number;remainingToRetry:number;recovered:boolean;
  wave?:{ready:number;ground:number;enough:boolean;waveReady:boolean;
    waveReason:string;guardBuildup:boolean;minimumReady:number};
 }>=[];
 private lastRallyGateTraceAt=-1e6;
 constructor(private readonly g:Simulation){}
 /** Only known front-line choices are shown to the optional language model. */
 strategicBrief():StrategicBrief|null{
  if(!this.strategyOptions.length)return null;
  const army=this.g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
  return {time:this.g.time,credits:this.g.credits[1],fighters:army.filter(combat).length,artillery:army.filter(u=>u.kind==='artillery').length,
   medics:army.filter(u=>u.kind==='medic').length,phase:this.state.phase,options:this.strategyOptions.map(o=>({...o}))};
 }
 /** Advice influences at most a safe top-four target selection; TacticalAI makes the final decision. */
 preferSector(sectorId:number):boolean{
  if(!Number.isSafeInteger(sectorId)||!this.strategyOptions.some(o=>o.sectorId===sectorId))return false;
  this.sectorPreference={sectorId,until:this.g.time+35};return true;
 }
 restore(state:TacticalState|undefined):void{
  this.state=state?structuredClone(state):fresh();this.risk=undefined;this.riskAt=-1;this.routeCache.clear();this.strategyOptions=[];this.sectorPreference=null;this.diagnostics=newDiagnostics();this.recaptureMission=null;this.recaptureRetryAt=0;this.battleDirective=undefined;this.ai40RallyRetryAt=0;this.ai40RecoveredMissionSince=-1;this.ai45SiegeRallyRetryAt=-1e6;this.ai45RecoveredMissionSince=-1;this.ai45RallyRescues=0;this.ai45DecisionTrace=[];this.rallyGateTrace=[];this.lastRallyGateTraceAt=-1e6;
  // Legacy memories contain only previously seen buildings; no live hidden bases are consulted.
  if(!state)for(const m of this.g.memories[1])if(m.owner===0&&
    (m.kind==='turret'||m.kind==='bunker')&&m.hp>0)
    this.remember(m,Math.max(0,this.g.time-45));
 }
 private remember(b:Pick<Memory,'id'|'x'|'y'|'hp'> & {kind?:string},seenAt:number):void{
  const item=this.state.knownTurrets.find(t=>t.id===b.id),
   record={id:b.id,x:b.x,y:b.y,hp:b.hp,
    range:b.kind==='bunker'?BUNKER_MAX_FIRE_RANGE:RULES.turret.range,seenAt};
  if(item)Object.assign(item,record);else if(this.state.knownTurrets.length<64)this.state.knownTurrets.push(record);
 }
 observe():void{
  const g=this.g,s=this.state;
  // Garrisoned enemy bunkers are *observed* fixed weapons, not invisible
  // free damage zones. Without observation, fog still hides them normally.
  for(const b of g.bases)if(b.owner===0&&
    (b.kind==='turret'||b.kind==='bunker')&&b.hp>0&&g.canSee(1,b))
    this.remember(b,g.time);
  s.knownTurrets=s.knownTurrets.filter(t=>g.time-t.seenAt<240&&(!g.canSee(1,t)||g.bases.some(b=>b.id===t.id&&b.owner===0&&b.hp>0)));
 }
 loss(u:Unit):void{
  if(u.owner!==1||this.state.losses.some(l=>l.id===u.id))return;
  const g=this.g,s=this.state;s.losses.push({id:u.id,x:u.x,y:u.y,at:g.time,strength:combatStrength({...u,hp:unitSpec(u).hp})});
  if(s.losses.length>96)s.losses.shift();
  if(s.group.includes(u.id)&&s.target!==null){let a=s.attempts.find(a=>a.sector===s.target);if(!a){a={sector:s.target,losses:0,until:0};s.attempts.push(a);}a.losses++;a.until=g.time+Math.min(150,25*a.losses);}
  this.riskAt=-1;
 }
 private zones():{x:number;y:number;radius:number;cost:number}[]{
  const g=this.g,s=this.state,zones:{x:number;y:number;radius:number;cost:number}[]=s.knownTurrets.map(t=>({...t,radius:t.range+85,cost:36*clamp(1-Math.floor((g.time-t.seenAt)/30)*30/250,.25,1)}));
  for(const l of s.losses)if(g.time-l.at<60&&s.losses.filter(v=>g.time-v.at<60&&distance(v,l)<320).length>=2)zones.push({...l,radius:300,cost:22*(1-Math.floor((g.time-l.at)/15)*15/75)});
  for(const u of g.units)if(u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u))zones.push({...u,radius:unitSpec(u).range+70,cost:Math.min(12,combatStrength(u)*3)});
  return zones;
 }
 private field():Float32Array{
  if(this.risk&&this.riskAt===this.g.time)return this.risk;
  const g=this.g,w=g.world,grid=RULES.grid,cell=w.cell;
  const field=new Float32Array(grid*grid);
  // The tactical planner runs every three seconds. Evaluate the same
  // circular threat samples without allocating one {x,y} object per cell,
  // which previously generated thousands of short-lived GC allocations.
  const centers=Float64Array.from({length:grid},(_,i)=>(i+.5)*cell);
  for(const z of this.zones()){
   const minY=Math.max(0,Math.floor((z.y-z.radius)/cell));
   const maxY=Math.min(grid-1,Math.floor((z.y+z.radius)/cell));
   const minX=Math.max(0,Math.floor((z.x-z.radius)/cell));
   const maxX=Math.min(grid-1,Math.floor((z.x+z.radius)/cell));
   const r2=z.radius*z.radius;
   for(let y=minY;y<=maxY;y++){
    const dy=centers[y]-z.y,dy2=dy*dy,offset=y*grid;
    if(dy2>r2)continue;
    for(let x=minX;x<=maxX;x++){
     const dx=centers[x]-z.x;
     if(dx*dx+dy2>r2)continue;
     const d=Math.hypot(dx,dy);
     if(d<=z.radius)field[offset+x]+=z.cost*(.65+.35*(1-d/z.radius));
    }
   }
  }
  this.risk=field;this.riskAt=g.time;return field;
 }
 costs(u:Unit):Float32Array|undefined{return u.owner===1&&u.orders[0]?.tactical?.mode==='safe'?(this.risk??this.field()):undefined;}
 navigationObstacles():{x:number;y:number;radius:number}[]{return this.obstacles();}
 private obstacles():{x:number;y:number;radius:number}[]{
  const g=this.g,known=g.memories[1].filter(m=>m.owner===0&&m.hp>0).map(m=>({...m,radius:buildingSpec(m).radius}));
  // Open only completed friendly gates. Enemy gates remain known solid
  // structures; never reveal unseen targets to the tactical director.
  return [...g.navigationBases(1).filter(b=>b.owner===1),
   ...friendlyGatePostColliders(g.obstacles(),1),...known];
 }
 private danger(p:Point):number{return this.risk?.[this.g.world.index(p)]??0;}
 private route(from:Point,to:Point):Point[]{
  const key=`${from.x.toFixed(3)},${from.y.toFixed(3)}/${to.x.toFixed(3)},${to.y.toFixed(3)}`;let route=this.routeCache.get(key);
  if(!route){route=this.g.world.path(from,to,this.obstacles(),5,this.field());this.routeCache.set(key,route);}return route;
 }
 private sampleRoute(route:Point[],from:Point):{risk:number;length:number}{
  let peak=0,length=0,previous=from;
  for(const p of route){const d=distance(previous,p),steps=Math.max(1,Math.ceil(d/25));length+=d;for(let i=0;i<=steps;i++)peak=Math.max(peak,this.danger({x:previous.x+(p.x-previous.x)*i/steps,y:previous.y+(p.y-previous.y)*i/steps}));previous=p;}
  return {risk:peak,length};
 }
 private setPhase(phase:TacticalPhase):void{if(this.state.phase!==phase){this.state.phase=phase;this.state.phaseAt=this.g.time;}}
 /** Damage events are observable, even when the firing position is fogged.
  * Never resolve lastAttacker to a hidden tower. Macro reassignment is locked
  * while this short, authoritative withdrawal is in progress. */
 underTowerFire(u:Unit):void{
  const g=this.g,s=this.state;if(this.mode!=='director'||g.world.mapVersion<3||u.owner!==1||u.hp<=0||u.carrier)return;
  const b=s.battle??=newBattle(),old=b.withdrawals.find(w=>w.unit===u.id);
  b.withdrawals=b.withdrawals.filter(w=>g.units.some(v=>v.id===w.unit&&v.owner===1&&v.hp>0&&!v.carrier));
  if(old&&g.time-old.since<5)return;
  const army=g.units.filter(v=>v.owner===1&&v.hp>0&&!v.carrier),near=army.filter(v=>distance(v,u)<450&&!s.recovering?.includes(v.id));
  const towers=s.knownTurrets.filter(t=>distance(t,u)<t.range+220),enemies=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&v.kind!=='drone'&&g.canSee(1,v)&&distance(v,u)<600);
  const assessment=assessBattle(near,enemies,towers,g.time,true);
  // A real battle group must not all turn their backs on the first hit.
  // Alone under a turret, however, a 34%-HP infantryman lacks any fighting
  // screen: withdrawing immediately is sensible, while waiting for 26% HP
  // would hand the gun several free shots. Keep tanks/supported units at
  // the much lower threshold that prevents suicidal mid-battle retreats.
  const supported=near.some(v=>v.id!==u.id&&
    !['engineer','medic','scout','supply'].includes(v.kind));
  const criticalFraction=supported ? .26 :
   ['infantry','heavy','rocket'].includes(u.kind) ? .40 : .26;
  if(u.hp>=unitSpec(u).hp*criticalFraction)return;
  // A shot from an unseen turret supplies damage information, not a
  // guessed turret position. With zero OBSERVED enemies the generic battle
  // assessor calls our force 'attack' against an empty threat set: that is
  // not evidence that a critically injured unit can safely hold its ground.
  if((towers.length||enemies.length)&&
    (assessment.stance==='attack'||assessment.stance==='siege'||
     hasDecisiveLocalAdvantage(near,enemies,towers)))return;
  // A hit reveals damage, NOT the gun's fogged position. A healthy battalion
  // must not flee into the HQ just because the shooter isn't identified yet.
  if(!towers.length&&!enemies.length&&u.hp>=unitSpec(u).hp*.48)return;
  // A rocket already firing from range may continue; a short-range screen
  // under fire must move beyond the guns instead of waiting for 67% HP.
  if(u.kind==='artillery'&&towers.length&&towers.every(t=>distance(t,u)>t.range+15)&&u.hp>unitSpec(u).hp*.75)return;
  const home=g.bases.find(v=>v.owner===1&&v.kind==='headquarters'&&v.hp>0)??g.territories.find(t=>t.owner===1)?.point;
  if(!home)return;
  const goal=this.withdrawPoint(u,home,towers);
  // One wounded soldier cannot drag a whole assault line out of combat.
  // Only a critically damaged isolated fighter (or a near-dead survivor)
  // may disengage, and only with a truly safe escape route.
  if(this.ai36Enabled&&(supported&&u.hp>=unitSpec(u).hp*.12||
   !this.retreatSafe(u,goal,enemies,towers)))return;
  const squad=this.ai36Enabled?[u]:
   near.filter(v=>v===u||(s.group.includes(u.id)&&s.group.includes(v.id)&&v.kind!=='artillery'&&towers.some(t=>distance(v,t)<t.range+85)));
  for(const v of squad){
   if(s.recovering?.includes(v.id)||b.withdrawals.some(w=>w.unit===v.id&&g.time-w.since<5))continue;
   this.issue([v],goal,'safe',undefined,false,false);
   b.withdrawals=b.withdrawals.filter(w=>w.unit!==v.id);b.withdrawals.push({...goal,unit:v.id,since:g.time,until:g.time+10});
  }
  b.reactions++;this.riskAt=-1;
  if(s.target!==null&&!b.fronts.some(f=>f.sector===s.target&&g.time-f.at<8))recordFailure(b,s.target,u,assessment.own,towers.length,g.time);
 }
 /** AI3.6 only: an exposed RED Humvee cannot win a lone duel against
  * a BLUE helicopter. Do not drag allied tanks or soldiers backwards.
  * This is checked during the actual simulation tick (not merely at
  * the 3-second campaign pulse). Both enemy sight and AA cover are real.
  */
 evadeRoverFromHelicopter(u:Unit):boolean{
  const g=this.g,s=this.state;
  if(!this.ai36Enabled||u.owner!==1||u.kind!=='rover'||
     u.hp<=0||u.carrier||u.factoryService)return false;
  const battle=s.battle??=newBattle();
  const active=battle.withdrawals.find(w=>w.unit===u.id&&g.time<w.until);
  if(active&&u.orders[0]?.kind==='move'&&
     u.orders[0]?.tactical?.mode==='safe')return true;
  if((this.roverAirEscapeRetryAt.get(u.id)??0)>g.time)return false;
  const helis=g.units.filter(v=>v.owner===0&&v.kind==='scout'&&
    v.hp>0&&!v.carrier&&g.canSee(1,v)&&distance(u,v)<=500)
   .sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id);
  const heli=helis[0];if(!heli)return false;
  const aaCover=g.units.some(v=>v.owner===1&&v.hp>0&&!v.carrier&&
   v.kind==='rocket'&&distance(v,heli)<=unitSpec(v).range+25&&
   distance(v,u)<=430)||
   g.bases.some(v=>v.owner===1&&v.kind==='turret'&&v.hp>0&&
    v.buildRemaining<=0&&distance(v,heli)<=RULES.turret.range+30);
  if(!loneRoverAirDisengage({roverKind:u.kind,enemyKind:heli.kind,
     enemyVisible:true,distance:distance(u,heli),aaCover}))return false;
  // A blocked, winding desert map must not run eight A* queries every
  // 50-ms physics frame; the retry gate is transient, not save data.
  this.roverAirEscapeRetryAt.set(u.id,g.time+1.5);
  // Head toward a live friendly rocket/turret, or retreat out of the
  // observed helicopter's range. Never move through blocked geometry.
  const aa=[...g.units.filter(v=>v.owner===1&&v.kind==='rocket'&&
     v.hp>0&&!v.carrier),...g.bases.filter(v=>v.owner===1&&
     v.kind==='turret'&&v.hp>0&&v.buildRemaining<=0)];
  const home=g.bases.find(v=>v.owner===1&&v.kind==='headquarters'&&v.hp>0);
  const away=Math.atan2(u.y-heli.y,u.x-heli.x);
  const candidates=[
   ...aa.slice().sort((a,b)=>distance(u,a)-distance(u,b)).slice(0,2)
     .map(v=>({x:v.x,y:v.y})),
   ...[0,-.5,.5,-1.05,1.05,Math.PI].map(delta=>({
     x:clamp(u.x+Math.cos(away+delta)*550,55,g.world.size-55),
     y:clamp(u.y+Math.sin(away+delta)*550,55,g.world.size-55)
   })),...(home?[{x:home.x,y:home.y}]:[])
  ];
  const obstacles=this.obstacles();
  const guns=[{x:heli.x,y:heli.y,range:unitSpec(heli).range}];
  for(const candidate of candidates){
   const point=g.world.nearest(candidate,obstacles,[],u,12);
   if(!point||distance(point,heli)<unitSpec(heli).range+145)continue;
   const route=this.route(u,point);
   if(!route.length||!retreatCorridorSafe(u,route,guns))continue;
   if(!g.command([u.id],{kind:'move',x:point.x,y:point.y}))continue;
   if(u.orders[0])u.orders[0].tactical={group:s.groupId,mode:'safe'};
   battle.withdrawals=battle.withdrawals.filter(w=>w.unit!==u.id);
   battle.withdrawals.push({x:point.x,y:point.y,unit:u.id,
     since:g.time,until:g.time+7});
   battle.reactions++;
   return true;
  }
  // A blocked path is not a valid escape: fight rather than stand still.
  return false;
 }
 private retreatSafe(from:Point,goal:Point,observed:readonly Unit[],
  towers:readonly KnownTurret[]):boolean{
  const threats=[
   ...observed.map(e=>({x:e.x,y:e.y,range:unitSpec(e).range})),
   ...towers.map(t=>({x:t.x,y:t.y,range:t.range}))
  ];
  return retreatCorridorSafe(from,this.route(from,goal),threats);
 }
 private withdrawPoint(from:Point,home:Point,towers=this.state.knownTurrets):Point{
  const g=this.g,points:Point[]=[home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  for(const length of [180,350,700])for(const angle of [0,-.6,.6,-1.2,1.2]){
   const heading=Math.atan2(home.y-from.y,home.x-from.x)+angle;
   points.push({x:clamp(from.x+Math.cos(heading)*length,50,g.world.size-50),y:clamp(from.y+Math.sin(heading)*length,50,g.world.size-50)});
  }
  const exposure=(p:Point)=>towers.reduce((n,t)=>n+Math.max(0,t.range+100-distance(t,p)),0);
  points.sort((a,b)=>exposure(a)*20+distance(from,a)-exposure(b)*20-distance(from,b));
  for(const p of points.slice(0,5)){const at=g.world.nearest(p,this.obstacles(),[],undefined,12);if(at&&this.route(from,at).length)return at;}
  return {...home};
 }
 private withdrawals(army:Unit[]):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle();
  b.withdrawals=b.withdrawals.filter(w=>{
   const u=army.find(u=>u.id===w.unit);if(!u)return false;
   // Preserve a local lone-Jeep air escape, even if the main assault
   // normally cancels low-HP withdrawals and commits to the firefight.
   if(this.ai36Enabled&&u.kind==='rover'&&g.time<w.until&&
    u.orders[0]?.kind==='move'&&u.orders[0]?.tactical?.mode==='safe')return true;
   if(this.ai36Enabled&&s.group.includes(u.id)&&u.defendUntil>g.time){
    const observed=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&
     v.kind!=='drone'&&g.canSee(1,v)&&distance(v,u)<650);
    if(observed.length&&u.hp>=unitSpec(u).hp*.12){
     const target=observed.filter(v=>canAttack(u,v))
      .sort((a,b)=>distance(a,u)-distance(b,u)||a.id-b.id)[0];
     if(target)this.issue([u],target,'assault',target.id,false,false);
     else if(s.target!==null)this.issue([u],g.territories[s.target].point,'assault',undefined,false,false);
     return false;
    }
   }
   return g.time<w.until||s.knownTurrets.some(t=>distance(t,u)<t.range+70);
  });
  for(const w of b.withdrawals){const u=army.find(u=>u.id===w.unit)!;
   if(s.recovering?.includes(u.id))continue;
   if(distance(u,w)>60)this.issue([u],w,'safe',undefined,false,false);else if(u.orders.length)g.stop([u.id]);
  }
  return new Set(b.withdrawals.map(w=>w.unit));
 }
 private localDefense(fighters:Unit[],medics:Unit[],intruders:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle(),old=b.squads.find(q=>q.role==='defense');
  if(!intruders.length){
   if(old)g.stop(old.ids.filter(id=>!s.recovering?.includes(id)&&!b.withdrawals.some(w=>w.unit===id)));
   b.squads=b.squads.filter(q=>q.role!=='defense');return new Set();
  }
  // Evaluate the *nearest owned structure*, not only the HQ: a landing on
  // the rear side of the factory/research yard is a base invasion too.
  // Only currently visible hostile units reached this branch; no fog leaks.
  const protectedBases=g.bases.filter(base=>base.owner===1&&base.hp>0);
  // A raider stepping into an owned Bastion is a real defense emergency,
  // even when the HQ is thousands of units away. Base-only prioritization
  // previously let the opposing army take our economic frontline for free.
  const protectedSites:Point[]=[...protectedBases,
   ...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  const threatScore=(u:Unit)=>{
   const nearest=Math.min(...protectedSites.map(site=>distance(u,site)));
   const legacy=nearest-
    (u.kind==='artillery'?250:u.kind==='heavy'?100:u.kind==='bomber'?120:0);
   if(!this.ai35Enabled)return legacy;
   // Only visibly observed raiders can become target candidates. Bastion
   // ownership and capture progress are public information, not fog leaks.
   const captured=g.territories.filter(t=>t.owner===1&&
    t.capturing===0&&t.progress>0&&distance(u,t.point)<230)
    .sort((a,v)=>distance(u,a.point)-distance(u,v.point)||a.id-v.id)[0];
   return observedDefensePriority({
    distanceToAsset:nearest,
    distanceToHQ:Math.min(Infinity,...protectedBases.filter(b=>b.kind==='headquarters')
     .map(b=>distance(u,b))),
    kind:u.kind,
    insideCaptureRing:!!captured,
    endangeredIncome:captured?bastionEffectiveIncome(captured):0
   });
  };
  const target=intruders.slice().sort((a,v)=>threatScore(a)-threatScore(v)||a.id-v.id)[0];
  const nearby=intruders.filter(u=>distance(u,target)<400);
  // High-value captured Bastions get a stronger LOCAL counterattack.
  // Guard assignments are still real paid units; never strip remote waves.
  const baseEmergency=protectedBases.some(base=>distance(base,target)<
   (base.kind==='headquarters'?560:420));
  const threatenedBastion=g.territories.filter(t=>t.owner===1&&distance(target,t.point)<300)
   .sort((a,b)=>distance(target,a.point)-distance(target,b.point)||a.id-b.id)[0];
  const multiplier=g.world.mapVersion>=24
   ?localBastionDefenseMultiplier(threatenedBastion?bastionEffectiveIncome(threatenedBastion):0,baseEmergency):1.2;
  const needed=fightingPower(nearby)*multiplier;
  // Base invasions remain a FULL emergency: all actually paid fighters
  // may confront a landing on the HQ, barracks, factory or research yard.
  // An isolated Bastion raid, by contrast, must not pull a distant
  // 18-member offensive column halfway across the desert. Respond with
  // genuinely LOCAL guards/reserves, preserve s.group for the main front.
  const available=fighters.filter(u=>baseEmergency||
    (distance(u,target)<900&&(!s.group.includes(u.id)||distance(u,target)<460)))
   .sort((a,v)=>Number(old?.ids.includes(v.id))-Number(old?.ids.includes(a.id))||
    distance(a,target)-distance(v,target)||a.id-v.id);
  if(!available.length){
   b.squads=b.squads.filter(q=>q.role!=='defense');
   return new Set(); // No instant reinforcements or invisible teleports.
  }
  const defenders:Unit[]=[];for(const u of available){defenders.push(u);if(fightingPower(defenders)>=needed)break;}
  const medic=(baseEmergency?medics:medics.filter(u=>distance(u,target)<900))
   .slice().sort((a,v)=>distance(a,target)-distance(v,target))[0];
  const ids=new Set([...defenders.map(u=>u.id),...(medic?[medic.id]:[])]);
  b.squads=[...b.squads.filter(q=>q.role!=='defense').map(q=>({...q,ids:q.ids.filter(id=>!ids.has(id))})),{role:'defense',ids:[...ids],target:target.id,since:old?.target===target.id?old.since:g.time}];
  // Previous doctrine RETREATED if a player unloaded a stronger squad
  // behind the HQ, handing them the buildings with no resistance. This
  // emergency explicitly protects the site: every available *real* combat
  // defender confronts the observed drop, even when outnumbered.
  // No reinforcements are spawned and no enemy is revealed through fog.
  this.issue(defenders,target,'defend',target.id,false,false);
  // Give actual paid missile soldiers the observed aircraft/tank in the
  // invasion, rather than forcing them to waste rockets on a nearby rifleman.
  for(const rocket of defenders.filter(u=>u.kind==='rocket')){
   const counter=selectObservedCounterTarget('rocket',rocket,intruders,750,target);
   if(counter&&rocket.orders[0]?.target!==counter.id)
    this.issue([rocket],counter,'defend',counter.id,false,false);
  }
  // The medic escorts from cover, not from a suicidal attack order.
  if(medic){
   const shelter=protectedBases.slice().sort((a,v)=>distance(a,target)-distance(v,target))[0]??home;
   const separation=distance(shelter,target)||1;
   const standoff=Math.max(120,('radius' in shelter?shelter.radius:83)+45);
   const behind={x:shelter.x+(shelter.x-target.x)/separation*standoff,
    y:shelter.y+(shelter.y-target.y)/separation*standoff};
   const cover=g.world.nearest(behind,this.obstacles(),[],medic,0)??home;
   this.issue([medic],cover,'safe',undefined,false,false);
  }
  return ids;
 }
 /** A small, separately owned expansion task finances the siege instead of
  * leaving the entire army idle at an unaffordable fortified objective. */
 private expansionRaid(fighters:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,b=s.battle??=newBattle(),old=b.squads.find(q=>q.role==='raid');
  const safe=(id:number)=>{const t=g.territories[id];return t&&t.owner!==1&&!s.knownTurrets.some(k=>distance(k,t.point)<k.range+140)
   &&!g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===id)
   &&!g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&distance(u,t.point)<350);};
  if(old&&old.target!==null&&safe(old.target)){
   const units=fighters.filter(u=>old.ids.includes(u.id));
   if(units.length){this.issue(units,g.territories[old.target].point,'assault',undefined,false,false);return new Set(units.map(u=>u.id));}
  }
  b.squads=b.squads.filter(q=>q.role!=='raid');
  if(old){const units=fighters.filter(u=>old.ids.includes(u.id));if(old.target!==null&&g.territories[old.target]?.owner!==1)this.issue(units,s.rally??home,'safe',undefined,false,false);}
  if(fighters.length<5||!['reinforce','withdraw'].includes(b.assessment?.stance??'')||b.squads.some(q=>q.role==='defense'&&q.ids.length))return new Set();
  const spare=fighters.filter(u=>!s.group.includes(u.id)&&['infantry','rover'].includes(u.kind));if(spare.length<2)return new Set();
  const targets=g.territories.filter(t=>safe(t.id)&&t.neighbors.some(id=>g.territories[id].owner===1))
   .sort((a,v)=>distance(spare[0],a.point)-distance(spare[0],v.point)||a.id-v.id);
  const target=targets.find(t=>{const route=this.route(spare[0],t.point);return route.length&&this.sampleRoute(route,spare[0]).risk<8;});if(!target)return new Set();
  const units=spare.sort((a,v)=>distance(a,target.point)-distance(v,target.point)||a.id-v.id).slice(0,2);
  b.squads.push({role:'raid',ids:units.map(u=>u.id),target:target.id,since:g.time});this.issue(units,target.point,'assault',undefined,false,false);return new Set(units.map(u=>u.id));
 }
 private rally(army:Unit[],home:Point):Point{
  const g=this.g,origin=army.length?army.reduce((p,u)=>({x:p.x+u.x/army.length,y:p.y+u.y/army.length}),{x:0,y:0}):home;
  if(g.world.mapVersion>=3&&this.mode==='director'){
   const front=g.territories.filter(t=>t.owner===1&&t.neighbors.some(id=>g.territories[id].owner!==1))
    .sort((a,b)=>{
     const danger=(t:typeof a)=>t.neighbors.some(id=>g.territories[id].owner===0)?-340:0;
     return distance(a.point,origin)+distance(a.point,home)*.1+danger(a)
      -(distance(b.point,origin)+distance(b.point,home)*.1+danger(b));
    });
   for(const sector of front){
    const delta=distance(home,sector.point)||1;
    const p=g.world.nearest({x:sector.point.x+(home.x-sector.point.x)/delta*105,
     y:sector.point.y+(home.y-sector.point.y)/delta*105},this.obstacles(),[],undefined,8);
    if(p&&this.danger(p)<2&&this.route(origin,p).length)return p;
   }
  }
  const candidates:Point[]=[...(this.state.rally?[this.state.rally]:[]),origin,...g.territories.filter(t=>t.owner===1).map(t=>t.point)];
  for(const center of [home,origin])for(const radius of [160,300,500,750])for(let i=0;i<12;i++)candidates.push({x:center.x+Math.cos(i*Math.PI/6)*radius,y:center.y+Math.sin(i*Math.PI/6)*radius});
  const valid=candidates.filter(p=>p.x>40&&p.y>40&&p.x<g.world.size-40&&p.y<g.world.size-40&&g.world.walkable(p,this.obstacles(),12)&&this.danger(p)<2);
  valid.sort((a,b)=>distance(origin,a)+distance(home,a)*.15-(distance(origin,b)+distance(home,b)*.15));
  for(const p of valid.slice(0,8))if(this.route(origin,p).length)return {...p};
  return g.world.nearest({x:home.x-150,y:home.y+120},this.obstacles())??{...home};
 }
 private issue(units:Unit[],point:Point,mode:TacticalOrder['mode'],target?:number,append=false,coordinated=mode!=='safe'||this.state.phase==='attack'):boolean{
  if(!units.length)return false;
   const g=this.g,s=this.state,ids=units.map(u=>u.id),armor=units.filter(u=>u.kind==='tank'||u.kind==='rover');
   const front=(armor.length?armor:units.filter(frontRole)).sort((a,b)=>
     (b.kind==='tank'?5:b.kind==='rover'?4:b.kind==='heavy'?3:1)-(a.kind==='tank'?5:a.kind==='rover'?4:a.kind==='heavy'?3:1)||a.id-b.id);
  const campaign=g.world.mapVersion>=3&&this.mode==='director';
  // March only the real, ground front together. Medics, artillery and
  // depleted retreating units keep their independent escort/work orders.
  const modernMarch=coordinatedFrontMarch({
   modern:g.world.mapVersion>=23&&campaign,
   assault:mode==='assault',
   frontCount:front.length,allGround:front.every(v=>!unitSpec(v).flying)
  });
  const same=!append&&units.every(u=>{const o=u.orders[0];return o?.tactical?.group===s.groupId&&o.tactical.mode===mode&&o.target===target&&(campaign?(target!==undefined||distance(o.tactical.goal??o,point)<45):distance(o,point)<45)&&(coordinated||!o.march);});if(same)return false;
  if(!g.command(ids,{x:point.x,y:point.y,kind:target!==undefined?'attack':mode==='safe'?'move':'attackMove',...(target===undefined?{}:{target})},append))return false;
  const origin=front.length?front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0}):point,dist=distance(origin,point)||1,h={x:(point.x-origin.x)/dist,y:(point.y-origin.y)/dist};
  for(const u of units){const o=append?u.orders.at(-1):u.orders[0];if(!o)continue;o.tactical={group:s.groupId,mode,...(campaign?{goal:{x:point.x,y:point.y}}:{})};if(combat(u)){
    if(coordinated&&front.length&&
      (g.world.mapVersion<=2||this.mode==='baseline'||mode!=='assault'||modernMarch)&&
      front.includes(u))
      o.march=front.map(v=>v.id);
    else delete o.march;
    if(u.kind==='artillery')o.rear=150;
    if(target===undefined&&front.includes(u)&&front.length>1){
     // The previous two-column 30-unit slots put real tanks INSIDE each
     // other, so collision separation fought the AI march orders.
     const i=front.indexOf(u);
     const columns=Math.min(4,Math.max(2,Math.ceil(Math.sqrt(front.length))));
     const pitch=formationSlotPitch(front);
     const lane=(i%columns-(columns-1)/2)*pitch;
     const depth=-Math.floor(i/columns)*pitch;
     const p={x:point.x+h.x*depth-h.y*lane,y:point.y+h.y*depth+h.x*lane};
     const at=unitSpec(u).flying?p:g.world.nearest(p,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));if(at){o.x=at.x;o.y=at.y;}
    }
   }
   if(o.formation&&front.length){
    // On legacy tactical assaults, medics protect the *whole paid combat
    // line*, not just the armored vanguard chosen for collision-safe leading.
    // Modern campaign escort behavior is intentionally unchanged.
    if(g.world.mapVersion<=2&&u.kind==='medic'&&mode==='assault')
     o.formation.front=units.filter(combat).map(v=>v.id);
    else o.formation.front=front.map(v=>v.id);
    // The standard 86/122-unit second rank leaves legacy mixed assaults
    // hundreds of units behind the tank after several seconds. Keep the
    // ground infantry behind the hull, but close enough to advance at the
    // heavy-infantry pace rather than repeatedly chasing a stale rear slot.
    if(g.world.mapVersion<=2&&mode==='assault'&&armor.length&&['infantry','heavy'].includes(u.kind))
     o.formation.rear=32;
   }
  }
  return true;
 }
 /** Bring paid reinforcements to the active front without stopping the column
  * to wait for units still leaving the base. Join the battle only on arrival. */
 private reinforce(fighters:Unit[],home:Point):void{
  const g=this.g,s=this.state,front=fighters.filter(u=>s.group.includes(u.id));
  if(!front.length||front.length>=10||s.target===null)return;
  const available=fighters.filter(u=>!s.group.includes(u.id)&&!(g.world.mapVersion>=3&&u.orders[0]?.tactical?.mode==='assault')),reserve=fighters.length>=8?2:fighters.length>=5?1:0;
  const guard=new Set(available.slice().sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id).slice(0,reserve).map(u=>u.id));
  const anchor=front.reduce((p,u)=>({x:p.x+u.x/front.length,y:p.y+u.y/front.length}),{x:0,y:0});
  const next=available.filter(u=>!guard.has(u.id)).sort((a,b)=>distance(a,anchor)-distance(b,anchor)||a.id-b.id).slice(0,10-front.length);
  const target=g.territories[s.target],objective=s.objective===null?undefined:g.memories[1].find(b=>b.id===s.objective&&b.hp>0);
  const approaching:Unit[]=[];
  for(const u of next){
   if(distance(u,anchor)>280){approaching.push(u);continue;}
   s.group.push(u.id);s.launchSize++;this.issue([u],objective??target.point,objective||g.world.mapVersion>=3&&this.mode==='director'?'assault':'safe',objective?.id);
  }
  // Keep moving reinforcements on a stable route. Rewriting the waypoint every
  // three seconds used to reset their path before they reached the frontline.
  const dispatched=approaching.filter(u=>!u.orders.length||u.orders[0].tactical?.mode!=='safe'||distance(u.orders[0],anchor)>180);
  if(dispatched.length)this.issue(dispatched,anchor,'safe',undefined,false,false);
 }
 /** Physically transport paid infantry from home to a held forward sector. */
 private airlift(army:Unit[],home:Point):void{
  const g=this.g,s=this.state;
  if(g.world.mapVersion<3)return;
  const op=s.airlift,heli=op?army.find(u=>u.id===op.heli):army.find(u=>u.kind==='scout'&&u.hp>0&&!u.carrier);
  if(op){
   if(!heli){s.airlift=undefined;return;}
   const transport=heli.transport;
   if(op.phase==='pickup'){
    if(g.time-op.since>45){g.stop([heli.id]);if(transport?.cargo.length){op.phase='delivery';op.target={x:home.x,y:home.y};op.since=g.time;}else{s.airlift=undefined;s.airliftAt=g.time;}return;}
    if(distance(heli,home)>230){
     if(!heli.orders.length||distance(heli.orders[0],home)>140)this.issue([heli],home,'safe',undefined,false,false);
     return;
    }
    const riders=army.filter(u=>['infantry','heavy','medic'].includes(u.kind)&&(op.passengers?op.passengers.includes(u.id):!s.group.includes(u.id))
     &&distance(u,heli)<550&&!u.carrier&&!(s.recovering??[]).includes(u.id)).slice(0,5);
    if(riders.length>=2&&g.transports.board(heli.id,riders.map(u=>u.id))>0)op.phase='delivery';
    return;
   }
   if(g.time-op.since>110&&transport?.cargo.length){g.stop([heli.id]);op.target={x:home.x,y:home.y};op.since=g.time;return;}
   if(transport?.phase==='cruise'&&transport.cargo.length){
    if(!g.transports.unload(heli.id,op.target)){
     // Failed forward landing must never reserve passengers forever. Return
     // to reachable own ground through the same public transport command.
     op.target={x:home.x,y:home.y};op.since=g.time;
     for(const site of [home,...g.territories.filter(t=>t.owner===1).map(t=>t.point)])if(g.transports.unload(heli.id,site)){op.target={x:site.x,y:site.y};break;}
    }
   }
   else if(transport?.phase==='cruise'&&!transport.cargo.length){s.airlift=undefined;s.airliftAt=g.time;}
   else if(g.time-op.since>110&&!transport?.cargo.length){s.airlift=undefined;s.airliftAt=g.time;}
   return;
  }
  if(s.phase==='defend'||g.time<80||g.time-(s.airliftAt??-200)<40||!heli
    ||army.filter(combat).length<7||(heli.transport&&heli.transport.phase!=='cruise'))return;
  const forward=g.territories.filter(t=>t.owner===1&&t.neighbors.some(i=>g.territories[i].owner!==1)
   &&distance(t.point,home)>650&&this.danger(t.point)<6)
   .sort((a,b)=>distance(home,b.point)-distance(home,a.point))[0];
  if(!forward)return;
  const waiting=army.filter(u=>['infantry','heavy','medic'].includes(u.kind)&&!s.group.includes(u.id)
   &&distance(u,home)<600&&!u.carrier);
  if(waiting.length<2)return;
  const length=distance(home,forward.point)||1;
  const target={x:clamp(forward.point.x+(home.x-forward.point.x)/length*140,80,g.world.size-80),
   y:clamp(forward.point.y+(home.y-forward.point.y)/length*140,80,g.world.size-80)};
  if(this.mode==='director'){
   if(!g.memories[1].some(m=>m.owner===0&&m.kind==='headquarters'&&m.hp>0))return;
   const ground=waiting.slice(0,5).map(u=>{const route=this.route(u,target),travel=this.sampleRoute(route,u);return route.length?travel.length/unitSpec(u).speed:Infinity;});
   const air=distance(heli,home)/unitSpec(heli).speed+length/unitSpec(heli).speed+10;
   if(!ground.some(eta=>eta>air+4))return;
  }
  s.airlift={heli:heli.id,target,phase:'pickup',since:g.time,...(this.mode==='director'?{passengers:waiting.slice(0,5).map(u=>u.id)}:{})};
 }
 private recon(army:Unit[],home:Point):Set<number>{
  if(this.mode==='director'&&this.g.world.mapVersion>=3)return this.campaignRecon(army,home);
  const g=this.g,s=this.state,frontiers=g.territories.filter(t=>t.owner!==1&&t.neighbors.some(i=>g.territories[i].owner===1));
  const defending=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<560));
  // On the new maps, rovers are combat vehicles first, not perpetual scouts.
  const rover=g.world.mapVersion<=2&&!defending&&army.filter(combat).length>=6?army.find(u=>u.kind==='rover'&&!s.group.includes(u.id)):undefined,explorers=army.filter(u=>(u.kind==='scout'&&u.id!==s.airlift?.heli)||u===rover);
  for(const [index,u] of explorers.entries()){
   if(u.transport&&u.transport.phase!=='cruise')continue;
   const threat=s.knownTurrets.slice().sort((a,b)=>a.seenAt-b.seenAt||a.id-b.id)[index%s.knownTurrets.length];
   const ranked=g.world.mapVersion<=2?rankLegacyFrontiers(frontiers,u):frontiers;
   let goal:Point=ranked[index%ranked.length]?.point??home;
   if(threat){const d=distance(home,threat)||1,standOff=u.kind==='scout'?720:780;goal={x:threat.x+(home.x-threat.x)/d*standOff,y:threat.y+(home.y-threat.y)/d*standOff};}
   if(u.hp<unitSpec(u).hp*.55&&u.defendUntil>g.time)goal=s.rally??home;
   if(!u.orders.length||distance(u.orders.at(-1)!,goal)>120)this.issue([u],goal,'safe');
  }return new Set(explorers.map(u=>u.id));
 }
 private campaignRecon(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,c=s.commander??=newCampaign();refreshIntelligence(g,c);
  c.recon=c.recon.filter(t=>army.some(u=>u.id===t.unit));
  const recovering=new Set(s.recovering??[]),explorers=army.filter(u=>
   u.kind==='scout'&&u.id!==s.airlift?.heli||
   this.ai36Enabled&&u.kind==='drone');
  // Large modern deserts use dedicated aircraft for reconnaissance. A lone
  // Humvee was previously drafted after just four paid fighters, then driven
  // deep into the player's base by fog-frontier exploration and ordered out
  // at the next danger pulse. Keep mobile ground combat with the assault
  // group and the home garrison; legacy maps retain their old scouting rules.
  if(g.world.mapVersion<19&&!explorers.length&&army.filter(combat).length>=4){
   const rover=army.find(u=>u.kind==='rover'&&!s.group.includes(u.id)&&!recovering.has(u.id));if(rover)explorers.push(rover);
  }
  for(const u of explorers){
   if(recovering.has(u.id)||u.transport&&u.transport.phase!=='cruise')continue;
   if(u.hp<unitSpec(u).hp*.6&&u.defendUntil>g.time){this.issue([u],home,'safe');continue;}
   // The paid R-01 reveals fog *ahead of* the actual mission. Its 1120m
   // vision stays governed by World/VisionCache, exactly like player drones.
   const mission=c.mission;
   let goal:Point|undefined;
   // KI4.2: an already-paid R-01 surveys the truly known HQ from beyond
   // the known turret range. An uninterrupted RED sensor view lets the
   // physically attacking bomber complete successive release passes.
   if(this.ai36Enabled&&u.kind==='drone'&&
      g.world.mapVersion===26&&g.world.generatorVersion>=4&&
      this.lateAirSupportEnabled&&g.time>=330&&
      g.territories.length>=16&&
      g.territories.filter(t=>t.owner===1).length>=g.territories.length-2&&
      g.units.filter(v=>v.owner===1&&v.kind==='bomber'&&
       v.hp>unitSpec(v).hp*.55&&!v.airfieldService&&!v.returnToHangar).length>=2){
     const hq=g.memories[1].find(m=>m.owner===0&&m.hp>0&&
       m.kind==='headquarters');
     if(hq){
      const lookout=ai42DroneOverwatchPoint({
        home,hq,size:g.world.size,sight:unitSpec(u).sight,
        guns:s.knownTurrets
      });
      if(lookout&&this.danger(lookout)<5)goal=lookout;
     }
   }
   if(!goal&&this.ai36Enabled&&u.kind==='drone'&&mission&&
      distance(home,mission)>650&&!g.canSee(1,mission)){
    const forward=droneFrontierPoint(home,mission,g.world.size);
    if(!g.canSee(1,forward)&&this.danger(forward)<5)goal=forward;
   }
   goal??=reconGoal(g,c,u,p=>this.danger(p));
   if(goal&&(!u.orders.length||distance(u.orders.at(-1)!,goal)>60))
    this.issue([u],goal,'safe',undefined,false,false);
  }
  return new Set(explorers.map(u=>u.id));
 }
 /** Decisions use only the red faction's own observed nearby opponents.
  * Never infer strength from hidden enemies or off-screen player production.
  * A real close-range numerical overmatch lets the damaged armored screen
  * finish its battle instead of an automatic 67% HP retreat. */
 private dominatingLocalFight(u:Unit):boolean{
  if(u.hp<unitSpec(u).hp*.30)return false;
  const g=this.g,r=450;
  const allies=g.units.filter(v=>v.owner===1&&v.hp>0&&!v.carrier&&
   distance(v,u)<=r);
  const observed=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&v.kind!=='drone'&&
   distance(v,u)<=r+110&&g.canSee(1,v));
  const guns=this.state.knownTurrets.filter(t=>distance(t,u)<=t.range+180);
  return hasDecisiveLocalAdvantage(allies,observed,guns);
 }
 /** Wounded infantry recover at a safe rally instead of being sent straight into the next assault. */
 /** Fire-and-forget combat extraction at the instant of an actual enemy hit.
  * The 3-second macro tick alone is too slow to save a 220-HP rover.
  * Never affects blue/player units or the legacy strategy. */
 evacuateVehicle(u:Unit):void{
  const g=this.g,s=this.state;
  if(this.mode!=='director'||g.world.mapVersion<3||u.owner!==1||u.hp<=0
    ||!['tank','rover','artillery'].includes(u.kind)||
    u.hp>=unitSpec(u).hp*.24||s.recovering?.includes(u.id))return;
  // Preserve a winning local engagement unless the vehicle is critical.
  if(this.dominatingLocalFight(u))return;
  // KI 3.6: a tank under active enemy guns cannot outrun them by
  // spontaneously turning its back. A supported firing line stays engaged
  // unless critically damaged AND a safe exit actually exists.
  if(this.ai36Enabled&&u.defendUntil>g.time){
   const visible=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&
    v.kind!=='drone'&&g.canSee(1,v)&&distance(v,u)<unitSpec(v).range+130);
   const comrades=g.units.filter(v=>v.owner===1&&v.hp>0&&!v.carrier&&
    combat(v)&&distance(v,u)<290);
   if(visible.length&&comrades.length>=2&&u.hp>=unitSpec(u).hp*.12)return;
  }
  const hq=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
  if(!hq)return;
  const edge={x:clamp(hq.x+(hq.x>=g.world.size/2?165:-165),85,g.world.size-85),
    y:clamp(hq.y+(hq.y>=g.world.size/2?135:-135),85,g.world.size-85)};
  const dock=g.world.nearest(edge,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));
  if(!dock)return;
  if(this.ai36Enabled&&u.defendUntil>g.time){
   const observed=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&
    v.kind!=='drone'&&g.canSee(1,v)&&distance(v,u)<unitSpec(v).range+160);
   const guns=s.knownTurrets.filter(t=>distance(t,u)<t.range+200);
   if((observed.length||guns.length)&&!this.retreatSafe(u,dock,observed,guns))return;
  }
  if(!g.command([u.id],{...dock,kind:'move'}))return;
  u.orders[0].tactical={group:s.groupId,mode:'safe'};
  s.recovering??=[];s.recovering.push(u.id);
 }
 private recovery(army:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state,ids=new Set(s.recovering??[]);
  const threshold=infantryRecoveryThreshold(
   g.world.mapVersion>=3&&this.mode==='director'&&s.commander?.enemyHQEliminatedAt!==undefined,
   army.some(v=>v.kind==='medic'&&v.hp>unitSpec(v).hp*.45));
  const availableRepairer=army.some(v=>v.kind==='engineer'&&
    v.hp>0&&!v.carrier&&!v.orders.some(o=>o.kind==='build'));
  for(const u of army){
   if(['infantry','heavy','rocket'].includes(u.kind)&&u.hp<unitSpec(u).hp*threshold){
    // Low HP alone is not permission to turn away mid-gunfight.
    // KI 3.6 only evacuates isolated, critically wounded infantry when
    // an actually safe retreat exists.
    const inContact=this.ai36Enabled&&u.defendUntil>g.time&&
     s.group.includes(u.id)&&g.units.some(v=>v.owner===0&&v.hp>0&&
      !v.carrier&&v.kind!=='drone'&&g.canSee(1,v)&&
      distance(u,v)<Math.max(unitSpec(u).range,unitSpec(v).range)+75);
    if(inContact&&u.hp>=unitSpec(u).hp*.10)ids.delete(u.id);
    else if(!inContact||this.retreatSafe(u,home,
      g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&
       v.kind!=='drone'&&g.canSee(1,v)&&distance(u,v)<750),
      s.knownTurrets))ids.add(u.id);
   }
   // Repair only behind the front. Routine 67%-HP extraction used to cause
   // suicidal retreats while tanks were still in range of enemy guns.
   if(g.world.mapVersion>=3&&this.mode==='director'
     &&['tank','rover','artillery'].includes(u.kind)){
     const activeFire=u.defendUntil>g.time;
     const ratio=u.hp/unitSpec(u).hp;
     if(this.dominatingLocalFight(u)||
       activeFire&&ratio>=.24||ratio>=.90)ids.delete(u.id);
     else if(!activeFire&&availableRepairer&&ratio<.52){
      // Do not pull a damaged tank from an active nearby contact merely
      // because its own gun is reloading at the macro planning instant.
      const contact=this.ai36Enabled&&g.units.some(v=>v.owner===0&&v.hp>0&&
       !v.carrier&&v.kind!=='drone'&&g.canSee(1,v)&&
       distance(u,v)<unitSpec(v).range+80);
      if(!contact)ids.add(u.id);
     }
   }
  }
  s.recovering=army.filter(u=>ids.has(u.id)&&u.hp<unitSpec(u).hp*(['tank','rover','artillery'].includes(u.kind)?.9:.8)).map(u=>u.id);
  const resting=army.filter(u=>s.recovering!.includes(u.id)),reserved=new Set(s.recovering);
  const vehiclePatients=resting.filter(u=>['tank','rover','artillery'].includes(u.kind));
  if(vehiclePatients.length){
   // Park behind the HQ, away from the middle of the battlefield.
   const edge={x:clamp(home.x+(home.x>=g.world.size/2?165:-165),85,g.world.size-85),
    y:clamp(home.y+(home.y>=g.world.size/2?135:-135),85,g.world.size-85)};
   const dock=g.world.nearest(edge,this.obstacles())??home;
   for(const v of vehiclePatients){
    if(distance(v,dock)>85){
     if(v.orders[0]?.tactical?.mode!=='safe'||distance(v.orders[0],dock)>60)
      this.issue([v],dock,'safe',undefined,false,false);
    }else if(v.orders.length)g.stop([v.id]);
   }
   const waiting=vehiclePatients.filter(v=>distance(v,dock)<105)
    .sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id);
   const engineer=army.find(u=>u.kind==='engineer'&&!u.orders.some(o=>o.kind==='build')
      &&u.defendUntil<=g.time);
   if(waiting.length&&engineer){
    const damaged=waiting[0];
    if(engineer.orders[0]?.kind!=='repair'||engineer.orders[0]?.target!==damaged.id)
      g.command([engineer.id],{x:damaged.x,y:damaged.y,kind:'repair',target:damaged.id});
   }
   for(const w of army.filter(u=>u.kind==='engineer'&&g.world.mapVersion>=3&&this.mode==='director')){
    const order=w.orders[0],vehicle=order?.kind==='repair'?army.find(u=>u.id===order.target&&['tank','rover','artillery'].includes(u.kind)):undefined;
    if(vehicle&&!ids.has(vehicle.id))g.stop([w.id]);
   }
  }
  const goal=s.rally&&this.danger(s.rally)<2?s.rally:g.world.nearest({x:home.x-140,y:home.y+140},this.obstacles())??home;
  for(const u of resting.filter(u=>!vehiclePatients.includes(u)))if(distance(u,goal)>45)this.issue([u],goal,'safe');else if(u.orders[0]?.tactical?.mode!=='safe')g.stop([u.id]);
  const infantryPatients=resting.filter(u=>['infantry','heavy'].includes(u.kind));
  const medic=infantryPatients.length?army.filter(u=>u.kind==='medic').sort((a,b)=>distance(a,goal)-distance(b,goal)||a.id-b.id)[0]:undefined;
  if(medic){reserved.add(medic.id);const patient=infantryPatients.filter(u=>distance(u,goal)<120).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp)[0];
   if(patient){if(medic.orders[0]?.kind!=='heal'||medic.orders[0].target!==patient.id)g.command([medic.id],{x:patient.x,y:patient.y,kind:'heal',target:patient.id});}
   else this.issue([medic],goal,'safe');
  }
  for(const u of army.filter(u=>u.kind==='medic'&&u.hp<unitSpec(u).hp*.45&&u.defendUntil>g.time)){reserved.add(u.id);this.issue([u],goal,'safe');}
  return reserved;
 }
 private siege(members:Unit[],target:Point&{id:number}):boolean{
  const g=this.g,s=this.state,artillery=members.filter(u=>u.kind==='artillery'&&u.hp>0);if(!artillery.length)return false;
  if(g.world.mapVersion>=3&&this.mode==='director'){
   const observed=s.knownTurrets.filter(t=>distance(t,target)<t.range+200);
   // Preserve every already validated multi-gun engagement from AI 4.3.
   if(observed.length>1)return this.standoffSiege(members,target,artillery);
   const knownObjective=observed.some(t=>t.id===target.id);
   const directLineClear=g.world.line(artillery[0],target,
    this.obstacles().filter(o=>!('id' in o)||o.id!==target.id),10);
   if(attemptEndgameStandoff(s.commander?.enemyHQEliminatedAt!==undefined,knownObjective,directLineClear)
     &&this.standoffSiege(members,target,artillery,true))return true;
   // If the safe angle search fails, continue the proven AI 4.3 attack.
  }
  const anchor=s.rally??members[0],d=distance(anchor,target)||1,h={x:(anchor.x-target.x)/d,y:(anchor.y-target.y)/d},cover={x:target.x+h.x*(RULES.turret.range+30),y:target.y+h.y*(RULES.turret.range+30)};
  const at=g.world.nearest(cover,this.obstacles(),[],undefined,12);if(!at)return false;
  const interceptors=g.world.mapVersion>=3&&this.mode==='director'?this.screenThreats(members,target):new Set<number>();
  const screen=members.filter(u=>frontRole(u)&&!interceptors.has(u.id)),waiting=screen.filter(u=>distance(u,at)>55||u.orders[0]?.target!==undefined);
  const campaign=g.world.mapVersion>=3&&this.mode==='director';
  if(waiting.length){if(campaign)this.issue(waiting,at,'safe',undefined,false,false);else{this.issue(waiting,at,'assault');for(const u of waiting)if(u.orders[0])u.orders[0].kind='move';}}
  // A holding screen fires locally without pursuing through the artillery's
  // standoff line. Marching there remains an authoritative retreat/move.
  if(campaign)for(const u of screen)if(distance(u,at)<65){g.stop([u.id]);u.hold=true;}
  for(const u of artillery)this.issue([u],target,'assault',target.id);
  const medics=campaign?members.filter(u=>u.kind==='medic'):[];
  if(medics.length){this.issue(medics,at,'assault');for(const u of medics)if(u.orders[0]?.formation)u.orders[0].formation.front=screen.map(v=>v.id);}
  for(const u of members.filter(u=>unitSpec(u).flying))if(!u.orders.length||u.orders[0]?.target!==undefined)this.issue([u],s.rally??at,'safe');
  return true;
 }
 /** Explicit building attacks must not make the screen ignore a visible heavy
  * infantryman shooting the artillery. Only intercept from reachable range on
  * the safe side of known guns; emergency withdrawals retain ownership. */
 private screenThreats(members:Unit[],goal:Point):Set<number>{
  const g=this.g,s=this.state,support=members.filter(u=>u.kind==='artillery'||u.kind==='medic');
  const threats=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&support.some(v=>distance(u,v)<unitSpec(u).range+100))
   .sort((a,b)=>(unitSpec(b).damage/unitSpec(b).cooldown)-(unitSpec(a).damage/unitSpec(a).cooldown)||a.id-b.id);
  const assigned=new Set<number>(),target=threats[0];if(!target)return assigned;
  for(const u of members.filter(frontRole)){
   if(!canAttack(u,target)||s.battle?.withdrawals.some(w=>w.unit===u.id))continue;
   const d=distance(u,target)||1,range=unitSpec(u).range-15;
   const firing={x:target.x+(u.x-target.x)/d*range,y:target.y+(u.y-target.y)/d*range};
   if(s.knownTurrets.some(t=>distance(t,firing)<t.range+15)||!g.world.walkable(firing,this.obstacles(),10))continue;
   this.issue([u],target,'assault',target.id,false,false);assigned.add(u.id);
  }
  void goal;return assigned;
 }
 /** Check the entire observed battery, not only the selected gun. A firing
  * point is useful only if the real rocket range, LOS and ground route allow it. */
 private standoffSiege(members:Unit[],target:Point&{id:number},artillery:Unit[],fallback=false):boolean{
  const g=this.g,s=this.state,origin=artillery[0],known=s.knownTurrets,obstacles=this.obstacles();
  // Preserve the stable 2.4 battery objective. The 2.5 improvement is
  // which angle to fire from, NOT switching to a different tower on every
  // three-second macro pulse. Only try another known gun if the first is
  // truly unreachable from any eligible standoff angle.
  const choices=[target,...known.filter(t=>t.id!==target.id&&distance(t,target)<900)]
   .sort((a,b)=>distance(origin,a)-distance(origin,b)||a.id-b.id);
  let selected:typeof target|undefined,at:Point|undefined;
  for(const gun of choices){
   const heading=Math.atan2(origin.y-gun.y,origin.x-gun.x),candidates:Point[]=[];
   for(const radius of [UNITS.artillery.range-15,UNITS.artillery.range-35])for(let i=0;i<24;i++){
    const angle=heading+i*Math.PI/12,p={x:gun.x+Math.cos(angle)*radius,y:gun.y+Math.sin(angle)*radius};
    if(p.x<30||p.y<30||p.x>g.world.size-30||p.y>g.world.size-30||known.some(t=>distance(t,p)<t.range+35))continue;
    if(g.world.walkable(p,obstacles,10)&&g.world.line(p,gun,obstacles.filter(o=>!('id' in o)||o.id!==gun.id),10))candidates.push(p);
   }
   candidates.sort((a,b)=>distance(origin,a)-distance(origin,b)||a.y-b.y||a.x-b.x);
   const shots:SiegeShot[]=[];
    const smartSiege=this.siegeEvaluationMode!=='legacy'&&this.doctrineMode==='intelligent';
   for(const p of candidates.slice(0,smartSiege?8:3)){
    const route=this.route(origin,p);if(!route.length)continue;
    const path=this.sampleRoute(route,origin);
    // The exploratory one-gun detour must be short and reasonably safe.
    // Leave original multi-gun doctrine untouched.
    if(fallback&&(path.length>distance(origin,gun)*1.35+220||path.risk>40))continue;
    if(!smartSiege){selected=gun;at=p;break;}
    shots.push({gunId:gun.id,at:p,travel:path.length,risk:path.risk,
      gunHp:'hp' in gun&&typeof gun.hp==='number'?gun.hp:1000,primary:true});
   }
   if(at)break;
   if(smartSiege&&shots.length){
    // A safer route must be a realistic detour, not a kilometer-long
    // wandering loop that delays an otherwise winnable HQ assault.
    const direct=Math.min(...shots.map(x=>x.travel));
    const best=chooseSiegeShot(shots.filter(x=>x.travel<=direct*1.35+120));
    if(best){selected=gun;at=best.at;this.diagnostics.siegeAngles++;break;}
   }
  }
  if(!at||!selected){
   // A navigation failure is not proof that combat cannot proceed. This
   // fallback is exclusively for the new single-gun endgame experiment.
   if(fallback)return false;
   this.issue(members,s.rally??origin,'safe');return true;
  }
  if(selected.id!==target.id&&s.commander?.mission){
   const m=s.commander.mission,seen=knownBuildings(g).find(t=>t.id===selected!.id);
   if(seen)Object.assign(m,{kind:'structure',sector:seen.territory,
     x:selected.x,y:selected.y,objective:selected.id,hp:seen.hp,
     progressAt:g.time,distance:distance(origin,selected)});
   s.objective=selected.id;
  }
  const d=distance(at,selected)||1,h={x:(at.x-selected.x)/d,y:(at.y-selected.y)/d};
  const cover=g.world.nearest({x:at.x+h.x*100,y:at.y+h.y*100},obstacles,[],undefined,12)??at;
  const interceptors=this.screenThreats(members,selected);
  for(const u of artillery){
   if(u.orders.some(o=>o.kind==='attack'&&o.target===selected!.id)&&u.orders.every(o=>o.kind!=='move'||known.every(t=>distance(t,o)>t.range+30)))continue;
   g.command([u.id],{...at,kind:'move'});g.command([u.id],{x:selected.x,y:selected.y,kind:'attack',target:selected.id},true);
   if(u.orders[0])u.orders[0].tactical={group:s.groupId,mode:'safe',goal:{...at}};
   if(u.orders[1])u.orders[1].tactical={group:s.groupId,mode:'assault'};
  }
  for(const u of members.filter(u=>u.kind!=='artillery'&&!interceptors.has(u.id))){
   if(distance(u,cover)>35)this.issue([u],cover,'safe',undefined,false,false);
   else if(u.orders.length)g.stop([u.id],true);
  }
  return true;
 }
 /** Public gate also used by the 20-Hz simulation just before the REAL
  * bomb release. AI3.5 and player bombers remain completely unchanged.
  * Eligibility is grounded in currently visible threats and actual red
  * ground units at the objective, never enemies behind Fog of War. */
 bomberStrikeSafe(target:Unit|Base):boolean{
  if(!this.ai36Enabled)return true;
  const g=this.g;
  if(!g.canSee(1,target)||target.hp<=0)return false;
  const observed=[
   ...g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
    u.kind!=='drone'&&!unitSpec(u).flying&&g.canSee(1,u)),
   ...g.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&
    g.canSee(1,b))
  ];
  const ground=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
   combat(u)&&!unitSpec(u).flying&&
   !u.factoryService&&!u.airfieldService&&
   (u.orders.some(o=>o.kind==='attack'||o.kind==='attackMove'||
      o.tactical?.mode==='assault')||u.defendUntil>g.time||
    this.state.phase==='attack'&&this.state.group.includes(u.id)));
  if(bomberCloseAirSupportAllowed(target,observed,ground))return true;
  const mission=this.state.commander?.mission,
   knownHQ=g.memories[1].find(m=>m.owner===0&&m.hp>0&&m.kind==='headquarters');
  if(!knownHQ)return false;
  const isAA=(u:Unit|Base)=>['rocket','turret','interceptor','scout'].includes(u.kind);
  return ai42BreakoutAllowed({
   enabled:g.world.mapVersion===26&&g.world.generatorVersion>=4&&
    this.mode==='director'&&this.lateAirSupportEnabled,
   time:g.time,controlled:g.territories.filter(t=>t.owner===1).length,
   total:g.territories.length,
   paidBombers:g.units.filter(u=>u.owner===1&&u.kind==='bomber'&&
    u.hp>unitSpec(u).hp*.55&&!u.airfieldService&&!u.returnToHangar).length,
   missionKind:mission?.kind,missionSector:mission?.sector,
   knownHQSector:knownHQ.territory,
   targetKind:target.kind,distanceFromHQ:distance(target,knownHQ),
   targetVisible:g.canSee(1,target),
   knownAirDefenses:this.state.knownTurrets.filter(v=>distance(v,target)<650).length,
   observedAirDefenses:observed.filter(v=>isAA(v)&&distance(v,target)<650).length
  });
 }
 private airSupport(members:Unit[],goal:Point,targetId:number|null):void{
  const g=this.g,s=this.state,front=members.filter(frontRole),
   anchor=s.rally??members[0],d=distance(anchor,goal)||1,
   h={x:(goal.x-anchor.x)/d,y:(goal.y-anchor.y)/d};
  // Real current RED vision only. Bomber strike decisions must NEVER
  // consult unobserved units even though Simulation stores all of them.
  const visibleArmor=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&v.kind!=='drone'&&
   g.canSee(1,v)&&!unitSpec(v).flying&&unitSpec(v).group==='Fahrzeuge');
  for(const [index,u] of members.filter(u=>u.kind==='bomber'&&!u.airfieldService).entries()){
   // A bomber can make useful anti-tank bombing runs even if no ground
   // building has been selected as the strategic assault objective.
   const armor=selectObservedCounterTarget('bomber',u,visibleArmor,1200,goal);
   const objective=targetId===null?undefined:g.bases.find(b=>b.id===targetId&&b.hp>0&&g.canSee(1,b))??
    g.units.find(v=>v.id===targetId&&v.hp>0&&!v.carrier&&g.canSee(1,v))??
    g.memories[1].find(b=>b.id===targetId&&b.hp>0);
   const target=armor??objective;
   if(!target){
    if(!u.orders.length)this.issue([u],anchor,'safe');
    continue;
   }
   // Finish an already released bomb/turn/return, but never START an
   // unsupported solo dive into a fortified tank/infantry cluster.
   if(u.bomberRun)continue;
   if(this.ai36Enabled){
    const actual=g.units.find(v=>v.id===target.id&&v.hp>0)??g.bases.find(b=>b.id===target.id&&b.hp>0);
    if(!actual||!this.bomberStrikeSafe(actual))continue;
   }
   const selectedTarget=target.id;
   if(u.orders.some(o=>o.kind==='attack'&&o.target===selectedTarget))continue;
   // An obsolete two-leg queue may be replaced for freshly observed armor,
   // but ordinary high-priority tower mission queues remain stable.
   if(u.orders.length>1&&!armor)continue;
   const strike=armor??goal;
   const flank={
    x:clamp(strike.x-h.y*(index%2?-340:340)-h.x*220,30,g.world.size-30),
    y:clamp(strike.y+h.x*(index%2?-340:340)-h.y*220,30,g.world.size-30)
   };
   g.command([u.id],{...flank,kind:'move'});
   g.command([u.id],{x:target.x,y:target.y,kind:'attack',target:selectedTarget},true);
   for(const o of u.orders){
    o.tactical={group:s.groupId,mode:'assault'};
    if(front.length&&(g.world.mapVersion<=2||this.mode==='baseline'))
      o.march=front.map(v=>v.id);
   }
  }
 }
 /** Send paid counter specialists after the main campaign has assigned
  * orders. Formerly an AA rocket only reacted in the offensive squad or once
  * our headquarters was already invaded. A reserve soldier or bomber could
  * stay idle despite a visibly hostile aircraft/tank.
  * Only currently observable red-vision enemies, never hidden targets.
  * Preserve recovering, withdrawn, parked and mid-bombing-run aircraft.
  */
 private dispatchObservedSpecialists(army:Unit[]):void{
  const g=this.g,recovering=new Set(this.state.recovering??[]),
   withdrawals=new Set(this.state.battle?.withdrawals.map(w=>w.unit)??[]);
  const visible=g.units.filter(v=>v.owner===0&&v.hp>0&&!v.carrier&&v.kind!=='drone'&&
   g.canSee(1,v)&&(unitSpec(v).flying||unitSpec(v).group==='Fahrzeuge'));
  if(!visible.length)return;
  for(const u of army){
   if(!['rocket','bomber'].includes(u.kind)||u.hp<=0||u.carrier||
      recovering.has(u.id)||withdrawals.has(u.id)||u.hold||
      u.airfieldService||u.factoryService||u.bomberRun||
      u.transport&&u.transport.phase!=='cruise')continue;
   const target=selectObservedCounterTarget(u.kind as 'rocket'|'bomber',
    u,visible,u.kind==='rocket'?unitSpec(u).sight+120:1100);
   // Retain the bomber's existing move→attack flank queue. Replacing it
   // every macro pulse would prevent him from ever reaching the tank.
   if(!target||u.orders.some(o=>o.kind==='attack'&&o.target===target.id))
    continue;
   if(u.kind==='bomber'&&this.ai36Enabled){
    const actual=g.units.find(v=>v.id===target.id&&v.hp>0);
    if(!actual||!this.bomberStrikeSafe(actual))continue;
   }
   g.command([u.id],{kind:'attack',x:target.x,y:target.y,target:target.id});
  }
 }
 /** KI 3.6 uses paid bombers as close air support, not merely anti-armor
  * reserves. Visibility is checked BEFORE a target enters this list.
  * Keep an existing valid strike and any live bomber run intact.
  */
 private supportBombers(army:Unit[],home:Point):void{
  if(!this.ai36Enabled)return;
  const g=this.g,s=this.state;
  const bombers=army.filter(u=>u.kind==='bomber'&&u.hp>0&&!u.carrier&&
   !u.airfieldService&&!u.returnToHangar&&!u.bomberRun&&!u.hold);
  if(!bombers.length)return;
  // Ground units sometimes halt or die AFTER an initial coordinated launch.
  // Revoke pending unsafe strike queues before the bomber crosses hostile AA.
  // Do not interrupt a bomb that has already been physically dropped.
  const recalled=new Set<number>();
  for(const u of bombers){
   const pending=u.orders.find(o=>o.kind==='attack'&&o.target!==undefined);
   if(!pending)continue;
   const victim=g.units.find(v=>v.id===pending.target&&v.hp>0)??g.bases.find(b=>b.id===pending.target&&b.hp>0);
   if(!victim||!this.bomberStrikeSafe(victim)){
    // Do not replace a just-cancelled strike with a different flank in this
    // same planning tick. A bomber must actually turn away from the lost
    // screen instead of zigzagging between defended targets.
    g.command([u.id],{kind:'move',x:home.x,y:home.y});
    recalled.add(u.id);
   }
  }
  const frontUnits=army.filter(u=>combat(u)&&!unitSpec(u).flying&&
   (s.group.includes(u.id)||u.defendUntil>g.time));
  const front=frontUnits.length?frontUnits.reduce((p,u)=>({
   x:p.x+u.x/frontUnits.length,y:p.y+u.y/frontUnits.length
  }),{x:0,y:0}):s.commander?.mission??s.rally??home;
  // Neither an unseen opponent nor an old memory is a bombing target.
  const observed=[
   ...g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
    u.kind!=='drone'&&!unitSpec(u).flying&&g.canSee(1,u)),
   ...g.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining<=0&&
    g.canSee(1,b))
  ];
  // Select the highest-value SAFE candidate, not just the highest-value
  // candidate. Previously one defended tank could block an isolated target
  // alongside it, making an already paid bomber wait indefinitely.
  const target=observedBomberSupportTarget(observed,front,1400,
   candidate=>this.bomberStrikeSafe(candidate))??
   (g.world.mapVersion===26&&g.world.generatorVersion>=4?
    observed.filter(v=>['headquarters','turret'].includes(v.kind)&&
     this.bomberStrikeSafe(v)).sort((a,b)=>
      (a.kind==='turret'?0:1)-(b.kind==='turret'?0:1)||a.id-b.id)[0]:undefined);
  if(!target){
   // One existing bomber may obtain fresh sight of an ALREADY observed HQ.
   // The remembered coordinate is only a move goal; no invisible attack.
   const hq=g.memories[1].find(m=>m.owner===0&&m.hp>0&&
     m.kind==='headquarters');
   const paid=bombers.filter(u=>u.hp>unitSpec(u).hp*.55);
   if(hq&&g.world.mapVersion===26&&g.world.generatorVersion>=4&&
      this.lateAirSupportEnabled&&g.time>=330&&
      g.territories.length>=16&&
      g.territories.filter(t=>t.owner===1).length>=g.territories.length-2&&
      paid.length>=2&&
      !g.units.some(v=>v.owner===0&&v.hp>0&&!v.carrier&&
       g.canSee(1,v)&&distance(v,home)<850)){
    const scout=paid.slice().sort((a,b)=>a.id-b.id)[0];
    const lookout=ai42HqLookout({from:scout,target:hq,size:g.world.size,
     sight:unitSpec(scout).sight,guns:s.knownTurrets});
    if(lookout&&!scout.orders.some(o=>o.kind==='attack')&&
       (!scout.orders.length||distance(scout.orders[0],lookout)>55))
     g.command([scout.id],{kind:'move',x:lookout.x,y:lookout.y});
   }
   return;
  }
  // A confirmed late-game HQ/turret does NOT require a 450-unit lateral
  // flank before the plane may turn towards its 95-unit bomb release zone.
  // All fog, paid-air, AA and known-target checks are exactly those already
  // enforced by ai42BreakoutAllowed and bomberStrikeSafe.
  const mission=s.commander?.mission;
  const rememberedHQ=g.memories[1].find(m=>m.owner===0&&m.hp>0&&
   m.kind==='headquarters');
  const bomberCount=bombers.filter(u=>u.hp>unitSpec(u).hp*.55).length;
  const airAA=(v:Unit|Base)=>['rocket','turret','interceptor','scout'].includes(v.kind);
  const lateAirAllowed=!!rememberedHQ&&ai42BreakoutAllowed({
   enabled:g.world.mapVersion===26&&g.world.generatorVersion>=4&&
    this.lateAirSupportEnabled&&this.mode==='director',
   time:g.time,controlled:g.territories.filter(t=>t.owner===1).length,
   total:g.territories.length,paidBombers:bomberCount,
   missionKind:mission?.kind,missionSector:mission?.sector,
   knownHQSector:rememberedHQ?.territory,
   targetKind:target.kind,distanceFromHQ:distance(target,rememberedHQ),
   targetVisible:g.canSee(1,target),
   knownAirDefenses:s.knownTurrets.filter(v=>distance(v,target)<650).length,
   observedAirDefenses:observed.filter(v=>airAA(v)&&distance(v,target)<650).length
  });
  for(const [index,u] of bombers.entries()){
   if(recalled.has(u.id))continue;
   const alreadyTargeted=u.orders.some(o=>o.kind==='attack'&&o.target===target.id);
   if(u.orders.some(o=>o.kind==='attack'&&
    observed.some(v=>v.id===o.target)))continue;
   if(ai42DirectVisibleStrike({
      airBreakoutAllowed:lateAirAllowed,bomberDistance:distance(u,target),
      existingSameTarget:alreadyTargeted,
      retreating:!!u.returnToHangar||!!u.airfieldService
   })){
    if(g.command([u.id],{kind:'attack',x:target.x,y:target.y,target:target.id}))
     for(const o of u.orders)o.tactical={group:s.groupId,mode:'assault'};
    continue;
   }
   const fx=target.x-front.x,fy=target.y-front.y;
   // A front-centroid sitting exactly at the observed HQ provides no
   // valid flank direction. Use the actual bomber approach instead.
   const airApproach=g.world.mapVersion===26&&
    ['headquarters','turret'].includes(target.kind)&&Math.hypot(fx,fy)<70;
   const dx=airApproach?target.x-u.x:fx,dy=airApproach?target.y-u.y:fy,
    norm=Math.hypot(dx,dy)||1;
   // Older index%2 assigned the exact same flank to bomber #1 and #3.
   // Keep two broad sides, but stagger additional aircraft along the
   // approach so each has its own real route before the common target.
   const wing=index%2===0?-1:1;
   const depth=220+Math.floor(index/2)*160;
   const flank={
    x:clamp(target.x-dx/norm*depth-dy/norm*wing*260,50,g.world.size-50),
    y:clamp(target.y-dy/norm*depth+dx/norm*wing*260,50,g.world.size-50)
   };
   if(!g.command([u.id],{...flank,kind:'move'}))continue;
   g.command([u.id],{x:target.x,y:target.y,
    kind:'attack',target:target.id},true);
   for(const o of u.orders)o.tactical={group:s.groupId,mode:'assault'};
  }
 }
 /** Observed anti-air/anti-tank interception overrides generic attack-move
  * only for shoulder-rocket troops in the actual offensive squad.
  * Uses no unseen opponents and does not repurpose recovery/engineer orders. */
 private counterMissileScreen(members:Unit[],visible:Unit[],goal:Point):void{
  for(const u of members.filter(u=>u.kind==='rocket'&&u.hp>0&&!u.carrier)){
   const target=selectObservedCounterTarget('rocket',u,visible,
    unitSpec(u).sight+120,goal);
   if(!target||u.orders[0]?.target===target.id)continue;
   this.issue([u],target,'assault',target.id,false,false);
  }
 }
 /** Use real paid infantry, AA rockets and armor as dispersed base sentries.
  * These have normal vision, normal weapons and no special fog awareness.
  * A guard already fighting visible raiders belongs to localDefense() first.
  */
 private stationHomeGuards(guards:Unit[],home:Point):void{
  if(!guards.length)return;
  const g=this.g;
  const protectedBases=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.buildRemaining<=0)
   .sort((a,b)=>(a.kind==='headquarters'?0:1)-(b.kind==='headquarters'?0:1)||a.id-b.id)
   .slice(0,3);
  const frontAngle=Math.atan2(g.world.size/2-home.y,g.world.size/2-home.x);
  const angles=[-.85,.85,Math.PI,-.15,1.8];
  // AI 3.2 positions up to TWO already-paid guards at separate valuable
  // frontier Bastions, with at least two sentries retained at home when
  // four or more are available. Never inspect hidden enemy units.
  const frontiers=g.territories.filter(t=>t.owner===1&&
    t.neighbors.some(id=>g.territories[id]?.owner!==1));
  const legacyFrontier=(a:typeof frontiers[number],b:typeof frontiers[number])=>
   Number(b.neighbors.some(id=>g.territories[id]?.owner===0))-
   Number(a.neighbors.some(id=>g.territories[id]?.owner===0))||
   b.income-a.income||distance(home,a.point)-distance(home,b.point)||a.id-b.id;
  if(this.ai35Enabled){
   // Reassign just the EXISTING paid frontier guards towards Bastions under
   // real capture pressure. Only observed enemy units affect prioritization.
   const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
    u.kind!=='drone'&&g.canSee(1,u));
   const priority=(t:typeof frontiers[number])=>
    g.world.mapVersion>=23&&this.ai37Mode==='coordinated'?ai37BastionDefenseValue({
      income:t.income,upgradeLevel:t.upgradeLevel,
      contestProgress:t.capturing===0?t.progress:0,
      enemyAdjacent:t.neighbors.some(id=>g.territories[id]?.owner===0),
      visibleRaiders:visible.filter(u=>distance(u,t.point)<360).length
    }):bastionGuardPriority({
      id:t.id,income:t.income,capturing:t.capturing,progress:t.progress,
      enemyAdjacent:t.neighbors.some(id=>g.territories[id]?.owner===0),
      visibleRaiders:visible.filter(u=>distance(u,t.point)<360).length
    });
   frontiers.sort((a,b)=>priority(b)-priority(a)||legacyFrontier(a,b));
  }else frontiers.sort(legacyFrontier);
  const originalPosts=g.world.mapVersion>=24
   ?frontierGuardPosts(guards.length,frontiers.length)
   :Math.min(1,guards.length-1,frontiers.length);
  const posted=this.ai33Mode==='adaptive'
   ?mapFrontierPosts(g.world.mapVersion,guards.length,frontiers.length,originalPosts)
   :originalPosts;
  for(const [i,u] of guards.entries()){
   const fort=i>0&&i<=posted?frontiers[i-1]:null;
   // Keep all remaining reserves around HQ and production structures.
   const base=fort?.point??protectedBases[i%Math.max(1,protectedBases.length)]??home;
   const angle=fort?Math.atan2(home.y-base.y,home.x-base.x):
    frontAngle+angles[i%angles.length];
   const radius=fort?68:base===home?185:150;
   const proposed={x:base.x+Math.cos(angle)*radius,y:base.y+Math.sin(angle)*radius};
   const post=g.world.nearest(proposed,this.obstacles(),[],u,Math.max(0,unitSpec(u).radius-10));
   if(!post||distance(post,base)>(fort?200:310))continue;
   // An unreachable perimeter post is not useful defense. The same
   // navigation rules apply to guards as to the attack formation.
   if(distance(u,post)>58&&!this.route(u,post).length)continue;
   if(distance(u,post)<58){
    if(u.orders.length&&u.orders[0]?.tactical?.mode==='safe')g.stop([u.id],true);
    else if(!u.orders.length&&!u.hold)g.stop([u.id],true);
    continue;
   }
   if(u.defendUntil>g.time)continue; // never override an active firefight
   if(u.orders[0]?.tactical?.mode==='safe'&&distance(u.orders[0],post)<85)continue;
   this.issue([u],post,'safe',undefined,false,false);
  }
 }
 /** Staff real paid Bunkers without reducing the field attack below five
  * fighters. Never pull engineers, medics, current assault members or
  * units already engaged with VISIBLE opponents. Real boarding orders
  * reserve seats and follow ordinary terrain/path rules.
  */
 private staffBunkers(army:Unit[],home:Point):Set<number>{
  const g=this.g;
  const already=new Set(army.filter(u=>u.orders[0]?.kind==='garrison').map(u=>u.id));
  if(this.mode!=='director'||this.ai37Mode==='off'||g.world.mapVersion<23)return already;
  const bunkers=g.bases.filter(b=>b.owner===1&&b.kind==='bunker'&&
    b.hp>0&&b.buildRemaining<=0)
    .sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id);
  if(!bunkers.length)return already;
  const infantry=army.filter(u=>unitSpec(u).group==='Infanterie'&&
    !['engineer','medic'].includes(u.kind)&&u.hp>0);
  const fighters=army.filter(combat);
  const current=g.units.filter(u=>u.hp>0&&u.carrier&&
    bunkers.some(b=>b.id===u.carrier)).length;
  const intended=ai37GarrisonQuota({
   activeInfantry:infantry.length+current,
   fieldFighters:fighters.length+current,
   bunkerCount:bunkers.length,
   homeThreat:g.units.some(u=>u.owner===0&&u.hp>0&&
     !u.carrier&&g.canSee(1,u)&&distance(u,home)<730),
   frontlineOrders:this.state.group.length
  });
  let budget=Math.max(0,intended-current-already.size);
  if(!budget)return already;
  const reservedAssault=new Set(this.state.group);
  for(const bunker of bunkers){
   const reserved=army.filter(u=>u.orders[0]?.kind==='garrison'&&
     u.orders[0].target===bunker.id).length;
   let room=Math.min(BUNKER_CAPACITY-(bunker.garrison?.length??0)-reserved,budget);
   if(room<=0)continue;
   const existing=g.units.filter(u=>u.carrier===bunker.id&&u.hp>0);
   const priority=(u:Unit)=>u.kind==='rocket'
     ?(existing.some(v=>v.kind==='rocket')?3:0):
      u.kind==='heavy'?1:u.kind==='infantry'?2:4;
   const candidates=infantry.filter(u=>
    !already.has(u.id)&&!reservedAssault.has(u.id)&&
    u.hp>=unitSpec(u).hp*.55&&u.defendUntil<=g.time&&
    !u.orders.some(o=>['build','board','garrison'].includes(o.kind))&&
    distance(u,bunker)<780&&
    !g.units.some(enemy=>enemy.owner===0&&enemy.hp>0&&!enemy.carrier&&
      g.canSee(1,enemy)&&distance(enemy,u)<280))
    .sort((a,b)=>priority(a)-priority(b)||distance(a,bunker)-distance(b,bunker)||a.id-b.id);
   for(const u of candidates){
    if(room<=0||budget<=0)break;
    if(!g.boardBunker(bunker.id,[u.id]))continue;
    already.add(u.id);room--;budget--;
   }
  }
  return already;
 }
 /** A cheap second axis of pressure: mobile reserves capture an unguarded adjacent
  * bastion while the main army fights. No unknown enemies are inspected. */
 private raid(fighters:Unit[]):void{
  const g=this.g,s=this.state;
  if(g.world.mapVersion<3||s.phase!=='attack'||fighters.length<10||s.target===null)return;
  const raiders=fighters.filter(u=>!s.group.includes(u.id)&&['rover','tank'].includes(u.kind)
   &&(!u.orders.length||u.orders[0].tactical?.mode==='assault')).slice(0,2);
  if(raiders.length<2)return;
  const frontiers=g.territories.filter(t=>t.owner!==1&&t.id!==s.target&&t.neighbors.some(i=>g.territories[i].owner===1));
  const viable=frontiers.filter(t=>!s.knownTurrets.some(turret=>distance(turret,t.point)<turret.range+80)
   &&!g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===t.id&&['headquarters','turret'].includes(m.kind??''))
   &&!g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&distance(u,t.point)<300));
  if(!viable.length)return;
  const centroid=raiders.reduce((p,u)=>({x:p.x+u.x/raiders.length,y:p.y+u.y/raiders.length}),{x:0,y:0});
  viable.sort((a,b)=>distance(centroid,a.point)-distance(centroid,b.point)||a.id-b.id);
  const target=viable[0],need=raiders.filter(u=>!u.orders[0]||distance(u.orders[0],target.point)>120);
  if(need.length)this.issue(need,target.point,'assault',undefined,false,false);
 }
 /** 2.5 second operational axis. A two-unit mobile detachment uses ONLY
  * public adjacent sector ownership and real observed threats. It never
  * borrows the main assault group, reserves, medics or siege guns. */
 private secondaryPressure(fighters:Unit[],main:{sector:number},home:Point):Set<number>{
  if(this.raidDetachmentMode==='off'||this.doctrineMode!=='intelligent'||this.mode!=='director'||this.planningMode!=='tactical'
    ||this.g.world.mapVersion<3)return new Set();
  const g=this.g,s=this.state,b=s.battle??=newBattle();
  const recentFailures=b.fronts.filter(f=>g.time-f.at<100).length;
  const recentLosses=s.losses.filter(l=>g.time-l.at<70).length;
  const homePressure=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'
   &&g.canSee(1,u)&&distance(u,home)<850);
  const defensePlan=g.world.mapVersion>=19?homeDefensePlan({
   fighters:fighters.length,time:g.time,recentLosses,recentFailures,
   lastFailureAt:b.fronts.at(-1)?.at??-1,observedHomePressure:homePressure,
   defendedTarget:false,confirmedEndgame:false}):null;
  const emergency=b.squads.some(q=>q.role==='defense'&&q.ids.length>0);
  const old=b.squads.find(q=>q.role==='raid');
  const comeback=g.world.mapVersion>=11&&g.time>=45&&comebackPressure(g.territories,1);
  // Reserve genuine paid HQ guards BEFORE selecting the mobile detachment.
  // Otherwise a fast raider can steal the exact sentry needed at home.
  const homeGuards=defensePlan?.guards??homeGarrisonSize(fighters.length,false);
  const protectedIds=g.world.mapVersion>=24?new Set(fighters.slice()
   .sort((a,v)=>distance(a,home)-distance(v,home)||a.id-v.id)
   .slice(0,homeGuards).map(u=>u.id)):new Set<number>();
  const candidates=fighters.filter(u=>!s.group.includes(u.id)&&
    !protectedIds.has(u.id)&&['rover','infantry'].includes(u.kind)
    &&u.hp>=unitSpec(u).hp*.7&&!b.withdrawals.some(w=>w.unit===u.id&&w.until>g.time));
  const mainScreen=s.group.filter(id=>fighters.some(u=>u.id===id)).length;
  const earlyParallel=parallelFrontReady({
   mapVersion:g.world.mapVersion,time:g.time,phase:s.phase,
   fighters:fighters.length,main:mainScreen,eligible:candidates.length,
   homeGuards,homePressure,recentLosses,recentFailures,emergency});
  // AI 3.3 adjusts ONLY the two sizes which underperformed in the
  // matched 3.1/3.2 arena. On the 12-Bastion map this gate is a no-op.
  if(this.ai33Mode==='adaptive'&&!mapRaidReady({
   mapVersion:g.world.mapVersion,time:g.time,phase:s.phase,
   fighters:fighters.length,main:mainScreen,eligible:candidates.length,
   homeGuards,homePressure,recentLosses,recentFailures,emergency
  }))return new Set();
  if(defensePlan&&!defensePlan.allowSecondaryRaids&&!earlyParallel)return new Set();
  const normal=allowSecondaryPressure(fighters.length,fighters.length-2,
    fighters.length-s.group.filter(id=>!fighters.some(u=>u.id===id)).length-2,candidates.length);
  const selective=this.raidDetachmentMode==='selective'&&g.world.mapVersion===11;
  const currentFront=s.group.filter(id=>fighters.some(u=>u.id===id)).length;
  const homeThreat=selective&&g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'
    &&g.canSee(1,u)&&distance(u,home)<560);
  const permitted=selective?selectiveRaidAllowed({
    fighters:fighters.length,mainScreen:currentFront,
    eligibleRaiders:candidates.length,normalDoctrine:normal,
    behindByTwoSectors:comeback,observedHomeThreat:homeThreat}):
    (normal||earlyParallel||comeback&&fighters.length>=5&&candidates.length>=2);
  if(!permitted||emergency){
   b.squads=b.squads.filter(q=>q.role!=='raid');return new Set();
  }
  const scout=old?candidates.filter(u=>old.ids.includes(u.id)):candidates.slice()
   .sort((a,v)=>(a.kind==='rover'?0:1)-(v.kind==='rover'?0:1)||a.id-v.id);
  const party=scout.length>=2?scout.slice(0,2):candidates.slice()
   .sort((a,v)=>(a.kind==='rover'?0:1)-(v.kind==='rover'?0:1)||a.id-v.id).slice(0,2);
  if(party.length!==2)return new Set();
  const anchor={x:(party[0].x+party[1].x)/2,y:(party[0].y+party[1].y)/2};
  const frontier=g.territories.filter(t=>t.owner!==1&&t.id!==main.sector
    &&(t.neighbors.some(id=>g.territories[id].owner===1)
      ||comeback&&canCaptureSector(g.territories,t,1,g.world.mapVersion)));
  const fronts:RaidFront[]=[];
  for(const t of frontier){
   const threatened=s.knownTurrets.some(tower=>distance(tower,t.point)<tower.range+140)
    ||g.memories[1].some(m=>m.owner===0&&m.hp>0&&m.territory===t.id)
    ||g.units.some(enemy=>enemy.owner===0&&enemy.hp>0&&!enemy.carrier&&enemy.kind!=='drone'&&g.canSee(1,enemy)&&distance(enemy,t.point)<360);
   if(threatened)continue;
   const route=this.route(anchor,t.point);
   if(!route.length)continue;
   const path=this.sampleRoute(route,anchor);
   if(path.risk>=8||comeback&&path.length>2400||
      this.ai33Mode==='adaptive'&&!mapRaidRouteReady(g.world.mapVersion,path.length,path.risk))continue;
   fronts.push({id:t.id,x:t.point.x,y:t.point.y,owner:t.owner,income:t.income,
     routeLength:path.length,routeRisk:path.risk,observedThreat:threatened});
  }
  // Retain an active safe raid; prioritize valuable enemy sectors while
  // behind, using public ownership and only previously observed threats.
  const continuing=old?.target!==null?fronts.find(t=>t.id===old?.target):undefined;
  const counter=comeback?chooseComebackOpportunity(fronts.map(t=>({
   ...t,protected:t.observedThreat,recentlyLost:s.experience?.lastLostSector===t.id
  }))):undefined;
  const target=continuing??counter??chooseRaidFront(fronts,main.sector);
  if(!target){b.squads=b.squads.filter(q=>q.role!=='raid');return new Set();}
  const changed=old?.target!==target.id||party.some(u=>!old?.ids.includes(u.id));
  b.squads=[...b.squads.filter(q=>q.role!=='raid'),
   {role:'raid' as const,ids:party.map(u=>u.id),target:target.id,since:changed?g.time:old!.since}];
  if(changed)this.diagnostics.secondaryRaids++;
  for(const u of party){
   const order=u.orders[0];
   if(changed||!order||order.kind!=='attackMove'||order.tactical?.mode!=='assault'
     ||distance(order,target)>100){
    if(this.issue([u],target,'assault',undefined,false,false))this.diagnostics.secondaryRaidOrders++;
   }
  }
  void home;
  return new Set(party.map(u=>u.id));
 }
 /** Strategic missions own the operational group. Capture orders, reconnaissance
  * and repair have separate rosters, so a macro pulse cannot erase their work. */
 private campaign(army:Unit[],fighters:Unit[],medics:Unit[],home:Point):void{
  const g=this.g,s=this.state,c=s.commander??=newCampaign();
  // Keep saved roster IDs limited to actual surviving members.
  s.group=s.group.filter(id=>army.some(u=>u.id===id));
  const centroid=(units:Unit[])=>units.length?units.reduce((p,u)=>({x:p.x+u.x/units.length,y:p.y+u.y/units.length}),{x:0,y:0}):home;
  const assigned=fighters.filter(u=>s.group.includes(u.id));
  const physicalArmy=assigned.length?assigned:fighters;
  const meanOrigin=centroid(physicalArmy);
  // In large procedural canyons, the geometric centre of two separated
  // squads can sit INSIDE a cliff or another disconnected component.
  // AI3.5 keeps its reference behaviour; KI3.6 uses a living walkable
  // combatant to validate mission routes and stage its next offensive.
  const origin=this.ai36Enabled
   ?groundedAssaultRouteOrigin(physicalArmy,meanOrigin,
      p=>g.world.walkable(p,this.obstacles(),5))
   :meanOrigin;
  const previous=c.mission,aborted=c.aborted;
  const experience=s.experience??=newExperience();
  if(experience.active){const a=experience.active,won=g.territories[a.sector]?.owner===1;
   // Count an observed destroyed objective as victory, even before its sector falls.
   const objectiveGone=a.objective!=null&&a.target!==undefined&&g.canSee(1,a.target)
    &&!g.bases.some(b=>b.id===a.objective&&b.hp>0);
   if(won||objectiveGone||g.time-a.at>120)finishExperience(experience,!!(won||objectiveGone),fighters.reduce((n,u)=>n+u.hp,0));}
  // The tactical route search is intentionally bounded for frame latency.
  // When an early R-01 has revealed a distant HQ, its full risk-aware path
  // can fail within that bound, while the real unit navigator can still
  // advance safely in partial segments. Offer this fallback ONLY for AI3.6
  // and only after chooseMission found no complete strategic route.
  const routeFallback=this.ai36Enabled?(p:Point)=>{
   const obstacles=this.obstacles();
   const clear=g.world.path(origin,p,obstacles,5);
   if(clear.length)return this.sampleRoute(clear,origin);
   const partial=g.world.path(origin,p,obstacles,5,undefined,false,false,true);
   if(partial.length){
    const remaining=distance(partial[partial.length-1],p);
    if(distance(origin,p)-remaining>=Math.max(80,g.world.cell*2)){
     const measured=this.sampleRoute(partial,origin);
     // The untraversed suffix is a cost, NOT an invented reachable path.
     return {length:measured.length+remaining*1.5,risk:measured.risk+1};
    }
   }
   // KI 4.0: A cliff-side objective may require travelling AWAY from the
   // final destination to reach an authentic mountain pass. The previous
   // straight-line progress test discarded every such genuine path.
   // Validate a short real path towards a public terrain checkpoint.
   // Never assume the unknown remainder is passable or expose fog enemies.
   if(g.world.generatorVersion>=3&&g.world.generated?.ridges.length){
    const pass=canyonPassWaypoint(origin,p,g.world.generated.ridges,5);
    if(pass){
     const leg=g.world.path(origin,pass,obstacles,5,undefined,
      false,false,true);
     if(leg.length){
      const end=leg[leg.length-1],advance=distance(origin,pass)-distance(end,pass);
      if(advance>=Math.max(80,g.world.cell*2)){
       const measured=this.sampleRoute(leg,origin);
       return {length:measured.length+
        distance(end,pass)*1.5+distance(pass,p)*1.5,
        risk:measured.risk+2};
      }
     }
    }
   }
   return undefined;
  }:undefined;
  const rememberedEnemyHQ=g.memories[1].find(m=>
   m.owner===0&&m.kind==='headquarters'&&m.hp>0);
  const observedEnemyHQ=!!rememberedEnemyHQ;
  // A new offensive pivot needs the player's truly active sensor coverage.
  // Once an HQ attack is already committed, a brief lost line-of-sight
  // cannot reset the artillery rally if its genuine progress is recent.
  const oldHqMission=s.commander?.mission;
  const liveHQContact=!!rememberedEnemyHQ&&(
   g.canSee(1,rememberedEnemyHQ)||
   (oldHqMission?.kind==='structure'&&
    oldHqMission.objective===rememberedEnemyHQ.id&&
    g.time-oldHqMission.progressAt<45));
  const hqAssaultSituation={
   time:g.time,totalBastions:g.territories.length,
   ownedBastions:g.territories.filter(t=>t.owner===1).length,
   visibleOrRememberedHQ:observedEnemyHQ,
   mobileFighters:fighters.filter(u=>combat(u)&&!unitSpec(u).flying).length,
   healthyMobile:fighters.filter(u=>combat(u)&&!unitSpec(u).flying&&
     u.hp>=unitSpec(u).hp*.55).length,
   artillery:fighters.filter(u=>u.kind==='artillery'&&u.hp>0).length,
   homeThreat:g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&
     g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<500)),
   recentLosses:s.losses.filter(l=>g.time-l.at<35).length
  };
  // Coordinated AI keeps its proven existing HQ rules. On the two fixed
  // desert maps with a stronger *offensive* doctrine, permit the same paid
  // siege group to exploit physically held Bastions, but only after our
  // scouts really discovered a living enemy HQ. No fog knowledge or bonus.
  const fixedDesert=this.hqBreakthroughMode==='calibrated'
   ?selectDesertAIDoctrine({
    seed:g.seed,mapVersion:g.world.mapVersion,
    profile:g.world.generated?.battlefield?.profile,
    kind:g.world.generated?.landscapeKind,
    generatorVersion:g.world.generatorVersion
   }):null;
  const offensiveBreakthrough=fixedDesert?.mode==='off'&&
   this.ai36Enabled&&ai43OffensiveHqBreakthrough({
    time:hqAssaultSituation.time,
    totalBastions:hqAssaultSituation.totalBastions,
    ownedBastions:hqAssaultSituation.ownedBastions,
    knownLivingHQ:hqAssaultSituation.visibleOrRememberedHQ,
    liveHQContact,
    mobileFighters:hqAssaultSituation.mobileFighters,
    healthyMobile:hqAssaultSituation.healthyMobile,
    artillery:hqAssaultSituation.artillery,
    observedHomeThreat:hqAssaultSituation.homeThreat,
    recentLosses:hqAssaultSituation.recentLosses
   });
  const breakthrough=(this.ai37Mode==='coordinated'&&
    ai38DecisiveAssault(hqAssaultSituation))||Boolean(offensiveBreakthrough);
  const mission=chooseMission(g,c,origin,{strategy:s.adaptive?.strategy??'unknown',
   breakthrough,
   force:fighters,losses:s.losses,fronts:s.battle?.fronts??[],
   intelligent:this.missionPlannerMode==='legacy'?false:this.doctrineMode==='intelligent',
   bastionControl:this.ai35Enabled,experience,
   route:p=>{const route=this.route(origin,p);return route.length?this.sampleRoute(route,origin):undefined;},
   routeFallback});
  if(!mission){
   campaignPhase(c,'endgame',g.time);this.setPhase('regroup');s.group=[];s.objective=null;s.target=null;
   // Once the map is captured, ground patrols also search fog for survivors.
   for(const u of fighters.slice(0,2)){const goal=reconGoal(g,c,u,p=>this.danger(p));if(goal)this.issue([u],goal,'assault',undefined,false,false);}
   return;
  }
  const changed=previous!==mission;
  // The commander can re-target a turret protecting an HQ in the SAME
  // sector. Its old mission is a new objective, not a lost frontline. Keep
  // the already paid column fighting, but only with real current vision,
  // a close local threat and no evidence of a decimated screening force.
  const newObserved=mission.objective===null?false:
   knownBuildings(g).some(v=>v.id===mission.objective&&v.hp>0&&g.canSee(1,v));
  const keepRetarget=this.ai36Enabled&&!!previous&&
   maintainAI36FrontOnRetarget({
    sameSector:previous.sector===mission.sector,
    oldKind:previous.kind,newKind:mission.kind,
    objectiveDistance:distance(previous,mission),
    observedObjective:newObserved,
    activeAssault:s.phase==='attack',
    livingAttackers:assigned.filter(u=>u.hp>0&&combat(u)).length,
    recentLosses:s.losses.filter(l=>g.time-l.at<30&&
     s.group.includes(l.id)&&distance(l,mission)<850).length
   });
  if(c.aborted>aborted&&!keepRetarget){
   g.stop(s.group.filter(id=>fighters.some(u=>u.id===id)));
   s.group=[];this.setPhase('regroup');
  }
  if(changed){
   s.target=mission.sector;s.objective=mission.objective;s.route=[];
   // Retargeted artillery and tanks are already near their siege approach.
   // Rebuilding a fresh rear rally would discard useful offensive momentum.
   if(!keepRetarget)s.rally=null;
  }
  const intel=mission.objective===null?undefined:knownBuildings(g).find(b=>b.id===mission.objective);
  const towers=s.knownTurrets.filter(t=>distance(t,mission)<t.range+200);
  // Fighting units can encounter a player ambush *before* reaching their
  // strategic objective. Count only currently observed opponents, but also
  // include actual nearby contacts along the moving assault column.
  const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&
   (distance(u,mission)<450||(s.phase==='attack'&&fighters.some(v=>
    s.group.includes(v.id)&&distance(v,u)<450))));
  const defended=mission.kind!=='capture'||g.territories[mission.sector].owner===0||towers.length>0||visible.reduce((n,u)=>n+combatStrength(u),0)>3;
  if(!s.rally){
   const rear=g.territories.filter(t=>t.owner===1).sort((a,b)=>distance(a.point,mission)-distance(b.point,mission)||a.id-b.id)[0]?.point??home;
   s.rally=g.world.nearest({x:rear.x+(home.x-rear.x)*.08,y:rear.y+(home.y-rear.y)*.08},this.obstacles(),[],undefined,12)??rear;
   // Stand outside an observed gun's reach; never infer an unseen gun.
   if(towers.some(t=>distance(t,s.rally!)<t.range+50))s.rally=this.rally(fighters,home);
  }
  // Cleanup holds the paid army together rather than sending two fighters to
 // a secondary neutral bastion while enemy production is still standing.
 const raidUnits=c.enemyHQEliminatedAt===undefined?this.secondaryPressure(fighters,mission,home):new Set<number>();
  const mainFighters=fighters.filter(u=>!raidUnits.has(u.id));
  const modernDefense=g.world.mapVersion>=19&&this.mode==='director';
  const battleNow=s.battle??=newBattle();
  const recentFailures=battleNow.fronts.filter(f=>g.time-f.at<100);
  const recentLosses=s.losses.filter(l=>g.time-l.at<70).length;
  const observedHomePressure=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)
   &&g.bases.some(base=>base.owner===1&&base.hp>0&&distance(base,u)<850));
  const policy=modernDefense?homeDefensePlan({
   fighters:mainFighters.length,time:g.time,recentLosses,
   recentFailures:recentFailures.length,
   lastFailureAt:recentFailures.reduce((at,f)=>Math.max(at,f.at),-1),
   observedHomePressure,defendedTarget:defended,
   confirmedEndgame:c.enemyHQEliminatedAt!==undefined,
   tempoPressure:this.battleDirective?.accelerateRally??false}):null;
  // 3.5 retains one *real, paid* frontier sentry after controlling multiple
  // Bastions, while preserving >=2/3 fighters at HQ. This reduces the
  // repeated win-by-capture exploit without granting free defenders.
  const ownBastions=g.territories.filter(t=>t.owner===1).length;
  const controlReserve=this.ai35Enabled&&c.enemyHQEliminatedAt===undefined
   ?bastionGarrisonReserve(g.world.mapVersion,ownBastions,mainFighters.length):0;
  const reserve=Math.max(homeGarrisonSize(mainFighters.length,c.enemyHQEliminatedAt!==undefined),
   policy?.guards??0,controlReserve);
  // Home guards are drawn from available infantry first. Reserving a fully
  // staged tank while distant infantry are still assembling used to reduce a
  // combat-ready four-tank vanguard to three and delay a proven early wave.
  // This does not create extra units: the paid infantry stay available for
  // emergency localDefense(), while armor can keep the attack on schedule.
  const homeGuardPriority=(u:Unit)=>u.kind==='infantry'?0:
   u.kind==='heavy'?1:u.kind==='rover'?2:u.kind==='tank'?3:
   u.kind==='artillery'?4:2;
  const guards=new Set(mainFighters.filter(u=>s.phase!=='attack'||!s.group.includes(u.id))
   .sort((a,b)=>homeGuardPriority(a)-homeGuardPriority(b)||
    distance(a,home)-distance(b,home)||a.id-b.id)
   .slice(0,reserve).map(u=>u.id));
  if(policy&&s.phase!=='attack')s.group=s.group.filter(id=>!guards.has(id));
  if(policy)this.stationHomeGuards(mainFighters.filter(u=>guards.has(u.id)),home);
  // KI 4.5: observed HQ/turret missions can be stranded by a gather point
  // on the wrong side of a physical plateau. Only after 95+ seconds with
  // no formed wave do we try a NEW point. It must be reachable by PAID
  // fighters and have a COMPLETE vehicle path to a safe artillery approach.
  // No new units, hidden targets, teleporting or bypassing cliffs.
  if(this.ai45Mode==='on'&&this.ai36Enabled&&s.rally&&intel&&intel.hp>0&&
     (g.world.generatorVersion===10||
       (g.world.generatorVersion===7&&g.seed===271121))&&
     mission.kind==='structure'&&s.phase==='gather'&&
     g.time-s.phaseAt>=95&&g.time>=this.ai45SiegeRallyRetryAt&&
     this.ai45RecoveredMissionSince!==mission.since){
    const sample=mainFighters.filter(u=>!guards.has(u.id)&&
      combat(u)&&!unitSpec(u).flying&&u.hp>0&&!u.carrier)
     .sort((a,b)=>distance(a,mission)-distance(b,mission)||a.id-b.id)
     .slice(0,12);
    // A nonempty partial A* result can still stop at a canyon wall.
    // Count a route only if its last node actually reaches the requested point.
    const completeRallyRoute=(from:Point,to:Point):boolean=>{
     const path=this.route(from,to);
     return path.length>0&&distance(path[path.length-1],to)<=g.world.cell*2;
    };
    const readyAtRally=sample.filter(u=>distance(u,s.rally!)<330).length;
    const canReachRally=readyAtRally>=4?readyAtRally:
     sample.filter(u=>distance(u,s.rally!)<140||
      completeRallyRoute(u,s.rally!)).length;
    const shouldRelocate=ai45CanRelocateStuckSiege({
      mapVersion:g.world.mapVersion,
      generatorVersion:g.world.generatorVersion,seed:g.seed,
      missionKind:mission.kind,objectiveObserved:true,
      homePressure:observedHomePressure,fighters:sample.length,
      phase:s.phase,gatherSeconds:g.time-s.phaseAt,
      lastAttemptAgo:g.time-this.ai45SiegeRallyRetryAt+45,
      readyAtRally,canReachRally
    });
    if(this.rallyGateTraceEnabled){
      const needed=Math.min(4,Math.max(3,Math.ceil(sample.length*.30)));
      const reason=observedHomePressure?'home-pressure':
       sample.length<8?'insufficient-ground-fighters':
       readyAtRally>=needed?'already-assembled':
       canReachRally>=needed&&g.time-s.phaseAt<145&&readyAtRally>0?'rally-already-reachable':
       !shouldRelocate?'other-eligibility-gate':'searching-validated-route';
      this.ai45DecisionTrace.push({at:Math.round(g.time),reason,
       fighters:sample.length,readyAtRally,canReachRally,needed,
       gatherSeconds:Math.round(g.time-s.phaseAt)});
      if(this.ai45DecisionTrace.length>100)this.ai45DecisionTrace.shift();
    }
    if(shouldRelocate){
      this.ai45SiegeRallyRetryAt=g.time+45;
      const obstacles=this.obstacles();
      const valid=(p:Point)=>g.world.walkable(p,obstacles,12)&&
       this.danger(p)<9&&!s.knownTurrets.some(t=>
        distance(t,p)<t.range+95);
      let pathChecks=0;
      const targetApproach=(p:Point):boolean=>{
       const radius=Math.max(600,Math.min(840,UNITS.artillery.range*.80));
       // Navigation colliders have geometry, not IDs; omit only the observed target's own footprint.
       const lineBlockers=obstacles.filter(b=>distance(b,intel)>1);
       for(let step=0;step<8;step++){
        const angle=step*Math.PI/4;
        const wanted={
         x:clamp(intel.x+Math.cos(angle)*radius,70,g.world.size-70),
         y:clamp(intel.y+Math.sin(angle)*radius,70,g.world.size-70)
        };
        const aim=g.world.nearest(wanted,obstacles,[],undefined,12);
        if(!aim||distance(aim,intel)>UNITS.artillery.range-35||
           distance(aim,intel)<200||
           !g.world.line(aim,intel,lineBlockers,10))continue;
        const path=this.route(p,aim);
        if(!path.length||
           distance(path[path.length-1],aim)>g.world.cell*2)continue;
        if(this.sampleRoute(path,p).risk>=20)continue;
        return true;
       }
       return false;
      };
      const points=[
       ...sample.map(u=>({x:u.x,y:u.y})),
       ...g.territories.filter(t=>t.owner===1).map(t=>t.point)
      ];
      const next=ai45ChooseReachableSiegeRally({
       candidates:points,fighters:sample,objective:mission,
       safe:valid,
       reachable:completeRallyRoute,
       siegeApproachReachable:p=>{
        if(pathChecks++>=10)return false;
        return targetApproach(p);
       }
      });
      if(this.rallyGateTraceEnabled){
       const last=this.ai45DecisionTrace.at(-1);
       if(last)last.reason=!next?'no-reachable-artillery-approach':
        distance(next,s.rally)>260?'recovered':'candidate-too-near-old-rally';
      }
      if(next&&distance(next,s.rally)>260){
       s.rally=next;
       this.ai45RecoveredMissionSince=mission.since;
       this.ai45RallyRescues++;
      }
    }
  }
  // Read-only, benchmark-opt-in gate trace of REAL planner inputs.
  // No changes to AI orders, campaign state, fog, credits or saves.
  if(this.rallyGateTraceEnabled&&g.time>=180&&g.time-this.lastRallyGateTraceAt>=12){
   this.lastRallyGateTraceAt=g.time;
   const pool=mainFighters.filter(u=>!guards.has(u.id));
   const blockedOrders=s.rally?ai40CountBlockedRallyOrders(pool,s.rally):0;
   const requiredBlocked=Math.max(3,Math.ceil(pool.length*.35));
   const neededAtRally=Math.min(4,Math.max(3,Math.ceil(pool.length*.14)));
   const recoveryWaitRequired=ai40RecoveryWaitThreshold(pool.length,blockedOrders);
   const alreadyAtRally=s.rally?pool.filter(u=>distance(u,s.rally!)<330).length:0;
   const safeBases=this.obstacles();
   const viable=(u:Unit)=>g.world.walkable(u,safeBases,12)&&
    !s.knownTurrets.some(t=>distance(t,u)<t.range+90);
   const stats=(radius:number,minimum:number)=>{
    const candidates=pool.filter(u=>s.rally&&distance(u,s.rally)>260&&
     pool.filter(v=>distance(u,v)<radius).length>=minimum);
    return {count:candidates.length,legal:candidates.filter(viable).length};
   };
   const tight=stats(330,neededAtRally),loose=stats(720,3);
   const reasons=[
    ...(!ai41RallyMissionPermitsRescue({
      kind:mission.kind,homePressure:observedHomePressure,
      time:g.time,notBefore:policy?.notBefore??0
    })?[mission.kind!=='capture'?'non-capture-siege-needs-validated-route':
      observedHomePressure?'home-defense-pressure':'before-defense-window']:[]),
    ...(g.world.mapVersion<25?['old-map']:[]),
    ...(g.world.generatorVersion<3?['old-generator']:[]),
    ...(this.ai37Mode!=='coordinated'?['ai37-off']:[]),
    ...(s.phase!=='gather'?['not-gather']:[]),
    ...(g.time<190?['too-early']:[]),
    ...(g.time<this.ai40RallyRetryAt?['retry-cooldown']:[]),
    ...(!s.rally?['no-rally']:[]),
    ...(this.ai40RecoveredMissionSince===mission.since?['mission-already-recovered']:[]),
    ...(g.time-s.phaseAt<recoveryWaitRequired?['gather-not-yet-'+recoveryWaitRequired+'s']:[]),
    ...(pool.length<8?['insufficient-fighters']:[]),
    ...(blockedOrders<requiredBlocked?['not-enough-unpathable-orders']:[]),
    ...(alreadyAtRally>=neededAtRally?['already-assembled']:[]),
    ...(tight.legal===0?['no-safe-dense-cluster']:[])
   ];
   this.rallyGateTrace.push({
    at:Math.round(g.time),phase:s.phase,
    phaseSeconds:Math.round(g.time-s.phaseAt),
    missionSince:Math.round(mission.since),map:g.world.mapVersion,
    generator:g.world.generatorVersion,blockedBy:reasons,
    pool:pool.length,blockedOrders,requiredBlocked,recoveryWaitRequired,
    alreadyAtRally,neededAtRally,
    cluster330:tight.count,cluster720:loose.count,
    legal330:tight.legal,legal720:loose.legal,
    nearestRally:s.rally&&pool.length?Math.round(Math.min(...pool.map(u=>distance(u,s.rally!)))):-1,
    remainingToRetry:Math.max(0,Math.round(this.ai40RallyRetryAt-g.time)),
    recovered:false
   });
   if(this.rallyGateTrace.length>100)this.rallyGateTrace.shift();
  }
  // KI 4.0: On huge canyon maps a captured frontier Bastion can sit on the
  // far side of the ridge from the ACTUAL paid army. The old gather stage
  // sent dozens of tanks/infantry to that inaccessible rally for minutes,
  // never launched a siege, and left 40+ units idle. After sustained real
  // waiting, relocate the staging point to a legal, existing troop cluster.
  // No teleports, unobserved enemy positions or free units.
  if(g.world.mapVersion>=25&&g.world.generatorVersion>=3&&
     ai41RallyMissionPermitsRescue({
       kind:mission.kind,homePressure:observedHomePressure,
       time:g.time,notBefore:policy?.notBefore??0
     })&&
     this.ai37Mode==='coordinated'&&s.phase==='gather'&&
     g.time>=190&&g.time>=this.ai40RallyRetryAt&&s.rally&&
     this.ai40RecoveredMissionSince!==mission.since){
    const pool=mainFighters.filter(u=>!guards.has(u.id));
    // A slow but progressing assault must NEVER be redirected. Demand
    // genuinely unpathable current orders and a missing assembled wave.
    const trappedMoveOrders=ai40CountBlockedRallyOrders(pool,s.rally);
    const readyAtRally=pool.filter(u=>distance(u,s.rally!)<330).length;
    if(ai40ShouldAttemptRecovery({
      fighters:pool.length,blockedOrders:trappedMoveOrders,
      elapsed:g.time-s.phaseAt,readyAtRally
    })){
      // Previous KI4.1 trial restarted this timer on EVERY gather pulse,
      // including ones with zero blocked orders or an underage gather.
      // Only a genuine recovery attempt may start its nine-second cooldown.
      this.ai40RallyRetryAt=g.time+9;
      const safeBases=this.obstacles();
      const replacement=ai40ClusterRallyRecovery({
      units:pool,oldRally:s.rally,mission,
      trappedMoveOrders,stalledSeconds:g.time-s.phaseAt,
      siegeRequired:intel?.kind==='turret',
      viable:p=>g.world.walkable(p,safeBases,12)&&
       !s.knownTurrets.some(t=>distance(t,p)<t.range+90)
    });
    if(replacement){
      s.rally=replacement;
      this.ai40RecoveredMissionSince=mission.since;
      if(this.rallyGateTraceEnabled)this.rallyGateTrace.push({
        at:Math.round(g.time),phase:s.phase,
        phaseSeconds:Math.round(g.time-s.phaseAt),
        missionSince:Math.round(mission.since),map:g.world.mapVersion,
        generator:g.world.generatorVersion,blockedBy:['RECOVERED'],
        pool:pool.length,blockedOrders:trappedMoveOrders,
        requiredBlocked:Math.max(3,Math.ceil(pool.length*.35)),
        recoveryWaitRequired:ai40RecoveryWaitThreshold(pool.length,trappedMoveOrders),
        alreadyAtRally:pool.filter(u=>distance(u,replacement)<330).length,
        neededAtRally:Math.min(4,Math.max(3,Math.ceil(pool.length*.14))),
        cluster330:-1,cluster720:-1,legal330:-1,legal720:-1,
        nearestRally:0,remainingToRetry:0,recovered:true
      });
      }
    }
  }
  const selected=mainFighters.filter(u=>!guards.has(u.id)).sort((a,b)=>Number(s.group.includes(b.id))-Number(s.group.includes(a.id))||distance(a,s.rally!)-distance(b,s.rally!)||a.id-b.id).slice(0,18);
  let members=selected.filter(u=>s.group.includes(u.id));
  if(s.phase==='attack'&&members.length<Math.max(1,Math.ceil(s.launchSize*.4))){
   // KI3.6: launchSize grows after EACH reinforcement, so it is not the
   // current screen's strength. Don't recall three healthy fighters just
   // because earlier reinforcements were spent in a successful firefight.
   // Only real visible contact and real nearby paid allies count.
   const observedContact=this.ai36Enabled&&g.units.some(v=>v.owner===0&&
    v.hp>0&&!v.carrier&&v.kind!=='drone'&&g.canSee(1,v)&&
    members.some(u=>distance(u,v)<Math.max(440,unitSpec(v).range+90)));
   const knownGun=this.ai36Enabled&&s.knownTurrets.some(v=>
    distance(v,mission)<v.range+190&&g.time-v.seenAt<100);
   const preserve=this.ai36Enabled&&preserveAI36Assault({
    survivingGround:members.filter(u=>combat(u)&&!unitSpec(u).flying).length,
    healthyGround:members.filter(u=>combat(u)&&!unitSpec(u).flying&&
     u.hp>=unitSpec(u).hp*.35).length,
    armedGround:members.filter(u=>['tank','artillery','rover','rocket'].includes(u.kind)).length,
    currentlyFighting:observedContact,
    visibleGunPosition:knownGun,
    availableSiege:members.filter(u=>u.kind==='artillery'&&u.hp>0).length,
    nearbyPaidReinforcements:selected.filter(u=>!s.group.includes(u.id)&&
     u.hp>=unitSpec(u).hp*.5&&members.some(v=>distance(u,v)<500)).length
   });
   if(!preserve){
    g.stop(s.group.filter(id=>fighters.some(u=>u.id===id)));
    s.group=[];members=[];s.launchSize=0;this.setPhase('regroup');c.aborted++;
   }
  }
  const continuing=s.phase==='attack'&&members.length>0;
  const battle=s.battle??=newBattle(),readyForce=continuing?members:selected.filter(u=>distance(u,s.rally!)<330);
  // Keep safe, in-range rockets firing while the screen reforms. The existing
  // normal rally, turret threat and emergency defense logic remain unchanged.
  const safeBattery=new Set<number>();
  if(!continuing&&c.enemyHQEliminatedAt!==undefined&&intel?.kind==='turret'
   &&g.canSee(1,intel)){
   const blockers=this.obstacles().filter(o=>!('id' in o)||o.id!==intel.id);
   for(const u of selected.filter(u=>u.kind==='artillery'&&u.hp>0)){
    const mobileThreat=g.units.some(v=>v.owner===0&&v.hp>0&&!v.carrier&&v.kind!=='drone'&&g.canSee(1,v)
     &&distance(u,v)<unitSpec(v).range+90);
    if(keepEndgameBatteryFiring({confirmedEndgame:true,visibleTurret:true,
     livingGun:!u.carrier,healthyGun:u.hp>=unitSpec(u).hp*.7,
     distanceToTurret:distance(u,intel),turretRange:RULES.turret.range,
     artilleryRange:unitSpec(u).range,clearLine:g.world.line(u,intel,blockers,10),
     mobileThreat}))safeBattery.add(u.id);
   }
  }
  // The rocket itself has 830m sight, enough to reacquire a memorized
  // turret beyond its real 600m firing radius. No helicopter tech needed.
  // Restrict to confirmed cleanup; never march into a fogged opponent.
  const visionPosts=new Map<number,Point>();
  if(!continuing&&c.enemyHQEliminatedAt!==undefined&&intel?.kind==='turret'
   &&!g.canSee(1,intel)){
   const obstacles=this.obstacles().filter(o=>!('id' in o)||o.id!==intel.id);
   const rocket=selected.filter(u=>u.kind==='artillery'&&u.hp>=unitSpec(u).hp*.7
    &&!u.carrier&&!battle.withdrawals.some(w=>w.unit===u.id&&w.until>g.time))
    .sort((a,b)=>distance(a,intel)-distance(b,intel)||a.id-b.id)[0];
   if(rocket){
    const post=chooseEndgameVisionPost({
     origin:rocket,target:intel,known:s.knownTurrets,
     unitRange:unitSpec(rocket).range,unitSight:unitSpec(rocket).sight,
     size:g.world.size,walkable:p=>g.world.walkable(p,this.obstacles(),10),
     clearLine:p=>g.world.line(p,intel,obstacles,10),
     route:p=>{
      const route=this.route(rocket,p);if(!route.length)return;
      // Sampling the complete path prevents cutting through a known gun's
      // firing radius just to reach a safe-looking endpoint.
      let previous:Point=rocket,length=0,safe=true;
      for(const next of route){
       const d=distance(previous,next);length+=d;
       for(let i=0;i<=Math.ceil(d/35);i++){
        const q={x:previous.x+(next.x-previous.x)*i/Math.max(1,Math.ceil(d/35)),
         y:previous.y+(next.y-previous.y)*i/Math.max(1,Math.ceil(d/35))};
        if(s.knownTurrets.some(t=>distance(q,t)<t.range+20)){safe=false;break;}
       }
       if(!safe)break;previous=next;
      }
      return {length,safe};
     }
    });
    if(post)visionPosts.set(rocket.id,post);
   }
  }
  const stageForSiege=()=>{
   this.issue([...selected.filter(u=>!safeBattery.has(u.id)&&!visionPosts.has(u.id)),...medics],s.rally!,'safe');
   for(const u of selected.filter(u=>safeBattery.has(u.id)))this.issue([u],intel!,'assault',intel!.id);
   for(const u of selected.filter(u=>visionPosts.has(u.id))){
    const post=visionPosts.get(u.id)!;
    if(distance(u,post)>25)this.issue([u],post,'safe',undefined,false,false);
   }
  };
  const assessment=assessBattle(readyForce,visible,towers,g.time,continuing);battle.assessment=assessment;
  const overrun=canOverrun(assessment.own,assessment.enemy,readyForce.length,towers.length,experience)&&!readyForce.some(u=>u.kind==='artillery');
  if(!towers.length&&!retryFront(battle,mission.sector,assessment.own,0,readyForce.filter(u=>u.kind==='artillery').length,g.time)
   // A previously lost battle does not justify pulling an actively firing
   // KI 3.6 assault line back to base in the middle of a NEW skirmish.
   &&!(this.ai36Enabled&&continuing&&visible.length>0&&
    members.some(u=>u.defendUntil>g.time))){
   campaignPhase(c,'buildup',g.time);this.issue([...selected,...medics],s.rally,'safe',undefined,false,false);return;
  }
  if(towers.length||visible.length){
   const artillery=readyForce.filter(u=>u.kind==='artillery').length;
   // A visible, nearby opponent must be met with fire, not repeated
   // long-haul retreat orders. Existing order ownership and damage remain
   // authoritative; this never reveals enemies behind fog.
   const engageable=visible.filter(v=>members.some(u=>canAttack(u,v)&&
    distance(u,v)<=Math.max(g.range(u),unitSpec(v).range)+40));
   const inRange=members.filter(u=>engageable.some(v=>canAttack(u,v)&&
    distance(u,v)<=Math.max(g.range(u),unitSpec(v).range)+40));
   const healthy=inRange.filter(u=>u.hp>=unitSpec(u).hp*.26).length;
   // AI 3.2: when actually observed, healthy forces outmatch a real
   // local enemy by >=1.5:1, keep the line for another nine seconds.
   // Uncovered towers, unseen troops and single survivors grant no bonus.
   const decisive=g.world.mapVersion>=24&&decisiveContact({
    own:assessment.own,enemy:assessment.enemy,visible:visible.length,
    inRange:inRange.length,healthy,knownTowers:towers.length,
    artillery:readyForce.filter(u=>u.kind==='artillery').length});
   if(decisive)battle.commitUntil=Math.max(battle.commitUntil??0,g.time+9);
   const holdLine=shouldCommitFirefight({
    own:assessment.own,enemy:assessment.enemy,visible:visible.length,
    inRange:inRange.length,healthy,knownTowers:towers.length,
    time:g.time,commitUntil:battle.commitUntil??0
   });
   // A route that spends hundreds of meters inside observed enemy gun
   // ranges is not a rescue. KI 3.6 stands and shoots instead of fleeing
   // backwards into free fire; older AI A/B controls remain unchanged.
   const front=centroid(members);
   const fallback=this.ai36Enabled&&continuing&&visible.length>0
    ?this.withdrawPoint(front,home,towers):undefined;
   const escapeSafe=fallback
    ?this.retreatSafe(front,fallback,visible,towers):true;
   const standGround=this.ai36Enabled&&fightInsteadOfFleeing({
    continuing,visible:visible.length,inRange:inRange.length,
    healthy,own:assessment.own,enemy:assessment.enemy,
    knownTowers:towers.length,escapeSafe
   });
   // Keep the tactical director's screening/flanking decisions when an
   // assault is already favoured; intercept only unwanted macro withdrawals.
   if((holdLine||standGround)&&(assessment.stance==='withdraw'||assessment.stance==='reinforce')){
    // AI 3.2 gives a proven local overmatch nine seconds instead of six.
    // A collapse below 32% of the actually observed enemy still disengages.
    if(assessment.own>=assessment.enemy*.48)
     battle.commitUntil=Math.max(battle.commitUntil??0,g.time+(decisive?9:6));
    for(const u of members){
     const candidates=visible.filter(v=>canAttack(u,v));
     const target=candidates.sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id)[0];
     if(!target){
      // Non-shooting escorts retain offensive movement rather than obeying
      // the previous safe retreat order while the screen is committed.
      if(u.orders[0]?.tactical?.mode==='safe')
       this.issue([u],mission,'assault',undefined,false,false);
      continue;
     }
     if(u.orders[0]?.target===target.id&&u.orders[0]?.tactical?.mode==='assault')continue;
     this.issue([u],target,'assault',target.id,false,false);
    }
    return;
   }
   if(assessment.stance==='withdraw'&&!overrun){
    const at=fallback??this.withdrawPoint(centroid(members),home,towers);
    recordFailure(battle,mission.sector,mission,assessment.own,towers.length,g.time);battle.retreats++;
    for(const u of members){this.issue([u],at,'safe',undefined,false,false);battle.withdrawals=battle.withdrawals.filter(w=>w.unit!==u.id);battle.withdrawals.push({...at,unit:u.id,since:g.time,until:g.time+10});}
    this.setPhase('regroup');s.group=[];campaignPhase(c,'buildup',g.time);return;
   }
   const allowed=retryFront(battle,mission.sector,assessment.own,towers.length,artillery,g.time);
   if((assessment.stance==='reinforce'||!allowed)&&!overrun){
    campaignPhase(c,'buildup',g.time);if(!continuing)this.setPhase('gather');
    stageForSiege();return;
   }
  }
  if(!continuing){
   const ready=selected.filter(u=>distance(u,s.rally!)<330),power=ready.reduce((n,u)=>n+combatStrength(u),0);
   const armed=ready.some(u=>u.kind==='artillery'||u.kind==='tank');
   const enough=towers.length?(overrun||assessment.stance==='attack'||assessment.stance==='siege'):defended?ready.length>=3&&power>=5&&(armed||!towers.length&&ready.length>=5):ready.length>=(g.time<40?1:2);
   const wave=this.waveMode==='coordinated'
     ?assaultWaveDecision({defended,selectedGround:selected.filter(u=>!unitSpec(u).flying).length,
        readyGround:ready.filter(u=>!unitSpec(u).flying).length,elapsed:g.time-s.phaseAt,
        selectedStrength:selected.filter(u=>!unitSpec(u).flying).reduce((n,u)=>n+combatStrength(u),0),
        readyStrength:ready.filter(u=>!unitSpec(u).flying).reduce((n,u)=>n+combatStrength(u),0),
        // A known gun requires a real artillery escort or proved overmatch.
        siegeSupported:!towers.length||ready.some(u=>u.kind==='artillery')||overrun,
        tempoPressure:this.battleDirective?.accelerateRally??false})
     :{ready:true,required:0,reason:'legacy'};
   if(enough&&!wave.ready)this.diagnostics.waveWaits++;
   const groundReady=ready.filter(u=>!unitSpec(u).flying).length;
   const guardBuildup=policy&&(
    observedHomePressure||g.time<policy.notBefore||
    groundReady<policy.minimumReady);
   if(this.rallyGateTraceEnabled){
    const last=this.rallyGateTrace.at(-1);
    if(last&&last.at===Math.round(g.time))last.wave={
      ready:ready.length,ground:groundReady,enough,
      waveReady:wave.ready,waveReason:wave.reason,
      guardBuildup:!!guardBuildup,minimumReady:policy?.minimumReady??0
    };
   }
   if(!enough||!wave.ready||guardBuildup){
    campaignPhase(c,g.time<40?'opening':defended?'buildup':'expansion',g.time);this.setPhase('gather');
    stageForSiege();return;
   }
   if(this.waveMode==='coordinated'&&defended)this.diagnostics.waveLaunches++;
   if(wave.reason==='combat-ready')this.diagnostics.combatReadyWaveLaunches++;
   if(!experience.active)experience.active={sector:mission.sector,tactic:overrun?'overrun':towers.length?'siege':'maneuver',guns:towers.length,force:ready.length,at:g.time,initialUnits:ready.length,initialHP:fighters.reduce((n,u)=>n+u.hp,0),progress:0,siegeWeapons:ready.filter(u=>u.kind==='artillery').length,objective:mission.objective,target:{x:mission.x,y:mission.y}};
   s.groupId++;s.group=ready.map(u=>u.id);s.launchSize=ready.length;s.launchedAt=g.time;members=ready;this.setPhase('attack');
  }
  const anchor=centroid(members),joining=selected.filter(u=>!s.group.includes(u.id));
  const frontlineContact=this.ai36Enabled&&visible.some(enemy=>
   members.some(u=>distance(u,enemy)<Math.max(410,unitSpec(enemy).range+80)));
  const staged=this.waveMode==='coordinated'
   ?reinforcementStagingPoint(anchor,mission,home):anchor;
  const rendezvous=this.waveMode==='coordinated'
   ?g.world.nearest(staged,this.obstacles(),[],undefined,12)??anchor:anchor;
  for(const u of joining){
   const nearFront=distance(u,anchor)<330||
    this.ai36Enabled&&ai36JoinActiveFront({
     distance:distance(u,anchor),hpFraction:u.hp/Math.max(1,unitSpec(u).hp),
     isGroundCombatant:combat(u)&&!unitSpec(u).flying,
     frontInContact:frontlineContact,frontSize:members.length,
     knownGunPresent:towers.length>0
    });
   if(nearFront){s.group.push(u.id);s.launchSize++;members.push(u);}
   else if(!u.orders.length||u.orders[0].tactical?.mode!=='assault'||distance(u.orders[0],rendezvous)>180){
    if(this.issue([u],rendezvous,'assault',undefined,false,false)&&this.waveMode==='coordinated')
      this.diagnostics.reinforcementStagingOrders++;
   }
  }
  const escorts=medics.filter(u=>distance(u,anchor)<360);
  for(const u of medics.filter(u=>!escorts.includes(u)))if(!u.orders.length||distance(u.orders[0],anchor)>160)this.issue([u],anchor,'safe',undefined,false,false);
  for(const u of escorts)if(!s.group.includes(u.id))s.group.push(u.id);
  const progress=Math.min(...members.map(u=>distance(u,mission)));
  if(progress<mission.distance-45){mission.distance=progress;mission.progressAt=g.time;}
  s.lastProgress=Math.max(0,progress);s.progressAt=mission.progressAt;
  campaignPhase(c,c.enemyHQEliminatedAt!==undefined||intel?.kind==='headquarters'?'endgame':intel?'siege':defended?'offensive':g.territories.filter(t=>t.owner===1).length<3?'expansion':'offensive',g.time);
  const group=[...members,...escorts];
  // Decide before legacy siege dispatch: the previous integration never got
  // here on turret objectives. Diagnosing that gate is as important as acting.
  const tacticalEnabled=g.world.mapVersion>=3&&this.mode==='director'&&this.planningMode==='tactical';
  const tactical:TacticalChoice|null=tacticalEnabled&&group.filter(combat).length>=3&&(visible.length>0||towers.length>0)
    ?chooseTacticalManeuver({allies:group,observedEnemies:visible,knownGuns:towers,storm:g.weather.storm,learned:{flank:lessonScore(experience,'flank',0,group.length),siege:lessonScore(experience,'siege',towers.length,group.length)}}):null;
  if(tactical){
    this.diagnostics.evaluated++;this.diagnostics.choices[tactical.mode]++;
    this.diagnostics.last={at:g.time,sector:mission.sector,allies:group.length,visible:visible.length,
      guns:towers.length,choice:tactical.mode,reason:tactical.reason};
  }
  const previousSquad=battle.squads.find(q=>q.role==='assault');
  battle.squads=[...battle.squads.filter(q=>q.role!=='assault'),{role:'assault',ids:group.map(u=>u.id),target:mission.objective,since:previousSquad?.target===mission.objective?previousSquad.since:g.time}];
  if(intel?.kind==='turret'&&this.siege(group,intel)){
    if(tactical)this.diagnostics.delegatedSieges++;
    return;
  }
  // A known battery can be a better immediate objective than rushing a
  // capture circle. Only previously observed towers enter this candidate set.
  if(tactical?.mode==='siege'&&towers.length>0&&members.some(u=>u.kind==='artillery')){
    const known=towers.slice().sort((a,b)=>distance(anchor,a)-distance(anchor,b)||a.id-b.id)[0];
    if(known&&this.siege(group,known)){this.diagnostics.issuedSieges++;return;}
  }
  // Never let the 4.1 cleanup roster size bypass the siege safety gate.
  // Seven ordinary infantry cannot substitute for a real artillery weapon.
  // Existing withdrawals, repairs and local-defense priorities remain active.
  if(holdForSiegeWeapon(intel?.kind,overrun,members.filter(u=>u.kind==='artillery').length)){
   campaignPhase(c,'buildup',g.time);this.issue(group,s.rally,'safe',undefined,false,false);return;
  }
  const ground=group.filter(u=>!unitSpec(u).flying);for(const u of ground)u.hold=false;
  const closeThreat=visible.filter(v=>members.some(u=>distance(u,v)<unitSpec(v).range+110)&&!['engineer','medic','scout'].includes(v.kind))
   .sort((a,b)=>{
     const danger=(enemy:Unit)=>unitSpec(enemy).damage/unitSpec(enemy).cooldown*
       (1+Math.min(2,group.filter(u=>['artillery','medic'].includes(u.kind)&&
         distance(u,enemy)<unitSpec(enemy).range+80).length)*.65);
     return danger(b)-danger(a)||a.hp-b.hp||a.id-b.id;
   })[0];
  // Stable waypoint queues keep a flank alive across three-second macro pulses.
  // Never redirect recovering units or units already ordered home by defense.
  const continuingFlank=tacticalEnabled?ground.filter(u=>isContinuingFlank(u.orders,s.groupId)):[];
  const activeFlankIds=new Set(continuingFlank.map(u=>u.id));
  const eligibleScreen=ground.filter(u=>!activeFlankIds.has(u.id));
  const screenIds=tacticalEnabled&&closeThreat?assignScreen(eligibleScreen,closeThreat):[];
  const screen=closeThreat?(tacticalEnabled
    ?eligibleScreen.filter(u=>screenIds.includes(u.id))
    :eligibleScreen.filter(u=>canAttack(u,closeThreat))):[];
  const screenSet=new Set(screen.map(u=>u.id));
  const mainUnits=ground.filter(u=>!screenSet.has(u.id)&&!activeFlankIds.has(u.id)
    &&(!tacticalEnabled||u.kind!=='medic'&&u.kind!=='engineer'));
  let newFlank:Unit[]=[];
  if(tactical?.mode==='flank'&&towers.length===0&&!continuingFlank.length){
    this.diagnostics.flankOpportunities++;
    const flankerIds=assignFlank(mainUnits,screenIds);
    if(flankerIds.length===2){
      const candidates=([-1,1] as const).map(side=>flankCandidate(anchor,mission,side))
        .filter(p=>p.x>40&&p.y>40&&p.x<g.world.size-40&&p.y<g.world.size-40
          &&g.world.walkable(p,this.obstacles(),15)&&this.danger(p)<3)
        .map(p=>({point:p,route:this.route(anchor,p)})).filter(c=>c.route.length>0)
        .sort((a,b)=>flankRouteScore(anchor,a.route,visible)-flankRouteScore(anchor,b.route,visible)
          ||a.point.x-b.point.x||a.point.y-b.point.y);
      const waypoint=candidates[0]?.point;
      if(waypoint){
        const assigned:Unit[]=[];
        for(const u of mainUnits.filter(u=>flankerIds.includes(u.id))){
          // The old safe/move leg prohibited return fire and exposed isolated
          // flankers to helpless losses. Fight on the way to the waypoint.
          const moved=this.issue([u],waypoint,'assault',undefined,false,false);
          const attacked=moved&&this.issue([u],mission,'assault',undefined,true,false);
          if(attacked){assigned.push(u);this.diagnostics.flankOrders++;}
          else if(moved)this.issue([u],mission,'assault',undefined,false,false);
        }
        newFlank=assigned;
        if(assigned.length===2){
          this.diagnostics.flankGroups++;
          if(experience.active?.sector===mission.sector&&experience.active.guns===0)experience.active.tactic='flank';
         }
        else this.diagnostics.flankNoRoute++;
      }else this.diagnostics.flankNoRoute++;
    }else this.diagnostics.flankNoSquad++;
  }
  if(closeThreat&&screen.length&&this.issue(screen,closeThreat,'assault',closeThreat.id)){
    if(tacticalEnabled)this.diagnostics.screenOrders+=screen.length;
  }
  const flanking=new Set([...newFlank,...continuingFlank].map(u=>u.id));
  const main=mainUnits.filter(u=>!flanking.has(u.id));
  if(this.issue(main,mission,'assault',mission.objective??undefined)&&tacticalEnabled)
    this.diagnostics.mainOrders+=main.length;
  // Escort medics keep the simulation's protected rear formation, rather
  // than receiving a direct attack against a visible close-range defender.
  if(tacticalEnabled)for(const medic of escorts)if(!medic.orders.length)
    this.issue([medic],s.rally??anchor,'safe',undefined,false,false);
  this.airSupport(members,closeThreat??mission,closeThreat?.id??mission.objective);
  this.counterMissileScreen(members,visible,mission);
  // Aircraft that have finished their flank route can keep the same mission.
  for(const u of members.filter(u=>unitSpec(u).flying&&!u.orders.length))this.issue([u],mission,'assault',mission.objective??undefined);
 }
 plan():void{
  if(!profiler)return this.planMeasured();const at=performance.now();try{this.planMeasured();}finally{profiler.record('ai',performance.now()-at);}
 }
 /** Finance opening units and send genuine infantry to reachable Bastions. */
 openingEconomy():void{
  const g=this.g;
  const modernOpening=g.world.mapVersion>=23&&g.time>=3;
  const legacyEarlyOpening=g.world.mapVersion===11&&
   this.earlyEconomyMode==='barracks-first'&&g.time>=2;
  if(this.mode!=='director'||(!modernOpening&&!legacyEarlyOpening)
   ||g.time>=RULES.aiOpeningDelay
   ||g.needsHeadquarters(1)||g.status!=='playing')return;
  const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier);
  developArmy(g,this.state,army,p=>this.danger(p));
  this.contestOpeningBastions();
 }
 /**
  * AI 3.0/3.4: contest nearby free Bastions before a full assault army
  * exists. AI 3.4 extends the paid opening to 8/16-Bastion maps: on these
  * maps 3.3 previously conceded every neutral objective before attacking.
  * A public player Bastion majority redirects a real two-soldier squad
  * to a reachable, observed-safe recapture. No unseen threat knowledge.
  */
 private contestOpeningBastions():Set<number>{
  const g=this.g,s=this.state;
  const adaptiveLarge=this.ai33Mode==='adaptive'&&
   (g.world.mapVersion===24||g.world.mapVersion===26);
  const openingLimit=adaptiveLarge?(g.world.mapVersion===24?210:255):145;
  if(this.mode!=='director'||g.world.mapVersion<23||
     !(g.territories.length===4||adaptiveLarge)||
     g.time>openingLimit||g.status!=='playing'){
    s.openingContests=[];return new Set();
  }
  const seen=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u));
  if(seen.some(u=>g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<550))){
   s.openingContests=[];return new Set(); // real invasion: preserve home defense
  }
  const ready=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&
   ['infantry','heavy','rover'].includes(u.kind)&&u.hp>=unitSpec(u).hp*.65&&
   u.defendUntil<=g.time&&!(s.recovering??[]).includes(u.id)&&
   !s.battle?.withdrawals.some(w=>w.unit===u.id&&w.until>g.time)&&
   !s.group.includes(u.id)).sort((a,b)=>a.id-b.id);
  const blue=g.territories.filter(t=>t.owner===0).length;
  const red=g.territories.filter(t=>t.owner===1).length;
  const large=adaptiveLarge
   ?mapBastionContestOpening(g.world.mapVersion,g.time,blue,red,ready.length)
   :null;
  const counter=large?.counter??(blue>=3&&red<=1&&g.time>=30&&ready.length>=5);
  const targets=g.territories.filter(t=>t.owner===-1||counter&&t.owner===0);
  const maxAssigned=large?.slots??(counter?2:ready.length>=3?2:ready.length?1:0);
  if(!targets.length||!maxAssigned){s.openingContests=[];return new Set();}
  const blockers=[...this.obstacles(),...g.bastionColliders()];
  const observedThreat=(t:typeof targets[number])=>
   g.memories[1].some(m=>m.owner===0&&m.hp>0&&(
    m.kind==='headquarters'&&m.territory===t.id||
    m.kind==='turret'&&distance(m,t.point)<670))||
   seen.some(u=>distance(u,t.point)<330);
  // This point is inside the 95-unit capture ring but well outside the
  // 3D Bastion's solid collider; validate a REAL walkable path to it.
  const approach=(u:Unit,t:typeof targets[number]):Point|undefined=>{
   const heading=Math.atan2(u.y-t.point.y,u.x-t.point.x);
   for(const delta of [0,.55,-.55,1.1,-1.1,1.65,-1.65,2.2,-2.2,Math.PI]){
    const angle=heading+delta;
    const p={x:t.point.x+82*Math.cos(angle),y:t.point.y+82*Math.sin(angle)};
    if(g.world.walkable(p,blockers,5)&&g.world.path(u,p,blockers,5).length)return p;
   }
  };
  s.openingContests=(s.openingContests??[]).filter(e=>
   ready.some(u=>u.id===e.unitId)&&targets.some(t=>t.id===e.sectorId)&&
   !observedThreat(g.territories[e.sectorId])).slice(0,maxAssigned);
  const reserved=new Set(s.openingContests.map(e=>e.unitId));
  // Keep assigned soldiers moving; do not reset their A* order every pulse.
  for(const e of s.openingContests){
   const u=ready.find(v=>v.id===e.unitId)!,t=g.territories[e.sectorId],o=u.orders[0];
   if(o?.kind==='attackMove'&&distance(o,t.point)<105)continue;
   const p=approach(u,t);
   if(p)g.command([u.id],{...p,kind:'attackMove'});
  }
  const free=ready.filter(u=>!reserved.has(u.id)&&
   (!u.orders.length||!u.orders[0].tactical));
  // Need a real two-soldier counterattack. Ordinary expansion can send one
  // scout first and a second independent scout when paid infantry exists.
  while(s.openingContests.length<maxAssigned&&free.length>=(counter?2:1)){
   const squad=free.splice(0,counter?2:1);
   const goals=targets.filter(t=>!observedThreat(t)&&
     (counter||!s.openingContests!.some(e=>e.sectorId===t.id)))
    .map(t=>({t,p:approach(squad[0],t)})).filter(x=>x.p)
    .sort((a,b)=>{
     const merit=(v:typeof a)=>
      distance(squad[0],v.p!)-v.t.income*8-
      (adaptiveLarge&&counter&&v.t.owner===0?700:0);
     return merit(a)-merit(b)||a.t.id-b.t.id;
    });
   const best=goals.find(x=>squad.every(u=>approach(u,x.t)));
   if(!best)break;
   for(const u of squad){
    const point=approach(u,best.t)!;
    if(g.command([u.id],{...point,kind:'attackMove'}))
     s.openingContests.push({unitId:u.id,sectorId:best.t.id,since:g.time});
   }
  }
  return new Set(s.openingContests.map(e=>e.unitId));
 }
 /** KI 3.6: a small genuine squad attacks ONE reachable blue-held Bastion
  * together and secures the capture circle. The main assault, the HQ guard,
  * construction, recovery and tactical emergency defense keep priority.
  * Only public ownership and actually SEEN defenders/guns are considered.
  * This transient mission never creates entities or changes save format. */
 private coordinatedRecapture(fighters:Unit[],home:Point):Set<number>{
  const g=this.g,s=this.state;
  if(!this.ai36Enabled||g.status!=='playing'){
   this.recaptureMission=null;return new Set();
  }
  const blue=g.territories.filter(t=>t.owner===0).length;
  const red=g.territories.filter(t=>t.owner===1).length;
  const visible=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
   u.kind!=='drone'&&g.canSee(1,u));
  const homeThreat=visible.some(u=>distance(u,home)<660);
  if(homeThreat){this.recaptureMission=null;return new Set();}
  const combatants=fighters.filter(u=>u.hp>0&&!u.carrier&&!u.hold&&
   u.defendUntil<=g.time&&['infantry','heavy','rover'].includes(u.kind)&&
   u.hp>=unitSpec(u).hp*.66&&!u.factoryService&&!u.airfieldService&&
   !(s.battle?.withdrawals.some(w=>w.unit===u.id&&w.until>g.time)));
  const sectorIsExposed=(t:typeof g.territories[number])=>
   t.owner===0&&t.neighbors.some(i=>g.territories[i]?.owner===1);
  const old=this.recaptureMission;
  if(old){
   const site=g.territories[old.sector];
   const squad=old.ids.map(id=>fighters.find(u=>u.id===id))
    .filter((u):u is Unit=>!!u&&u.hp>0&&!u.carrier);
   if(site&&squad.length>=2){
    if(site.owner===1){
     if(old.securedAt===null)old.securedAt=g.time;
     // Hold the *real* newly gained capture circle long enough to prevent
     // an immediate one-soldier recapture. Normal weapons, no buffs.
     for(const u of squad)if(distance(u,site.point)<125&&
       u.defendUntil<=g.time&&!u.hold)g.stop([u.id],true,true);
     if(g.time-old.securedAt<15)return new Set(squad.map(u=>u.id));
    }else if(sectorIsExposed(site)&&g.time-old.since<70){
     // Never reissue the same attack every 3-second macro pulse.
     // Retarget only if an old order genuinely disappeared.
     for(const u of squad)if(!u.orders.length&&!u.hold&&
       distance(u,site.point)>125){
      const p=g.world.nearest(site.point,this.obstacles(),[],u,5);
      if(p&&this.route(u,p).length)this.issue([u],p,'assault',undefined,false,false);
     }
     return new Set(squad.map(u=>u.id));
    }
   }
   if(site?.owner!==1)this.recaptureRetryAt=g.time+25;
   this.recaptureMission=null;
   if(g.time<this.recaptureRetryAt)return new Set();
  }
  // Active large-scale assaults retain their existing committed soldiers.
  // Reserve an actual HQ screen from those not already doing urgent work.
  const readiness=recaptureDetachmentSize({
   mapVersion:g.world.mapVersion,time:g.time,ownSectors:red,
   enemySectors:blue,eligible:combatants.length,homeUnderAttack:homeThreat,
   recentlyLost:g.territories.some(t=>t.id===s.experience?.lastLostSector&&
    t.owner===0)
  });
  if(!readiness)return new Set();
  const protectedCount=g.world.mapVersion===26?3:2;
  const protectedIds=new Set(combatants.slice()
   .sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id)
   .slice(0,protectedCount).map(u=>u.id));
  const available=combatants.filter(u=>!protectedIds.has(u.id)&&
   (s.phase!=='attack'||!s.group.includes(u.id)));
  if(available.length<readiness+2)return new Set();
  const knownBad=(t:typeof g.territories[number])=>
   s.knownTurrets.some(tower=>distance(tower,t.point)<tower.range+95)||
   g.memories[1].some(m=>m.owner===0&&m.hp>0&&(
    m.kind==='headquarters'&&m.territory===t.id||
    m.kind==='turret'&&distance(m,t.point)<700));
  // Visible contacts are genuine fog-limited observations; never use all
  // BLUE units to rank an unseen Bastion's defenses.
  const blockers=[...this.obstacles(),...g.bastionColliders()];
  const approach=(u:Unit,t:typeof g.territories[number],i:number):Point|undefined=>{
   const angle=Math.atan2(u.y-t.point.y,u.x-t.point.x);
   for(const spin of [0,.35,-.35,.72,-.72,1.4,-1.4,Math.PI]){
    const a=angle+spin+(i-1)*.15;
    const p={x:t.point.x+105*Math.cos(a),y:t.point.y+105*Math.sin(a)};
    if(g.world.walkable(p,blockers,5)&&
      g.world.path(u,p,blockers,5).length)return p;
   }
  };
  let best:{score:number;sector:number;squad:Unit[];points:Point[]}|null=null;
  const targets=g.territories.filter(t=>sectorIsExposed(t)&&!knownBad(t))
   .sort((a,b)=>Number(b.id===s.experience?.lastLostSector)-
    Number(a.id===s.experience?.lastLostSector)||b.income-a.income||a.id-b.id);
  for(const t of targets.slice(0,6)){
   const near=available.slice().sort((a,b)=>distance(a,t.point)-distance(b,t.point)||a.id-b.id);
   // On v3, a closer-looking soldier may be trapped on the wrong side of
   // a mountain wall. Prefer paid units with a shorter pass-aware approach.
   // World.path below still validates every selected unit's real route.
   const squad=g.world.generatorVersion===3
    ?rankTerrainRecaptureSquad(available,t.point,g.world.generated?.ridges??[],readiness)
    :near.slice(0,readiness);
   if(squad.length!==readiness)continue;
   const seen=visible.filter(u=>distance(u,t.point)<380);
   if(!recaptureThreatPermits(fightingPower(squad),fightingPower(seen),false))continue;
   const points=squad.map((u,i)=>approach(u,t,i));
   if(points.some(p=>!p))continue;
   const travel=squad.map((u,i)=>this.sampleRoute(
     g.world.path(u,points[i]!,blockers,5),u));
   if(travel.some(t=>t.length===0||t.length>(g.world.mapVersion===26?2500:1900)||
     t.risk>=12))continue;
   const average=travel.reduce((n,v)=>n+v.length,0)/travel.length;
   const risk=Math.max(...travel.map(v=>v.risk));
   const score=recaptureObjectiveScore({routeLength:average,routeRisk:risk,
    income:t.income,recentLoss:t.id===s.experience?.lastLostSector,
    visibleDefenders:seen.length,alreadyAssigned:false});
   if(!best||score<best.score||score===best.score&&t.id<best.sector)
    best={score,sector:t.id,squad,points:points as Point[]};
  }
  if(!best)return new Set();
  // Issue in ONE macro pulse. Keep the detachment out of the ongoing
  // campaign roster; an attack-move can fight but cannot teleport.
  s.group=s.group.filter(id=>!best!.squad.some(u=>u.id===id));
  const sent:Unit[]=[];
  for(const [i,u] of best.squad.entries()){
   if(this.issue([u],best.points[i],'assault',undefined,false,false)){
    if(u.orders[0])u.orders[0].guardOnArrival=true;
    sent.push(u);
   }
  }
  if(sent.length!==readiness)return new Set(sent.map(u=>u.id));
  this.recaptureMission={sector:best.sector,ids:sent.map(u=>u.id),
   since:g.time,securedAt:null};
  return new Set(sent.map(u=>u.id));
 }
 /** Opening uses ordinary paid construction and reachable worker orders. */
 private bootstrapHeadquarters():void{
  const g=this.g,workers=g.units.filter(u=>u.owner===1&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
  if(!workers.length)return;
  const site=g.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&b.hp>0);
  if(site){
   for(const w of workers)if(w.orders[0]?.kind!=='build'||w.orders[0]?.target!==site.id)
    g.command([w.id],{...site,kind:'build',target:site.id});
   return;
  }
  for(const p of g.headquartersCandidates(1))if(!g.buildError(1,'headquarters',p)&&g.build(1,'headquarters',p,workers.map(w=>w.id)))return;
  // The start anchor remains a sensible deterministic AI preference, not a build restriction.
  // Explore fallback positions when terrain or a unit blocks local candidates.
  for(const p of g.headquartersCandidates(1))if(g.world.walkable(p,g.obstacles(),12)&&!g.hasExplored(1,p)){
   const w=workers[0];if(!w.orders.length&&g.world.path(w,p,g.obstacles(),12).length)g.command([w.id],{...p,kind:'move'});
   if(w.orders.length)return;
  }
 }
 private planMeasured():void{
  if(this.g.needsHeadquarters(1)){
   this.bootstrapHeadquarters();
   this.contestOpeningBastions(); // starting infantry travels while HQ is under construction
   return;
  }
  const g=this.g,s=this.state;this.observe();s.lastPlan=g.time;s.losses=s.losses.filter(l=>g.time-l.at<90);s.attempts=s.attempts.filter(a=>a.until>g.time||a.losses>0).slice(-30);const signature=JSON.stringify([s.knownTurrets.map(t=>[t.id,t.x,t.y,Math.floor((g.time-t.seenAt)/30)]),s.losses.map(l=>[l.id,Math.floor((g.time-l.at)/15)]),g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)).map(u=>[u.id,u.kind,u.x,u.y,u.hp]),this.obstacles().map(o=>[o.x,o.y,o.radius])]);
  if(signature!==this.routeSignature||this.routeCache.size>128){this.routeCache.clear();this.routeSignature=signature;}this.field();
  const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier),home=g.bases.filter(b=>b.owner===1&&b.hp>0).sort((a,b)=>(a.kind==='headquarters'?0:1)-(b.kind==='headquarters'?0:1)||a.id-b.id)[0]??g.territories.find(t=>t.owner===1)?.point??army[0];
  if(!home)return;
  if(g.world.mapVersion>=3&&this.mode==='director')observeOwnedLosses(s.experience??=newExperience(),g.territories.filter(t=>t.owner===1).map(t=>t.id),army.filter(combat).length);
  if(g.world.mapVersion>=3&&this.mode==='director')updateAdaptive(g,s.adaptive??=newAdaptive(),home,s.losses,s.battle);
  // Battle Director reads only PUBLIC Bastion ownership and enemies in
  // actual AI vision. It changes attack tempo, not fog, units or credits.
  if(this.ai36Enabled&&g.world.mapVersion>=23){
   const ownBastions=g.territories.filter(t=>t.owner===1).length;
   const enemyBastions=g.territories.filter(t=>t.owner===0).length;
   const soldiers=army.filter(combat);
   const contact=g.units.some(enemy=>enemy.owner===0&&enemy.hp>0&&
    !enemy.carrier&&enemy.kind!=='drone'&&g.canSee(1,enemy)&&
    (soldiers.some(u=>distance(u,enemy)<520)||
     g.territories.some(t=>t.owner===1&&distance(t.point,enemy)<280)));
   const homeThreat=g.units.some(enemy=>enemy.owner===0&&enemy.hp>0&&
    !enemy.carrier&&g.canSee(1,enemy)&&distance(enemy,home)<560);
   this.battleDirective=battleDirectorPulse({
    time:g.time,owns:ownBastions,enemyOwns:enemyBastions,
    bastions:g.territories.length,frontContact:contact,
    lastLaunchAt:s.launchedAt,
    readyFighters:soldiers.filter(u=>u.hp>=unitSpec(u).hp*.4).length,
    recentLosses:s.losses.filter(l=>g.time-l.at<35).length,
    homeThreat
   },s.battleDirector);
   s.battleDirector=this.battleDirective.state;
  }else this.battleDirective=undefined;
  const recovering=this.recovery(army,home);if(g.world.mapVersion>=3&&this.mode==='director')for(const id of this.withdrawals(army))recovering.add(id);
  const staffing=this.staffBunkers(army,home);
  this.airlift(army.filter(u=>!staffing.has(u.id)),home);
  const explorers=this.recon(army.filter(u=>!recovering.has(u.id)&&!staffing.has(u.id)),home),
   boarding=new Set([...army.filter(u=>u.orders[0]?.kind==='board').map(u=>u.id),
    ...(s.airlift?.phase==='pickup'?s.airlift.passengers??[]:[])]),
   fighters=army.filter(u=>combat(u)&&!recovering.has(u.id)&&
    !explorers.has(u.id)&&!boarding.has(u.id)&&!staffing.has(u.id)),
   medics=army.filter(u=>u.kind==='medic'&&!recovering.has(u.id)&&
    !boarding.has(u.id)).slice(0,2);
  developArmy(g,s,army,p=>this.danger(p));
  const earlyContesters=this.contestOpeningBastions();
  for(const w of army.filter(u=>u.kind==='engineer'&&!u.orders.length)){const b=g.bases.filter(b=>b.owner===1&&b.hp>0&&b.hp<buildingSpec(b).hp&&b.buildRemaining<=0).sort((a,b)=>distance(w,a)-distance(w,b))[0];if(b)g.command([w.id],{...b,kind:'repair',target:b.id});}
  const ownedBastions=g.territories.filter(t=>t.owner===1);
  // Protect captured Bastions as well as production. Only enemies physically
  // VISIBLE to RED can trigger it. The threat must approach the actual
  // capture circle, not merely occupy another sector behind the fog.
  const intruders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&
   (g.bases.some(b=>b.owner===1&&b.hp>0&&distance(u,b)<(b.kind==='headquarters'?560:420))
    ||ownedBastions.some(t=>distance(u,t.point)<260)));
  if(g.world.mapVersion>=3&&this.mode==='director'){
   const defense=this.localDefense(fighters,medics,intruders,home);
   // Earlier paid raids follow the shorter home-defense buildup.
   // Preserve an uncontested initial setup and never strip emergency
   // defenders; expansionRaid independently checks actual safe sectors.
   const recapture=this.coordinatedRecapture(fighters.filter(u=>
    !defense.has(u.id)&&!earlyContesters.has(u.id)),home);
   const raiders=g.world.mapVersion>=19&&g.time<125&&
    !this.battleDirective?.allowEarlyRaid
    ?new Set<number>():this.expansionRaid(fighters.filter(u=>
     !defense.has(u.id)&&!earlyContesters.has(u.id)&&!recapture.has(u.id)),home);
   const main=fighters.filter(u=>!defense.has(u.id)&&!raiders.has(u.id)&&
    !earlyContesters.has(u.id)&&!recapture.has(u.id));
   if(main.length)this.campaign(army,main,medics.filter(u=>!defense.has(u.id)),home);
   this.dispatchObservedSpecialists(army);
   this.supportBombers(army,home);
   if(defense.size)campaignPhase(s.commander??=newCampaign(),'emergencyDefense',g.time);
   return;
  }
  if(intruders.length){
   // Anti-siege defence: a rocket launcher or aircraft threatening the HQ is
   // more urgent than a slightly closer infantryman. Never use unseen threats.
   const urgency=(u:Unit)=>distance(u,home)-(u.kind==='artillery'?260:u.kind==='bomber'?220:0);
   if(g.world.mapVersion>=3&&this.mode==='director')campaignPhase(s.commander??=newCampaign(),'emergencyDefense',g.time);
   const entering=s.phase!=='defend';this.setPhase('defend');const nearest=intruders.sort((a,b)=>urgency(a)-urgency(b)||a.id-b.id)[0];
   if(entering||s.objective!==nearest.id)s.groupId++;s.group=fighters.map(u=>u.id);s.objective=nearest.id;this.issue([...fighters,...medics],nearest,'defend',nearest.id);return;
  }
  if(s.phase==='defend'){g.stop(s.group.filter(id=>!recovering.has(id)));this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;}
  if(s.phase==='attack'){this.raid(fighters);this.reinforce(fighters,home);}
  const members=army.filter(u=>s.group.includes(u.id)&&!recovering.has(u.id)),survivors=members.filter(combat);
  const recentLosses=s.losses.filter(l=>g.time-l.at<24&&s.group.includes(l.id));
  const cluster=s.losses.some(l=>g.time-l.at<90&&s.losses.filter(v=>g.time-v.at<90&&distance(l,v)<320).length>=2);
  if(s.phase==='attack'){
   const target=s.target===null?undefined:g.territories[s.target],progress=target&&survivors.length?Math.min(...survivors.map(u=>distance(u,target.point))):0;
   if(progress<s.lastProgress-60){s.lastProgress=progress;s.progressAt=g.time;}
   const objective=s.objective===null?undefined:g.bases.find(b=>b.id===s.objective&&g.canSee(1,b));
   const objectiveGone=s.objective!==null&&(!s.knownTurrets.some(t=>t.id===s.objective)&&!g.memories[1].some(m=>m.id===s.objective&&m.hp>0));
   if(objectiveGone&&target){s.objective=null;this.issue(members,target.point,'assault');s.progressAt=g.time;return;}
   const safeBroken=members.some(u=>u.orders[0]?.tactical?.mode==='safe'&&(this.danger(u.orders[0])>5||this.sampleRoute(u.path,u).risk>8));
   const tooWeak=g.world.mapVersion>=3&&this.mode==='director'
    ? abortAssault({launchSize:s.launchSize,survivors:survivors.length,recentLosses:recentLosses.length,
       stalledSeconds:g.time-s.progressAt,knownUncoveredTurret:safeBroken&&s.knownTurrets.length>0,
       hasSiegeWeapon:survivors.some(u=>u.kind==='artillery'),destinationStillContested:!!target&&target.owner!==1})!==null
    :!target||target.owner===1||survivors.length===0||recentLosses.length>=2||
       survivors.length<s.launchSize*.6||g.time-s.progressAt>(g.world.mapVersion>=3?85:38)||safeBroken;
   if(tooWeak){
    g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.objective=null;s.rally=null;
   }else{
    // A revealed tower along a previously safe approach triggers reevaluation before further marching.
    const next=members.find(u=>u.orders[0]?.tactical?.mode==='safe')?.orders[0];
    if(next&&s.knownTurrets.some(t=>distance(t,next)<t.range+65)){g.stop(members.map(u=>u.id));this.setPhase('regroup');s.group=[];s.rally=null;}
    else if(objective?.kind==='turret'&&this.siege(members,objective))return;
    else if(target&&members.some(u=>!u.orders.length)){this.issue(members,target.point,g.world.mapVersion>=3&&this.mode==='director'?'assault':s.knownTurrets.some(t=>distance(t,target.point)<t.range+80)?'assault':'safe',objective?.id);return;}
    else return;
   }
  }
  if(!s.rally||this.danger(s.rally)>2)s.rally=this.rally(fighters,home);
  const reserve=fighters.length>=8?2:fighters.length>=5?1:0;
  const available=fighters.slice().sort((a,b)=>distance(b,home)-distance(a,home)||a.id-b.id).slice(0,fighters.length-reserve);
  const selected=available.sort((a,b)=>distance(a,s.rally!)-distance(b,s.rally!)||a.id-b.id).slice(0,10);
  // Ownership adjacency no longer gates capture; let route, observed risk and
  // travel costs prioritize reachable objectives, including deeper strikes.
  const targets=g.territories.filter(t=>canCaptureSector(g.territories,t,1,g.world.mapVersion));
  // Once real paid long-range siege weapons are available, towers should be
  // objectives rather than near-absolute forbidden zones. The risk field still
  // applies, but the score reflects the weapon's standoff advantage.
  const siegeAvailable=selected.some(u=>u.kind==='artillery'&&u.hp>0);
  const ranked=targets.map(t=>{
   const loss=s.attempts.find(a=>a.sector===t.id),route=this.route(s.rally!,t.point),travel=this.sampleRoute(route,s.rally!);
   const towers=s.knownTurrets.filter(b=>distance(b,t.point)<b.range+85||route.some((p,i)=>segmentDistance(b,i?route[i-1]:s.rally!,p)<b.range+40));
   const defenders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&distance(u,t.point)<420).reduce((n,u)=>n+combatStrength(u),0);
   const knownHQ=g.memories[1].find(m=>m.owner===0&&m.kind==='headquarters'&&m.territory===t.id&&m.hp>0);
   const knownIndustry=g.memories[1].find(m=>m.owner===0&&['factory','airfield','barracks'].includes(m.kind??'')&&m.territory===t.id&&m.hp>0);
   // Sector ownership is already part of strategic target selection. Press
   // toward the opposing front instead of clearing every remote neutral first;
   // hidden units/buildings still contribute no strength or threat information.
   const owned=g.territories.filter(t=>t.owner===1).length;
   const pressure=owned>=(g.world.mapVersion>=3?Math.max(1,Math.floor(g.territories.length/4)):4)?(t.owner===0?2000:t.neighbors.some(i=>g.territories[i].owner===0)?1200:0):0;
   const siegeRoute=siegeAvailable&&towers.length>0;
   return {t,route,...travel,towers,knownHQ,knownIndustry,defenders,score:travel.length+travel.risk*(siegeRoute?40:75)+towers.length*(siegeRoute?260:700)+defenders*130+(loss&&loss.until>g.time?900+loss.losses*180:0)-t.income*16-t.neighbors.filter(i=>g.territories[i].owner!==1).length*45-pressure-(knownIndustry?300:0)};
  }).filter(c=>c.route.length);
  // Legacy maps still permit remote capture as a physical rule, but their
  // tactical AI must attack a reachable connected front first. Otherwise a
  // newly neutral pocket near its own HQ can replace the actual assault
  // objective and prematurely trigger regrouping. If no connected route is
  // available, keep the free-capture fallback rather than deadlocking.
  const frontier=g.world.mapVersion<=2
   ?ranked.filter(c=>c.t.neighbors.some(id=>g.territories[id]?.owner===1))
   :[];
  const candidates=(frontier.length?frontier:ranked).sort((a,b)=>a.score-b.score||a.t.id-b.t.id);
  if(!candidates.length){this.strategyOptions=[];this.setPhase('regroup');this.issue([...selected,...medics],s.rally,'safe');return;}
  this.strategyOptions=candidates.slice(0,4).map(c=>({sectorId:c.t.id,owner:c.t.owner===0?'enemy':'neutral',
   score:c.score,travel:c.length,routeRisk:c.risk,defenders:c.defenders,turrets:c.towers.length,income:c.t.income}));
  const advised=this.sectorPreference&&this.sectorPreference.until>=g.time
   ?candidates.slice(0,4).find(c=>c.t.id===this.sectorPreference!.sectorId&&c.score-candidates[0].score<=700):undefined;
  const c=advised??candidates[0];s.target=c.t.id;s.route=c.route.slice(0,64);
  const defended=c.towers.length>0||c.defenders>2||c.knownHQ!==undefined||c.knownIndustry!==undefined||c.risk>12;
  // A late reserve may be taking a long route out of newly built facilities.
  // Three ready fighters can take an unguarded sector after a bounded wait;
  // defended objectives retain their full assault-strength requirements.
  const ready=selected.filter(u=>distance(u,s.rally!)<(g.world.mapVersion>=3?260:200)),need=defended?(ready.some(u=>u.kind==='artillery')&&c.towers.length?4:6):g.time-s.phaseAt>=18?3:4,power=ready.reduce((n,u)=>n+combatStrength(u),0);
  const scoutAllowed=!defended&&!cluster&&fighters.length<4&&(g.time<40||g.time-s.phaseAt>35);
  const enough=g.world.mapVersion>=3&&this.mode==='director'
   ?assaultDecision({defended,observedTowers:c.towers.length,hasArtillery:ready.some(u=>u.kind==='artillery'),
     visibleDefenderStrength:c.defenders,readyUnits:ready.length,readyStrength:power,
     phaseSeconds:g.time-s.phaseAt,inRegroup:s.phase==='regroup',
     clusteredRecentLosses:cluster,scoutingOpening:scoutAllowed}).launch
   :!(s.phase==='regroup'&&g.time-s.phaseAt<9)&&((ready.length>=need&&power>=(defended?Math.max(6,c.towers.length*4.5+c.defenders*.8):3))||(scoutAllowed&&ready.length>0));
  if(!enough){
   if(s.phase!=='regroup')this.setPhase('gather');
   const waiting=selected.filter(u=>distance(u,s.rally!)>60||!u.orders.length||u.orders[0]?.tactical?.mode!=='safe');this.issue([...waiting,...medics],s.rally,'safe');
   // A weak force can investigate the safe perimeter rather than wait forever or rush a gun.
   if(defended&&g.time-s.phaseAt>40){
    let vantage:Point|undefined,from=s.rally;
    for(const to of c.route){const d=distance(from,to),steps=Math.max(1,Math.ceil(d/70));for(let i=1;i<=steps;i++){const p={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(this.danger(p)<2&&g.world.walkable(p,this.obstacles(),15))vantage=p;else break;}if(this.danger(to)>=2)break;from=to;}
    if(vantage&&distance(vantage,s.rally)>120){s.rally=vantage;this.setPhase('regroup');s.phaseAt=g.time;this.issue([...selected,...medics],vantage,'safe');}
   }
   return;
  }
  const frontline=g.world.mapVersion>=3?ready.slice().sort((a,b)=>(b.kind==='tank'?5:b.kind==='artillery'?4:b.kind==='heavy'?3:1)-(a.kind==='tank'?5:a.kind==='artillery'?4:a.kind==='heavy'?3:1)||a.id-b.id):ready;
  const group=[...frontline.slice(0,defended?10:6),...medics.filter(u=>distance(u,s.rally!)<240)];s.group=group.map(u=>u.id);s.groupId++;s.launchSize=group.filter(combat).length;s.launchedAt=g.time;s.lastProgress=distance(s.rally,c.t.point);s.progressAt=g.time;this.setPhase('attack');
  const obstacle=defended?c.towers.slice().sort((a,b)=>distance(s.rally!,a)-distance(s.rally!,b))[0]??c.knownHQ??c.knownIndustry:undefined;
  s.objective=obstacle?.id??null;
  if(obstacle){this.issue(group,obstacle,'assault',obstacle.id);if(c.towers.some(t=>t.id===obstacle.id)&&this.siege(group,obstacle))return;this.airSupport(group,obstacle,obstacle.id);}
  else {this.issue(group,c.t.point,g.world.mapVersion>=3&&this.mode==='director'?'assault':'safe');this.airSupport(group,c.t.point,null);}
 }
 static valid(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):raw is TacticalState{
  if(raw===undefined)return true;const s=raw as TacticalState,finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v),ids=(v:unknown)=>Array.isArray(v)&&v.length<=96&&v.every(Number.isInteger);
  if(!validCampaign(s?.commander,time,point,sectors))return false;
  if(!validBattleDirector(s?.battleDirector,time,sectors))return false;
  if(!validBattle(s?.battle,time,point,sectors))return false;
  if(!validAdaptive(s?.adaptive,time))return false;
  if(!validExperience(s?.experience,time,sectors,point))return false;
  return !!s&&(s.openingContests===undefined||
   (Array.isArray(s.openingContests)&&s.openingContests.length<=4&&s.openingContests.every(c=>
    Number.isInteger(c.unitId)&&c.unitId>=0&&Number.isInteger(c.sectorId)&&
    c.sectorId>=0&&c.sectorId<sectors&&finite(c.since)&&c.since>=0&&c.since<=time+.001)))&&(s.airliftAt===undefined||(finite(s.airliftAt)&&s.airliftAt>=0&&s.airliftAt<=time+.001))&&(s.airlift===undefined||(!!s.airlift&&(s.airlift.passengers===undefined||(ids(s.airlift.passengers)&&s.airlift.passengers.length<=5))&&Number.isInteger(s.airlift.heli)&&s.airlift.heli>=0&&point(s.airlift.target)&&['pickup','delivery'].includes(s.airlift.phase)&&finite(s.airlift.since)&&s.airlift.since>=0&&s.airlift.since<=time+.001))&&(s.recovering===undefined||ids(s.recovering))&&validEconomy(s.economy,time)&&s.version===1&&['gather','attack','regroup','defend'].includes(s.phase)&&[s.phaseAt,s.launchedAt,s.progressAt].every(v=>finite(v)&&v>=0&&v<=time+.001)&&finite(s.lastPlan)&&s.lastPlan>=-3&&s.lastPlan<=time+.001&&finite(s.lastProgress)&&s.lastProgress>=0&&[s.groupId,s.launchSize,s.productionSerial].every(v=>Number.isInteger(v)&&v>=0)&&ids(s.group)&&(s.savingSince===null||(finite(s.savingSince)&&s.savingSince>=0&&s.savingSince<=time+.001))&&(s.savingFor===null||Object.hasOwn(UNITS,s.savingFor))&&(s.target===null||(Number.isInteger(s.target)&&s.target>=0&&s.target<sectors))&&(s.objective===null||Number.isInteger(s.objective))&&(s.rally===null||point(s.rally))&&Array.isArray(s.route)&&s.route.length<=64&&s.route.every(point)&&Array.isArray(s.knownTurrets)&&s.knownTurrets.length<=64&&s.knownTurrets.every(t=>point(t)&&Number.isInteger(t.id)&&finite(t.hp)&&t.hp>0&&finite(t.range)&&t.range===RULES.turret.range&&finite(t.seenAt)&&t.seenAt>=0&&t.seenAt<=time+.001)&&Array.isArray(s.losses)&&s.losses.length<=96&&s.losses.every(l=>point(l)&&Number.isInteger(l.id)&&finite(l.at)&&l.at>=0&&l.at<=time+.001&&finite(l.strength)&&l.strength>=0)&&Array.isArray(s.attempts)&&s.attempts.length<=sectors&&s.attempts.every(a=>Number.isInteger(a.sector)&&a.sector>=0&&a.sector<sectors&&Number.isInteger(a.losses)&&a.losses>=0&&finite(a.until)&&a.until>=0);
 }
}
