import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {
 ai37FortificationChoice,ai37GarrisonQuota,
 ai37BastionDefenseValue,ai37UpgradeScore
} from '../dist/src/reborn/ai37-fortification-doctrine.js';

const economy={
 time:135,credits:3000,income:85,completedHeadquarters:true,
 completedBarracks:true,builders:1,activeInfantry:8,
 mobileFighters:11,ownedBastions:3,bunkers:0,turrets:0,underAttack:false
};

test('KI 3.7 builds a paid bunker before a second defensive turret',()=>{
 assert.equal(ai37FortificationChoice(economy),'bunker');
 assert.equal(ai37FortificationChoice({...economy,credits:849}),null);
 assert.equal(ai37FortificationChoice({...economy,builders:0}),null);
 assert.equal(ai37FortificationChoice({...economy,ownedBastions:1}),null);
 assert.equal(ai37FortificationChoice({...economy,underAttack:true}),null);
 assert.equal(ai37FortificationChoice({...economy,completedBarracks:false}),null);
 assert.equal(ai37FortificationChoice({...economy,bunkers:1}),null);
 assert.equal(ai37FortificationChoice({...economy,bunkers:1,time:260}),'turret');
 assert.equal(ai37FortificationChoice({...economy,bunkers:1,turrets:2,time:350,
  credits:3300,income:110,mobileFighters:15}),'bunker');
});

test('AI garrison cannot consume a small army; rockets and heavy guards remain paid',()=>{
 assert.equal(ai37GarrisonQuota({
  activeInfantry:9,fieldFighters:6,bunkerCount:1,homeThreat:false,frontlineOrders:3}),0);
 assert.equal(ai37GarrisonQuota({
  activeInfantry:8,fieldFighters:11,bunkerCount:1,homeThreat:false,frontlineOrders:4}),3);
 assert.equal(ai37GarrisonQuota({
  activeInfantry:14,fieldFighters:18,bunkerCount:2,homeThreat:false,frontlineOrders:8}),4);
 assert.equal(ai37GarrisonQuota({
  activeInfantry:2,fieldFighters:18,bunkerCount:1,homeThreat:true,frontlineOrders:0}),0);
 assert.equal(ai37GarrisonQuota({
  activeInfantry:14,fieldFighters:18,bunkerCount:0,homeThreat:false,frontlineOrders:0}),0);
});

test('defense focuses actually contested high-value upgraded sectors',()=>{
 const plain={income:25,upgradeLevel:1,visibleRaiders:0,
  contestProgress:0,enemyAdjacent:false};
 const upgraded={...plain,upgradeLevel:2};
 assert.ok(ai37BastionDefenseValue(upgraded)>ai37BastionDefenseValue(plain)+250);
 assert.ok(ai37BastionDefenseValue({...plain,contestProgress:4})>
  ai37BastionDefenseValue(upgraded));
 assert.equal(ai37UpgradeScore({income:35,enemyAdjacent:false,
  visibleRaiders:0,contested:false,alreadyUpgraded:false}),350);
 assert.equal(ai37UpgradeScore({income:35,enemyAdjacent:true,
  visibleRaiders:0,contested:false,alreadyUpgraded:false}),165);
 assert.equal(ai37UpgradeScore({income:35,enemyAdjacent:false,
  visibleRaiders:1,contested:false,alreadyUpgraded:false}),-Infinity);
});

test('KI 3.7 spends credits for a real build at an explored safe HQ',()=>{
 const g=new Simulation(20261120,24);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 g.time=160;g.credits[1]=5000;
 const barracks={...home,id:8882,kind:'barracks',
  x:home.x+420,y:home.y+320,
  hp:BUILDINGS.barracks.hp,radius:BUILDINGS.barracks.radius,
  queue:[],queueTypes:[],buildRemaining:0};
 g.bases.push(barracks);
 // New KI 3.8 intentionally waits for the full paid ground-production core.
 const factory={...barracks,id:8884,kind:'factory',
  x:home.x-420,y:home.y+300,
  hp:BUILDINGS.factory.hp,radius:BUILDINGS.factory.radius,
  queue:[],queueTypes:[],buildRemaining:0};
 g.bases.push(factory);
 const territory=g.territories.find(t=>t.owner===-1);
 assert.ok(territory);territory.owner=1;
 for(let i=0;i<9;i++)g.spawn(1,{x:home.x+(i%3)*30+155,
  y:home.y+145+Math.floor(i/3)*30},i%3===0?'heavy':'infantry');
 g.updateVision();
 const originalCredits=g.credits[1],originalUnits=g.units.length;
 g.planStrategicAi();
 const bunkers=g.bases.filter(b=>b.owner===1&&b.kind==='bunker');
 assert.equal(bunkers.length,1,'one paid bunker should be ordered near the HQ');
 assert.equal(g.credits[1],originalCredits-BUILDINGS.bunker.cost);
 assert.equal(g.units.length,originalUnits,'no free garrison troops');
 assert.ok(bunkers[0].buildRemaining>0,'engineer must construct it normally');
 assert.ok(g.units.some(u=>u.owner===1&&u.kind==='engineer'&&
  u.orders[0]?.kind==='build'&&u.orders[0].target===bunkers[0].id));
 g.planStrategicAi();
 assert.equal(g.bases.filter(b=>b.owner===1&&b.kind==='bunker').length,1,
  'cannot double-purchase the same bunker while construction is underway');
});

test('KI bunker staffing uses ordinary boarding orders and preserves attack squad',()=>{
 const g=new Simulation(824836862,24);g.time=155;
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const site=g.world.nearest({x:home.x+205,y:home.y+90},g.obstacles(),[],undefined,80);
 assert.ok(site);
 const bunker={...home,id:8883,kind:'bunker',...site,
  hp:BUILDINGS.bunker.hp,radius:BUILDINGS.bunker.radius,
  queue:[],queueTypes:[],buildRemaining:0,garrison:[]};
 g.bases.push(bunker);
 const troops=Array.from({length:12},(_,i)=>g.spawn(1,{
  x:bunker.x+105+(i%3)*8,y:bunker.y+28+Math.floor(i/3)*7},
  i%4===0?'rocket':i%4===1?'heavy':'infantry'));
 g.tactical.state.group=troops.slice(0,4).map(u=>u.id);
 g.updateVision();
 const originally=g.units.length,credits=g.credits[1];
 const reserved=g.tactical.staffBunkers(g.units.filter(u=>u.owner===1&&
  u.hp>0&&!u.carrier),home);
 assert.ok(reserved.size>=1&&reserved.size<=4);
 assert.ok([...reserved].every(id=>!g.tactical.state.group.includes(id)));
 assert.ok([...reserved].every(id=>g.units.find(u=>u.id===id)?.orders[0]?.kind==='garrison'));
 assert.equal(g.units.length,originally,'no free units');
 assert.equal(g.credits[1],credits,'boarding costs no fabricated credits');
 const again=g.tactical.staffBunkers(g.units.filter(u=>u.owner===1&&
  u.hp>0&&!u.carrier),home);
 assert.equal(again.size,reserved.size,'already reserved seats should not be duplicated');
});

test('HUD visibly explains why the base Bastion cannot be upgraded',()=>{
 const js=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.ok(js.includes('HEIMAT · FEST'));
 assert.ok(js.includes('Die Startbastion kann nicht aufgerüstet werden.'));
 assert.ok(js.includes("upgrade.hidden=t.owner!==0"));
 assert.ok(js.includes('data-upgrade-bastion'));
});


test('KI learns real bunker weapon range only after detecting an enemy bunker',()=>{
 const g=new Simulation(824836862,24);
 const home=g.bases.find(b=>b.owner===1&&b.kind==='headquarters');
 assert.ok(home);
 const hidden={...home,id:8890,owner:0,kind:'bunker',
  x:g.world.size-home.x,y:g.world.size-home.y,
  hp:BUILDINGS.bunker.hp,radius:BUILDINGS.bunker.radius,
  buildRemaining:0,garrison:[]};
 g.bases.push(hidden);
 g.updateVision();g.tactical.observe();
 assert.equal(g.tactical.state.knownTurrets.some(t=>t.id===hidden.id),false,
  'no omniscient bunker detection behind fog');
 const scout=g.spawn(1,{x:hidden.x+100,y:hidden.y+50},'infantry');
 g.updateVision();
 assert.equal(g.canSee(1,hidden),true,'scout genuinely discovers the bunker');
 g.tactical.observe();
 const intel=g.tactical.state.knownTurrets.find(t=>t.id===hidden.id);
 assert.ok(intel,'observed bunker joins real fixed-defense intelligence');
 assert.equal(intel.range,390,'Bunker gets its true 390-unit range, not turret range');
 g.bases=g.bases.filter(b=>b.id!==hidden.id);
 g.updateVision();g.tactical.observe();
 assert.equal(g.tactical.state.knownTurrets.some(t=>t.id===hidden.id),false,
  'destroyed bunker does not leave a permanent invisible danger zone');
});
