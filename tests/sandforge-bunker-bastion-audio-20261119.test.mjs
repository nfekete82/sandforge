import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {RULES} from '../dist/src/reborn/config.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {BUNKER_CAPACITY,bunkerCanBoard,bunkerGarrisonedUnits,
 validBunkerGarrisons} from '../dist/src/reborn/bunker-garrison.js';
import {BASTION_UPGRADE_COST,bastionEffectiveIncome,bastionUpgradable,
 bastionUpgradePaybackSeconds} from '../dist/src/reborn/bastion-upgrades.js';
import {WEAPON_SOUNDS} from '../dist/src/reborn/audio.js';

function arena(){
 const g=Simulation.campaign(824836862,24,'mixed',4);
 g.aiClock=-1e8;g.tactical.plan=()=>{};
 const p=g.world.nearest({x:g.world.size*.37,y:g.world.size*.37},
  g.obstacles(),[],undefined,100);
 assert.ok(p);
 const b={id:788888,owner:0,kind:'bunker',...p,hp:BUILDINGS.bunker.hp,
  queue:[],queueTypes:[],queueCosts:[],production:0,buildRemaining:0,
  cooldown:0,rally:null,radius:BUILDINGS.bunker.radius,territory:0,garrison:[]};
 g.bases.push(b);
 return {g,b};
}
function tick(g,n=50){for(let i=0;i<n;i++)g.step(RULES.tick);}
function enter(g,b,kinds){
 const members=kinds.map((k,i)=>g.spawn(0,{
  x:b.x+114+i*.2,y:b.y+3*i},k));
 const result=g.boardBunker(b.id,members.map(u=>u.id));
 tick(g,90);
 return {members,result};
}
test('Bunker catalog and WebGL PBR model are integrated without missing GLB assets',()=>{
 assert.equal(BUILDINGS.bunker.cost,650);
 assert.equal(BUILDINGS.bunker.hp,1500);
 assert.equal(BUNKER_CAPACITY,5);
 assert.equal(BUILDINGS.bunker.income,0);
 const model=readFileSync('scripts/webgl-strategic-buildings.js','utf8');
 const renderer=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(model,/createDefensiveBunker/);
 assert.match(model,/Bunker_Embrasure_/);
 assert.match(renderer,/data-bunker-passenger-id/);
 assert.match(renderer,/data-action="bunker-unload"/);
 assert.match(renderer,/boardBunker\(bunker.id,ids\)/);
});
test('Bunker can reserve at most five genuine paid infantry seats',()=>{
 const {g,b}=arena();
 const {members,result}=enter(g,b,['infantry','heavy','rocket','infantry','rocket','infantry']);
 assert.equal(result,5,'sixth soldier must not get a reserved slot');
 assert.equal(b.garrison.length,5);
 assert.equal(members.filter(u=>u.carrier===b.id).length,5);
 assert.equal(members[5].carrier,undefined);
 assert.ok(validBunkerGarrisons(g.bases,g.units));
 assert.equal(bunkerGarrisonedUnits(b,g.units).length,5);
});
test('Bunker occupants survive saving/loading with correct cost, upgrades and HP',()=>{
 const {g,b}=arena();
 const {members}=enter(g,b,['rocket','heavy']);
 members[0].hp=65;
 const restored=Simulation.load(g.save());
 const bunker=restored.bases.find(x=>x.id===b.id);
 assert.ok(bunker);
 assert.equal(bunker.garrison.length,2);
 assert.equal(restored.units.find(u=>u.id===members[0].id).hp,65);
 assert.equal(restored.units.find(u=>u.id===members[0].id).carrier,b.id);
 assert.ok(validBunkerGarrisons(restored.bases,restored.units));
});
test('Single and full evacuation respect actual free exterior landing spots',()=>{
 const {g,b}=arena();
 const {members}=enter(g,b,['infantry','heavy','rocket']);
 assert.equal(g.unloadBunker(b.id,members[1].id),1);
 assert.equal(members[1].carrier,undefined);
 assert.equal(b.garrison.length,2);
 assert.equal(g.unloadBunker(b.id),2);
 assert.equal(b.garrison.length,0);
 assert.ok(members.every(u=>u.hp>0&&!u.carrier));
});
test('Bunker destruction kills every soldier still inside (no free escape)',()=>{
 const {g,b}=arena();
 const {members}=enter(g,b,['infantry','heavy','rocket']);
 const enemy=g.spawn(1,{x:b.x+340,y:b.y},'tank');
 g.strike(enemy,b,999999);
 assert.equal(b.hp,0);
 assert.equal(b.garrison.length,0);
 assert.ok(members.every(u=>u.hp===0));
 tick(g,3);
 assert.ok(members.every(u=>!g.units.includes(u)));
});
test('Bunker fire comes only from surviving occupied infantry, not a free turret',()=>{
 const {g,b}=arena();
 tick(g,3);
 const target=g.spawn(1,{x:b.x+195,y:b.y+30},'heavy');
 g.updateVision();const original=target.hp;
 tick(g,90);
 const empty=target.hp;
 assert.equal(empty,original,'an empty bunker cannot deal damage');
 const {members}=enter(g,b,['infantry','heavy']);
 const engaged=target.hp;
 tick(g,120);
 assert.ok(target.hp<engaged||target.hp<=0,'live occupants fire at actual visible enemies');
 assert.ok(members.some(u=>u.cooldown>0||u.fire>0));
});
test('Paid tier-2 doubles only captured Bastion earnings; save/load and capture safety',()=>{
 const g=Simulation.campaign(41204,24,'mixed',4);
 const t=g.territories.find(t=>t.owner===-1&&
  !g.bases.some(b=>b.kind==='headquarters'&&b.territory===t.id));
 assert.ok(t);t.owner=0;
 g.credits[0]=4000;
 assert.equal(BASTION_UPGRADE_COST,750);
 assert.equal(bastionUpgradable(t,0,g.bases),true);
 const income=g.income(0),funds=g.credits[0];
 assert.equal(g.upgradeBastion(0,t.id),true);
 assert.equal(g.credits[0],funds-750);
 assert.equal(t.upgradeLevel,2);
 assert.equal(bastionEffectiveIncome(t),t.income*2);
 assert.equal(g.income(0),income+t.income);
 assert.equal(g.upgradeBastion(0,t.id),false,'no level-3 purchases');
 assert.ok(bastionUpgradePaybackSeconds(t)>=200);
 const loaded=Simulation.load(g.save());
 assert.equal(loaded.territories[t.id].upgradeLevel,2);
 assert.equal(loaded.income(0),g.income(0));
 const corrupt=g.save();corrupt.territories[t.id].upgradeLevel=3;
 assert.throws(()=>Simulation.load(corrupt),/beschädigt/);
 const enemy=loaded.territories[t.id];
 enemy.owner=1;enemy.upgradeLevel=1;
 assert.equal(bastionEffectiveIncome(enemy),enemy.income);
 const original=new Simulation(41204,24,false,false,'mixed',4);
 const home=original.territories.find(t=>original.bases.some(b=>
  b.kind==='headquarters'&&b.territory===t.id));
 assert.ok(home);
 assert.equal(original.upgradeBastion(home.owner,home.id),false,'home cannot be doubled');
});
test('Combat sounds contain distinct rocket ignition, MG and impact/explosion layers',()=>{
 assert.ok(WEAPON_SOUNDS.rocket.duration>WEAPON_SOUNDS.machinegun.duration*3);
 assert.ok(WEAPON_SOUNDS.rocket.low<WEAPON_SOUNDS.machinegun.low);
 const audio=readFileSync('src/reborn/audio.ts','utf8');
 for(const token of ['seenMissiles','seenBlasts','played.explosions',
  'lastImpactAt','lastExplosionAt','rocket','machinegun','lowpass','bandpass'])
  assert.ok(audio.includes(token));
});
