import test from 'node:test';
import assert from 'node:assert/strict';
import {ai42BreakoutAllowed,ai42HqLookout,ai42DirectVisibleStrike} from '../dist/src/reborn/ai36-air-support.js';
test('observed late HQ siege requires two paid bombers, strong bastion control, at most one AA',()=>{
 const x={enabled:true,time:385,controlled:15,total:16,paidBombers:2,
  missionKind:'structure',missionSector:0,knownHQSector:0,
  targetKind:'headquarters',distanceFromHQ:0,targetVisible:true,
  knownAirDefenses:1,observedAirDefenses:1};
 assert.equal(ai42BreakoutAllowed(x),true);
 assert.equal(ai42BreakoutAllowed({...x,targetKind:'turret',distanceFromHQ:380}),true);
 // A physically visible HQ remains a target while a neutral Bastion is captured.
 assert.equal(ai42BreakoutAllowed({...x,missionKind:'capture',missionSector:3}),true);
 assert.equal(ai42BreakoutAllowed({...x,missionKind:'capture',missionSector:3,targetKind:'turret'}),false);
 assert.equal(ai42BreakoutAllowed({...x,missionKind:'capture',missionSector:3,targetVisible:false}),false);
 for(const bad of [{enabled:false},{time:290},{controlled:12},{total:12},
  {paidBombers:1},{missionKind:'capture',targetKind:'turret'},
  {missionSector:3,targetKind:'turret'},
  {knownHQSector:undefined},{targetKind:'tank'},
  {targetKind:'turret',distanceFromHQ:900},{targetVisible:false},
  {knownAirDefenses:2},{observedAirDefenses:2}])
  assert.equal(ai42BreakoutAllowed({...x,...bad}),false,JSON.stringify(bad));
});
test('bomber sight waypoint avoids previously observed AA and never targets via fog',()=>{
 const x={from:{x:6300,y:6500},target:{x:1300,y:1200},size:7600,sight:680,
  guns:[{x:1500,y:1600,range:450}]};
 const p=ai42HqLookout(x);
 assert.ok(p);
 assert.ok(Math.hypot(p.x-x.target.x,p.y-x.target.y)<x.sight-40);
 assert.ok(x.guns.every(t=>Math.hypot(t.x-p.x,t.y-p.y)>t.range+94));
 assert.equal(ai42HqLookout({...x,sight:180}),undefined);
 assert.equal(ai42HqLookout({...x,guns:[{x:1300,y:1200,range:760}]}),undefined);
});

test('only an already authorized visible late-game HQ airstrike can skip the geometric flank',()=>{
 const allowed={airBreakoutAllowed:true,bomberDistance:1400,
  existingSameTarget:false,retreating:false};
 assert.equal(ai42DirectVisibleStrike(allowed),true);
 assert.equal(ai42DirectVisibleStrike({...allowed,bomberDistance:1900}),true);
 for(const bad of [
  {airBreakoutAllowed:false},{bomberDistance:2100},
  {existingSameTarget:true},{retreating:true}
 ])assert.equal(ai42DirectVisibleStrike({...allowed,...bad}),false,JSON.stringify(bad));
});

test('paid canyon air breakout may launch once both bombers exist at 330s',()=>{
 const x={enabled:true,time:330,controlled:14,total:16,paidBombers:2,
  missionKind:'structure',missionSector:0,knownHQSector:0,
  targetKind:'turret',distanceFromHQ:390,targetVisible:true,
  knownAirDefenses:1,observedAirDefenses:1};
 assert.equal(ai42BreakoutAllowed(x),true);
 assert.equal(ai42BreakoutAllowed({...x,time:329.9}),false);
 assert.equal(ai42BreakoutAllowed({...x,paidBombers:1}),false);
 assert.equal(ai42BreakoutAllowed({...x,controlled:13}),false);
 assert.equal(ai42BreakoutAllowed({...x,targetVisible:false}),false);
});
