import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('visual lab is an independent, shipped Three.js entrypoint',()=>{
 const html=read('desert-look-lab.html');
 const app=read('scripts/desert-look-lab.js');
 const build=read('scripts/build.mjs');
 assert.match(html,/id="before"/);
 assert.match(html,/id="after"/);
 assert.match(html,/id="scene"/);
 assert.match(html,/src="\/desert-look-lab\.js"/);
 assert.match(app,/installDesertSandPBR/);
 assert.match(app,/weatheredStoneGeometry/);
 assert.match(app,/headquarters-0\.glb/);
 assert.match(app,/palm-tree\.glb/);
 assert.match(app,/draw Calls:|Draw Calls:/);
 assert.doesNotMatch(app,/localStorage|game\.simulation|location\.reload/);
 assert.match(build,/cpSync\('desert-look-lab\.html','dist\/desert-look-lab\.html'\)/);
 assert.match(build,/cpSync\('scripts\/desert-look-lab\.js','dist\/desert-look-lab\.js'\)/);
});
test('built lab includes local vendor and original model assets',()=>{
 for(const path of [
  'dist/desert-look-lab.html','dist/desert-look-lab.js',
  'dist/webgl-sand-pbr.js','dist/webgl-sand-surface-detail.js',
  'dist/webgl-rock-materials.js','dist/vendor/three/three.module.js',
  'dist/src/assets/reborn/buildings-3d/headquarters-0.glb',
  'dist/src/assets/reborn/props-3d/palm-tree.glb',
  'dist/src/assets/reborn/terrain/sand-wind-albedo-v1.webp'
 ])assert.ok(existsSync(new URL('../'+path,import.meta.url)),path+' missing from build');
});
