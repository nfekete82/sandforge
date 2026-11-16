import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareBarracksPortal,setBarracksDoorOpen,updateBarracksPortalPlanes,disposeBarracksPortal}
 from '../scripts/webgl-barracks-portal.js';
import {SandforgeProductionGates} from '../scripts/webgl-production-gates.js';

/** Exact mesh naming of the user's final, separately textured barracks GLB.
 * Its actual doors sit at local z=4 rather than the old Atlas z=1.5. */
function pbrFixture(){
 const detail=new THREE.Group();
 const names=['door_leaf_L','door_leaf_R','door_recess_back',
  'door_panel_-1_0','door_panel_-1_1','door_panel_-1_2','door_handle_-1',
  'door_panel_1_0','door_panel_1_1','door_panel_1_2','door_handle_1',
  'front_wall_1','front_wall_-1','roof_top_center'];
 for(const name of names){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.25,.25),
   new THREE.MeshStandardMaterial({name:'test '+name}));
  mesh.name=name;
  detail.add(mesh);
 }
 const node=new THREE.Group();node.add(detail);
 const entry={detail,node,kind:'barracks'};
 return {entry,detail,node};
}

test('final PBR double leaves animate with handles and panel ribs, without legacy shutter',()=>{
 const {entry,detail}=pbrFixture();
 const renderer={localClippingEnabled:false};
 const originalLeafL=detail.getObjectByName('door_leaf_L');
 const originalLeafR=detail.getObjectByName('door_leaf_R');
 const panel=detail.getObjectByName('door_panel_-1_0');
 const rear=detail.getObjectByName('door_recess_back');
 const facade=detail.getObjectByName('front_wall_1');
 const originalWallMaterial=facade.material;
 const portal=prepareBarracksPortal(entry,renderer);
 assert.equal(portal.pbrDoor,true);
 assert.equal(portal.doorPanels.length,10);
 assert.equal(renderer.localClippingEnabled,false,
  'separate PBR facade must not need destructive clipping');
 assert.equal(portal.rebuilt.length,0,'do not build phantom Atlas shutter');
 assert.equal(detail.getObjectByName('BarracksBlastDoor_Recovery'),undefined);
 assert.equal(originalLeafL.position.x,0);
 assert.equal(originalLeafR.position.x,0);
 setBarracksDoorOpen(portal,.5);
 assert.ok(Math.abs(originalLeafL.position.x-.69)<1e-6);
 assert.ok(Math.abs(originalLeafR.position.x+.69)<1e-6);
 assert.ok(Math.abs(panel.position.x-.69)<1e-6);
 assert.equal(rear.visible,false,'opaque recess must clear for exiting soldier');
 assert.equal(portal.hall.visible,true);
 updateBarracksPortalPlanes(portal);
 assert.equal(facade.material,originalWallMaterial,
  'PBR wall/door surface textures must be preserved');
 setBarracksDoorOpen(portal,1);
 assert.ok(Math.abs(originalLeafL.position.x-1.38)<1e-6);
 disposeBarracksPortal(entry);
 assert.equal(originalLeafL.position.x,0);
 assert.equal(originalLeafR.position.x,0);
 assert.equal(panel.position.x,0);
 assert.equal(rear.visible,true);
 assert.equal(entry.barracksPortal,undefined);
 assert.equal(detail.getObjectByName('BarracksPbrInterior'),undefined);
});

test('finished infantry actually walks through final PBR front at z≈4 instead of legacy z≈1.5',()=>{
 const {entry,detail,node}=pbrFixture();
 detail.scale.setScalar(12);node.updateMatrixWorld(true);
 const actor={node:new THREE.Group()};
 const base={id:501,kind:'barracks',owner:0,hp:800,facing:0,x:1000,y:1000};
 const soldier={id:801,kind:'infantry',owner:0,hp:100,x:1100,y:1080,
  orders:[],angle:0,fire:0,combatTarget:null};
 const event={baseId:501,unitId:801,kind:'infantry',owner:0,at:10,
  from:{x:base.x,y:base.y},to:{x:soldier.x,y:soldier.y}};
 const game={time:10,bases:[base],units:[soldier],productionReleases:[],
  stageWebGLProduction:true,extendProductionDeparture(){},cancelProductionDeparture(){}};
 const battlefield={
  game,world:{size:2000,walkable:()=>true,obstacles:()=>[]},
  bases:new Map([[base.id,entry]]),
  units:new Map([[soldier.id,actor]]),
  renderer:{localClippingEnabled:false},
  heightAt:()=>0,
  entityPosition:()=>new THREE.Vector3(100,0,80)
 };
 const gates=new SandforgeProductionGates(battlefield);
 game.productionReleases.push(event); // fresh event arrives after controller initialization
 function step(age){
  game.time=10+age;
  // The real battlefield does this before the cosmetic gate pass.
  actor.node.visible=true;
  actor.node.position.set(100,0,80);
  gates.update(true,1);
 }
 step(0);
 assert.equal(gates.active.size,1,'real PBR door must be recognized as ready');
 assert.equal(entry.gate.portal.pbrDoor,true);
 step(2.1);
 assert.ok(actor.node.position.z>37,
  'soldier must emerge at the authored front door, not z=1.5: '+actor.node.position.z);
 assert.ok(entry.gate.portal.doorPanels[0].mesh.position.x>0);
 const state=gates.active.get(base.id);
 step(1.25+state.duration+1.1);
 assert.equal(gates.active.size,0);
 assert.equal(entry.gate.portal.doorPanels[0].mesh.position.x,0,
  'doors should reclose after the soldier has safely departed');
 assert.equal(soldier.x,1100,'renderer must never teleport authoritative simulation unit');
 assert.equal(soldier.y,1080);
 gates.dispose();
});
