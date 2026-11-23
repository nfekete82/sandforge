/**
 * Map-independent tactical geography, based on PUBLIC Bastion ownership and
 * physical routes submitted by the ordinary movement/navigation planner.
 *
 * Deliberately no map IDs, fixed seeds, live enemy-unit locations, weather
 * shortcuts, Fog-of-War access or stored save-state. The same graph and
 * detour analysis works on 4, 8, 12, 16 or newly seeded maps.
 */
import {distance,type Point} from './config.js';

export interface PublicSector {
 id:number;owner:-1|0|1;point:Point;neighbors:readonly number[];income:number;
}
export interface PublicTopology {
 id:number;blueLinks:number;redLinks:number;neutralLinks:number;
 gateway:boolean;fewExits:boolean;
}
export interface VerifiedFront {
 sector:PublicSector;route:{length:number;risk:number};
 topology:PublicTopology;detour:number;score:number;
}

/** No units, no enemy structures: all inputs are visible/public geometry. */
export function analyzePublicTopology(sectors:readonly PublicSector[]):PublicTopology[]{
 const index=new Map(sectors.map(t=>[t.id,t] as const));
 return sectors.map(t=>{
  let blueLinks=0,redLinks=0,neutralLinks=0,links=0;
  for(const id of t.neighbors){
   const adjacent=index.get(id);
   if(!adjacent)continue;
   links++;
   if(adjacent.owner===0)blueLinks++;
   else if(adjacent.owner===1)redLinks++;
   else neutralLinks++;
  }
  return {id:t.id,blueLinks,redLinks,neutralLinks,
   gateway:blueLinks>0&&redLinks>0,
   fewExits:links<=2};
 });
}

/** Evaluate only public fronts and verified, traversable approaches.
 * Unseen enemy data can affect the result ONLY through the caller's
 * explicitly supplied OBSERVED-threat predicate.
 */
export function rankPublicFronts(options:{
 sectors:readonly PublicSector[];origin:Point;worldSize:number;
 blueOwned:number;route:(target:Point)=>{length:number;risk:number}|undefined;
 knownThreat:(sector:PublicSector)=>boolean;maxPaths?:number;
}):VerifiedFront[]{
 const {sectors,origin,worldSize,blueOwned,route,knownThreat}=options;
 if(!Number.isFinite(worldSize)||worldSize<=0)return [];
 const topologies=analyzePublicTopology(sectors);
 const topologyById=new Map(topologies.map(t=>[t.id,t] as const));
 // A publicly known first BLUE Bastion may draw RED to a NEUTRAL
 // neighbor, but never authorize an unsupported initial HQ rush.
 const candidates=sectors.filter(t=>{
  if(t.owner===1||knownThreat(t))return false;
  const graph=topologyById.get(t.id);
  if(!graph)return false;
  return t.owner===-1?graph.blueLinks>0:
   blueOwned>=2&&graph.redLinks>0;
 }).sort((a,b)=>distance(origin,a.point)-distance(origin,b.point)||a.id-b.id);
 const limit=Math.min(candidates.length,Math.max(1,Math.floor(options.maxPaths??12)));
 const verified:VerifiedFront[]=[];
 for(const sector of candidates.slice(0,limit)){
  const path=route(sector.point);
  if(!path||!Number.isFinite(path.length)||!Number.isFinite(path.risk)||
     path.length<=0||path.risk<0||path.risk>=8)continue;
  const direct=Math.max(80,distance(origin,sector.point));
  const detour=path.length/direct;
  // A path much longer than its direct distance is a canyon/ramp detour,
  // not a sound early harassment lane. Budget scales with actual world size,
  // rather than a hard-coded map dimension.
  if(path.length>Math.max(1500,worldSize*.72)||
     detour>3.5)continue;
  const graph=topologyById.get(sector.id)!;
  const score=path.length+path.risk*155+
   Math.max(0,detour-1)*260-sector.income*7-
   graph.blueLinks*95-graph.redLinks*65-
   (graph.gateway?110:0)-
   (sector.owner===0?120:0);
  verified.push({sector,route:path,topology:graph,detour,score});
 }
 return verified.sort((a,b)=>a.score-b.score||a.sector.id-b.sector.id);
}
