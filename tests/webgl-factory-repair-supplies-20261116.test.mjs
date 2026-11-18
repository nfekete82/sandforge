import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createFactoryServiceYard,disposeFactoryServiceYard}
 from '../scripts/webgl-factory-service.js';

test('repair platform has three crates and three drums BEHIND its lift, not on the ramp',()=>{
 const yard=createFactoryServiceYard();
 const decor=yard.getObjectByName('FactoryRearRepairSupplies_0');
 const lift=yard.getObjectByName('VehicleLiftPlatform_0');
 const ramp=yard.getObjectByName('VehicleDriveOnRamp_0');
 assert.ok(decor?.isGroup&&lift?.isMesh&&ramp?.isMesh);
 assert.equal(decor.userData.decorativeSupplies,true);
 for(let i=0;i<3;i++){
  assert.ok(decor.getObjectByName('FactoryRepairCrate_'+i));
  assert.ok(decor.getObjectByName('FactoryRepairCrateLid_'+i));
  assert.ok(decor.getObjectByName('FactoryRepairBarrel_'+i));
  assert.ok(decor.getObjectByName('FactoryRepairBarrelLid_'+i));
 }
 const decorBounds=new THREE.Box3().setFromObject(decor);
 const liftBounds=new THREE.Box3().setFromObject(lift);
 const rampBounds=new THREE.Box3().setFromObject(ramp);
 assert.ok(decorBounds.max.z<liftBounds.min.z-8,
  'logistics props need a clear margin behind the rear platform edge');
 assert.ok(decorBounds.max.z<rampBounds.min.z-15,
  'decor must never obstruct the drive-on ramp');
 assert.equal(yard.getObjectByName('FactoryServiceTireTrack_0'),undefined);
 const names=[];
 yard.traverse(o=>{if(o.isMesh)names.push(o.name)});
 assert.ok(names.every(n=>!n.startsWith('FactoryServiceTireTrack_')));
 assert.ok(names.some(n=>n.startsWith('RepairRampGrip_')),'retain real ramp traction');
 assert.equal(lift.position.y,8,'existing service height remains unchanged');
 assert.equal(lift.position.z,45,'existing repair waypoint remains unchanged');
 assert.ok(decor.children.every(o=>o.raycast?.({})===undefined),
  'props should not be selectable gameplay geometry');
 disposeFactoryServiceYard({factoryServiceYard:yard});
});

test('factory scene decoration does not affect physics or production lanes',()=>{
 const service=readFileSync('scripts/webgl-factory-service.js','utf8');
 assert.doesNotMatch(service,/FactoryServiceTireTrack_0/);
 assert.match(service,/visualOnly:true,nonPlayable:true,decorativeSupplies:true/);
 assert.match(service,/block\(root,'VehicleLiftPlatform_0',\[92,3,91\],\[cx,8,45\],deck\)/);
 assert.match(service,/const ramp=block\(root,'VehicleDriveOnRamp_0'/);
});
