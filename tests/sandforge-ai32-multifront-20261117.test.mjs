import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {newBattle} from '../dist/src/reborn/battle-response.js';
import {decisiveContact,parallelFrontReady,frontierGuardPosts,
 localBastionDefenseMultiplier} from '../dist/src/reborn/ai32-doctrine.js';

const contact={own:150,enemy:100,visible:3,inRange:4,healthy:3,
 knownTowers:0,artillery:0};

test('3.2: a real 1.5:1 contact commits; numerical strength alone cannot cheat fog or turret safety',()=>{
 assert.equal(decisiveContact(contact),true);
 assert.equal(decisiveContact({...contact,own:149}),false);
 assert.equal(decisiveContact({...contact,visible:0}),false,'unseen opponent is not counted');
 assert.equal(decisiveContact({...contact,inRange:0}),false,'distant troop count alone is insufficient');
 assert.equal(decisiveContact({...contact,healthy:1}),false,'single wounded unit must not force a fight');
 assert.equal(decisiveContact({...contact,knownTowers:1}),false,'unsupported siege stays unsafe');
 assert.equal(decisiveContact({...contact,knownTowers:1,artillery:1,own:190}),true);
 assert.equal(decisiveContact({...contact,enemy:Infinity}),false);
});

const twoFront={mapVersion:24,time:110,phase:'attack',fighters:12,main:6,
 eligible:3,homeGuards:3,homePressure:false,recentLosses:0,recentFailures:0,
 emergency:false};

test('3.2: a real second front requires a paid home garrison and five main attackers',()=>{
 assert.equal(parallelFrontReady(twoFront),true);
 for(const overrides of [
  {mapVersion:23},{time:90},{phase:'gather'},{main:4},{eligible:1},
  {homeGuards:1},{fighters:9},{fighters:10,main:6,homeGuards:3},
  {homePressure:true},{recentLosses:2},{recentFailures:1},{emergency:true}
 ])assert.equal(parallelFrontReady({...twoFront,...overrides}),false,
  'unsafe or uneconomical split must remain disabled: '+JSON.stringify(overrides));
});

test('3.2: at least two sentries guard home while up to two defend separate frontier Bastions',()=>{
 assert.deepEqual([0,1,2,3,4,5,9].map(n=>frontierGuardPosts(n,8)),
  [0,0,1,1,2,2,2]);
 assert.equal(frontierGuardPosts(4,1),1);
 assert.equal(frontierGuardPosts(4,0),0);
 assert.equal(localBastionDefenseMultiplier(50,false),1.4);
 assert.equal(localBastionDefenseMultiplier(25,false),1.2);
 assert.equal(localBastionDefenseMultiplier(50,true),1.2,
  'a threatened production HQ retains emergency-defender priority');
});

test('3.2: early double-front detachment issues ordinary orders without taking credits or stealing HQ guards',()=>{
 const g=new Simulation(2026,24);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 g.world.blocked.fill(0);g.world.opaque.fill(0);g.world.components.fill(0);
 g.time=110;g.aiClock=1e8;g.tactical.state.phase='attack';
 g.tactical.state.battle=newBattle();
 g.tactical.state.losses=[];g.tactical.state.knownTurrets=[];
 const members=[];
 for(let i=0;i<12;i++){
  const unit=g.spawn(1,{x:home.x+180+i*25,y:home.y+130+i*13},
   i>=9?'rover':'infantry');
  members.push(unit);
 }
 g.tactical.state.group=members.slice(0,6).map(u=>u.id);
 const protectedIds=new Set(members.slice(0,3).map(u=>u.id));
 const next=g.territories.find(t=>t.owner===-1&&t.neighbors.some(n=>g.territories[n].owner===1));
 assert.ok(next);
 const oldCredits=[...g.credits],oldSize=g.units.length,oldOwned=g.territories.map(t=>t.owner);
 const assigned=g.tactical.secondaryPressure(members,{sector:next.id},home);
 assert.equal(assigned.size,2,'two, not an arbitrary percentage or extra spawned units');
 assert.ok([...assigned].every(id=>!protectedIds.has(id)));
 assert.ok([...assigned].every(id=>!g.tactical.state.group.includes(id)));
 assert.ok([...assigned].every(id=>g.units.find(u=>u.id===id)?.orders[0]?.kind==='attackMove'));
 assert.deepEqual(g.credits,oldCredits);
 assert.equal(g.units.length,oldSize);
 assert.deepEqual(g.territories.map(t=>t.owner),oldOwned);
});

test('3.2: normal 8-Bastion simulation uses no synthetic paid units or AI-income bonuses',()=>{
 const g=new Simulation(2026,24);
 const before=g.credits.slice(),beforeUnits=g.units.length;
 assert.equal(g.tactical.doctrineMode,'intelligent');
 assert.equal(g.territories.length,8);
 assert.equal(g.credits[1],before[1]);
 assert.equal(g.units.length,beforeUnits);
 assert.equal(UNITS.supply.producers.length,0,'retired cargo transport stays removed');
});
