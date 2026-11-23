import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

function tankTrafficFixture(){
 const g=new Simulation(2074,23);
 g.units=[];g.bases=[];g.world.blocked.fill(0);g.world.opaque.fill(0);
 g.hadBuildings=[false,false];g.aiClock=1e8;g.tactical.plan=()=>{};
 g.status='playing';g.paused=false;g.time=10;
 g.spawn(1,{x:g.world.size-180,y:g.world.size-190},'infantry');
 const rear=g.spawn(0,{x:1000,y:1000},'tank');
 const stopped=g.spawn(0,{x:1080,y:1000},'tank');
 g.stop([stopped.id]);
 assert.equal(g.command([rear.id],{kind:'move',x:1600,y:1000}),1);
 rear.path=[{x:1500,y:1000}];
 rear.angle=0;rear.hullAngle=0;rear.driveSpeed=3;
 g.spatial.rebuild(g.units);
 return {g,rear,stopped};
}

test('replanned waypoint does not reset stall watchdog when tank has not moved',()=>{
 const {g,rear}=tankTrafficFixture();
 const original=rear.orders[0];
 g.vehicleProgress.set(rear,{
  x:rear.x,y:rear.y,since:g.time-5,retryAt:-10,
  nextX:1240,nextY:1000,bestDistance:240,order:original
 });
 const before={x:rear.x,y:rear.y};
 g.move(rear,original,.05);
 assert.deepEqual({x:rear.x,y:rear.y},before,'no teleport or forced movement');
 assert.ok(rear.path.length>=2,'sideways detour should precede the original waypoint');
 assert.notEqual(rear.path[0].y,1000,'detour must escape the occupied lane');
 assert.equal(g.vehicleProgress.get(rear).retryAt,g.time,
  'stalled vehicle must actually enter the safe recovery branch');
});

test('a new player order resets old stall history instead of triggering an old detour',()=>{
 const {g,rear}=tankTrafficFixture();
 const oldOrder=rear.orders[0];
 g.vehicleProgress.set(rear,{
  x:rear.x,y:rear.y,since:g.time-5,retryAt:-10,
  nextX:1250,nextY:1000,bestDistance:250,order:oldOrder
 });
 const nextOrder={kind:'move',x:1650,y:1050};
 rear.orders=[nextOrder];rear.path=[{x:1450,y:1050}];
 g.move(rear,nextOrder,.05);
 const progress=g.vehicleProgress.get(rear);
 assert.equal(progress.order,nextOrder);
 assert.equal(progress.since,g.time);
 assert.equal(progress.retryAt,-1);
 assert.equal(rear.path.length,1,'new order must not receive old recovery detour');
});
