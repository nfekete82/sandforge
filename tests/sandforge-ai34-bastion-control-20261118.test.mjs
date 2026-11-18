import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapBastionContestOpening,mapFrontierPosts} from '../dist/src/reborn/ai33-map-doctrine.js';
import {RULES,distance} from '../dist/src/reborn/config.js';

test('AI 3.4 contests income on 8/16-Bastion maps without free soldiers or credits',()=>{
 for(const version of [24,26]){
  const g=Simulation.campaign(2026,version,'dunes'),initial=g.units.map(u=>u.id);
  const initialMoney=g.credits[1];
  g.time=3;g.tactical.ai33Mode='adaptive';g.tactical.plan();
  const contests=g.tactical.state.openingContests??[];
  assert.equal(contests.length,1,'early PAID infantry should contest a neutral Bastion on map '+version);
  const order=g.units.find(u=>u.id===contests[0].unitId)?.orders[0];
  assert.equal(order?.kind,'attackMove');
  assert.ok(distance(order,g.territories[contests[0].sectorId].point)<RULES.captureRadius+25);
  assert.equal(g.territories[contests[0].sectorId].owner,-1);
  assert.deepEqual(g.units.map(u=>u.id),initial,'no free infantry');
  assert.ok(g.credits[1]<=initialMoney,'no economy buffs');
  const previous={...order};
  g.time=6;g.tactical.plan();
  assert.deepEqual(g.units.find(u=>u.id===contests[0].unitId).orders[0],previous,
   '3-second macro tick must not reset the path');
 }
});
test('AI 3.4 counterattack is based on PUBLIC Bastion ownership and paid reserves',()=>{
 const eight=mapBastionContestOpening(24,45,4,1,5);
 assert.deepEqual(eight,{slots:2,counter:true});
 assert.deepEqual(mapBastionContestOpening(24,45,1,1,5),{slots:2,counter:false});
 assert.deepEqual(mapBastionContestOpening(24,45,4,1,2),{slots:1,counter:false});
 assert.deepEqual(mapBastionContestOpening(26,80,6,2,5),{slots:2,counter:true});
 assert.deepEqual(mapBastionContestOpening(24,215,6,1,8),{slots:0,counter:false});
 assert.deepEqual(mapBastionContestOpening(25,80,7,1,8),{slots:0,counter:false});
});
test('AI 3.4 stations paid guards at frontline Bastions without emptying HQ',()=>{
 assert.equal(mapFrontierPosts(24,2,4,2),0);
 assert.equal(mapFrontierPosts(24,3,4,2),1);
 assert.equal(mapFrontierPosts(24,4,4,2),1);
 assert.equal(mapFrontierPosts(24,6,4,2),2);
 assert.equal(mapFrontierPosts(26,4,4,2),1);
 assert.equal(mapFrontierPosts(26,6,4,2),2);
 assert.equal(mapFrontierPosts(25,4,4,2),2);
});
test('KI3.2 off remains exactly the old policy on 8/16 Bastions',()=>{
 for(const version of [24,26]){
  const g=Simulation.campaign(2026,version,'dunes');g.tactical.ai33Mode='off';
  g.time=3;g.tactical.plan();
  assert.equal(g.tactical.state.openingContests?.length??0,0);
 }
});
