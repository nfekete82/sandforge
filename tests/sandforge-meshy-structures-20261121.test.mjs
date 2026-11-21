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
 const shader={fragmentShader:'#include <map_fragment>',vertexShader:'',uniforms:{}};
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
