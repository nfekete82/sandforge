import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {sharedStoneMaps,stoneMaterial,weatheredStoneGeometry}
 from '../scripts/webgl-rock-materials.js';
import {DESERT_SCENIC_STYLE as style} from '../scripts/webgl-desert-style.js';

test('stone hues blend with golden-beige desert, not dark charcoal',()=>{
 const sand=new THREE.Color(style.duneBase);
 const hues=[style.mesa,style.mesaShade,...style.looseStones,...style.riverPebbles,
  style.sceneDebris,style.rubbleLight,style.rubbleDark];
 for(const hex of hues){
  const c=new THREE.Color(hex);
  assert.ok(c.r>c.b&&c.g>c.b,'all scenery stone is warm, '+hex);
  assert.ok(c.r>.37&&c.g>.26,'no near-black rocks, '+hex);
 }
 const mesa=new THREE.Color(style.mesa);
 assert.ok(mesa.r>=sand.r*.84);
 assert.equal(style.mesa,'#d4bd9b');
 assert.equal(style.mesaShade,'#ad9675');
});

test('desert cliffs use same physical sandstone albedo/roughness/normal as boulders',()=>{
 const code=readFileSync('scripts/webgl-preview.js','utf8');
 const start=code.indexOf('function addBattlefieldRocks('),end=code.indexOf('function instancedStone()',start);
 const section=code.slice(start,end);
 assert.match(section,/map:biome==='desert'\?rockMaps\.map:null/);
 assert.match(section,/normalMap:rockMaps\.normalMap/);
 assert.match(section,/roughnessMap:rockMaps\.roughnessMap/);
 assert.match(section,/if\(biome!=='desert'\)new THREE\.TextureLoader\(\)\.load/);
 assert.match(code,/normalScale:biome==='desert'\?\.42:\.58/);
 const maps=sharedStoneMaps(false);
 assert.strictEqual(maps,sharedStoneMaps(false));
 const loose=stoneMaterial(style.looseStones[0],{normalScale:.42});
 assert.strictEqual(loose.map,maps.map);
 assert.strictEqual(loose.normalMap,maps.normalMap);
 assert.strictEqual(loose.roughnessMap,maps.roughnessMap);
 assert.equal(loose.roughness,.96);
 assert.equal(loose.metalness,0);
 const geom=weatheredStoneGeometry(false);
 assert.ok(geom.userData.sedimentaryLedges);
 geom.dispose();loose.dispose();
});

test('wash pebbles and ruins stay in same pigment family without touching buildings',()=>{
 const wash=readFileSync('scripts/webgl-desert-art.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(wash,/const palette=desertStyle\.riverPebbles/);
 assert.match(wash,/normalScale:\.43/);
 assert.match(preview,/desertStyle\.looseStones/);
 assert.doesNotMatch(readFileSync('scripts/webgl-battlefield.js','utf8'),/desertStyle\.mesaShade/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/desertStyle/);
});
