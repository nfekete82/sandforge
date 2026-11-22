import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

function noPathScenario(generatorVersion=10){
 const game=new Simulation(20261122,24,false,false,undefined,generatorVersion);
 game.units=[];game.bases=[];game.territories=[];game.hadBuildings=[false,false];game.aiClock=-1e9;
 game.world.blocked.fill(0);
 game.world.opaque.fill(0);
 game.world.components.fill(0);
 game.world.terrainSlope=()=>.04;
 game.world.terrainHeight=()=>0;
 const unit=game.spawn(0,{x:1500,y:1500},'rover');
 const goal={x:1950,y:1500};
 const order={kind:'move',...goal};
 unit.orders=[order];unit.path=[];unit.repath=0;unit.hold=false;unit.combatTarget=null;
 // Simulate both bounded A* budgets exhausting on a heavily obstructed map,
 // while leaving the real physical collision and grade checks untouched.
 game.world.path=()=>[];
 return {game,unit,goal,order};
}

test('manual highland vehicle with no A* route receives a collision-checked physical detour',()=>{
 const {game,unit,goal,order}=noPathScenario();
 const from={x:unit.x,y:unit.y};
 game.move(unit,goal,.05);
 assert.equal(unit.orders[0],order,'keep the manual destination for the following path query');
 assert.equal(unit.path.length,1,'an empty A* result should not strand a moving player vehicle');
 const candidate=unit.path[0];
 assert.ok(Math.hypot(candidate.x-from.x,candidate.y-from.y)<=316);
 assert.ok(game.world.line(from,candidate,[],Math.max(0,UNITS.rover.radius-10),.195),
  'the temporary detour may not pass through rocks or unsafe slopes');
 assert.ok(Math.hypot(unit.x-from.x,unit.y-from.y)<=UNITS.rover.speed*.05+1,
  'escape must move via ordinary simulation, never teleport');
});

test('player no-path detour respects hold, stopped formations, cargo and active combat',()=>{
 for(const blocked of ['hold','stop','cargo','combat']){
  const {game,unit,goal}=noPathScenario();
  if(blocked==='hold')unit.hold=true;
  if(blocked==='cargo')unit.transport={cargo:[777]};
  if(blocked==='combat')unit.combatTarget=777;
  game.move(unit,goal,.05,blocked==='stop'?0:Infinity);
  assert.equal(unit.path.length,0,blocked+' must not trigger autonomous recovery');
 }
});

test('old generated maps retain their original no-path handling',()=>{
 const {game,unit,goal}=noPathScenario(6);
 game.move(unit,goal,.05);
 assert.equal(unit.path.length,0);
});
