import test from 'node:test';
import assert from 'node:assert/strict';
import {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard}
 from '../scripts/webgl-factory-service.js';
import {FACTORY_LIFT_HEIGHT} from '../scripts/webgl-service-grounding.js';
import {factoryRepairPoint} from '../dist/src/reborn/factory-maintenance.js';
import {readFileSync} from 'node:fs';

test('factory side service is an open hydraulic platform, NEVER a second garage or production exit',()=>{
 const yard=createFactoryServiceYard();
 assert.equal(yard.name,'FactoryOpenAirRepairPlatform');
 assert.equal(yard.userData.openAirPlatform,true);
 assert.ok(yard.userData.visualOnly&&yard.userData.nonPlayable);
 const names=[];
 yard.traverse(node=>names.push(node.name??''));
 for(const forbidden of ['FactorySideWorkshopWallLeft','FactorySideWorkshopWallRight',
  'FactorySideWorkshopRear','FactoryRepairGarageRoof_0',
  'FactoryServiceDoorLeft_0','FactoryServiceDoorRight_0',
  'FactoryServiceGarageHeader_0','FactoryRoofAirDuct_0',
  'FactoryServiceGarageNumber_0','FactoryGarageRoofRib_0'])
  assert.equal(names.includes(forbidden),false,'remove side-garage enclosure: '+forbidden);
 assert.equal(yard.getObjectByName('FactoryRollupDoor'),undefined,
  'original production gate lives in original factory GLB, not service platform');
 const deck=yard.getObjectByName('VehicleLiftPlatform_0');
 assert.ok(deck);
 assert.equal(deck.position.x,192);
 assert.equal(deck.position.z,45);
 assert.equal(deck.position.y+deck.geometry.parameters.height/2,FACTORY_LIFT_HEIGHT,
  'visual repair floor matches actual paid service altitude');
 assert.ok(yard.getObjectByName('VehicleDriveOnRamp_0'));
 assert.ok(yard.getObjectByName('FactoryRepairToolTray_0'));
 // Large visible walls/garage posts must not block newly produced vehicles.
 yard.traverse(node=>{
  if(!node.isMesh||!node.visible||!node.parent.visible)return;
  const h=node.geometry.parameters.height??0;
  if(node.parent===yard)
   assert.ok(node.position.y+h/2<=11,
    node.name+' creates an obstacle higher than the service deck');
 });
 assert.deepEqual(factoryRepairPoint({x:1000,y:2000,facing:0},0),{x:1192,y:2045});
 assert.deepEqual(factoryRepairPoint({x:1000,y:2000,facing:0},0,true),{x:1192,y:2160});
 for(const side of [0,1])
  assert.deepEqual(factoryRepairPoint({x:1000,y:2000,facing:0},side),
   {x:1192,y:2045},'legacy save bay mappings unchanged');
 const count=yard.children.length;
 assert.ok(count<28,'compact service pad, not another building');
 const entry={factoryServiceYard:yard};disposeFactoryServiceYard(entry);
 assert.equal(entry.factoryServiceYard,null);
});
test('open-air repair status and welding effects work without fake garage shutters',()=>{
 const yard=createFactoryServiceYard();
 const base={id:47},entry={factoryServiceYard:yard};
 const state=yard.userData.bay0;
 assert.equal(state.doorLeft,undefined);
 assert.equal(state.doorRight,undefined);
 assert.equal(state.doorOpen,undefined);
 const tank={id:6,hp:500,factoryService:{baseId:47,bay:0,phase:'approach'}};
 updateFactoryServiceYard(entry,base,[tank],.4);
 assert.equal(state.indicator.visible,true);
 assert.equal(state.icon.visible,false);
 tank.factoryService.phase='repair';
 updateFactoryServiceYard(entry,base,[tank],1.1);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,true);
 tank.factoryService.phase='ready';
 updateFactoryServiceYard(entry,base,[tank],2.0);
 assert.equal(state.icon.visible,true);
 assert.equal(state.sparks.visible,false);
 updateFactoryServiceYard(entry,base,[],3);
 assert.equal(state.indicator.visible,false);
 assert.equal(state.icon.visible,false);
 assert.equal(state.sparks.visible,false);
 disposeFactoryServiceYard(entry);
});
test('original 3D factory exit and queued tank/Humvee/rocket-truck rollout were not replaced',()=>{
 const gate=readFileSync('scripts/webgl-production-gates.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const service=readFileSync('scripts/webgl-factory-service.js','utf8');
 assert.match(gate,/getObjectByName\('FactoryRollupDoor'\)/);
 assert.match(gate,/const outside=gate\.meshyShutter\?[\s\S]*?gate\.openBay\?new THREE\.Vector3\(\.18,\.16,3\.45\)/);
 assert.match(gate,/if\(!gate\.meshyShutter&&!gate\.meshyInfantry\)root\.localToWorld\(outside\)/);
 assert.doesNotMatch(battlefield,/createFactoryServiceYard\(\)|updateFactoryServiceYard\(/,
  'retired automated factory repair bays must stay out of the real battlefield');
 assert.doesNotMatch(service,/FactoryServiceDoorLeft|FactoryServiceDoorRight|FactoryRepairGarageRoof|FactorySideWorkshopWall/);
});
