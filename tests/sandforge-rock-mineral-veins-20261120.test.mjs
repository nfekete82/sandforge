import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {applyRockMineralVeins,sharedStoneMaps} from '../scripts/webgl-rock-materials.js';

test('PBR rock marbling keeps original maps, shading and geometry untouched',()=>{
 const maps=sharedStoneMaps(true);
 const m=new THREE.MeshStandardMaterial({color:'#c19c82',map:maps.map,
  normalMap:maps.normalMap,roughnessMap:maps.roughnessMap,roughness:.98});
 const original={map:m.map,normal:m.normalMap,rough:m.roughnessMap,
  roughness:m.roughness,color:m.color.getHexString()};
 assert.equal(applyRockMineralVeins(m,{strength:.57,frequency:1.1}),m);
 assert.ok(m.userData.sandforgeRockMineralVeins);
 assert.equal(m.map,original.map);assert.equal(m.normalMap,original.normal);
 assert.equal(m.roughnessMap,original.rough);
 assert.equal(m.roughness,original.roughness);
 assert.equal(m.color.getHexString(),original.color);
 const program=m.customProgramCacheKey();
 const vertex='#include <common>\n#include <begin_vertex>';
 const fragment='#include <common>\n#include <color_fragment>';
 const shader={vertexShader:vertex,fragmentShader:fragment};
 m.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/varying vec3 vSfRockPosition/);
 assert.match(shader.vertexShader,/vSfRockPosition = position/);
 assert.match(shader.fragmentShader,/varying vec3 vSfRockPosition/);
 assert.match(shader.fragmentShader,/diffuseColor\.rgb \*= \(1\.0-sfPigment\)/);
 assert.match(shader.fragmentShader,/smoothstep\(\.044,\.205,sfVein\)/);
 assert.notEqual(shader.vertexShader,vertex);
 assert.notEqual(shader.fragmentShader,fragment);
 assert.equal(m.customProgramCacheKey(),program);
 const hook=m.onBeforeCompile;
 applyRockMineralVeins(m);
 assert.equal(m.onBeforeCompile,hook,'shared GLB material must never get nested duplicate shader hooks');
});

test('marbling affects only the two genuine desert rock rendering paths',()=>{
 const scene=readFileSync('scripts/webgl-preview.js','utf8');
 const props=readFileSync('scripts/webgl-desert-ecoregion-3d.js','utf8');
 assert.match(scene,/if\(spacious&&biome==='desert'\)applyRockMineralVeins\(mat/);
 assert.match(props,/if\(kind==='sandstone'\)applyRockMineralVeins\(m/);
 assert.match(scene,/mesh\.name='physical-battlefield-rocks'/);
 assert.match(props,/loadAsync\(DESERT_MODEL_FILES\[kind\]\)/);
 assert.doesNotMatch(props,/new THREE\.(?:SphereGeometry|CylinderGeometry|ConeGeometry)/);
});
