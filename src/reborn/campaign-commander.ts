import {distance,type Point} from './config.js';
import type {Memory,Simulation,Unit} from './simulation.js';
import {unitSpec} from './catalog.js';
import {fightingPower,fightingPowerAgainst,type FailedFront} from './battle-response.js';
import {rateMission,type EnemyStrategy} from './adaptive-strategy.js';
import {learnedMissionBias,type Experience} from './battle-learning.js';
import type {Loss} from './tactical-ai.js';
import {replanAfterLoss} from './ai25-doctrine.js';
import {publicBastionDeficit} from './ai35-bastion-doctrine.js';
import {ai43KeepKnownHqMission} from './ai43-hq-breakthrough.js';
import {actionPublicFrontPressure} from './action-balance.js';
import {rankPublicFronts,type PublicSector} from './map-intelligence.js';

export type CampaignPhase='opening'|'expansion'|'buildup'|'offensive'|'siege'|'endgame'|'emergencyDefense';
export interface WarMission extends Point {kind:'capture'|'structure'|'hunt';sector:number;objective:number|null;since:number;progressAt:number;distance:number;hp:number}
export interface ReconTask extends Point {unit:number;since:number}
export interface CampaignState {version:1;phase:CampaignPhase;phaseSince:number;mission?:WarMission;recon:ReconTask[];survey:{x:number;y:number;at:number}[];intel:{id:number;seenAt:number}[];aborted:number;observedEnemyHQ?:Point&{id:number};enemyHQEliminatedAt?:number;alternatives?:{sector:number;score:number;expectedLoss:number;budgetCost:number}[]}
export interface MissionContext {strategy:EnemyStrategy;force:Unit[];losses:Loss[];fronts:FailedFront[];route:(p:Point)=>{length:number;risk:number}|undefined;routeFallback?:(p:Point)=>{length:number;risk:number}|undefined;intelligent?:boolean;bastionControl?:boolean;experience?:Experience;breakthrough?:boolean;actionContact?:boolean;activeAssault?:boolean;homeThreat?:boolean;actionContactEvent?:(reason:string)=>void}
export const newCampaign=():CampaignState=>({version:1,phase:'opening',phaseSince:0,recon:[],survey:[],intel:[],aborted:0});
/** Preserve a recent, observed tower objective after confirmed HQ loss,
 * unless the screen suffers substantial losses or artillery disappears. */
export function keepCleanupTowerObjective(x:{
 confirmedEndgame:boolean;knownTurret:boolean;hasArtillery:boolean;
 missionSeconds:number;recentNearbyLosses:number;recentIntel:boolean;
}):boolean{
 return x.confirmedEndgame&&x.knownTurret&&x.hasArtillery
  &&x.missionSeconds>=0&&x.missionSeconds<90
  &&x.recentNearbyLosses<2&&x.recentIntel;
}
export function campaignPhase(s:CampaignState,phase:CampaignPhase,time:number):void{if(s.phase!==phase){s.phase=phase;s.phaseSince=time;}}
/** The commander's inputs are own possessions, public sectors, fog and observed
 * memories. Never resolve an unseen enemy ID against the live simulation. */
export function knownBuildings(g:Simulation):Memory[]{return g.memories[1].filter(m=>m.owner===0&&m.hp>0);}
export function refreshIntelligence(g:Simulation,s:CampaignState):void{
 const known=knownBuildings(g);
 // Only confirmed observations may activate endgame. Memory loss behind
 // fog is never proof that the headquarters was destroyed.
 const hq=known.find(m=>m.kind==='headquarters');
 if(hq&&!s.observedEnemyHQ)s.observedEnemyHQ={id:hq.id,x:hq.x,y:hq.y};
 // If the opponent genuinely rebuilt/recaptured a visible HQ, it is no
 // longer legitimate to assume the endgame is won.
 if(hq&&s.enemyHQEliminatedAt!==undefined&&g.canSee(1,hq))s.enemyHQEliminatedAt=undefined;
 if(s.observedEnemyHQ&&s.enemyHQEliminatedAt===undefined&&
    g.canSee(1,s.observedEnemyHQ)&&
    !known.some(m=>m.id===s.observedEnemyHQ!.id&&m.kind==='headquarters')&&
    !g.bases.some(b=>b.id===s.observedEnemyHQ!.id&&b.owner===0&&b.hp>0&&g.canSee(1,b)))
  s.enemyHQEliminatedAt=g.time;
 s.intel=s.intel.filter(i=>known.some(m=>m.id===i.id));
 for(const m of known)if(g.canSee(1,m)){
  const i=s.intel.find(i=>i.id===m.id);if(i)i.seenAt=g.time;else s.intel.push({id:m.id,seenAt:g.time});
 }
 s.survey=s.survey.filter(p=>g.time-p.at<180).slice(-64);
}
/** Stable goals survive captures: a remembered HQ in an already owned sector
 * remains a war objective until its destruction has actually been observed. */
export function chooseMission(g:Simulation,s:CampaignState,origin:Point,context?:MissionContext):WarMission|undefined{
 const buildings=knownBuildings(g),old=s.mission;
 const breakthroughHQ=context?.breakthrough?buildings.find(b=>b.kind==='headquarters'):undefined;
 // The war has two explicit strategic objectives:
 // 1. Own and SECURE all public Bastions (including those lost again).
 // 2. Only then destroy remaining enemy units/structures.
 // A known turret or living HQ blocking a Bastion's capture circle is
 // eligible to be attacked during phase one, never as an unrelated raid.
 // Public sector ownership is fair knowledge; unseen enemy structures aren't.
 const unheld=g.territories.filter(t=>t.owner!==1);
 const securingBastions=unheld.length>0;
 // Public 3:1 sector ownership means a severe economic deficit.
 const blueOwned=g.territories.filter(t=>t.owner===0).length,
  redOwned=g.territories.filter(t=>t.owner===1).length;
 const pressured=g.world.mapVersion>=23&&g.territories.length===4&&
  blueOwned>=3&&redOwned<=1||
  !!context?.bastionControl&&publicBastionDeficit(g.world.mapVersion,blueOwned,redOwned);
 // Action-only contact lane: sectors are PUBLIC owner colors, not hidden
 // enemy unit coordinates. Scout memory may exclude known HQ/turrets;
 // unobserved forces are never inspected for this decision.
 const actionFront=(t:PublicSector)=>
  t.owner!==1&&(
   t.owner===0&&t.neighbors.some(id=>g.territories[id]?.owner===1)||
   t.owner===-1&&t.neighbors.some(id=>g.territories[id]?.owner===0)
  )&&
  !buildings.some(b=>b.kind==='headquarters'&&b.territory===t.id||
   b.kind==='turret'&&distance(b,t.point)<670)&&
  g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
   u.kind!=='drone'&&g.canSee(1,u)&&distance(u,t.point)<330).length<=1;
 const actionFighters=context?.force.filter(u=>u.hp>0&&!u.carrier&&
  !['engineer','medic','scout','drone'].includes(u.kind)).length??0;
 if(old&&context?.actionContact)context.actionContactEvent?.('checked');
 if(old&&actionPublicFrontPressure({
    preset:g.balancePreset,time:g.time,blueOwned,available:actionFighters,
    oldKind:old.kind,oldNeutral:g.territories[old.sector]?.owner===-1,
    oldMissionSeconds:g.time-old.since,
    // Opening scouts securing an unrelated Bastion must not pin the whole
    // paid campaign army; only the actual commander's own force qualifies.
    oldCaptureOccupied:context?.force.some(u=>u.hp>0&&!u.carrier&&
     distance(u,old)<175)??false,activeAssault:!!context?.activeAssault,
    homeThreat:!!context?.homeThreat
   })&&context?.actionContact&&!actionFront(g.territories[old.sector])){
   context.actionContactEvent?.('eligible');
   // General-purpose map understanding: use public adjacency (which
   // Bastions meet the BLUE front) AND the actual physical route. No
   // special-case map name, fixed seed, start corner or hidden opponent.
   const candidates=rankPublicFronts({
    sectors:g.territories,origin,worldSize:g.world.size,blueOwned,
    route:context.route,
    knownThreat:t=>!actionFront(t),maxPaths:Math.min(16,g.territories.length)
   });
   const meet=candidates[0];
   if(meet){
    context.actionContactEvent?.('rerouted');
    return s.mission={kind:'capture',...meet.sector.point,
     sector:meet.sector.id,objective:null,hp:0,since:g.time,
     progressAt:g.time,distance:distance(origin,meet.sector.point)};
   }
   context.actionContactEvent?.('no-route');
 }
 const canKeepBlockingObjective=(mission:WarMission,remembered:Memory|undefined)=>{
  if(!remembered||g.territories[mission.sector]?.owner===1)return false;
  const target=g.territories[mission.sector];
  return !!target&&(remembered.kind==='headquarters'&&remembered.territory===target.id
   ||remembered.kind==='turret'&&distance(remembered,target.point)<660);
 };
 if(old){
  const remembered=old.objective===null?undefined:buildings.find(b=>b.id===old.objective);
  const enemy=old.kind==='hunt'?g.units.find(u=>u.id===old.objective&&u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)):undefined;
  const valid=old.kind==='capture'?g.territories[old.sector]?.owner!==1:
   old.kind==='structure'?!!remembered&&(
    !securingBastions||canKeepBlockingObjective(old,remembered)||
    ai43KeepKnownHqMission({
     breakthrough:!!context?.breakthrough,
     rememberedKind:remembered.kind,rememberedId:remembered.id,
     activeObjective:old.objective
    })):
   !securingBastions&&!!enemy;
  const failed=context?.fronts.filter(f=>f.sector===old.sector).sort((a,b)=>b.at-a.at)[0];
  const nearbyLosses=context?.losses.filter(l=>g.time-l.at<60&&distance(l,old)<700).length??0;
  const recentlySeen=s.intel.some(i=>i.id===old.objective&&g.time-i.seenAt<105);
  const protectTower=keepCleanupTowerObjective({
   confirmedEndgame:s.enemyHQEliminatedAt!==undefined,
   knownTurret:remembered?.kind==='turret',
   hasArtillery:!!context?.force.some(u=>u.kind==='artillery'&&u.hp>0),
   missionSeconds:g.time-old.since,recentNearbyLosses:nearbyLosses,recentIntel:recentlySeen
  });
  const costly=!protectTower&&(context?.intelligent?replanAfterLoss({
   elapsed:g.time-old.since,
   freshDamage:!!remembered&&remembered.hp<old.hp,
   progressAge:g.time-old.progressAt,
   recentLosses:nearbyLosses,
   frontFailures:failed?.failures??0,
   frontAge:failed?g.time-failed.at:Infinity
  }):!!context&&g.time-old.since>30&&nearbyLosses>=3&&
    context.fronts.some(f=>f.sector===old.sector&&f.failures>=2&&g.time-f.at<90));
  const unready=context&&old.kind==='structure'&&g.time-old.since>30&&!context.force.some(u=>u.kind==='artillery')&&buildings.filter(b=>b.kind==='turret'&&distance(b,old)<800).length>=2&&g.territories.some(t=>t.owner!==1&&t.neighbors.some(id=>g.territories[id].owner===1)&&!buildings.some(b=>b.kind==='turret'&&distance(b,t.point)<740));
  const blockingOld=pressured&&old.kind==='capture'&&buildings.some(b=>
   b.kind==='headquarters'&&b.territory===old.sector||
   b.kind==='turret'&&distance(b,old)<660);
  const saferEnemySector=blockingOld&&g.territories.some(t=>t.owner===0&&t.id!==old.sector&&
   !buildings.some(b=>b.kind==='headquarters'&&b.territory===t.id||
    b.kind==='turret'&&distance(b,t.point)<660)&&
   !g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u)&&distance(u,t.point)<350));
  if(valid&&!costly&&!unready&&!saferEnemySector&&
    !(breakthroughHQ&&old.kind==='capture')&&g.time-old.progressAt<100){
   if(remembered){old.x=remembered.x;old.y=remembered.y;if(remembered.hp<old.hp){old.progressAt=g.time;old.hp=remembered.hp;}}
   if(enemy){old.x=enemy.x;old.y=enemy.y;}
   // A newly observed tower covering an HQ approach is a concrete reason to
   // interrupt that mission; ordinary score fluctuations are not.
   const blocker=old.kind==='capture'?buildings.find(b=>b.territory===old.sector&&b.kind==='headquarters'||b.kind==='turret'&&distance(b,old)<660)
    :old.kind==='structure'&&remembered?.kind!=='turret'?buildings.find(b=>b.kind==='turret'&&distance(b,old)<660):undefined;
   if(!blocker)return old;
   return s.mission={kind:'structure',x:blocker.x,y:blocker.y,sector:blocker.territory,objective:blocker.id,hp:blocker.hp,since:g.time,progressAt:g.time,distance:distance(origin,blocker)};
  }else if(valid)s.aborted++;
 }
 const owned=g.territories.filter(t=>t.owner===1).length;
 const army=g.units.filter(u=>u.owner===1&&u.hp>0&&!u.carrier&&!['engineer','medic','scout'].includes(u.kind));
 const fieldArmy=army.length>=5&&army.some(u=>['tank','artillery'].includes(u.kind));
 const choices:{kind:WarMission['kind'];p:Point;sector:number;objective:number|null;hp:number;score:number}[]=[];
 const finishing=s.enemyHQEliminatedAt!==undefined;
 const openBastions=new Set<number>();
 // No HQ rush while Bastions remain unheld. Existing capture missions
 // preemptively neutralize only a tower/HQ physically blocking their circle.
 // A proven mobile 2/3-sector overmatch may exploit an ACTUALLY observed HQ,
 // even if an unrelated neutral Bastion is still unheld. A simple early HQ
 // rush remains impossible without intelligence, siege escorts and army power.
 for(const b of securingBastions?breakthroughHQ?[breakthroughHQ]:[]:buildings){
  const blocking=b.kind==='turret'&&buildings.some(other=>['headquarters','barracks','factory','airfield'].includes(other.kind??'')&&distance(other,b)<660);
  // After every Bastion is held, clean up visible production and combat units.
  const production=['barracks','factory','airfield'].includes(b.kind??'');
  const value=breakthroughHQ?.id===b.id?4200:finishing?(blocking?3500:production?3900:b.kind==='turret'?2600:1750)
   :blocking?2100:b.kind==='headquarters'?1900:b.kind==='turret'?1200:production?1450:700;
  choices.push({kind:'structure',p:b,sector:b.territory,objective:b.id,hp:b.hp,score:distance(origin,b)-value});
 }
 // Capture public Bastions first, but avoid suicidally marching into
 // an enemy HQ or a turret just because its sector is technically adjacent.
 // Visible blockers are legitimate siege objectives OF THAT BASTION only.
 // Previously the strict capture-only filter removed those siege missions,
 // costing 1-2 Bastions per 5-minute benchmark despite extra troops.
 const frontier=unheld.filter(t=>t.neighbors.some(id=>g.territories[id].owner===1));
 for(const t of frontier.length?frontier:unheld){
  const blockers=buildings.filter(b=>
   b.kind==='headquarters'&&b.territory===t.id||
   b.kind==='turret'&&distance(b,t.point)<660);
  const clear=blockers.length===0;
  // Only a genuinely unguarded neutral Bastion is an immediate safe push.
  // Never infer enemy movement behind fog or ignore a visible raiding squad.
  const visibleGuards=g.units.some(u=>u.owner===0&&u.hp>0&&!u.carrier&&
   g.canSee(1,u)&&distance(u,t.point)<350);
  if(clear&&!visibleGuards&&(t.owner===-1||pressured&&t.owner===0))openBastions.add(t.id);
  // Neutral unfortified income is the fastest way to support paid armies.
  // Public enemy-held sectors still matter (especially recent losses), but
  // don't outrank a safe nearby Bastion just for being colored blue.
  const retake=context?.experience?.lastLostSector===t.id;
  const score=distance(origin,t.point)-t.income*10-
   (clear&&t.owner===-1?1800:0)-
   (pressured&&clear&&t.owner===0&&!visibleGuards?
    (context?.bastionControl?2300:1700):0)-
   (retake?1450:0)+(blockers.length?1000:0)+(t.owner===0?200:0);
  choices.push({kind:'capture',p:t.point,sector:t.id,objective:null,hp:0,score});
  // A physical shield must be destroyed before the Bastion can be secured.
  // Do not queue unrelated enemy factories or HQs during expansion.
  for(const b of blockers){
   const score=distance(origin,b)-
    (b.kind==='headquarters'?1650:1100)+(retake?-500:0);
   choices.push({kind:'structure',p:b,sector:t.id,objective:b.id,hp:b.hp,score});
  }
 }
 // In cleanup, visible survivors remain targets even with neutral fronts.
 if(!securingBastions)for(const u of g.units)if(u.owner===0&&u.hp>0&&!u.carrier&&g.canSee(1,u))
  choices.push({kind:'hunt',p:u,sector:g.territories.reduce((a,b)=>distance(u,a.point)<distance(u,b.point)?a:b).id,objective:u.id,hp:u.hp,score:distance(origin,u)-(finishing?1650:0)});
 if(context){
  const ownHP=context.force.reduce((n,u)=>n+u.hp,0),siege=context.force.some(u=>u.kind==='artillery');
  const alternatives:{sector:number;score:number;expectedLoss:number;budgetCost:number}[]=[];
  for(const choice of choices){
   const forts=buildings.filter(b=>b.kind==='turret'&&distance(b,choice.p)<800);
   const defenders=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&u.kind!=='drone'&&g.canSee(1,u)&&distance(u,choice.p)<450);
   const seen=s.intel.find(i=>i.id===choice.objective)?.seenAt??g.time-45;
   const failed=context.fronts.filter(f=>f.sector===choice.sector&&g.time-f.at<120).reduce((n,f)=>n+f.failures,0);
   const rating=rateMission({base:choice.score,distance:distance(origin,choice.p),income:g.income(1),missingCredits:forts.length&&!siege?Math.max(0,600-g.credits[1]):0,
    ownHP,foeDPS:forts.length*30+defenders.reduce((n,u)=>n+unitSpec(u).damage/unitSpec(u).cooldown,0),visiblePower:fightingPowerAgainst(defenders,context.force),ownPower:fightingPowerAgainst(context.force,defenders,forts.map(t=>({...t,range:600}))),
    towers:forts.length,siege,age:choice.kind==='structure'?Math.max(0,g.time-seen):0,failures:failed,capture:choice.kind==='capture',enemyOwned:g.territories[choice.sector].owner===0},context.strategy);
   choice.score=rating.score+(context.experience?learnedMissionBias(context.experience,forts.length?'siege':'maneuver',forts.length,context.force.length):0);
   alternatives.push({sector:choice.sector,...rating,score:choice.score});
  }
  s.alternatives=alternatives.sort((a,b)=>a.score-b.score||a.sector-b.sector).slice(0,8);
 }
 choices.sort((a,b)=>a.score-b.score||a.sector-b.sector||(a.objective??0)-(b.objective??0));
 // Open Bastions outrank fighting a distant blockade. Still validate a
 // REAL safe route; if all free routes are blocked, siege the observed
 // obstacle instead of doing nothing. This also fixes the long-range
 // "turret first" case where a guarded circle and a free circle were
 // both in scoring range but raw distance chose the unnecessary gun.
 const safe=(c:typeof choices[number])=>c.kind==='capture'&&openBastions.has(c.sector);
 const ordered=securingBastions?
  [...choices.filter(safe),...choices.filter(c=>!safe(c))]:choices;
 const routed:{c:typeof choices[number];route:{length:number;risk:number}}[]=[];
 // Inspect all safe public fronts first, then the best available siege.
 // A blocked/unreachable neutral must never permanently freeze the army.
 if(context)for(const c of ordered.slice(0,context.intelligent?24:ordered.length)){
  const route=context.route(c.p);if(route)routed.push({c,route});
  if(routed.length===(context.intelligent?8:6))break;
 }
 // KI 4.0: a KNOWN and observed HQ with an ACTUALLY secured near-complete
 // Bastion economy can be approached through a VALIDATED canyon segment even
 // while other Bastions have ordinary full routes. Previously the
 // conservative fallback was consulted only when every unrelated capture
 // candidate failed. The attack-mission selector then preferred a quiet
 // Bastion indefinitely despite available artillery and a genuine siege
 // army. A fallback is not a fabricated complete route or free vision.
 // Partial pass routing is an EXPENSIVE strategic pivot. During active
 // Bastion contests it can divert the whole paid force away from securing
 // the remaining sectors (observed regression on the 16-Bastion canyon).
 // Keep ordinary complete-route captures until >=7/8 of public sectors
 // are physically held; only then perform the risky last HQ breakthrough.
 if(context?.breakthrough&&breakthroughHQ&&context.routeFallback&&
    redOwned>=Math.ceil(g.territories.length*.875)&&
    !routed.some(r=>r.c.kind==='structure'&&r.c.objective===breakthroughHQ.id)){
  const observed=choices.find(c=>c.kind==='structure'&&
    c.objective===breakthroughHQ.id);
  if(observed){
   const partial=context.routeFallback(observed.p);
   if(partial&&partial.risk<12)routed.push({c:observed,route:partial});
  }
 }
 // Bounded full-route searches can reject a reachable distant HQ after
 // the R-01 reveals it early. The movement engine already supports verified
 // partial paths. Only use this AI3.6-only alternative when ALL complete
 // candidate routes failed; never turn a temporary path budget into victory.
 // AI3.5 does not supply routeFallback and stays byte-for-byte unchanged.
 if(context&&!routed.length&&context.routeFallback){
  for(const c of ordered.slice(0,12)){
   const route=context.routeFallback(c.p);
   if(!route)continue;
   routed.push({c,route});
   if(routed.length===4)break;
  }
 }
 routed.sort((a,b)=>a.c.score+a.route.length*.15+a.route.risk*12-b.c.score-b.route.length*.15-b.route.risk*12);
 const safeRoute=routed.filter(r=>safe(r.c)&&r.route.risk<8)[0];
 const decisive=context?.breakthrough&&breakthroughHQ?routed.find(r=>
   r.c.kind==='structure'&&r.c.objective===breakthroughHQ.id&&r.route.risk<12):undefined;
 const next=context?(decisive??safeRoute??routed[0])?.c:ordered[0];
 return s.mission=next?{kind:next.kind,x:next.p.x,y:next.p.y,sector:next.sector,objective:next.objective,hp:next.hp,since:g.time,progressAt:g.time,distance:distance(origin,next.p)}:undefined;
}
/** Coarse, deterministic fog frontiers. Sampling terrain is public navigation
 * knowledge; importance uses public territory control, never hidden bases. */
export function reconGoal(g:Simulation,s:CampaignState,u:Unit,danger:(p:Point)=>number):Point|undefined{
 const task=s.recon.find(t=>t.unit===u.id);
 if(task&&g.time-task.since<65&&!g.canSee(1,task)&&danger(task)<3)return task;
 if(task){s.survey.push({x:task.x,y:task.y,at:g.time});s.survey=s.survey.slice(-64);s.recon=s.recon.filter(t=>t!==task);}
 const candidates:{p:Point;score:number}[]=[],step=g.world.size/12;
 for(let y=step/2;y<g.world.size;y+=step)for(let x=step/2;x<g.world.size;x+=step){
  const p={x,y};if(g.canSee(1,p)||danger(p)>3||s.recon.some(t=>distance(t,p)<step*1.5)||s.survey.some(t=>distance(t,p)<step*.7))continue;
  if(!g.world.walkable(p,[],0)&&!unitSpec(u).flying)continue;
  const sector=g.territories.reduce((a,b)=>distance(p,a.point)<distance(p,b.point)?a:b);
  const stale=s.intel.some(i=>g.time-i.seenAt>90&&knownBuildings(g).some(b=>b.id===i.id&&distance(b,p)<500));
  candidates.push({p,score:distance(u,p)+(g.hasExplored(1,p)?2500:0)-(sector.owner===0?1800:0)-(stale?350:0)});
 }
 candidates.sort((a,b)=>a.score-b.score||a.p.y-b.p.y||a.p.x-b.p.x);
 const goal=candidates[0]?.p;if(goal)s.recon.push({...goal,unit:u.id,since:g.time});return goal;
}
export function validCampaign(raw:unknown,time:number,point:(p:Point)=>boolean,sectors:number):boolean{
 if(raw===undefined)return true;const s=raw as CampaignState,num=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=0,at=(n:unknown)=>num(n)&&(n as number)<=time+.001,id=(n:unknown)=>Number.isInteger(n)&&(n as number)>=0;
 return !!s&&s.version===1&&['opening','expansion','buildup','offensive','siege','endgame','emergencyDefense'].includes(s.phase)&&at(s.phaseSince)&&id(s.aborted)
  &&(s.observedEnemyHQ===undefined||(point(s.observedEnemyHQ)&&id(s.observedEnemyHQ.id)))
  &&(s.enemyHQEliminatedAt===undefined||(at(s.enemyHQEliminatedAt)&&s.observedEnemyHQ!==undefined))
  &&(s.alternatives===undefined||(Array.isArray(s.alternatives)&&s.alternatives.length<=8&&s.alternatives.every(a=>id(a.sector)&&a.sector<sectors&&typeof a.score==='number'&&Number.isFinite(a.score)&&num(a.expectedLoss)&&a.expectedLoss<=1&&num(a.budgetCost))))
  &&Array.isArray(s.recon)&&s.recon.length<=16&&s.recon.every(t=>point(t)&&id(t.unit)&&at(t.since))
  &&Array.isArray(s.survey)&&s.survey.length<=65&&s.survey.every(p=>point(p)&&at(p.at))
  &&Array.isArray(s.intel)&&s.intel.length<=128&&s.intel.every(i=>id(i.id)&&at(i.seenAt))
  &&(s.mission===undefined||(point(s.mission)&&['capture','structure','hunt'].includes(s.mission.kind)&&id(s.mission.sector)&&s.mission.sector<sectors&&(s.mission.objective===null||id(s.mission.objective))&&at(s.mission.since)&&at(s.mission.progressAt)&&num(s.mission.distance)&&num(s.mission.hp)));
}
