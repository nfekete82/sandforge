import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {vehicleSpacingGap} from '../dist/src/reborn/vehicle-spacing.js';

function edgeCollision(version=10){
 const g=new Simulation(20261123,24,false,false,undefined,version);
 g.units=[];g.bases=[];g.territories=[];g.hadBuildings=[false,false];
 g.aiClock=1e8;g.tactical.plan=()=>{};
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 const startCliff=1000;
 // Centre is on legal flat sand, but pushing the right track another 2m
 // would put it on a physically forbidden >21.5% plateau shoulder.
 g.world.terrainSlope=(x,y)=>x>=startCliff?.38:.04;
 g.world.terrainHeight=()=>0;
 const spec=UNITS.tank;
 const x=startCliff-Math.min(spec.radius,26)*.72-3;
 const head=g.spawn(0,{x,y:1100},'tank');
 const rear=g.spawn(0,{x:x-(spec.radius*2+4),y:1100},'tank');
 return {g,head,rear,startCliff};
}

test('two paid idle tanks never push a track onto an impassable cliff lip',()=>{
 const {g,head,rear}=edgeCollision();
 assert.ok(g.world.groundVehicleSlopeSafe(head,.215,UNITS.tank.radius),
  'starting tracks must be fully safe');
 const startHead=head.x,startRear=rear.x,comfortable=vehicleSpacingGap(head,rear).comfortable;
 assert.ok(Math.hypot(head.x-rear.x,head.y-rear.y)<comfortable);
 for(let tick=0;tick<40;tick++){
  g.step(.05);
  assert.ok(g.world.groundVehicleSlopeSafe(head,.215,UNITS.tank.radius),
   'separation pushed tank onto prohibited shoulder, tick '+tick+' x='+head.x);
  assert.ok(g.world.groundVehicleSlopeSafe(rear,.215,UNITS.tank.radius));
 }
 assert.ok(head.x-startHead<4,'front tank should not slide into rock');
 assert.ok(startRear-rear.x>3,'rear tank should yield away from the hard cliff');
});
test('legacy or flat terrain separation remains available',()=>{
 const {g,head,rear}=edgeCollision(6);
 const x=head.x,y=rear.x;
 for(let i=0;i<12;i++)g.step(.05);
 assert.ok(head.x>x&&rear.x<y,
  'legacy collision separation must retain its previous behavior');
});
