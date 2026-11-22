import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';

function cornerScenario(kind='tank'){
 const g=new Simulation(20261122,24,false,false,undefined,10);
 g.units=[];g.bases=[];g.territories=[];g.hadBuildings=[false,false];
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 // Physical steep plateau lip blocks the DIRECT tank footprint, but the
 // vehicle can retreat/drive sideways on real, safe sand beside the corner.
 g.world.terrainSlope=(x,y)=>x>=1040&&x<1200&&Math.abs(y-1000)<90?.34:.04;
 g.world.terrainHeight=()=>0;
 const tank=g.spawn(0,{x:1022,y:1000},kind);
 const goal={x:1600,y:1000},order={kind:'move',...goal};
 tank.orders=[order];tank.path=[goal];tank.repath=5;
 tank.angle=0;tank.hullAngle=0;tank.driveSpeed=UNITS[kind].speed;
 g.time=10;g.spatial.rebuild(g.units);
 return {g,tank,goal,order};
}
function blockedContact(g,u,goal){
 u.path=[goal];u.repath=5;
 const before={x:u.x,y:u.y};
 g.move(u,goal,.05);
 assert.deepEqual({x:u.x,y:u.y},before,
  'real collision must reject the unsafe step and NEVER teleport');
 g.time+=.05;
}
test('tank recovers after two physical plateau-corner contacts, even with a nonempty A* route',()=>{
 const {g,tank,goal,order}=cornerScenario();
 assert.ok(g.world.groundVehicleSlopeSafe(tank,.215,UNITS.tank.radius),
  'tank should start on safe ground');
 assert.equal(g.world.groundVehicleStepSafe(tank,{x:1026,y:1000},.215,UNITS.tank.radius),
  false,'the path into the steep lip must be physically rejected');
 blockedContact(g,tank,goal);
 assert.equal(tank.path.length,0,'first blocked step schedules a bounded A* retry');
 blockedContact(g,tank,goal);
 assert.equal(tank.orders[0],order,'manual destination is retained');
 assert.equal(tank.path.length,1,'second collision inserts a safe escape waypoint');
 const escape=tank.path[0];
 assert.ok(Math.abs(escape.y-tank.y)>60,'the tank must leave the blocked corner laterally');
 assert.ok(g.world.walkable(escape,[],UNITS.tank.radius-10));
 assert.ok(g.world.line(tank,escape,[],UNITS.tank.radius-10,.215),
  'recovery cannot cut a plateau cliff or exceed tank track grade');
 assert.equal(tank.exactPath,true,'next A* must use the exact physical route');
});

test('corner recovery respects combat, hold, cargo and stopped formations',()=>{
 for(const excluded of ['hold','combat','cargo']){
  const {g,tank,goal}=cornerScenario();
  if(excluded==='hold')tank.hold=true;
  if(excluded==='combat')tank.combatTarget=9999;
  if(excluded==='cargo')tank.transport={cargo:[9999]};
  blockedContact(g,tank,goal);
  blockedContact(g,tank,goal);
  assert.equal(tank.path.length,0,excluded+' must not trigger autonomous detour');
 }
});

test('no recovery waypoint may cross an unbroken physical cliff',()=>{
 const {g,tank,goal}=cornerScenario();
 // Surround the vehicle with steep slopes rather than only one side.
 g.world.terrainSlope=(x,y)=>Math.hypot(x-tank.x,y-tank.y)>24?.38:.04;
 blockedContact(g,tank,goal);
 blockedContact(g,tank,goal);
 assert.equal(tank.path.length,0,'zero physically legal escape points => no ghost movement');
 assert.equal(tank.orders.length,1,'the blocked order stays available for later retry');
});

test('fix handles physical contact without an A* flood at 1x, 2x and 4x',()=>{
 for(const rate of [1,2,4]){
  const {g,tank,goal}=cornerScenario();
  blockedContact(g,tank,goal);
  blockedContact(g,tank,goal);
  assert.equal(tank.path.length,1,'missing escape at '+rate+'x');
  const start={x:tank.x,y:tank.y};
  for(let frame=0;frame<70;frame++){
   for(let tick=0;tick<rate;tick++){
    g.move(tank,goal,.05);
    g.time+=.05;
   }
  }
  assert.ok(Math.hypot(tank.x-start.x,tank.y-start.y)>40,
   rate+'x tank remained wedged after physical side-step');
  assert.ok(tank.orders.length>0,'original long destination vanished at '+rate+'x');
  assert.ok(g.world.groundVehicleSlopeSafe(tank,.215,UNITS.tank.radius),
   'illegal plateau contact after '+rate+'x recovery');
 }
});

test('collision recovery is guarded and does not change old-map navigation',()=>{
 const src=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(src,/const eligible=vehicle&&this\.world\.generatorVersion>=7/);
 assert.match(src,/this\.cornerEscapeCooldown\.get\(u\)/);
 assert.match(src,/this\.world\.line\(u,q,collisionObstacles,clearance,slopeLimit\)/);
 assert.match(src,/u\.orders\[0\]/);
 assert.match(src,/u\.path=\[detour\]/);
 const {g,tank,goal}=cornerScenario();
 Object.defineProperty(g.world,'generatorVersion',{value:6});
 blockedContact(g,tank,goal);
 blockedContact(g,tank,goal);
 assert.equal(tank.path.length,0,'legacy maps retain original handling');
});
