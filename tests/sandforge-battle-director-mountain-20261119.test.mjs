import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battleDirectorPulse,validBattleDirector} from '../dist/src/reborn/battle-director.js';
import {canyonPassWaypoint,ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';
import {World} from '../dist/src/reborn/world.js';
import {bomberSupportQuota} from '../dist/src/reborn/ai36-air-support.js';
import {homeDefensePlan} from '../dist/src/reborn/home-defense-doctrine.js';
import {assaultWaveDecision} from '../dist/src/reborn/assault-wave.js';
import {BOMBER_VISUAL_STRETCH,visualUnitScale} from '../scripts/webgl-scale.js';

const base={time:75,owns:2,enemyOwns:3,bastions:8,frontContact:false,
 lastLaunchAt:0,readyFighters:8,recentLosses:0,homeThreat:false};

test('Battle Director generates pressure only with real paid fighters, time and public objectives',()=>{
 const hot=battleDirectorPulse(base);
 assert.equal(hot.posture,'pressure');
 assert.equal(hot.accelerateRally,true);
 assert.equal(hot.allowEarlyRaid,false);
 assert.equal(hot.quietSeconds,75);
 assert.equal(validBattleDirector(hot.state,75,8),true);
 assert.equal(battleDirectorPulse({...base,readyFighters:2}).pressure,false);
 assert.equal(battleDirectorPulse({...base,homeThreat:true}).pressure,false);
 assert.equal(battleDirectorPulse({...base,owns:8,enemyOwns:0}).pressure,false);
 assert.equal(battleDirectorPulse({...base,frontContact:true}).pressure,false);
 assert.equal(battleDirectorPulse({...base,time:95}).allowEarlyRaid,true);
});
test('lost Bastion triggers bounded counterattack, actual contact cancels drought',()=>{
 const a=battleDirectorPulse({...base,time:120,owns:4});
 const b=battleDirectorPulse({...base,time:130,owns:3},a.state);
 assert.equal(b.posture,'counterattack');
 assert.equal(b.promoteRecapture,true);
 assert.equal(b.state.lastBastionLossAt,130);
 const contact=battleDirectorPulse({...base,time:133,owns:3,frontContact:true},b.state);
 assert.equal(contact.quietSeconds,0);
 assert.equal(contact.posture,'combat');
 assert.equal(validBattleDirector(contact.state,133,8),true);
 assert.equal(validBattleDirector({...contact.state,lastContactAt:999},133,8),false);
});
test('urgency changes only rally thresholds and never hands out resources',()=>{
 const normal=homeDefensePlan({fighters:10,time:44,recentLosses:0,recentFailures:0,
  lastFailureAt:-1,observedHomePressure:false,defendedTarget:false,confirmedEndgame:false});
 const urged=homeDefensePlan({fighters:10,time:44,recentLosses:0,recentFailures:0,
  lastFailureAt:-1,observedHomePressure:false,defendedTarget:false,confirmedEndgame:false,tempoPressure:true});
 assert.equal(urged.guards,normal.guards);
 assert.equal(urged.minimumReady,normal.minimumReady);
 assert.ok(urged.notBefore<normal.notBefore);
 const wave={defended:true,selectedGround:8,readyGround:4,
  selectedStrength:32,readyStrength:10,elapsed:30,siegeSupported:false};
 assert.equal(assaultWaveDecision(wave).ready,false);
 assert.equal(assaultWaveDecision({...wave,tempoPressure:true}).reason,'bounded-wait');
});
test('late income can buy two, not unlimited, real bomber support aircraft',()=>{
 const p={enabled:true,airfieldReady:true,fighters:12,groundVehicles:5,
  income:100,time:320,underAttack:false,enemyAir:0,contestedBastions:true,finishing:false};
 assert.equal(bomberSupportQuota(p),2);
 assert.equal(bomberSupportQuota({...p,time:160}),1);
 assert.equal(bomberSupportQuota({...p,underAttack:true}),0);
 assert.equal(bomberSupportQuota({...p,enemyAir:2}),0);
 assert.equal(bomberSupportQuota({...p,fighters:3}),0);
});
test('bomber +12% span/length and +5% height never changes simulation stats',()=>{
 assert.deepEqual(BOMBER_VISUAL_STRETCH,{horizontal:1.12,vertical:1.05});
 assert.equal(visualUnitScale('bomber'),1.03);
 const render=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(render,/BOMBER_VISUAL_STRETCH\.horizontal/);
 assert.match(render,/BOMBER_VISUAL_STRETCH\.vertical/);
 const sim=readFileSync('src/reborn/simulation.ts','utf8');
 assert.doesNotMatch(sim,/BOMBER_VISUAL_STRETCH/);
});
test('synthetic canyon chooses pass entrance before routing across blocked cliff',()=>{
 const ridge={width:110,height:120,spine:[{x:100,y:1800},{x:3000,y:1800}],
  ramps:[{x:600,width:250},{x:2600,width:250}],clearings:[]};
 const from={x:1500,y:1300},to={x:1530,y:2400};
 const first=canyonPassWaypoint(from,to,[ridge],28);
 assert.ok(first);
 assert.ok(Math.abs(first.x-600)<1||Math.abs(first.x-2600)<1);
 assert.ok(first.y<1800,'first staging point on own side of ridge');
 const second=canyonPassWaypoint({...first,x:first.x+2},to,[ridge],28);
 assert.ok(second&&second.y>1800,'second staging point must cross real ramp');
 assert.equal(canyonPassWaypoint({x:600,y:1300},{x:600,y:2400},[ridge],28),undefined,
  'direct crossing through already-open pass stays untouched');
});
test('generated v3 network terrain retains impassable ridges and legal wide passes',()=>{
 const world=new World(824836862,24,'mixed',0,3);
 assert.equal(world.validation?.valid,true);
 const ridge=world.generated.ridges[0];
 assert.ok(ridge&&ridge.ramps.length>=2);
 assert.equal(world.generated.mesas.length,0);
 let chosen;
 for(const factor of [.43,.52,.60]){
  const x=world.size*factor,y=ridgeHeightAtX(ridge,x);
  const from=world.nearest({x,y:y-ridge.width-300});
  const to=world.nearest({x:x+35,y:y+ridge.width+300});
  if(!from||!to)continue;
  const via=canyonPassWaypoint(from,to,[ridge],20);
  if(via){chosen={from,to,via};break;}
 }
 assert.ok(chosen,'at least one direct line crosses blocked cliff away from pass');
 const {from,to,via}=chosen;
 assert.ok(world.walkable(from)&&world.walkable(to));
 assert.ok(!world.line(from,to,[],20),'a cliff blocks the direct shortcut');
 const route=world.path(from,to,[],20,undefined,false,false,true);
 assert.ok(route.length>0,'bounded move path must approach a real pass');
 assert.ok(route.every(p=>world.walkable(p,[],20)),'every waypoint remains passable');
 const end=route.at(-1);
 assert.ok(Math.hypot(end.x-via.x,end.y-via.y)<220,
  'partial path approaches pass entrance instead of stopping at mountain wall');
});
