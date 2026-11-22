import {UNITS,canAttack,type UnitKind} from './catalog.js';
import {preferredRole} from './ai-director.js';
import {rocketInfantryQuota,bomberAntiArmorQuota} from './ai-counter-doctrine.js';
import {ai36AirDoctrineEnabled,bomberSupportQuota} from './ai36-air-support.js';
import type {Simulation,Unit,Base} from './simulation.js';
import type {TacticalState} from './tactical-ai.js';
import type {ProductionDecision} from './army-economy.js';

/** Bastion control funds larger mechanized armies, not piles of unused credits.
 * In particular, do not mistake `rover:2` or `artillery:2` for a permanent
 * ceiling once the AI owns the majority of income-producing Bastions.
 * Use ONLY public ownership and earned periodic income; no fog information.
 * Stage is derived each macro tick, no persistent save migration needed.
 */
export function bastionSurplusArmyStage(input:{
 time:number;income:number;ownedBastions:number;totalBastions:number;
}):0|1|2{
 const {time,income,ownedBastions,totalBastions}=input;
 if(time<140||income<60||totalBastions<2||
    ownedBastions<Math.max(2,Math.ceil(totalBastions*.6)))return 0;
 return income>=90?2:1;
}
interface ProductionContext {
 own:Base[]; army:Unit[]; seen:Unit[]; income:number; underAttack:boolean;
 knownTurrets:number; knownEnemyHQ:boolean; reserve:number; siegeReserve?:number; infrastructureReserve?:number; maxArmy:number;
 scores:Record<UnitKind,number>;defenseNeedsWorker:boolean;finishing:boolean;
}
/** A paid early rocket after the first scout vehicle covers the eventual tower
 * assault without claiming knowledge of an undiscovered enemy. Do not sacrifice
 * emergency defense, air counters or the opening economy in weak positions. */
export function earlyArtilleryWindow(input:{
 factoryReady:boolean; artillery:number; rovers:number; tanks:number;
 fighters:number; income:number; underAttack:boolean; visibleEnemyAir:boolean; time:number;
}):boolean{
 return input.factoryReady&&input.artillery===0&&input.rovers>=1&&input.tanks===0
  &&input.fighters>=5&&input.income>=65&&input.time>=60&&input.time<210
  &&!input.underAttack&&!input.visibleEnemyAir;
}
/** Keep a committed Bunker budget even when an urgent barracks would
 * otherwise spend nearly every incoming credit on 100-credit riflemen.
 * Real home-defense emergencies release this budget upstream.
 */
export function ai38CommittedProductionReserve(input:{
 urgentBarracks:boolean;plannedArtillery:boolean;
 reserve:number;siegeReserve:number;infrastructureReserve:number;
}):number{
 const x=input;
 return x.urgentBarracks
  ?Math.max(x.infrastructureReserve,Math.min(125,x.reserve)):
  x.plannedArtillery
   ?Math.max(x.infrastructureReserve,x.reserve-x.siegeReserve):x.reserve;
}

/** Purchase priorities are persistent composition deficits, not affordable-unit scores.
 * Counts include paid queues, so one factory never reserves money for a unit it
 * has already ordered. Every purchase still goes through Simulation.recruit. */
export function produceCombinedArmy(g:Simulation,s:TacticalState,c:ProductionContext):void {
 const e=s.economy!;
 const count=(kind:UnitKind)=>c.army.filter(u=>u.kind===kind).length+
  c.own.reduce((n,b)=>n+b.queueTypes.filter(k=>k===kind).length,0);
 const available=(kind:UnitKind)=>c.own.some(b=>b.buildRemaining<=0&&b.queue.length<2&&UNITS[kind].producers.includes(b.kind));
 const counts=()=>Object.fromEntries((Object.keys(UNITS) as UnitKind[]).map(k=>[k,count(k)])) as Record<UnitKind,number>;
 const ground=()=>count('rover')+count('tank')+count('artillery');
 // Unarmed recon drones must not consume AA budgets or suspend a bomber plan.
 const seen=c.seen.filter(u=>u.kind!=='drone');
 const enemyAir=seen.find(u=>UNITS[u.kind].flying);
 const observed={infantry:seen.filter(u=>UNITS[u.kind].group==='Infanterie'&&!['engineer','medic'].includes(u.kind)).length,
  armor:seen.filter(u=>UNITS[u.kind].group==='Fahrzeuge'&&!UNITS[u.kind].flying).length,
  air:seen.filter(u=>UNITS[u.kind].flying).length};
 const belief=s.adaptive;
 if(belief&&belief.confidence>=.55&&g.time-belief.updatedAt<=30){
  // Briefly losing sight of a force should not immediately restart a siege
  // purchase. The remembered kinds contain observations, never hidden state.
  const recent=belief.sightings.filter(v=>g.time-v.seenAt<=30);
  if(belief.strategy==='air')observed.air=Math.max(observed.air,recent.filter(v=>v.kind==='bomber').length);
  if(belief.strategy==='armor')observed.armor=Math.max(observed.armor,recent.filter(v=>['tank','rover','artillery'].includes(v.kind)).length);
  if(belief.strategy==='infantry')observed.infantry=Math.max(observed.infantry,recent.filter(v=>v.kind==='infantry'||v.kind==='heavy').length);
 }
 const airTarget=enemyAir??(observed.air?{kind:'bomber' as const}:undefined);
 const fighters=c.army.filter(u=>!['engineer','medic','scout','supply','drone'].includes(u.kind)).length;
 const rocketQuota=rocketInfantryQuota({fighters,time:g.time,
  vehicles:observed.armor,air:observed.air,
  barracksReady:available('rocket'),underAttack:c.underAttack});
 const antiArmorQuota=bomberAntiArmorQuota({airfieldReady:available('bomber'),
  income:c.income,fighters,groundVehicles:ground(),
  enemyArmor:observed.armor,enemyAir:observed.air,
  underAttack:c.underAttack,finishing:c.finishing});
 const supportQuota=bomberSupportQuota({
  enabled:ai36AirDoctrineEnabled(g),airfieldReady:available('bomber'),
  fighters,groundVehicles:ground(),income:c.income,time:g.time,
  underAttack:c.underAttack,enemyAir:observed.air,
  contestedBastions:g.territories.some(t=>t.owner!==1),
  finishing:c.finishing
 });
 const bomberQuota=Math.max(antiArmorQuota,supportQuota);
 const armyStage=g.world.mapVersion>=23&&!c.finishing?bastionSurplusArmyStage({
  time:g.time,income:c.income,
  ownedBastions:g.territories.filter(t=>t.owner===1).length,
  totalBastions:g.territories.length
 }):0;
 // A visible force, rather than an unseen technology assumption, creates a
 // counter deficit. Queue counts make this stable across successive pulses.
 const counter=():UnitKind|null=>{
  if(observed.air){
   // Guided shoulder missiles are the primary AA counter. Buy the actual
   // paid rocket from barracks even if an airfield/factory is unavailable.
   if(available('rocket')&&count('rocket')<rocketQuota&&
      (g.credits[1]-c.reserve>=UNITS.rocket.cost||!c.underAttack))
     return 'rocket';
   // A broke base still receives an immediate affordable heavy screen.
   if(available('heavy')&&count('heavy')<Math.min(3,Math.ceil(observed.air/2)))
     return 'heavy';
  }
  if(observed.armor>0&&available('rocket')&&count('rocket')<rocketQuota&&
     (g.credits[1]-c.reserve>=UNITS.rocket.cost||!c.underAttack))
    return 'rocket';
  if(observed.armor>=2&&available('tank')&&count('tank')<Math.min(4,Math.ceil(observed.armor/2)))return 'tank';
  if(observed.infantry>=3&&observed.infantry>observed.armor&&available('heavy')&&count('heavy')<Math.min(3,Math.ceil(observed.infantry/3)))return 'heavy';
  return null;
 };
 const planned=():UnitKind|null=>{
  if(count('engineer')===0&&available('engineer'))return 'engineer';
  if(c.defenseNeedsWorker&&count('engineer')<2&&available('engineer'))return 'engineer';
  // The 4.1 cleanup loop repeatedly bought cheap infantry while its factory
  // saved for a gun. Force a paid artillery priority before adding escorts.
  // Queued artillery counts; the same resource must not be reserved twice.
  if(c.finishing&&!c.underAttack&&!observed.air&&available('artillery')&&
    count('artillery')===0&&(c.knownTurrets>0||s.battle?.assessment?.neededSiege))
   return 'artillery';
  const response=counter();if(response)return response;
  // Enough visible armor makes a bomber a meaningful strike investment
  // once it has an operational airfield and paid ground screen. No scout
  // prerequisite; a bomber is a dedicated combat aircraft, not a transport.
  if(bomberQuota>count('bomber')&&available('bomber'))return 'bomber';
  // An observed siege earns its first paid rocket as soon as the factory
  // opens. While construction is unfinished, the same funds are reserved
  // from barracks and other producers by the macro controller.
  if(c.siegeReserve&&available('artillery')&&count('artillery')===0&&
     !c.underAttack&&!observed.air)return 'artillery';
  // AI 4.8 diagnostics: factories are available around 68 seconds, but
  // first artillery often takes 210-370 seconds. Use one optional early
  // siege weapon only after a paid rover and an established funded army.
  // A queued rocket counts as already purchased and avoids duplicate saving.
  if(earlyArtilleryWindow({factoryReady:available('artillery'),
     artillery:count('artillery'),rovers:count('rover'),tanks:count('tank'),
     fighters,income:c.income,underAttack:c.underAttack,
     visibleEnemyAir:observed.air>0,time:g.time}))return 'artillery';
  if(c.finishing&&!c.underAttack){
   // A small screen can protect the siege weapon; indefinitely replacing
   // fallen infantry cannot. Keep an affordable heavy escort too.
   if(count('heavy')<2&&available('heavy'))return 'heavy';
   if(count('infantry')<3&&available('infantry'))return 'infantry';
  }
  if(c.underAttack)return null;
  const siegeNeed=s.battle?.assessment?.neededSiege??0;
  if(!observed.air&&available('artillery')&&count('artillery')<siegeNeed&&ground()>=2)return 'artillery';
  if(!observed.air&&available('artillery')&&count('artillery')===0&&(c.knownEnemyHQ||c.knownTurrets>0))return 'artillery';
  if(available('tank')){
   if(ground()===0)return g.credits[1]-c.reserve>=UNITS.tank.cost?'tank':'rover';
   if(count('rover')>=1&&count('tank')===0)return 'tank';
   if(!observed.air&&count('rover')>=1&&count('tank')>=1&&count('artillery')===0&&c.income>=35&&fighters>=5)return 'artillery';
  }
  // Even with temporarily no visible aircraft, keep ONE paid anti-armor/AA
  // specialist in the late infantry group rather than buying rifles forever.
  if(available('rocket')&&count('rocket')<rocketQuota)return 'rocket';
  // Rebuild a minimal escort before replacing expensive aircraft. An army
  // reduced to recovering armor must not spend every future payment on air.
  if(ground()>=2&&available('infantry')&&count('infantry')<2)return 'infantry';
  if(ground()>=2&&available('heavy')&&count('heavy')===0&&(e.produced.scout??0)>0)return 'heavy';
  // Protect the first transport and its replacements from endless ground purchases.
  if(available('scout')&&(ground()>=2||!available('tank'))&&count('scout')===0)return 'scout';
  if(available('rover')&&ground()<3&&fighters>=5)return 'rover';
  // Protect support purchases too: repeatedly falling back to a 100-credit
  // soldier can otherwise starve heavy infantry and healing for an entire war.
  if(ground()>=2&&fighters>=3&&available('heavy')&&count('heavy')<Math.min(2,Math.ceil(count('infantry')/3)))return 'heavy';
  if(available('medic')&&count('infantry')+count('heavy')>=4&&count('heavy')>0&&count('medic')===0)return 'medic';
  return null;
 };
 // Real paid unit-count ceilings: the earlier 8 rifles / 3 heavy / 1
 // rover / 2 tanks exhausted almost every factory's useful composition
 // before the global army cap. Keep anti-air and airstrike quotas driven
 // by OBSERVED enemies, rather than manufacturing invisible-threat counters.
 const ceiling=(kind:UnitKind):number=>({
  infantry:12,heavy:armyStage===2?8:armyStage===1?7:c.income>=65?6:5,
  rocket:rocketQuota,
  medic:Math.min(3,Math.ceil((count('infantry')+count('heavy'))/5)),
  engineer:c.defenseNeedsWorker||c.own.length>=4&&(s.recovering?.length??0)>0?2:1,
  supply:0,harvester:0,
  rover:armyStage===2?5:armyStage===1?4:2,
  tank:armyStage===2?9:armyStage===1?7:
   c.income>=65||observed.armor>=3?6:4,
  artillery:armyStage===2?6:armyStage===1?4:
   c.knownTurrets>1?4:c.knownEnemyHQ||c.knownTurrets?3:2,
  scout:1,bomber:Math.max(bomberQuota,c.income>=65&&!c.finishing?1:0),
  drone:0,
 })[kind];
 const ranks=(producer:Base):UnitKind[]=>{
  const n=counts();
  if(c.finishing&&producer.kind==='airfield'&&count('scout')>=1&&bomberQuota<=count('bomber'))return [];
  let result=preferredRole(producer.kind,n,c.knownTurrets+(c.knownEnemyHQ?1:0),observed.air) as UnitKind[];
  // A second worker is useful once repairs and construction can overlap.
  if(producer.kind==='headquarters')result=['engineer'];
  if(producer.kind==='barracks'&&n.infantry+n.heavy>=5&&n.heavy>=1&&n.medic<ceiling('medic'))result=['medic',...result.filter(k=>k!=='medic')];
  // Factory production must not monopolize a second, otherwise free,
  // barracks or airfield. Every producer can queue its own affordable
  // counter as long as the relevant paid quota is unfilled.
  if(producer.kind==='barracks'&&n.rocket<rocketQuota)
   result=['rocket',...result.filter(k=>k!=='rocket')];
  if(producer.kind==='airfield'&&n.bomber<bomberQuota)
   result=['bomber',...result.filter(k=>k!=='bomber')];
  if(armyStage&&producer.kind==='factory'&&!observed.air){
   // Ratio-to-ceiling spreads surplus orders across ALL three real vehicles,
   // rather than queuing tanks forever and then leaving artillery unused.
   // True counter/siege orders still win through planned() above.
   const order:['tank','rover','artillery']=['tank','rover','artillery'];
   const tieBreak:Record<'tank'|'rover'|'artillery',number>={
    tank:0,rover:1,artillery:2
   };
   result=order.sort((a,b)=>
    n[a]/ceiling(a)-n[b]/ceiling(b)||
    tieBreak[a]-tieBreak[b]);
  }
  return result.filter(k=>n[k]<ceiling(k));
 };
 const producers=c.own.filter(b=>b.buildRemaining<=0&&b.queue.length<2);
 // A long-running offensive with fewer than fourteen living fighters needs
 // paid infantry NOW, not an idle barracks while one factory saves for an
 // aircraft or a second heavy vehicle. Barracks take a limited first turn;
 // observed AA and anti-armor counter quotas are still handled in ranks().
 const offensiveShortfall=g.world.mapVersion>=23&&g.time>=100&&!c.finishing&&
  !c.underAttack&&fighters<14&&
  g.territories.some(t=>t.owner!==1)&&available('infantry');
 const initial=planned();
 const priority=(b:Base)=>offensiveShortfall&&b.kind==='barracks'?-2:
  (initial&&UNITS[initial].producers.includes(b.kind)?-1:
   ({factory:0,airfield:1,barracks:2,headquarters:3} as Record<string,number>)[b.kind]??4);
 producers.sort((a,b)=>priority(a)-priority(b)||a.id-b.id);
 const facilities:Record<number,ProductionDecision>={};
 for(const b of c.own.filter(b=>b.buildRemaining<=0&&b.queue.length>=2))facilities[b.id]={reason:'queue-blocked',goal:null,missing:0};
 let purchased=false;
 for(const producer of producers){
  const workerLost=count('engineer')===0&&producer.kind==='headquarters';
  if(g.count(1)+g.queued(1)>=c.maxArmy&&!workerLost){facilities[producer.id]={reason:'army-cap',goal:null,missing:0};continue;}
  const need=planned(),isPlanned=need!==null&&UNITS[need].producers.includes(producer.kind);
  const urgentBarracks=offensiveShortfall&&producer.kind==='barracks'&&
   (c.siegeReserve??0)===0;
  const protection=need&&!isPlanned&&!urgentBarracks?UNITS[need].cost:0;
  // On the offensive, an idle barracks may spend real earned credits on
  // infantry instead of protecting an entire *optional* expensive queue.
  // KI 3.8: optional factory/artillery reservations can be released to an
  // urgent infantry screen, but a deliberately funded 650-credit Bunker
  // must not be starved by repeated 100-credit rifle purchases.
  const committedReserve=ai38CommittedProductionReserve({
    urgentBarracks,plannedArtillery:isPlanned&&need==='artillery',
    reserve:c.reserve,siegeReserve:c.siegeReserve??0,
    infrastructureReserve:c.infrastructureReserve??0
  });
  const budget=g.credits[1]-(workerLost?0:committedReserve)-protection;
  let choices=isPlanned?[need!,...ranks(producer).filter(k=>k!==need)]:ranks(producer);
  // Barracks and airfields are independent production facilities. A high
  // priority tank/artillery saving goal from the factory must not erase a
  // REAL rocket or bomber shortfall in another completed producer. This
  // remains fully paid and honors global reserve, queue and army limits.
  const ownCounter=producer.kind==='barracks'&&count('rocket')<rocketQuota
   ?'rocket':producer.kind==='airfield'&&count('bomber')<bomberQuota
   ?'bomber':null;
  if(ownCounter&&!choices.includes(ownCounter))
   choices=[ownCounter,...choices];
  // Saving for tank/artillery/aircraft must not quietly turn into a cheap
  // substitute on the next AI pulse. The first affordable rover is deliberate.
  if(isPlanned)choices=[need!];
  const kind=choices.find(k=>UNITS[k].producers.includes(producer.kind)&&
   (c.scores[k]>0||workerLost||isPlanned)&&UNITS[k].cost<=budget&&
   (!airTarget||canAttack({kind:k},airTarget)||['engineer','medic','scout'].includes(k)));
  if(!kind){
   const target=choices.find(k=>UNITS[k].producers.includes(producer.kind)&&(c.scores[k]>0||workerLost||isPlanned)&&(!airTarget||canAttack({kind:k},airTarget)||['engineer','medic','scout'].includes(k)));
   const saving=target||isPlanned?need??(c.reserve>0?e.goal:null):null,goal=saving??target??null;
   const cost=goal?(Object.hasOwn(UNITS,goal)?UNITS[goal as UnitKind].cost:c.reserve):0;
   facilities[producer.id]={reason:saving?(need?'saving-unit':'saving-building'):target?'insufficient-credits':'composition-complete',goal,missing:Math.max(0,cost-g.credits[1]+(need?c.reserve:0))};
   continue;
  }
  if(g.recruit(producer.id,kind)){
   e.produced[kind]=(e.produced[kind]??0)+1;s.productionSerial++;
   purchased=true;facilities[producer.id]={reason:'produced',goal:kind,missing:0};
  }
 }
 const need=planned();
 if(need){if(s.savingFor!==need)s.savingSince=g.time;s.savingFor=need;}
 else{s.savingFor=null;s.savingSince=null;}
 const idle=Object.values(facilities).find(d=>d.reason!=='composition-complete'&&d.reason!=='produced');
 e.production={at:g.time,...(purchased?{reason:'produced' as const,goal:null,missing:0}:idle??{reason:producers.length?'composition-complete' as const:'no-producer' as const,goal:null,missing:0}),facilities};
}
