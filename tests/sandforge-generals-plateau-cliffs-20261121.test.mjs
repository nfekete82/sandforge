import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';

const makeRidge=()=>({
 spine:[{x:140,y:470},{x:320,y:465},{x:490,y:455},{x:680,y:470},{x:885,y:460}],
 width:116,height:140,
 ramps:[{x:520,width:115}],
 clearings:[{point:{x:320,y:250},radius:110}]
});

test('C&C-style plateau cliff is real contiguous 3D PBR geometry, not an invisible or rounded hill',()=>{
 const scene=new THREE.Scene();
 const meshes=createLandscapeMeshes({
  scene,size:1024,heightAt:()=>12,roads:[],ridges:[makeRidge()],
  biome:'desert',mapId:'broken-empire',lowQuality:true,showOutcrops:false
 });
 const cliff=meshes.find(mesh=>mesh.name==='procedural-v3-eroded-sandstone');
 assert.ok(cliff,'terrain renderer must generate a visible cliff mesh');
 assert.ok(cliff.geometry.getAttribute('position').count>300,
  'must have a densely tessellated rock face, not one flattened quad');
 const bounds=new THREE.Box3().setFromObject(cliff);
 assert.ok(bounds.max.y-bounds.min.y>100,'mountain face must be tall');
 assert.ok(bounds.max.x-bounds.min.x>500,'ridge must follow the full canyon length');
 assert.ok(cliff.material.map?.isTexture,'authored/shared sandstone albedo must remain');
 assert.ok(cliff.material.normalMap?.isTexture,'weathered stone bump details must remain');
 assert.equal(cliff.userData.visualOnly,true);
 assert.equal(cliff.userData.physicalCliffPresentation,true);
 assert.ok(scene.children.includes(cliff));
 for(const mesh of meshes) {
  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
 }
});

test('open basin intentionally has no cliff mesh; terrain without ridges is still valid',()=>{
 const scene=new THREE.Scene();
 const meshes=createLandscapeMeshes({
  scene,size:1024,heightAt:()=>12,roads:[],ridges:[],
  biome:'desert',mapId:'desert-strike',lowQuality:true,showOutcrops:false
 });
 assert.equal(meshes.filter(mesh=>mesh.userData?.erodedRidge).length,0);
});
