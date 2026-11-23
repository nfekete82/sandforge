import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {raisedMesaRouteWaypoint} from '../dist/src/reborn/raised-mesas.js';

const map=globalThis.SandforgeDesertMaps.byId('desert-strike');
const g=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
const mesa=g.world.generated.plateaus.find(x=>x.siteIndex===-1);
const footprint=UNITS.tank.radius-10;
const valid=p=>g.world.walkable(p,[],footprint)&&
 g.world.groundVehicleSlopeSafe(p,.215,UNITS.tank.radius);
const at=(direction,r)=>({x:mesa.center.x+direction.x*r,
 y:mesa.center.y+direction.y*r});
const left={x:-1,y:0},right={x:1,y:0};

test('successive bounded A* replans cannot send an ascending tank BACK to the ramp mouth',()=>{
 const summit={...mesa.center};
 const inner=at(left,mesa.topRadius*.75);
 for(const r of [mesa.rampEnd-150,mesa.rampEnd-350,
  mesa.rampEnd-750,mesa.footRadius+35,mesa.topRadius+45]){
  const from=at(left,r);
  assert.ok(valid(from),'real ramp must be traversable '+r);
  const next=raisedMesaRouteWaypoint(from,summit,[mesa],valid);
  assert.deepEqual(next,inner,
   'replan while climbing reversed the tank into the outer ramp marker at radius '+r);
 }
});
test('after the summit the tank stays on the descending ramp, not another climb',()=>{
 const eastOuter=at(right,mesa.rampEnd-140);
 const goal=at(right,mesa.rampEnd+300);
 const inner=at(right,mesa.topRadius*.75);
 assert.deepEqual(raisedMesaRouteWaypoint(mesa.center,goal,[mesa],valid),inner);
 for(const r of [mesa.topRadius+35,mesa.footRadius-25]){
  const from=at(right,r);
  assert.ok(valid(from),'exit ramp must be driveable '+r);
  assert.deepEqual(raisedMesaRouteWaypoint(from,goal,[mesa],valid),eastOuter,
   'descending tank was sent back uphill at radius '+r);
 }
 for(const r of [mesa.footRadius+40,mesa.rampEnd-400]){
  const from=at(right,r);
  assert.equal(raisedMesaRouteWaypoint(from,goal,[mesa],valid),undefined,
   'tank outside cliff band must advance to goal without another ramp detour');
 }
 assert.equal(raisedMesaRouteWaypoint(eastOuter,goal,[mesa],valid),undefined,
  'tank already outside the cliff rim must continue to its original order');
});
test('unrelated routes never acquire a hidden central-plateau detour',()=>{
 const from={x:mesa.center.x-2300,y:mesa.center.y-2200};
 const to={x:mesa.center.x-2100,y:mesa.center.y-2200};
 assert.equal(raisedMesaRouteWaypoint(from,to,[mesa],valid),undefined);
});
