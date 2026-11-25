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
 const from={x:900,y:420},to={x:900,y:1630};
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

for(const m of maps.filter(m=>m.id==='broken-empire'||m.id==='last-stronghold'))test(
 m.name+' (v5): every physically drawn gap has at least one verified route from each bank',()=>{
 const g=Simulation.campaign(m.seed,m.mapVersion,m.terrain,5);
 const w=g.world,ridge=w.generated.ridges[0];
 assert.ok(ridge.ramps.length,'the historical fixture must expose a real pass');
 for(const p of ridge.ramps){
  const y=ridgeHeightAtX(ridge,p.x),shift=ridge.width*.5+210;
  const near={x:p.x,y:y-shift},far={x:p.x,y:y+shift};
  const leg=w.path(near,far,[],clearance(),undefined,false,false,false,slope);
  assert.ok(leg.length&&d(leg.at(-1),far)<w.cell*1.4,
   'pass must work with the real artillery slope limit');
  const lookup=canyonPassWaypoint(near,far,[ridge],clearance(),
   (a,b)=>w.line(a,b,[],clearance(),slope)||
     w.path(a,b,[],clearance(),undefined,false,false,false,slope)
      .some(q=>d(q,b)<w.cell*1.4));
  // A physical pass can be inside a protected Bastion clearing. The
  // selector intentionally returns undefined in that case because the
  // ordinary A* route already crosses legally without a detour hint.
  if(lookup)assert.ok(w.walkable(lookup,[],clearance()),
   'any AI detour waypoint must be physically legal');
  else assert.ok(leg.length&&d(leg.at(-1),far)<w.cell*1.4,
   'a skipped pass hint requires an independently proven real crossing');
 }
});

test('Burning Horizon saves retain their original v4 routes after the v10 map update',()=>{
 const p=maps.find(m=>m.id==='burning-horizon');
 assert.equal(p.generatorVersion,10);
 const game=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
 assert.equal(game.world.generatorVersion,4);
 assert.equal(game.world.generated.landscapeKind,'diagonal-ridge');
 assert.equal(game.tactical.ai37Mode,'coordinated');
 const restored=Simulation.load(JSON.parse(JSON.stringify(game.save())));
 assert.equal(restored.world.generatorVersion,4);
 assert.deepEqual(restored.world.generated.ridges,game.world.generated.ridges);
 assert.deepEqual(restored.world.blocked,game.world.blocked);
});

test('backwards compatibility: v4 physical-pass override never changes historical saves',()=>{
 const p=maps.find(m=>m.id==='last-stronghold');
 const old=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
 const restored=Simulation.load(old.save());
 assert.equal(restored.world.generatorVersion,4);
 const ridge=old.world.generated.ridges[0],pass=ridge.ramps[0];
 const y=ridgeHeightAtX(ridge,pass.x),shift=ridge.width*.5+210;
 const near={x:pass.x,y:y-shift},far={x:pass.x,y:y+shift};
 const route=world=>world.path(near,far,[],clearance(),undefined,true,false,false,slope);
 const expected=route(old.world);
 assert.ok(expected.length>0);
 restored.world.physicalPassAvailable=()=>{throw Error('Historical v4 navigation called the newer pass validator');};
 assert.deepEqual(route(restored.world),expected);
});
