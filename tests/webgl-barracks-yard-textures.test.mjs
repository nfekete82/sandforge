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

test('other building perimeter fences retain their previous design and materials',()=>{
 const hq=createBuildingYard('headquarters',160);
 const perimeter=hq.getObjectByName('BasePerimeter_headquarters');
 assert.ok(perimeter.getObjectByName('YardFenceRails'));
 assert.ok(perimeter.getObjectByName('YardFenceMesh'));
 assert.equal(perimeter.getObjectByName('BarracksWireFenceStrands'),undefined);
 assert.equal(perimeter.userData.barracksWireFence,undefined);
 disposeBuildingYard(hq);
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

test('headquarters depot keeps previous size and placement',()=>{
 const width=160,yard=createBuildingYard('headquarters',width);
 const cache=yard.getObjectByName('BaseSupplyCache');
 assert.ok(cache);
 assert.equal(cache.position.x,width*.55);
 assert.equal(cache.getObjectByName('SupplyPallet').geometry.parameters.width,43);
 disposeBuildingYard(yard);
});
