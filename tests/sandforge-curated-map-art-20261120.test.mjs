import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import '../scripts/webgl-map-presets.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {generateOases} from '../scripts/webgl-oasis-generation.js';
import {planCuratedMapArt,CURATED_ART_REVISION} from '../scripts/webgl-curated-map-layout.js';
import {createCuratedMapArt} from '../scripts/webgl-curated-map-art.js';

const catalog=globalThis.SandforgeMapPresets;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cases=catalog.list.map(p=>{
 const g=Simulation.campaign(p.seed,p.mapVersion,p.terrain,p.generatorVersion);
 const world=g.world;
 const heightAt=(x,z)=>world.terrainHeight(x,z);
 const oases=p.biome==='desert'?generateOases({
  world,seed:p.seed,startRegions:g.startRegions,heightAt
 }):[];
 return {p,g,world,terrain:world.generated,heightAt,oases};
});

for(const {p,world,terrain,heightAt,oases} of cases){
 test(p.name+': art direction has consistent deterministic silhouettes and safe landmarks',()=>{
  const input={preset:p,world,terrain,oases};
  const a=planCuratedMapArt(input),b=planCuratedMapArt(input);
  assert.ok(a&&a.revision===CURATED_ART_REVISION);
  assert.deepEqual(a,b,'art must be identical for same saved game and seed');
  assert.ok(a.landmarks.length>=1,p.id+' missing all authored landmarks');
  assert.ok(a.groundAccents.length>=60,p.id+' lacks distinct environmental decoration');
  for(const mark of a.landmarks){
   assert.ok(mark.x>200&&mark.y>200&&mark.x<world.size-200&&mark.y<world.size-200);
   assert.ok(terrain.sites.every(site=>dist(mark,site)>650),
    p.id+' landmark overlaps a Bastion');
   if(p.id!=='staubkrone'){
    assert.equal(world.walkable(mark),false,
     'watchtowers/temples must stand on real blocked cliffs, not driveable passes');
   }
  }
  if(p.id==='frostpforte')assert.ok(a.landmarks.length>=1);
  if(p.id==='schlangenfeste')assert.ok(a.landmarks.length>=3,
   'three strategic routes need distinctive temple landmarks');
 });
 test(p.name+': GPU-instanced 3D landmarks exist and remain visual-only',()=>{
  const scene=new THREE.Scene();
  const art=createCuratedMapArt({scene,world,terrain,heightAt,preset:p,oases});
  assert.ok(art.root);
  assert.equal(art.plan.id,p.id);
  assert.equal(scene.children.length,1);
  assert.ok(art.drawCalls>1&&art.drawCalls<=14,
   'limit added PBR draw calls despite hundreds of scenic details');
  let total=0;
  for(const mesh of art.root.children){
   assert.ok(mesh.isInstancedMesh);
   assert.ok(mesh.count>0);
   assert.equal(mesh.userData.visualOnly,true);
   assert.equal(mesh.userData.nonPlayable,true);
   assert.equal(mesh.raycast(),undefined);
   assert.ok(mesh.geometry.getAttribute('position').count>20);
   assert.ok(mesh.geometry.boundingSphere?.radius>0);
   total+=mesh.count;
  }
  assert.ok(total>=art.plan.groundAccents.length);
  assert.ok(world.validation.valid,'art must not alter world connectivity');
  art.dispose();
  assert.equal(scene.children.length,0,'pagehide must release scenic meshes');
 });
}

test('random or forged map identity never injects monuments',()=>{
 const {world,terrain,heightAt}=cases[0];
 assert.equal(planCuratedMapArt({preset:null,world,terrain}),null);
 assert.equal(planCuratedMapArt({preset:{id:'unknown'},world,terrain}),null);
 const art=createCuratedMapArt({scene:new THREE.Scene(),world,terrain,heightAt,preset:null});
 assert.equal(art.drawCalls,0);
});

test('WebGL art integrates in packaged browser renderer with proper performance cleanup',()=>{
 const render=readFileSync('scripts/webgl-preview.js','utf8');
 const builder=readFileSync('scripts/build.mjs','utf8');
 assert.match(render,/createCuratedMapArt\(/);
 assert.match(render,/curatedMapArt\?\.dispose\(\)/);
 assert.match(render,/curatedGroundTint/);
 assert.match(render,/curatedMapArt\.plan\.landmarks\.length/);
 assert.match(builder,/cpSync\('scripts\/webgl-curated-map-art\.js'/);
 assert.match(builder,/cpSync\('scripts\/webgl-curated-map-layout\.js'/);
});
