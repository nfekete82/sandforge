import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mapLayout,campaignLayout,RULES} from '../dist/src/reborn/config.js';
import {UNITS,BUILDINGS,unitKinds} from '../dist/src/reborn/catalog.js';
import {globalCatalogAvailability} from '../scripts/webgl-global-catalog.js';

test('modern campaigns use 8/12/16 Bastions, with eight selected in both 3D menus',()=>{
 const html=readFileSync('webgl-preview.html','utf8');
 assert.match(html,/<select id="bastions"><option value="8" selected>8<\/option>/);
 assert.match(html,/<select id="sf3d-map-size"><option value="8" selected>Standard · 8 Bastionen<\/option>/);
 assert.doesNotMatch(html,/<option value="4">Klein · 4 Bastionen<\/option>/);
 for(const [version,count] of [[24,8],[25,12],[26,16]]){
  const layout=mapLayout(version);
  assert.equal(layout.columns*layout.rows,count);
  assert.deepEqual(campaignLayout(version,2026).starts.map(x=>x.length),[1,1]);
 }
});

test('home bastions yield 50, captured normal bastions 15-35, HQ +10 and energy core +10 per 10 seconds',()=>{
 assert.equal(RULES.incomeInterval,10);
 assert.equal(BUILDINGS.headquarters.income,10);
 assert.equal(BUILDINGS.generator.income,10);
 for(const version of [23,24,25,26]){
  const g=new Simulation(2026,version);
  const layout=campaignLayout(version,2026);
  assert.equal(g.territories.length,mapLayout(version).columns*mapLayout(version).rows);
  for(const owner of [0,1]){
   const home=g.territories[layout.headquarters[owner]];
   assert.equal(home.owner,owner);
   assert.equal(home.income,50);
   assert.equal(g.income(owner),60,'HQ plus owned home bastion');
   for(const neighborId of home.neighbors)
    if(!layout.headquarters.includes(neighborId))
     assert.equal(g.territories[neighborId].income,25);
   const neutral=g.territories.find(t=>t.owner===-1);
   assert.ok(neutral);
   assert.ok([15,25,35].includes(neutral.income));
   neutral.owner=owner;
   assert.equal(g.income(owner),60+neutral.income);
   neutral.owner=-1;
  }
  assert.deepEqual(g.supplyCaches,[],'old depots are never generated');
 }
});

test('retired truck cannot be produced or shown, factories still unlock ground vehicles',()=>{
 assert.ok(!unitKinds.includes('supply'));
 assert.deepEqual(UNITS.supply.producers,[]);
 const game=new Simulation(2026,24);
 const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 assert.equal(game.producer(0,'supply'),undefined);
 assert.equal(game.recruit(hq.id,'supply'),false);
 assert.equal(game.bases.some(b=>b.queueTypes.includes('supply')),false);
 assert.equal(globalCatalogAvailability(game).vehicles,false);
});

test('old saves refund deployed/queued trucks and safely discard stockpiles',()=>{
 const game=new Simulation(2026,24);
 const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const truck=game.spawn(0,{x:hq.x+220,y:hq.y+160},'supply');
 truck.supply={auto:true,phase:'to-hq',cacheId:0,cargo:45,clock:0};
 const save=game.save();
 save.supplyCaches=[{id:0,x:200,y:250,capacity:2250,remaining:2000,lastPickupAt:0,restockClock:0}];
 const savedHq=save.bases.find(b=>b.id===hq.id);
 savedHq.queue=[UNITS.supply.buildTime];savedHq.queueTypes=['supply'];
 savedHq.queueCosts=[UNITS.supply.cost];savedHq.production=0;
 const loaded=Simulation.load(save);
 assert.equal(loaded.units.some(u=>u.kind==='supply'),false);
 assert.equal(loaded.bases.some(b=>b.queueTypes.includes('supply')),false);
 assert.deepEqual(loaded.supplyCaches,[]);
 assert.equal(loaded.credits[0],save.credits[0]+UNITS.supply.cost*2);
 assert.equal('supplyCaches' in loaded.save(),false,'new saves do not retain old stockpile state');
 assert.ok(loaded.notices.some(n=>n.includes('erstattet')));
});

test('WebGL, catalog and build have no live supply controls, handlers or GLB files',()=>{
 const stage=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 const ai=readFileSync('src/reborn/army-economy.ts','utf8');
 assert.doesNotMatch(stage,/supplyCache|supply-auto|SupplyTruck|Nachschubtransporter/i);
 assert.doesNotMatch(portraits,/customSupplyTruckUrl|webgl-supply-custom/);
 assert.doesNotMatch(build,/generate-supply-pbr|cpSync\('scripts\/webgl-supply/);
 assert.doesNotMatch(ai,/recruit\(hq\.id,'supply'\)/);
 assert.equal(existsSync('src/assets/reborn/supply-custom/supply-0.glb'),false);
 assert.equal(existsSync('src/assets/reborn/supply-custom/supply-1.glb'),false);
 assert.equal(existsSync('scripts/webgl-supply-custom.js'),false);
 assert.equal(existsSync('scripts/webgl-supply-logistics.js'),false);
});
