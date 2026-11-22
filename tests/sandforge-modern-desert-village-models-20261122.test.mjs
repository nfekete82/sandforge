import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {planDesertVillages,createDesertVillages,OASIS_VILLAGE_MODELS}
 from '../scripts/webgl-desert-village.js';

test('Desert Strike v10 villages select three distinct PBR adobe models, not canyon huts',()=>{
 const preset=globalThis.SandforgeDesertMaps.byId('desert-strike');
 const g=Simulation.campaign(preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion);
 const villages=planDesertVillages({world:g.world,terrain:g.world.generated,seed:preset.seed});
 assert.ok(villages.length>0,'missing seeded test settlement');
 for(const village of villages){
  const names=village.houses.map(h=>h.kind);
  assert.deepEqual(names,['main_house','courtyard_house','ruin_house']);
  assert.deepEqual(village.houses.map(h=>h.variant),[0,2,4]);
  assert.ok(village.houses.every(h=>h.tint>.9&&h.tint<1.02));
 }
 assert.equal(OASIS_VILLAGE_MODELS.length,6);
});

test('real village renderer uses batched damaged adobe and preserves historic canyon sources',()=>{
 const code=readFileSync('scripts/webgl-desert-village.js','utf8');
 assert.match(code,/const modernAdobe=world\.generatorVersion>=10/);
 assert.match(code,/const modelUrls=oasisStyle\|\|modernAdobe\?OASIS_VILLAGE_MODELS:DESERT_VILLAGE_MODELS/);
 assert.match(code,/createDetailedDesertRuinHouse\(ruin,seed,i\)/);
 assert.match(code,/mergeGeometries\(parts,false\)/);
 assert.match(code,/variant:modernAdobe\?adobeVariants\[i\]:i===2\?1:0/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/generate-oasis-adobe-glbs\.mjs/);
});

test('Desert Strike renderer creates damaged walls rather than three intact house shells',async()=>{
 const preset=globalThis.SandforgeDesertMaps.byId('desert-strike');
 const g=Simulation.campaign(preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion);
 const w=g.world,half=w.size*.5,scene=new THREE.Scene();
 const output=await createDesertVillages({scene,world:w,terrain:w.generated,seed:preset.seed,
  heightAt:(x,z)=>w.terrainHeight(x,z),
  pos:(x,z,y=w.terrainHeight(x,z))=>new THREE.Vector3(x-half,y,z-half),
  loadModel:async()=>{throw Error('modern ruin should not load clean canyon GLTF');}});
 assert.ok(output.meshes.length>0,'damaged village mesh absent');
 assert.ok(output.meshes.length<=8,'materials must be batched instead of per-fragment draw calls');
 assert.ok(output.meshes.every(m=>m.userData.detailedRuin&&m.material.transparent!==true));
 for(const mesh of output.meshes){mesh.geometry.dispose();mesh.removeFromParent();}
 output.roads?.geometry.dispose();output.roads?.material.dispose();
});
