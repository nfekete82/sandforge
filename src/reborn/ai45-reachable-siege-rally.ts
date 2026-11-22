import {distance,type Point} from './config.js';

/** KI4.5: a siege rally is legal only when a real group can drive/walk
 * there AND from there to an observed artillery approach. Keep these
 * route/safety callbacks supplied by TacticalAI; never inspect hidden RED
 * opponents, spawn units, alter credits or invent a path through cliffs.
 */
export interface SiegeRallyUnit extends Point{id:number}
export function ai45ChooseReachableSiegeRally<T extends SiegeRallyUnit>(x:{
 candidates:readonly Point[];fighters:readonly T[];objective:Point;
 safe:(p:Point)=>boolean;
 reachable:(from:Point,to:Point)=>boolean;
 siegeApproachReachable:(p:Point)=>boolean;
}):Point|undefined{
 if(x.fighters.length<5)return;
 const minimum=Math.min(4,Math.max(3,Math.ceil(x.fighters.length*.30)));
 // Reachability alone did not help: the 30-match A/B had three rescues
 // without a single HQ hit. Prefer a rally where a paid wave has ALREADY
 // physically assembled. TacticalAI still checks complete physical routes,
 // safety and the actual artillery approach before choosing it.
 const assembled=(p:Point)=>x.fighters.filter(u=>distance(u,p)<330).length;
 const ordered=x.candidates.slice().sort((a,b)=>{
  const aa=assembled(a),bb=assembled(b);
  const aReady=aa>=minimum,bReady=bb>=minimum;
  return Number(bReady)-Number(aReady)||
   (aReady?bb-aa:0)||
   distance(a,x.objective)-distance(b,x.objective)||a.x-b.x||a.y-b.y;
 });
 const unique=new Set<string>();
 for(const p of ordered){
  const key=Math.round(p.x/45)+':'+Math.round(p.y/45);
  if(unique.has(key))continue;unique.add(key);
  if(!x.safe(p))continue;
  let present=0;
  for(const u of x.fighters){
   if(distance(u,p)<140||x.reachable(u,p))present++;
   if(present>=minimum)break;
  }
  if(present<minimum||!x.siegeApproachReachable(p))continue;
  return {x:p.x,y:p.y};
 }
}
export function ai45CanRelocateStuckSiege(x:{
 mapVersion:number;generatorVersion:number;seed:number;
 missionKind:string;objectiveObserved:boolean;homePressure:boolean;
 fighters:number;phase:string;gatherSeconds:number;lastAttemptAgo:number;
 readyAtRally:number;canReachRally:number;
}):boolean{
 const liveTerrain=x.generatorVersion===10&&x.mapVersion>=24||
  x.generatorVersion===7&&x.mapVersion===26&&x.seed===271121;
 const needed=Math.min(4,Math.max(3,Math.ceil(x.fighters*.30)));
 return liveTerrain&&x.missionKind==='structure'&&x.objectiveObserved&&
  !x.homePressure&&x.fighters>=8&&x.phase==='gather'&&
  x.gatherSeconds>=95&&x.lastAttemptAgo>=45&&
  x.readyAtRally<needed&&(x.canReachRally<needed||x.gatherSeconds>=145||
   // A mathematically reachable rally can still fail to assemble any unit.
   // Only after 95s of actual gather, with ZERO fighters physically present,
   // permit a candidate search. The replacement still needs full validated
   // routes and safe artillery approach; this never teleports a unit.
   x.readyAtRally===0);
}
