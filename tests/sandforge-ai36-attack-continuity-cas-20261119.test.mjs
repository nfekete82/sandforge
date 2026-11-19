import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveAI36Assault,ai36JoinActiveFront,maintainAI36FrontOnRetarget} from '../dist/src/reborn/ai36-assault-continuity.js';
import {observedBomberSupportTarget,bomberCloseAirSupportAllowed} from '../dist/src/reborn/ai36-air-support.js';
import {readFileSync} from 'node:fs';

const standing={survivingGround:3,healthyGround:3,armedGround:1,
 currentlyFighting:true,visibleGunPosition:false,availableSiege:0,
 nearbyPaidReinforcements:0};

test('an armored committed screen is not recalled merely due to spent historical reinforcements',()=>{
 assert.equal(preserveAI36Assault(standing),true);
 assert.equal(preserveAI36Assault({...standing,armedGround:2,
  currentlyFighting:false}),true,'two live armored vehicles can remain deployed');
 assert.equal(preserveAI36Assault({...standing,nearbyPaidReinforcements:2,
  currentlyFighting:false}),true,'only actual nearby backup, not queued production');
});
test('never keep a crushed or unsupported assault fighting hopelessly',()=>{
 assert.equal(preserveAI36Assault({...standing,survivingGround:2}),false);
 assert.equal(preserveAI36Assault({...standing,healthyGround:1}),false);
 assert.equal(preserveAI36Assault({...standing,armedGround:0}),false);
 assert.equal(preserveAI36Assault({...standing,currentlyFighting:false}),false);
 assert.equal(preserveAI36Assault({...standing,visibleGunPosition:true,
  availableSiege:0}),false);
 assert.equal(preserveAI36Assault({...standing,visibleGunPosition:true,
  availableSiege:1}),true,'real live artillery can sustain a siege');
});

test('healthy paid ground reinforcement joins a real firefight before wasting a staging loop',()=>{
 const args={distance:415,hpFraction:.92,isGroundCombatant:true,
  frontInContact:true,frontSize:4,knownGunPresent:false};
 assert.equal(ai36JoinActiveFront(args),true);
 assert.equal(ai36JoinActiveFront({...args,frontInContact:false}),false);
 assert.equal(ai36JoinActiveFront({...args,knownGunPresent:true}),false);
 assert.equal(ai36JoinActiveFront({...args,distance:441}),false);
 assert.equal(ai36JoinActiveFront({...args,hpFraction:.1}),false);
 assert.equal(ai36JoinActiveFront({...args,isGroundCombatant:false}),false);
 assert.equal(ai36JoinActiveFront({...args,frontSize:1}),false);
 assert.equal(ai36JoinActiveFront({...args,distance:290,knownGunPresent:true,
  frontInContact:false}),true,'safe 330m join remains available');
});

const pos=(id,kind,x,y,hp=150)=>({id,kind,x,y,hp});
test('bomber chooses an isolated observed armored target when the highest-value visible cluster is unsafe',()=>{
 const tank=pos(1,'tank',100,100),wingTank=pos(2,'tank',160,105),
  rocket=pos(3,'rocket',140,120),lone=pos(4,'rover',970,200);
 const observed=[tank,wingTank,rocket,lone];
 const front={x:100,y:100};
 assert.equal(observedBomberSupportTarget(observed,front,1400)?.id,tank.id,
  'without a safety predicate original priority stays unchanged');
 const safe=observedBomberSupportTarget(observed,front,1400,
  target=>bomberCloseAirSupportAllowed(target,observed,[]));
 assert.equal(safe?.id,lone.id,
  'find actually valid CAS target instead of leaving a paid bomber idle');
 assert.equal(observedBomberSupportTarget(observed,front,200,
  target=>bomberCloseAirSupportAllowed(target,observed,[])),undefined);
});

test('two real allied tanks make a defended target safe to support, while fog never does',()=>{
 const tank=pos(1,'tank',100,100),rocket=pos(2,'rocket',145,102);
 const observed=[tank,rocket];
 const escorts=[pos(20,'tank',50,80),pos(21,'tank',40,70)];
 assert.equal(observedBomberSupportTarget(observed,{x:0,y:0},900,
  target=>bomberCloseAirSupportAllowed(target,observed,escorts))?.id,tank.id);
 assert.equal(observedBomberSupportTarget(observed,{x:0,y:0},900,
  target=>bomberCloseAirSupportAllowed(target,[],escorts)),undefined);
});

test('the new director gate is restricted to KI3.6 and uses the actual current assault roster',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/this\.ai36Enabled&&preserveAI36Assault/);
 assert.match(source,/this\.ai36Enabled&&ai36JoinActiveFront/);
 assert.match(source,/candidate=>this\.bomberStrikeSafe\(candidate\)/);
 assert.match(source,/recalled\.has\(u\.id\)/);
 assert.match(source,/c\.aborted\+\+/);
});

test('a same-sector HQ-to-turret switch keeps a healthy active assault in place',()=>{
 const input={sameSector:true,oldKind:'structure',newKind:'structure',
  objectiveDistance:420,observedObjective:true,activeAssault:true,
  livingAttackers:9,recentLosses:0};
 assert.equal(maintainAI36FrontOnRetarget(input),true);
 assert.equal(maintainAI36FrontOnRetarget({...input,
  oldKind:'capture'}),false,'a sector-capture mission is a separate type');
 assert.equal(maintainAI36FrontOnRetarget({...input,
  sameSector:false}),false);
 assert.equal(maintainAI36FrontOnRetarget({...input,
  observedObjective:false}),false,'never rely on a hidden live enemy');
 assert.equal(maintainAI36FrontOnRetarget({...input,
  livingAttackers:2}),false);
 assert.equal(maintainAI36FrontOnRetarget({...input,
  recentLosses:2}),false);
 assert.equal(maintainAI36FrontOnRetarget({...input,
  objectiveDistance:800}),false);
 assert.equal(maintainAI36FrontOnRetarget({...input,
  activeAssault:false}),false);
});

test('the AI3.6 planner preserves the real front and rally on local observed retargets',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/const keepRetarget=this\.ai36Enabled/);
 assert.match(source,/maintainAI36FrontOnRetarget\(/);
 assert.match(source,/if\(c\.aborted>aborted&&!keepRetarget\)/);
 assert.match(source,/if\(!keepRetarget\)s\.rally=null/);
});
