import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {CANYON_GEOLOGY,GEOLOGICAL_RINGS,buildGeologicalMesaSurface} from '../scripts/webgl-authentic-canyon-geology.js';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
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

test('fractured legacy mesa geometry has no sunken flat-colored polygon skirt',()=>{
 const outline=[
  {x:1300,y:1300},{x:1450,y:1260},{x:1640,y:1350},
  {x:1630,y:1530},{x:1490,y:1610},{x:1280,y:1530}
 ];
 const args={outline,peak:175,heightAt:()=>0,half:3100,id:2,
  seed:2026,mapId:'last-stronghold'};
 const a=buildGeologicalMesaSurface(args);
 const b=buildGeologicalMesaSurface(args);
 assert.deepEqual(a,b);
 assert.ok(a.triangles>1000);
 assert.equal(a.perimeterPoints,outline.length*5);
 assert.equal(a.positions.length,a.colors.length);
 assert.equal(a.uv.length,a.positions.length/3*2);
 assert.ok(a.positions.every(Number.isFinite));
 assert.ok(a.colors.every(v=>v>=0&&v<=1&&Number.isFinite(v)));
 assert.ok(Math.min(...a.positions.filter((_,i)=>i%3===1))>=.25,
  'the entire rock base meets the real terrain, no 80%-deep cliff skirt');
 const low=buildGeologicalMesaSurface({...args,quality:'low'});
 assert.ok(low.triangles<a.triangles);
});
for(const map of maps)test(map.name+': canyons, dry planted lagoons and small wrecks do not alter navigation',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world,terrain=world.generated;
 const blocked=world.blocked.slice(),opaque=world.opaque.slice(),save=JSON.stringify(game.save());
 // New fixed desert maps use RIDGES rather than the old mesa polygons.
 // Test what Three.js actually renders instead of asserting absent mesas.
 const scene=new THREE.Scene();
 const painted=createLandscapeMeshes({
  scene,size:world.size,heightAt:(x,z)=>world.terrainHeight(x,z),
  roads:terrain.roads??[],ridges:terrain.ridges??[],biome:'desert',
  mapId:map.id,lowQuality:true,showOutcrops:true
 });
 const hasRidges=(terrain.ridges??[]).some(r=>r.spine?.length>=2);
 const ridge=painted.find(m=>m.name==='procedural-v3-eroded-sandstone');
 if(hasRidges){
  assert.ok(ridge,'a canyon ridge must be drawn as real 3D geology');
  assert.ok(ridge.geometry.getAttribute('position').count>50);
  assert.ok(ridge.geometry.getAttribute('color').count>50);
  assert.ok(ridge.material.map?.isTexture&&ridge.material.normalMap?.isTexture);
 }
 assert.ok(painted.every(mesh=>mesh.userData.visualOnly===true));
 for(const mesh of painted){
  mesh.geometry.dispose();mesh.material.dispose();
 }
 const lakes=planDesertWaterways({world,terrain,mapId:map.id,seed:map.seed});
 assert.equal(lakes.rivers.length,0,'ribbon rivers are removed from all desert maps');
 const plants=planDesertLakeVegetation({world,terrain,layout:lakes,mapId:map.id,seed:map.seed});
 if(lakes.lakes.length){
  assert.ok(plants.length>0,'every water landscape requires vegetation');
  for(const p of plants){
   assert.ok(!desertWaterExclusion(p,lakes,{margin:p.kind==='palm'?16:p.kind==='shrub'?10:0}),
    'no plants within water or the wet shore');
   assert.ok(world.walkable(p,[],p.kind==='palm'?18:8));
  }
  assert.ok(new Set(plants.map(p=>p.kind)).size>=2,'water banks must feel natural');
 }
 const cars=planBurnedSedans({world,terrain,mapId:map.id,seed:map.seed});
 assert.ok(cars.length>=2);
 assert.ok(cars.every(p=>p.scale>=.79&&p.scale<.97),'wrecks are proportionally smaller');
 assert.deepEqual(world.blocked,blocked,'no new vehicle obstacles');
 assert.deepEqual(world.opaque,opaque,'no new fog opacity blockers');
 assert.equal(JSON.stringify(game.save()),save,'no new saved state');
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
