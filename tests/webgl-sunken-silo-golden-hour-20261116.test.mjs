import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {DESERT_GOLDEN_HOUR,desertGoldenHourEnabled}
 from '../scripts/webgl-golden-hour.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('PBR missile silo is a low recessed bunker with only the upper rocket above the hatch',()=>{
 for(const owner of [0,1]){
  const model=createStrategicBuilding('silo',owner);
  const well=model.getObjectByName('Silo_RecessedLaunchWell');
  const lip=model.getObjectByName('Silo_LaunchRim');
  const body=model.getObjectByName('Silo_RocketBody');
  const nose=model.getObjectByName('Silo_RocketNose');
  const deck=model.getObjectByName('Silo_ExcavatedConcreteDeck');
  const interior=model.getObjectByName('Silo_InnerShaftWall');
  assert.ok(well?.isMesh&&lip?.isMesh&&body?.isMesh&&nose?.isMesh);
  assert.ok(deck?.isMesh&&interior?.isMesh,'launch hole must have real cutout and interior walls');
  assert.equal(deck.geometry.type,'ExtrudeGeometry');
  assert.equal(deck.geometry.parameters.shapes.holes.length,1,
   'concrete foundation is actually missing material in the missile shaft');
  assert.equal(interior.material.side,THREE.BackSide,'view the shaft from INSIDE');
  assert.equal(model.getObjectByName('Silo_RocketStageSeam')?.isMesh,true);
  assert.ok(lip.position.y<11,'hatch ring sits barely above the desert ground');
  assert.ok(well.position.y<lip.position.y-6,'dark shaft floor is visibly lower');
  assert.ok(body.position.y<lip.position.y+5,'only upper stage rises from the hole');
  assert.ok(nose.position.y<45&&nose.position.y>lip.position.y+15,
   'missile cone is short and visible, not a tall launch tower');
  assert.equal(body.position.x,well.position.x,'rocket is centered in its shaft');
  assert.equal(nose.position.x,well.position.x);
  const bb=new THREE.Box3().setFromObject(model);
  assert.ok(bb.max.y<80,'missile should show only the nose above the low bunker');
  const painted=[];
  model.traverse(o=>{if(o.isMesh&&o.material?.userData?.sandforgeColorMapCamo)
   painted.push(o)});
  assert.ok(painted.some(m=>m.material.name==='SF_base'));
  assert.ok(painted.some(m=>m.material.name==='SF_armor'));
  assert.ok(model.children.filter(o=>o.isMesh).length<=24,
   'existing static PBR batching keeps the graphics inexpensive');
 }
 assert.equal(BUILDINGS.silo.cost,5000);
 assert.equal(BUILDINGS.silo.buildTime,100);
 assert.equal(BUILDINGS.silo.radius,91);
});

test('silo shares the slim military barbed-wire fence and clears its supply pallets',()=>{
 const yard=createBuildingYard('silo',BUILDINGS.silo.width);
 const perimeter=yard.getObjectByName('BasePerimeter_silo');
 const cache=perimeter?.getObjectByName('BaseSupplyCache');
 const bounds=perimeter?.userData?.siloFenceBounds;
 assert.ok(perimeter&&cache&&bounds);
 assert.equal(perimeter.userData.siloWireFence,true);
 assert.equal(perimeter.userData.fenceRails,0);
 assert.ok(perimeter.getObjectByName('BarracksWireFencePosts')?.isInstancedMesh);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceStrands')?.isInstancedMesh);
 assert.ok(perimeter.getObjectByName('BarracksWireFenceBarbs')?.isInstancedMesh);
 assert.equal(perimeter.getObjectByName('YardFenceMesh'),undefined);
 yard.updateWorldMatrix(true,true);
 const crateBounds=new THREE.Box3().setFromObject(cache)
  .applyMatrix4(perimeter.matrixWorld.clone().invert());
 assert.ok(bounds.rightX>=crateBounds.max.x+19,'right side encloses barrels and crates');
 assert.ok(bounds.rear<=crateBounds.min.z-19,'rear line clears the cache');
 assert.ok(bounds.front>=crateBounds.max.z+19,'front line clears the cache');
 assert.ok(bounds.gateHalf>55&&bounds.gateHalf<70,'entrance is wide enough for vehicles');
 disposeBuildingYard(yard);
});

test('golden hour is the default desert environment with an opt-out daytime view',()=>{
 assert.equal(desertGoldenHourEnabled('desert',null),true);
 assert.equal(desertGoldenHourEnabled('desert','golden'),true);
 assert.equal(desertGoldenHourEnabled('desert','day'),false);
 assert.equal(desertGoldenHourEnabled('snow',null),false);
 assert.equal(desertGoldenHourEnabled('jungle',null),false);
 const [x,y,z]=DESERT_GOLDEN_HOUR.sunOffset;
 const elevation=Math.atan2(y,Math.hypot(x,z))*180/Math.PI;
 assert.ok(elevation>18&&elevation<28,'golden hour needs a genuinely low sun');
 assert.ok(DESERT_GOLDEN_HOUR.sunIntensity>2);
 assert.ok(DESERT_GOLDEN_HOUR.fillIntensity>.3,'units remain readable in shadow');
 assert.ok(DESERT_GOLDEN_HOUR.fogDensity<.00008);
 const scene=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(scene,/desertGoldenHourEnabled\(biome,query.get\('lighting'\)\)/);
 assert.match(scene,/new THREE.DirectionalLight\(\s*sunset\?\.sunColor/);
 assert.match(scene,/const sunlightOffset=new THREE.Vector3/);
 assert.match(scene,/sun.position.copy\(cameraTarget\).add\(sunlightOffset\)/);
 assert.match(scene,/scene.background=new THREE.Color\('#000000'\)/);
 assert.match(build,/cpSync\('scripts\/webgl-golden-hour.js','dist\/webgl-golden-hour.js'\)/);
});
