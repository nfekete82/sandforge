import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDetailedDesertRuinHouse,DESERT_RUIN_HOUSE_ART}
 from '../scripts/webgl-detailed-desert-ruins.js';

const ruin={width:120,depth:102,height:65,variant:1};
test('new desert ruins have real gaps, weathered masonry and different roof layouts',()=>{
 const shapes=[];
 for(let i=0;i<3;i++){
  const house=createDetailedDesertRuinHouse(ruin,20261122,i);
  const meshes=[];
  house.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(meshes.length>=20,'ruin must include distinct architectural details');
  assert.ok(meshes.some(m=>m.name==='JaggedAdobeWall'));
  assert.ok(meshes.some(m=>m.name==='WindowFrameLeft'));
  assert.ok(meshes.some(m=>m.name==='CollapsedRoofTimber'));
  assert.ok(!meshes.some(m=>m.name==='WhitewashedHouseShell'),
   'no intact opaque building shell behind door and window');
  assert.ok(!meshes.some(m=>m.material.transparent||m.material.opacity<1),
   'house walls should never be translucent overlays');
  assert.ok(meshes.every(m=>m.userData.visualOnly&&m.userData.nonPlayable));
  shapes.push(meshes.map(m=>m.name).join('|'));
 }
 assert.equal(new Set(shapes).size,3,'every facade cannot be the same repeated cube');
 assert.match(DESERT_RUIN_HOUSE_ART,/damaged-adobe/);
});
test('modern desert preview loads new architecture without touching world ruins',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(source,/spacious&&biome==='desert'&&!micro/);
 assert.match(source,/createDetailedDesertRuinHouse\(ruin,seed,i\)/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/webgl-detailed-desert-ruins\.js/);
});
