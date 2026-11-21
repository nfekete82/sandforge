import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createDefensiveBunker} from '../scripts/webgl-strategic-buildings.js';
import {createReconDrone} from '../scripts/webgl-recon-drone.js';
import {visualUnitScale} from '../scripts/webgl-scale.js';
import {scoutRocketPodMount,attachScoutRocketPods,detachScoutRocketPods}
 from '../scripts/webgl-scout-rocket-pods.js';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';

test('bunker is 10% smaller with barracks-family real camouflage texture',()=>{
 for(const owner of [0,1]){
  const b=createDefensiveBunker(owner);
  assert.equal(b.scale.x,.9);
  assert.equal(b.scale.y,.9);
  assert.equal(b.scale.z,.9);
  assert.equal(b.userData.bunkerFiringPorts,5);
  assert.equal(b.userData.bunkerVisualScale,.9);
  assert.equal(BUILDINGS.bunker.width,155);
  assert.equal(BUILDINGS.bunker.hp,1500);
  const wall=b.children.find(n=>n.isMesh&&n.material?.userData?.bunkerCamo);
  assert.ok(wall,'concrete surfaces get actual UV-baked camo, not flat color');
  assert.equal(wall.material.userData.bunkerCamo,'barracks-sand-khaki-olive');
  assert.equal(wall.material.map.image.width,256);
  assert.equal(wall.material.map.colorSpace,THREE.SRGBColorSpace);
  for(let i=1;i<=5;i++)assert.ok(b.getObjectByName('Bunker_Embrasure_'+i));
 }
});
test('two low sandbag rings wrap bunker but leave the garrison door clear',()=>{
 const bunker=createDefensiveBunker(0);
 const bags=bunker.children.filter(n=>n.userData?.bunkerSandbags);
 assert.equal(bags.length,2);
 const positions=[];
 for(const [row,mesh] of bags.entries()){
  assert.ok(mesh.isInstancedMesh);
  assert.ok(mesh.count>=17);
  assert.equal(mesh.geometry.type,'CapsuleGeometry');
  assert.equal(mesh.userData.openEntrance,true);
  assert.equal(mesh.raycast(new THREE.Raycaster(),[]),undefined);
  const tmp=new THREE.Matrix4(),pos=new THREE.Vector3();
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,tmp);
   pos.setFromMatrixPosition(tmp);
   positions.push([pos.x,pos.y,pos.z]);
   assert.ok(!(Math.abs(pos.x)<23&&pos.z< -65),
    'entrance at -Z must never be obstructed by sandbags');
  }
  assert.ok(mesh.material.map?.isTexture);
 }
 assert.ok(positions.length>=35);
 assert.ok(positions.some(([x])=>x<-70));
 assert.ok(positions.some(([x])=>x>70));
});
test('recon R-01 is visually smaller, with unchanged simulation costs and flight',()=>{
 const model=createReconDrone(0);
 assert.ok(model.getObjectByName('R01_Rotor_0'));
 assert.equal(visualUnitScale('drone'),.77);
 assert.equal(UNITS.drone.cost,50);
 assert.equal(UNITS.drone.damage,0);
 assert.equal(UNITS.drone.flying,true);
});
test('both helicopter rocket pods now share exactly equal front-view offsets',()=>{
 assert.deepEqual(scoutRocketPodMount(-1),{x:-17,y:18,z:-5});
 assert.deepEqual(scoutRocketPodMount(1),{x:17,y:18,z:-5});
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 assert.equal(entry.scoutRocketPods.children.length,2);
 assert.equal(entry.scoutRocketMuzzles.length,2);
 detachScoutRocketPods(entry);
});
test('bomber uses its original PBR textures, not blackening triplanar shader',()=>{
 const src=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(src,/entry\.kind!=='bomber'\)\s*entry\.microSurface=enhanceMilitaryMicroPBR/);
 assert.match(src,/enhanceMilitaryMicroPBR\(model,\{kind:entry\.kind,type\}\)/);
 assert.match(src,/BOMBER_VISUAL_STRETCH/);
});
