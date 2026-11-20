import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {planDesertWaterways,desertWaterExclusion} from '../scripts/webgl-desert-water-plan.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';

test('Bunker accepts a right-click base ray hit and filters allied living infantry',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(ui,/hit\?\.type==='base'&&hit\.entity\.kind==='bunker'/);
 assert.match(ui,/hit\.entity\.owner===0&&hit\.entity\.hp>0/);
 assert.match(ui,/!u\.carrier&&u\.hp>0&&UNITS\[u\.kind\]\.group==='Infanterie'/);
 assert.match(ui,/this\.game\.boardBunker\(bunker\.id,ids\)/);
 assert.doesNotMatch(ui,/hit\?\.type==='building'&&hit\.entity\.kind==='bunker'/);
});
test('All four desert maps suppress decorative FoW glows, NOT true visibility',()=>{
 const a=readFileSync('scripts/webgl-atmosphere-3d.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/showFrontierClouds:!\(desertRegion&&spacious\)/);
 assert.match(a,/if\(!this\.enabled\|\|!this\.showFrontierClouds\)/);
 assert.match(a,/this\.fogMesh\.count=0;this\.metrics\.frontier=0/);
 assert.match(preview,/battlefield\.fogAtmosphere=atmosphere/);
 assert.match(preview,/atmosphere\.setFogEnabled\(battlefield\.fogEnabled\)/);
});
test('Broken Empire has its own charcoal/red slate mountain palette without touching collisions',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/brokenEmpireRedSlate=desertRegion\?\.id==='broken-empire'/);
 assert.match(preview,/#855653/);
 assert.match(preview,/#39333b/);
 assert.match(preview,/applyRockMineralVeins\(mat/);
 assert.match(preview,/mesh\.name='physical-battlefield-rocks'/);
 assert.match(preview,/const geometry=new THREE\.BufferGeometry\(\)/);
});
test('Planted PBR cacti and Joshua trees never overlap lake, river or wet-bank geometry',()=>{
 const maps=globalThis.SandforgeDesertMaps.maps;
 for(const map of maps){
  const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
  const world=game.world,terrain=world.generated;
  const plan=planDesertWaterways({world,terrain,mapId:map.id,seed:map.seed});
  const p=planDesertEcoregion({world,terrain,mapId:map.id,seed:map.seed,waterLayout:plan});
  assert.ok(p.every(o=>!desertWaterExclusion(o,plan,{margin:o.kind==='sandstone'?26:49})),
   map.id+': a real GLB is on water or wet bank');
  if(map.id==='broken-empire'){
   assert.ok(plan.lakes.length>=1,'the Sonoran map has at least one lagoon');
   assert.ok(p.some(o=>o.kind==='saguaro'),'the Sonoran map keeps real 3D cacti');
   for(const lake of plan.lakes){
    assert.equal(desertWaterExclusion(lake,plan),true);
    assert.equal(desertWaterExclusion({x:lake.x+lake.radius*4,y:lake.y},plan),false);
   }
  }
 }
});
