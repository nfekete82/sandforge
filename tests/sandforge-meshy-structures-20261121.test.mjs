import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MESHY_STRUCTURE_ASSETS} from '../scripts/webgl-meshy-asset-flags.js';
import {meshyStructurePath,prepareMeshyStructure,meshyLocalBounds,SANDFORGE_INDUSTRIAL_PALETTE}
 from '../scripts/webgl-meshy-structure.js';

test('missing Meshy binaries never break existing Sandforge PBR buildings',()=>{
 for(const kind of ['barracks','airfield','bastion','bunker','headquarters','generator']){
  assert.equal(MESHY_STRUCTURE_ASSETS[kind],false);
  assert.equal(meshyStructurePath(kind),null);
 }
});
test('Meshy skins preserve the source albedo, normals and metallic roughness',()=>{
 const make=()=>{
  const root=new THREE.Group(),tex=new THREE.DataTexture(new Uint8Array([20,90,170,255]),1,1);
  const normal=new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1);
  const material=new THREE.MeshStandardMaterial({map:tex,normalMap:normal,
   metalnessMap:tex,roughnessMap:tex,metalness:.5,roughness:.6});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  root.add(mesh);return {root,mesh,material,tex,normal};
 };
 const blue=make();
 assert.equal(prepareMeshyStructure(blue.root,'generator',0),true);
 assert.notEqual(blue.mesh.material,blue.material);
 assert.equal(blue.mesh.material.map,blue.tex);
 assert.equal(blue.mesh.material.normalMap,blue.normal);
 assert.equal(blue.mesh.material.metalnessMap,blue.tex);
 const red=make();
 assert.equal(prepareMeshyStructure(red.root,'generator',1),true);
 assert.notEqual(red.mesh.material,red.material);
 assert.equal(red.mesh.material.map,red.tex);
 assert.equal(red.mesh.material.normalMap,red.normal);
 assert.equal(red.mesh.material.metalnessMap,red.tex);
 assert.equal(red.mesh.material.roughnessMap,red.tex);
 const shader={fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <emissivemap_fragment>',vertexShader:'',uniforms:{}};
 red.mesh.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/sfTeamRed/);
 assert.equal(red.root.userData.sandforgeMeshyStructure,'generator');
});
test('factory exposes only the actual roll-up shutter and shrunk tank proportions',()=>{
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 const scale=readFileSync('scripts/webgl-scale.js','utf8');
 assert.doesNotMatch(gates,/new THREE.BoxGeometry\(\.018,\.28,\.57\)/);
 assert.match(gates,/meshyShutter:true/);
 assert.match(scale,/if\(kind==='tank'\)return 1\.23/);
});
test('existing Energiekern income, HP and prices remain untouched',()=>{
 const catalog=readFileSync('src/reborn/catalog.ts','utf8');
 assert.match(catalog,/generator:\{name:'Energiekern',cost:150,buildTime:9,hp:500/);
 assert.match(catalog,/width:112,income:10/);
});

test('measured local infantry exits stay just outside the physical GLB at any scale',()=>{
 const building=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(2,1,4),
  new THREE.MeshStandardMaterial({map:new THREE.DataTexture(new Uint8Array([120,100,80,255]),1,1)}));
 building.add(wall);
 building.position.set(80,12,-24);
 building.scale.setScalar(110);
 const b=meshyLocalBounds(building),size=b.getSize(new THREE.Vector3());
 assert.ok(Math.abs(size.x-2)<.0001);
 assert.ok(Math.abs(size.z-4)<.0001);
 prepareMeshyStructure(building,'headquarters',0);
 const start=building.getObjectByName('SF_Meshy_InfantryRolloutStart');
 const exit=building.getObjectByName('SF_Meshy_InfantryRolloutExit');
 assert.ok(start&&exit);
 assert.ok(start.position.z>b.max.z);
 assert.ok(exit.position.z>start.position.z);
 const repeat=prepareMeshyStructure(building,'headquarters',0);
 assert.equal(repeat,true);
 assert.equal(building.children.filter(n=>n.name==='SF_Meshy_InfantryRolloutStart').length,1);
});
test('single industrial palette and exact reference photo for modern command HQ',()=>{
 assert.equal(SANDFORGE_INDUSTRIAL_PALETTE.blue,'#1b508d');
 const workflow=readFileSync('.github/workflows/meshy-structures-import-20261121.yml','utf8');
 assert.match(workflow,/01a1fd66-536b-71d0-9d5a-74afd948e7f9/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/installedMeshy/);
 assert.match(build,/meshy-structures/);
});

test('HQ has NO side camo tent; other camo yards keep their own decor',()=>{
 const source=readFileSync('scripts/webgl-building-yard.js','utf8');
 assert.match(source,/CAMO_NET_BUILDING_KINDS=Object\.freeze\(\['barracks','research'\]\)/);
 assert.doesNotMatch(source,/CAMO_NET_BUILDING_KINDS=Object\.freeze\(\['headquarters'/);
});
test('vehicle factory and HQ both receive final identical Sandforge PBR-grade shader',()=>{
 const gameplay=readFileSync('scripts/webgl-battlefield.js','utf8');
 const style=readFileSync('scripts/webgl-meshy-structure.js','utf8');
 const viewer=readFileSync('scripts/webgl-meshy-buildings-viewer.js','utf8');
 assert.match(gameplay,/prepareMeshyStructure\(model,'factory',entry\.owner\)/);
 assert.match(gameplay,/prepareMeshyStructure\(model,'factory',0\)/);
 assert.match(viewer,/prepareMeshyStructure\(model,kind,owner\)/);
 assert.match(style,/matched-hq-factory-albedo/);
 assert.match(style,/sfSandPanel/);
 assert.match(style,/roughnessmap_fragment/);
 const material=new THREE.MeshStandardMaterial({
  map:new THREE.DataTexture(new Uint8Array([170,145,95,255]),1,1),
  roughness:.86,metalness:.22
 });
 for(const kind of ['headquarters','factory']){
  const model=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,2),material);
  model.add(mesh);
  prepareMeshyStructure(model,kind,0);
  const shader={fragmentShader:'#include <map_fragment>\\n#include <color_fragment>\\n#include <roughnessmap_fragment>\\n#include <emissivemap_fragment>',
   vertexShader:'',uniforms:{}};
  mesh.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/sfSandPanel/);
  assert.match(shader.fragmentShader,/sfPanelTone/);
  assert.equal(mesh.material.map,material.map);
 }
});
