import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {BIOME_STYLES,normalizeBiome,addBiomeVegetation} from '../scripts/webgl-biomes.js';
import '../scripts/webgl-desert-maps.js';

test('all three biomes have distinct, validated visual palettes',()=>{
 assert.deepEqual(Object.keys(BIOME_STYLES),['desert','snow','jungle']);
 for(const [key,style] of Object.entries(BIOME_STYLES)){
  assert.ok(style.label);
  for(const color of ['fog','terrain','groundBase','groundLight','groundRock','sunlight'])
   assert.match(style[color],/^#[0-9a-f]{6}$/i,key+': '+color);
  assert.equal(style.rocks.length,3);
 }
 for(const name of ['desert','snow','jungle'])assert.equal(normalizeBiome(name),name);
 for(const name of [null,'','Jungle','../../secret','volcano'])assert.equal(normalizeBiome(name),'desert');
});

test('WebGL build packages the fixed desert menu and supports saved Snow and Jungle visuals',()=>{
 assert.ok(existsSync('dist/webgl-biomes.js'));
 const html=readFileSync('dist/webgl-preview.html','utf8');
 const preview=readFileSync('dist/webgl-preview.js','utf8');
 const menu=readFileSync('dist/webgl-title-menu.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(html,/id="sf3d-desert-map"/);
 assert.doesNotMatch(html,/id="sf3d-biome"/);
 assert.ok(globalThis.SandforgeDesertMaps.maps.every(map=>map.biome==='desert'));
 assert.match(menu,/validBiome\(visual\.biome\)/);
 assert.match(menu,/params\.set\('biome',validBiome\(biome\)\)/);
 assert.match(preview,/normalizeBiome\(query\.get\('biome'\)\)/);
 assert.match(preview,/addBiomeVegetation\(/);
 assert.match(preview,/biome==='desert'\?sandTexture\(\)/);
 assert.match(preview,/new SandforgeCombatEffects\(\{[^}]*biome/);
 assert.match(menu,/savedBiomeKey/);
 assert.match(build,/cpSync\('scripts\/webgl-biomes\.js','dist\/webgl-biomes\.js'\)/);
});

test('instanced biome vegetation is deterministic, cosmetic and bounded',()=>{
 const meshes=[];
 const matrix=new THREE.Matrix4();
 const matrices=mesh=>Array.from({length:mesh.count},(_,i)=>{
  mesh.getMatrixAt(i,matrix);return matrix.toArray();
 });
 const blocked=new Uint8Array(16);
 const world={
  size:3000,blocked,mapVersion:23,terrainSlope:()=>0,
  walkable:({x,y})=>x>0&&y>0&&x<3000&&y<3000
 };
 const options={
  THREE,scene:{add:mesh=>meshes.push(mesh)},world,
  terrain:{sites:[{x:1500,y:1500}],ruins:[]},game:{units:[{x:300,y:300}]},
  heightAt:()=>0,seed:2074,biome:'snow'
 };
 const first=addBiomeVegetation(options);
 assert.ok(first.count>0&&first.count<=210);
 assert.equal(meshes.length,3);
 assert.ok(meshes.every(mesh=>mesh.count===first.count&&mesh.userData.visualOnly&&mesh.userData.nonPlayable));
 for(const mesh of meshes)for(const instance of matrices(mesh))
  assert.ok(Math.abs(instance[12])<1500&&Math.abs(instance[14])<1500);
 const second=addBiomeVegetation({...options,scene:{add:()=>{}}});
 assert.equal(first.count,second.count);
 assert.deepEqual(first.meshes.map(matrices),second.meshes.map(matrices));
 assert.deepEqual(world.blocked,new Uint8Array(16));
 assert.equal(addBiomeVegetation({...options,biome:'desert'}).count,0);
 const legacyOptions={...options,world:{...world,mapVersion:22},biome:'desert',scene:{add:()=>{}}};
 const legacy=addBiomeVegetation(legacyOptions),legacyAgain=addBiomeVegetation(legacyOptions);
 assert.ok(legacy.count>0&&legacy.count<=165,'legacy desert keeps its authored shrubs');
 assert.equal(legacy.meshes.length,3);
 assert.equal(legacy.meshes.reduce((sum,m)=>sum+m.count,0),legacy.count);
 assert.ok(legacy.meshes.every(m=>m.userData.visualOnly&&m.userData.nonPlayable));
 assert.deepEqual(legacy.meshes.map(matrices),legacyAgain.meshes.map(matrices));
 assert.deepEqual(world.blocked,new Uint8Array(16));
});
