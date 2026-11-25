import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_SCENIC_STYLE as desertStyle} from '../scripts/webgl-desert-style.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {planDesertVillages,createDesertVillages,DESERT_VILLAGE_ART_REVISION,DESERT_VILLAGE_MODELS}
 from '../scripts/webgl-desert-village.js';

const makeAuthoredMock=url=>{
 const scene=new THREE.Group();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(8,8,7),
  new THREE.MeshStandardMaterial({name:'sun-bleached-plaster',color:'#c5aa87'}));
 const roof=new THREE.Mesh(new THREE.ConeGeometry(6,3,4),
  new THREE.MeshStandardMaterial({name:'roof-tile',color:'#a08f76'}));
 roof.position.y=7;
 scene.add(wall,roof);
 scene.name=url;
 return {scene};
};

for(const seed of [2988452066,3610769721])
 test('4-Bastion map '+seed+': small authored ruin hamlets away from bases and obstacles',async()=>{
  const game=Simulation.campaign(seed,23),world=game.world,terrain=world.generated;
  const params={world,terrain,seed,lowQuality:false};
  const villages=planDesertVillages(params);
  assert.ok(villages.length>=1,'at least one small hamlet on actual user map seed');
  assert.ok(villages.length<=2,'avoid unnatural dense rows of artificial settlements');
  assert.deepEqual(villages,planDesertVillages(params),'stable layout for saved campaigns');
  for(const v of villages){
   assert.ok(v.x>=360&&v.y>=360&&v.x<=world.size-360&&v.y<=world.size-360);
   assert.equal(v.houses.length,3,'three distinct full-sized ruins, not clustered miniature homes');
   for(let i=0;i<v.houses.length;i++)for(let j=i+1;j<v.houses.length;j++)
    assert.ok(Math.hypot(v.houses[i].x-v.houses[j].x,v.houses[i].y-v.houses[j].y)>=225,
     'no crowded little houses – 225m minimum building separation');
   for(const site of terrain.sites)
    assert.ok(Math.hypot(site.x-v.x,site.y-v.y)>=330,
     'scenic settlement stays clear of territory and HQ sites');
   for(const h of v.houses){
    const c={x:h.x,y:h.y},index=world.index(c);
    assert.ok(index>=0&&!world.blocked[index]);
    assert.ok(world.walkable(c));
    assert.ok(Number.isFinite(h.angle)&&h.width>=76&&h.height>=39);
    assert.ok(h.variant===0||h.variant===1,'only real authored ruin variants');
   }
  }
  const scene=new THREE.Scene(),half=world.size*.5;
  const art=await createDesertVillages({
   ...params,scene,
   heightAt:(x,z)=>world.terrainHeight(x,z),
   pos:(x,z,y=world.terrainHeight(x,z))=>new THREE.Vector3(x-half,y,z-half),
   loadModel:async url=>makeAuthoredMock(url),
   weatherModel:scene=>scene.traverse(mesh=>{if(mesh.isMesh)mesh.userData.weatheredRuin=true;})
  });
  assert.equal(art.villages.length,villages.length);
  assert.equal(art.meshes.length,4,'two parts per glTF, two variant sources');
  assert.equal(art.drawCalls,art.meshes.length+1);
  assert.ok(art.drawCalls<=8,'one batched draw per original ruin part');
  assert.ok(art.roads?.isMesh);
  assert.equal(art.roads.userData.groundConforming,true);
  assert.equal(art.roads.userData.softRuts,true);
  assert.equal(art.roads.userData.revision,DESERT_VILLAGE_ART_REVISION);
  assert.equal(art.roads.raycast.toString(),'()=>{}');
  assert.ok(art.roads.geometry.getAttribute('position').count>100);
  assert.equal(art.roads.geometry.getAttribute('color').itemSize,4,
   'faded RGBA ruts, never opaque rectangular road plates');
  let maxAlpha=0;
  const colors=art.roads.geometry.getAttribute('color');
  for(let i=0;i<colors.count;i++)maxAlpha=Math.max(maxAlpha,colors.getW(i));
  assert.ok(maxAlpha<=.26&&maxAlpha>.10,'path is subtle and fades into the sand');
  assert.ok(art.roads.material.opacity<=.65);
  assert.ok(art.meshes.every(m=>m.isInstancedMesh&&m.count>0));
  assert.ok(art.meshes.every(m=>m.userData.authoredRuin===true&&m.userData.nonPlayable===true));
  assert.ok(art.meshes.every(m=>m.userData.source.endsWith('ruin-house.gltf')||
   m.userData.source.endsWith('ruin-depot.gltf')));
  assert.ok(art.meshes.every(m=>m.raycast.toString()==='()=>{}'));
  assert.equal(scene.children.filter(x=>x.userData?.desertVillage).length,art.drawCalls);
  assert.ok(game.territories.every(x=>x.owner===-1||x.owner===0||x.owner===1));
  // GLTF scene owns original geometry/material; rendering instances reuse them.
  art.roads.geometry.dispose();art.roads.material.dispose();
 });

test('original textured ruin GLTFs replace all new procedural house boxes',()=>{
 const code=readFileSync('scripts/webgl-desert-village.js','utf8');
 assert.deepEqual(DESERT_VILLAGE_MODELS,[
  '/src/assets/reborn/canyon-3d/ruin-house.gltf',
  '/src/assets/reborn/canyon-3d/ruin-depot.gltf'
 ]);
 for(const asset of DESERT_VILLAGE_MODELS){
  assert.ok(existsSync('.'+asset),'the referenced GLTF is already shipped with Sandforge');
  const gltf=JSON.parse(readFileSync('.'+asset,'utf8'));
  assert.ok(gltf.meshes?.length>=1);
  assert.ok(gltf.materials?.length>=5,'real masonry, roof, glass and rubble materials');
 }
 assert.doesNotMatch(code,/new THREE\.BoxGeometry/,'no more primitive box houses');
 assert.doesNotMatch(code,/new THREE\.PlaneGeometry/,'no new floating road slabs');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(preview,/loadModel:async url=>\{await ruinStrataLoad;return tryModel\(url\);\}/);
 assert.match(preview,/weatherModel:weatherRuinMeshes/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/createDesertVillages/);
});

test('sun-bleached desert is only slightly lighter, existing gameplay buildings untouched',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/sandGold=new THREE\.Color\(desertStyle\.duneBase\)/);
 assert.equal(desertStyle.duneBase,'#ddc6a5');
 assert.match(preview,/sandLight=new THREE\.Color\(desertStyle\.duneHighlight\)/);
 assert.equal(desertStyle.duneHighlight,'#eee0be');
 assert.match(preview,/riverSediment=new THREE\.Color\(desertStyle\.drySediment\)/);
 assert.equal(desertStyle.drySediment,'#c2b49d');
 assert.match(preview,/const subtleSandLift=new THREE\.Color\(desertStyle\.warmLift\)/);
 assert.equal(desertStyle.warmLift,'#e7d9bd');
 assert.match(preview,/if\(biome==='desert'&&!desertRegion\)vertexColor\.lerp\(subtleSandLift,desertStyle\.warmLiftStrength\)/);
 assert.equal(desertStyle.warmLiftStrength,.09);
 assert.match(preview,/if\(spacious&&biome==='desert'&&normalMap\)normalMap\.repeat\.set\(6\.5,6\.5\)/);
 assert.ok(preview.includes("renderer.toneMappingExposure=biome==='desert'?(spacious?.96:1.00)"),
  'do not change renderer exposure / building brightness');
 assert.match(preview,/spacious&&biome==='desert'\?createDesertVillages/);
 assert.match(build,/cpSync\('scripts\/webgl-desert-village\.js','dist\/webgl-desert-village\.js'\)/);
 assert.ok(existsSync('dist/webgl-desert-village.js'));
});
