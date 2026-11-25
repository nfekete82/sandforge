import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {planDesertWaterways,desertWaterExclusion} from '../scripts/webgl-desert-water-plan.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';
import {buildGeologicalMesaSurface,CANYON_GEOLOGY} from '../scripts/webgl-authentic-canyon-geology.js';

test('Bunker accepts a right-click base ray hit and filters allied living infantry',()=>{
 const ui=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(ui,/b\.kind==='bunker'&&b\.owner===0&&\s*b\.hp>0&&b\.buildRemaining<=0&&this\.bases\.get\(b\.id\)\?\.node\.visible/);
 assert.match(ui,/if\(event\.button===2[^\n]*\)\{[\s\S]*?const bunker=this\.bunkerAtPointer\(event\)/);
 assert.match(ui,/this\.selected\.has\(u\.id\)&&u\.owner===0&&\s*!u\.carrier&&u\.hp>0&&UNITS\[u\.kind\]\.group==='Infanterie'/);
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
test('Broken Empire has its own warm sandstone palette without changing mountain geometry',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/buildGeologicalMesaSurface/);
 assert.equal(CANYON_GEOLOGY['broken-empire'].base,'#aa8061');
 assert.equal(CANYON_GEOLOGY['broken-empire'].dark,'#654936');
 const outline=[{x:300,y:400},{x:550,y:360},{x:500,y:900}];
 const options={outline,peak:128,heightAt:()=>0,half:1000};
 const broken=buildGeologicalMesaSurface({...options,mapId:'broken-empire'});
 const strike=buildGeologicalMesaSurface({...options,mapId:'desert-strike'});
 assert.ok(broken.triangles>0);
 assert.deepEqual(broken.positions,strike.positions);
 assert.notDeepEqual(broken.colors,strike.colors);
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
