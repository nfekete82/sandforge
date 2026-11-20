#!/usr/bin/env node
/** Static terrain-only check of ACTUAL recorded 16-Bastion canyon fighter
 * coordinates. Tests complete-vs-partial waypoint behavior under the same
 * generation, radius and slope limits as the live movement engine.
 * Obstacles from live buildings, decor and enemies are intentionally NOT
 * reconstructed; this is a lower bound on terrain navigability, not proof
 * that real matches can cross or that the AI may see hidden information.
 */
import {World} from '../dist/src/reborn/world.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const world=new World(824836862,26,undefined,0,4);
const rally={x:2808.6783339601216,y:1126.2548224531934};
const samples=[
 {at:183,id:19,kind:'infantry',x:6898,y:7030},
 {at:183,id:23,kind:'rover',x:6961,y:6637},
 {at:183,id:21,kind:'artillery',x:6270,y:6822},
 {at:183,id:22,kind:'rocket',x:6472,y:6965},
 {at:287,id:24,kind:'infantry',x:6923,y:7347},
 {at:287,id:8,kind:'infantry',x:6831,y:6986},
 {at:287,id:32,kind:'infantry',x:6693,y:7033},
 {at:287,id:26,kind:'infantry',x:6880,y:6872},
 {at:287,id:28,kind:'infantry',x:6741,y:6885},
 {at:287,id:21,kind:'artillery',x:6508,y:6163},
 {at:287,id:22,kind:'rocket',x:5875,y:5087},
 {at:287,id:20,kind:'heavy',x:5864,y:5014},
 {at:390,id:36,kind:'infantry',x:6934,y:7334},
 {at:390,id:2,kind:'infantry',x:6845,y:6964},
 {at:390,id:43,kind:'heavy',x:6723,y:6986},
 {at:390,id:40,kind:'infantry',x:6869,y:6868},
 {at:390,id:42,kind:'heavy',x:6690,y:6986},
 {at:390,id:21,kind:'artillery',x:6421,y:6212},
 {at:390,id:22,kind:'rocket',x:5869,y:5121},
 {at:390,id:16,kind:'rocket',x:5847,y:5092}
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const routes=samples.map(x=>{
 const start={x:x.x,y:x.y},radius=UNITS[x.kind].radius;
 const clearance=Math.max(0,radius-10),vehicle=UNITS[x.kind].group==='Fahrzeuge';
 const slope=vehicle?(x.kind==='tank'?.215:x.kind==='artillery'?.185:.195):Infinity;
 const profiles=[
  {name:'strategic-complete',clearance:5,slope:Infinity,partial:false},
  {name:'strategic-partial',clearance:5,slope:Infinity,partial:true},
  {name:'physical-complete',clearance,slope,partial:false},
  {name:'physical-partial',clearance,slope,partial:true}
 ];
 const results=profiles.map(p=>{
  const path=world.path(start,rally,[],p.clearance,undefined,false,false,p.partial,p.slope);
  const end=path.at(-1)??start;
  return {name:p.name,segments:path.length,endDistance:Math.round(dist(end,rally)),
   progressed:Math.round(dist(start,rally)-dist(end,rally)),
   first: path[0]?{x:Math.round(path[0].x),y:Math.round(path[0].y)}:null};
 });
 return {at:x.at,id:x.id,kind:x.kind,x:x.x,y:x.y,radius,clearance,slope:Number.isFinite(slope)?slope:null,
  startDistance:Math.round(dist(start,rally)),results};
});
// Replan from each ACTUALLY reached legal partial-path endpoint, never from
// a fictitious off-mesh straight-line point. This isolates A* horizon
// exhaustion from a permanent physical ridge/vehicle-slope obstruction.
const chains=samples.filter(s=>s.at===287).map(u=>{
 const clearance=Math.max(0,UNITS[u.kind].radius-10);
 const vehicle=UNITS[u.kind].group==='Fahrzeuge';
 const slope=vehicle?(u.kind==='tank'?.215:u.kind==='artillery'?.185:.195):Infinity;
 const legs=[];let from={x:u.x,y:u.y};let done=false,stop='horizon';
 for(let hop=0;hop<6;hop++){
  const before=dist(from,rally);
  const path=world.path(from,rally,[],clearance,undefined,false,false,true,slope);
  const last=path.at(-1);
  if(!last){stop='no-path';break;}
  const after=dist(last,rally),moved=dist(from,last);
  legs.push({hop,points:path.length,x:Math.round(last.x),y:Math.round(last.y),
   remaining:Math.round(after),advance:Math.round(before-after),
   travelled:Math.round(moved)});
  if(after<90){done=true;stop='reached';break;}
  if(moved<8){stop='no-progress';break;}
  if(legs.slice(0,-1).some(l=>Math.hypot(l.x-last.x,l.y-last.y)<45)){
   stop='loop';break;
  }
  from=last;
 }
 return {at:u.at,id:u.id,kind:u.kind,done,stop,legs};
});
for(const c of chains)console.log('STATIC_CHAIN '+JSON.stringify(c));
const report={seed:824836862,map:26,generator:4,size:world.size,
 generatedRidges:world.generated?.ridges.length??0,
 warning:'Static public terrain, NOT full live collision/risk state; never feed to AI.',
 rally,rows:routes,chains};
mkdirSync('reports',{recursive:true});
writeFileSync('reports/ai41-ground-route-static.json',JSON.stringify(report,null,2)+'\n');
for(const r of routes)console.log('GROUND_STATIC '+JSON.stringify(r));
console.log('SUMMARY '+JSON.stringify({count:routes.length,size:report.size,ridges:report.generatedRidges,
 strategicUnreachable:routes.filter(r=>!r.results[0].segments).length,
 physicalUnreachable:routes.filter(r=>!r.results[2].segments).length,
 partialProgress:routes.filter(r=>r.results[3].progressed>0).length}));
