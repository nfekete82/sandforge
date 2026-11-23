import {BATTLEFIELD_GENERATOR,battlefieldStart,isTerrainProfile,type TerrainProfile,type BattlefieldGeneratorVersion} from './battlefield-terrain.js';
import {Weather} from './weather.js';
import {gainUnitXp,getVeterancyModifiers,sanitizeXp,XP_RULES} from './veterancy.js';
import {unitShotRoll,unitShotMisses,missedGroundPoint} from './unit-accuracy.js';
import {migrateTransportRoster} from './roster-migration.js';
import {VisionCache} from './vision-cache.js';
import {generateRollingHills,standsOnHill,HIGH_GROUND_SIGHT_MULTIPLIER,type RollingHill} from './rolling-hills.js';
import { profiler } from './performance.js';
import { RULES, WEATHER_RULES, clamp, distance, type Faction, type Owner, type Point, type MapVersion, mapLayout, campaignLayout, mapWorldSize } from './config.js';
import { World, inside, type Territory } from './world.js';
import {visibleBasePropColliders} from './vehicle-decor-collision.js';
import {vehicleStructureCollider,vehicleStructureColliders} from './vehicle-structure-collision.js';
import {infantryStructureCollider,infantryStructureColliders} from './infantry-structure-collision.js';
import {wallColliderSamples,wallTerrainPlacementError,isWallLike,navigableBasesForFaction,friendlyGatePostColliders,WALL_GATE_UPGRADE_COST} from './defensive-wall.js';
import {bastionStructureColliders} from './bastion-structure-collision.js';
import {constructionVisualClearance,sitesVisuallyOverlap,siteNearBastion,siteExceedsMap,siteTerrainCompatible,type SiteFacing} from './construction-spacing.js';
import {segmentDistance} from './world-generation.js';
import {canCaptureSector,captureSeconds,capturePresenceRadius} from './territory-warfare.js';
import { UNITS, BUILDINGS, TANK_MG, canAttack, weaponDamage, unitSpec, buildingSpec, unitKinds, MAX_GENERATORS_PER_FACTION, type UnitKind, type BuildingKind } from './catalog.js';
import {angleDifference,turnTowards} from './sprite-animator.js';
import {newMatchStatistics,countDeployed,countProduced,countIncome,validMatchStatistics,type MatchStatistics} from './match-statistics.js';
import {turretPivot,turretMuzzles} from './turret.js';
import {Transports,type TransportState} from './transports.js';
import {BUNKER_CAPACITY,bunkerApproach,bunkerCanBoard,bunkerGarrisonedUnits,bunkerTargetRange,bunkerExitPoints,validBunkerGarrisons} from './bunker-garrison.js';
import {BASTION_UPGRADE_COST,bastionEffectiveIncome,bastionUpgradable,validBastionUpgradeState} from './bastion-upgrades.js';
import {ai37FortificationChoice,ai37UpgradeScore} from './ai37-fortification-doctrine.js';
import {ai38InfrastructurePlan} from './ai38-investment-doctrine.js';
import {selectDesertAIDoctrine} from './desert-ai-doctrine.js';
import {ai38VehicleRecoveryWaypoint,ai38CanRecoverVehicle,ai39NoPathRecoveryWaypoint} from './ai38-vehicle-navigation.js';
import {TacticalAI,type TacticalState,type TacticalOrder} from './tactical-ai.js';
import { MAP_VERSION, randomMapSeed } from './world-generation.js';
import {beginBomberOrbit,advanceBomberOrbit,validBomberOrbit,BOMBER_ORBIT_SPEED,preservesCaptureBoundary,safeOrbitApproach,isOnBomberOrbit,bastionCaptureOrbit,approachBastionCaptureOrbit,type BomberOrbit} from './bomber-orbit.js';
import {bomberAttackWaypoints,BOMBER_BOMB_RELEASE_DISTANCE,BOMBER_RUN_WAYPOINT_DISTANCE,BOMBER_BOMB_FALL_SECONDS,steerBomberArc,type BomberAttackRun} from './bomber-attack.js';
import {AttackAlerts} from './attack-alerts.js';
import {airfieldPoint,airfieldLerp,airfieldTaxiPoint,validAirfieldService,AIRFIELD_BAYS,AIRFIELD_REPAIR_HP_PER_CREDIT,AIRFIELD_REPAIR_FRACTION_PER_SECOND,AIRFIELD_LANDING_SECONDS,AIRFIELD_TAXI_SECONDS,AIRFIELD_TAKEOFF_SECONDS,type AirfieldService} from './airfield-maintenance.js';
import {validFactoryService,type FactoryService} from './factory-maintenance.js';
import {factoryDoorExitCandidates,infantryDoorExitCandidates} from './production-exit.js';
import {eliminationOutcome} from './match-outcome.js';
import {perPlayerSlots} from './multiplayer-faction-runtime.js';
import {resolveTeamCapturePresence} from './multiplayer-faction-rules.js';
// Only legacy save validation uses supply types; no active logistics controller.
import {validSupplyJob,SUPPLY_RESTOCK_INTERVAL,type SupplyCache,type SupplyJob} from './legacy-supply-save.js';
import {formationSlotPitch,vehicleSpacingGap,preservesVehicleProgress,vehicleYieldWaypoint} from './vehicle-spacing.js';
import {rocketStandoffPoint,shouldRocketReposition} from './combat-movement.js';
import {SCOUT_ROCKETS,scoutRocketDamage,scoutRocketReady} from './scout-rockets.js';
import {ai36AirDoctrineEnabled} from './ai36-air-support.js';
import {UPGRADES,UPGRADE_KINDS,newResearchState,canResearchUpgrade,researchModifiers,
 validResearchState,strategicBlastDamage,validStrategicMissile,
 SILO_CHARGE_SECONDS,STRATEGIC_WARNING_SECONDS,STRATEGIC_BLAST_RADIUS,
 INTERCEPTOR_ENABLED,INTERCEPTOR_MAX_AMMO,INTERCEPTOR_REARM_COST,INTERCEPTOR_RANGE,
 type UpgradeKind,type ResearchState,type StrategicMissile,type StrategicEvent}
 from './strategic-tech.js';

export interface Formation {front:number[];fallback?:number[];heading:Point;origin:Point;goal:Point;lane:number;rear:number}
export interface Order extends Point { kind:'move'|'attackMove'|'attack'|'heal'|'repair'|'build'|'board'|'garrison'; target?:number; approach?:Point; healOrigin?:Point; formation?:Formation; march?:number[]; rear?:number; tactical?:TacticalOrder; guardOnArrival?:boolean }
export type Weapon='rifle'|'heavy'|'pistol'|'turret'|'cannon'|'rocket'|'machinegun'|'bomb';
export interface Burst {target:number;remaining:number;at:number;index:number}
export interface WorkEffect {kind:'heal'|'repair'|'build'|'board';target:number;source:number;sources:number[];at:number;amount:number}
export const HEAL_RADIUS=70;
export const REPAIR_RADIUS=90;
export const REPAIR_RATE=18;
export interface Unit extends Point {
  id:number; owner:Faction; kind:UnitKind; xp?:number; hp:number; orders:Order[]; path:Point[];
  cooldown:number; mgCooldown?:number; rocketCooldown?:number; rocketAmmo?:number; facing:number; moving:boolean; hit:number; repath:number;
  angle:number; walkDistance:number; fire:number; previousX:number; previousY:number;
  lastAttacker:number|null; defendUntil:number;
  /** Optional motor state keeps version-2 saves compatible. */
  driveSpeed?:number; hullAngle?:number; combatTarget?:number|null;
  /** Optional true-position orbit for idle bombers; round-trips with older saves. */
  idleOrbit?:BomberOrbit;
  /** Deterministic flyover / wide-loop state for repeated ground bombing runs. */
  bomberRun?:BomberAttackRun;
  /** Return-to-base order / two-bay hangar service, included in v2 saves. */
  airfieldService?:AirfieldService;
  /** Opt-in automatic return below 30% HP. */
  autoAirfieldRepair?:boolean;
  /** Explicit RETURN TO BASE while damaged and the single hangar is occupied.
   * Retry until a real airfield service slot opens; saved with the unit. */
  returnToHangar?:boolean;
  /** Physical front-apron maintenance; independently serialized. */
  factoryService?:FactoryService;
  autoFactoryRepair?:boolean;
  /** A real collision enabled complete clearance checks for future routes. */
  exactPath?:boolean;
  /** Active only when a strict visual-clearance route genuinely cannot be found. */
  vehicleEscape?:'exit'|'last-resort';
  /** Where an autonomous pursuit began; persisted so guards do not chase indefinitely. */
  pursuitOrigin?:Point|null;
  hold?:boolean;
  /** Explicit STOPP/return-base guard stance: attack in weapon range, never pursue. */
  guardArea?:boolean;
  workingTarget?:number|null;
  supportPaused?:boolean;
  burst?:Burst;
  /** Optional logistics state: no inventory or virtual income for combat units. */
  supply?:SupplyJob;
  carrier?:number;flightHeight?:number;transport?:TransportState;
}
export interface Base extends Point {
  id:number; owner:Faction; kind:BuildingKind; hp:number; territory:number; queue:number[]; queueTypes:UnitKind[]; production:number;
  buildRemaining:number; cooldown:number;
  rally:Point|null; radius:number;
  /** Building façade orientation. Backward compatible: 0=0°, 1=180° (legacy),
   * 2=90°, 3=270°. Absent is the original classic facing. */
  facing?:0|1|2|3;
  /** Two ordinary 109-unit sections; missing in older saves means legacy single width. */
  gateSpan?:1|2;
  /** Authoritative IDs of up to five living infantry inside this bunker. */
  garrison?:number[];
  constructionActive?:boolean;
  burst?:Burst;
  queueCosts?:number[];
  turretAngle?:number; previousTurretAngle?:number; turretTarget?:number|null;
  /** Optional new special building state; absent in old saves. */
  siloCharge?:number;
  interceptorAmmo?:number;
}
/** Transient on-screen release cue. Never serialized or used for collisions. */
export interface ProductionRelease {unitId:number;baseId:number;kind:UnitKind;owner:Faction;at:number;from:Point;to:Point}
export interface Shot { from:Point; to:Point; owner:Faction; life:number; hit:boolean; miss?:boolean; projected?:boolean; source?:number; weapon?:Weapon; barrel?:number; at?:number; groundFrom?:Point; groundTo?:Point; armored?:boolean; targetClass?:'armor'|'infantry'|'air'|'structure'; impactElevation?:number; kind?:UnitKind; angle?:number;flightHeight?:number }
export interface Missile {id:number;source:number;owner:Faction;from:Point;to:Point;angle:number;at:number;impactAt:number;damage:number;type?:'antiArmor'|'bomb'|'scoutRocket';target?:number;miss?:boolean}
export interface Blast extends Point {at:number;id:number}
export type CaptureReadiness='owned'|'no-unit'|'out-of-range'|'contested'|'enemy-hq'|'capturing';
export interface Memory extends Point { id:number; owner:Faction; hp:number; territory:number; kind?:BuildingKind }
export interface Save {
  version:2; terrainProfile?:TerrainProfile; generatorVersion?:BattlefieldGeneratorVersion; bootstrapVersion?:1; weatherVersion?:1; productionVersion?:1; supportVersion?:1;rosterVersion?:2;missiles?:Missile[]; seed:number; mapVersion?:MapVersion; time:number; nextId:number; credits:number[]; incomeClock:number;
  units:Unit[]; bases:Base[]; territories:Territory[]; explored:number[][];
  memories:Memory[][]; aiClock:number; ai?:TacticalState; status:'playing'|'victory'|'defeat'; stats?:MatchStatistics;
  research?:[ResearchState,ResearchState];
  strategicMissiles?:StrategicMissile[];
  /** Ever established a living structure (even if later destroyed). */
  hadBuildings?:[boolean,boolean];
  /** Finite neutral supply stocks; missing in old saves -> new seeded sites. */
  supplyCaches?:SupplyCache[];
}

/** Uniform buckets keep combat/vision queries independent of total army size. */
class SpatialIndex {
  private buckets=new Map<number,Unit[]>();
  private size=220;
  rebuild(units:Unit[]):void {this.buckets.clear();for(const u of units){if(u.carrier||u.hp<=0)continue;const k=Math.floor(u.y/this.size)*32+Math.floor(u.x/this.size);const b=this.buckets.get(k);if(b)b.push(u);else this.buckets.set(k,[u]);}}
  query(p:Point,r:number):Unit[]{const result:Unit[]=[];for(let y=Math.floor((p.y-r)/this.size);y<=Math.floor((p.y+r)/this.size);y++)for(let x=Math.floor((p.x-r)/this.size);x<=Math.floor((p.x+r)/this.size);x++){
    for(const u of this.buckets.get(y*32+x)??[])if(distance(p,u)<=r)result.push(u);
  }return result;}
}

export class Simulation {
  readonly world:World;
  /** Present only for the new HQ-less campaign; absent in legacy saves. */
  readonly bootstrapVersion?:1;
  readonly startRegions:{center:Point;radius:number}[]=[];
  hasHeadquarters(owner:Faction):boolean{return this.bases.some(b=>b.owner===owner&&b.kind==='headquarters'&&b.hp>0&&b.buildRemaining<=0);}
  needsHeadquarters(owner:Faction):boolean{return this.bootstrapVersion===1&&!this.hasHeadquarters(owner);}
  radarOnline(owner:Faction):boolean{return !this.needsHeadquarters(owner);}
  headquartersCandidates(owner:Faction):Point[]{
    const {center,radius}=this.startRegions[owner],points:Point[]=[{...center}];
    for(let r=64;r+BUILDINGS.headquarters.radius<=radius;r+=64)for(let i=0;i<24;i++){
      const angle=(i+((this.seed>>>0)%24))*Math.PI/12;points.push({x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r});
    }
    return points;
  }

  readonly weather:Weather;
  private unitById=new Map<number,Unit>();
  // Props are visual assets but also physical navigation obstacles for ground
  // vehicles. Cache per simulation tick, not per vehicle movement.
  private decorObstaclesAt=-1;
  private decorObstaclesCount=-1;
  private decorObstacles:{x:number;y:number;radius:number}[]=[];
  private vehicleDecorObstacles():{x:number;y:number;radius:number}[]{
    if(this.decorObstaclesAt===this.time&&this.decorObstaclesCount===this.bases.length)return this.decorObstacles;
    this.decorObstacles=visibleBasePropColliders(this);
    this.decorObstaclesAt=this.time;
    this.decorObstaclesCount=this.bases.length;
    return this.decorObstacles;
  }
  /** Visibility-source scale only. Defaults to 1, preserving classic RTS and
   * all headless AI/benchmark fixtures. 3D campaigns opt in to a modest bonus. */
  visionScale=1;
  // Presentation-scoped option: only the WebGL preview opts in. Classic
  // Canvas, saved games and headless AI benchmarks retain the default 1.0.
  infantryVisionBonus=1;
  readonly hills:RollingHill[]=[];
  highGroundEnabled=false; // opt-in only in the playable WebGL campaign
  onHighGround(p:Point):boolean{
    if(!this.highGroundEnabled)return false;
    if(!this.world.generated?.battlefield)return standsOnHill(this.hills,p);
    if(('kind' in p)&&unitSpec(p as Unit).flying)return false;
    return this.world.walkable(p)&&this.world.terrainHeight(p.x,p.y)>=45&&this.world.terrainSlope(p.x,p.y)<=.20;
  }
  sight(u:Unit):number{
    const infantry=['infantry','medic','engineer','heavy','rocket'].includes(u.kind);
    // Ground forces on real high ground see 16% farther. This uses the same
    // authoritative high-ground criterion as the existing combat bonus.
    // Both factions benefit; aircraft, flat ground and classic games do not.
    // No fog bypass: VisionCache still applies the usual terrain sightLine.
    const heightBonus=!unitSpec(u).flying&&this.onHighGround(u)?
      HIGH_GROUND_SIGHT_MULTIPLIER:1;
    return unitSpec(u).sight*researchModifiers(this.research[u.owner],u.kind).sight*(infantry?this.infantryVisionBonus:1)*
      (this.weather.storm&&!unitSpec(u).flying?WEATHER_RULES.groundSight:1)*heightBonus;
  }
  healRadius(u:Unit):number{return HEAL_RADIUS*getVeterancyModifiers(u).healRange;}
  /** Authoritative upgrade-aware stats, applied to new AND existing units. */
  maxUnitHp(u:{kind:UnitKind;owner:Faction}):number{
    return unitSpec(u).hp*researchModifiers(this.research[u.owner],u.kind).hp;
  }
  speed(u:Unit):number{
    return unitSpec(u).speed*researchModifiers(this.research[u.owner],u.kind).speed;
  }
  range(u:Unit):number{
    return unitSpec(u).range*researchModifiers(this.research[u.owner],u.kind).range;
  }
  startResearch(owner:Faction,kind:UpgradeKind):boolean{
    const state=this.research[owner],upgrade=UPGRADES[kind];
    if(!upgrade||this.status!=='playing'||!canResearchUpgrade(state,kind)||
       !this.bases.some(b=>b.owner===owner&&b.kind==='research'&&b.hp>0&&b.buildRemaining<=0)||
       this.credits[owner]<upgrade.cost)return false;
    this.credits[owner]-=upgrade.cost;
    state.active=kind;state.remaining=upgrade.seconds;
    if(owner===0&&this.testMode){
      this.credits[0]=Simulation.TEST_CREDITS;
      this.completeResearch(owner,kind);
    }
    if(owner===0)this.notices.push('Forschung begonnen: '+upgrade.name);
    return true;
  }
  private completeResearch(owner:Faction,kind:UpgradeKind):void{
    const state=this.research[owner];
    const oldHp=new Map(this.units.filter(u=>u.owner===owner&&u.hp>0)
      .map(u=>[u.id,this.maxUnitHp(u)]));
    state.completed.push(kind);state.active=null;state.remaining=0;
    for(const u of this.units)if(u.owner===owner&&u.hp>0){
      // Restore absolute additional hitpoints, without healing prior damage.
      const bonus=this.maxUnitHp(u)-(oldHp.get(u.id)??this.maxUnitHp(u));
      if(bonus>0)u.hp=Math.min(this.maxUnitHp(u),u.hp+bonus);
    }
    if(owner===0)this.notices.push('Forschung abgeschlossen: '+UPGRADES[kind].name);
  }
  /** Launch an actual slow-moving strategic projectile. */
  launchStrategicMissile(owner:Faction,p:Point):boolean{
    if(this.status!=='playing'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
       this.world.index(p)<0)return false;
    if(p.x<8||p.y<8||p.x>this.world.size-8||p.y>this.world.size-8||
       !this.hasExplored(owner,p))return false;
    const silo=this.bases.find(b=>b.owner===owner&&b.kind==='silo'&&
      b.hp>0&&b.buildRemaining<=0&&(b.siloCharge??SILO_CHARGE_SECONDS)<=0);
    if(!silo)return false;
    silo.siloCharge=SILO_CHARGE_SECONDS;
    const missile:StrategicMissile={
      id:this.nextId++,owner,from:{x:silo.x,y:silo.y},to:{x:p.x,y:p.y},
      at:this.time,impactAt:this.time+STRATEGIC_WARNING_SECONDS
    };
    this.strategicMissiles.push(missile);
    this.strategicEvents.push({...missile,kind:'launch'});
    this.notices.push(owner===1?'FEINDLICHER RAKETENSTART ERKANNT!':
     'Langstreckenrakete gestartet · Einschlag in 25 Sekunden.');
    return true;
  }
  rearmInterceptor(id:number):boolean{
    const base=this.bases.find(b=>b.id===id&&b.kind==='interceptor'&&
      b.hp>0&&b.buildRemaining<=0);
    if(!base||this.status!=='playing'||(base.interceptorAmmo??0)>=INTERCEPTOR_MAX_AMMO||
       this.credits[base.owner]<INTERCEPTOR_REARM_COST)return false;
    this.credits[base.owner]-=INTERCEPTOR_REARM_COST;
    base.interceptorAmmo=INTERCEPTOR_MAX_AMMO;
    return true;
  }
  private stepStrategy(dt:number):void{
    for(const owner of [0,1] as const){
      const state=this.research[owner];
      const lab=this.bases.some(b=>b.owner===owner&&b.kind==='research'&&
        b.hp>0&&b.buildRemaining<=0);
      if(lab&&state.active){
        state.remaining=Math.max(0,state.remaining-dt);
        if(state.remaining<=1e-8)this.completeResearch(owner,state.active);
      }
    }
    for(const silo of this.bases)if(silo.kind==='silo'&&silo.hp>0&&
      silo.buildRemaining<=0&&silo.siloCharge!==undefined&&silo.siloCharge>0)
      silo.siloCharge=Math.max(0,silo.siloCharge-dt);
    for(const m of this.strategicMissiles)if(m.impactAt<=this.time+1e-8){
      // A completed nearby interceptor automatically reacts to the global
      // warning. One rocket per intercepted strike; no infinite ammo.
      const defense=this.bases.filter(b=>b.owner!==m.owner&&b.kind==='interceptor'&&
        b.hp>0&&b.buildRemaining<=0&&(b.interceptorAmmo??0)>0&&
        distance(b,m.to)<=INTERCEPTOR_RANGE)
        .sort((a,b)=>distance(a,m.to)-distance(b,m.to)||a.id-b.id)[0];
      if(defense){
        defense.interceptorAmmo!--;
        this.strategicEvents.push({...m,kind:'intercept',at:this.time});
        if(defense.owner===0)this.notices.push('Raketenabwehr erfolgreich · Einschlag verhindert.');
        continue;
      }
      for(const entity of [...this.units,...this.bases])if(entity.hp>0&&
        entity.owner!==m.owner&&(!('orders' in entity)||!entity.carrier)){
        const d=distance(entity,m.to);
        if(d>STRATEGIC_BLAST_RADIUS)continue;
        const isBuilding='queue' in entity;
        const maxHp=isBuilding?buildingSpec(entity).hp:this.maxUnitHp(entity);
        const damage=strategicBlastDamage(d,maxHp,isBuilding);
        const source=this.bases.find(b=>b.owner===m.owner&&b.kind==='silo'&&b.hp>0);
        this.strike(source??m.id,entity,damage);
        if(entity.owner===0&&m.owner===1)this.attackAlerts.record(m.to,this.time);
      }
      this.blasts.push({...m.to,id:m.id,at:this.time});
      this.strategicEvents.push({...m,kind:'impact',at:this.time});
      this.notices.push(m.owner===1?'FEINDLICHE LANGSTRECKENRAKETE EINGESCHLAGEN!':
       'Langstreckenrakete eingeschlagen.');
    }
    this.strategicMissiles=this.strategicMissiles.filter(m=>m.impactAt>this.time);
    this.strategicEvents=this.strategicEvents.filter(e=>this.time-e.at<1.6).slice(-16);
    // Enemy strategy runs only once every 7 seconds, not inside per-unit loops.
    if(this.time-this.strategicAiAt>=7){
      this.strategicAiAt=this.time;
      this.planStrategicAi();
    }
  }
  /** Same public facts drive the 3-second macro reserve, 7-second
   * construction, and paid Bastion reinvestment. No phantom credits. */
  private ai38Investment():ReturnType<typeof ai38InfrastructurePlan>|null{
    if(this.world.mapVersion<23||this.tactical.ai37Mode!=='coordinated')return null;
    const ai=1,active=this.units.filter(u=>u.owner===ai&&u.hp>0&&!u.carrier);
    const observedRaiders=this.units.filter(u=>u.owner===0&&u.hp>0&&
      !u.carrier&&this.canSee(ai,u));
    const underAttack=observedRaiders.some(u=>this.bases.some(b=>
      b.owner===ai&&b.hp>0&&distance(u,b)<650));
    return ai38InfrastructurePlan({
      time:this.time,income:this.income(ai),
      ownedBastions:this.territories.filter(t=>t.owner===ai).length,
      fieldFighters:active.filter(u=>unitSpec(u).damage>0).length,
      availableInfantry:active.filter(u=>unitSpec(u).group==='Infanterie'&&
        !['engineer','medic'].includes(u.kind)).length,
      headquartersReady:this.bases.some(b=>b.owner===ai&&b.kind==='headquarters'&&
        b.hp>0&&b.buildRemaining<=0),
      barracksReady:this.bases.some(b=>b.owner===ai&&b.kind==='barracks'&&
        b.hp>0&&b.buildRemaining<=0),
      factoryReady:this.bases.some(b=>b.owner===ai&&b.kind==='factory'&&
        b.hp>0&&b.buildRemaining<=0),
      airfieldReady:this.bases.some(b=>b.owner===ai&&b.kind==='airfield'&&
        b.hp>0&&b.buildRemaining<=0),
      artilleryReady:active.some(u=>u.kind==='artillery')||
        this.bases.some(b=>b.owner===ai&&b.queueTypes.includes('artillery')),
      totalBastions:this.territories.length,
      bunkerCount:this.bases.filter(b=>b.owner===ai&&b.kind==='bunker'&&b.hp>0).length,
      hasUpgradeTarget:this.territories.some(t=>bastionUpgradable(t,ai,this.bases,
        campaignLayout(this.world.mapVersion,this.seed).headquarters)),
      homeThreat:underAttack,
      finishing:this.tactical.state.commander?.enemyHQEliminatedAt!==undefined
    });
  }
  private planStrategicAi():void{
    if(this.status!=='playing'||!this.hasHeadquarters(1))return;
    const ai=1;
    // Do not take the first worker if it is busy with a factory or repairs.
    const allEngineers=this.units.filter(u=>u.owner===ai&&u.kind==='engineer'&&u.hp>0&&!u.carrier);
    const engineer=allEngineers.filter(u=>!u.orders.some(o=>o.kind==='build'||o.kind==='repair')&&
      u.defendUntil<=this.time).sort((a,b)=>a.orders.length-b.orders.length||a.id-b.id)[0];
    const has=(kind:BuildingKind)=>this.bases.some(b=>b.owner===ai&&b.kind===kind&&b.hp>0);
    const active=this.units.filter(u=>u.owner===ai&&u.hp>0&&!u.carrier);
    const visibleRaiders=this.units.filter(u=>u.owner===0&&u.hp>0&&
      !u.carrier&&this.canSee(ai,u));
    const pressured=visibleRaiders.some(u=>this.bases.some(b=>
      b.owner===ai&&b.hp>0&&distance(u,b)<650));
    const investment=this.ai38Investment();
    const needed:BuildingKind|null=investment?.goal==='bunker'?null:
      !has('research')&&this.credits[ai]>=1450&&this.time>140?'research':
      INTERCEPTOR_ENABLED&&!has('interceptor')&&this.memories[ai].some(b=>b.owner===0&&b.kind==='silo'&&b.hp>0)&&
        this.credits[ai]>=3100?'interceptor':
      !has('silo')&&has('research')&&this.credits[ai]>=6300&&this.time>520?'silo':null;
    if(needed&&engineer&&!engineer.orders.some(o=>o.kind==='build')){
      const hq=this.bases.find(b=>b.owner===ai&&b.kind==='headquarters'&&b.hp>0);
      if(hq){
        for(let i=0;i<18;i++){
          const angle=i*Math.PI*2/18;
          const radius=BUILDINGS[needed].radius+hq.radius+75+(i%3)*85;
          const p={x:hq.x+Math.cos(angle)*radius,y:hq.y+Math.sin(angle)*radius};
          if(!this.buildError(ai,needed,p)&&this.build(ai,needed,p,[engineer.id]))break;
        }
      }
    }
    // KI 3.7: real, PAID fortifications. The candidate must be already
    // explored, walkable, buildable and reachable by an idle AI engineer.
    // Preserve funds for field production, so base camping never replaces
    // Bastion captures or a useful combined-arms army.
    if(investment?.goal==='bunker'&&this.credits[ai]>=investment.reserve&&engineer&&
      this.bases.some(b=>b.owner===ai&&b.kind==='headquarters'&&
        b.hp>0&&b.buildRemaining<=0)){
      const choice=ai37FortificationChoice({
        time:this.time,credits:this.credits[ai],income:this.income(ai),
        completedHeadquarters:true,completedBarracks:this.bases.some(b=>
          b.owner===ai&&b.kind==='barracks'&&b.hp>0&&b.buildRemaining<=0),
        builders:allEngineers.length,
        activeInfantry:active.filter(u=>unitSpec(u).group==='Infanterie'&&
          !['engineer','medic'].includes(u.kind)).length,
        mobileFighters:active.filter(u=>unitSpec(u).damage>0).length,
        ownedBastions:this.territories.filter(t=>t.owner===ai).length,
        bunkers:this.bases.filter(b=>b.owner===ai&&b.kind==='bunker'&&b.hp>0).length,
        turrets:this.bases.filter(b=>b.owner===ai&&b.kind==='turret'&&b.hp>0).length,
        underAttack:pressured
      });
      if(choice){
        const hq=this.bases.find(b=>b.owner===ai&&b.kind==='headquarters'&&
          b.hp>0&&b.buildRemaining<=0)!;
        const forward=this.territories.filter(t=>t.owner===ai&&
          t.upgradeLevel===2&&distance(t.point,engineer)<950)
          .sort((a,b)=>b.income-a.income||a.id-b.id)[0];
        const anchors=forward&&choice==='bunker'&&
          this.bases.some(b=>b.owner===ai&&b.kind==='bunker')
          ?[forward.point,hq]:[hq];
        // Search real, explored site polygons around both home and captured
        // sectors. A 24-point HQ ring was often blocked by factories, rocks,
        // construction facades and staging infantry. Do not cheat buildError.
        let placed=false;
        for(const anchor of anchors){
          for(const extra of [0,100,190,290,400,510]){
            for(let i=0;i<20;i++){
              const angle=i*Math.PI*2/20+(this.seed%9)*.04;
              const radius=anchor===hq
                ?BUILDINGS[choice].radius+hq.radius+125+extra
                :BUILDINGS[choice].radius+175+extra;
              const p={x:anchor.x+Math.cos(angle)*radius,
                y:anchor.y+Math.sin(angle)*radius};
              if(this.buildError(ai,choice,p))continue;
              if(this.build(ai,choice,p,[engineer.id])){placed=true;break;}
            }
            if(placed)break;
          }
          if(placed)break;
        }
      }
    }
    if(has('research')&&!this.research[ai].active){
      for(const k of ['armor1','precision','engines','radar','armor2',
        'rocketDevelopment','infantryTraining','tankMobility'] as UpgradeKind[])
        if(this.startResearch(ai,k))break;
    }
    const defender=this.bases.find(b=>b.owner===ai&&b.kind==='interceptor'&&
      b.hp>0&&b.buildRemaining<=0&&(b.interceptorAmmo??0)<INTERCEPTOR_MAX_AMMO);
    if(defender&&this.credits[ai]>=INTERCEPTOR_REARM_COST+850)
      this.rearmInterceptor(defender.id);
    const silo=this.bases.find(b=>b.owner===ai&&b.kind==='silo'&&b.hp>0&&
      b.buildRemaining<=0&&(b.siloCharge??SILO_CHARGE_SECONDS)===0);
    if(silo){
      // Choose an OBSERVED enemy building only. No omniscient targeting.
      const seen=this.bases.filter(b=>b.owner===0&&b.hp>0&&this.canSee(ai,b))
        .sort((a,b)=>(b.kind==='headquarters'?1:0)-(a.kind==='headquarters'?1:0)||
          b.hp-a.hp||a.id-b.id)[0];
      if(seen)this.launchStrategicMissile(ai,seen);
    }
  }
  readonly tactical=new TacticalAI(this);
  readonly transports=new Transports(this,(u,p,dt)=>this.move(u,p,dt));
  missiles:Missile[]=[];blasts:Blast[]=[];
  /** Persistent research and missiles; transient event visuals never serialized. */
  research:[ResearchState,ResearchState]=[newResearchState(),newResearchState()];
  strategicMissiles:StrategicMissile[]=[];
  strategicEvents:StrategicEvent[]=[];
  private strategicAiAt=-Infinity;
  private seenEnemySilos=new Set<number>();
  seed:number; time=0; nextId=1; credits=[RULES.initialCredits as number,RULES.initialCredits as number];
  incomeClock=0; aiClock=0; status:'playing'|'victory'|'defeat'='playing';
  stats:MatchStatistics=newMatchStatistics();
  /** HQ-less startup cannot be mistaken for building elimination. */
  hadBuildings:[boolean,boolean]=[false,false];
  supplyCaches:SupplyCache[]=[];
  units:Unit[]=[]; bases:Base[]=[]; territories:Territory[];
  visible=perPlayerSlots(2,()=>new Uint8Array(RULES.grid**2));
  explored=perPlayerSlots(2,()=>new Uint8Array(RULES.grid**2));
  memories:Memory[][]=perPlayerSlots(2,()=>[] as Memory[]);
  shots:Shot[]=[]; notices:string[]=[];
  readonly productionReleases:ProductionRelease[]=[];
  /** Only enabled by WebGL. Never serialized; old saves and headless/Canvas
   * simulation retain the original immediate production semantics. */
  stageWebGLProduction=false;
  // QA-only runtime switch, enabled by typing "iddqd" in WebGL. It is
  // intentionally absent from the save format: reloading resets the cheat.
  testMode=false;
  private static readonly TEST_CREDITS=1_000_000_000;
  enableTestMode():boolean{
    if(this.testMode)return false;
    this.testMode=true;
    this.credits[0]=Simulation.TEST_CREDITS;
    // Finish existing sites without teleports, time skips or changing AI.
    const finished=new Set<number>();
    for(const b of this.bases)if(b.owner===0&&b.hp>0){
      if(b.buildRemaining>0){
        b.buildRemaining=0;b.hp=buildingSpec(b).hp;
        b.constructionActive=false;finished.add(b.id);
      }
      if(b.queue.length)b.production=b.queue[0];
    }
    // Completed foundations must not leave pioneers chasing stale orders.
    if(finished.size)for(const u of this.units)if(u.owner===0){
      u.orders=u.orders.filter(o=>o.kind!=='build'||!finished.has(o.target??-1));
      if(u.workingTarget!==undefined&&u.workingTarget!==null&&finished.has(u.workingTarget)){
        u.workingTarget=null;u.path=[];u.repath=0;
      }
    }
    const research=this.research[0];
    if(research.active)this.completeResearch(0,research.active);
    this.updateVision();
    this.notices.push('ID DQD: Testmodus aktiv – unbegrenzte Credits und Sofortbau.');
    return true;
  }
  private readonly productionDepartureHolds=new Map<number,number>();
  extendProductionDeparture(unitId:number,until:number):void {
    if(!this.stageWebGLProduction||!Number.isFinite(until))return;
    const previous=this.productionDepartureHolds.get(unitId);
    if(previous!==undefined&&until>previous)this.productionDepartureHolds.set(unitId,until);
  }
  cancelProductionDeparture(unitId:number):void{this.productionDepartureHolds.delete(unitId);}
  /** Manual repair orders never create phantom aircraft or extra building slots. */
  requestAirfieldRepair(ids:number[],preferredBaseId?:number):number {
    if(this.status!=='playing')return 0;
    let accepted=0;
    for(const u of this.units){
      if(!ids.includes(u.id)||u.hp<=0||u.carrier||!['bomber','scout'].includes(u.kind)||
        u.airfieldService||u.transport?.cargo.length||u.transport?.phase&&u.transport.phase!=='cruise'||
        u.hp>=this.maxUnitHp(u)-1e-6&&!(u.kind==='scout'&&(u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)<SCOUT_ROCKETS.maxAmmo))continue;
      const airfield=this.bases.find(b=>b.owner===u.owner&&b.kind==='airfield'&&b.hp>0&&b.buildRemaining<=0&&
        (preferredBaseId===undefined||b.id===preferredBaseId));
      if(!airfield)continue;
      const occupied=new Set(this.units.filter(other=>other.hp>0&&other.airfieldService?.baseId===airfield.id)
        .map(other=>other.airfieldService!.bay));
      const bay=([0] as const).find(n=>!occupied.has(n));
      if(bay===undefined||occupied.size>=AIRFIELD_BAYS)continue;
      u.airfieldService={baseId:airfield.id,bay,phase:'approach',elapsed:0,paidHp:0};
      u.returnToHangar=false;
      u.orders=[];u.path=[];u.repath=0;u.hold=false;u.pursuitOrigin=null;u.combatTarget=null;
      delete u.bomberRun;delete u.idleOrbit;delete u.burst;
      this.transports.cancel(u);this.cancelProductionDeparture(u.id);
      if(u.owner===0)this.notices.push(`${unitSpec(u).name}: Anflug auf Hangar ${bay+1}.`);
      accepted++;
    }
    return accepted;
  }
  /** Repair-complete planes remain parked until the pilot explicitly launches. */
  launchRepairedAircraft(ids:number[]):number {
    let launched=0;
    for(const u of this.units)if(ids.includes(u.id)&&u.hp>0&&u.airfieldService?.phase==='ready'){
      u.airfieldService.phase='takeoff';u.airfieldService.elapsed=0;u.path=[];u.repath=0;
      launched++;
    }
    return launched;
  }
  setAutoAirfieldRepair(ids:number[],enabled:boolean):number {
    let changed=0;
    for(const u of this.units)if(ids.includes(u.id)&&u.owner===0&&u.hp>0&&['bomber','scout'].includes(u.kind)){
      u.autoAirfieldRepair=enabled;changed++;
    }
    return changed;
  }
  /** No ground-vehicle factory repair: only Pioniere may restore vehicle HP.
   * Keep these legacy API names as safe no-ops for old saved UI/event callers. */
  requestFactoryRepair(_ids:number[],_preferredBaseId?:number):number {
    return 0;
  }
  releaseFactoryRepair(_ids:number[]):number {
    return 0;
  }
  setAutoFactoryRepair(ids:number[],_enabled:boolean):number {
    for(const u of this.units)if(ids.includes(u.id))delete u.autoFactoryRepair;
    return 0;
  }
  /** Called once per fixed tick; docking aircraft remain targetable and consume credits. */
  private advanceAirfieldService(u:Unit,dt:number):void {
    const s=u.airfieldService;if(!s)return;
    const base=this.bases.find(b=>b.id===s.baseId&&b.kind==='airfield'&&b.owner===u.owner&&b.hp>0&&b.buildRemaining<=0);
    if(!base){
      // Destroying a hangar destroys the planes sheltered inside it.
      if(['taxi','repair','ready'].includes(s.phase))u.hp=0;
      delete u.airfieldService;u.flightHeight=1;return;
    }
    const advance=(point:Point,height:number)=>{
      const last={x:u.x,y:u.y};u.x=point.x;u.y=point.y;u.flightHeight=height;
      const d=distance(last,u);if(d>.001){u.angle=Math.atan2(u.y-last.y,u.x-last.x);u.hullAngle=u.angle;u.walkDistance+=d;u.moving=true;}
      u.driveSpeed=d/dt;
    };
    if(s.phase==='approach'){
      const target=airfieldPoint(base,'approach',s.bay);
      u.flightHeight=1;
      if(distance(u,target)<=28){
        s.phase='landing';s.elapsed=0;s.from={x:u.x,y:u.y};u.path=[];u.repath=0;
      }else this.move(u,target,dt);
      return;
    }
    if(s.phase==='landing'){
      s.elapsed=Math.min(AIRFIELD_LANDING_SECONDS,s.elapsed+dt);
      const t=s.elapsed/AIRFIELD_LANDING_SECONDS;
      advance(airfieldLerp(s.from??u,airfieldPoint(base,'touchdown',s.bay),t),1-t);
      if(t>=1){s.phase='taxi';s.elapsed=0;delete s.from;}
      return;
    }
    if(s.phase==='taxi'){
      s.elapsed=Math.min(AIRFIELD_TAXI_SECONDS,s.elapsed+dt);
      advance(airfieldTaxiPoint(base,s.bay,s.elapsed/AIRFIELD_TAXI_SECONDS),0);
      if(s.elapsed>=AIRFIELD_TAXI_SECONDS){
       s.phase=u.orders.length||u.transport?.task==='load'?'takeoff':'repair';s.elapsed=0;
      }
      return;
    }
    if(s.phase==='repair'){
      u.flightHeight=0;u.driveSpeed=0;
      // Both air factions rearm only in a real, owned hangar. Limited ammo
      // is saved on the actor; each replacement rocket costs 12 credits.
      const replenish=()=>{
       if(u.kind!=='scout')return true;
       const remaining=SCOUT_ROCKETS.maxAmmo-(u.rocketAmmo??SCOUT_ROCKETS.maxAmmo);
       if(remaining<=0)return true;
       const count=Math.min(remaining,Math.floor(this.credits[u.owner]/SCOUT_ROCKETS.rearmCost));
       if(count>0){
        this.credits[u.owner]-=count*SCOUT_ROCKETS.rearmCost;
        u.rocketAmmo=(u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)+count;
       }
       return (u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)>=SCOUT_ROCKETS.maxAmmo;
      };
      const missing=Math.max(0,this.maxUnitHp(u)-u.hp);
      if(missing<1e-5){
       u.hp=this.maxUnitHp(u);
       if(!replenish())return;
       s.phase='ready';s.elapsed=0;return;
      }
      const desired=Math.min(missing,this.maxUnitHp(u)*AIRFIELD_REPAIR_FRACTION_PER_SECOND*dt);
      while(s.paidHp+1e-8<desired&&this.credits[u.owner]>=1){
        this.credits[u.owner]--;s.paidHp+=AIRFIELD_REPAIR_HP_PER_CREDIT;
      }
      const healed=Math.min(desired,s.paidHp);u.hp=Math.min(this.maxUnitHp(u),u.hp+healed);
      s.paidHp=Math.max(0,s.paidHp-healed);
      if(this.maxUnitHp(u)-u.hp<1e-5){
        u.hp=this.maxUnitHp(u);
        if(!replenish())return;
        s.phase='ready';s.elapsed=0;
        if(u.owner===0)this.notices.push(`${unitSpec(u).name}: Hangarservice abgeschlossen – Startbefehl bereit.`);
      }
      return;
    }
    if(s.phase==='ready'){u.flightHeight=0;u.driveSpeed=0;return;}
    s.elapsed=Math.min(AIRFIELD_TAKEOFF_SECONDS,s.elapsed+dt);
    const t=s.elapsed/AIRFIELD_TAKEOFF_SECONDS;
    advance(airfieldTaxiPoint(base,s.bay,t,true),Math.max(0,Math.min(1,(t-.70)/.30)));
    if(t>=1){
      u.flightHeight=1;delete u.airfieldService;u.path=[];u.repath=0;
      if(u.owner===0)this.notices.push(`${unitSpec(u).name}: Flugfeld verlassen.`);
    }
  }
  isProductionDepartureHeld(unitId:number):boolean {
    return (this.productionDepartureHolds.get(unitId)??-Infinity)>this.time;
  }
  readonly attackAlerts=new AttackAlerts();
  workEffects:WorkEffect[]=[];
  paused=false; revision=0; aiPlanDurationMs=0; aiPlanCompletedAt=-1;
  /** Opt-in timing for bomber/fog diagnosis, never serialized or authoritative. */
  profileVision=false; visionDurationMs=0; visionCompletedAt=-1; maxVisionMs=0;
  /** Opt-in CPU time of all unit orders/movement and collision separation. */
  profileSquadWork=false; squadUnitMs=0; squadCollisionMs=0;
  resetSquadProfile():void{this.squadUnitMs=0;this.squadCollisionMs=0;}
  private fogClock=0; private visionCache=new VisionCache(); private spatial=new SpatialIndex();
  private nextCooperativeBuilderAt=0;
  /** One working pioneer per construction site avoids shared approach-point
   * collisions. Idle engineers automatically seek a DIFFERENT, unattended
   * foundation; with no other construction they stay available.
   * If a saved game or previous version double-assigns a site, transfer
   * surplus workers to unattended sites while leaving one active builder.
   * Manual move, combat, repair and explicitly queued orders remain intact.
   */
  private assignIdlePioneersToConstruction():void {
    const sites=this.bases.filter(b=>b.owner===0&&b.hp>0&&b.buildRemaining>0);
    if(!sites.length)return;
    const workers=this.units.filter(u=>u.owner===0&&u.kind==='engineer'&&
      u.hp>0&&!u.carrier);
    if(!workers.length)return;
    const count=new Map(sites.map(b=>[b.id,0]));
    for(const u of workers){
      const o=u.orders[0];
      if(o?.kind==='build'&&count.has(o.target!))
        count.set(o.target!,count.get(o.target!)!+1);
    }
    const activeOn=(u:Unit)=>u.orders[0]?.kind==='build'&&
      count.has(u.orders[0].target!)?u.orders[0].target:null;
    const available=workers.filter(u=>!u.hold&&
      !(u.defendUntil>this.time)&&u.orders.length===0&&u.workingTarget==null);
    // Redistribute any old double-assignments only if a second actual site
    // exists, without interrupting the sole pioneer on the first.
    for(const u of workers){
      if(!sites.some(b=>count.get(b.id)===0))break;
      const target=activeOn(u);
      if(target==null||count.get(target)!<=1||u.orders.length!==1||
         u.workingTarget!=null||u.hold)continue;
      const unattended=sites.filter(b=>count.get(b.id)===0)
       .sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id);
      for(const b of unattended){
        if(!this.command([u.id],{kind:'build',x:b.x,y:b.y,target:b.id}))continue;
        count.set(target,count.get(target)!-1);
        count.set(b.id,1);
        break;
      }
    }
    for(const u of available){
      const unattended=sites.filter(b=>count.get(b.id)===0)
       .sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id);
      for(const site of unattended){
        if(!this.command([u.id],{kind:'build',x:site.x,y:site.y,target:site.id}))
          continue;
        count.set(site.id,1);
        break;
      }
    }
  }
  /** The original constructor remains a deterministic legacy fixture/save reader. */
  constructor(seed=2026,mapVersion:MapVersion=0,weatherEnabled=false,bootstrap=false,profile?:TerrainProfile,generatorVersion:BattlefieldGeneratorVersion=BATTLEFIELD_GENERATOR) {
    this.bootstrapVersion=bootstrap?1:undefined;this.seed=seed;this.weather=new Weather(seed,weatherEnabled);this.world=new World(seed,mapVersion,profile,0,generatorVersion);this.territories=this.world.territories(seed);
    if(mapVersion>=3)this.credits=[950,950];
    this.hills=mapVersion>=23?[]:generateRollingHills(seed,mapVersion,this.world.size,
      this.world.generated?.sites??[],this.world.generated?.ruins??[]);
    const layout=campaignLayout(mapVersion,seed);
    for(const owner of [0,1] as const){
      const territory=layout.headquarters[owner];
      const t=this.territories[territory],site=mapVersion>=23?battlefieldStart(t.point,this.world.size):mapVersion>=2?{x:t.point.x+(owner===0?-260:260),y:t.point.y+(owner===0?165:-165)}:mapVersion===1?{x:t.point.x-165,y:t.point.y+45}:t.point,p=this.world.clearSite(site,RULES.headquarters.radius)!;
      this.startRegions.push({center:{...p},radius:Math.min(600,this.world.size/6)});
      if(!bootstrap)this.bases.push({id:1000+owner,owner,kind:'headquarters',...p,hp:RULES.headquarters.hp,territory,queue:[],queueTypes:[],production:0,buildRemaining:0,cooldown:0,rally:null,radius:RULES.headquarters.radius});
      if(mapVersion===0)t.point=this.world.nearest({x:p.x+165,y:p.y-45},this.obstacles())!;
      const sign=mapVersion>=2&&owner===1?-1:1;
      this.spawn(owner,this.world.nearest({x:p.x+140*sign,y:p.y+100*sign},this.obstacles())!);
    }
    // Keep the two original soldiers/IDs, then give each faction one builder.
    for(const owner of [0,1] as const){
      const soldier=this.units.find(u=>u.owner===owner)!,sign=mapVersion>=2&&owner===1?-1:1;
      const p=this.world.nearest({x:soldier.x+45*sign,y:soldier.y},this.obstacles(),this.units,soldier)!;
      this.spawn(owner,p,'engineer');
    }
    for(const b of this.bases)if(b.hp>0)this.hadBuildings[b.owner]=true;
    // Bastions replace finite neutral stockpiles as the income objectives.
    // All modern maps now earn credits through bastions, not neutral depots.

    // Select a tested public-map doctrine only on an EXACT fixed-map
    // match. Benchmarks may still override it per run for genuine A/B.
    const fixedDoctrines=selectDesertAIDoctrine({
      seed:this.seed,mapVersion:this.world.mapVersion,
      profile:this.world.generated?.battlefield?.profile,
      kind:this.world.generated?.landscapeKind,
      generatorVersion:this.world.generatorVersion
    });
    if(fixedDoctrines)this.tactical.ai37Mode=fixedDoctrines.mode;
    this.spatial.rebuild(this.units);this.updateVision();
  }
  static campaign(seed=randomMapSeed(),version:MapVersion=MAP_VERSION,profile?:TerrainProfile,generatorVersion:BattlefieldGeneratorVersion=BATTLEFIELD_GENERATOR):Simulation {return new Simulation(seed,version,false,true,profile,generatorVersion);}
  obstacles():Base[]{return this.bases.filter(b=>b.hp>0);}
  /** The owner may drive through a completed gate. Enemies see exactly
   * the same full wall collision even while the gate animates open.
   */
  navigationBases(owner:Faction):Base[]{
   return navigableBasesForFaction(this.obstacles(),owner);
  }
  /** Find the other half of a real two-section gate retrofit. Both wall
   * segments must be adjacent, parallel, completed, alive and owned by the
   * same faction. No invisible extra footprint or free gap is created.
   */
  findWallGatePartner(owner:Faction,id:number):Base|null{
    const a=this.bases.find(b=>b.id===id&&b.kind==='wall'&&
      b.owner===owner&&b.hp>0&&b.buildRemaining<=0);
    if(!a)return null;
    const vertical=a.facing===2||a.facing===3;
    const match=this.bases.filter(b=>b.id!==id&&b.owner===owner&&
      b.kind==='wall'&&b.hp>0&&b.buildRemaining<=0&&
      (b.facing===2||b.facing===3)===vertical).find(b=>{
        const along=vertical?b.y-a.y:b.x-a.x;
        const across=vertical?b.x-a.x:b.y-a.y;
        return Math.abs(Math.abs(along)-109)<=2&&Math.abs(across)<=2;
      });
    return match??null;
  }
  /** Replace exactly two adjacent existing wall bases by one durable, truly
   * double-width animated metal gate. Preserve the selected base ID so the
   * construction UI, save identity and current selection remain stable.
   */
  convertWallToGate(owner:Faction,id:number):boolean{
    const b=this.bases.find(site=>site.id===id&&site.kind==='wall'&&
      site.owner===owner&&site.hp>0&&site.buildRemaining<=0);
    const mate=this.findWallGatePartner(owner,id);
    if(!b||!mate||this.status!=='playing'||
      this.credits[owner]<WALL_GATE_UPGRADE_COST)return false;
    const ratio=Math.max(.01,Math.min(1,
      (b.hp+mate.hp)/(2*BUILDINGS.wall.hp)));
    this.credits[owner]-=WALL_GATE_UPGRADE_COST;
    b.x=(b.x+mate.x)*.5;b.y=(b.y+mate.y)*.5;
    b.kind='wallGate';b.gateSpan=2;
    b.radius=BUILDINGS.wallGate.radius;
    b.hp=Math.max(1,ratio*BUILDINGS.wallGate.hp);
    this.bases=this.bases.filter(site=>site.id!==mate.id);
    for(const u of this.units){
      if(u.orders.some(order=>order.target===mate.id)){
        u.orders=u.orders.filter(order=>order.target!==mate.id);
      }
      if(u.workingTarget===mate.id)u.workingTarget=null;
      if(!unitSpec(u).flying){u.path=[];u.repath=0;}
    }
    this.movementCollision=undefined;
    this.updateVision();
    this.notices.push('Zwei Sperrmauern für '+WALL_GATE_UPGRADE_COST+
      ' Credits in ein doppelt breites Stahltor umgerüstet.');
    return true;
  }
  /** Static structure/facade colliders are identical for every actor during
   * the same 20 Hz tick. Reusing them cuts repeated map/filter and array
   * allocations in large vehicle battles without changing pathfinding.
   * Invalidate on any structure destruction or new simulation tick. */
  /** Short-lived drive watchdog. New saves and the fixed-step logic are unchanged. */
  private readonly vehicleProgress=new WeakMap<Unit,{
    x:number;y:number;since:number;retryAt:number;
    nextX:number;nextY:number;bestDistance:number;
  }>();
  private readonly ai38VehicleEscapes=new WeakMap<Unit,{
    targetX:number;targetY:number;lastX:number;lastY:number;
    attempts:number;
  }>();
  /** AI-only transient recovery for empty A* routes; never serialized. */
  private readonly ai39EmptyPathRecovery=new WeakMap<Unit,{
    targetX:number;targetY:number;originX:number;originY:number;
    attempts:number;
  }>();
  /** Temporary, deliberately non-serialized combat position for AI rockets. */
  private readonly rocketStandoff=new WeakMap<Unit,{targetId:number;point:Point;expires:number}>();
  /** Transient AI-only progress monitors. No new save fields, free units,
   * teleportation or per-tick world scans. */
  private readonly aiBuilderProgress=new WeakMap<Unit,{
    site:number;x:number;y:number;remaining:number;since:number;retries:number;
  }>();
  private readonly aiRouteProgress=new WeakMap<Unit,{
    order:Order;x:number;y:number;since:number;retries:number;
  }>();
  private movementCollision?:{
    at:number;
    buildings:Base[];
    towers:{x:number;y:number;radius:number}[];
    decor:{x:number;y:number;radius:number}[];
    infantryFacades:{x:number;y:number;radius:number}[];
    vehicleFacades:{x:number;y:number;radius:number}[];
    infantry:{x:number;y:number;radius:number}[];
    vehicle:{x:number;y:number;radius:number}[];
    byOwner:{
      buildings:Base[];
      infantryFacades:{x:number;y:number;radius:number}[];
      vehicleFacades:{x:number;y:number;radius:number}[];
      infantry:{x:number;y:number;radius:number}[];
      vehicle:{x:number;y:number;radius:number}[];
    }[];
  };
  private movingColliders(){
    const current=this.movementCollision;
    if(current?.at===this.time)return current;
    const buildings=this.obstacles(),towers=this.bastionColliders(),
      decor=this.vehicleDecorObstacles();
    const infantryFacades=infantryStructureColliders(buildings),
      vehicleFacades=vehicleStructureColliders(buildings);
    const byOwner=([0,1] as const).map(owner=>{
      const physical=navigableBasesForFaction(buildings,owner);
      // Retain only two thin posts for the friendly gate. The full doorway
      // stays clear, while wide vehicle routes no longer clip steel pylons.
      const gatePosts=friendlyGatePostColliders(buildings,owner);
      const feet=[...infantryStructureColliders(physical),...gatePosts];
      const wheels=[...vehicleStructureColliders(physical),...gatePosts];
      return {buildings:physical,infantryFacades:feet,vehicleFacades:wheels,
        infantry:[...physical,...feet,...towers],
        vehicle:[...physical,...wheels,...decor,...towers]};
    });
    const result={at:this.time,buildings,towers,decor,infantryFacades,
      vehicleFacades,infantry:[...buildings,...infantryFacades,...towers],
      vehicle:[...buildings,...vehicleFacades,...decor,...towers],byOwner};
    this.movementCollision=result;
    return result;
  }
  /** Tower footprints are immutable for a match; reuse across AI and ticks. */
  private bastionNavigationCache?:{x:number;y:number;radius:number}[];
  bastionColliders():{x:number;y:number;radius:number}[]{
    return this.bastionNavigationCache??=
      bastionStructureColliders(this.territories,this.world.mapVersion);
  }
  spawn(owner:Faction,p:Point,kind:UnitKind='infantry'):Unit {
    while(this.bases.some(b=>b.id===this.nextId))this.nextId++;
    const u:Unit={id:this.nextId++,owner,kind,xp:0,x:p.x,y:p.y,hp:this.maxUnitHp({kind,owner}),orders:[],path:[],cooldown:0,facing:1,moving:false,hit:0,repath:0,
      angle:Math.PI/4,walkDistance:0,fire:0,previousX:p.x,previousY:p.y,lastAttacker:null,defendUntil:0,
       ...(kind==='scout'?{rocketAmmo:SCOUT_ROCKETS.maxAmmo,rocketCooldown:0}:{})};
    // The legacy supply kind is no longer offered by any production building.
    this.units.push(u);this.unitById.set(u.id,u);
    countDeployed(this.stats,owner,kind,this.count(owner));return u;
  }
  income(owner:Faction):number {
    return this.bases.filter(b=>b.owner===owner&&b.hp>0&&b.buildRemaining<=0).reduce((n,b)=>
      n+buildingSpec(b).income,0)+
      this.territories.filter(t=>t.owner===owner).reduce((n,t)=>n+bastionEffectiveIncome(t),0);
  }
  /** Spend real credits for exactly one extra Bastion income tier.
   * No home-sector rush: paid upgrades apply only to captured forward sites.
   */
  upgradeBastion(owner:Faction,id:number):boolean{
    const t=this.territories.find(t=>t.id===id);
    if(this.status!=='playing'||!t||this.credits[owner]<BASTION_UPGRADE_COST||
      !bastionUpgradable(t,owner,this.bases,
        campaignLayout(this.world.mapVersion,this.seed).headquarters))return false;
    this.credits[owner]-=BASTION_UPGRADE_COST;t.upgradeLevel=2;
    this.revision++;
    if(owner===0)this.notices.push(t.name+' auf Stufe 2: +'+bastionEffectiveIncome(t)+' Credits / 10 s');
    return true;
  }
  count(owner:Faction):number{return this.units.filter(u=>u.owner===owner&&u.hp>0).length;}
  queued(owner:Faction):number{return this.bases.filter(b=>b.owner===owner).reduce((n,b)=>n+b.queue.length,0);}
  producer(owner:Faction,kind:UnitKind):Base|undefined {
    if(this.needsHeadquarters(owner))return undefined;
    return this.bases.filter(b=>b.owner===owner&&b.hp>0&&b.buildRemaining<=0&&UNITS[kind].producers.includes(b.kind)&&b.queue.length<8).sort((a,b)=>a.queue.length-b.queue.length||a.id-b.id)[0];
  }
  recruit(baseId:number,kind?:UnitKind):boolean {
    const b=this.bases.find(b=>b.id===baseId);if(!b)return false;
    kind??=unitKinds.find(k=>UNITS[k].producers.includes(b.kind));const spec=kind?UNITS[kind]:undefined;
    if(this.needsHeadquarters(b.owner)||!kind||!spec||b.hp<=0||b.buildRemaining>0||!spec.producers.includes(b.kind)||this.status!=='playing'||b.queue.length>=8||this.credits[b.owner]<spec.cost||this.count(b.owner)+this.queued(b.owner)>=RULES.capacity)return false;
    b.queueCosts??=b.queueTypes.map(k=>UNITS[k].cost);b.queueCosts.push(spec.cost);
    this.credits[b.owner]-=spec.cost;b.queue.push(spec.buildTime);b.queueTypes.push(kind);
    if(this.testMode&&b.owner===0){
      this.credits[0]=Simulation.TEST_CREDITS;
      // Keep the canonical buildTime (save/validator compatibility). The
      // production tick completes it immediately, never a 0-second queue.
      if(b.queue.length===1)b.production=b.queue[0];
    }
    return true;
  }
  cancel(baseId:number,index?:number):void {
    const b=this.bases.find(b=>b.id===baseId);if(!b?.queue.length)return;
    const at=index===undefined?b.queue.length-1:index;if(at<0||at>=b.queue.length)return;
    b.queue.splice(at,1);const kind=b.queueTypes.splice(at,1)[0]??'infantry';this.credits[b.owner]+=b.queueCosts?.splice(at,1)[0]??UNITS[kind].cost;if(at===0||!b.queue.length)b.production=0;
  }
  /** A wall is long and narrow (109×30), not a circular 24-radius
   * building. Check the actual rotated footprint all the way to map borders
   * and never let a mesh pass over a blocked cliff/rock or an existing site.
   * Exploration and artificial sector polygon edges do not clip a perimeter.
   */
  private wallPlacementError(p:Point,facing:SiteFacing,kind:BuildingKind='wall'):string|null{
    // Wall-exclusive collision validation: gentle and substantial rolling
    // slopes are allowed, unlike rigid HQ/factory foundations. The entire
    // real mesh must still stay in bounds and never pass through blocked
    // rocks, cliff walls or sudden vertical precipices.
    const span=kind==='wallGate'?2:1;
    const terrainError=wallTerrainPlacementError(this.world,p,facing,span);
    if(terrainError)return terrainError;
    // Walls may TOUCH end-to-end. Overlapping foundations and all other
    // real building/repair footprints remain strictly forbidden.
    if(this.obstacles().some(b=>sitesVisuallyOverlap(
        kind,p,facing,b.kind,b,b.facing??0)))
      return 'Ein Gebäude oder eine vorhandene Mauer blockiert die Strecke.';
    if(this.territories.some(t=>siteNearBastion(kind,p,facing,t.point)))
      return 'Bastion oder Kontrollpunkt blockiert die Strecke.';
    const segments=wallColliderSamples({...p,kind,gateSpan:span},facing,24);
    if(this.units.some(u=>u.hp>0&&!u.carrier&&!unitSpec(u).flying&&
       segments.some(c=>distance(u,c)<c.radius+unitSpec(u).radius)))
      return 'Eine Einheit steht im Mauerverlauf.';
    return null;
  }
  buildError(owner:Faction,kind:BuildingKind,p:Point,facing:SiteFacing=0):string|null {
    const spec=BUILDINGS[kind];
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return 'Ungültiger Kartenbereich.';
    if(!spec||this.status!=='playing')return 'Dieses Gebäude kann hier nicht errichtet werden.';
    if(kind==='interceptor'&&!INTERCEPTOR_ENABLED)return 'Raketenabwehr derzeit deaktiviert.';
    // Walls are individual inexpensive, destructible segments. The old
    // global 40-building cap prevented drawing even half a long map border.
    // Bound the separate wall budget to protect saves and rendering instead.
    if(isWallLike(kind)?this.bases.filter(b=>isWallLike(b.kind)&&b.hp>0).length>=220:
      this.bases.filter(b=>!isWallLike(b.kind)&&b.hp>0).length>=40)
      return 'Gebäudelimit erreicht.';
    if(kind==='generator'&&this.bases.filter(b=>b.owner===owner&&b.kind==='generator'&&b.hp>0).length>=MAX_GENERATORS_PER_FACTION)
      return `Maximal ${MAX_GENERATORS_PER_FACTION} Energiekerne pro Fraktion.`;
    if(['barracks','factory','airfield','research','silo'].includes(kind)&&
       this.bases.some(b=>b.owner===owner&&b.kind===kind&&b.hp>0))
      return 'Dieses Gebäude oder seine Baustelle existiert bereits.';
    if(kind==='interceptor'&&this.bases.filter(b=>b.owner===owner&&b.kind===kind&&b.hp>0).length>=2)
      return 'Maximal zwei Raketenabwehr-Anlagen pro Fraktion.';
    if(kind==='headquarters'){
      if(this.bootstrapVersion!==1)return 'Dieses Gebäude kann hier nicht errichtet werden.';
      if(this.bases.some(b=>b.owner===owner&&b.kind==='headquarters'&&b.hp>0))return 'Ein Hauptquartier oder seine Baustelle existiert bereits.';
    }else if(!this.hasHeadquarters(owner))return 'Ein fertiggestelltes Hauptquartier ist erforderlich.';
    if(this.credits[owner]<spec.cost)return 'Zu wenig Credits.';
    // A dragged perimeter is allowed in any navigable part of the map,
    // including non-sector border bands. The individual wall footprint is
    // still tested against actual rocks, buildings, units and terrain.
    if(isWallLike(kind))return this.wallPlacementError(p,facing,kind);
    if(kind!=='headquarters'&&!this.hasExplored(owner,p))return 'Dieser Bauplatz ist noch nicht erforscht.';
    if(!this.world.walkable(p))return 'Felsen blockieren die Baustelle.';
    // build() later resolves the containing territory. A valid-looking
    // terrain tile outside all sector polygons previously caused an
    // unhandled TypeError at territory.id and could leave the entire WebGL
    // input/render loop unusable after trying to build farther from an airfield.
    if(!this.territories.some(t=>inside(p,t.polygon)))
      return 'Außerhalb eines bebaubaren Sektors.';
    if(this.world.generated?.battlefield&&!this.world.buildable(p,spec.radius))return 'Die Grundfläche ist zu steil oder uneben.';
    // Every terrain tile intersecting the circular footprint must have been explored.
    const cell=this.world.cell;
    for(let y=Math.floor((p.y-spec.radius)/cell);y<=Math.floor((p.y+spec.radius)/cell);y++)for(let x=Math.floor((p.x-spec.radius)/cell);x<=Math.floor((p.x+spec.radius)/cell);x++){
      const nearest={x:clamp(p.x,x*cell,(x+1)*cell),y:clamp(p.y,y*cell,(y+1)*cell)};
      if(distance(nearest,p)>spec.radius)continue;
      const q={x:(x+.5)*cell,y:(y+.5)*cell};
      if(kind!=='headquarters'&&!this.hasExplored(owner,q))return 'Die gesamte Grundfläche muss erforscht sein.';
      if(!this.world.walkable(q))return 'Felsen oder Kartenrand blockieren die Grundfläche.';
    }
    for(let i=0;i<32;i++)if(!this.world.walkable({x:p.x+Math.cos(i*Math.PI/16)*spec.radius,y:p.y+Math.sin(i*Math.PI/16)*spec.radius}))return 'Die gesamte Grundfläche muss frei sein.';
    // Authoritative faction-neutral ART clearance: the old radius ignored
    // extended runways, repair garages and bastion tower silhouettes. AI and
    // human players now share the same rotated site checks.
    // New WebGL maps have the 980-unit runway and external repair halls.
    // Legacy v0-v18 maintain their historic placement radius so old campaign
    // saves and compact classic maps remain fully playable/constructible.
    const expandedSites=this.world.mapVersion>=19;
    if(expandedSites&&siteExceedsMap(kind,p,facing,this.world.size))
      return 'Gebäude oder Landebahn ragen über den Kartenrand.';
    // The factory's SIDE garage and other rigid art extend far past their
    // collision circles: reject slopes/cliffs under the entire real mesh,
    // including after rotation. Prevent roofs embedded in dunes or suspended
    // above the desert while allowing the airfield's deformable runway.
    if(expandedSites&&this.world.generated?.battlefield&&
      !siteTerrainCompatible(kind,p,facing,this.world))
      return 'Bauplatz zu hügelig: Gebäude, Werkstatt oder Hangar benötigt ebenen Boden.';
    if(this.obstacles().some(b=>expandedSites
      ?sitesVisuallyOverlap(kind,p,facing,b.kind,b,b.facing??0)
      :distance(b,p)<constructionVisualClearance(kind,b.kind)))
      return 'Zu nah an einem anderen Gebäude.';
    if(this.territories.some(t=>expandedSites
      ?siteNearBastion(kind,p,facing,t.point)
      :distance(t.point,p)<spec.radius+45))
      return 'Bastion und Kontrollpunkt brauchen mehr Abstand.';
    // Placement and actual navigation must agree: the visible facade is wider
    // and offset north of Base.radius. A worker can otherwise be inside the
    // newly spawned factory wall before receiving its first build order.
    const infantryFacade=infantryStructureCollider(kind,p),vehicleFacade=vehicleStructureCollider(kind,p);
    if(this.units.some(u=>{
      if(u.hp<=0||u.carrier||unitSpec(u).flying)return false;
      const facade=unitSpec(u).group==='Fahrzeuge'?vehicleFacade:infantryFacade;
      const colliders=[facade]; // walls returned from wallPlacementError() above
      return colliders.some(c=>distance(u,c)<c.radius+unitSpec(u).radius);
    }))return 'Einheiten blockieren die Baustelle.';
    return null;
  }
  build(owner:Faction,kind:BuildingKind,p:Point,workerIds?:number[],facing:0|1|2|3=0,append=false):Base|null {
    if(this.buildError(owner,kind,p,facing))return null;
    const workers=this.units.filter(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0&&!u.carrier&&(!workerIds||workerIds.includes(u.id)));
    if(!workers.length)return null;
    const spec=BUILDINGS[kind],territory=this.territories.find(t=>inside(p,t.polygon))??
      (isWallLike(kind)?[...this.territories].sort((a,b)=>
       distance(a.point,p)-distance(b.point,p))[0]:undefined);
    if(!territory){this.notices.push('Bauplatz liegt außerhalb eines Sektors.');return null;}
    let id=1000;while(this.bases.some(b=>b.id===id)||this.units.some(u=>u.id===id))id++;
    const instant=owner===0&&this.testMode;
    const b:Base={id,owner,kind,...p,hp:instant?spec.hp:spec.hp*.25,territory:territory.id,radius:spec.radius,queue:[],queueTypes:[],production:0,buildRemaining:instant?0:spec.buildTime,cooldown:0,rally:null,
      ...(kind==='silo'?{siloCharge:SILO_CHARGE_SECONDS}:{}),
      ...(kind==='interceptor'?{interceptorAmmo:INTERCEPTOR_MAX_AMMO}:{}),
      ...(facing!==0?{facing}:{}),
      ...(kind==='wallGate'?{gateSpan:2 as const}:{})};
    this.bases.push(b);
    if(!instant&&!this.command(workers.map(u=>u.id),{...p,kind:'build',target:id},append)){
      this.bases.pop();this.notices.push('Kein ausgewählter Pionier kann diese Baustelle erreichen.');return null;
    }
    // Only a successfully placed site qualifies. Keep the historical bit
    // after its HP reaches zero or the construction is later canceled.
    this.hadBuildings[owner]=true;
    this.credits[owner]-=spec.cost;
    if(instant){
      this.credits[0]=Simulation.TEST_CREDITS;
      this.notices.push('Gebäude fertiggestellt: '+spec.name+'.');
    }
    this.updateVision();return b;
  }
  cancelConstruction(id:number):boolean {
    const b=this.bases.find(b=>b.id===id);if(!b||b.buildRemaining<=0||b.hp<=0)return false;
    this.credits[b.owner]+=Math.floor(buildingSpec(b).cost*.75);this.bases=this.bases.filter(b=>b.id!==id);
    for(const u of this.units){const active=u.orders[0]?.target===id;u.orders=u.orders.filter(o=>o.target!==id);if(active||u.workingTarget===id){u.workingTarget=null;u.path=[];u.repath=0;}}
    this.updateVision();return true;
  }
  /** Explicit player demolition. This is NOT weapon damage: no artificial
   * shot, kill XP, friendly-fire or combat AI reaction is introduced.
   * Existing construction cancellations keep their original 75% refund.
   * Completed structures have no refund and are removed from pathing/saves
   * immediately, while WebGL presents the cosmetic collapse independently.
   */
  demolishBuilding(id:number,owner:Faction=0):boolean {
    if(this.status!=='playing')return false;
    const b=this.bases.find(site=>site.id===id&&site.owner===owner&&site.hp>0);
    if(!b)return false;
    if(b.buildRemaining>0){
      const cancelled=this.cancelConstruction(id);
      if(cancelled)this.notices.push('Baustelle abgebrochen: '+buildingSpec(b).name+'.');
      return cancelled;
    }
    if(b.kind==='bunker')this.destroyBunkerGarrison(b);
    b.hp=0;b.queue=[];b.queueTypes=[];b.queueCosts=[];
    b.production=0;b.rally=null;
    this.bases=this.bases.filter(site=>site.id!==id);
    // A destroyed factory/airfield must not keep the paid unit on its
    // demolition site's invisible service deck or release a ghost aircraft.
    for(let i=this.productionReleases.length-1;i>=0;i--)
      if(this.productionReleases[i].baseId===id){
        this.cancelProductionDeparture(this.productionReleases[i].unitId);
        this.productionReleases.splice(i,1);
      }
    for(const u of this.units){
      if(u.factoryService?.baseId===id||u.airfieldService?.baseId===id){
        delete u.factoryService;delete u.airfieldService;
        u.path=[];u.repath=0;
      }
      if(u.orders.some(o=>o.target===id)||u.workingTarget===id){
        const active=u.orders[0]?.target===id;
        u.orders=u.orders.filter(o=>o.target!==id);
        if(active||u.workingTarget===id){
          u.path=[];u.repath=0;u.workingTarget=null;
        }
      }
    }
    this.movementCollision=undefined;
    this.updateVision();
    this.notices.push('Gebäude abgerissen: '+buildingSpec(b).name+'.');
    return true;
  }
  /** Five real soldiers enter an owned bunker by normal exterior pathing.
   * Queued seats are reserved, so simultaneous RMB orders cannot overbook.
   */
  boardBunker(baseId:number,ids:number[]):number {
    const b=this.bases.find(b=>b.id===baseId&&b.kind==='bunker'&&
      b.hp>0&&b.buildRemaining<=0);
    if(!b||this.status!=='playing')return 0;
    let accepted=0;
    for(const u of this.units.filter(u=>ids.includes(u.id)&&u.hp>0&&!u.carrier)){
      if(!bunkerCanBoard(b,u,this.units))continue;
      const point=bunkerApproach(b,u);
      const exterior=this.world.nearest(point,
        [...this.obstacles(),...infantryStructureColliders(this.obstacles()),
         ...this.bastionColliders()],[],u,Math.max(0,unitSpec(u).radius-10));
      if(!exterior||distance(exterior,b)>b.radius+110)continue;
      u.orders=[{kind:'garrison',target:b.id,...exterior}];
      u.path=[];u.repath=0;u.hold=false;u.guardArea=false;
      u.workingTarget=null;u.combatTarget=null;u.pursuitOrigin=null;
      accepted++;
    }
    return accepted;
  }
  /** Exit selected troops or the full roster at the bunker door. Soldiers
   * retain all paid upgrades, HP and veterancy, with normal collisions.
   */
  unloadBunker(baseId:number,passengerId?:number):number {
    const b=this.bases.find(b=>b.id===baseId&&b.kind==='bunker'&&
      b.hp>0&&b.buildRemaining<=0);
    if(!b||this.status!=='playing')return 0;
    const roster=bunkerGarrisonedUnits(b,this.units).filter(u=>
      passengerId===undefined||u.id===passengerId);
    let released=0;
    const obstacles=[...this.obstacles(),
      ...infantryStructureColliders(this.obstacles()),...this.bastionColliders()];
    for(const u of roster){
      const spot=bunkerExitPoints(b).find(p=>
        this.world.walkable(p,obstacles,Math.max(0,unitSpec(u).radius-10))&&
        this.units.every(v=>v.id===u.id||v.hp<=0||v.carrier||
          unitSpec(v).flying||distance(v,p)>unitSpec(v).radius+unitSpec(u).radius+5));
      if(!spot)continue;
      b.garrison=b.garrison?.filter(id=>id!==u.id);
      delete u.carrier;u.x=u.previousX=spot.x;u.y=u.previousY=spot.y;
      u.orders=[];u.path=[];u.repath=0;u.moving=false;
      u.hold=true;u.guardArea=true;u.combatTarget=null;
      released++;
    }
    if(released){this.spatial.rebuild(this.units);this.updateVision();}
    return released;
  }
  /** Destruction and intentional demolition both kill every trapped soldier.
   * Never respawn, reimburse, or auto-evacuate a destroyed garrison.
   */
  private destroyBunkerGarrison(b:Base):void {
    // The structure already has 0 HP when a projectile destroys it: select
    // by the authoritative manifest, not a live-bunker-only helper.
    const occupants=new Set(b.garrison??[]);
    for(const u of this.units.filter(u=>occupants.has(u.id)&&u.carrier===b.id)){
      u.hp=0;u.orders=[];u.path=[];delete u.carrier;
      this.tactical.loss(u);
    }
    b.garrison=[];
    for(const u of this.units)if(u.orders[0]?.kind==='garrison'&&
      u.orders[0].target===b.id){u.orders.shift();u.path=[];u.repath=0;}
  }
  /** Soldiers fire only at actual visible enemies using their own weapons,
   * current HP, research and cooldowns. No garrison-wide free turret DPS.
   */
  private bunkerDefensiveFire(dt:number):void {
    for(const b of this.bases)if(b.kind==='bunker'&&b.hp>0&&
      b.buildRemaining<=0&&b.garrison?.length){
      const roster=bunkerGarrisonedUnits(b,this.units);
      for(const u of roster){
        u.cooldown=Math.max(0,u.cooldown-dt);
        if(u.cooldown>0||unitSpec(u).damage<=0)continue;
        const maxRange=bunkerTargetRange(u);
        const enemy=this.spatial.query(b,maxRange).filter(v=>
          v.owner!==b.owner&&v.hp>0&&!v.carrier&&
          distance(b,v)<=maxRange&&canAttack(u,v)&&
          this.canSee(b.owner,v)&&this.world.sightLine(b,v))
          .sort((a,z)=>distance(b,a)-distance(b,z)||a.id-z.id)[0];
        if(!enemy)continue;
        const spec=unitSpec(u);
        u.cooldown=spec.cooldown/getVeterancyModifiers(u).fireRate;
        const weapon:Weapon=u.kind==='rocket'?'rocket':
          u.kind==='heavy'?'heavy':u.kind==='infantry'?'rifle':'pistol';
        // Keep each soldier's own source ID and ordinary hit/miss rules.
        if(u.kind==='rocket')this.launch(u,enemy);
        else this.damage(u,enemy,weaponDamage(u,enemy)*
          getVeterancyModifiers(u).damage,weapon,
          {x:b.x,y:b.y-35});
        u.fire=.18;u.angle=Math.atan2(enemy.y-b.y,enemy.x-b.x);
      }
    }
  }
  command(ids:number[],order:Order,append=false):number {
    if(order.kind==='board'){
      const base=this.bases.find(b=>b.id===order.target&&b.kind==='bunker');
      return base?this.boardBunker(base.id,ids):this.transports.board(order.target??-1,ids);
    }
    if(!Number.isFinite(order.x)||!Number.isFinite(order.y))return 0;
    const candidates=this.units.filter(u=>ids.includes(u.id)&&u.hp>0&&!u.carrier);
    // Any new command cancels a queued return to a busy bomber hangar.
    // The return-base toolbar sets the flag only AFTER this move is issued.
    for(const u of candidates){
      u.returnToHangar=false;
      // No automatic supply routes can override an explicit command.
    }
    // A manual reposition always wins over workshop autopilot. Ground vehicles
    // can leave even before full repair; planes must physically take off first.
    // Never teleport a landed bomber back to cruise altitude on order.
    let launched=0;
    if(!append)for(const u of candidates){
      if(u.factoryService){
        // The player explicitly took control; otherwise the 30 % autopilot
        // would immediately grab the unit again on the following fixed tick.
        u.autoFactoryRepair=false;
        delete u.factoryService;u.path=[];u.repath=0;
      }
      const service=u.airfieldService;
      if(!service)continue;
      u.autoAirfieldRepair=false; // explicit pilot order overrides automatic return
      if(service.phase==='approach'){
        delete u.airfieldService;u.flightHeight=1;u.path=[];u.repath=0;
      }else{
        u.orders=[{...order}];u.path=[];u.repath=0;u.hold=false;u.guardArea=false;
        if(service.phase==='repair'||service.phase==='ready'){
          service.phase='takeoff';service.elapsed=0;
        }
        // Landing/taxi continue safely; start the departure as soon as
        // the real unit reaches the hangar instead of jumping to the runway.
        launched++;
      }
    }
    const members=candidates.filter(u=>!u.airfieldService&&!u.factoryService);
    if(!append)for(const u of members)if(u.kind==='bomber')delete u.bomberRun;
    // A direct player or AI override interrupts any staged garage departure.
    // Initial automatic rally is issued before its hold is registered.
    for(const u of members)this.cancelProductionDeparture(u.id);
    const armoredFront=members.filter(u=>u.kind==='tank'||u.kind==='rover');
    const fighters=members.filter(u=>u.kind!=='medic'&&u.kind!=='engineer'&&!unitSpec(u).flying);
    // On modern 3D maps place fragile long-range specialists BEHIND real
    // frontline infantry, unless the player selected only rocket units.
    // Legacy formations, armored vanguards and solo orders are unchanged.
    const realFront=fighters.filter(u=>!['rocket','artillery'].includes(u.kind));
    const longRangeRear=this.world.mapVersion>=23&&realFront.length>0;
    const front=armoredFront.length?armoredFront:longRangeRear?realFront:fighters;
    const support=members.filter(u=>u.kind==='medic'||u.kind==='engineer');
    const rearFighters=armoredFront.length||longRangeRear?
      members.filter(u=>['infantry','heavy','rocket','artillery'].includes(u.kind)&&!front.includes(u)):[];
    const mixed=front.length>0&&(support.length>0||rearFighters.length>0)&&['move','attackMove','attack'].includes(order.kind);
    // A player-selected ground squad marches at the pace of its slowest
    // surviving member. The existing march metadata makes this deterministic,
    // supports mixed tanks/infantry/support and avoids new save fields.
    // AI, single-unit orders and aircraft retain their established speeds.
    const playerGround=members.filter(u=>u.owner===0&&!unitSpec(u).flying);
    const playerMarch=['move','attackMove'].includes(order.kind)&&playerGround.length>1
      ?playerGround.map(u=>u.id):null;
    const origin={x:front.reduce((n,u)=>n+u.x,0)/Math.max(1,front.length),y:front.reduce((n,u)=>n+u.y,0)/Math.max(1,front.length)},length=distance(origin,order)||1;
    const heading={x:(order.x-origin.x)/length,y:(order.y-origin.y)/length};
    if(mixed){const priority=(u:Unit)=>u.kind==='tank'?0:u.kind==='rover'?1:u.kind==='infantry'||u.kind==='heavy'?2:u.kind==='rocket'?3:u.kind==='artillery'?4:5;
      members.sort((a,b)=>priority(a)-priority(b)||a.id-b.id);}
    const width=Math.ceil(Math.sqrt(members.length)),pitch=formationSlotPitch(members);
    const slots=members.map((_,i)=>({x:i%width*pitch,y:Math.floor(i/width)*pitch}));
    // Centre the actual occupied slots, including a short last row. Using the
    // column count for both axes shifted a two-unit group north of its target.
    const center={x:slots.reduce((n,p)=>n+p.x,0)/Math.max(1,members.length),y:slots.reduce((n,p)=>n+p.y,0)/Math.max(1,members.length)};
    let accepted=launched;
    members.forEach((u,i)=>{
      if(['heal','repair','build'].includes(order.kind)){
        const entity=order.kind==='heal'?this.units.find(t=>t.id===order.target):order.kind==='repair'?this.bases.find(t=>t.id===order.target)??this.units.find(t=>t.id===order.target):this.bases.find(t=>t.id===order.target);
        if(!entity||!this.supportEligible(u,entity,order.kind))return;
        // Buildings need a route to the worker's approach, not merely a free
        // point beside the foundation. Try the other sides before rejecting
        // a legal site because the first approach lies behind another building.
        const approach=this.supportApproach(u,entity,'queue' in entity);if(!approach)return;
        const next:Order={...order,x:entity.x,y:entity.y,...('queue' in entity?{approach}:{healOrigin:{x:entity.x,y:entity.y}})};
        if(append){if(u.orders.length>=32)return;u.orders.push(next);}else{u.orders=[next];u.path=[];u.repath=0;delete u.burst;}
        // Enqueuing future maintenance must not interrupt the work in progress.
        if(!append){u.hold=false;u.guardArea=false;u.supportPaused=false;u.combatTarget=null;u.pursuitOrigin=null;}
        accepted++;return;
      }
      let offset={x:slots[i].x-center.x,y:slots[i].y-center.y};
      let formation:Formation|undefined;
      if(mixed){
        if(support.includes(u)||rearFighters.includes(u)){
          const helper=support.includes(u),group=helper?support:rearFighters;
          const index=group.indexOf(u),columns=Math.min(3,group.length),lane=(index%columns-(columns-1)/2)*34;
          const rear=(armoredFront.length?
            (helper?200:u.kind==='artillery'?150:u.kind==='rocket'?126:86):
            (helper?94:u.kind==='artillery'?150:u.kind==='rocket'?115:72))+
            Math.floor(index/columns)*36;
          formation={front:front.map(v=>v.id),...(armoredFront.length?{fallback:rearFighters.filter(v=>v.kind==='infantry'||v.kind==='heavy'||v.kind==='rocket').map(v=>v.id)}:{}),heading,origin,goal:{x:order.x,y:order.y},lane,rear};
          offset={x:-heading.x*rear-heading.y*lane,y:-heading.y*rear+heading.x*lane};
        }else{
          const index=front.indexOf(u),columns=Math.ceil(Math.sqrt(front.length));
          const spacing=formationSlotPitch(front);
          const lane=(index%columns-(columns-1)/2)*spacing,depth=-Math.floor(index/columns)*spacing;
          offset={x:heading.x*depth-heading.y*lane,y:heading.y*depth+heading.x*lane};
        }
      }
      // Bastion right-clicks are capture orders: even a 48-unit formation must
      // stop INSIDE the capture circle, not in decorative slots beyond it.
      const captureSite=this.territories.some(t=>distance(t.point,order)<1);
      if(captureSite){const length=Math.hypot(offset.x,offset.y),limit=RULES.captureRadius-30;
        if(length>limit){offset={x:offset.x*limit/length,y:offset.y*limit/length};}}
      const spec=unitSpec(u),p={x:order.x+offset.x,y:order.y+offset.y};
      const buildings=this.navigationBases(u.owner),towers=this.bastionColliders();
      const gatePosts=friendlyGatePostColliders(this.obstacles(),u.owner);
      const obstacles=spec.flying?buildings:spec.group==='Infanterie'
         ?[...buildings,...infantryStructureColliders(buildings),...gatePosts,...towers]
         :[...buildings,...vehicleStructureColliders(buildings),...gatePosts,
           ...this.vehicleDecorObstacles(),...towers];
       // A click onto the steep rock lip must resolve to a destination that
       // the unit's entire footprint can actually occupy. Otherwise path()
       // finds nearby safe ground but the order never reaches its <18 goal.
       const grade=spec.group==='Fahrzeuge'&&!spec.flying&&this.world.mapVersion>=23
         ?u.kind==='tank'?.215:u.kind==='artillery'?.185:.195:Infinity;
       const target=spec.flying?{x:clamp(p.x,8,this.world.size-8),y:clamp(p.y,8,this.world.size-8)}
         :this.world.nearest(p,obstacles,[],u,Math.max(0,spec.radius-10),grade);
       if(!target)return;
      const next:Order={...order,...target,...(playerMarch&&u.owner===0&&!spec.flying?{march:playerMarch}:mixed&&front.includes(u)?{march:(armoredFront.length?members.filter(v=>!unitSpec(v).flying):front).map(v=>v.id)}:{}),...(formation?{formation,...(support.includes(u)?{kind:order.kind==='attack'?'attackMove':order.kind,target:undefined}:{})}:{})};u.hold=false;u.guardArea=false;u.supportPaused=false;u.workingTarget=null;
      if(append){if(u.orders.length<32)u.orders.push(next);else return;}
      else {this.transports.cancel(u);delete u.burst;u.orders=formation&&u.orders[0]?.kind==='heal'?[u.orders[0],next]:[next];u.path=[];u.repath=0;u.combatTarget=null;u.pursuitOrigin=null;
        if(u.kind==='tank'&&!u.moving)u.driveSpeed=0;}
      if(u.transport&&u.transport.phase!=='cruise'){u.transport.resume=structuredClone(u.orders);u.orders=[];}
      accepted++;
    });return accepted;
  }
  /** Explain physical capture gating without altering the fixed-tick capture rules.
   * The same radius, defender contest and enemy-HQ rules govern ownership. */
  captureReadiness(t:Territory,owner:Faction=0):CaptureReadiness {
    if(t.owner===owner)return 'owned';
    const friendly=this.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier&&u.kind!=='drone');
    if(!friendly.length)return 'no-unit';
    const radius=capturePresenceRadius(this.world.mapVersion);
    const inside=friendly.some(u=>distance(u,t.point)<=radius);
    if(!inside)return friendly.some(u=>distance(u,t.point)<=radius+120)?'out-of-range':'no-unit';
    if(this.units.some(u=>u.owner!==owner&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&distance(u,t.point)<=radius))return 'contested';
    if(this.bases.some(b=>b.kind==='headquarters'&&b.territory===t.id&&b.owner!==owner&&b.hp>0))return 'enemy-hq';
    return 'capturing';
  }
  stop(ids:number[],hold=false,guardArea=false):void {for(const u of this.units)if(ids.includes(u.id)){u.returnToHangar=false;if(u.kind==='bomber')delete u.bomberRun;this.cancelProductionDeparture(u.id);this.transports.cancel(u);u.orders=[];u.path=[];u.repath=0;u.moving=false;if(u.kind==='tank')u.driveSpeed=0;u.pursuitOrigin=null;u.combatTarget=null;u.hold=hold||u.kind==='engineer';u.guardArea=hold&&guardArea;u.supportPaused=false;u.workingTarget=null;delete u.burst;}}
  private supportEligible(u:Unit,target:Unit|Base,kind:string):boolean {
    if(target.hp<=0||('orders' in target&&target.carrier)||target.owner!==u.owner)return false;
    if(kind==='heal')return u.kind==='medic'&&'orders' in target&&unitSpec(target).group==='Infanterie'&&target.hp<this.maxUnitHp(target);
    if(kind==='repair'&&u.kind==='engineer'&&'orders' in target)
      return target.id!==u.id&&(unitSpec(target).group==='Fahrzeuge'||unitSpec(target).flying)&&target.hp<this.maxUnitHp(target);
    return u.kind==='engineer'&&'queue' in target&&(kind==='build'?target.buildRemaining>0:target.buildRemaining<=0&&target.hp<buildingSpec(target).hp);
  }
  private supportApproach(u:Unit,target:Unit|Base,requireReachable=false,startSide=0):Point|null {
    const radius='queue' in target?target.radius+32:35,angle=Math.atan2(u.y-target.y,u.x-target.x),range='queue' in target?target.radius+55:u.kind==='engineer'?REPAIR_RADIUS:this.healRadius(u);
    const buildings=this.navigationBases(u.owner),routeObstacles=[
      ...buildings,...infantryStructureColliders(buildings),
      ...friendlyGatePostColliders(this.obstacles(),u.owner)],
      obstacles=[...routeObstacles,...this.bastionColliders()];
    if('queue' in target){
      const gap=distance(u,target);
      // A pioneer already in repair/build range needs no separate standing
      // point. Otherwise a nearby building can hide every sampled approach
      // even though the worker can legally build from the current position.
      if(gap<=range&&this.world.line(u,target))return {x:u.x,y:u.y};
      // A worker just outside range must only take a short, physically valid
      // step inward. Snapping the endpoint to a coarse grid centre could put
      // all of the candidate approaches outside the actual interaction ring.
      if(gap>range&&gap<=range+this.world.cell*.5){
        const p={x:target.x+(u.x-target.x)*(range-6)/gap,
          y:target.y+(u.y-target.y)*(range-6)/gap};
        if(this.world.walkable(p,obstacles)&&this.world.line(p,target)&&
          (!requireReachable||this.world.path(u,p,routeObstacles).length>0))return p;
      }
    }
    for(let i=0;i<16;i++){
      const side=(i+startSide)%16;
      const turn=angle+(side%2?1:-1)*Math.ceil(side/2)*Math.PI/8;
      const p=this.world.nearest({x:target.x+Math.cos(turn)*radius,y:target.y+Math.sin(turn)*radius},obstacles,[],u);
      if(!p||distance(p,target)>range||!this.world.line(p,target))continue;
      if(requireReachable&&distance(u,target)>range){
        const path=this.world.path(u,p,routeObstacles);
        if(!path.length||distance(path[path.length-1],target)>range)continue;
      }
      return p;
    }
    return null;
  }
  /** AI-only construction recovery. A cached approach can become blocked
   * after another structure or unit moves into the way. Try a DIFFERENT,
   * reachable side before asking the director to reassign the idle pioneer.
   * Real enemy fire still takes precedence; no construction speed bonus. */
  private recoverStalledAiBuilder(u:Unit,site:Base,order:Order):boolean {
    if(u.owner!==1||u.kind!=='engineer'||u.hold||
       u.defendUntil>this.time)return false;
    if(distance(u,site)<=site.radius+55&&this.world.line(u,site)){
      this.aiBuilderProgress.delete(u);return false;
    }
    let s=this.aiBuilderProgress.get(u);
    if(!s||s.site!==site.id){
      s={site:site.id,x:u.x,y:u.y,remaining:site.buildRemaining,
         since:this.time,retries:0};
      this.aiBuilderProgress.set(u,s);return false;
    }
    if(distance(u,s)>=8||site.buildRemaining<s.remaining-.04){
      s.x=u.x;s.y=u.y;s.remaining=site.buildRemaining;
      s.since=this.time;s.retries=0;return false;
    }
    if(this.time-s.since<5)return false;
    s.since=this.time;s.retries++;
    // The original approach may be physically reachable only before new
    // facades/obstacles appeared. Recheck LOS and full path before adopting.
    const approach=this.supportApproach(u,site,true,s.retries*3);
    if(approach){
      order.approach=approach;
      u.path=[];u.repath=0;u.exactPath=true;
      return false;
    }
    u.path=[];u.repath=0;u.exactPath=true;
    if(s.retries>=3){
      // No physically reachable building face: relinquish the stale job.
      // The paid site remains intact and the AI may select another worker.
      u.orders.shift();u.workingTarget=null;u.hold=false;
      this.aiBuilderProgress.delete(u);
      return true;
    }
    return false;
  }
  /** Rear support follows the slowest surviving front rank, rather than racing to the destination. */
  private escort(u:Unit,dt:number):boolean {
    const order=u.orders[0],formation=order?.formation;
    if(!formation||!['medic','engineer','infantry','heavy','rocket','artillery'].includes(u.kind))return false;
    const recovering=u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'
      ?this.tactical.state.recovering:undefined;
    let front=this.units.filter(v=>formation.front.includes(v.id)&&v.owner===u.owner&&v.hp>0&&!recovering?.includes(v.id));
    const armorStillLeading=front.length>0;
    if(!front.length&&formation.fallback?.length)
      front=this.units.filter(v=>formation.fallback!.includes(v.id)&&v.owner===u.owner&&v.hp>0&&!recovering?.includes(v.id));
    if(!front.length){u.orders.shift();u.path=[];u.repath=0;u.workingTarget=null;return true;}
    const h=formation.heading,project=(p:Point)=>(p.x-formation.origin.x)*h.x+(p.y-formation.origin.y)*h.y;
    const progress=Math.min(...front.map(project)),lateral=front.reduce((n,v)=>n+(v.x-formation.origin.x)*-h.y+(v.y-formation.origin.y)*h.x,0)/front.length;
    const rearDistance=armorStillLeading?formation.rear:Math.min(formation.rear,72);
    const rear={x:formation.origin.x+h.x*(progress-rearDistance)-h.y*(lateral+formation.lane),y:formation.origin.y+h.y*(progress-rearDistance)+h.x*(lateral+formation.lane)};
    const fighter=u.kind==='infantry'||u.kind==='heavy'||u.kind==='rocket'||u.kind==='artillery';
    // Attack-move ranks may fire while remaining behind the vehicles.
    if(fighter&&order?.kind!=='move'&&this.acquire(u))return false;
    u.workingTarget=null;u.combatTarget=null;u.pursuitOrigin=null;
    const safe=(p:Point)=>project(p)<=progress-32&&this.units.every(enemy=>enemy.hp<=0||enemy.carrier||enemy.owner===u.owner||!this.canSee(u.owner,enemy)||distance(p,enemy)>Math.min(unitSpec(enemy).range+12,distance(u,enemy)+2));
    const medic=u.kind==='medic',workKind=medic?'heal':'repair';
    const patient=fighter?undefined:this.spatial.query(u,115).filter(v=>v.id!==u.id&&this.supportEligible(u,v,workKind)&&project(v)<=progress+35).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id)[0];
    const canWork=u.defendUntil<=this.time||medic;
    if(!patient&&canWork&&!fighter){if(medic)this.healNearby(u,dt);else this.repairNearby(u,dt);}
    if(medic&&!patient&&u.defendUntil>this.time&&this.acquire(u))return false;
    let destination=rear;
    if(patient){
      const range=medic?this.healRadius(u):REPAIR_RADIUS;
      if(canWork&&distance(u,patient)<=range&&this.world.line(u,patient)){
        if(medic)this.healNearby(u,dt);else this.repairNearby(u,dt,patient.id);
        u.workingTarget=patient.id;u.path=[];u.angle=Math.atan2(patient.y-u.y,patient.x-u.x);return true;
      }
      const approach={x:patient.x-h.x*45,y:patient.y-h.y*45};if(safe(approach))destination=approach;
    }
    if(distance(u,destination)>12){
      if(u.repath<=0)u.path=[];
      const buildings=this.obstacles(),towers=this.bastionColliders();
      const obstacles=unitSpec(u).group==='Infanterie'
         ?[...buildings,...infantryStructureColliders(buildings),...towers]
         :[...buildings,...vehicleStructureColliders(buildings),...this.vehicleDecorObstacles(),...towers];
       const target=this.world.nearest(destination,obstacles,[],u);
      // A tank moves its rear escort point every tick. Keeping the old
      // seven-tenths-second path to that moving point leaves legacy assault
      // infantry trailing the armor even on clear terrain. Only refresh when
      // its path endpoint is materially stale; modern campaign and manual
      // formations retain their existing cadence and obstacle rules.
      if(target&&fighter&&u.owner===1&&this.world.mapVersion<=2&&
        order?.tactical?.mode==='assault'&&
        (u.path.length
          ? distance(u.path[u.path.length-1],target)>18
          : distance(u,target)>12)){
        // The escort point moves with the tank. Replan both a stale *live*
        // route and an already-consumed route immediately; otherwise the
        // normal 0.7s retry timer makes rear ranks stand still on open ground.
        u.path=[];u.repath=0;
      }
      if(target){const before={x:u.x,y:u.y},walk=u.walkDistance;// Pioneers match the squad pace even when a nearby vehicle needs repair;
        // an isolated pioneer (without formation) still uses its full catalog speed.
        // A legacy AI rifleman who fell behind the moving tank can use his
        // real running speed to close the gap. Escort's forward-projection
        // clamp still prevents crossing the armored front, and the standard
        // shared pace resumes as soon as the intended rank gap is restored.
        // Player, heavy infantry and modern map formations are unchanged.
        const formationCatchUp=u.owner===1&&this.world.mapVersion<=2&&
          u.kind==='infantry'&&order?.tactical?.mode==='assault'&&
          progress-project(u)>rearDistance+16&&distance(u,target)>24;
        this.move(u,target,dt,
          medic&&patient||formationCatchUp
            ?unitSpec(u).speed
            :Math.min(...front.map(v=>unitSpec(v).speed)),
          formationCatchUp);
        if(project(u)>progress-32&&project(u)>project(before)){u.x=before.x;u.y=before.y;u.walkDistance=walk;u.moving=false;u.path=[];}
      }
    }else{u.path=[];if(front.every(v=>!v.orders.length)&&distance(u,rear)<18)u.orders.shift();}
    return true;
  }

  /** Work uses simulated time and target IDs; idle support never pursues distant targets. */
  private support(u:Unit,dt:number):boolean {
    u.workingTarget=null;u.supportPaused=false;
    if(u.kind!=='medic'&&u.kind!=='engineer')return false;
    const order=u.orders[0],explicit=order&&['heal','repair','build'].includes(order.kind);
    if(order&&!explicit)return false;
    if(u.hold&&u.guardArea)return false; // STOPP guards in place instead of taking support assignments.
    let target:Unit|Base|undefined;
    if(explicit){
      target=order.kind==='heal'?this.units.find(t=>t.id===order.target):order.kind==='repair'?this.bases.find(t=>t.id===order.target)??this.units.find(t=>t.id===order.target):this.bases.find(t=>t.id===order.target);
      if(!target||!this.supportEligible(u,target,order.kind)){u.orders.shift();u.path=[];u.repath=0;return true;}
      if(order.kind==='heal'){order.healOrigin??={x:order.x,y:order.y};if(distance(target,order.healOrigin)>160&&distance(u,target)>this.healRadius(u)){u.path=[];u.supportPaused=true;return false;}}
      order.x=target.x;order.y=target.y;
    }else if(u.kind==='medic'){
      target=this.spatial.query(u,this.healRadius(u)).filter(t=>this.supportEligible(u,t,'heal')&&(t.id!==u.id||u.defendUntil<=this.time)).sort((a,b)=>a.hp/unitSpec(a).hp-b.hp/unitSpec(b).hp||a.id-b.id)[0];
    }else{
      const damagedVehicles=this.spatial.query(u,REPAIR_RADIUS).filter(v=>this.supportEligible(u,v,'repair')&&distance(u,v)<=REPAIR_RADIUS&&this.world.line(u,v));
      const damagedBuildings=this.bases.filter(b=>this.supportEligible(u,b,'repair')&&distance(u,b)<=b.radius+55);
      target=[...damagedVehicles,...damagedBuildings].sort((a,b)=>
        a.hp/('orders' in a?unitSpec(a).hp:buildingSpec(a).hp)-b.hp/('orders' in b?unitSpec(b).hp:buildingSpec(b).hp)||a.id-b.id)[0];
    }
    if(!target)return false;
    if(explicit&&order?.kind==='build'&&'queue' in target&&
       this.recoverStalledAiBuilder(u,target,order))return true;
    // A recently attacked worker pauses construction/repair to defend itself.
    if(u.kind==='engineer'&&u.defendUntil>this.time)return false;
    const range='queue' in target?target.radius+55:u.kind==='engineer'?REPAIR_RADIUS:this.healRadius(u);
    if(distance(u,target)>range||!this.world.line(u,target)){
      if(explicit&&!u.hold){if(u.repath<=0)u.path=[];const buildings=this.obstacles();const p=order?.approach&&this.world.walkable(order.approach,[...buildings,...infantryStructureColliders(buildings),...this.bastionColliders()])&&this.world.line(order.approach,target)?order.approach:this.supportApproach(u,target,true);if(p)this.move(u,p,dt);}
      return true;
    }
    u.path=[];u.combatTarget=null;u.pursuitOrigin=null;u.workingTarget=target.id;
    u.angle=Math.atan2(target.y-u.y,target.x-u.x);u.facing=target.x<u.x?-1:1;
    if('orders' in target){
      if(u.kind==='medic'){if(!this.healNearby(u,dt)){u.workingTarget=null;return false;}}
      else if(!this.repairNearby(u,dt,explicit&&order?.kind==='repair'?target.id:undefined)){u.workingTarget=null;return false;}
    }
    else if(target.buildRemaining<=0){const before=target.hp;target.hp=Math.min(buildingSpec(target).hp,target.hp+12*getVeterancyModifiers(u).repairRate*dt);gainUnitXp(u,(target.hp-before)*XP_RULES.repair,'repair');this.work('repair',u.id,target.id,target.hp-before);}
    return true;
  }
  /** Shared 18 HP/s maintenance across all damaged friendly vehicles and aircraft within 90 M.
   * Never moves the engineer, ignores transports' embarked units, and respects obstacles. */
  private repairNearby(u:Unit,dt:number,onlyTarget?:number):boolean {
    const vehicles=this.spatial.query(u,REPAIR_RADIUS).filter(v=>
      (onlyTarget===undefined||v.id===onlyTarget)&&this.supportEligible(u,v,'repair')&&distance(u,v)<=REPAIR_RADIUS&&this.world.line(u,v));
    if(!vehicles.length)return false;
    const total=vehicles.reduce((sum,v)=>sum+(v.hp/this.maxUnitHp(v)<.5?2:1),0);
    let repaired=false;
    for(const vehicle of vehicles){
      const share=(vehicle.hp/this.maxUnitHp(vehicle)<.5?2:1)/total;
      const before=vehicle.hp;
      vehicle.hp=Math.min(this.maxUnitHp(vehicle),before+REPAIR_RATE*getVeterancyModifiers(u).repairRate*share*dt);
      if(vehicle.hp>before){
        gainUnitXp(u,(vehicle.hp-before)*XP_RULES.repair,'repair');
        this.work('repair',u.id,vehicle.id,vehicle.hp-before);
        u.workingTarget??=vehicle.id;
        repaired=true;
      }
    }
    return repaired;
  }
  /** A shared 12 HP/s budget; self care is capped at 3 HP/s and waits after damage. */
  private healNearby(u:Unit,dt:number):boolean {
    const patients=this.spatial.query(u,this.healRadius(u)).filter(t=>this.supportEligible(u,t,'heal')&&this.world.line(u,t)&&(t.id!==u.id||u.defendUntil<=this.time));
    const others=patients.filter(t=>t.id!==u.id),urgent=others.some(t=>t.hp/this.maxUnitHp(t)<.5);
    const targets=patients.filter(t=>t.id!==u.id||!urgent);
    if(!targets.length)return false;
    // Weighted sharing treats the wounded together, with the most urgent receiving more.
    const weight=(t:Unit)=>t.id===u.id?.25:t.hp/this.maxUnitHp(t)<.5?2:1;
    const sum=targets.reduce((n,t)=>n+weight(t),0);let healed=false;
    for(const target of targets){const before=target.hp,rate=target.id===u.id?Math.min(3,12*weight(target)/sum):12*weight(target)/sum;
      target.hp=Math.min(this.maxUnitHp(target),target.hp+rate*getVeterancyModifiers(u).healRate*dt);
      if(target.hp>before){if(target.id!==u.id)gainUnitXp(u,(target.hp-before)*XP_RULES.heal,'heal');this.work('heal',u.id,target.id,target.hp-before);healed=true;u.workingTarget??=target.id;}
    }
    return healed;
  }
  private work(kind:WorkEffect['kind'],source:number,target:number,amount:number):void {
    if(amount<=0)return;
    const effect=this.workEffects.find(e=>e.kind===kind&&e.target===target);
    if(effect){if(effect.at!==this.time)effect.sources.length=0;if(!effect.sources.includes(source))effect.sources.push(source);effect.at=this.time;effect.amount=amount;effect.source=source;}
    else this.workEffects.push({kind,source,sources:[source],target,amount,at:this.time});
  }
  private damage(source:Unit|Base,target:Unit|Base,damage:number,weapon:Weapon,from:Point,barrel?:number):void {
    // WebGL ballistics: every infantry/vehicle bullet AND defensive turret
    // volley has the same deterministic 25% miss chance for both factions.
    // Strategic missiles keep their independent delayed-impact rules.
    // Misses must not damage/suppress or create AI hit reactions. Emit one
    // ordinary Shot so the existing pooled sand dents, dust and tracers play.
    const unitShooter='orders' in source;
    if(this.stageWebGLProduction&&(unitShooter||weapon==='turret')){
      // A turret's four alternating-barrel burst needs independent rolls even
      // when several bullets are simulated in one fixed 20 Hz tick. Offset
      // its ordinal from unit ballistics without mutable/random state.
      const ordinal=(source.burst?.index??0)+(weapon==='machinegun'?71:
        weapon==='turret'?211:0);
      if(unitShotMisses(this.seed,source.id,target.id,this.time,ordinal)){
        const targetRadius='queue' in target?target.radius:unitSpec(target).radius;
        const point=missedGroundPoint(from,target,targetRadius,this.world.size,
          unitShotRoll(this.seed,source.id,target.id,this.time,ordinal+891));
        this.shots.push({from,to:point,owner:source.owner,life:.65,hit:false,miss:true,
          source:source.id,weapon,barrel,at:this.time,
          ...(unitShooter?{kind:source.kind,angle:source.angle,
            flightHeight:source.flightHeight}:{}),
          projected:!unitShooter,
          groundFrom:{x:source.x,y:source.y},groundTo:point,impactElevation:0});
        return;
      }
    }
    this.strike(source,target,damage);
    if(weapon==='turret'&&'orders' in target&&target.hp>0)this.tactical.underTowerFire(target);
    const flying='orders' in target&&unitSpec(target).flying;
    this.shots.push({from,to:{x:target.x,y:target.y-(flying?(target.kind==='scout'?34+77*((target as Unit).flightHeight??1):111):23)},owner:source.owner,life:.65,hit:true,projected:'queue' in source,source:source.id,weapon,barrel,at:this.time,
      ...('orders' in source?{kind:source.kind,angle:source.angle,flightHeight:source.flightHeight}:{}),groundFrom:{x:source.x,y:source.y},groundTo:{x:target.x,y:target.y},
      armored:'queue' in target||unitSpec(target as Unit).group!=='Infanterie',
      targetClass:'queue' in target?'structure':unitSpec(target as Unit).flying?'air':
        unitSpec(target as Unit).group==='Infanterie'?'infantry':'armor',
      impactElevation:'queue' in target?Math.min(90,buildingSpec(target).width*.32):
        unitSpec(target as Unit).flying?125:
        unitSpec(target as Unit).group==='Fahrzeuge'?40:23});
  }
  private strike(source:Unit|Base|number,target:Unit|Base,amount:number):void{
    if(!Number.isFinite(amount)||amount<=0||target.hp<=0)return;
    const attacker=typeof source==='number'?this.unitById.get(source):'orders' in source?source:undefined;
    const sourceId=typeof source==='number'?source:source.id;
    // A unit on the crown of a gentle 3D hill has +20% damage and takes
    // 10% less incoming damage. Air units/buildings and legacy maps retain
    // the original combat math. Applies equally to hits and rocket splash.
    const groundUnit=(entity:Unit|Base|undefined):entity is Unit=>
      Boolean(entity&&'orders' in entity&&!unitSpec(entity).flying);
    const outgoing=(groundUnit(attacker)&&this.onHighGround(attacker)?1.2:1)*
      (attacker?researchModifiers(this.research[attacker.owner],attacker.kind).damage:1);
    const incoming=groundUnit(target)&&this.onHighGround(target)?.9:1;
    const adjusted=amount*outgoing*incoming;
    const alive=target.hp>0,applied=Math.min(target.hp,adjusted);target.hp=Math.max(0,target.hp-applied);
    // An actual hit on a friendly position is safe to reveal. Never expose an
    // unknown enemy's position, and never serialize transient warning markers.
    const hostile=typeof source==='number'?this.unitById.get(source):source;
    if(target.owner===0&&hostile?.owner===1&&applied>0){
      this.attackAlerts.record({x:target.x,y:target.y},this.time);
    }
    if(attacker&&attacker.hp>0&&attacker.owner!==target.owner){gainUnitXp(attacker,applied*XP_RULES.damage,'damage');if(target.hp===0)gainUnitXp(attacker,XP_RULES.kill,'kill');}
    if(alive&&target.hp<=0&&'orders' in target)this.tactical.loss(target);
    // Fast damage-driven retreat: the tactical planner runs only every 3 s,
    // longer than the time a low-HP rover can survive under enemy fire.
    if(alive&&target.hp>0&&'orders' in target)this.tactical.evacuateVehicle(target);
    if('hit' in target){
      target.hit=.18;target.lastAttacker=sourceId;target.defendUntil=this.time+5;
      // Player infantry under fire stop for a defensive stand. Plain moves,
      // attack-moves and moving explicit attacks lose their entire queued route.
      // Hold still permits return fire in weapon range, but suppresses pursuit.
      // Only a new player command clears hold and resumes movement.
      const marching=target.orders[0]&&(
        target.orders[0].kind==='move'||target.orders[0].kind==='attackMove'||
        (target.orders[0].kind==='attack'&&target.moving));
      if(target.hp>0&&target.owner===0&&!target.carrier&&
        (target.kind==='infantry'||target.kind==='heavy'||target.kind==='rocket')&&marching){
        target.orders=[];target.path=[];target.repath=0;target.moving=false;
        target.pursuitOrigin=null;target.combatTarget=null;target.hold=true;
        delete target.burst;
      }
    }
    if(target.hp<=0&&'queue' in target){
      if(target.kind==='bunker')this.destroyBunkerGarrison(target);
      this.movementCollision=undefined;target.hp=0;target.queue=[];target.queueTypes=[];target.queueCosts=[];target.production=0;this.notices.push(`${buildingSpec(target).name} ${target.owner===0?'verloren':'ausgeschaltet'}!`);}
  }
  /** Secondary roof MG has its own clock and can suppress infantry even while a rocket targets armor. */
  private tankMachinegun(u:Unit):void {
    // A deliberately disabled weapon cooldown (e.g. scripted disarm or test fixture) suppresses both guns.
    if((u.mgCooldown??0)>0||u.cooldown>unitSpec(u).cooldown+1e-8)return;
    const infantry=this.spatial.query(u,TANK_MG.range).filter(e=>e.owner!==u.owner&&e.hp>0&&!e.carrier&&unitSpec(e).group==='Infanterie'&&
      this.canSee(u.owner,e)&&distance(u,e)<=TANK_MG.range&&this.world.line(u,e,this.obstacles()));
    const order=u.orders[0];
    const target=(u.hold&&!u.guardArea
      ? infantry.find(e=>e.id===u.lastAttacker&&u.defendUntil>this.time)
      : infantry.find(e=>order?.kind==='attack'&&e.id===order.target)??infantry.sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id)[0]);
    if(!target)return;
    u.mgCooldown=TANK_MG.cooldown/getVeterancyModifiers(u).fireRate;
    this.damage(u,target,TANK_MG.damage*getVeterancyModifiers(u).damage,'machinegun',{x:u.x,y:u.y-34});
  }
  /** A bomb is a real delayed projectile: visible fall and impact damage
   * derive from the same persisted missile, including after save/load. */
  private releaseBomb(u:Unit,target:Unit|Base):void{
    const from={x:u.x,y:u.y};
    const miss=this.stageWebGLProduction&&unitShotMisses(this.seed,u.id,target.id,this.time,73);
    const to=miss?missedGroundPoint(from,target,
      'queue' in target?target.radius:unitSpec(target).radius,this.world.size,
      unitShotRoll(this.seed,u.id,target.id,this.time,964)):
      {x:target.x,y:target.y};
    this.missiles.push({
      id:this.nextId++,source:u.id,owner:u.owner,from,to,angle:u.angle,
      at:this.time,impactAt:this.time+BOMBER_BOMB_FALL_SECONDS,
      damage:unitSpec(u).damage*getVeterancyModifiers(u).damage,type:'bomb',miss
    });
    this.shots.push({
      from,to,owner:u.owner,life:.45,hit:false,weapon:'bomb',source:u.id,
      kind:'bomber',angle:u.angle,at:this.time,groundFrom:from,groundTo:to
    });
    u.fire=.25;
    u.cooldown=unitSpec(u).cooldown/getVeterancyModifiers(u).fireRate;
    delete u.idleOrbit;
    u.bomberRun={target:target.id,leg:0,
      waypoints:bomberAttackWaypoints(u,to,this.world.size,u.id%2===0?1:-1)};
    u.path=[];u.repath=0;
  }
  /** Free local self-defense against recon aircraft. The drone is NOT an
   * AI opponent: no pursuit, squad reassignment, attack order, retreat, or
   * strategic AA production is authorized by this opportunistic shot. */
  private shootPassingDrone(u:Unit):void {
    if(u.owner!==1||u.hp<=0||u.carrier||u.cooldown>1e-8||
       u.burst||!['rocket','heavy','infantry','rover'].includes(u.kind))return;
    const range=this.range(u),observed=this.spatial.query(u,range).filter(target=>
      target.owner===0&&target.hp>0&&!target.carrier&&
      distance(u,target)<=range&&this.canSee(1,target)&&
      this.world.sightLine(u,target));
    // Never waste a ready weapon on a harmless drone when a combat threat
    // is already within reach. Existing targeting stays authoritative.
    if(observed.some(target=>target.kind!=='drone'&&canAttack(u,target)))return;
    const drone=observed.filter(target=>target.kind==='drone')
      .sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id)[0];
    if(!drone)return;
    const spec=unitSpec(u),damage=weaponDamage(u,drone)*getVeterancyModifiers(u).damage;
    if(u.kind==='rocket')this.launch(u,drone);
    else {
      const weapon:Weapon=u.kind==='infantry'||u.kind==='rover'?'rifle':'heavy';
      this.damage(u,drone,damage,weapon,{x:u.x,y:u.y-18});
    }
    u.cooldown=spec.cooldown/getVeterancyModifiers(u).fireRate;
    u.fire=.18;
    // Intentionally do NOT set u.angle, u.orders, u.combatTarget or u.path.
  }
  private launch(u:Unit,target:Unit|Base):void{
    const id=this.nextId++,antiArmor=u.kind==='tank'||u.kind==='rocket';
    const miss=this.stageWebGLProduction&&unitShotMisses(this.seed,u.id,target.id,this.time,u.burst?.index??0);
    const offset=antiArmor?{x:0,y:0}:this.weather.artilleryOffset(id,u.id);
    const from={x:u.x,y:u.y};
    const to=miss?missedGroundPoint(from,target,
      'queue' in target?target.radius:unitSpec(target).radius,
      this.world.size,unitShotRoll(this.seed,u.id,target.id,this.time,509)):
      {x:clamp(target.x+offset.x,0,this.world.size),y:clamp(target.y+offset.y,0,this.world.size)};
    const duration=Math.max(.24,distance(from,to)/(antiArmor?650:400));
    this.missiles.push({id,source:u.id,owner:u.owner,from,to,angle:u.angle,at:this.time,impactAt:this.time+duration,damage:(u.kind==='rocket'?weaponDamage(u,target):unitSpec(u).damage)*getVeterancyModifiers(u).damage,miss,...(antiArmor?{type:'antiArmor' as const}:{}),...(u.kind==='rocket'&&!miss?{target:target.id}:{})});
    this.shots.push({from:{x:u.x,y:u.y-18},to:{x:target.x,y:target.y-23},owner:u.owner,life:.65,hit:false,weapon:'rocket',source:u.id,kind:u.kind,barrel:antiArmor?0:id%6,angle:u.angle,at:this.time,groundFrom:from,groundTo:to});
  }
  /** Defensible troop transport: its MG opportunistically engages
   * visible nearby infantry without reassigning an escort/landing mission.
   * No chasing: when the transport flies away, the gun simply stops.
   * Rockets remain a separately timed, finite secondary weapon.
   */
  private helicopterMachinegun(u:Unit):void{
   if(u.kind!=='scout'||u.hp<=0||u.carrier||u.cooldown>1e-8||
      u.airfieldService||u.transport&&u.transport.phase!=='cruise')return;
   const spec=unitSpec(u),range=spec.range;
   const infantry=this.spatial.query(u,range).filter(v=>v.owner!==u.owner&&
      v.hp>0&&!v.carrier&&unitSpec(v).group==='Infanterie'&&
      distance(u,v)<=range&&this.canSee(u.owner,v));
   const order=u.orders[0];
   const target=u.hold&&!u.guardArea
      ?infantry.find(v=>v.id===u.lastAttacker&&u.defendUntil>this.time)
      :infantry.find(v=>order?.kind==='attack'&&order.target===v.id)??
       infantry.sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id)[0];
   if(!target)return;
   u.cooldown=spec.cooldown/getVeterancyModifiers(u).fireRate;
   u.fire=.18;
   this.damage(u,target,weaponDamage(u,target)*getVeterancyModifiers(u).damage,
      'machinegun',{x:u.x,y:u.y-32});
  }
  /** One light, unguided helicopter rocket. Unlike the MG it has a
   * persistent six-round magazine and its own 9-second weapon clock.
   * A real observed ground target is required; no rockets during landing,
   * boarding or hangar service, and no new tactical/transport orders.
   */
  private fireScoutRocket(u:Unit,target:Unit|Base|undefined):void{
   if(u.kind!=='scout'||u.hp<=0||u.carrier||
      (u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)<=0||
      (u.rocketCooldown??0)>0||u.airfieldService)return;
   // Transport orders remain authoritative; only currently visible ground
   // threats can be targeted, without a new chase or squad assignment.
   if(!target&&!u.hold){
    const observed=[...this.spatial.query(u,SCOUT_ROCKETS.range),...this.bases]
      .filter(e=>e.owner!==u.owner&&e.hp>0&&
       !('orders' in e&&e.carrier)&&
       scoutRocketReady(u,distance(u,e),e)&&this.canSee(u.owner,e));
    const priority=(e:Unit|Base)=>'queue' in e?2:
      unitSpec(e).group==='Fahrzeuge'?0:1;
    target=observed.sort((a,b)=>priority(a)-priority(b)||
       distance(u,a)-distance(u,b)||a.id-b.id)[0];
   }
   if(!target||!scoutRocketReady(u,distance(u,target),target)||
      !this.canSee(u.owner,target))return;
   const from={x:u.x,y:u.y};
   const miss=this.stageWebGLProduction&&
     unitShotMisses(this.seed,u.id,target.id,this.time,375);
   const to=miss?missedGroundPoint(from,target,
      'queue' in target?target.radius:unitSpec(target).radius,
      this.world.size,unitShotRoll(this.seed,u.id,target.id,this.time,801)):
      {x:target.x,y:target.y};
   const angle=Math.atan2(to.y-from.y,to.x-from.x);
   const id=this.nextId++;
   this.missiles.push({id,source:u.id,owner:u.owner,from,to,angle,
     at:this.time,impactAt:this.time+Math.max(.25,distance(from,to)/SCOUT_ROCKETS.flightSpeed),
     damage:SCOUT_ROCKETS.damage*getVeterancyModifiers(u).damage,
     type:'scoutRocket',miss});
   this.shots.push({from,to,owner:u.owner,life:.65,hit:false,
     weapon:'rocket',source:u.id,kind:'scout',barrel:id%2,
     angle,at:this.time,groundFrom:from,groundTo:to});
   u.rocketAmmo=(u.rocketAmmo??SCOUT_ROCKETS.maxAmmo)-1;
   u.rocketCooldown=SCOUT_ROCKETS.cooldown;
   u.fire=Math.max(u.fire,.2);
  }
  canSee(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.visible[owner][i]===1;}
  hasExplored(owner:Faction,p:Point):boolean {const i=this.world.index(p);return i>=0&&this.explored[owner][i]===1;}
  updateVision():void {
    // Keep normal gameplay untouched: no timing overhead unless the WebGL
    // profiler or the existing performance recorder has been explicitly enabled.
    if(!profiler&&!this.profileVision)return this.updateVisionMeasured();
    const at=performance.now();
    try{this.updateVisionMeasured();}
    finally{
      const ms=performance.now()-at;
      if(this.profileVision){
        this.visionDurationMs=ms;
        this.visionCompletedAt=this.time;
        this.maxVisionMs=Math.max(this.maxVisionMs,ms);
      }
      profiler?.record('vision',ms);
    }
  }
  private updateVisionMeasured():void {
    for(const owner of [0,1] as const){
      const visible=this.visible[owner];visible.fill(0);
      const sources=[...this.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier).map(u=>({key:`u${u.id}`,x:u.x,y:u.y,sight:this.sight(u)*this.visionScale,close:unitSpec(u).radius+this.world.cell*2,air:unitSpec(u).flying})),
        ...this.bases.filter(b=>b.owner===owner&&b.hp>0).map(b=>({key:`b${b.id}`,x:b.x,y:b.y,sight:(b.buildRemaining>0?110:buildingSpec(b).sight)*this.visionScale,close:b.radius+this.world.cell*2,air:false})),
        ...this.territories.filter(t=>t.owner===owner).map(t=>({key:`t${t.id}`,...t.point,sight:RULES.bastion.sight*this.visionScale,close:RULES.bastion.radius+this.world.cell*2,air:false}))];
      this.visionCache.update(this.world,owner,sources,visible);
      const discovered=new Set<number>();
      for(let i=0;i<visible.length;i++)if(visible[i]){this.explored[owner][i]=1;const cliff=this.world.cliffIds[i];if(cliff>=0)discovered.add(cliff);}
      // Seeing a cliff identifies its complete terrain surface. Its inaccessible
      // interior stays remembered terrain, rather than an impossible black hole.
      // This never grants current visibility to enemies behind the cliff.
      for(const id of discovered)for(const cell of this.world.cliffCells[id])this.explored[owner][cell]=1;
      if(owner===0)for(const b of this.bases){
        if(b.owner!==1||b.kind!=='silo'||b.hp<=0||
           !this.canSee(0,b)||this.seenEnemySilos.has(b.id))continue;
        this.seenEnemySilos.add(b.id);
        this.notices.push('ACHTUNG: Feindliches Raketensilo entdeckt!');
      }
      for(const b of this.bases)if(this.canSee(owner,b)){
        const memory={id:b.id,owner:b.owner,x:b.x,y:b.y,hp:b.hp,territory:b.territory,kind:b.kind};
        const i=this.memories[owner].findIndex(m=>m.id===b.id);if(i<0)this.memories[owner].push(memory);else this.memories[owner][i]=memory;
      }
      this.memories[owner]=this.memories[owner].filter(m=>!this.canSee(owner,m)||this.bases.some(b=>b.id===m.id));
    }
    this.tactical.observe();this.revision++;
  }
  private combatEntity(id:number|null|undefined):Unit|Base|undefined {
    // Combat targets are resolved against the index refreshed at every
    // simulation tick, without allocating a new army array on each lookup.
    // Buildings retain their ID lookup; null/undefined locks need no scan.
    return id==null?undefined:this.unitById.get(id)??this.bases.find(b=>b.id===id);
  }
  private acquire(u:Unit):Unit|Base|undefined {
    const order=u.orders[0],spec=unitSpec(u);
    // A plain move is a strict order. Idle combat units and attack-move squads
    // can respond within sight, starting their approach before weapon range.
    // Engineers on guard duty stay near their work instead of abandoning repairs.
    const support=u.kind==='engineer'||u.kind==='medic'||u.kind==='scout'||(u.kind==='rover'&&!!u.transport?.cargo.length);
    const proactive=!u.hold&&order?.kind!=='move'&&!support;
    const range=this.range(u);
    const engageRadius=proactive?Math.max(range,Math.min(this.sight(u),range+120)):range;
    const visible=(e:Unit|Base)=>this.canSee(u.owner,e)||(distance(u,e)<=this.sight(u)&&(spec.flying||this.world.sightLine(u,e)));
    const eligible=(e:Unit|Base)=>{
      if(e.hp<=0||('orders' in e&&e.carrier)||e.owner===u.owner||!canAttack(u,e))return false;
      // Strategic AI ignores unarmed drones in ordinary target acquisition.
      // A separate in-range AA opportunity may shoot, without changing orders.
      if(u.owner===1&&'orders' in e&&e.kind==='drone')return false;
      const d=distance(u,e);
      if(d>engageRadius||!visible(e))return false;
      return spec.flying||('orders' in e&&unitSpec(e).flying)||
        (d<=range?this.world.line(u,e):this.world.sightLine(u,e));
    };
    // Position halten is defensive fire ONLY. Normal auto-acquisition must
    // never choose nearby enemy units or buildings: fire at the actual, still
    // live attacker only after taking damage, while it remains in weapon range
    // and line of sight. Do not chase or inherit an old combat lock.
    if(u.hold){
      u.combatTarget=null;
      if(u.guardArea){
        // STOPP is a full defensive guard stance: automatically fire on a
        // visible enemy ALREADY inside weapon range without pursuing it.
        const inRange=[...this.spatial.query(u,range),...this.bases]
         .filter(eligible).sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id);
        const best=inRange[0];
        u.combatTarget=best?.id??null;
        return best;
      }
      // Legacy damage-triggered hold still returns fire at the attacker.
      if(u.lastAttacker===null||u.defendUntil<=this.time)return undefined;
      const attacker=this.combatEntity(u.lastAttacker);
      if(attacker&&eligible(attacker)){
        u.combatTarget=attacker.id;
        return attacker;
      }
      return undefined;
    }
    // Keep explicit attack targets and current combat locks stable.
    if(order?.kind==='attack'&&order.target!==undefined){
      const manual=this.combatEntity(order.target);
      if(manual&&manual.owner!==u.owner&&manual.hp>0&&!('orders' in manual&&manual.carrier)&&canAttack(u,manual)&&visible(manual)){u.combatTarget=manual.id;return manual;}
    }
    const locked=this.combatEntity(u.combatTarget);
    // Red's missile infantry and bombers may switch away from a low-value
    // rifleman when observed enemy aircraft or armor enters their area.
    // Ordinary units and explicit ATTACK orders keep their existing locks.
    const counterSpecialist=u.owner===1&&(u.kind==='rocket'||u.kind==='bomber');
    const counterValue=(e:Unit|Base)=>'orders' in e&&
      (u.kind==='rocket'
        ?(unitSpec(e).flying||unitSpec(e).group==='Fahrzeuge')
        :(!unitSpec(e).flying&&unitSpec(e).group==='Fahrzeuge'));
    if(!support&&locked&&eligible(locked)&&
       (!counterSpecialist||counterValue(locked)))return locked;
    u.combatTarget=null;
    if(u.lastAttacker!==null&&u.defendUntil>this.time){
      const attacker=this.combatEntity(u.lastAttacker);
      if(attacker&&eligible(attacker)){u.combatTarget=attacker.id;return attacker;}
    }
    if(support)return undefined;
    // Direct sight runs every fixed tick rather than waiting for fog updates.
    let best:Unit|Base|undefined,bestScore=Infinity;
    for(const e of [...this.spatial.query(u,engageRadius),...this.bases]){
      const d=distance(u,e);
      if(!eligible(e))continue;
      // Red AI prioritizes exposed enemy rocket artillery and medics over
      // slightly closer riflemen, but never over a previously locked target.
      // Player units retain the original closest-target behavior.
      const priority=u.owner===1&&'orders' in e
        ?(e.kind==='artillery'?-95:e.kind==='medic'?-65:e.kind==='bomber'?-45:0):0;
      const armorPreference=u.kind==='tank'&&('queue' in e||unitSpec(e).group==='Fahrzeuge')?-105:
       u.kind==='rocket'&&('queue' in e||unitSpec(e).group!=='Infanterie')?-165:0;
      // AI counters prioritize the targets their weapons are designed for.
      // No omniscient target lookup: eligible() already confirms real vision,
      // range, line-of-sight and air-attack permission for this unit.
      const specialist=u.owner===1&&'orders' in e
       ?u.kind==='rocket'
        ?(unitSpec(e).flying?-350:unitSpec(e).group==='Fahrzeuge'?-260:0)
        :u.kind==='bomber'&&!unitSpec(e).flying&&unitSpec(e).group==='Fahrzeuge'
         ?(e.kind==='tank'?-320:-230):0
       :0;
      const score=d+priority+armorPreference+specialist;
      if(score<bestScore){best=e;bestScore=score;}
    }
    u.combatTarget=best?.id??null;
    return best;
  }
  /** Brief fire-and-reposition against a real, currently visible ground
   * vehicle. The rocket fires normally when ready, then moves to a legal
   * longer-range firing lane during cooldown. Player orders, HQ hold posts,
   * ordinary movement and stored mission goals are never overwritten. */
  private moveRocketToStandoff(u:Unit,enemy:Unit|Base,dt:number):boolean {
    const previous=this.rocketStandoff.get(u);
    const order=u.orders[0];
    const enemyVehicle='orders' in enemy&&
      unitSpec(enemy).group==='Fahrzeuge'&&!unitSpec(enemy).flying;
    const enabled=shouldRocketReposition({
      ownedByAI:u.owner===1&&this.tactical.mode==='director',
      mapVersion:this.world.mapVersion,enemyVehicle,held:u.hold||
       !!order?.guardOnArrival,
      directMove:order?.kind==='move'||order?.kind==='build'||
       order?.kind==='repair'||order?.kind==='board',
      readyToFire:u.cooldown<=.35,threatDistance:distance(u,enemy)
    });
    if(!enabled){
      if(previous){this.rocketStandoff.delete(u);u.path=[];u.repath=0;}
      return false;
    }
    let state=previous;
    if(!state||state.targetId!==enemy.id||state.expires<=this.time||
      distance(u,state.point)<24){
      const collision=this.movingColliders().byOwner[u.owner].infantry;
      const clearance=Math.max(0,unitSpec(u).radius-10);
      const point=rocketStandoffPoint({
        soldier:u,enemy,range:unitSpec(u).range,
        reachable:p=>this.world.walkable(p,collision,clearance)&&
          this.world.line(u,p,collision,clearance),
        clearShot:p=>this.world.line(p,enemy,this.obstacles(),2)
      });
      if(!point)return false;
      state={targetId:enemy.id,point,expires:this.time+3};
      this.rocketStandoff.set(u,state);u.path=[];u.repath=0;
      u.exactPath=true;
    }
    this.move(u,state.point,dt);
    return true;
  }
  /** Combat-unit orders can get stuck after a new building blocks an old
   * route. Repath first; if the real AI attack-move stays immobile across
   * several attempts, free that order for the next tactical plan. */
  private recoverStalledAiRoute(u:Unit,target:Point):boolean {
    const order=u.orders[0];
    if(u.owner!==1||this.world.mapVersion<23||
       !order||!['move','attackMove'].includes(order.kind)||
       u.hold||u.defendUntil>this.time||u.combatTarget!=null||
       distance(order,target)>2||distance(u,target)<25)return false;
    if(unitSpec(u).group==='Fahrzeuge'&&
       ((u.transport?.cargo.length??0)>0||u.factoryService||
        (u.kind==='tank'&&(u.driveSpeed??0)<2&&
         Math.abs(angleDifference(u.hullAngle??u.angle,
          Math.atan2(target.y-u.y,target.x-u.x)))>.24)))return false;
    let s=this.aiRouteProgress.get(u);
    if(!s||s.order!==order){
      s={order,x:u.x,y:u.y,since:this.time,retries:0};
      this.aiRouteProgress.set(u,s);return false;
    }
    if(distance(u,s)>=8){
      s.x=u.x;s.y=u.y;s.since=this.time;s.retries=0;return false;
    }
    if(this.time-s.since<6)return false;
    s.since=this.time;s.retries++;
    u.path=[];u.repath=0;u.exactPath=true;
    if(s.retries>=3&&(order.kind==='attackMove'||
      unitSpec(u).group==='Fahrzeuge'&&this.tactical.ai37Mode==='coordinated')){
      u.orders.shift();u.combatTarget=null;u.pursuitOrigin=null;
      this.aiRouteProgress.delete(u);
      return true;
    }
    return false;
  }
  /** Per fixed 50ms simulation tick, cap synchronous modern-ground A*
   * submissions. At 728 seconds profiling showed 10 requests taking 260ms
   * on one JS frame. A deferred request retains the current move order,
   * avoiding lost targets, save fields and nondeterministic wall-time budgets.
   */
  private routeBudgetTick=-1;
  private routeBudgetUsed=0;
  // A physics frame may contain 8-12 fixed steps at 4x speed. The earlier
  // per-tick limit still allowed 16-35 synchronous A* calls in ONE RAF.
  // This transient budget spans the full visual frame, not each game tick.
  // CLI/AI simulations retain the original deterministic per-tick limit.
  private routeFrameActive=false;
  private routeFrameUsed=0;
  beginRenderFrame():void {this.routeFrameActive=true;this.routeFrameUsed=0;}
  endRenderFrame():void {this.routeFrameActive=false;}
  // A blocked step used to set repath=0, causing a new full 4200-node
  // search on every catch-up tick. Back off only while the unit stays at
  // the same stuck location. Fresh commands continue to reset u.repath.
  private blockedRouteRetries=new WeakMap<Unit,{x:number;y:number;targetX:number;targetY:number;count:number}>();
  // Repeated physical cliff contacts can reset the normal path-progress
  // watchdog every time A* replaces a route. Keep a separate, transient
  // cooldown to limit expensive local probes at 2x/4x game speed.
  private readonly cornerEscapeCooldown=new WeakMap<Unit,number>();
  private move(u:Unit,target:Point,dt:number,speedLimit=Infinity,formationCatchUp=false):void {
    const spec=unitSpec(u),clearance=Math.max(0,spec.radius-10);
    const vehicle=spec.group==='Fahrzeuge'&&!spec.flying,ground=!spec.flying;
    // Only modern high-relief generated 3D maps need the physical incline
    // restriction. Older seeded terrain, infantry, aircraft keep their rules.
    const slopeLimit=vehicle&&this.world.mapVersion>=23
      ?u.kind==='tank'?.215:u.kind==='artillery'?.185:.195
      :Infinity;
    // Support units are controlled by their explicit work order; protect them
    // from the separate battlefield-movement watchdog.
    if(ground&&u.kind!=='engineer'&&u.kind!=='medic'&&
       (!vehicle||this.tactical.ai37Mode==='coordinated')&&
       this.recoverStalledAiRoute(u,target))return;
    const cached=this.movingColliders(),open=cached.byOwner[u.owner];
    const {buildings}=open;
    const towers=ground?cached.towers:[];
    const decor=vehicle?cached.decor:[];
    const visualBuildings=vehicle?open.vehicleFacades:
      ground?open.infantryFacades:[];
    const collisionObstacles=ground?
      (vehicle?open.vehicle:open.infantry):buildings;
    // Older savegames can contain vehicles standing within the newly enlarged
    // visual clearance. Allow only a proven escape route out, then route normally.
    if(ground&&u.vehicleEscape==='exit'&&this.world.walkable(u,collisionObstacles,clearance)){
      delete u.vehicleEscape;u.path=[];u.repath=0;
    }
    if(!u.path.length&&u.repath<=0){
      // Route work runs on the browser's main thread. Distribute clusters
      // of squad orders over consecutive deterministic simulation ticks.
      // Direct new commands still execute promptly; air and old maps retain
      // their original semantics. No route is skipped, only deferred.
      if(ground&&this.world.mapVersion>=23){
        const tick=Math.round(this.time*20);
        if(tick!==this.routeBudgetTick){
          this.routeBudgetTick=tick;this.routeBudgetUsed=0;
        }
        if(this.routeBudgetUsed>=2||
          (this.routeFrameActive&&this.routeFrameUsed>=2)){
          // Do not lose orders or route endpoints; retry fairly in future
          // simulation steps/render frames without flooding one frame.
          u.repath=.10+(u.id%5)*.05;
          return;
        }
        this.routeBudgetUsed++;
        if(this.routeFrameActive)this.routeFrameUsed++;
      }
      delete u.vehicleEscape;
      const tactical=u.owner===1&&u.orders[0]?.tactical;
      const baseObstacles=tactical?this.tactical.navigationObstacles():buildings;
      const routeObstacles=ground?[...baseObstacles,...visualBuildings,...decor,...towers]:baseObstacles;
      const risk=this.tactical.costs(u);
      u.path=spec.flying&&!risk?[target]:this.world.path(u,target,routeObstacles,clearance,risk,spec.flying,u.exactPath,true,slopeLimit);
      // A coarse cliff route may graze blocked terrain. Retry with exact
      // cell traversal immediately, even for infantry with zero extra clearance.
      if(!u.path.length&&!spec.flying&&this.world.mapVersion>=3&&!u.exactPath){
        u.exactPath=true;
        u.path=this.world.path(u,target,routeObstacles,clearance,risk,false,true,true,slopeLimit);
      }
      if(ground&&!u.path.length){
        // LAST RESORT: only after normal and exact visual-clearance routes have
        // both failed, use the original solid-building footprint. This retains
        // real collision and never ignores rocks, crates or service lamps.
        const trapped=!this.world.walkable(u,collisionObstacles,clearance);
        // Only v15-v18 retain the former fallback through visual facades.
        // New maps may escape a pre-existing overlap but can never pass a
        // different tower or a newly constructed visible wall.
        const legacyObstacles=this.world.mapVersion>=19?
          collisionObstacles.filter(o=>distance(o,u)>=o.radius+RULES.infantry.radius+clearance):
          [...baseObstacles,...decor];
        // Infantry never ignores the larger visual wall unless it is already
        // trapped inside it (legacy saves, just-placed construction).
        if(trapped||(vehicle&&this.world.mapVersion<19)){
          const safeExit=trapped?this.world.nearest(u,collisionObstacles,[],undefined,clearance):null;
          const escapeTarget=safeExit??target;
          u.path=this.world.path(u,escapeTarget,legacyObstacles,clearance,risk,false,true,true,slopeLimit);
          if(u.path.length)u.vehicleEscape=safeExit?'exit':'last-resort';
        }
      }
      // KI 3.9: a valid assault order is not a driving path. Long canyon
      // routes can exhaust bounded A* before discovering a pass, leaving
      // vehicles completely idle while infantry continues attacking.
      // For AI vehicles and explicit player moves on highland maps, probe
      // a short, genuinely traversable sideways corridor when BOTH bounded
      // A* attempts return no path. A valid local detour is physically driven;
      // the original order remains, and the next route query retries its goal.
      // Never auto-move stopped formations, cargo or combat-bound vehicles.
      const noPathDetourAllowed=u.owner===1
        ?this.tactical.ai37Mode==='coordinated'&&this.world.generatorVersion>=3
        :u.owner===0&&this.world.generatorVersion>=7&&speedLimit>1;
      if(vehicle&&!u.path.length&&noPathDetourAllowed&&
         this.world.mapVersion>=23&&
         (u.orders[0]?.kind==='move'||u.orders[0]?.kind==='attackMove')&&
         u.combatTarget==null&&!u.hold&&!u.factoryService&&
         (u.transport?.cargo.length??0)===0&&distance(u,target)>170){
        const old=this.ai39EmptyPathRecovery.get(u);
        const sameGoal=old&&Math.hypot(old.targetX-target.x,old.targetY-target.y)<150;
        const attempt=sameGoal?old.attempts+1:1;
        const avoid=sameGoal&&old?{x:old.originX,y:old.originY}:undefined;
        const nearby=this.spatial.query(u,380).filter(v=>v!==u&&v.hp>0&&
          !v.carrier&&!unitSpec(v).flying&&unitSpec(v).group==='Fahrzeuge');
        const local=ai39NoPathRecoveryWaypoint({
          from:u,goal:target,unitId:u.id,attempt,avoid,
          clear:p=>this.world.walkable(p,collisionObstacles,clearance)&&
            this.world.line(u,p,routeObstacles,clearance,slopeLimit)&&
            nearby.every(v=>distance(p,v)>vehicleSpacingGap(u,v).hard+12)
        });
        if(local){
          this.ai39EmptyPathRecovery.set(u,{
            targetX:target.x,targetY:target.y,originX:u.x,originY:u.y,
            attempts:attempt
          });
          u.path=[local];
          // Re-test the coarse path after a REAL successful physical
          // detour; exact-only searches tend to exhaust too early here.
          u.exactPath=false;
        }
      }
      // Failed reachability no longer hammers the same blocked goal every
      // 1.4 seconds while many units fight beside a factory/airfield.
      // Avoid repeated costly PARTIAL searches at the same blocked gate,
      // cliff or narrow pass every 0.7 seconds. Space each unit's retries
      // deterministically so a squad never submits the same A* burst.
      // Fresh player orders explicitly reset repath=0 and still run immediately.
      const partial=ground&&this.world.mapVersion>=23&&u.path.length>0&&
        distance(u.path[u.path.length-1],target)>Math.max(55,this.world.cell*1.7);
      u.repath=u.path.length
        ?this.world.mapVersion>=23
          ?(partial?1.6:.85)+(u.id%7)*.13
          :.7
        :this.world.mapVersion>=23?2.8+(u.id%5)*.18:1.4;
    }
    let next=u.path[0];if(!next)return;
    // A vehicle wedged behind another vehicle must not wait forever.
    // Try a collision-checked side step only after an actual 3.3-second stall.
    if(vehicle){
      const state=this.vehicleProgress.get(u);
      const waypointDistance=distance(u,next);
      // A vehicle pushed sideways in a crowded column can move 8 units
      // without getting ANY closer to its waypoint. That must not reset the
      // watchdog forever. Track forward progress, not raw displacement.
      if(!state||Math.hypot(state.nextX-next.x,state.nextY-next.y)>24)
       this.vehicleProgress.set(u,{x:u.x,y:u.y,since:this.time,retryAt:-1,
        nextX:next.x,nextY:next.y,bestDistance:waypointDistance});
      else if(state.bestDistance-waypointDistance>=10){
       state.x=u.x;state.y=u.y;state.since=this.time;
       state.bestDistance=waypointDistance;
      }
      else if(this.time-state.since>3.3&&this.time-state.retryAt>3.3){
        const direction=Math.atan2(next.y-u.y,next.x-u.x);
        const turning=u.kind==='tank'&&(u.driveSpeed??0)<2&&
         Math.abs(angleDifference(u.hullAngle??u.angle,direction))>.22;
        if(!turning){
          state.retryAt=this.time;state.since=this.time;
          const nearby=this.spatial.query(u,175).filter(v=>v!==u&&v.hp>0&&!v.carrier&&
           !unitSpec(v).flying&&unitSpec(v).group==='Fahrzeuge'&&distance(u,v)<150);
          // Preserve the proven closest-blocker fallback even when a tank
          // needs to sidestep *past* the blocker: restricting candidates to
          // the forward half-plane caused endless repaths after the first
          // successful detour. The occupied-lane check below remains active.
          const blocker=nearby.sort((a,b)=>distance(u,a)-distance(u,b))[0];
          const gap=blocker?vehicleSpacingGap(u,blocker).comfortable:0;
          const detour=blocker?vehicleYieldWaypoint(u,next,blocker,gap,p=>
           this.world.walkable(p,collisionObstacles,clearance)&&
           this.world.line(u,p,collisionObstacles,clearance,slopeLimit)&&
           // The old algorithm picked a side solely by rock/building
           // clearance. A second *real* vehicle may already occupy it.
           // Check both available lanes against current physical traffic.
           nearby.every(v=>v===blocker||
            distance(p,v)>vehicleSpacingGap(u,v).hard+12)):null;
          if(detour){
            u.path.unshift(detour);
            u.repath=.7;
            u.exactPath=true;
          }else{
            // KI 3.8: a mountain face may block the intended waypoint
            // without another vehicle in the lane. Physically try a legal
            // side corridor; never walk through cliffs or collision objects.
            const old=this.ai38VehicleEscapes.get(u);
            const attempts=old&&
              Math.hypot(old.targetX-target.x,old.targetY-target.y)<110&&
              Math.hypot(old.lastX-u.x,old.lastY-u.y)<200
              ?old.attempts+1:1;
            const side=ai38CanRecoverVehicle({
              // Manual movement needs the same real, collision-checked
              // recovery as AI when a cliff corner pins a vehicle. Do not
              // override hold, combat, a stopped formation or old saves.
              ai:u.owner===1&&this.tactical.ai37Mode==='coordinated'||
                u.owner===0&&this.world.generatorVersion>=7&&
                  speedLimit>1&&!u.hold,
              modernMap:this.world.mapVersion>=23,
              orderKind:u.orders[0]?.kind??'',
              turning,hasCargo:(u.transport?.cargo.length??0)>0,
              inCombat:u.combatTarget!==null&&u.combatTarget!==undefined,
              sinceProgress:3.4,attempt:attempts
            })?ai38VehicleRecoveryWaypoint({
              from:u,goal:next,unitId:u.id,attempt:attempts,
              clear:p=>this.world.walkable(p,collisionObstacles,clearance)&&
               this.world.line(u,p,collisionObstacles,clearance,slopeLimit)&&
               nearby.every(v=>distance(p,v)>vehicleSpacingGap(u,v).hard+12)
            }):undefined;
            this.ai38VehicleEscapes.set(u,{
              targetX:target.x,targetY:target.y,lastX:u.x,lastY:u.y,attempts
            });
            u.path=side?[side]:[];
            u.repath=side?.75:0;u.exactPath=true;
          }
          return;
        }
      }
    }
    let d=distance(u,next);if(d<(spec.group==='Infanterie'?5:.4)){u.path.shift();next=u.path[0];if(!next)return;d=distance(u,next);}
    const dx=(next.x-u.x)/d,dy=(next.y-u.y)/d;
    if(u.kind==='bomber'){
      // A fixed-wing bomber must physically FLY a short circle when given an
      // opposite heading. No lateral translation, abrupt 180-degree yaw or
      // visual-only correction; attacks, manual move orders and return legs
      // use exactly the same deterministic turning flight.
      const arc=steerBomberArc(u,next,dt,Math.min(this.speed(u),speedLimit),
        this.world.size,this.weather.storm?WEATHER_RULES.airSpeed:1);
      u.x=arc.x;u.y=arc.y;u.angle=arc.heading;u.hullAngle=arc.heading;
      u.driveSpeed=arc.speed;u.walkDistance+=arc.distance;
      u.facing=Math.cos(arc.heading)<-.05?-1:
       Math.cos(arc.heading)>.05?1:u.facing;
      u.moving=arc.distance>.001;
      return;
    }
    // Heavy tanks have a deliberate turn-in-place departure:
    // 1. aim the separate gun towards the next waypoint,
    // 2. slew the tracked hull more slowly,
    // 3. accelerate only once both are aligned.
    // The existing u.angle is gun bearing; u.hullAngle is the independent
    // physical hull bearing. Avoid new save fields or visual position drift.
    if(u.kind==='tank'){
      const desired=Math.atan2(dy,dx);
      const hull=u.hullAngle??u.angle;
      u.hullAngle=hull;
      u.angle=turnTowards(u.angle,desired,2.05,dt);
      u.facing=Math.cos(u.angle)<-.05?-1:Math.cos(u.angle)>.05?1:u.facing;
      // Once moving, keep steering through gentle path bends rather than
      // stopping/restarting for every navigation waypoint.
      if((u.driveSpeed??0)<2){
        const gunError=Math.abs(angleDifference(u.angle,desired));
        if(gunError>.10){
          u.driveSpeed=0;u.moving=false;return;
        }
        u.hullAngle=turnTowards(hull,desired,1.05,dt);
        const hullError=Math.abs(angleDifference(u.hullAngle,desired));
        if(hullError>.085){
          u.driveSpeed=0;u.moving=false;return;
        }
      }
    }
    const cohort=u.orders[0]?.march;
    if(cohort){const allies=cohort.map(id=>this.unitById.get(id)).filter((v):v is Unit=>v!==undefined&&v.owner===u.owner&&v.hp>0&&
        // The same reciprocal membership check now also protects AI from
        // being held back by a soldier reassigned to a different mission.
        (v.id===u.id||v.orders[0]?.march?.includes(u.id)===true));
      // A separately redirected/stopped soldier immediately leaves the
      // cohort; remaining units no longer inherit its former slow speed.
      if(allies.length){
      // Escort already enforces the moving armor's front position. A lagging
      // legacy AI rifleman must be allowed a short catch-up burst instead
      // of being capped to tank speed by the redundant march metadata.
      if(!formationCatchUp)speedLimit=Math.min(speedLimit,...allies.map(v=>unitSpec(v).speed));
      if(u.orders[0]?.rear&&!u.orders[0].target&&distance(u,target)<Math.max(...allies.map(v=>distance(v,v.orders[0]??target)))+u.orders[0].rear)speedLimit=0;
      // A straight-line distance cannot compare progress on opposite sides of
      // a rock. Let the column pass bends before enforcing its open-ground lead.
      if(u.orders[0]?.tactical&&distance(u,target)>spec.range+30&&allies.every(v=>v.path.length===1)){const remaining=(v:Unit)=>Math.max(0,distance(v,v.orders[0]??target)-(v.orders[0]?.tactical?.mode==='assault'?unitSpec(v).range:0));const lead=Math.max(...allies.map(remaining))-remaining(u);if(lead>110)speedLimit=0;}
    }}
    let velocity=Math.min(this.speed(u),speedLimit);
    if(spec.group!=='Infanterie'){
      const desired=Math.atan2(dy,dx),current=u.hullAngle??u.angle,error=Math.atan2(Math.sin(desired-current),Math.cos(desired-current));
      const turnRate=spec.flying?1.8:u.kind==='tank'?1.05:2.5;
      // Startup already slewed the tank hull in the gun -> hull -> drive
      // sequence above. Do not rotate it a second time during the same tick:
      // that doubled the advertised 1.05 rad/s yaw limit at departure.
      // Once driving, this shared steering pass handles route bends normally.
      if(u.kind!=='tank'||(u.driveSpeed??0)>=2)
        u.hullAngle=current+clamp(error,-turnRate*dt,turnRate*dt);
      const remaining=Math.max(0,distance(u,target)-14),braking=this.speed(u)*2.8;
      // Aircraft can translate while banking/turning during a direct move.
      // Otherwise a helicopter ordered to retreat in the opposite direction
      // stays virtually motionless until its hull has turned ~90 degrees.
      // Preserve the existing turning/braking model for ground vehicles.
      const traction=spec.flying&&u.orders[0]?.kind==='move'
        ?Math.max(.65,Math.cos(error)):Math.max(0,Math.cos(error));
      const targetSpeed=Math.min(this.speed(u),Math.sqrt(2*braking*remaining))*traction;
      u.driveSpeed=(u.driveSpeed??0)+clamp(targetSpeed-(u.driveSpeed??0),-braking*dt,this.speed(u)*1.9*dt);
      velocity=Math.min(u.driveSpeed,speedLimit);
    }
    const speed=velocity*(spec.flying&&this.weather.storm?WEATHER_RULES.airSpeed:1)*dt,step=Math.min(speed,d);
    const p={x:u.x+dx*step,y:u.y+dy*step};
    // If an old save begins *inside* a new collider, only allow movement
    // strictly outward from that exact collider. No new overlaps are allowed.
    const activeObstacles=ground&&u.vehicleEscape==='exit'&&this.world.mapVersion>=19?
      collisionObstacles.filter(o=>!(distance(o,u)<o.radius+RULES.infantry.radius+clearance&&
        distance(o,p)>distance(o,u)+.001)):
      ground&&u.vehicleEscape&&this.world.mapVersion<19?[...buildings,...decor]:collisionObstacles;
    // Check the entire step, not just its endpoint, so fast vehicles cannot
    // clip through a wall or a visible service prop between simulation ticks.
    const segmentClear=spec.flying||activeObstacles.every(o=>
      segmentDistance(o,u,p)>=o.radius+clearance+(spec.group==='Infanterie'?0:RULES.infantry.radius));
    if(spec.flying||(segmentClear&&this.world.walkable(p,activeObstacles,clearance)&&
      this.world.groundVehicleStepSafe(u,p,slopeLimit,spec.radius))){
      u.x=p.x;u.y=p.y;u.walkDistance+=step;
      if(u.kind!=='tank')u.angle=Math.atan2(dy,dx);
      u.facing=dx<-.05?-1:dx>.05?1:u.facing;u.moving=step>.001;
      const blocked=this.blockedRouteRetries.get(u);
      if(blocked&&distance(u,blocked)>12)this.blockedRouteRetries.delete(u);
    }
    else {
      u.path=[];delete u.vehicleEscape;
      if(this.world.mapVersion>=3&&!spec.flying)u.exactPath=true;
      if(!spec.flying&&this.world.mapVersion>=23){
        const blocked=this.blockedRouteRetries.get(u);
        const same=blocked&&distance(u,blocked)<12&&
          Math.hypot(target.x-blocked.targetX,target.y-blocked.targetY)<24;
        const count=same?Math.min(7,blocked.count+1):1;
        this.blockedRouteRetries.set(u,{
          x:same?blocked.x:u.x,y:same?blocked.y:u.y,
          targetX:target.x,targetY:target.y,count});
        // Immediate zero-retry here was the trigger for the 221s report:
        // 16-35 4200-node A* calls per rendered frame at 4x speed.
        // Retry in simulated time; a new explicit order still resets path.
        u.repath=Math.min(4,0.55+count*.5)+(u.id%5)*.12;
        // Third plateau failure mode: A* supplies a route, but the REAL
        // wheel/track collision rejects a step at a cliff corner. Clearing
        // u.path above repeatedly reset the 3.3s waypoint watchdog, so the
        // tank kept selecting the same blocked corner forever. After two
        // contacts at the SAME physical position, drive a short, provably
        // legal escape around the face. Retain the original player/AI order.
        // Stop/Hold, cargo, active combat and formation speed=0 must not
        // trigger an autonomous move. Never teleport or cross a steep lip.
        const order=u.orders[0];
        const eligible=vehicle&&this.world.generatorVersion>=7&&
          (u.owner===0||u.owner===1&&this.tactical.ai37Mode==='coordinated')&&
          (order?.kind==='move'||order?.kind==='attackMove')&&
          !u.hold&&speedLimit>1&&u.combatTarget==null&&
          (u.transport?.cargo.length??0)===0&&
          !u.factoryService&&!u.airfieldService;
        if(eligible&&count>=2&&
           this.time-(this.cornerEscapeCooldown.get(u)??-Infinity)>=2.5){
          this.cornerEscapeCooldown.set(u,this.time);
          const nearby=this.spatial.query(u,380).filter(v=>v!==u&&v.hp>0&&
            !v.carrier&&!unitSpec(v).flying&&
            unitSpec(v).group==='Fahrzeuge');
          const detour=ai39NoPathRecoveryWaypoint({
            from:u,goal:target,unitId:u.id,attempt:count,
            clear:q=>this.world.walkable(q,collisionObstacles,clearance)&&
              this.world.line(u,q,collisionObstacles,clearance,slopeLimit)&&
              nearby.every(v=>distance(q,v)>vehicleSpacingGap(u,v).hard+12)
          });
          if(detour){
            u.path=[detour];
            u.repath=.75;
            // After escaping the corner use exact A* to avoid the same
            // coarse grid approximation on the following route.
            u.exactPath=true;
          }
        }
      }else u.repath=0;
    }
  }
  step(dt=RULES.tick):void {
    if(!profiler)return this.stepMeasured(dt);const at=performance.now();try{this.stepMeasured(dt);}finally{profiler.record('simulation',performance.now()-at);}
  }
  private stepMeasured(dt=RULES.tick):void {
    if(this.paused||this.status!=='playing'||dt<=0)return;
    this.movementCollision=undefined;
    // Reconcile externally restored/test-injected sites before combat can
    // destroy the last one during this same fixed tick.
    for(const b of this.bases)if(b.hp>0)this.hadBuildings[b.owner]=true;
    if(this.testMode)this.credits[0]=Simulation.TEST_CREDITS;
    // One fixed tick only: callers accumulate elapsed time; no wall-clock economy.
    dt=Math.min(dt,.1);this.time+=dt;this.incomeClock+=dt;this.fogClock+=dt;
    this.unitById=new Map(this.units.map(u=>[u.id,u]));
    // Scheduling is bounded (once every 1.2 simulated seconds) and only
    // assigns genuinely idle pioneers, never stealing manual orders.
    if(this.time>=this.nextCooperativeBuilderAt){
      this.nextCooperativeBuilderAt=this.time+1.2;
      this.assignIdlePioneersToConstruction();
    }
    // An actor killed/removed during production must not retain a detached
    // visual departure hold after its entity no longer exists.
    for(const [id,until] of this.productionDepartureHolds)
      if(until<=this.time||!this.unitById.has(id))this.productionDepartureHolds.delete(id);
    const wasStorm=this.weather.storm;
    for(const phase of this.weather.update(this.time)){
      if(phase==='WARNING')this.notices.push('ACHTUNG: Sandsturm nähert sich!');
      else if(phase==='SANDSTORM')this.notices.push('SANDSTURM – Sichtweite reduziert!');
      else if(phase==='RECOVERY')this.notices.push('Sichtbedingungen normalisiert.');
    }
    if(wasStorm!==this.weather.storm){this.visionCache.invalidate();this.updateVision();this.fogClock=0;}
    if(this.incomeClock+1e-8>=RULES.incomeInterval){this.incomeClock=Math.max(0,this.incomeClock-RULES.incomeInterval);for(const owner of [0,1] as const){const earned=this.income(owner);this.credits[owner]+=earned;countIncome(this.stats,owner,earned);}}
    // Only completed buildings and owned bastions provide income.
    this.blasts=this.blasts.filter(b=>this.time-b.at<.5);
    this.stepStrategy(dt);
    // Optically guided infantry rockets keep tracking the *observed* target
    // they were fired at. Existing tank and artillery missiles stay unchanged.
    for(const missile of this.missiles)if(missile.target!==undefined){
      const guided=this.combatEntity(missile.target);
      if(guided&&guided.hp>0&&guided.owner!==missile.owner&&
         !('orders' in guided&&guided.carrier))
        missile.to={x:guided.x,y:guided.y};
    }
    for(const missile of this.missiles)if(missile.impactAt<=this.time){
      const antiArmor=missile.type==='antiArmor',guidedRocket=antiArmor&&missile.target!==undefined;
      const scoutRocket=missile.type==='scoutRocket';
      const radius=scoutRocket?SCOUT_ROCKETS.blastRadius:
       guidedRocket?32:antiArmor?44:missile.type==='bomb'?94:60;
      // Missed shells/bombs still physically land and explode in the sand,
      // but cannot apply splash, XP, suppression or damage to any unit.
      for(const target of missile.miss?[]:[...this.units,...this.bases])if(target.owner!==missile.owner&&target.hp>0&&!('orders' in target&&(target.carrier||(unitSpec(target).flying&&missile.target===undefined)))&&distance(target,missile.to)<=radius){
        const armored='queue' in target||unitSpec(target).group!=='Infanterie';
        // A shoulder rocket is precision anti-armor, not a cheap cluster weapon:
        // the tracked primary receives full damage, adjacent targets only
        // 32% and a smaller 32m blast. Tank/artillery payloads are unchanged.
        const secondary=guidedRocket&&target.id!==missile.target?.32:1;
        // weaponDamage(rocket, infantry) ALREADY applies the 10% direct
        // infantry modifier when the guided projectile is launched.
        // Applying another .10 on impact turned 145 into just 1.45 HP,
        // making a paid rocket soldier effectively unable to kill infantry.
        // Keep the extra .10 on nearby SPLASH victims (not the tracked
        // direct hit), and keep unchanged tank-rocket infantry splash (.28).
        const infantrySplash=guidedRocket
          ?target.id===missile.target?1:.10:.28;
        const amount=scoutRocket?
          scoutRocketDamage(target,missile.damage,distance(target,missile.to)):
          missile.damage*(1-.5*distance(target,missile.to)/radius)*secondary*
          (antiArmor&&!armored?infantrySplash:1);
        this.strike(missile.source,target,amount);
      }
      this.blasts.push({...missile.to,id:missile.id,at:this.time});
    }
    this.missiles=this.missiles.filter(m=>m.impactAt>this.time);
    this.shots=this.shots.filter(s=>(s.life-=dt)>0);
    this.workEffects=this.workEffects.filter(e=>this.time-e.at<.45);
    this.spatial.rebuild(this.units);
    // Vehicle factory servicing is retired: Pioniere own all ground-vehicle repair.
    // Silently release legacy sessions from previous save formats as well.
    for(const u of this.units)if(u.factoryService||u.autoFactoryRepair){
      delete u.factoryService;delete u.autoFactoryRepair;
      u.path=[];u.repath=0;
    }
    for(const u of this.units)if(u.hp>0&&!u.airfieldService&&u.autoAirfieldRepair&&
      ['bomber','scout'].includes(u.kind)&&u.hp/this.maxUnitHp(u)<=.30)
      this.requestAirfieldRepair([u.id]);
    // Explicit damaged-bomber return stays queued while the one maintenance
    // slot is busy. As soon as it frees, the ORIGINAL landing/taxi/repair
    // system takes control. No artificial healing, teleport or second bay.
    for(const u of this.units)if(u.returnToHangar){
      if(u.hp<=0||u.kind!=='bomber'||u.airfieldService||
         this.maxUnitHp(u)-u.hp<=1e-6){u.returnToHangar=false;continue;}
      if(!this.bases.some(b=>b.kind==='airfield'&&b.owner===u.owner&&
         b.hp>0&&b.buildRemaining<=0)){u.returnToHangar=false;continue;}
      this.requestAirfieldRepair([u.id]);
    }
    const squadMoveAt=this.profileSquadWork?performance.now():0;
    for(const u of this.units){
      if(u.hp<=0||u.carrier)continue;u.previousX=u.x;u.previousY=u.y;u.cooldown-=dt;
       if(u.kind==='scout')u.rocketCooldown=Math.max(0,(u.rocketCooldown??0)-dt);
       u.repath-=dt;u.hit=Math.max(0,u.hit-dt);u.fire=Math.max(0,u.fire-dt);u.moving=false;
      // The single real unit remains at its legal exterior spawn while the
      // visual garage rollout catches up. Once finished, ordinary pathfinding
      // drives it from exactly this position to its existing rally order.
      const departureUntil=this.productionDepartureHolds.get(u.id);
      if(departureUntil!==undefined){
        if(this.time<departureUntil)continue;
        this.productionDepartureHolds.delete(u.id);
      }
      if(u.airfieldService){this.advanceAirfieldService(u,dt);continue;}
      // No factory lift: ground vehicles continue normal movement and can
      // receive Pionier repairs through repairNearby().
      const transportBusy=this.transports.step(u,dt);
      if(this.transports.boarding(u,dt))continue;
      if(u.orders[0]?.kind==='garrison'){
        const base=this.bases.find(b=>b.id===u.orders[0]?.target&&b.kind==='bunker'&&
          b.owner===u.owner&&b.hp>0&&b.buildRemaining<=0);
        if(!base){u.orders.shift();u.path=[];continue;}
        if(distance(u,base)<=base.radius+70){
          base.garrison??=[];
          if(base.garrison.length<BUNKER_CAPACITY&&!base.garrison.includes(u.id)){
            base.garrison.push(u.id);u.carrier=base.id;u.x=u.previousX=base.x;
            u.y=u.previousY=base.y;u.orders=[];u.path=[];u.repath=0;
            u.moving=false;u.combatTarget=null;u.workingTarget=null;delete u.burst;
          }else{u.orders.shift();u.path=[];}
        }else this.move(u,u.orders[0],dt);
        continue;
      }
      if(this.escort(u,dt)||this.support(u,dt)){delete u.burst;continue;}
      const order=u.orders[0];
      // AI3.6 micro-tactics: an isolated RED Humvee must not trade its
      // weak MG against a visible BLUE helicopter. Execute ONLY this
      // unit's genuine, collision-aware escape movement before combat.
      if(u.kind==='rover'&&u.owner===1&&
         this.tactical.evadeRoverFromHelicopter(u)){
       const escape=u.orders[0];
       if(escape?.kind==='move'){
        delete u.burst;u.combatTarget=null;u.pursuitOrigin=null;
        if(distance(u,escape)<18){u.orders.shift();u.path=[];u.repath=0;}
        else this.move(u,escape,dt);
        continue;
       }
      }
      // A flying transport may launch a tiny defensive missile while moving,
      // but never interrupts its own approach, delivery or rally orders.
      if(u.kind==='scout'&&order?.kind==='move')this.fireScoutRocket(u,undefined);
      // Idle tanks must not inherit their previous acceleration after an old
      // order has ended. A new departure should visibly aim and pivot first.
      if(u.kind==='tank'&&!order&&!u.pursuitOrigin)u.driveSpeed=0;
      // A player retreat / tactical reposition is authoritative. Do not let
      // defensive reaction fire or an old attack lock stall the movement.
      // Boarding/takeoff animations finish before movement resumes.
      if(transportBusy){delete u.burst;continue;}
      if(u.kind==='scout')this.helicopterMachinegun(u);
      this.shootPassingDrone(u);
      if(u.kind==='bomber'&&(u.orders.length>0||u.hold||u.pursuitOrigin))delete u.idleOrbit;
      // Complete a wide physical escape/turn/return route after a bomb release.
      // The waypoint array is fixed at launch: no unseen target tracking.
      if(u.kind==='bomber'&&u.bomberRun&&(order?.kind!=='move')&&!u.hold){
        const run=u.bomberRun;
        const target=this.combatEntity(run.target);
        if(!target||target.hp<=0||target.owner===u.owner){delete u.bomberRun;}
        else if(run.leg<run.waypoints.length){
          const waypoint=run.waypoints[run.leg];
          if(distance(u,waypoint)<=BOMBER_RUN_WAYPOINT_DISTANCE){
            run.leg++;u.path=[];u.repath=0;
          }else this.move(u,waypoint,dt);
          continue;
        }
      }
      if(order?.kind==='move'&&(u.owner===0||this.world.mapVersion>=3&&this.tactical.mode==='director'||this.tactical.state.phase!=='attack')){
        delete u.burst;u.combatTarget=null;u.pursuitOrigin=null;
        if(distance(u,order)<18){
          u.orders.shift();u.path=[];u.repath=0;
          if(order.guardOnArrival){u.hold=true;u.guardArea=true;}
          if(u.kind==='tank')u.driveSpeed=0;
        }else this.move(u,order,dt);
        continue;
      }
      // Recon-only drones receive navigation orders but never seek/attack targets.
      if(u.kind==='drone'){
        u.combatTarget=null;delete u.burst;
        const nav=u.orders[0];
        if(nav&&nav.kind!=='move'){
          if(distance(u,nav)<18){u.orders.shift();u.path=[];u.repath=0;}
          else this.move(u,nav,dt);
        }
        continue;
      }
      const acquired=this.acquire(u);
      // Preserve a visible target through the wide return leg even when the
      // bomber briefly travels beyond the automatic engagement radius.
      const returning=u.kind==='bomber'&&u.bomberRun?.leg===3?
        this.combatEntity(u.bomberRun.target):undefined;
      const enemy=acquired??(returning&&returning.hp>0&&returning.owner!==u.owner&&
        this.canSee(u.owner,returning)?returning:undefined);
      const spec=unitSpec(u);
      if(u.kind==='bomber'&&enemy&&!u.hold){
        // Final real-time authority: no RED KI3.6 solo strike on defended
        // groups even when an earlier queued/automatic attack survives an
        // AI planning pulse. This never changes player or KI3.5 bombers.
        if(u.owner===1&&ai36AirDoctrineEnabled(this)&&
           !this.tactical.bomberStrikeSafe(enemy)){
          if(u.orders.some(o=>o.kind==='attack'||o.tactical?.mode==='assault')){
            const home=this.bases.find(b=>b.owner===1&&b.kind==='headquarters'&&
              b.hp>0&&b.buildRemaining<=0);
            if(home)this.command([u.id],{kind:'move',x:home.x,y:home.y});
            else this.stop([u.id]);
          }
          // Keep the physical flight and existing navigation next tick;
          // never release a bomb into an unsupported defensive cluster.
          continue;
        }
        // A bomber never hangs motionless in attack range firing a cannon.
        // It must fly across the actual target, drop one bomb, make a wide
        // physical loop and return for the next pass.
        if(distance(u,enemy)<=BOMBER_BOMB_RELEASE_DISTANCE&&u.cooldown<=0){
          this.releaseBomb(u,enemy);
        }else{
          const forward=distance(u,enemy)<BOMBER_BOMB_RELEASE_DISTANCE+25;
          const heading=u.angle,point=forward?{
            x:clamp(u.x+Math.cos(heading)*320,8,this.world.size-8),
            y:clamp(u.y+Math.sin(heading)*320,8,this.world.size-8)
          }:enemy;
          this.move(u,point,dt);
        }
        continue;
      }
      if(u.kind==='tank'){u.mgCooldown=Math.max(0,(u.mgCooldown??0)-dt);this.tankMachinegun(u);}
      if(u.kind==='scout')this.fireScoutRocket(u,enemy);
      const engagementRange=u.kind==='tank'&&enemy&&'orders' in enemy&&unitSpec(enemy).group==='Infanterie'?TANK_MG.range:this.range(u);
      if(u.kind==='rocket'&&enemy&&this.moveRocketToStandoff(u,enemy,dt))
        continue;
      if(enemy&&distance(u,enemy)<=engagementRange&&(spec.flying||('orders' in enemy&&unitSpec(enemy).flying)||this.world.line(u,enemy,this.obstacles().filter(b=>b.id!==enemy.id)))){
        u.facing=enemy.x<u.x?-1:1;u.angle=Math.atan2(enemy.y-u.y,enemy.x-u.x);
        // Tank's main guided rocket is anti-armor only; infantry is handled by the independent roof MG.
        if(u.kind==='tank'&&'orders' in enemy&&unitSpec(enemy).group==='Infanterie')delete u.burst;
        else{
          const rounds=u.kind==='infantry'||u.kind==='heavy'||u.kind==='scout'||u.kind==='rover'?3:1;
          const weapon:Weapon=u.kind==='infantry'||u.kind==='scout'||u.kind==='rover'?'rifle':u.kind==='heavy'?'heavy':u.kind==='medic'||u.kind==='engineer'?'pistol':'cannon';
          if(u.burst?.target!==enemy.id)delete u.burst;
          if(!u.burst&&u.cooldown<=1e-8){u.cooldown=spec.cooldown/getVeterancyModifiers(u).fireRate;u.burst={target:enemy.id,remaining:rounds,at:this.time,index:0};}
          while(u.burst&&u.burst.at<=this.time+1e-8&&enemy.hp>0){
            u.fire=.18;if(u.kind==='artillery'||u.kind==='tank'||u.kind==='rocket')this.launch(u,enemy);else this.damage(u,enemy,weaponDamage(u,enemy)*getVeterancyModifiers(u).damage/rounds,weapon,{x:u.x,y:u.y-18});
            u.burst.remaining--;u.burst.index++;u.burst.at+=u.kind==='heavy'?.1:.075;
            if(!u.burst.remaining)delete u.burst;
          }
        }
      } else if(enemy&&order?.kind==='attack'){
        delete u.burst;
        // A direct attack command is authoritative and can pursue beyond the guard leash.
        // Empty failed paths retain move()'s existing retry timer. Clearing it
        // here used to repeat an unreachable search on every fixed tick.
        if(u.repath<=0)u.path=[];
        this.move(u,enemy,dt);
      } else if(enemy&&!u.hold&&u.kind!=='medic'&&u.kind!=='engineer'&&u.kind!=='scout'&&!(u.kind==='rover'&&u.transport?.cargo.length)){
        delete u.burst;
        // Idle guards and attack-move squads close the gap, but never chase
        // farther than a short distance from where contact began.
        if(!u.pursuitOrigin){u.pursuitOrigin={x:u.x,y:u.y};u.path=[];u.repath=0;}
        if(distance(u,u.pursuitOrigin)<160){
          if(u.repath<=0)u.path=[];
          this.move(u,enemy,dt);
        } else if(order?.kind==='attackMove'&&u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'){
          // The leash limits a diversion, not progress towards the mission.
          // Keep its origin until contact ends so the same fleeing opponent
          // cannot immediately start another pursuit on the following tick.
          if(u.path.length&&distance(u.path[u.path.length-1],order)>55){u.path=[];u.repath=0;}
          if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;if(u.kind==='tank')u.driveSpeed=0;}
          else this.move(u,order,dt);
        } else {u.path=[];u.repath=0;}
      } else {
        delete u.burst;
        if(u.pursuitOrigin){
          const home=u.pursuitOrigin;
          if(order||distance(u,home)<18){u.pursuitOrigin=null;u.path=[];u.repath=0;}
          else {
            if(u.repath<=0)u.path=[];
            this.move(u,home,dt);
            continue;
          }
        }
        if(order&&!['heal','repair','build'].includes(order.kind)){
          if(order.kind==='attack'&&!enemy){
            // A remembered building is a destination to investigate, never a
            // license to acquire or fire at its hidden live simulation entity.
            const remembered=u.owner===1&&this.world.mapVersion>=3&&this.tactical.mode==='director'&&order.tactical
              ?this.memories[u.owner].find(m=>m.id===order.target&&m.owner!==u.owner&&m.hp>0):undefined;
            if(!remembered){order.kind='attackMove';delete order.target;}
          }
          if(distance(u,order)<18){u.orders.shift();u.path=[];u.repath=0;if(u.kind==='tank')u.driveSpeed=0;}
          else this.move(u,order,dt);
        }
      }
      // Fixed-wing bombers must keep flying while idle. Hold/retreat, explicit
      // routes and pursuit always take priority; the helicopter is unchanged.
      if(u.kind==='bomber'&&!u.orders.length&&!u.hold&&!u.pursuitOrigin){
        // While capturing, orbit the BASTION itself with a wide ~78-unit
        // centered radius, not an accidental 8–20-unit tangent holding loop.
        // Keep the complete aircraft INSIDE the original 95-unit game
        // capture range, so the real ongoing capture is never interrupted.
        const capturing=this.territories.filter(t=>t.owner!==u.owner&&
          distance(u,t.point)<RULES.captureRadius-3)
          .sort((a,b)=>distance(u,a.point)-distance(u,b.point))[0];
        const sectorOrbit=capturing?bastionCaptureOrbit(u,capturing.point,
          RULES.captureRadius,this.world.size):null;
        const safeSectorOrbit=sectorOrbit&&preservesCaptureBoundary(u,sectorOrbit,
          this.territories,u.owner,RULES.captureRadius)?sectorOrbit:null;
        if(safeSectorOrbit&&u.idleOrbit&&
           (u.idleOrbit.cx!==safeSectorOrbit.cx||
            u.idleOrbit.cy!==safeSectorOrbit.cy||
            u.idleOrbit.radius!==safeSectorOrbit.radius))
          delete u.idleOrbit;
        // A scripted position change (or an older save) must not teleport
        // the bomber back to its stale orbit in another sector.
        if(u.idleOrbit&&!isOnBomberOrbit(u,u.idleOrbit))delete u.idleOrbit;
        if(!u.idleOrbit&&safeSectorOrbit){
          // Spiral out to the centered capture circle BEFORE taking over.
          // The path is continuous; no setPosition/teleport or extra units.
          if(Math.abs(distance(u,capturing!.point)-safeSectorOrbit.radius)>.01){
            const next=approachBastionCaptureOrbit(u,safeSectorOrbit,dt);
            u.x=next.x;u.y=next.y;u.angle=next.heading;
            u.hullAngle=next.heading;u.walkDistance+=next.arc;
            u.driveSpeed=next.arc/dt;u.moving=next.arc>.001;
            continue;
          }
          u.idleOrbit=safeSectorOrbit;
          u.path=[];u.repath=0;
        }
        if(!u.idleOrbit){
          const safe=(orbit:BomberOrbit)=>preservesCaptureBoundary(u,orbit,
            this.territories,u.owner,RULES.captureRadius);
          u.idleOrbit=beginBomberOrbit(u,this.world.size,safe)??undefined;
          if(u.idleOrbit){u.path=[];u.repath=0;}
        }
        if(u.idleOrbit){
          const next=advanceBomberOrbit(u.idleOrbit,dt);
          u.x=next.x;u.y=next.y;u.angle=next.heading;u.hullAngle=next.heading;
          u.walkDistance+=next.arc;u.driveSpeed=BOMBER_ORBIT_SPEED;u.moving=true;
        } else {
          // Near a capture boundary, a full tangent turn may be impossible.
          // Cruise into a safe holding area rather than standing still,
          // abandoning an ongoing capture or capturing from outside.
          const next=safeOrbitApproach(u,this.territories,u.owner,RULES.captureRadius,
            this.world.size,dt);
          if(next){
            const dx=next.x-u.x,dy=next.y-u.y,d=Math.hypot(dx,dy);
            u.x=next.x;u.y=next.y;
            u.angle=Math.atan2(dy,dx);u.hullAngle=u.angle;
            u.walkDistance+=d;u.driveSpeed=d/dt;u.moving=true;
          }
        }
      }
    }
    if(this.profileSquadWork)this.squadUnitMs+=performance.now()-squadMoveAt;
    const squadCollisionAt=this.profileSquadWork?performance.now():0;
    for(const u of this.units)if(!u.moving&&u.driveSpeed!==undefined)u.driveSpeed=Math.max(0,u.driveSpeed-unitSpec(u).speed*2.8*dt);
    // Rebuild the spatial index after the drive pass, not from stale
    // pre-movement positions, before resolving overlaps.
    this.spatial.rebuild(this.units);
    // Comfort separation yields to a legitimate drive route in tight spots.
    // Only the original physical radius constitutes a hard collision.
    // Separation uses the same faction-specific blockers as movement.
    const separation=this.movingColliders().byOwner;
    for(const u of this.units)if(u.hp>0&&!u.carrier)
      for(const v of this.spatial.query(u,unitSpec(u).radius+105)){
        if(v.id<=u.id||v.hp<=0||u.airfieldService||v.airfieldService||
          u.factoryService||v.factoryService||
          unitSpec(u).flying!==unitSpec(v).flying)continue;
        // Bombers fly their own physical arcs and are displayed at distinct
        // cruise altitudes. Forcing them apart in the shared 2D ground
        // separation pass made overlapping sorties shimmy and circle forever.
        // Ground units and helicopters retain their current collision rules.
        if(unitSpec(u).flying&&(u.kind==='bomber'||v.kind==='bomber'))continue;
        const spacing=vehicleSpacingGap(u,v);
        const d=distance(u,v);
        if(d>=spacing.comfortable)continue;
        const softOnly=d>=spacing.hard;
        const dx=d>.01?(u.x-v.x)/d:(u.id%2?1:-1);
        const dy=d>.01?(u.y-v.y)/d:.25;
        const push=Math.min(softOnly?2.0:3,(spacing.comfortable-d)*.5);
        for(const [a,sign] of [[u,1],[v,-1]] as const){
          const delta={x:dx*push*sign,y:dy*push*sign};
          if(softOnly&&!preservesVehicleProgress(a,delta))continue;
          const p={x:a.x+delta.x,y:a.y+delta.y};
          // Soft spacing is cosmetic; it must not accelerate a selected player
          // squad past its slowest active reciprocal march member. The actual
          // path movement above already enforces that pace. Keep hard overlap
          // resolution unrestricted so units can never become physically stuck.
          if(softOnly&&a.owner===0&&a.orders[0]?.march?.includes(a.id)&&
             Number.isFinite(a.previousX)&&Number.isFinite(a.previousY)){
            const march=a.orders[0].march!;
            const peers=march.map(id=>this.unitById.get(id)).filter((v):v is Unit=>v!==undefined&&v.owner===a.owner&&
              v.hp>0&&v.orders[0]?.march?.includes(a.id)===true);
            if(peers.length){
              const pace=Math.min(...peers.map(v=>unitSpec(v).speed));
              if(Math.hypot(p.x-a.previousX!,p.y-a.previousY!)>pace*dt+1e-8)continue;
            }
          }
          const faction=separation[a.owner];
          const colliders=unitSpec(a).group==='Fahrzeuge'?faction.vehicle:
           unitSpec(a).flying?faction.buildings:faction.infantry;
          if(unitSpec(a).flying||
           this.world.walkable(p,colliders,Math.max(0,unitSpec(a).radius-10))){
            a.x=p.x;a.y=p.y;
          }
        }
      }
    if(this.profileSquadWork)this.squadCollisionMs+=performance.now()-squadCollisionAt;
    this.transports.cleanup();
    this.bunkerDefensiveFire(dt);
    for(const u of this.units)if(u.hp<=0)this.tactical.loss(u);
    this.units=this.units.filter(u=>u.hp>0);
    for(const b of this.bases){
      if(b.hp<=0)continue;
      if(b.buildRemaining>0){
        const workers=this.units.filter(u=>u.hp>0&&u.owner===b.owner&&u.kind==='engineer'&&u.workingTarget===b.id&&u.orders[0]?.kind==='build'&&u.defendUntil<=this.time&&distance(u,b)<=b.radius+55);
        b.constructionActive=workers.length>0;
        const rates=workers.map(u=>getVeterancyModifiers(u).buildRate),total=rates.reduce((n,v)=>n+v,0);
        const work=Math.min(b.buildRemaining,dt*Math.min(1.5,total));
        if(work>0)workers.forEach((u,i)=>{const share=rates[i]/total;gainUnitXp(u,work*share*XP_RULES.build,'build');if(b.buildRemaining-work<1e-8)gainUnitXp(u,XP_RULES.completion*share,'completion');});
        if(work>0)this.work('build',workers[0].id,b.id,work);
        b.buildRemaining=Math.max(0,b.buildRemaining-work);if(b.buildRemaining<1e-8)b.buildRemaining=0;
        b.hp=Math.min(buildingSpec(b).hp,b.hp+buildingSpec(b).hp*.75*work/buildingSpec(b).buildTime);
        // Remove floating-point dust at completion. A 1e-12 HP deficit must
        // not trigger an autonomous repair order and stall the next core.
        if(b.buildRemaining===0&&b.hp>=buildingSpec(b).hp-1e-6)b.hp=buildingSpec(b).hp;
        if(b.buildRemaining===0&&b.owner===0)this.notices.push(b.kind==='headquarters'&&this.bootstrapVersion===1?'Hauptquartier errichtet. Radar online.':`Gebäude fertiggestellt: ${buildingSpec(b).name}.`);continue;
      }
      b.cooldown-=dt;
      if(b.kind==='turret'){
        const weapon=RULES.turret,blockers=this.obstacles().filter(o=>o.id!==b.id);
        const eligible=(u:Unit)=>u.hp>0&&u.owner!==b.owner&&distance(b,u)<=weapon.range&&
          (this.canSee(b.owner,u)||(distance(b,u)<=buildingSpec(b).sight&&this.world.sightLine(b,u)))&&this.world.line(b,u,blockers);
        const options=this.spatial.query(b,weapon.range).filter(eligible).sort((a,c)=>
          Number(a.kind==='drone')-Number(c.kind==='drone')||distance(b,a)-distance(b,c)||a.id-c.id);
        const locked=this.units.find(u=>u.id===b.turretTarget&&eligible(u));
        const target=locked&&(locked.kind!=='drone'||!options.some(u=>u.kind!=='drone'))?locked:options[0];
        b.previousTurretAngle=b.turretAngle??0;b.turretTarget=target?.id??null;
        const pivot=turretPivot(b),to=target?{x:target.x,y:target.y-(unitSpec(target).flying?(target.kind==='scout'?34+77*(target.flightHeight??1):111):23)}:null,desired=to?Math.atan2(to.y-pivot.y,to.x-pivot.x):b.previousTurretAngle+.14*dt;
        b.turretAngle=turnTowards(b.previousTurretAngle,desired,target?weapon.turnSpeed:.14,dt);
        if(b.burst?.target!==target?.id)delete b.burst;
        if(b.burst&&Math.abs(angleDifference(b.turretAngle,desired))>=.045)b.burst.at=this.time;
        if(target&&to&&Math.abs(angleDifference(b.turretAngle,desired))<.045){
          if(!b.burst&&b.cooldown<=1e-8){b.cooldown=weapon.cooldown;b.burst={target:target.id,remaining:4,at:this.time,index:0};}
          while(b.burst&&b.burst.at<=this.time+1e-8&&target.hp>0){
            const barrel=b.burst.index%2;
            this.damage(b,target,weapon.damage/4,'turret',turretMuzzles(b,b.turretAngle)[barrel],barrel);
            b.burst.remaining--;b.burst.index++;b.burst.at+=.07;
            if(!b.burst.remaining)delete b.burst;
          }
        }

      }
      if(!b.queue.length)continue;
      // QA fast production: retain exact stored queue durations for valid
      // save games and run the ordinary obstacle-safe spawn code this tick.
      b.production=this.testMode&&b.owner===0
       ?b.queue[0]:Math.min(b.queue[0],b.production+dt);
      if(b.production+1e-8>=b.queue[0]){
        const kind=b.queueTypes[0]??'infantry',spec=UNITS[kind],sign=this.world.mapVersion>=2&&b.kind==='headquarters'&&b.owner===1?-1:1,exit={x:b.x+(b.radius+42)*sign,y:b.y+(b.radius+12)*sign};
        const vehicle=spec.group==='Fahrzeuge'&&!spec.flying;
        const buildings=this.obstacles();
        const spawnObstacles=vehicle?[...buildings,...vehicleStructureColliders(buildings),...this.vehicleDecorObstacles(),...this.bastionColliders()]:spec.flying?buildings:[...buildings,...infantryStructureColliders(buildings),...this.bastionColliders()];
        // A factory exit must be clear of the painted building silhouettes,
        // not merely outside their smaller construction footprint circles.
        const clearance=Math.max(0,spec.radius-10);
        // The WebGL shutter faces local +Z. The old fixed diagonal spawn
        // ignored building rotation and sent tanks behind their own factory
        // after the door animation, before they could head for the rally.
        // Hand off in front of the REAL door, on collision-safe ground.
        // Classic (and non-staged) production retains its original spawn.
        let spawn:Point|null=null;
        let footFrontExit=false;
        if(this.stageWebGLProduction&&b.kind==='factory'&&vehicle){
          for(const candidate of factoryDoorExitCandidates(b)){
            if(!this.world.walkable(candidate,spawnObstacles,clearance))continue;
            // nearest() additionally validates occupied cells; require the
            // exact forward candidate, never a surprise rear-side fallback.
            const clear=this.world.nearest(candidate,spawnObstacles,this.units,undefined,clearance);
            if(clear&&distance(clear,candidate)<1){spawn=clear;break;}
          }
        }
        // All WebGL foot soldiers use the real front door, with or without a
         // rally marker. Without rally they stop a few metres beyond it;
         // obstructed doors still fall back to the previous safe exit.
         if(!spawn&&this.stageWebGLProduction&&
            (b.kind==='barracks'||(b.kind==='headquarters'&&kind==='engineer'))){
           for(const candidate of infantryDoorExitCandidates(b)){
             if(!this.world.walkable(candidate,spawnObstacles,clearance))continue;
             const clear=this.world.nearest(candidate,spawnObstacles,this.units,undefined,clearance);
             if(clear&&distance(clear,candidate)<1){spawn=clear;footFrontExit=true;break;}
           }
         }
         // Airfield craft must hand off where the visible departure ENDS:
         // bombers at the far runway threshold, helicopters at the front apron.
         // Classic/non-WebGL saves keep the original immediate diagonal spawn.
         let stagedAirfield=false;
         if(!spawn&&this.stageWebGLProduction&&b.kind==='airfield'&&
            (kind==='bomber'||kind==='scout')){
           const point=airfieldPoint(b,kind==='bomber'?'departure':'lineup');
           // Near map edges or legacy layouts fall back safely; don't spawn
           // a real actor beyond the playable world simply for visual polish.
           const margin=12;
           if(point.x>=margin&&point.y>=margin&&
              point.x<=this.world.size-margin&&point.y<=this.world.size-margin){
             spawn=point;stagedAirfield=true;
           }
         }
         if(!spawn)spawn=spec.flying?exit:this.world.nearest(exit,spawnObstacles,this.units,undefined,clearance);
        if(spawn&&this.count(b.owner)<RULES.capacity){const u=this.spawn(b.owner,spawn,kind);
           if(footFrontExit){
             // Match the visible first steps to the authoritative facing
             // so the actor cannot snap back to its default 45-degree angle.
             const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][b.facing??0]??0;
             u.angle=Math.PI/2-angle;
           }
          // The actual spawn remains authoritative; the renderer performs only a
          // short exterior arrival fade. Never fake an opening in the baked facade.
          this.productionReleases.push({unitId:u.id,baseId:b.id,kind,owner:b.owner,at:this.time,from:{x:b.x,y:b.y},to:{...spawn}});
          if(this.productionReleases.length>24)this.productionReleases.shift();
           countProduced(this.stats,b.owner);if(b.owner===0)this.notices.push(`Einheit bereit: ${spec.name}.`);b.queue.shift();b.queueTypes.shift();b.queueCosts?.shift();b.production=0;if(b.rally)this.command([u.id],{...b.rally,kind:'attackMove'});
           if(footFrontExit&&u.orders[0]&&
              ['move','attackMove'].includes(u.orders[0].kind)){
             // A rally facing is known at production time. The presenter
             // turns gradually to it while approaching the outside waypoint,
             // making the ordinary movement heading continuous at handoff.
             const goal=u.orders[0],dx=goal.x-u.x,dy=goal.y-u.y;
             if(Math.hypot(dx,dy)>12)u.angle=Math.atan2(dy,dx);
           }
           if(this.stageWebGLProduction&&(stagedAirfield||b.kind==='factory'||b.kind==='barracks'||(b.kind==='headquarters'&&kind==='engineer'))){
             // Minimum until the door is fully open and the real vehicle has
             // cleared the hall. The 3D presenter extends this for longer
             // exit routes (backward facings) before the next simulation tick.
             // The presenter releases foot units when the visible walk reaches
             // the lawful spawn, not after a second stationary door close.
             const foot=b.kind==='barracks'||(b.kind==='headquarters'&&kind==='engineer');
             this.productionDepartureHolds.set(u.id,this.time+(stagedAirfield?
              (kind==='bomber'?11.7:8.0):foot?2.65:4.85));
           }
         }
      }
    }
    this.spatial.rebuild(this.units);
    this.bases=this.bases.filter(b=>b.hp>0||b.kind==='headquarters');
    let ownershipChanged=false;
    const captureRadius=capturePresenceRadius(this.world.mapVersion);
    for(const t of this.territories){
      // Use the same modern 3D Bastion ring as captureReadiness and RMB.
      const nearby=this.spatial.query(t.point,captureRadius).filter(u=>u.hp>0&&!u.carrier&&u.kind!=='drone');
      // The actual 1v1 engine still uses players 0/1 (each its own team).
      // The shared team-based capture rule also supports 3/4 players:
      // two allies can hold the ring together, while hostile teams block it.
      const pressure=resolveTeamCapturePresence(nearby,id=>id);
      if(pressure.contested)continue;
      const owner:Owner=pressure.claimant as Owner;
      const defendedBase=this.bases.some(b=>b.kind==='headquarters'&&b.territory===t.id&&b.owner!==owner&&b.hp>0);
      if(owner<0||owner===t.owner||defendedBase||!canCaptureSector(this.territories,t,owner,this.world.mapVersion)){
        t.progress=Math.max(0,t.progress-dt*.5);if(t.progress===0)t.capturing=-1;continue;
      }
      if(t.capturing!==owner){
        // Capture pressure on a blue bastion is also an attack, even if no
        // friendly unit is standing there to receive weapon damage.
        if(t.owner===0&&owner===1)this.attackAlerts.record(t.point,this.time);
        t.capturing=owner;t.progress=0;
      }
      t.progress+=dt;
      if(t.progress+1e-8>=captureSeconds({version:this.world.mapVersion,territory:t,attacker:owner,units:this.units,bases:this.bases})){
        // Sector control belongs to the Bastion ONLY. Never transfer or
        // resurrect a destroyed enemy headquarters when its sector changes
        // hands: its original owner/HP remain intact for elimination rules.
        t.owner=owner;t.progress=0;t.capturing=-1;t.upgradeLevel=1;ownershipChanged=true;
        if(owner===0)this.notices.push(`${t.name} gesichert · +${t.income} Credits / 10 s`);
        else if(this.canSee(0,t.point))this.notices.push(`${t.name} unter feindlicher Kontrolle.`);
        this.revision++;
      }
    }
    this.aiClock+=dt;
    const fullPlan=this.time>=RULES.aiOpeningDelay||this.needsHeadquarters(1);
    // Start genuinely paid modern economy as soon as its HQ is operational,
    // instead of making the opponent appear idle until second 25.
    const modernOpening=this.world.mapVersion>=23&&this.time>=3&&!this.needsHeadquarters(1);
    const legacyEarlyOpening=this.tactical.earlyEconomyMode==='barracks-first'&&
      this.world.mapVersion===11&&this.time>=2;
    const earlyPaidEconomy=this.tactical.mode==='director'&&
      (modernOpening||legacyEarlyOpening);
    if(this.aiClock>=RULES.aiInterval&&(fullPlan||earlyPaidEconomy)){
      this.aiClock=0;
      if(fullPlan)this.think();else this.tactical.openingEconomy();
    }
    if(this.fogClock>=.2||ownershipChanged){this.fogClock=0;this.updateVision();}
    // Classic RTS base elimination: destroying the last opposing structure
    // wins even if stranded infantry, tanks or boarded troops remain. Before
    // a faction constructs ANY building, its starting HQ-less army is safe.
    // Destroyed HQ capture stubs (HP=0) never block the result.
    this.status=eliminationOutcome(this.units,this.bases,this.hadBuildings);
    if(this.testMode)this.credits[0]=Simulation.TEST_CREDITS;
  }
  // The tactical director runs every three simulated seconds and can be the
  // source of frame spikes even when GPU rendering is smooth. Record only
  // performance metadata; do not change deterministic orders or save schema.
  private think():void {
    const start=performance.now();
    try{
      this.tactical.plan();
      const investment=this.ai38Investment();
      // AI uses the SAME paid Bastion upgrade rules as the player.
      // Reserve a healthy army and budget before investing in long-term income.
      if(this.world.mapVersion>=23&&this.time>=170&&this.count(1)>=8&&
        (investment?.goal==='bastion-upgrade'?
         this.credits[1]>=BASTION_UPGRADE_COST+investment.minFreeAfterPurchase:
         this.tactical.ai37Mode==='off'&&this.credits[1]>=BASTION_UPGRADE_COST+1450)){
        const candidate=this.territories.filter(t=>
          bastionUpgradable(t,1,this.bases,
          campaignLayout(this.world.mapVersion,this.seed).headquarters))
          .map(t=>({t,score:this.tactical.ai37Mode==='coordinated'?ai37UpgradeScore({
            income:t.income,
            enemyAdjacent:t.neighbors.some(n=>this.territories[n]?.owner===0),
            visibleRaiders:this.units.filter(u=>u.owner===0&&u.hp>0&&
              !u.carrier&&this.canSee(1,u)&&distance(u,t.point)<420).length,
            contested:t.progress>0,alreadyUpgraded:t.upgradeLevel===2
          }):t.income}))
          .filter(x=>Number.isFinite(x.score))
          .sort((a,b)=>b.score-a.score||a.t.id-b.t.id)[0]?.t;
        if(candidate)this.upgradeBastion(1,candidate.id);
      }
    }
    finally{
      this.aiPlanDurationMs=performance.now()-start;
      this.aiPlanCompletedAt=this.time;
    }
  }
  save():Save {
    return structuredClone({version:2,...(this.world.generated?.battlefield?{terrainProfile:this.world.generated.battlefield.profile,generatorVersion:this.world.generated.battlefield.generatorVersion}:{}),...(this.bootstrapVersion?{bootstrapVersion:this.bootstrapVersion}:{}),weatherVersion:1,productionVersion:1,supportVersion:1,rosterVersion:2,missiles:this.missiles,seed:this.seed,mapVersion:this.world.mapVersion,time:this.time,nextId:this.nextId,credits:this.credits,incomeClock:this.incomeClock,
      units:this.units,bases:this.bases,territories:this.territories,explored:this.explored.map(a=>Array.from(a)),memories:this.memories,aiClock:this.aiClock,ai:this.tactical.state,status:this.status,stats:this.stats,
      research:this.research,strategicMissiles:this.strategicMissiles,
      hadBuildings:this.hadBuildings});
  }
  static load(raw:unknown,weatherEnabled=false):Simulation {
    const s=migrateTransportRoster(raw) as Save;
    const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
    const validMatchStatisticsOrLegacy=(data:unknown)=>data===undefined||validMatchStatistics(data);
    const point=(p:Point)=>p&&finite(p.x)&&finite(p.y)&&p.x>=0&&p.y>=0&&p.x<=mapWorldSize(s?.mapVersion??0)&&p.y<=mapWorldSize(s?.mapVersion??0);
    const research= s?.research??[newResearchState(),newResearchState()];
    if(!Array.isArray(research)||research.length!==2||research.some(s=>!validResearchState(s)))
      throw new Error('Ungültiger Forschungsstand im Spielstand.');
    const researchFor=(u:{owner:Faction;kind?:UnitKind})=>
      researchModifiers(research[u.owner],u.kind??'infantry');
    const burst=(b:Burst|undefined,rounds:number)=>b===undefined||(b!==null&&Number.isInteger(b.target)&&Number.isInteger(b.remaining)&&b.remaining>0&&b.remaining<=rounds&&b.remaining+b.index===rounds&&Number.isInteger(b.index)&&b.index>=0&&b.index<4&&finite(b.at)&&b.at>=s.time-.11&&b.at<=s.time+.11);
    if(!s||s.version!==2||((s.mapVersion??0)>=23&&(!isTerrainProfile(s.terrainProfile)||![1,2,3,4,5,6,7,8,9,10].includes(s.generatorVersion as number)))||((s.mapVersion??0)<23&&(s.terrainProfile!==undefined||s.generatorVersion!==undefined))||(s.bootstrapVersion!==undefined&&s.bootstrapVersion!==1)||(s.weatherVersion!==undefined&&s.weatherVersion!==1)||(s.productionVersion!==undefined&&s.productionVersion!==1)||(s.mapVersion!==undefined&&![0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26].includes(s.mapVersion))||!TacticalAI.valid(s.ai,s.time,point,mapLayout(s.mapVersion??0).columns*mapLayout(s.mapVersion??0).rows)||!finite(s.seed)||!finite(s.time)||s.time<0||!finite(s.incomeClock)||s.incomeClock<0||s.incomeClock>=10||
      (s.supplyCaches!==undefined&&(!Array.isArray(s.supplyCaches)||
        s.supplyCaches.length>16||s.supplyCaches.some(c=>!c||
         !Number.isSafeInteger(c.id)||c.id<0||!finite(c.remaining)||
         c.remaining<0||!finite(c.capacity)||c.capacity<=0||
         c.remaining>c.capacity||!point(c)||
         (c.lastPickupAt!==undefined&&(!finite(c.lastPickupAt)||
          c.lastPickupAt<0||c.lastPickupAt>s.time+.001))||
         (c.restockClock!==undefined&&(!finite(c.restockClock)||
          c.restockClock<0||c.restockClock>SUPPLY_RESTOCK_INTERVAL+.001)))))||
      (s.hadBuildings!==undefined&&(!Array.isArray(s.hadBuildings)||
        s.hadBuildings.length!==2||s.hadBuildings.some(value=>typeof value!=='boolean')))||
      (s.strategicMissiles!==undefined&&(!Array.isArray(s.strategicMissiles)||
        s.strategicMissiles.length>12||
        s.strategicMissiles.some(m=>!validStrategicMissile(m,mapWorldSize(s.mapVersion??0),s.time))))||
       !validMatchStatisticsOrLegacy(s.stats)||!Array.isArray(s.units)||s.units.length>96||!Array.isArray(s.bases)||s.bases.length<(s.bootstrapVersion===1?0:2)||s.bases.length>260||
      s.units.some(u=>!validSupplyJob(u.supply,u.kind??'infantry',mapWorldSize(s.mapVersion??0)))||
      s.units.some(u=>u.exactPath!==undefined&&typeof u.exactPath!=='boolean')||
      s.units.some(u=>u.guardArea!==undefined&&typeof u.guardArea!=='boolean')||
      s.units.some(u=>u.rocketAmmo!==undefined&&
       (u.kind!=='scout'||!Number.isInteger(u.rocketAmmo)||
        u.rocketAmmo<0||u.rocketAmmo>SCOUT_ROCKETS.maxAmmo))||
      s.units.some(u=>u.rocketCooldown!==undefined&&
       (u.kind!=='scout'||!finite(u.rocketCooldown)||
        u.rocketCooldown<0||u.rocketCooldown>SCOUT_ROCKETS.cooldown+1e-6))||
      s.units.some(u=>u.returnToHangar!==undefined&&typeof u.returnToHangar!=='boolean')||
      !Array.isArray(s.territories)||s.territories.length!==mapLayout(s.mapVersion??0).columns*mapLayout(s.mapVersion??0).rows||!Array.isArray(s.explored)||s.explored.length!==2||
      s.explored.some(a=>!Array.isArray(a)||![120**2,RULES.grid**2].includes(a.length)||a.some(v=>v!==0&&v!==1))||
      !Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(v=>!finite(v)||v<0)||
      s.units.some(u=>(u.autoFactoryRepair!==undefined&&typeof u.autoFactoryRepair!=='boolean')||
        (u.factoryService!==undefined&&(!validFactoryService(u.factoryService)||
          !['rover','tank','artillery'].includes(u.kind)))||
        (u.autoAirfieldRepair!==undefined&&typeof u.autoAirfieldRepair!=='boolean')||
        (u.airfieldService!==undefined&&(!['bomber','scout'].includes(u.kind)||!validAirfieldService(u.airfieldService,mapWorldSize(s.mapVersion??0))))||
        (u.mgCooldown!==undefined&&(!finite(u.mgCooldown)||u.mgCooldown<0||u.mgCooldown>1))||!burst(u.burst,u.kind==='infantry'||u.kind==='heavy'||u.kind==='scout'||u.kind==='rover'||u.kind===undefined?3:1)||!point(u)||![0,1].includes(u.owner)||(u.kind!==undefined&&!Object.hasOwn(UNITS,u.kind))||(u.driveSpeed!==undefined&&(!finite(u.driveSpeed)||u.driveSpeed<0||u.driveSpeed>unitSpec(u).speed*researchFor(u).speed))||!validBomberOrbit(u.idleOrbit,u.kind??'infantry',mapWorldSize(s.mapVersion??0))||(u.bomberRun!==undefined&&((u.kind??'infantry')!=='bomber'||!u.bomberRun||!Number.isInteger(u.bomberRun.target)||!Number.isInteger(u.bomberRun.leg)||u.bomberRun.leg<0||u.bomberRun.leg>3||!Array.isArray(u.bomberRun.waypoints)||u.bomberRun.waypoints.length!==3||u.bomberRun.waypoints.some(p=>!point(p))))||(u.hullAngle!==undefined&&!finite(u.hullAngle))||(u.pursuitOrigin!==undefined&&u.pursuitOrigin!==null&&!point(u.pursuitOrigin))||!finite(u.hp)||u.hp<=0||u.hp>(UNITS[u.kind??'infantry']?.hp??0)*researchFor(u).hp+1e-5||!Array.isArray(u.orders)||u.orders.length>32||u.orders.some(o=>!point(o)||(o.guardOnArrival!==undefined&&(o.kind!=='move'||typeof o.guardOnArrival!=='boolean'))||(o.rear!==undefined&&(!finite(o.rear)||o.rear<0||o.rear>400))||(o.tactical!==undefined&&((o.tactical.goal!==undefined&&!point(o.tactical.goal))||!Number.isInteger(o.tactical.group)||!['safe','assault','defend'].includes(o.tactical.mode)))||(o.march!==undefined&&(!Array.isArray(o.march)||o.march.length>96||o.march.some(id=>!Number.isInteger(id))))||(o.approach!==undefined&&!point(o.approach))||(o.healOrigin!==undefined&&!point(o.healOrigin))||(o.formation!==undefined&&(!Array.isArray(o.formation.front)||o.formation.front.length>96||o.formation.front.some(id=>!Number.isInteger(id))||!point(o.formation.origin)||!point(o.formation.goal)||!finite(o.formation.heading?.x)||!finite(o.formation.heading?.y)||Math.hypot(o.formation.heading.x,o.formation.heading.y)>1.001||!finite(o.formation.lane)||!finite(o.formation.rear)))||!['move','attackMove','attack','heal','repair','build','board','garrison'].includes(o.kind)||(['heal','repair','build','board','garrison'].includes(o.kind)&&!Number.isInteger(o.target))))||
      s.bases.some(b=>(b.garrison!==undefined&&
          (b.kind!=='bunker'||!Array.isArray(b.garrison)||
           b.garrison.length>BUNKER_CAPACITY||
           b.garrison.some(id=>!Number.isSafeInteger(id))))||
        (b.facing!==undefined&&![0,1,2,3].includes(b.facing))||!burst(b.burst,b.kind==='turret'?4:1)||!point(b)||![0,1].includes(b.owner)||(b.kind!==undefined&&!Object.hasOwn(BUILDINGS,b.kind))||(b.turretAngle!==undefined&&!finite(b.turretAngle))||
        (b.siloCharge!==undefined&&(!finite(b.siloCharge)||b.siloCharge<0||
          b.siloCharge>SILO_CHARGE_SECONDS||b.kind!=='silo'))||
        (b.interceptorAmmo!==undefined&&(!Number.isInteger(b.interceptorAmmo)||
          b.interceptorAmmo<0||b.interceptorAmmo>INTERCEPTOR_MAX_AMMO||
          b.kind!=='interceptor'))||!finite(b.hp)||b.hp<0||b.hp>(BUILDINGS[b.kind??'headquarters']?.hp??0)||!Array.isArray(b.queue)||b.queue.length>8||b.queue.some((v,i)=>!finite(v)||v!==UNITS[b.queueTypes?.[i]??'infantry']?.buildTime)||
        (b.queueTypes!==undefined&&(!Array.isArray(b.queueTypes)||b.queueTypes.length!==b.queue.length||b.queueTypes.some(k=>!Object.hasOwn(UNITS,k))))||
        (s.productionVersion===1&&b.queue.some((_,i)=>b.queueTypes?.[i]!=='supply'&&
          !UNITS[b.queueTypes?.[i]??'infantry']?.producers.includes(b.kind??'headquarters')))||
        (b.queueCosts!==undefined&&(!Array.isArray(b.queueCosts)||b.queueCosts.length!==b.queue.length||b.queueCosts.some(v=>!finite(v)||v<0)))||
        (b.buildRemaining!==undefined&&(!finite(b.buildRemaining)||b.buildRemaining<0||b.buildRemaining>(BUILDINGS[b.kind??'headquarters']?.buildTime??0)))||!finite(b.production)||b.production<0||b.production>(b.queue[0]??0))||
      s.territories.some((t,i)=>t.id!==i||![-1,0,1].includes(t.owner)||
        !validBastionUpgradeState(t)||!finite(t.progress)||t.progress<0||t.progress>8))throw new Error('Dieser Spielstand ist beschädigt oder gehört zu einer anderen Version.');
    const game=new Simulation(s.seed,s.mapVersion??0,weatherEnabled,s.bootstrapVersion===1,s.terrainProfile,s.generatorVersion??1);
    game.time=s.time;
    game.research=structuredClone(research) as [ResearchState,ResearchState];
    game.stats=s.stats?structuredClone(s.stats):newMatchStatistics();
    // v1 match statistics predate the rocket specialist. Supply its zero count
    // once when loading a legitimate old save, or subsequent production would
    // increment undefined and corrupt the score counter.
    for(const faction of game.stats.factions){
      faction.deployedUnits.rocket??=0;faction.deployedUnits.supply??=0;
    }
    if(!s.stats){game.stats.partial=true;for(const u of s.units){if(u.hp>0){const f=game.stats.factions[u.owner];f.deployedUnits[u.kind??'infantry']++;f.peakArmy+=0;}}for(const owner of [0,1] as const)game.stats.factions[owner].peakArmy=s.units.filter(u=>u.owner===owner&&u.hp>0).length;}
    game.nextId=Math.max(1,Number.isSafeInteger(s.nextId)?s.nextId:1,...s.units.map(u=>u.id+1),...(s.ai?.losses??[]).map(l=>l.id+1));game.credits=[...s.credits];game.incomeClock=s.incomeClock;
    game.bases=structuredClone(s.bases).map(b=>({...b,kind:b.kind??'headquarters',...(isWallLike(b.kind)?{}:game.world.clearSite(b,buildingSpec(b).radius)),radius:buildingSpec(b).radius,...(b.queueCosts?{}:b.queue.length?{queueCosts:b.queue.map((_,i)=>{const k=b.queueTypes?.[i]??'infantry';return !s.supportVersion&&k==='engineer'?150:UNITS[k].cost;})}:{}),queueTypes:b.queueTypes??b.queue.map(()=>'infantry'),buildRemaining:b.buildRemaining??0,cooldown:b.cooldown??0,
      ...(b.kind==='silo'?{siloCharge:b.siloCharge??SILO_CHARGE_SECONDS}:{}),
      ...(b.kind==='interceptor'?{interceptorAmmo:b.interceptorAmmo??INTERCEPTOR_MAX_AMMO}:{})}));
    // Legacy stockpiles are validated above, then discarded. They must never
    // reappear in a restored battle or affect the new bastion-only economy.
    game.supplyCaches=[];
    // Saved history is authoritative. For existing v2 saves without this
    // field infer from live/dead HQ records, observed buildings or units
    // produced by a structure. No inference based on elapsed time: doing so
    // would falsely end an HQ-less opening campaign.
    game.hadBuildings=s.hadBuildings?
      [...s.hadBuildings] as [boolean,boolean]:
      ([0,1] as const).map(owner=>
        game.bases.some(b=>b.owner===owner)||
        (s.stats?.factions[owner]?.producedUnits??0)>0||
        (s.memories?.[1-owner]??[]).some(m=>m.owner===owner)
      ) as [boolean,boolean];
    // Old HQs could queue the entire roster. Refund now-incompatible paid
    // orders once, while preserving valid orders and their active progress.
    let playerRefund=0;
    for(const b of game.bases){
      const queue:number[]=[],types:UnitKind[]=[],costs:number[]=[];let keptActive=false;
      b.queue.forEach((duration,i)=>{const kind=b.queueTypes[i],paid=b.queueCosts?.[i]??UNITS[kind].cost;
        if(UNITS[kind].producers.includes(b.kind)){queue.push(duration);types.push(kind);costs.push(paid);if(i===0)keptActive=true;}
        else {game.credits[b.owner]+=paid;if(b.owner===0)playerRefund+=paid;}
      });
      b.queue=queue;b.queueTypes=types;b.queueCosts=costs;if(!keptActive)b.production=0;
    }
    if(playerRefund>0)game.notices.push(`Nicht mehr passende Produktionsaufträge erstattet · ${playerRefund.toLocaleString('de-DE')} Credits.`);
    // Refund already-deployed retired trucks instead of converting paid
    // logistics vehicles into free combat assets. Both factions get the same
    // 275-credit compensation; historic stats remain unchanged.
    const retired=s.units.filter(u=>u.kind==='supply');
    for(const old of retired)game.credits[old.owner]+=UNITS.supply.cost;
    if(retired.some(u=>u.owner===0))
      game.notices.push('Nachschubtransporter entfernt · '+(retired.filter(u=>u.owner===0).length*UNITS.supply.cost)+' Credits erstattet.');
    game.units=structuredClone(s.units.filter(u=>u.kind!=='supply')).map(u=>{
      const p=u.carrier||unitSpec(u).flying?{x:u.x,y:u.y}:game.world.nearest({x:u.x,y:u.y},[...game.obstacles(),...(unitSpec(u).group==='Infanterie'?infantryStructureColliders(game.obstacles()):vehicleStructureColliders(game.obstacles()))],[],undefined,Math.max(0,unitSpec(u).radius-10))??u;
      return {...u,xp:sanitizeXp(u.xp),kind:u.kind??'infantry',...(!s.rosterVersion&&u.kind==='heavy'?{hp:u.hp/190*UNITS.heavy.hp}:!s.rosterVersion&&u.kind==='scout'?{hp:u.hp/160*UNITS.scout.hp}:{}),...p,path:[],repath:0,hit:0,fire:0,previousX:p.x,previousY:p.y,
        angle:u.angle??(u.facing<0?Math.PI:0),walkDistance:u.walkDistance??0,lastAttacker:u.lastAttacker??null,defendUntil:u.defendUntil??0,
        supply:undefined,factoryService:undefined,autoFactoryRepair:undefined,
        combatTarget:Number.isInteger(u.combatTarget)?u.combatTarget:null,
        pursuitOrigin:u.pursuitOrigin??null};
    });
    // Geometry, income and neighbors are regenerated from the seed, never trusted from storage.
    game.territories.forEach((t,i)=>{t.owner=s.territories[i].owner;t.capturing=s.territories[i].capturing;t.progress=s.territories[i].progress;t.upgradeLevel=s.territories[i].upgradeLevel??1;});
    game.explored=s.explored.map(a=>{
      if(a.length===RULES.grid**2)return Uint8Array.from(a);
      const oldGrid=Math.sqrt(a.length);
      return Uint8Array.from({length:RULES.grid**2},(_,i)=>a[Math.floor(Math.floor(i/RULES.grid)*oldGrid/RULES.grid)*oldGrid+Math.floor((i%RULES.grid)*oldGrid/RULES.grid)]);
    });game.memories=structuredClone(s.memories??[[],[]]);game.aiClock=clamp(s.aiClock||0,0,RULES.aiInterval);
    if(!Transports.valid(game)||!validBunkerGarrisons(game.bases,game.units))
      throw Error('Ungültiger Transport- oder Bunkerbesatzungszustand im Spielstand.');
    if(s.missiles!==undefined&&(!Array.isArray(s.missiles)||s.missiles.length>96||s.missiles.some(m=>!Number.isSafeInteger(m.id)||!Number.isSafeInteger(m.source)||![0,1].includes(m.owner)||!point(m.from)||!point(m.to)||!finite(m.at)||m.at>s.time||!finite(m.impactAt)||m.impactAt<=s.time||m.impactAt>s.time+12||!finite(m.damage)||m.damage<=0||m.damage>Math.max(UNITS.artillery.damage,UNITS.tank.damage,UNITS.rocket.damage*1.24)*getVeterancyModifiers({kind:'tank',xp:500}).damage*1.151||(m.type!==undefined&&!['antiArmor','bomb','scoutRocket'].includes(m.type))||(m.target!==undefined&&(!Number.isSafeInteger(m.target)||m.target<0))||
      (m.miss!==undefined&&typeof m.miss!=='boolean')||!finite(m.angle))))throw Error('Ungültige Raketen im Spielstand.');
    game.missiles=structuredClone(s.missiles??[]);
    game.strategicMissiles=structuredClone(s.strategicMissiles??[]);
    game.nextId=Math.max(game.nextId,...game.missiles.map(m=>m.id+1),
      ...game.strategicMissiles.map(m=>m.id+1));
    game.weather.update(game.time);game.unitById=new Map(game.units.map(u=>[u.id,u]));
    game.tactical.restore(s.ai);
    // Always derive the result from live HP plus persisted building history.
    // This also finishes a save taken immediately after the final enemy
    // structure was destroyed but before the next fixed simulation tick.
    game.status=eliminationOutcome(game.units,game.bases,game.hadBuildings);
    game.spatial.rebuild(game.units);game.updateVision();return game;
  }
}
