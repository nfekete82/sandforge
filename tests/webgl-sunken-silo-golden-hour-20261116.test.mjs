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
  assert.ok(interior.geometry.parameters.height>30,'shaft walls must show real depth');
  assert.ok(well.position.y<-20,'deep floor must not read as a black disk on the roof');
  const occlusion=model.getObjectByName('Silo_TerrainOcclusion');
  assert.ok(occlusion?.isMesh,'underground launch shaft requires a terrain occlusion mask');
  assert.ok(occlusion.material.isShaderMaterial,
   'the underground opening must render perspective-correct wall depth, not a disk');
  assert.equal(occlusion.material.name,'SF_SiloDepthOcclusion');
  assert.ok(occlusion.geometry.parameters.radius>=59);
  assert.ok(occlusion.position.y>1.15&&occlusion.position.y<lip.position.y-5,
   'ground-level mask prevents the terrain from bleeding into the shaft');
  const shader=occlusion.material;
  assert.equal(shader.uniforms.uDepth.value,95,
   'inner wall projection extends 95 world units down');
  assert.ok(shader.fragmentShader.includes('float tWall='),
   'ray-marched shaft must intersect its cylindrical back wall');
  assert.ok(shader.fragmentShader.includes('float tFloor='),
   'deep shaft has a separate distant bottom, not a black floor decal');
  for(const height of ['14.0','38.0','67.0'])
   assert.ok(shader.fragmentShader.includes('band(down,'+height),
    'reinforcement collars must be separated at real shaft depths');
  assert.equal(shader.depthWrite,true,'terrain mask must stay opaque');
  assert.equal(shader.transparent,false,'terrain must never bleed through');
  assert.equal(occlusion.userData.visualShaftDepth,95);
  assert.equal(occlusion.userData.hidesUnderlyingTerrain,true);
  assert.equal(typeof occlusion.onBeforeRender,'function');
  assert.equal(deck.material.name,'SF_metal','main launch deck is stamped steel');
  assert.equal(deck.material.map?.name,'Sandforge silo stamped steel maintenance panels');
  assert.ok(deck.material.metalness>.7&&deck.material.roughness<.5);
  assert.ok(lip.geometry.parameters.outerRadius>
   deck.userData.shaftRadius+12,'reinforced steel rim surrounds the full aperture');
  assert.equal(body.geometry.type,'CylinderGeometry');
  assert.ok(body.geometry.parameters.height>=25,'a real metal rocket body is visible');
  assert.equal(nose.geometry.type,'LatheGeometry',
   'missile nose is a short rounded ogive, not a tall sharp cone');
  const profile=nose.geometry.parameters.points;
  assert.ok(profile.at(-1).y<=18&&profile.at(-1).y>=17,
   'rounded nose height must stay compact');
  assert.ok(profile.some(p=>p.x>2&&p.x<7&&p.y>14),
   'curved shoulder softens the missile tip');
  assert.ok(body.material.metalness>.75&&nose.material.metalness>.75,
   'both rocket stages are metallic, not a flat black cone');
  assert.ok(body.position.y<=-4&&nose.position.y<=11.5,
   'the rocket rests deep in the well; only its upper nose emerges');
  const code=readFileSync('scripts/webgl-strategic-buildings.js','utf8');
  assert.match(code,/for\(let i=0;i<12;i\+\+\)\{\s*const a=i\*Math\.PI\/6;\s*const bar=box\(3\.5,30,2\.8,'steel'/,
   'twelve physical steel strips remain at the upper shaft wall');
  assert.match(code,/\(shaftRadius-2\.5\),-6\.6/,
   'visible strips meet the upper part of the recessed liner');
  assert.ok(shader.fragmentShader.includes('angle*16.0'),
   'vertical grooves must continue deep down into the projected shaft');
  assert.doesNotMatch(code,/for\(const y of \[7\.2,4\.3,2\.1/,
   'no shallow bright metal hoop stack under the upper hatch rim');
  assert.equal(model.getObjectByName('Silo_RocketStageSeam'),undefined,
   'missile must have no raised circumference groove');
  assert.equal(body.material.color.getHex(),nose.material.color.getHex(),
   'smooth cylinder and nose share one uniform brushed-steel appearance');
  assert.ok(body.geometry.parameters.height>=30);
  const smallRings=model.children.filter(o=>o.isMesh&&
   o.geometry.type==='TorusGeometry'&&o.geometry.parameters.radius<25);
  assert.equal(smallRings.length,0,'rocket body may not carry any decorative rings');
  assert.ok(lip.position.y<11,'hatch ring sits barely above the desert ground');
  assert.ok(well.position.y<lip.position.y-6,'dark shaft floor is visibly lower');
  assert.ok(body.position.y<lip.position.y+5,'only upper stage rises from the hole');
  assert.ok(nose.position.y<lip.position.y+9&&nose.position.y>lip.position.y,
   'short rounded nose begins near the rim, not atop a tall launch tower');
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
