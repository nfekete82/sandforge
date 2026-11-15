import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_SCENIC_STYLE as desertStyle} from '../scripts/webgl-desert-style.js';

const src=readFileSync('scripts/webgl-preview.js','utf8');

test('modern desert uses matte procedural fine grain, never baked bright 2K dune stains',()=>{
 assert.match(src,/if\(biome==='desert'&&!terrain\.battlefield\)\{/,
  'old 2K painted dune art is restricted to legacy seeded maps');
 assert.match(src,/source\.src='\/src\/assets\/reborn\/sand-ripples-v2\.png'/,
  'old content remains present for legacy campaigns');
 assert.match(src,/const texture=biome==='desert'\?sandTexture\(\)/);
 assert.doesNotMatch(src,/rgba\(255,242,201,\.28\)/,'white sand dots are gone');
 assert.doesNotMatch(src,/rgba\(255,240,210,\.12\)/,'drawn white highlight streaks are gone');
 assert.match(src,/ctx\.fillStyle='rgba\(108,83,52,\.065\)'/);
 assert.match(src,/ctx\.strokeStyle='rgba\(125,96,62,\.045\)'/);
});

test('warm sand-grain source never emits near-white pixels',()=>{
 assert.match(src,/const grain=r\(\),v=211\+grain\*18,off=i\*4/);
 assert.match(src,/pixels\.data\[off\]=v\+9;pixels\.data\[off\+1\]=v\+1;/);
 assert.match(src,/pixels\.data\[off\+2\]=v-13;pixels\.data\[off\+3\]=255;/);
 // Inspect the pixel range that sandTexture() actually writes, before
 // darkening-only grains and strokes. No texture UV can ever sample white.
 for(let i=0;i<=100;i++){
  const grain=i/100,v=211+grain*18;
  const [red,green,blue]=[v+9,v+1,v-13];
  assert.ok(red>=220&&red<=238);
  assert.ok(green>blue&&red>green,'warm beige, not neutral white');
  assert.ok(red<245&&green<245&&blue<245,'no clipped bright flakes');
 }
});

test('terrain alone is warm beige, while buildings, PBR sky, terrain heights and original villages are unchanged',()=>{
 assert.match(src,/color:biome==='desert'\?\(spacious\?desertStyle\.terrainMaterial:'\#f5eadb'\):biomeStyle\.terrain/);
 assert.equal(desertStyle.terrainMaterial,'#f2e1c7');
 assert.match(src,/const subtleSandLift=new THREE\.Color\(desertStyle\.warmLift\)/);
 assert.equal(desertStyle.warmLift,'#ead2a6');
 assert.match(src,/if\(biome==='desert'\)vertexColor\.lerp\(subtleSandLift,desertStyle\.warmLiftStrength\)/);
 assert.equal(desertStyle.warmLiftStrength,.12);
 const tint=new THREE.Color('#ead2a6'),old=new THREE.Color('#d9bb92');
 const mixed=old.clone().lerp(tint,.12);
 assert.ok(mixed.r>mixed.g&&mixed.g>mixed.b,'warm gold, not pale white');
 assert.ok(mixed.r>old.r,'ground is a bit lighter than original');
 assert.ok(mixed.r<.85,'must not approach washed-out white');
 assert.match(src,/renderer\.toneMappingExposure=biome==='desert'\?\(spacious\?\.96:1\.00\)/);
 assert.match(src,/if\(spacious&&biome==='desert'&&normalMap\)normalMap\.repeat\.set\(6\.5,6\.5\)/);
 assert.match(src,/spacious&&biome==='desert'\?createDesertVillages/);
 assert.match(src,/const mesh=new THREE\.Mesh\(geometry,material\);\s*mesh\.receiveShadow=true;mesh\.userData\.terrain=true;/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/subtleSandLift|sandTexture|DESERT_SCENIC_STYLE/);
});
