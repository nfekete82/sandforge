import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {CANYON_GEOLOGY,GEOLOGICAL_RINGS,buildGeologicalMesaSurface} from '../scripts/webgl-authentic-canyon-geology.js';
import {planDesertWaterways,desertWaterExclusion} from '../scripts/webgl-desert-water-plan.js';
import {planDesertLakeVegetation} from '../scripts/webgl-desert-lake-vegetation-plan.js';
import {planBurnedSedans} from '../scripts/webgl-burned-sedan-plan.js';

const maps=globalThis.SandforgeDesertMaps.maps;
const names=['desert-strike','broken-empire','burning-horizon','last-stronghold'];
test('all four canyon palettes are distinct, last stronghold darker gray',()=>{
 assert.deepEqual(Object.keys(CANYON_GEOLOGY),names);
 assert.equal(new Set(Object.values(CANYON_GEOLOGY).map(g=>g.base)).size,4);
 assert.ok(GEOLOGICAL_RINGS.length>=14,'stepped shelves need real density');
 const gray=CANYON_GEOLOGY['last-stronghold'];
 assert.match(gray.dark,/^#2e3338$/);
 assert.match(CANYON_GEOLOGY['burning-horizon'].base,/^#9b958c$/);
});

for(const map of maps)test(map.name+': natural high-resolution canyon remains a visual-only physical hull',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world,terrain=world.generated;
 const blocked=world.blocked.slice(),opaque=world.opaque.slice(),save=JSON.stringify(game.save());
 let tested=0;
 for(const [id,mesa] of (terrain.mesas??[]).entries()){
  if(id>=2)break;
  const peak=mesa.columns.reduce((s,c)=>s+c.height,0)/mesa.columns.length;
  const args={outline:mesa.outline,peak,heightAt:(x,z)=>world.terrainHeight(x,z),
   half:world.size/2,id,seed:map.seed,mapId:map.id};
  const a=buildGeologicalMesaSurface(args);
  assert.ok(a.triangles>mesa.outline.length*14,'sculpted mesa must not remain a coarse cloth sheet');
  assert.equal(a.perimeterPoints,mesa.outline.length*5);
  assert.equal(a.positions.length,a.colors.length);
  assert.equal(a.uv.length,a.positions.length/3*2);
  assert.ok(a.positions.every(Number.isFinite));
  assert.ok(a.colors.every(c=>Number.isFinite(c)&&c>=0&&c<=1));
  const b=buildGeologicalMesaSurface(args);
  assert.deepEqual(a,b,'rock shape must be deterministic across replays');
  const lite=buildGeologicalMesaSurface({...args,quality:'low'});
  assert.ok(lite.triangles<a.triangles,'Lite halves canyon geometry without gameplay changes');
  tested++;
 }
 assert.ok(tested>=1,map.id+' has at least one rock plateau');
 const lakes=planDesertWaterways({world,terrain,mapId:map.id,seed:map.seed});
 assert.equal(lakes.rivers.length,0,'ribbon rivers are removed from all desert maps');
 const plants=planDesertLakeVegetation({world,terrain,layout:lakes,mapId:map.id,seed:map.seed});
 if(lakes.lakes.length){
  assert.ok(plants.length>0,'every lagoon requires real trees or riparian plants');
  for(const p of plants){
   assert.ok(!desertWaterExclusion(p,lakes,{margin:p.kind==='palm'?16:p.kind==='shrub'?10:0}),
    'no plant within water or the entire wet shore');
   assert.ok(world.walkable(p,[],p.kind==='palm'?18:8));
  }
  assert.ok(new Set(plants.map(p=>p.kind)).size>=2,'more than one vegetation layer');
 }
 const cars=planBurnedSedans({world,terrain,mapId:map.id,seed:map.seed});
 assert.ok(cars.length>=2);
 assert.ok(cars.every(p=>p.scale>=.79&&p.scale<.97),'the wreck is smaller than before');
 assert.deepEqual(world.blocked,blocked,'no new vehicle obstacles');
 assert.deepEqual(world.opaque,opaque,'no new fog or canyon opacity changes');
 assert.equal(JSON.stringify(game.save()),save,'unchanged saves');
});

test('large canyon and small-rock PBR materials share authentic geological visual direction',()=>{
 const scene=readFileSync('scripts/webgl-preview.js','utf8');
 const ridge=readFileSync('scripts/webgl-landscape-network.js','utf8');
 assert.match(scene,/buildGeologicalMesaSurface/);
 assert.match(scene,/CANYON_GEOLOGY/);
 assert.match(ridge,/mapId=null/);
 assert.match(ridge,/CANYON_GEOLOGY\[mapId\]/);
 assert.match(ridge,/showOutcrops/);
 assert.match(scene,/physical-battlefield-rocks/);
 assert.match(ridge,/procedural-v3-eroded-sandstone/);
 assert.match(scene,/sharedStoneMaps/);
 assert.match(ridge,/sharedStoneMaps/);
 assert.match(scene,/createDesertLakeVegetation/);
 assert.match(scene,/lakeVegetation\?\.dispose\(\)/);
 assert.match(scene,/lakeVegetation\?\.update/);
 assert.match(scene,/waterLayout:plannedDesertWater/);
});
