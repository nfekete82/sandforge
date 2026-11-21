import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHeadquartersHingedDoor,coverHeadquartersAnnexCrest,
 HQ_DETAILS_REVISION} from '../scripts/webgl-meshy-hq-details.js';

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
 assert.match(HQ_DETAILS_REVISION,/snug-double-door/);
 const dimensions=bounds.getSize(new THREE.Vector3());
 assert.ok(door.width<=dimensions.x*.116+1e-7);
 assert.ok(door.height<=dimensions.y*.178+1e-7);
 assert.equal(door.open,0);
 const faceOffset=door.rig.position.z-5;
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
