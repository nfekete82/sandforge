import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const maps=globalThis.SandforgeDesertMaps.maps.filter(m=>m.generatorVersion>=10);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Exercise real generated cliff geometry and real A* (no mocked terrain,
// path, slope, collision or clearance) for both vehicle footprints.
test('all current plateau maps offer legal tank and rover ramp approaches',()=>{
 for(const map of maps){
  const world=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion).world;
  // Ridge-only maps use a different elevation model: the absence of the
  // optional raised-mesa array is not a broken ramp. Still verify every
  // Bastion is reachable by tanks using the real terrain validator.
  assert.equal(world.validation?.tankReachableSites,map.bastions,
   map.id+' has tank-inaccessible Bastion sites');
  const mesas=(world.generated.plateaus??[]).filter(m=>m.ramps?.length);
  if(map.id==='desert-strike')
   assert.ok(mesas.length,map.id+' lost its required central four-ramp mesa');
  // Plateau Crossroads is built from three canyon ridges, NOT RaisedMesa.
  // Verify its actual four authored ridgeline passes rather than querying
  // an unrelated optional world.generated.plateaus array.
  if(map.id==='plateau-crossroads'){
   const passes=(world.generated.ridges??[]).flatMap(ridge=>
    ridge.ramps.map(pass=>({ridge,pass})));
   assert.equal(passes.length,4,'Plateau Crossroads lost one of four real passes');
   for(const {ridge,pass} of passes)for(const kind of ['tank','rover']){
    const vehicle=UNITS[kind],radius=Math.max(0,vehicle.radius-10);
    const slope=kind==='tank'?.215:.195;
    const crossing={x:pass.x,y:ridgeHeightAtX(ridge,pass.x)};
    assert.ok(world.walkable(crossing,[],radius),
     map.id+' '+kind+' cliff pass blocked');
    assert.ok(world.groundVehicleSlopeSafe(crossing,slope,radius+10),
     map.id+' '+kind+' cliff pass too steep');
    const offset=ridge.width*1.3+260;
    const from={x:crossing.x,y:crossing.y-offset};
    const to={x:crossing.x,y:crossing.y+offset};
    const route=world.path(from,to,[],radius,undefined,false,false,false,slope);
    assert.ok(route.length&&dist(route.at(-1),to)<world.cell*1.4,
     map.id+' '+kind+' cannot cross a real ridge pass');
   }
  }
  for(const mesa of mesas.slice(0,3)){
   for(const direction of mesa.ramps.slice(0,4)){
    const point=r=>({x:mesa.center.x+direction.x*r,y:mesa.center.y+direction.y*r});
    const start=point(mesa.rampEnd-120),goal=point(mesa.topRadius*.78);
    for(const kind of ['tank','rover']){
     const unit=UNITS[kind],radius=Math.max(0,unit.radius-10);
     assert.ok(world.walkable(start,[],radius),map.id+' '+kind+' ramp foot blocked');
     assert.ok(world.walkable(goal,[],radius),map.id+' '+kind+' summit blocked');
     const route=world.path(start,goal,[],radius,undefined,false,false,false,.215);
     assert.ok(route.length,map.id+' '+kind+' has no ascent route');
     assert.ok(dist(route.at(-1),goal)<world.cell*1.5,map.id+' '+kind+' missed summit');
     let previous=start;
     for(const next of route){
      assert.ok(world.line(previous,next,[],radius,.215),
       map.id+' '+kind+' route clips physical cliff');
      previous=next;
     }
    }
   }
  }
 }
});

// 2x/4x are represented by twice/four times as many FIXED simulation
// steps per rendered frame, never by enlarging physics delta.
test('mixed vehicle formation keeps its commands and makes progress at 1x/2x/4x',()=>{
 for(const speed of [1,2,4]){
  const game=new Simulation(20261122,24,false,false,undefined,10);
  game.units=[];game.bases=[];game.territories=[];game.hadBuildings=[false,false];
  game.aiClock=1e9;game.tactical.plan=()=>{};
  game.world.blocked.fill(0);game.world.opaque.fill(0);game.world.components.fill(0);
  game.world.terrainSlope=()=>.04;game.world.terrainHeight=()=>0;
  game.spawn(1,{x:game.world.size-180,y:game.world.size-180},'infantry');
  const vehicles=[
   game.spawn(0,{x:1300,y:1300},'tank'),
   game.spawn(0,{x:1450,y:1300},'tank'),
   game.spawn(0,{x:1300,y:1450},'rover'),
   game.spawn(0,{x:1450,y:1450},'rover')
  ];
  const start=vehicles.map(v=>({x:v.x,y:v.y}));
  assert.equal(game.command(vehicles.map(v=>v.id),{kind:'move',x:2500,y:2500}),vehicles.length);
  for(let frame=0;frame<200;frame++)
   for(let tick=0;tick<speed;tick++)game.step(.05);
  assert.equal(game.status,'playing','speed '+speed+' unexpectedly ended match');
  for(let i=0;i<vehicles.length;i++){
   const vehicle=vehicles[i];
   assert.ok(Number.isFinite(vehicle.x)&&Number.isFinite(vehicle.y),'invalid coordinates');
   assert.ok(dist(vehicle,start[i])>50,
    'speed '+speed+' vehicle '+i+' never made meaningful progress');
   assert.ok(game.world.walkable(vehicle,[],Math.max(0,UNITS[vehicle.kind].radius-10)),
    'speed '+speed+' vehicle '+i+' penetrated static terrain');
  }
 }
});
