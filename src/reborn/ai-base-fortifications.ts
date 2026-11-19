import {BUILDINGS,type BuildingKind} from './catalog.js';
import {distance,type Point} from './config.js';
import type {SiteFacing} from './construction-spacing.js';
import type {Simulation,Base,Unit} from './simulation.js';

/** Deterministic, paid, midgame fortification of the ACTUAL red headquarters.
 * A front-line steel gate is built before any of the four adjoining walls:
 * tanks always retain an unobstructed owned exit. The other sides of the
 * compound stay open; it cannot become a sealed box, even on steep maps.
 * Directions use PUBLIC neutral/owned territory information, never invisible
 * human units, unexplored bases or hidden combat orders.
 */
export const HOME_TOWER_LIMIT=3;
export const HOME_WALL_LIMIT=4;
export const HOME_DEFENSE_RADIUS=760;
export const HOME_DEFENSE_PULSE_SECONDS=18;
export const HOME_FORTIFICATION_MIN_TIME=540;
export const HOME_FORTIFICATION_MIN_FIGHTERS=16;
export const HOME_FORTIFICATION_SURPLUS=2500;

type DefensiveBuild='turret'|'wallGate'|'wall';
export interface HomeDefensePlan {
 kind:DefensiveBuild;
 point:Point;
 facing:SiteFacing;
 slot:string;
}

const owned=(g:Simulation)=>
 g.bases.filter(b=>b.owner===1&&b.hp>0);
const at=(p:Point,a:Point,f:number,s:number):Point=>({
 x:p.x+a.x*f-a.y*s,
 y:p.y+a.y*f+a.x*s
});
const opposite=<T extends Point>(p:T,q:Point)=>distance(p,q);
const finishedHome=(g:Simulation):Base|undefined=>
 owned(g).find(b=>b.kind==='headquarters'&&b.buildRemaining<=0);

/** Pick the nearest still-unowned objective as an approximate approach axis.
 * A territory's public ownership is permitted strategic input. Do not read
 * unknown enemy units or their HQ for a more advantageous orientation. */
export function homeDefenseAxis(g:Simulation,home:Point):Point{
 const front=g.territories.filter(t=>t.owner!==1)
  .sort((a,b)=>distance(a.point,home)-distance(b.point,home)||a.id-b.id)[0];
 const dx=front?front.point.x-home.x:g.world.size*.5-home.x;
 const dy=front?front.point.y-home.y:g.world.size*.5-home.y;
 if(Math.abs(dx)>=Math.abs(dy))return {x:dx<0?-1:1,y:0};
 return {x:0,y:dy<0?-1:1};
}

export function homeDefenseTowerCount(g:Simulation,home:Point):number{
 return owned(g).filter(b=>b.kind==='turret'&&distance(b,home)<HOME_DEFENSE_RADIUS).length;
}

/** Anchoring to the PAID real gate, rather than inferred future sites, makes
 * all subsequent walls join a consistent 2x-wide opening after saves/reloads. */
export function homeDefenseGate(g:Simulation,home:Point):Base|undefined{
 return owned(g).filter(b=>b.kind==='wallGate'&&b.gateSpan===2&&
  distance(b,home)<HOME_DEFENSE_RADIUS)
  .sort((a,b)=>distance(a,home)-distance(b,home)||a.id-b.id)[0];
}

function gateSite(g:Simulation,home:Point,axis:Point):HomeDefensePlan|null{
 const facing:SiteFacing=axis.x!==0?2:0;
 const side={x:-axis.y,y:axis.x};
 // Three alternate distances and narrow side corrections avoid rocks,
 // pre-existing factories and uneven high-relief terrain.
 for(const radius of [440,520,600,370])for(const shift of [0,-78,78,-156,156]){
  const p={x:home.x+axis.x*radius+side.x*shift,
   y:home.y+axis.y*radius+side.y*shift};
  if(!g.buildError(1,'wallGate',p,facing))
   return {kind:'wallGate',point:p,facing,slot:'front-gate'};
 }
 return null;
}

function wallSites(g:Simulation,gate:Base):HomeDefensePlan[]{
 const facing:SiteFacing=gate.facing??0;
 const tangent=facing===2||facing===3?{x:0,y:1}:{x:1,y:0};
 const neighbors=owned(g).filter(b=>b.kind==='wall');
 const result:HomeDefensePlan[]=[];
 // Exact edge-to-edge geometry: centre spacing is 109 + half a 109 wall.
 // Begin by bracing both sides; only then extend the perimeter outward.
 for(const [side,index] of [[-1,0],[1,0],[-1,1],[1,1]] as const){
  const offset=side*(163.5+index*109);
  const p={x:gate.x+tangent.x*offset,y:gate.y+tangent.y*offset};
  if(neighbors.some(b=>(b.facing??0)===facing&&distance(b,p)<3))continue;
  if(!g.buildError(1,'wall',p,facing))
   result.push({kind:'wall',point:p,facing,slot:'front-wall-'+side+'-'+index});
 }
 return result;
}

function towerSites(g:Simulation,home:Point,axis:Point):HomeDefensePlan[]{
 const side={x:-axis.y,y:axis.x};
 const positions=[
  // Heavy turrets stand INSIDE/behind the wall line, with overlapping
  // firing lanes that cover both the gateway and flanking approaches.
  {f:215,s:-260},{f:215,s:260},
  // A third rear/flank tower remains useful when raiders circle the wall.
  {f:-180,s:150},{f:-180,s:-150},
  {f:280,s:-310},{f:280,s:310}
 ];
 const current=owned(g).filter(b=>b.kind==='turret');
 const results:HomeDefensePlan[]=[];
 for(const [i,slot] of positions.entries()){
  const p=at(home,axis,slot.f,slot.s);
  if(current.some(b=>distance(b,p)<175))continue;
  if(!g.buildError(1,'turret',p))
   results.push({kind:'turret',point:p,facing:0,slot:'hq-turret-'+i});
 }
 return results;
}

/** Return the NEXT affordable real construction. No teleporting builders,
 * imaginary blueprints, free turrets, walls across rocks or invisible closure.
 * First HQ gun, then a gate, then second gun + wall wings, third gun last.
 */
export function planHomeFortification(g:Simulation,options:{
 underAttack:boolean;fighters:number;reserve:number;
}):HomeDefensePlan|null{
 const home=finishedHome(g);if(!home||g.status!=='playing')return null;
 const own=owned(g);
 if(!own.some(b=>b.kind==='barracks'&&b.buildRemaining<=0))return null;
 // A player-approved OFFENSIVE-first economy: perimeter walls and gate
 // are luxury purchases, not replacements for a functioning assault force.
 // Never spend early income on half-built compound defenses. Existing towers
 // guarding already captured frontier bastions remain independent.
 if(g.time<HOME_FORTIFICATION_MIN_TIME||
   options.fighters<HOME_FORTIFICATION_MIN_FIGHTERS||
   g.credits[1]<HOME_FORTIFICATION_SURPLUS||
   g.territories.filter(t=>t.owner===1).length<2)return null;
 const axis=homeDefenseAxis(g,home),towers=homeDefenseTowerCount(g,home);
 const gate=homeDefenseGate(g,home);
 const affordable=(kind:DefensiveBuild)=>{
  const reserve=Math.max(HOME_FORTIFICATION_SURPLUS,options.reserve);
  return g.credits[1]>=BUILDINGS[kind].cost+reserve;
 };
 const allTowers=own.filter(b=>b.kind==='turret').length;
 const turret=()=>allTowers<9&&towers<HOME_TOWER_LIMIT&&affordable('turret')
  ?towerSites(g,home,axis)[0]??null:null;
 if(towers===0){const first=turret();if(first)return first;}
 // Never build wall wings BEFORE the real drivable double-width exit.
 if(!gate){
  if(affordable('wallGate')){
   const first=gateSite(g,home,axis);
   if(first)return first;
  }
  return towers<2?turret():null;
 }
 if(towers<2){const second=turret();if(second)return second;}
 const walls=own.filter(b=>b.kind==='wall'&&distance(b,gate)<430);
 if(walls.length<HOME_WALL_LIMIT&&affordable('wall')){
  const next=wallSites(g,gate)[0];
  if(next)return next;
 }
 if(towers<HOME_TOWER_LIMIT)return turret();
 return null;
}

/** Construction is one paid site per slow macro pulse, using a genuinely
 * idle engineer and the same placement/order API used by the player. */
export function buildHomeFortification(g:Simulation,workers:readonly Unit[],
 options:{underAttack:boolean;fighters:number;reserve:number},
 dangerAt:(p:Point)=>number):HomeDefensePlan|null{
 const idle=workers.filter(u=>u.owner===1&&u.kind==='engineer'&&u.hp>0&&
  !u.carrier&&u.defendUntil<=g.time&&!u.orders.length);
 if(!idle.length||owned(g).some(b=>b.buildRemaining>0))return null;
 const next=planHomeFortification(g,options);
 if(!next||dangerAt(next.point)>=3)return null;
 for(const builder of idle.slice().sort((a,b)=>
  distance(a,next.point)-distance(b,next.point)||a.id-b.id)){
  if(g.build(1,next.kind,next.point,[builder.id],next.facing))
   return next;
 }
 return null;
}
