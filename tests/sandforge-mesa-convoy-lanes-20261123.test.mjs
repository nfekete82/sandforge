import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {raisedMesaRouteWaypoint} from '../dist/src/reborn/raised-mesas.js';

const m=globalThis.SandforgeDesertMaps.byId('desert-strike');
const world=Simulation.campaign(m.seed,m.mapVersion,m.terrain,m.generatorVersion).world;
const mesa=world.generated.plateaus.find(p=>p.siteIndex===-1);
const radius=UNITS.tank.radius-10;
const valid=p=>world.walkable(p,[],radius)&&world.groundVehicleSlopeSafe(p,.215,UNITS.tank.radius);
const from={x:mesa.center.x-mesa.rampEnd-330,y:mesa.center.y};
const goal=mesa.center;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('five convoy lanes stay inside the exact same driveable Desert Strike ramp',()=>{
 const entries=[];
 const exits=[];
 for(const lane of [-2,-1,0,1,2]){
  const outer=raisedMesaRouteWaypoint(from,goal,[mesa],valid,lane);
  assert.ok(outer,'no safe ramp entrance for lane '+lane);
  assert.ok(valid(outer),'ramp track not driveable for lane '+lane);
  const inner=raisedMesaRouteWaypoint(outer,goal,[mesa],valid,lane);
  assert.ok(inner,'no safe ramp summit for lane '+lane);
  assert.ok(valid(inner),'summit track unsafe for lane '+lane);
  assert.ok(world.line(outer,inner,[],radius,.215),
   'ramp lane cannot be physically driven by tank '+lane);
  assert.ok(dist(inner,goal)<dist(outer,goal));
  entries.push(outer.y);
  exits.push(inner.y);
 }
 assert.equal(new Set(entries.map(v=>Math.round(v))).size,5,'all tanks converge to one outer marker');
 assert.equal(new Set(exits.map(v=>Math.round(v))).size,5,'all tanks converge to one inner marker');
 for(let i=1;i<entries.length;i++){
  assert.ok(entries[i]-entries[i-1]>55,
   'tank lanes overlap at the ramp mouth '+i);
  assert.ok(exits[i]-exits[i-1]>55,
   'tank lanes overlap at the summit '+i);
 }
});
