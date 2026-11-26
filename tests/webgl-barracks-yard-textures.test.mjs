import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';

test('barracks perimeter is a slim barbed-wire fence with a clear front infantry gate',()=>{
 const yard=createBuildingYard('barracks',160);
 assert.ok(yard);
 const perimeter=yard.getObjectByName('BasePerimeter_barracks');
 assert.ok(perimeter);
 assert.equal(perimeter.userData.barracksWireFence,true);
 assert.equal(perimeter.userData.fenceRails,0);
 assert.equal(perimeter.getObjectByName('YardFenceRails'),undefined);
 assert.equal(perimeter.getObjectByName('YardFenceMesh'),undefined);
 const posts=perimeter.getObjectByName('BarracksWireFencePosts');
 const strands=perimeter.getObjectByName('BarracksWireFenceStrands');
 const barbs=perimeter.getObjectByName('BarracksWireFenceBarbs');
 assert.ok(posts?.isInstancedMesh);
 assert.ok(strands?.isInstancedMesh);
 assert.ok(barbs?.isInstancedMesh);
 assert.ok(posts.count>20&&barbs.count>strands.count);
 assert.ok(strands.geometry.parameters.radiusTop<.25,'no thick wooden rails');
 const helper=new THREE.Matrix4(),position=new THREE.Vector3();
 for(let i=0;i<posts.count;i++){
  posts.getMatrixAt(i,helper);
  position.setFromMatrixPosition(helper);
  assert.ok(!(Math.abs(position.z-160*.28)<.1&&Math.abs(position.x)<160*.22),
   'gate must be free of posts, allowing infantry to spawn and exit');
 }
 assert.equal(strands.material.map?.isDataTexture,true);
 assert.equal(strands.material.normalMap?.isDataTexture,true);
 assert.equal(strands.material.roughnessMap?.isDataTexture,true);
 disposeBuildingYard(yard);
});

test('all visible barracks yard props use texture maps (except emissive lamp glass)',()=>{
 const yard=createBuildingYard('barracks',160);
 const inspected=[];
 yard.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.name==='LampDiffuser')return;
  inspected.push(mesh.name);
  const mat=mesh.material;
  assert.ok(mat.map?.isDataTexture,mesh.name+' missing BaseColor');
  assert.ok(mat.normalMap?.isDataTexture,mesh.name+' missing normals');
  assert.ok(mat.roughnessMap?.isDataTexture,mesh.name+' missing roughness');
  assert.equal(mat.map.colorSpace,THREE.SRGBColorSpace);
 });
 assert.ok(inspected.includes('InfantryHelmet'));
 assert.ok(inspected.includes('RifleBarrel'));
 assert.ok(inspected.includes('CrateBody'));
 assert.ok(inspected.includes('BarracksWireFenceStrands'));
 assert.ok(inspected.length>35,'check all equipment, not just one sample');
 disposeBuildingYard(yard);
});

test('factory, research centre and missile silo all use barracks-style slim wire',()=>{
 for(const kind of ['factory','research','silo']){
  const yard=createBuildingYard(kind,kind==='silo'?265:160);
  const perimeter=yard.getObjectByName('BasePerimeter_'+kind);
  assert.ok(perimeter?.getObjectByName('BarracksWireFenceStrands')?.isInstancedMesh,
   kind+' needs thin horizontal wire strands');
  assert.ok(perimeter.getObjectByName('BarracksWireFenceBarbs')?.isInstancedMesh);
  assert.equal(perimeter.getObjectByName('YardFenceRails'),undefined);
  assert.equal(perimeter.getObjectByName('YardFenceMesh'),undefined);
  assert.equal(perimeter.userData.barracksWireFence,true);
  disposeBuildingYard(yard);
 }
});

test('legacy interceptor fence still has X-bracing',()=>{
 const yard=createBuildingYard('interceptor',160);
 const perimeter=yard.getObjectByName('BasePerimeter_interceptor');
 assert.ok(perimeter.getObjectByName('YardFenceRails'));
 assert.ok(perimeter.getObjectByName('YardFenceMesh'));
 assert.equal(perimeter.getObjectByName('BarracksWireFenceStrands'),undefined);
 disposeBuildingYard(yard);
});


test('barracks supply cache stays fully clear of the side wire and rear fence',()=>{
 for(const width of [158,160,184]){
  const yard=createBuildingYard('barracks',width);
  const supplies=yard.getObjectByName('BaseSupplyCache');
  const fence=yard.getObjectByName('BarracksWireFencePosts');
  assert.ok(supplies&&fence);
  yard.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(supplies);
  const sideFence=width*.65;
  const rearFence=-width*.53;
  assert.ok(bounds.max.x<=sideFence-4,
   'crate/pallet extends into the right-side wire at width '+width+
   ': maxX='+bounds.max.x+' fence='+sideFence);
  assert.ok(bounds.min.x>width*.36,
   'barracks depot should stay at the exterior flank');
  assert.ok(bounds.min.z>=rearFence+4,
   'depot extends into the rear fence at width '+width);
  assert.ok(bounds.max.z<width*.28-4,
   'depot extends into the front fence/gate at width '+width);
  assert.equal(supplies.children.filter(c=>c.name==='SupplyCrate').length,2);
  assert.ok(supplies.getObjectByName('SupplyPallet'));
  disposeBuildingYard(yard);
 }
});

test('headquarters PBR depot keeps real crate geometry clear of its wire fence',()=>{
 // Covers both the compact test yard and the production-sized HQ (225).
 for(const width of [160,225]){
  const hq=createBuildingYard('headquarters',width);
  const cache=hq.getObjectByName('BaseSupplyCache');
  const perimeter=hq.getObjectByName('BasePerimeter_headquarters');
  assert.ok(cache&&perimeter?.userData.barracksWireFence);
  assert.equal(cache.position.x,width*.47,'HQ depot is shifted inside wire');
  assert.equal(cache.getObjectByName('SupplyPallet').geometry.parameters.width,28);
  assert.equal(cache.getObjectByName('CrateBody').material.map?.isDataTexture,true);
  hq.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(cache);
  const clearance=width*.65-bounds.max.x;
  assert.ok(clearance>=8,
   'HQ crate/pallet overlaps side fence at width '+width+
   ': right edge='+bounds.max.x+', wire='+width*.65+
   ', clearance='+clearance);
  assert.ok(bounds.min.z>-width*.53+8,
   'HQ depot must not overlap rear fence at width '+width);
  assert.ok(bounds.max.z<width*.28-8,
   'HQ depot must not block engineer gate at width '+width);
  disposeBuildingYard(hq);
 }
 const width=160;
 const factory=createBuildingYard('factory',width);
 const cache=factory.getObjectByName('BaseSupplyCache');
 assert.equal(cache.position.x,width*.43,'factory depot clears the shutter exit');
 assert.equal(cache.getObjectByName('SupplyPallet').geometry.parameters.width,43);
 disposeBuildingYard(factory);
});
