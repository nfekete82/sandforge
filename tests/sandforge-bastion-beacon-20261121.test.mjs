import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {attachBastionBeacon,bastionOwnerLight,setBastionBeaconColor,
 detachBastionBeacon,BASTION_BEACON_COLORS} from '../scripts/webgl-bastion-beacon.js';

test('blue, red, and neutral-owned bastions show blue/red/white 3D lights',()=>{
 const node=new THREE.Group();
 const glow=attachBastionBeacon(node,-1);
 assert.equal(glow.parent,node);
 assert.equal(bastionOwnerLight(-1),BASTION_BEACON_COLORS.neutral);
 assert.equal(bastionOwnerLight(null),BASTION_BEACON_COLORS.neutral);
 assert.equal(glow.children.length,5);
 for(const owner of [0,1,-1,0,-1,1]){
  setBastionBeaconColor(glow,owner);
  for(const mesh of glow.children)
   assert.equal(mesh.material.color.getHexString(),new THREE.Color(bastionOwnerLight(owner)).getHexString());
 }
 assert.equal(attachBastionBeacon(node,1),glow);
 assert.equal(node.children.length,1);
 assert.ok(glow.children.every(mesh=>mesh.raycast instanceof Function));
 detachBastionBeacon(glow);
 assert.equal(node.children.length,0);
});
test('ownership colour survives income upgrades and 3D source swaps',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(battlefield,/setBastionBeaconColor\(entry.ownerBeacon,territory.owner\)/);
 assert.match(battlefield,/entry.halo.material.color.set\(bastionOwnerLight\(territory.owner\)\)/);
 assert.match(battlefield,/attachBastionBeacon\(node,t.owner\)/);
 assert.match(battlefield,/detachBastionBeacon\(entry.ownerBeacon\)/);
 assert.doesNotMatch(battlefield,/entry.halo.material.color.set\(promoted\?'#e8c15d'/);
});
