import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openingCaptureRouteLength,openingCaptureRouteScore,openingCaptureDecisionDistance}
 from '../dist/src/reborn/ai33-map-doctrine.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

test('an apparently close cliff Bastion loses to a genuinely short open route',()=>{
 const scout={x:0,y:0};
 const closeBehindCliff={x:100,y:0};
 const longerOpen={x:300,y:0};
 const cliffPath=[{x:0,y:900},{x:100,y:900},closeBehindCliff];
 const openPath=[longerOpen];
 const cliff=openingCaptureRouteLength(scout,closeBehindCliff,cliffPath,50);
 const open=openingCaptureRouteLength(scout,longerOpen,openPath,50);
 assert.ok(cliff>open);
 const score=(distance)=>openingCaptureRouteScore({
  distance,income:15,enemyOwned:false,aggressiveRecapture:false
 });
 assert.ok(score(open)<score(cliff));
 assert.ok(score(openingCaptureDecisionDistance(100,cliff,50))>
  score(openingCaptureDecisionDistance(300,open,50)),
  'extreme cliff detour must still override misleading short air distance');
 assert.equal(openingCaptureDecisionDistance(200,350,50),200,
  'ordinary small route bends must not change Bastion priorities');
 assert.equal(openingCaptureDecisionDistance(300,720,50),520,
  'longer-than-four-cell detours carry only their meaningful excess');
 assert.ok(score(Math.hypot(100,0))<score(300),
  'old Euclidean scoring would pick the wrong distant mountain route');
});
test('incomplete, empty and nonfinite A* paths are rejected',()=>{
 const from={x:100,y:100},target={x:2000,y:150};
 assert.equal(openingCaptureRouteLength(from,target,[],45),Infinity);
 assert.equal(openingCaptureRouteLength(from,target,[{x:400,y:150}],45),Infinity);
 assert.equal(openingCaptureRouteLength(from,target,[{x:NaN,y:150}],45),Infinity);
 assert.equal(openingCaptureRouteLength(from,{x:200,y:100},[{x:180,y:100}],45),80);
});
test('public recapture priority and high-income neutral priority are preserved',()=>{
 const rank=(distance,income,enemyOwned,aggressiveRecapture)=>
  openingCaptureRouteScore({distance,income,enemyOwned,aggressiveRecapture});
 assert.equal(rank(900,20,true,true),40);
 assert.equal(rank(900,20,false,true),740);
 assert.equal(rank(900,20,true,false),740);
 assert.ok(rank(700,35,false,false)<rank(700,10,false,false));
});
test('real seeded modern opening still reserves a paid reachable infantry scout',()=>{
 const g=Simulation.campaign(9999,24,'oasis',10);
 g.time=3;
 g.tactical.plan();
 const entries=g.tactical.state.openingContests??[];
 assert.ok(entries.length>=1,'normal paid scout opening lost');
 const scout=g.units.find(u=>u.id===entries[0].unitId);
 const site=g.territories.find(t=>t.id===entries[0].sectorId);
 assert.ok(scout&&site&&site.owner===-1);
 const order=scout.orders[0];
 assert.equal(order?.kind,'attackMove');
 assert.ok(Math.hypot(order.x-site.point.x,order.y-site.point.y)<125);
});
