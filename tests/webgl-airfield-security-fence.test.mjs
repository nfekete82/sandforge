import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAirfieldSecurityFence,conformAirfieldSecurityFence,
 AIRFIELD_FENCE_PATHS,AIRFIELD_FENCE_TAXI_GAP,AIRFIELD_FENCE_VERSION}
 from '../scripts/webgl-airfield-security-fence.js';
import {readFileSync} from 'node:fs';

test('airfield fence encloses only rear service compound and leaves runway/taxi open',()=>{
 assert.equal(AIRFIELD_FENCE_VERSION,'airfield-chainlink-barbed-fence-v1');
 const gap=AIRFIELD_FENCE_TAXI_GAP;
 for(const path of AIRFIELD_FENCE_PATHS)for(let i=1;i<path.length;i++){
  const [x0,z0]=path[i-1],[x1,z1]=path[i];
  // Horizontal front boundary must never span hangar's vehicle/taxi corridor.
  if(Math.abs(z0-gap.frontZ)<.01&&Math.abs(z1-gap.frontZ)<.01){
   const l=Math.min(x0,x1),r=Math.max(x0,x1);
   assert.ok(r<=gap.westEnd||l>=gap.eastEnd,
    'runway/hangar approach must be physically OPEN in the visual fence');
  }
 }
 assert.ok(AIRFIELD_FENCE_PATHS.length>=2);
 const fence=createAirfieldSecurityFence();
 assert.equal(fence.name,'AirfieldSecurityPerimeter');
 assert.ok(fence.userData.nonPlayable);
 assert.ok(fence.userData.postCount>25);
 assert.ok(fence.userData.wireCount>100);
 assert.ok(fence.userData.barbedCount>50);
 assert.equal(fence.children.length,3,'three instanced draw calls, not hundreds of meshes');
 for(const mesh of fence.children){
  assert.ok(mesh.isInstancedMesh);
  assert.equal(mesh.userData.nonPlayable,true);
  assert.equal(mesh.raycast(),undefined);
  assert.ok(mesh.count>0);
 }
 for(const child of fence.children){
  child.geometry.dispose();child.material.dispose();
 }
});

test('fine wire follows terrain and changing slope without affecting airfield pathing',()=>{
 const root=new THREE.Group(),yard=new THREE.Group();
 root.add(yard);
 const fence=createAirfieldSecurityFence();yard.add(fence);
 const posts=fence.getObjectByName('AirfieldFenceSteelPosts');
 const first=new THREE.Matrix4(),after=new THREE.Matrix4();
 posts.getMatrixAt(0,first);
 const result=conformAirfieldSecurityFence(yard,
  {x:1500,y:1200,facing:0},(x,z)=>Math.sin(x*.01)*6+Math.cos(z*.011)*5,0);
 posts.getMatrixAt(0,after);
 assert.equal(result,3);
 assert.notDeepEqual(Array.from(first.elements),Array.from(after.elements));
 const source=readFileSync('scripts/webgl-airfield-service.js','utf8');
 assert.match(source,/group\.add\(createAirfieldSecurityFence\(\)\)/);
 assert.match(source,/changed\+=conformAirfieldSecurityFence\(group,base,heightAt,origin\)/);
 assert.doesNotMatch(source,/AIRFIELD_FENCE_PATHS.*obstacles\(/);
 for(const child of fence.children){
  child.geometry.dispose();child.material.dispose();
 }
});
