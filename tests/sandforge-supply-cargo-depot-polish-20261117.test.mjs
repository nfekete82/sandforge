import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {supplyVisibleCrateCount,setCustomSupplyCargo} from '../scripts/webgl-supply-custom.js';
import {createSupplyTruckVisual,setSupplyTruckCargo,createSupplyCacheVisual}
 from '../scripts/webgl-supply-logistics.js';
import {stepSupplyLogistics,SUPPLY_LOAD} from '../dist/src/reborn/supply-logistics.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const sceneTruck=()=>{
 const root=new THREE.Group();
 const wheel=new THREE.Group();wheel.name='wheel_FRONT_L';root.add(wheel);
 for(let i=0;i<8;i++){
  const stack=new THREE.Group();stack.name='cargo_stack_'+i;root.add(stack);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));stack.add(body);
 }
 return root;
};
const visible=root=>Array.from({length:8},(_,i)=>
 root.getObjectByName('cargo_stack_'+i)).filter(n=>n.visible).length;

test('custom GLB bed visibly loads, travels, unloads and remains empty after payout',()=>{
 const root=sceneTruck();
 const check=(job,expected)=>{
  assert.equal(setCustomSupplyCargo(root,job),true);
  assert.equal(visible(root),expected,JSON.stringify(job));
  assert.equal(root.userData.supplyVisibleCrates,expected);
 };
 check({cargo:0,phase:'seek',clock:0},0);
 check({cargo:0,phase:'loading',clock:0},0);
 check({cargo:0,phase:'loading',clock:1.2},4);
 check({cargo:0,phase:'loading',clock:2.4},8);
 check({cargo:SUPPLY_LOAD,phase:'to-hq',clock:0},8);
 check({cargo:SUPPLY_LOAD,phase:'unloading',clock:0},8);
 check({cargo:SUPPLY_LOAD,phase:'unloading',clock:.7},4);
 check({cargo:SUPPLY_LOAD,phase:'unloading',clock:1.4},0);
 check({cargo:0,phase:'seek',clock:0},0);
 check({cargo:0,phase:'to-cache',clock:0},0);
 assert.equal(supplyVisibleCrateCount({cargo:0,phase:'seek'}),0);
 assert.equal(supplyVisibleCrateCount({cargo:23,phase:'to-hq'}),5);
});

test('procedural fallback cargo also unloads in eight visible steps',()=>{
 const root=createSupplyTruckVisual(0);
 const cargo=root.getObjectByName('SF_Supply_Cargo');
 assert.ok(cargo);
 assert.equal(cargo.children.length,8);
 const load=(phase,clock,credit)=>{
  setSupplyTruckCargo(root,{phase,clock,cargo:credit});
  return cargo.children.filter(x=>x.visible).length;
 };
 assert.equal(load('loading',1.2,0),4);
 assert.equal(load('to-hq',0,45),8);
 assert.equal(load('unloading',.7,45),4);
 assert.equal(load('seek',0,0),0);
 assert.equal(cargo.visible,false,'nothing is rendered on an empty bed');
});

test('the neutral fallback is entirely open, with smaller visible crates',()=>{
 const root=createSupplyCacheVisual();
 assert.ok(root.getObjectByName('SF_DepotConcretePad'));
 const forbidden=root.children.filter(n=>/Ramp|LoadingLane|Hazard|ConcreteJoint|GridLine/i.test(n.name));
 assert.deepEqual(forbidden.map(n=>n.name),[]);
 const piles=root.userData.piles;
 assert.equal(piles.length,18);
 for(const group of piles){
  const main=group.children.find(n=>n.name==='SupplyCrate');
  assert.ok(main,'independent stock group includes an actual crate');
  const size=new THREE.Box3().setFromObject(main).getSize(new THREE.Vector3());
  assert.ok(size.x<=17&&size.y<=17.5&&size.z<=16,'no oversized supply crate');
 }
});

test('compiled yard GLB has no stripes, no ramp and eighteen hideable pallets',()=>{
 const buffer=readFileSync('dist/supply-pbr-qa/supply-depot-neutral.glb');
 const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString('utf8').trim());
 const names=json.nodes.map(n=>n.name);
 assert.ok(names.includes('SF_DepotConcretePad'));
 assert.equal(names.filter(n=>/^SF_DepotStock_\d{2}$/.test(n)).length,18);
 assert.equal(names.filter(n=>/Ramp|LoadingLane|Hazard|ConcreteJoint|GridLine/i.test(n)).length,0);
 assert.equal(json.animations?.some(x=>x.name==='DepotRampLower')??false,false);
 assert.ok(json.animations?.some(x=>x.name==='DepotBeaconPulse'));
});

test('truck returned to HQ unloads without reaching a blocked decor waypoint',()=>{
 const game=new Simulation(2026,23);
 game.tactical.plan=()=>{};
 const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 const truck=game.spawn(0,{x:hq.x+205,y:hq.y},'supply');
 truck.supply={auto:true,phase:'to-hq',cacheId:0,cargo:SUPPLY_LOAD,clock:0,
  destination:{x:hq.x+285,y:hq.y}};
 const initial=game.credits[0];
 stepSupplyLogistics(game,.05);
 assert.equal(truck.supply.phase,'unloading','within HQ delivery radius');
 for(let i=0;i<30&&truck.supply.cargo>0;i++){
  game.time+=.05;
  stepSupplyLogistics(game,.05);
 }
 assert.equal(truck.supply.cargo,0,'real economy cargo is deposited');
 assert.equal(truck.supply.phase,'seek','start next trip after physical unloading');
 assert.equal(game.credits[0]-initial,SUPPLY_LOAD);
});
