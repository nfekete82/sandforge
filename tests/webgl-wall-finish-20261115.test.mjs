import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';

test('wall costs exactly 75 credits in gameplay and catalog',()=>{
 assert.equal(BUILDINGS.wall.cost,75);
 assert.ok(readFileSync('scripts/webgl-battlefield.js','utf8')
  .includes("const spec=type==='unit'?UNITS[kind]:BUILDINGS[kind]"));
 assert.ok(readFileSync('src/reborn/webgl-classic-hud.css','utf8')
  .includes('button.catalog-card[data-build="wall"] .sf-card-image img'));
});
test('both faction walls have authentic textured desert panels and intact markings',()=>{
 for(const owner of [0,1]){
  const wall=createStrategicBuilding('wall',owner);
  const panels=wall.children.filter(mesh=>mesh.name==='WallArmoredPanel');
  assert.equal(panels.length,3);
  assert.ok(panels.every(mesh=>mesh.material.map?.isTexture&&mesh.material.userData.sandforgeWallCamouflage));
  assert.ok(panels.every(mesh=>mesh.material.userData.sandforgeColorMapCamo),
   'model-local camouflage must remain fixed when the building ghost moves');
  assert.ok(panels.every(mesh=>mesh.material.roughness>.8));
  assert.equal(wall.children.filter(mesh=>mesh.name==='WallFactionBand').length,3);
  assert.equal(wall.userData.defensiveWall,true);
 }
});
