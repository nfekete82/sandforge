import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {finishBuildingFacadeShading,BUILDING_FACADE_SHADING_REVISION}
 from '../scripts/webgl-building-shading.js';

test('authored building facade gets subtle face shadow after existing camouflage, without replacing PBR maps',()=>{
 const root=new THREE.Group();
 const diffuse=new THREE.Texture(),normal=new THREE.Texture(),ao=new THREE.Texture();
 const original=new THREE.MeshStandardMaterial({name:'Weathered ceramic wall',map:diffuse,normalMap:normal,aoMap:ao});
 const surface=new THREE.Mesh(new THREE.BoxGeometry(4,7,4),original);
 surface.name='Atlas_CeramicHull';root.add(surface);
 const first=finishBuildingFacadeShading(root);
 assert.equal(first,1);
 assert.equal(finishBuildingFacadeShading(root),0,'only one shader install per mesh');
 const painted=surface.material;
 assert.notEqual(original,painted,'shared glTF material is not changed');
 assert.equal(painted.map,diffuse);
 assert.equal(painted.normalMap,normal);
 assert.equal(painted.aoMap,ao);
 assert.equal(painted.userData.sandforgeBuildingFacadeShade,BUILDING_FACADE_SHADING_REVISION);
 assert.equal(original.userData.sandforgeBuildingFacadeShade,undefined);
 const shader={
  vertexShader:'#include <common>\n#include <beginnormal_vertex>',
  fragmentShader:'#include <common>\n#include <aomap_fragment>'
 };
 painted.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfFacadeExposure=1\.0-abs\(normalize\(objectNormal\)\.y\)/);
 assert.match(shader.fragmentShader,/reflectedLight\.indirectDiffuse\*=1\.0-\.17\*sfWall/);
 assert.match(shader.fragmentShader,/reflectedLight\.directDiffuse\*=1\.0-\.055\*sfWall/);
 assert.ok(shader.fragmentShader.includes('#include <aomap_fragment>'),'original PBR AO must remain');
});
test('shading keeps a previously installed camouflage callback and skips translucent windows',()=>{
 const roof=new THREE.Group(),material=new THREE.MeshStandardMaterial({name:'painted wall'});
 material.userData.sandforgeFactionTint=true;
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace(
  '#include <color_fragment>','#include <color_fragment>\n// DesertCamouflage remains');};
 const wall=new THREE.Mesh(new THREE.BoxGeometry(2,4,2),material);
 wall.name='AirfieldWall';roof.add(wall);
 const glass=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({
  name:'Canopy glass',transparent:true,opacity:.88
 }));
 roof.add(glass);
 assert.equal(finishBuildingFacadeShading(roof),1);
 assert.equal(wall.material,material,'keep owned per-building material reference');
 assert.equal(glass.material.userData.sandforgeBuildingFacadeShade,undefined);
 const shader={
  vertexShader:'#include <common>\n#include <beginnormal_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>\n#include <aomap_fragment>'
 };
 material.onBeforeCompile(shader,{});
 assert.ok(shader.fragmentShader.includes('// DesertCamouflage remains'));
 assert.ok(shader.fragmentShader.includes('sfWall'));
});
test('render-only facade finish is applied to actual building GLBs and has zero gameplay state',()=>{
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battle,/if\(type==='building'\)finishBuildingFacadeShading\(model\)/);
 assert.match(battle,/if\(type==='building'\)finishBuildingFacadeShading\(placeholder\)/);
 assert.match(build,/webgl-building-shading\.js/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/finishBuildingFacadeShading/);
});
