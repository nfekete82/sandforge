import test from 'node:test';
import assert from 'node:assert/strict';
import {openingScoutNeedsCaptureMove} from '../dist/src/reborn/ai33-map-doctrine.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {capturePresenceRadius} from '../dist/src/reborn/territory-warfare.js';

test('only redundant neutral Bastion capture march orders are suppressed',()=>{
 const base={sectorOwner:-1,distanceToSector:90,
  capturePresenceRadius:125,existingCaptureOrder:false};
 assert.equal(openingScoutNeedsCaptureMove(base),false);
 assert.equal(openingScoutNeedsCaptureMove({...base,distanceToSector:117}),false);
 assert.equal(openingScoutNeedsCaptureMove({...base,distanceToSector:118}),true,
  'outside the conservative capture threshold a genuine move is required');
 assert.equal(openingScoutNeedsCaptureMove({...base,distanceToSector:130}),true);
 assert.equal(openingScoutNeedsCaptureMove({...base,sectorOwner:0}),true,
  'an enemy Bastion can still require moving/engaging defenders');
 assert.equal(openingScoutNeedsCaptureMove({...base,sectorOwner:1}),true);
 assert.equal(openingScoutNeedsCaptureMove({...base,distanceToSector:NaN}),true);
 assert.equal(openingScoutNeedsCaptureMove({...base,distanceToSector:999,
  existingCaptureOrder:true}),false,'preserve existing attackMove without reset');
});

test('a real HQ-less paid scout standing in the Bastion circle is not given another march order',()=>{
 const g=Simulation.campaign(4102,25,'rocky');
 g.time=3;
 g.tactical.plan();
 const missions=g.tactical.state.openingContests??[];
 assert.ok(missions.length,'the original 12 Bastion opener is active');
 const mission=missions[0];
 const soldier=g.units.find(u=>u.id===mission.unitId);
 const target=g.territories[mission.sectorId];
 assert.ok(soldier&&target);
 assert.equal(target.owner,-1);
 assert.equal(soldier.orders[0]?.kind,'attackMove');

 // Reproduce the actual reason to re-issue: the engine has finished a valid
 // march into the capture radius and removed its completed move order.
 const r=capturePresenceRadius(g.world.mapVersion);
 soldier.x=target.point.x+r-20;
 soldier.y=target.point.y;
 soldier.orders=[];soldier.path=[];soldier.moving=false;
 let scoutCommands=0;
 const baseCommand=g.command.bind(g);
 g.command=(ids,order,...rest)=>{
  if(ids.includes(soldier.id))scoutCommands++;
  return baseCommand(ids,order,...rest);
 };
 const claimed=g.tactical.contestOpeningBastions();
 assert.ok(claimed.has(soldier.id));
 assert.equal(scoutCommands,0,'do not command an already capturing scout');
 assert.deepEqual(soldier.orders,[]);
 assert.equal(g.tactical.state.openingContests[0].unitId,soldier.id);
});
