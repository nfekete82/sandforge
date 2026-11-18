import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {infantryDoorExitCandidates} from '../dist/src/reborn/production-exit.js';

function produce(kind,unitKind,facing,rally){
 const g=new Simulation(2026,4);
 g.world.blocked.fill(0);g.world.components.fill(0);g.aiClock=1e8;
 g.credits=[5000,5000];g.stageWebGLProduction=true;
 const b={...g.bases[0],id:1750,x:1700,y:1700,kind,radius:BUILDINGS[kind].radius,
  hp:BUILDINGS[kind].hp,facing,buildRemaining:0,
  queue:[UNITS[unitKind].buildTime],queueTypes:[unitKind],
  queueCosts:[UNITS[unitKind].cost],production:UNITS[unitKind].buildTime-.05,rally};
 g.bases.push(b);g.step(.05);
 const release=g.productionReleases.at(-1),u=g.units.find(x=>x.id===release?.unitId);
 assert.ok(u,'expected trained '+unitKind);
 assert.equal(release.baseId,b.id);
 return {g,b,u,release};
}
test('infantry front-door candidates follow each rotated building, not world-right',()=>{
 for(const facing of [0,1,2,3]){
  const b={x:1700,y:1700,radius:53,facing};
  const p=infantryDoorExitCandidates(b)[0];
  const a=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
  const direction={x:Math.sin(a),y:Math.cos(a)};
  assert.ok(Math.abs((p.x-b.x)*direction.y-(p.y-b.y)*direction.x)<1e-7);
  assert.ok((p.x-b.x)*direction.x+(p.y-b.y)*direction.y>=b.radius+75-.0001);
 }
});
for(const [building,role] of [['barracks','infantry'],['headquarters','engineer']]){
 for(const facing of [0,1,2,3])test(building+' '+role+' exits forward with rally, facing '+facing,()=>{
  const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
  const dir={x:Math.sin(angle),y:Math.cos(angle)};
  const rally={x:1700+dir.x*520,y:1700+dir.y*520};
  const {g,b,u,release}=produce(building,role,facing,rally);
  const fwd=(u.x-b.x)*dir.x+(u.y-b.y)*dir.y;
  const side=(u.x-b.x)*dir.y-(u.y-b.y)*dir.x;
  assert.ok(fwd>=b.radius+70,'staged rally unit must spawn IN FRONT of the actual portal, not beside HQ');
  assert.ok(Math.abs(side)<48,'staged unit must not run to right-hand waiting zone');
  assert.equal(u.orders[0]?.kind,'attackMove','the rally order is already authoritative');
  assert.ok(g.isProductionDepartureHeld(u.id));
  assert.deepEqual(release.to,{x:u.x,y:u.y},'no render-only teleport');
  const start={x:u.x,y:u.y};
  for(let i=0;i<230;i++)g.step(.05);
  assert.ok(Math.hypot(u.x-start.x,u.y-start.y)>4,
   'unit should go directly toward assigned rally after the door releases it');
 });
 for(const facing of [0,1,2,3])test(building+' '+role+' without rally idles directly in front, facing '+facing,()=>{
  const {b,u}=produce(building,role,facing,null);
  const angle=[0,Math.PI,Math.PI/2,Math.PI*1.5][facing];
  const dir={x:Math.sin(angle),y:Math.cos(angle)};
  const forward=(u.x-b.x)*dir.x+(u.y-b.y)*dir.y;
  const sideways=(u.x-b.x)*dir.y-(u.y-b.y)*dir.x;
  assert.ok(forward>=b.radius+70&&forward<b.radius+131,
   'no rally: idle a few metres beyond the front, not the old right side');
  assert.ok(Math.abs(sideways)<48,'unit must not run around the structure');
  assert.equal(u.orders.length,0,'no phantom rally order');
  const delta=u.angle-(Math.PI/2-angle);
  assert.ok(Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)))<1e-8,
   'idle facing matches the actual front door without rotation snap');
 });
}
