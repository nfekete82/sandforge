/** Finite, publicly charted neutral supply depots for modern Sandforge deserts.
 * Transport trucks must physically visit them and return to a surviving,
 * completed friendly HQ. Never give passive/virtual credits or reveal units
 * through fog. The same movement, loss, stock and payouts apply to both teams.
 */
import {clamp,distance,type Point} from './config.js';
import type {World,Territory} from './world.js';
import type {Simulation,Unit,Base} from './simulation.js';
import {countIncome} from './match-statistics.js';

export const SUPPLY_UNIT_COST=275;
export const SUPPLY_LOAD=45;
export const SUPPLY_STOCK=2250;
export const SUPPLY_PICKUP_SECONDS=2.4;
export const SUPPLY_UNLOAD_SECONDS=1.4;
export const SUPPLY_PICKUP_RADIUS=90;
/** A depleted depot regenerates slowly after an undisturbed 45-second pause.
 * 30 credits per 15 simulated seconds: infinite long-term supply routes, but
 * no free currency, and no fast recovery under continuous harvesting.
 */
export const SUPPLY_RESTOCK_DELAY=45;
export const SUPPLY_RESTOCK_INTERVAL=15;
export const SUPPLY_RESTOCK_AMOUNT=30;
export type SupplyPhase='seek'|'to-cache'|'loading'|'to-hq'|'unloading'|'idle';
export interface SupplyCache extends Point{
 id:number;remaining:number;capacity:number;
 lastPickupAt?:number;restockClock?:number;
}
export interface SupplyJob{
 auto:boolean;phase:SupplyPhase;cacheId:number|null;cargo:number;clock:number;
 /** Optional player-chosen depot. If depleted/unreachable, use another. */
 preferred?:number|null;
 /** Last requested valid movement goal; not a teleport. */
 destination?:Point;
}
export const newSupplyJob=():SupplyJob=>({auto:true,phase:'seek',cacheId:null,cargo:0,clock:0});
const positive=(n:number)=>Number.isFinite(n)&&n>=0;
export function validSupplyJob(job:SupplyJob|undefined,kind:string,size:number):boolean{
 if(job===undefined)return true;
 return kind==='supply'&&job&&typeof job.auto==='boolean'&&
  ['seek','to-cache','loading','to-hq','unloading','idle'].includes(job.phase)&&
  (job.cacheId===null||Number.isSafeInteger(job.cacheId)&&job.cacheId>=0&&job.cacheId<16)&&
  (job.preferred===undefined||job.preferred===null||
   Number.isSafeInteger(job.preferred)&&job.preferred>=0&&job.preferred<16)&&
  Number.isSafeInteger(job.cargo)&&job.cargo>=0&&job.cargo<=SUPPLY_LOAD&&
  positive(job.clock)&&job.clock<10_000&&
  (job.destination===undefined||Number.isFinite(job.destination.x)&&
   Number.isFinite(job.destination.y)&&job.destination.x>=0&&
   job.destination.y>=0&&job.destination.x<=size&&job.destination.y<=size);
}
/** Seeded and symmetric near each faction; the central pair is contested.
 * Resource sites are passable scenery, NOT buildings or victory conditions.
 * Generated independently from landscape RNG, so existing hills/roads do not
 * change their seeds or topology.
 */
export function generateSupplyCaches(
 world:World,territories:readonly Territory[],starts:readonly Point[],seed:number
):SupplyCache[]{
 if(world.mapVersion<23)return [];
 const caches:SupplyCache[]=[],size=world.size,center={x:size/2,y:size/2};
 const home=starts.length>=2?starts:[territories[0]?.point,territories.at(-1)?.point].filter(Boolean) as Point[];
 const seedAngle=((Math.imul(seed^0x423fa9,0x9e3779b1)>>>0)/4294967296)*Math.PI*.35;
 const used=(p:Point)=>p.x<210||p.y<210||p.x>size-210||p.y>size-210||
  territories.some(t=>distance(t.point,p)<430)||
  home.some(h=>distance(h,p)<300)||
  caches.some(s=>distance(s,p)<420)||
  !world.walkable(p,[],21)||
  (world.generated?.battlefield!==undefined&&world.terrainSlope(p.x,p.y)>.20);
 const locate=(origin:Point,angle:number,dist:number):Point|undefined=>{
  for(let turn=0;turn<24;turn++){
   const a=angle+(turn%2?-1:1)*Math.floor((turn+1)/2)*Math.PI/12;
   const radius=dist+(turn%3-1)*85;
   const p={x:clamp(origin.x+Math.cos(a)*radius,220,size-220),
    y:clamp(origin.y+Math.sin(a)*radius,220,size-220)};
   if(!used(p))return p;
  }
 };
 for(const start of home.slice(0,2)){
  const toward=Math.atan2(center.y-start.y,center.x-start.x);
  for(const [offset,radius] of [[-.8,650],[.75,930]]){
   const p=locate(start,toward+offset+seedAngle,radius);
   if(p)caches.push({id:caches.length,...p,remaining:SUPPLY_STOCK,capacity:SUPPLY_STOCK});
  }
 }
 // Central depots are an alternative objective to the Bastions, not
 // automatically owned by whoever captures a sector.
 const middle=Math.atan2(home[1]?.y-home[0]?.y||0,home[1]?.x-home[0]?.x||1);
 for(const sign of [-1,1]){
  const p=locate(center,middle+Math.PI/2*sign,525);
  if(p)caches.push({id:caches.length,...p,remaining:SUPPLY_STOCK,capacity:SUPPLY_STOCK});
 }
 // Additional large-map sites are neutral and follow the same protections.
 if(territories.length>4){
  for(let i=0;i<Math.min(4,Math.ceil(territories.length/4));i++){
   const p=locate(center,seedAngle+i*Math.PI*.5,980);
   if(p)caches.push({id:caches.length,...p,remaining:SUPPLY_STOCK,capacity:SUPPLY_STOCK});
  }
 }
 return caches.map(c=>({...c,lastPickupAt:0,restockClock:0}));
}
export const supplyDeliveryPoint=(g:Simulation,u:Unit,hq:Base):Point=>{
 const angle=Math.atan2(u.y-hq.y,u.x-hq.x);
 const blocks=[...g.obstacles(),...g.bastionColliders()];
 for(const d of [165,200,240,285]){
  for(const turn of [0,.55,-.55,1.1,-1.1,2,-2]){
   const a=angle+turn,p={x:clamp(hq.x+Math.cos(a)*d,35,g.world.size-35),
    y:clamp(hq.y+Math.sin(a)*d,35,g.world.size-35)};
   if(g.world.walkable(p,blocks,14))return p;
  }
 }
 return {x:u.x,y:u.y};
};
function resetMovement(u:Unit,p:Point):void{
 u.orders=[{...p,kind:'move'}];u.path=[];u.repath=0;
 u.hold=false;u.guardArea=false;u.combatTarget=null;u.pursuitOrigin=null;
}
function hasTravel(u:Unit,p:Point):boolean{
 return u.orders[0]?.kind==='move'&&distance(u.orders[0],p)<3;
}
/** A public-resource selection made using only a living unit's own position,
 * passable world geometry, known stock and currently visible threats.
 * Resource-node coordinates are available to both factions, just like
 * strategically marked neutral Bastions.
 */
export function selectSupplyCache(g:Simulation,u:Unit):SupplyCache|undefined{
 const blocked=[...g.obstacles(),...g.bastionColliders()];
 const enemy=g.units.filter(other=>other.owner!==u.owner&&other.hp>0&&!other.carrier&&
  g.canSee(u.owner,other));
 const peers=g.units.filter(other=>other.id!==u.id&&other.owner===u.owner&&
  other.kind==='supply'&&other.hp>0&&other.supply?.cacheId!==null&&other.supply?.cargo===0);
 const candidates=g.supplyCaches.filter(s=>s.remaining>0&&
  !enemy.some(v=>distance(v,s)<390));
 for(const cache of candidates.sort((a,b)=>
   distance(u,a)+peers.filter(v=>v.supply?.cacheId===a.id).length*350-
   distance(u,b)-peers.filter(v=>v.supply?.cacheId===b.id).length*350||a.id-b.id)){
  if(distance(u,cache)<SUPPLY_PICKUP_RADIUS||
     g.world.path(u,cache,blocked,14).length)return cache;
 }
}
/** Called inside authoritative 20-Hz Simulation.stepMeasured. Actual drive
 * motion remains Simulation.move with normal collisions; this controller only
 * changes legal move orders and handles physical load/unload timers.
 */
export function stepSupplyLogistics(g:Simulation,dt:number):void{
 if(!g.supplyCaches.length)return;
 // Supply regenerates only while harvesters are away. Resource state is
 // authoritative, deterministic at 20 Hz, and persisted with the save.
 for(const cache of g.supplyCaches){
  if(cache.remaining>=cache.capacity){
   cache.restockClock=0;continue;
  }
  const since=g.time-(cache.lastPickupAt??0);
  if(since<SUPPLY_RESTOCK_DELAY){cache.restockClock=0;continue;}
  cache.restockClock=(cache.restockClock??0)+dt;
  if(cache.restockClock+1e-8>=SUPPLY_RESTOCK_INTERVAL){
   const ticks=Math.floor((cache.restockClock+1e-8)/SUPPLY_RESTOCK_INTERVAL);
   cache.restockClock=Math.max(0,cache.restockClock-ticks*SUPPLY_RESTOCK_INTERVAL);
   cache.remaining=Math.min(cache.capacity,cache.remaining+ticks*SUPPLY_RESTOCK_AMOUNT);
  }
 }
 const units=g.units.filter(u=>u.kind==='supply'&&u.hp>0&&!u.carrier);
 for(const u of units){
  const job=u.supply??(u.supply=newSupplyJob());
  if(!job.auto)continue;
  if(job.phase==='idle'){job.phase=job.cargo>0?'to-hq':'seek';job.clock=0;}
  if(job.phase==='seek'){
   const preferred=job.preferred===null||job.preferred===undefined?undefined:
    g.supplyCaches.find(c=>c.id===job.preferred&&c.remaining>0);
   const enemyNearby=preferred&&g.units.some(v=>v.owner!==u.owner&&v.hp>0&&
    !v.carrier&&g.canSee(u.owner,v)&&distance(v,preferred)<390);
   const legalPreferred=preferred&&!enemyNearby&&
    (distance(u,preferred)<SUPPLY_PICKUP_RADIUS||
     g.world.path(u,preferred,[...g.obstacles(),...g.bastionColliders()],14).length>0)
     ?preferred:undefined;
   const cache=legalPreferred??selectSupplyCache(g,u);
   if(!cache){job.clock=Math.min(9999,job.clock+dt);continue;}
   job.cacheId=cache.id;job.destination={x:cache.x,y:cache.y};
   job.clock=0;job.phase='to-cache';
   resetMovement(u,job.destination);
   continue;
  }
  const cache=job.cacheId===null?undefined:g.supplyCaches[job.cacheId];
  if(job.phase==='to-cache'){
   if(!cache||cache.remaining<=0){job.phase='seek';job.cacheId=null;u.orders=[];continue;}
   if(distance(u,cache)<=SUPPLY_PICKUP_RADIUS){u.orders=[];u.path=[];job.phase='loading';job.clock=0;}
   else if(!hasTravel(u,cache))resetMovement(u,cache);
   continue;
  }
  if(job.phase==='loading'){
   if(!cache||cache.remaining<=0){job.phase='seek';job.cacheId=null;job.clock=0;continue;}
   if(distance(u,cache)>SUPPLY_PICKUP_RADIUS+15){job.phase='to-cache';continue;}
   job.clock+=dt;
   if(job.clock+1e-8>=SUPPLY_PICKUP_SECONDS){
    const taken=Math.min(SUPPLY_LOAD,cache.remaining);
    cache.remaining-=taken;job.cargo=taken;
    cache.lastPickupAt=g.time;cache.restockClock=0;
    job.phase='to-hq';job.clock=0;u.orders=[];
   }
   continue;
  }
  const hq=g.bases.filter(b=>b.owner===u.owner&&b.kind==='headquarters'&&
   b.hp>0&&b.buildRemaining<=0).sort((a,b)=>distance(a,u)-distance(b,u))[0];
  if(!hq){job.phase='idle';job.clock=0;u.orders=[];continue;}
  if(job.phase==='to-hq'){
   // Delivery is a REAL physical radius around the friendly, finished HQ.
   // Old code also required the precise approach waypoint (<85). The
   // visually larger HQ vehicle facade can block that waypoint, leaving a
   // fully loaded hauler stationary next to its HQ forever.
   if(distance(u,hq)<=225){
    job.phase='unloading';job.clock=0;u.orders=[];u.path=[];
    continue;
   }
   // Still outside: move normally. Never teleport, award credits early or
   // ignore vehicle obstacles. Completed unloading remains timer-driven.
   if(!job.destination||!hasTravel(u,job.destination)){
    job.destination=supplyDeliveryPoint(g,u,hq);
    resetMovement(u,job.destination);
   }
   continue;
  }
  if(job.phase==='unloading'){
   if(distance(u,hq)>240){job.phase='to-hq';job.destination=undefined;continue;}
   job.clock+=dt;
   if(job.clock+1e-8>=SUPPLY_UNLOAD_SECONDS&&job.cargo>0){
    // Credits are minted ONLY here, after actual movement + loading,
    // and never on arbitrary elapsed-time income ticks.
    g.credits[u.owner]+=job.cargo;
    countIncome(g.stats,u.owner,job.cargo);
    if(u.owner===0)g.notices.push('Nachschub geliefert: +'+job.cargo+' Credits');
    job.cargo=0;job.phase='seek';job.cacheId=null;job.clock=0;
    job.destination=undefined;u.orders=[];
   }
  }
 }
}
