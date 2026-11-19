import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {distance} from '../dist/src/reborn/config.js';

// Broad tank: centre can be safe, while the rightmost track just overhangs
// a painted rocky slope. All navigation grid cells are clear.
const makeLip=(w)=>{
 w.blocked.fill(0);w.components.fill(0);w.opaque.fill(0);
 w.terrainSlope=(x,y)=>x>=950&&x<1050?.34:.04;
 w.terrainHeight=(x,y)=>x<=950?0:x<1050?(x-950)*.34:34;
};

test('a tank at a cliff lip can physically RETREAT onto safe sand',()=>{
 const w=new World(20261119,24,'mixed');
 makeLip(w);
 const lip={x:940,y:1100},safe={x:875,y:1100};
 assert.ok(w.walkable(lip),'tank centre is not within the cliff');
 assert.equal(w.terrainSlope(lip.x,lip.y),.04);
 assert.equal(w.groundVehicleSlopeSafe(lip,.215,40),false,
  'one tank track is already touching the over-steep embankment');
 assert.equal(w.groundVehicleStepSafe(lip,safe,.215,40),true,
  'moving further toward flat sand must be possible');
 assert.equal(w.line(lip,safe,[],30,.215),true);
 const route=w.path(lip,safe,[],30,undefined,false,true,true,.215);
 assert.ok(route.length,'exact vehicle navigation must accept cliff escape');
 assert.ok(distance(route.at(-1),safe)<20,
  'route must reach the safe destination, not only the cliff edge');
 let from=lip;
 for(const p of route){
  assert.equal(w.groundVehicleStepSafe(from,p,.215,40),true);
  from=p;
 }
});

test('recovery never grants traversing an actual steep cliff or sideways sliding',()=>{
 const w=new World(20261119,24,'mixed');makeLip(w);
 const lip={x:940,y:1100};
 assert.equal(w.groundVehicleStepSafe(lip,{x:985,y:1100},.215,40),false,
  'approach INTO the mountain remains blocked');
 assert.equal(w.groundVehicleStepSafe(lip,{x:940,y:1010},.215,40),false,
  'moving parallel along an unsafe overhang is not a valid escape');
 assert.equal(w.groundVehicleStepSafe({x:910,y:1100},
  {x:1140,y:1100},.215,40),false,'safe origins cannot climb the cliff');
 const steep={x:980,y:1100};
 assert.equal(w.groundVehicleStepSafe(steep,{x:1020,y:1100},.215,40),
  false,'vehicle stuck in center of cliff cannot climb farther');
});

test('actual player tank obeys a retreat move order after touching steep terrain',()=>{
 const g=new Simulation(20261119,24);
 g.units=[];g.bases=[];g.hadBuildings=[false,false];g.aiClock=-1e9;
 g.status='playing';g.paused=false;
 makeLip(g.world);
 const tank=g.spawn(0,{x:940,y:1100},'tank');
 g.spawn(1,{x:4000,y:4000},'infantry');
 const starting={x:tank.x,y:tank.y};
 const goal={x:790,y:1100};
 const accepted=g.command([tank.id],{kind:'move',...goal});
 assert.equal(accepted,1,'command cannot silently disappear');
 assert.ok(tank.orders.length,'new route is retained');
 // Run real fixed ticks, including hull turning and acceleration.
 for(let i=0;i<320;i++)g.step(.05);
 assert.ok(tank.x<starting.x-28,
  'tank must leave the lip under ordinary orders: '+JSON.stringify({
   x:tank.x,y:tank.y,path:tank.path,orders:tank.orders,
   repath:tank.repath,angle:tank.angle,hull:tank.hullAngle
  }).slice(0,900));
 assert.equal(g.world.groundVehicleSlopeSafe(tank,.215,40),true,
  'tank eventually leaves the hazardous track-overhang zone');
 assert.equal(g.status,'playing');
});
