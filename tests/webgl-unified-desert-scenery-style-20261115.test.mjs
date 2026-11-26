import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_SCENIC_STYLE as style} from '../scripts/webgl-desert-style.js';

test('one warm pigment library controls modern sand, scenic rocks, roads and ruined walls',()=>{
 assert.ok(Object.isFrozen(style));
 assert.ok(Object.isFrozen(style.looseStones));
 assert.ok(Object.isFrozen(style.riverPebbles));
 for(const name of ['terrainMaterial','duneBase','duneHighlight','wornStone','drySediment',
  'warmLift','mesa','mesaShade','roadDust','roadRuts','ruinedPlaster','sceneDebris',
  'rubbleLight','rubbleDark','riverPebbleBase']){
  const c=new THREE.Color(style[name]);
  assert.ok(Number.isFinite(c.r)&&Number.isFinite(c.g)&&Number.isFinite(c.b),name);
 }
 assert.equal(style.terrainMaterial,'#eee0c9','preserve the approved subdued sand tint');
 assert.ok(style.warmLiftStrength>0&&style.warmLiftStrength<.2);
 assert.ok(style.ruinBlend>0&&style.ruinBlend<.2,
  'the original authored ruined materials remain visible, only their pigment is gently harmonized');
 assert.equal(style.looseStones.length,3);
 assert.equal(style.riverPebbles.length,4);
});

test('only the desert landscape reads the shared style; production buildings do not',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const village=readFileSync('scripts/webgl-desert-village.js','utf8');
 const art=readFileSync('scripts/webgl-desert-art.js','utf8');
 const environment=readFileSync('scripts/webgl-environment.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/import \{DESERT_SCENIC_STYLE as desertStyle\} from '\/webgl-desert-style\.js'/);
 assert.match(preview,/sandGold=new THREE\.Color\(desertStyle\.duneBase\)/);
 assert.match(preview,/stoneMaterial\(color,\{lowQuality:/);
 assert.match(preview,/biome==='desert'&&value\.color/);
 assert.match(preview,/value\.color\.lerp\(new THREE\.Color\(desertStyle\.ruinedPlaster\),desertStyle\.ruinBlend\)/);
 assert.match(preview,/desertStyle\.looseStones/);
 assert.match(village,/new THREE\.Color\(desertStyle\.roadDust\)/);
 assert.match(village,/new THREE\.Color\(desertStyle\.roadRuts\)/);
 assert.match(art,/const palette=desertStyle\.riverPebbles/);
 assert.match(environment,/desertStyle\.sceneDebris/);
 assert.match(environment,/desertStyle\.rubbleLight/);
 assert.match(build,/cpSync\('scripts\/webgl-desert-style\.js','dist\/webgl-desert-style\.js'\)/);
 assert.doesNotMatch(readFileSync('scripts/webgl-battlefield.js','utf8'),/desertStyle/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/desertStyle|DESERT_SCENIC_STYLE/);
});

test('same pigment family for every environmental substrate; no painted white overlays',()=>{
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 const c=new THREE.Color(style.terrainMaterial);
 const shades=[...style.looseStones,...style.riverPebbles,style.roadDust,style.roadRuts,
  style.rubbleLight,style.rubbleDark,style.ruinedPlaster].map(s=>new THREE.Color(s));
 for(const shade of shades){
  // Scenery is deliberately more muted than the terrain, not emissive white.
  assert.ok(shade.r<=.87&&shade.g<=.75&&shade.b<=.64);
  assert.ok(shade.r>shade.b,'warm, non-blue stone and sand');
 }
 assert.ok(c.r>c.g&&c.g>c.b);
 assert.match(src,/if\(biome==='desert'&&!terrain\.battlefield\)\{/,
  'no double image overlay on modern terrain');
 assert.doesNotMatch(src,/rgba\(255,242,201,\.28\)/);
});
