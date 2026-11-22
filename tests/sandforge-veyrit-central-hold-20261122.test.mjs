import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {campaignLayout, distance} from '../dist/src/reborn/config.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {advanceCentralHold,CENTRAL_HOLD_SECONDS} from '../dist/src/reborn/central-bastion.js';
import {advanceVeyrit,VEYRIT_CARGO_CAPACITY} from '../dist/src/reborn/veyrit.js';

const create=(seed=20261122)=>new Simulation(seed,24,false,false,'oasis',10);

test('central objective: middle neutral Bastion is real, unique and never the HQ',()=>{
 const a=create(),b=create();
 const t=a.territories[a.centralBastionId];
 assert.ok(t);
 assert.equal(t.name,'Zentralbastion');
 assert.equal(t.owner,-1);
 assert.ok(!campaignLayout(a.world.mapVersion,a.seed).headquarters.includes(t.id));
 assert.deepEqual(a.territories.map(t=>t.point),b.territories.map(t=>t.point));
 assert.deepEqual(t.point,{x:a.world.size/2,y:a.world.size/2},'single Bastion exactly in the map center');
 assert.equal(a.territories.filter(t=>t.isBastion).length,1);
 assert.equal(a.territories.filter(t=>t.isBastion===false).length,a.territories.length-1);
 assert.equal(new Simulation().centralBastionId,null,'classic maps unchanged');
});

test('central objective: 900 simulated seconds, pause, contest, reset on loss',()=>{
 assert.equal(CENTRAL_HOLD_SECONDS,900);
 assert.deepEqual(advanceCentralHold({owner:0,seconds:899.5},0,false,.5),{owner:0,seconds:900});
 assert.deepEqual(advanceCentralHold({owner:0,seconds:430},1,false,30),{owner:1,seconds:0});
 assert.deepEqual(advanceCentralHold({owner:0,seconds:430},0,true,12),{owner:0,seconds:430});
 const g=create(2525),t=g.territories[g.centralBastionId];
 t.owner=0;t.capturing=-1;t.progress=0;
 g.centralHold={owner:0,seconds:899.95};
 g.step();
 assert.equal(g.status,'victory');
 const restored=Simulation.load(g.save());
 assert.equal(restored.status,'victory');
 assert.ok(restored.centralHold.seconds>=900);
});

test('central objective: seconds do not advance when enemy contests and restart after capture',()=>{
 const g=create(333),t=g.territories[g.centralBastionId];
 t.owner=0;t.capturing=-1;g.centralHold={owner:0,seconds:342};
 const red=g.units.find(u=>u.owner===1&&u.kind==='infantry');
 red.x=t.point.x;red.y=t.point.y;red.orders=[];
 g.step();
 assert.equal(g.centralHold.seconds,342,'enemy inside capture zone blocks hold clock');
 t.owner=1;t.capturing=-1;
 g.step();
 assert.equal(g.centralHold.owner,1);
 assert.equal(g.centralHold.seconds,0);
 assert.equal(Simulation.load(g.save()).centralHold.seconds,0);
});

test('Veyrit: former Bastion locations become large seeded turquoise mineral fields and survive saves',()=>{
 const g=create(20261122);
 assert.ok(g.veyritFields.length>=8,'broad deposits replace most former Bastions');
 assert.ok(g.veyritFields.length<=g.territories.length-1);
 assert.ok(g.veyritFields.every(f=>f.radius>=180&&f.radius<240));
 assert.ok(g.veyritFields.every(f=>f.id!==g.centralBastionId));
 assert.ok(g.veyritFields.every(f=>g.world.walkable(f)&&f.amount===f.capacity));
 assert.deepEqual(g.veyritFields,create(20261122).veyritFields);
 g.veyritFields[0].amount=1333.5;
 assert.equal(Simulation.load(g.save()).veyritFields[0].amount,1333.5);
 assert.equal(new Simulation().veyritFields.length,0,'classic world has no deposits');
});

test('Veyrit: only real cargo delivered at a completed own refinery creates credits',()=>{
 const g=create(979),hq=g.bases.find(b=>b.owner===0);
 const refinery={...hq,id:4411,kind:'refinery',hp:BUILDINGS.refinery.hp,
  radius:BUILDINGS.refinery.radius,buildRemaining:0,queue:[],queueTypes:[],rally:null};
 g.bases.push(refinery);
 const u=g.spawn(0,{x:refinery.x+80,y:refinery.y},'harvester');
 const start=g.credits[0];
 u.harvestCargo=VEYRIT_CARGO_CAPACITY;
 u.harvestMode='return';
 advanceVeyrit(g,.05);
 assert.equal(g.credits[0]-start,VEYRIT_CARGO_CAPACITY);
 assert.equal(u.harvestCargo,0);
 u.harvestCargo=VEYRIT_CARGO_CAPACITY;u.harvestMode='return';
 refinery.buildRemaining=5;
 advanceVeyrit(g,.05);
 assert.equal(g.credits[0]-start,VEYRIT_CARGO_CAPACITY,'unfinished refinery pays nothing');
});

test('Veyrit: fields regenerate, minable stock and vehicle costs remain real',()=>{
 const g=create(121),f=g.veyritFields[0];
 assert.ok(UNITS.harvester.cost>0&&BUILDINGS.refinery.cost>0);
 f.amount=0;advanceVeyrit(g,1);
 assert.ok(f.amount>0&&f.amount<4);
 f.amount=170;
 const u=g.spawn(0,{x:f.x,y:f.y},'harvester');
 u.harvestMode='mine';u.harvestField=f.id;
 const refinery=g.bases.find(b=>b.owner===0);
 // No finished refinery => physical harvesting cannot start.
 const original=f.amount;advanceVeyrit(g,1);
 assert.ok(f.amount>original);
 assert.equal(u.harvestCargo??0,0);
});

test('Refinery exclusively builds harvesters; factory keeps military vehicles',()=>{
 assert.deepEqual(UNITS.harvester.producers,['refinery']);
 assert.equal(UNITS.tank.producers.includes('factory'),true);
 const g=create(8071),factory=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const refinery={...factory,id:4422,kind:'refinery',hp:BUILDINGS.refinery.hp,
  radius:BUILDINGS.refinery.radius,buildRemaining:0,queue:[],queueTypes:[],rally:null};
 const vehicleFactory={...factory,id:4423,kind:'factory',hp:BUILDINGS.factory.hp,
  radius:BUILDINGS.factory.radius,buildRemaining:0,queue:[],queueTypes:[],rally:null};
 g.bases.push(refinery,vehicleFactory);
 assert.equal(g.recruit(vehicleFactory.id,'harvester'),false);
 assert.equal(g.recruit(refinery.id,'harvester'),true);
 assert.deepEqual(refinery.queueTypes,['harvester']);
 assert.equal(g.recruit(refinery.id,'tank'),false);
});

test('Modern economy: only central Bastion pays passive Bastion income',()=>{
 const g=create(2123),t=g.territories[g.centralBastionId];
 assert.equal(g.territories.filter(x=>x.isBastion).length,1);
 const before=g.income(0),other=g.territories.find(x=>x.id!==t.id&&x.owner!==0);
 other.owner=0;
 assert.equal(g.income(0),before,'old Bastion sector ownership cannot create credits');
 const prev=g.income(0);t.owner=0;
 assert.ok(g.income(0)>prev,'actual central objective retains income');
});

test('WebGL assets, HUD and build graph keep 3D Veyrit and central timer connected',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(build,/webgl-veyrit\.js/);
 assert.match(scene,/createVeyritFieldVisuals/);
 assert.match(scene,/createVeyritHarvester/);
 assert.match(scene,/Central_15_Minute_Objective_Ring/);
 assert.match(scene,/sf-central-clock/);
 assert.match(hud,/id="sf-central-clock"/);
 assert.match(hud,/id="sf-veyrit"/);
 assert.match(portraits,/createVeyritRefinery/);
});
