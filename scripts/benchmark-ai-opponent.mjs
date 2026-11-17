/**
 * Budget-constrained scripted BLUE defense for fair RED AI benchmarks.
 * Uses only ordinary Simulation build/recruit/command APIs.
 * Creates no free units, buildings, resources or map knowledge.
 */
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

function freeBuildingSite(g,owner,kind,home){
 for(const radius of [190,240,290,345])for(let i=0;i<16;i++){
  const angle=i*Math.PI/8;
  const p={x:home.x+Math.cos(angle)*radius,y:home.y+Math.sin(angle)*radius};
  if(!g.buildError(owner,kind,p))return p;
 }
 return null;
}
export function blueDefense(g){
 if(g.status!=='playing')return;
 const owner=0,own=g.bases.filter(b=>b.owner===owner&&b.hp>0),
  home=own.find(b=>b.kind==='headquarters'),worker=g.units.find(u=>u.owner===owner&&u.kind==='engineer'&&u.hp>0);
 if(!home)return;
 const has=k=>own.some(b=>b.kind===k);
 const unfinished=own.some(b=>b.buildRemaining>0);
 if(worker&&!unfinished&&!worker.orders.some(o=>o.kind==='build')){
  const kind=!has('barracks')?'barracks':
   g.time>=40&&!has('turret')?'turret':null;
  if(kind&&g.credits[owner]>=BUILDINGS[kind].cost){
   const site=freeBuildingSite(g,owner,kind,home);
   if(site)g.build(owner,kind,site,[worker.id]);
  }
 }
 const barracks=own.find(b=>b.kind==='barracks'&&b.buildRemaining<=0&&b.queue.length<2);
 // Defend the actual owned bastion instead of hiding around the HQ,
 // which is deliberately offset from the capture point. No enemy positions
 // or hidden information are consulted for this simple defensive doctrine.
 const hold=g.territories.find(t=>t.id===home.territory&&t.owner===owner)?.point;
 if(hold)for(const u of g.units.filter(u=>u.owner===owner&&u.hp>0&&!u.carrier&&
  (u.kind==='infantry'||u.kind==='heavy'))){
  if(!u.orders.length&&Math.hypot(u.x-hold.x,u.y-hold.y)>95)
   g.command([u.id],{x:hold.x,y:hold.y,kind:'attackMove'});
 }
 if(!barracks)return;
 const roster=g.units.filter(u=>u.owner===owner&&u.hp>0),
  count=k=>roster.filter(u=>u.kind===k).length+own.reduce((n,b)=>n+b.queueTypes.filter(v=>v===k).length,0);
 // Stand and defend: no scripted omniscient target selection.
 const kind=count('infantry')<5?'infantry':count('heavy')<1?'heavy':null;
 if(kind&&g.credits[owner]>=UNITS[kind].cost)g.recruit(barracks.id,kind);
}

/** A budgeted, territorial opponent for Bastion-first benchmarks.
 * Blue has no fog exemption, free income or free troops. It builds/trains
 * through the same legal public APIs as the unchanged defensive opponent,
 * then sends three PAID fighters to challenge neutral and red Bastions.
 * This is a test opponent only, NOT a gameplay handicap for either team.
 */
export function blueContest(g){
 blueDefense(g);
 if(g.status!=='playing'||g.time<95)return;
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters'&&b.hp>0);
 if(!hq)return;
 const roster=g.units.filter(u=>u.owner===0&&u.hp>0&&!u.carrier&&
  ['infantry','heavy'].includes(u.kind)).sort((a,b)=>a.id-b.id);
 if(roster.length<5)return; // always leave at least two real troops on HQ defense
 const raiders=roster.slice(2,5);
 const targets=g.territories.filter(t=>t.owner!==0&&t.id!==hq.territory&&
  t.neighbors.some(id=>g.territories[id]?.owner===0))
  .filter(t=>!g.bases.some(b=>b.owner===1&&b.hp>0&&b.kind==='headquarters'&&
   b.territory===t.id&&g.canSee(0,b)))
  .sort((a,b)=>(a.owner===-1?0:1)-(b.owner===-1?0:1)||
   Math.hypot(a.point.x-hq.x,a.point.y-hq.y)-
   Math.hypot(b.point.x-hq.x,b.point.y-hq.y)||a.id-b.id);
 const safe=targets.filter(t=>!g.bases.some(b=>b.owner===1&&b.hp>0&&
   b.kind==='turret'&&g.canSee(0,b)&&Math.hypot(b.x-t.point.x,b.y-t.point.y)<635));
 const goal=(safe.length?safe:targets)[0];
 if(!goal)return;
 for(const u of raiders){
  const o=u.orders[0];
  if(o?.kind==='attackMove'&&Math.hypot(o.x-goal.point.x,o.y-goal.point.y)<100)continue;
  g.command([u.id],{kind:'attackMove',x:goal.point.x,y:goal.point.y});
 }
}
