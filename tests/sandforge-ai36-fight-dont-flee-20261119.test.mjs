import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {unitSpec} from '../dist/src/reborn/catalog.js';
import {
 fightInsteadOfFleeing,retreatCorridorSafe
} from '../dist/src/reborn/battle-response.js';

const contact={
 continuing:true,visible:4,inRange:3,healthy:3,
 own:38,enemy:70,knownTowers:0,escapeSafe:false
};

test('KI3.6 holds a supported front even when badly outnumbered',()=>{
 assert.equal(fightInsteadOfFleeing(contact),true);
 assert.equal(fightInsteadOfFleeing({...contact,escapeSafe:true}),true,
  'normal 1:2 attack should not cause retreat');
 assert.equal(fightInsteadOfFleeing({...contact,own:18,enemy:70,escapeSafe:true}),true,
  'nearly 1:4 fighting power still does not auto-retreat');
 assert.equal(fightInsteadOfFleeing({...contact,own:16,enemy:70,escapeSafe:false}),true,
  'an exposed retreat gives enemy free shots');
});

test('retreat is rare: only extreme disadvantage with a real safe route',()=>{
 assert.equal(fightInsteadOfFleeing({...contact,own:8,enemy:65,escapeSafe:true}),false,
  'safe withdrawal is an option at a genuinely hopeless 1:8 fight');
 assert.equal(fightInsteadOfFleeing({...contact,healthy:1,own:30,enemy:70,escapeSafe:true}),false,
  'isolated survivor may withdraw');
 assert.equal(fightInsteadOfFleeing({...contact,healthy:1,own:30,enemy:70,escapeSafe:false}),true,
  'even a survivor should not turn into enemy guns');
 assert.equal(fightInsteadOfFleeing({...contact,knownTowers:1,healthy:2,own:20,enemy:35,escapeSafe:true}),false,
  'unsupported troops should not charge a known turret');
 assert.equal(fightInsteadOfFleeing({...contact,visible:0}),false);
 assert.equal(fightInsteadOfFleeing({...contact,continuing:false}),false);
});

test('retreat corridor is measured against observed guns and real route geometry',()=>{
 const start={x:1000,y:1500},threats=[{x:1070,y:1500,range:170}];
 const safe=[{x:780,y:1500},{x:650,y:1500}];
 const exposed=[{x:1150,y:1500},{x:1300,y:1500}];
 assert.equal(retreatCorridorSafe(start,safe,threats),true);
 assert.equal(retreatCorridorSafe(start,exposed,threats),false);
 assert.equal(retreatCorridorSafe(start,[],threats),false);
 assert.equal(retreatCorridorSafe(start,safe,[]),true);
});

function combatScenario(ai36='coordinated'){
 const g=new Simulation(20261119,24);
 g.world.blocked.fill(0);
 g.world.opaque.fill(0);
 g.world.cliffIds.fill(-1);
 g.world.components.fill(0);
 g.units=g.units.filter(u=>u.owner===1);
 g.tactical.ai33Mode='adaptive';
 g.tactical.ai35Mode='control';
 g.tactical.ai36Mode=ai36;
 g.visible[1].fill(1);
 g.explored[1].fill(1);
 const tank=g.spawn(1,{x:1500,y:1500},'tank');
 const screen=g.spawn(1,{x:1515,y:1525},'heavy');
 const enemy=[
  g.spawn(0,{x:1600,y:1500},'tank'),
  g.spawn(0,{x:1600,y:1540},'tank'),
  g.spawn(0,{x:1590,y:1590},'tank')
 ];
 g.updateVision();
 g.tactical.state.group=[tank.id,screen.id];
 g.tactical.state.phase='attack';
 g.tactical.state.target=g.territories.find(t=>t.owner!==1)?.id??0;
 g.tactical.state.launchSize=2;
 g.time=180;
 tank.hp=unitSpec(tank).hp*.15;
 tank.defendUntil=200;
 screen.defendUntil=200;
 return {g,tank,screen,enemy};
}

test('one wounded tank does not pull its KI3.6 supporting screen backwards',()=>{
 const {g,tank,screen}=combatScenario();
 const originalGroup=[...g.tactical.state.group];
 const orders=new Map(g.units.map(u=>[u.id,JSON.stringify(u.orders)]));
 const startingCredits=[...g.credits];
 g.tactical.underTowerFire(tank);
 assert.deepEqual(g.tactical.state.group,originalGroup);
 assert.deepEqual(g.tactical.state.battle?.withdrawals??[],[]);
 assert.equal(JSON.stringify(screen.orders),orders.get(screen.id));
 assert.equal(JSON.stringify(tank.orders),orders.get(tank.id));
 assert.deepEqual(g.credits,startingCredits);
});

test('KI3.6 changes only RED tactical decisions, not save fields or old map behavior',()=>{
 const file=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(file,/if\(this\.ai36Enabled&&\(supported/);
 assert.match(file,/if\(\(holdLine\|\|standGround\)\&\&/);
 assert.match(file,/if\(this\.ai36Enabled&&s\.group\.includes/);
 assert.match(file,/rankTerrainRecaptureSquad\(/);
 const {g}=combatScenario('off');
 assert.equal(g.tactical.ai36Mode,'off');
 assert.equal(JSON.stringify(g.save()).includes('standGround'),false);
 assert.equal(JSON.stringify(g.save()).includes('retreatSafe'),false);
});
