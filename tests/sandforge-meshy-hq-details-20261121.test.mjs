import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadquartersHingedDoor,coverHeadquartersAnnexCrest,
 HQ_DETAILS_REVISION,calibrateHeadquartersCrestAtHit,readHQEmblemAnchor,
 HQ_EMBLEM_ANCHOR_KEY} from '../scripts/webgl-meshy-hq-details.js';

function sampleHeadquarters(){
 const model=new THREE.Group();
 const material=new THREE.MeshStandardMaterial({
  color:'#8b8574',roughness:.82,metalness:.32
 });
 const building=new THREE.Mesh(new THREE.BoxGeometry(12,6,10),material);
 building.name='Real_Meshy_HQ_Skin';
 model.add(building);
 model.userData.sandforgeRealHQDoorway={x:0,z:5};
 return {model,material,building,bounds:new THREE.Box3().setFromObject(model)};
}
test('HQ has smaller flush-fitting double doors instead of a fake garage',()=>{
 const {model,building,bounds}=sampleHeadquarters();
 const door=createHeadquartersHingedDoor(model,bounds);
 assert.ok(door);
 assert.match(HQ_DETAILS_REVISION,/real-door-cover-and-crest-calibration/);
 const dimensions=bounds.getSize(new THREE.Vector3());
 assert.ok(door.width<=dimensions.x*.158+1e-7);
 assert.ok(door.height<=dimensions.y*.235+1e-7);
 assert.equal(door.open,0);
 const faceOffset=door.rig.position.z-5;
 assert.ok(door.rig.position.x<0,'door shifted toward real door leaves');
 assert.ok(door.backing.position.z>0,'painted old Meshy doors hidden by dark recess');
 assert.ok(faceOffset>0&&faceOffset<dimensions.z*.004);
 const originalCount=model.children.filter(n=>n.name==='Real_Meshy_HQ_Skin').length;
 door.setOpen(1);
 assert.ok(Math.abs(door.left.rotation.y+1.12)<1e-7);
 assert.ok(Math.abs(door.right.rotation.y-1.12)<1e-7);
 assert.equal(model.children.filter(n=>n.name==='Real_Meshy_HQ_Skin').length,originalCount);
 assert.equal(door.rig.children.filter(n=>n.name.startsWith('SF_HQ_OriginalDoor_Hinge')).length,2);
 door.setOpen(0);
 assert.equal(door.right.rotation.y,0);
 assert.equal(door.left.rotation.y,0);
 assert.equal(building.material,model.children[0].material);
});
test('crest cover conforms to real side/front geometry and never edits original materials',()=>{
 const {model,building,bounds,material}=sampleHeadquarters();
 const cover=coverHeadquartersAnnexCrest(model,bounds);
 assert.ok(cover,'real curved / side surface receives a cover');
 assert.ok(cover.userData.coveredTriangles>0);
 assert.ok(cover.userData.projectionSurfaces>=1);
 assert.equal(building.material,material);
 assert.ok(cover.children.every(n=>n.isMesh&&n.geometry.getAttribute('position')));
 assert.ok(cover.children.every(n=>n.renderOrder===11));
 assert.equal(coverHeadquartersAnnexCrest(model,bounds),cover);
 assert.equal(building.geometry.getAttribute('position').count,24);
});

test('one click on real crest surface calibrates exact projection and persists across GLB clones',()=>{
 const previous=globalThis.localStorage,contents=new Map();
 globalThis.localStorage={
  getItem:key=>contents.get(key)??null,
  setItem:(key,value)=>contents.set(key,value),
  removeItem:key=>contents.delete(key)
 };
 try{
  const {model,building,bounds}=sampleHeadquarters();
  model.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(new THREE.Vector3(8,1.25,1),
   new THREE.Vector3(-1,0,0));
  const hit=ray.intersectObject(building,false)[0];
  assert.ok(hit);
  const adjusted=calibrateHeadquartersCrestAtHit(model,hit);
  assert.ok(adjusted,'picked logo must generate PBR cover');
  assert.ok(adjusted.coveredTriangles>0);
  assert.equal(contents.has(HQ_EMBLEM_ANCHOR_KEY),true);
  const saved=readHQEmblemAnchor();
  assert.ok(saved);
  assert.ok(saved.p.every(v=>v>=0&&v<=1));
  assert.equal(model.getObjectByName('SF_HQ_Annex_UnmarkedMetal').userData.calibrated,true);
  const second=sampleHeadquarters();
  const again=coverHeadquartersAnnexCrest(second.model,second.bounds);
  assert.ok(again);
  assert.equal(again.userData.calibrated,true);
  assert.ok(again.userData.coveredTriangles>0);
 }finally{
  if(previous===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=previous;
 }
});
