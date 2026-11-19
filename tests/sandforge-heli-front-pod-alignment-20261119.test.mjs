import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 scoutRocketPodMount,attachScoutRocketPods,detachScoutRocketPods
} from '../scripts/webgl-scout-rocket-pods.js';

test('front view: port stays fixed; right launcher moves inside and forward',()=>{
 const port=scoutRocketPodMount(-1);
 const starboard=scoutRocketPodMount(1);
 assert.deepEqual(port,{x:-23,y:18,z:-5},
  'do not move the user-approved left launcher');
 assert.deepEqual(starboard,{x:17,y:18,z:-5},
  'right launcher goes 2 units inward and 1 forward from its old position');
 assert.equal(port.z,starboard.z,'front alignment is not a depth illusion');
 assert.equal(port.y,starboard.y,'mounts level with each other');
 assert.ok(starboard.x>=16&&starboard.x<=18,
  'right pod must stay clear of the cabin but no longer hover outside');
});

for(const owner of [0,1])test('actual rendered pod and muzzle follow calibrated mounts, owner '+owner,()=>{
 const entry={kind:'scout',owner,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 try{
  const [left,right]=entry.scoutRocketPods.children;
  assert.equal(left.position.x,-23);
  assert.equal(right.position.x,17);
  assert.equal(left.position.z,right.position.z);
  assert.equal(left.position.y,right.position.y);
  assert.equal(left.scale.x,-1);
  assert.equal(right.scale.x,1);
  entry.node.updateMatrixWorld(true);
  const [l,r]=entry.scoutRocketMuzzles.map(n=>n.getWorldPosition(new THREE.Vector3()));
  assert.equal(l.z,r.z,'both rocket origins are on the same longitudinal plane');
  assert.equal(l.y,r.y,'both rocket origins are level');
  assert.ok(l.x<0&&r.x>0,'launcher origins remain on opposite sides');
  assert.equal(left.children.length,right.children.length,
   'only positions change; the same pair of launch tubes stays on both sides');
  const materials=new Set();
  entry.scoutRocketPods.traverse(n=>{if(n.isMesh)materials.add(n.material);});
  assert.equal(materials.size,3,'do not duplicate geometry paint for starboard');
 }finally{
  detachScoutRocketPods(entry);
 }
 assert.equal(entry.node.children.length,0);
 assert.equal(entry.scoutRocketPods,undefined);
});
