import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {meshyAsset} from '../scripts/webgl-meshy-assets.js';
import {SAND_FORGE_LOWPOLY_SOLDIER,prepareLowpolySoldier} from '../scripts/webgl-lowpoly-soldier.js';

test('the new low-poly soldier replaces only basic infantry for both teams',()=>{
 for(const owner of [0,1]){
  assert.equal(meshyAsset('infantry',owner,''),SAND_FORGE_LOWPOLY_SOLDIER);
  assert.equal(meshyAsset('engineer',owner,''),null);
  assert.equal(meshyAsset('rocket',owner,''),null);
  assert.equal(meshyAsset('medic',owner,''),null);
 }
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(battlefield,/prepareLowpolySoldier\(model,entry.owner\)/);
 assert.match(battlefield,/entry\.meshyFallback=true/);
 assert.match(battlefield,/prototype\/'/);
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(portraits,/const url=meshyAsset\(kind,0\)\?\?stylizedAsset/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/webgl-lowpoly-soldier/);
});

test('authored desert texture stays intact; red faction gets only a local shader change',()=>{
 const original=new THREE.MeshStandardMaterial({name:'SoldierTexture',color:'#e1bd85'});
 const root=new THREE.Group();
 const a=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),original);
 const b=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),original);
 root.add(a,b);
 assert.equal(prepareLowpolySoldier(root,1),true);
 assert.equal(root.userData.sandforgeLowpolySoldier,true);
 assert.equal(root.userData.sandforgePreserveAuthoredMaterials,true);
 assert.notEqual(a.material,original);
 assert.equal(a.material,b.material);
 assert.equal(a.material.userData.sandforgeLowpolySoldierRed,true);
 assert.equal(original.userData.sandforgeLowpolySoldierRed,undefined);
 const blue=new THREE.Group();blue.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),original));
 prepareLowpolySoldier(blue,0);
 assert.equal(blue.children[0].material,original);
});

test('the shipped model is a valid GLB2 with meshes, not just a path',()=>{
 const path='src/assets/meshy/infantry-animated.glb';
 assert.ok(existsSync(path),'the model binary must be installed into GitHub');
 const bytes=readFileSync(path);
 assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
 assert.ok(gltf.meshes?.length>0);
 assert.ok(gltf.skins?.length>0,'requires actual skeleton');
 assert.ok(gltf.skins[0].joints.length>=18,'requires complete humanoid rig');
 assert.ok(gltf.nodes?.some(n=>n.name==='WeaponMuzzle'),'gun muzzle marker missing');
 const clips=new Set(gltf.animations?.map(a=>a.name));
 for(const name of ['Idle','Walk','Run','Attack','Hit','Death'])
  assert.ok(clips.has(name),'missing playable clip '+name);
 assert.ok(gltf.accessors?.length>0);
 assert.ok(bytes.length>10000);
});
