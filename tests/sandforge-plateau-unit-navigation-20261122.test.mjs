import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES,distance} from '../dist/src/reborn/config.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {navigationLine} from '../dist/src/reborn/navigation-line.js';

const flatTestTerrain=(w)=>{
 w.blocked.fill(0);
 w.opaque.fill(0);
 w.components.fill(0);
 w.terrainSlope=()=>.04;
 w.terrainHeight=()=>0;
};

test('highland coarse paths never return a shortcut through a cliff corner',()=>{
 const w=new World(20261122,24,'mixed',0,10);
 flatTestTerrain(w);
 // A very short crossing of the corner of cell (5,5) can fall between
 // the coarse line sampler's probes. The exact DDA must always reject it.
 w.blocked[5*RULES.grid+5]=1;
 const c=w.cell;
 const from={x:4.995*c,y:5.008*c};
 const goal={x:8*c,y:2*c};
 assert.equal(navigationLine(from,goal,c,RULES.grid,w.blocked,[],RULES.infantry.radius,0),false);
 for(const exact of [false,true]){
  const route=w.path(from,goal,[],0,undefined,false,exact,true,.215);
  if(exact)assert.ok(route.length,'exact navigation must find the legal route around the rock');
  let previous=from;
  for(const p of route){
   assert.ok(navigationLine(previous,p,c,RULES.grid,w.blocked,[],RULES.infantry.radius,0),
    'route segment cuts through a blocked cliff cell');
   assert.ok(w.groundVehicleStepSafe(previous,p,.215,10));
   previous=p;
  }
  if(route.length)assert.ok(distance(route.at(-1),goal)<c*1.5);
 }
});

test('a manually placed tank waypoint on a cliff face snaps onto driveable terrain',()=>{
 const g=new Simulation(20261122,24);
 g.units=[];g.bases=[];g.hadBuildings=[false,false];g.aiClock=-1e9;
 flatTestTerrain(g.world);
 g.world.terrainSlope=(x)=>x>=950&&x<1050?.34:.04;
 g.world.terrainHeight=(x)=>x<=950?0:x<1050?(x-950)*.34:34;
 const tank=g.spawn(0,{x:860,y:1100},'tank');
 const accepted=g.command([tank.id],{kind:'move',x:990,y:1100});
 assert.equal(accepted,1);
 assert.equal(tank.orders.length,1);
 const goal=tank.orders[0];
 assert.ok(distance(goal,{x:990,y:1100})>3,
  'a click inside the steep cliff must not be retained as an impossible destination');
 assert.ok(g.world.groundVehicleSlopeSafe(goal,.215,UNITS.tank.radius),
  'the final move order must respect the tank track footprint');
});

test('manual player vehicles can take a real side detour after a sustained plateau stall',()=>{
 const g=new Simulation(20261122,24);
 g.units=[];g.bases=[];g.territories=[];g.hadBuildings=[false,false];g.aiClock=-1e9;
 flatTestTerrain(g.world);
 const u=g.spawn(0,{x:1500,y:1500},'rover');
 const goal={x:2000,y:1500};
 const order={kind:'move',...goal};
 u.orders=[order];
 u.path=[goal];u.repath=1;
 g.move(u,goal,.05);
 // The next attempt follows 4 seconds without meaningful forward progress.
 g.time+=4;
 u.path=[goal];u.repath=1;
 g.move(u,goal,.05);
 assert.equal(u.orders[0],order,'manual move order must survive recovery');
 assert.equal(u.path.length,1,JSON.stringify({
  unit:{id:u.id,kind:u.kind,x:u.x,y:u.y,hold:u.hold,
   combatTarget:u.combatTarget,driveSpeed:u.driveSpeed,orders:u.orders,
   repath:u.repath,path:u.path},
  time:g.time,progress:g.vehicleProgress.get(u),
  escapes:g.ai38VehicleEscapes.get(u),
  world:{mapVersion:g.world.mapVersion,generatorVersion:g.world.generatorVersion}
 }));
 assert.ok(Math.abs(u.path[0].y-u.y)>60,
  'stalled vehicle should pick a legal lateral lane instead of repeating the cliff impact');
 assert.ok(g.world.line(u,u.path[0],[],Math.max(0,UNITS.rover.radius-10),.195),
  'recovery must not cross a physical obstacle or exceed the vehicle grade');
});
