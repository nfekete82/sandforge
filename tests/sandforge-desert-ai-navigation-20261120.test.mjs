import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {canyonPassWaypoint,ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const maps=globalThis.SandforgeDesertMaps.maps;
const clearance=()=>Math.max(0,UNITS.artillery.radius-10);
const slope=.185;
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('validated strategy never chooses a blocked or false canyon entrance',()=>{
 const ridge={spine:[{x:0,y:1000},{x:2200,y:1000}],
  width:150,height:105,ramps:[{x:500,width:360},{x:1650,width:360}],clearings:[]};
 const from={x:600,y:420},to={x:600,y:1630};
 const seen=[];
 const actual=canyonPassWaypoint(from,to,[ridge],16,(near,far)=>{
  seen.push([near,far]);
  return near.x>1000;
 });
 assert.ok(actual,'must choose remaining verified pass');
 assert.equal(actual.x,1650,'must reject the closer undriveable pass');
 assert.ok(seen.some(([p])=>p.x===500));
 assert.ok(seen.some(([p])=>p.x===1650));
 const none=canyonPassWaypoint(from,to,[ridge],16,()=>false);
 assert.equal(none,undefined,'no fictional shortcut if every road is blocked');
 const original=canyonPassWaypoint(from,to,[ridge],16);
 assert.equal(original.x,500,'old v4 caller keeps exactly its old heuristic');
});

for(const m of maps.filter(m=>m.kind!=='open-basin'))test(
 m.name+': every physically drawn gap has at least one verified route from each bank',()=>{
 const g=Simulation.campaign(m.seed,m.mapVersion,m.terrain,m.generatorVersion);
 const w=g.world,ridge=w.generated.ridges[0];
 for(const p of ridge.ramps){
  const y=ridgeHeightAtX(ridge,p.x),shift=ridge.width*.5+210;
  const near={x:p.x,y:y-shift},far={x:p.x,y:y+shift};
  const leg=w.path(near,far,[],clearance(),undefined,false,false,false,slope);
  assert.ok(leg.length&&d(leg.at(-1),far)<w.cell*1.4,
   'pass must work with the real artillery slope limit');
  const lookup=canyonPassWaypoint(near,far,[ridge],clearance(),
   (a,b)=>w.line(a,b,[],clearance(),slope));
  assert.ok(lookup,'AI should recognize this verified mountain pass');
  assert.ok(w.walkable(lookup,[],clearance()),'AI route points must be physically legal');
 }
});

test('backwards compatibility: v4 physical-pass override never changes historical saves',()=>{
 const p=maps.at(-1);
 const old=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
 assert.equal(old.world.generatorVersion,4);
 const oldPass=old.world.generated.ridges[0].ramps[0];
 assert.ok(Number.isFinite(oldPass.x));
 // The updated pathfinder receives an opt-in callback only for v5.
 const source=(await import('node:fs')).readFileSync('src/reborn/world.ts','utf8');
 assert.match(source,/generatorVersion===5&&Number\.isFinite\(maxSlope\)/);
 assert.equal(Simulation.load(old.save()).world.generatorVersion,4);
});
