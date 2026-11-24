import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {SandforgeProductionGates} from '../scripts/webgl-production-gates.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

function glb(kind,owner){
 const file='dist/src/assets/reborn/buildings-3d/'+kind+'-'+owner+'.glb';
 const raw=readFileSync(file);
 assert.equal(raw.toString('ascii',0,4),'glTF',file);
 assert.equal(raw.readUInt32LE(8),raw.length,file);
 const jsonLength=raw.readUInt32LE(12);
 return JSON.parse(raw.toString('utf8',20,20+jsonLength));
}
test('one Sandforge build contains BOTH team PBR barracks and command centers',()=>{
 for(const owner of [0,1]){
  for(const [kind,parts] of [
   ['barracks',['door_leaf_L','door_leaf_R','door_recess_back']],
   ['headquarters',['HQ_door_leaf_L','HQ_door_leaf_R',
    'HQ_Radar_01_LargeDish_Rotor','HQ_Radar_02_PhasedArray_Rotor']]
  ]){
   const document=glb(kind,owner);
   const names=new Set(document.nodes.map(n=>n.name));
   for(const name of parts)assert.ok(names.has(name),kind+' team '+owner+' misses '+name);
   assert.ok(document.images?.length>0,kind+' team '+owner+' must have image PBR materials');
   assert.ok(document.meshes?.length>10,kind+' must be an actual 3D asset');
  }
 }
});
function visual(kind,x){
 const detail=new THREE.Group();
 const names=kind==='headquarters'?
  ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_door_recess_back']:
  ['door_leaf_L','door_leaf_R','door_recess_back'];
 for(const name of names){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshStandardMaterial());
  mesh.name=name;detail.add(mesh);
 }
 const node=new THREE.Group();node.add(detail);detail.scale.setScalar(13);node.position.x=x;
 return {detail,node,kind};
}
test('barracks and HQ independently open their doors and their infantry accelerates immediately',()=>{
 const barracks=visual('barracks',-125);
 const headquarters=visual('headquarters',125);
 const bases=[
  {id:500,owner:0,kind:'barracks',hp:800,facing:0,x:870,y:1000},
  {id:501,owner:0,kind:'headquarters',hp:1400,facing:0,x:1130,y:1000}
 ];
 const units=[
  {id:700,owner:0,kind:'infantry',hp:100,x:990,y:1110,orders:[],angle:0,fire:0,combatTarget:null},
  {id:701,owner:0,kind:'engineer',hp:110,x:1250,y:1110,orders:[],angle:0,fire:0,combatTarget:null}
 ];
 const game={time:10,bases,units,productionReleases:[],
  stageWebGLProduction:true,extendProductionDeparture(){},cancelProductionDeparture(){}};
 const actors=new Map(units.map(u=>[u.id,{node:new THREE.Group()}]));
 const bf={game,bases:new Map([[500,barracks],[501,headquarters]]),units:actors,
  renderer:{localClippingEnabled:false},heightAt:()=>0,
  world:{size:2000,walkable:()=>true},
  entityPosition:u=>new THREE.Vector3(u.x-1000,0,u.y-1000)};
 const presenter=new SandforgeProductionGates(bf);
 game.productionReleases.push(
  {baseId:500,unitId:700,kind:'infantry',owner:0,at:10},
  {baseId:501,unitId:701,kind:'engineer',owner:0,at:10}
 );
 const points=new Map();
 function step(age){
  game.time=10+age;
  for(const unit of units){
   const actor=actors.get(unit.id);
   actor.node.position.copy(bf.entityPosition(unit));
   actor.node.visible=true;actor.productionMotion=null;
  }
  presenter.update(true,1);
 }
 step(0);
 assert.equal(presenter.active.size,2,'both facilities must animate simultaneously');
 assert.ok(barracks.gate.portal.pbrDoor);
 assert.ok(headquarters.gate.portal.hqPbrDoor);
 step(1.39);
 for(const unit of units)points.set(unit.id,actors.get(unit.id).node.position.clone());
 step(1.75); // 500ms after shutter clearance: should now be outside the doorway
 for(const unit of units){
  const moved=actors.get(unit.id).node.position.distanceTo(points.get(unit.id));
  assert.ok(moved>12,unit.kind+' still creeps out of the gate: '+moved);
  assert.ok(actors.get(unit.id).productionMotion?.moving,unit.kind+' must animate running');
 }
 assert.equal(units[0].x,990);assert.equal(units[1].x,1250);
 assert.equal(barracks.gate.portal.doorPanels[0].mesh.position.x>0,true);
 assert.equal(headquarters.gate.portal.parts[0].mesh.position.x>0,true);
 presenter.dispose();
});
test('the simulation allows a pioneer from HQ and an infantryman from barracks at once',()=>{
 const game=new Simulation(20261116,2);
 game.aiClock=-1e8;game.credits[0]=10000;
 const hq=game.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 const barracks={...hq,id:1733,kind:'barracks',queue:[],queueTypes:[],
  queueCosts:[],production:0,radius:53,x:hq.x+400,y:hq.y+400};
 game.bases.push(barracks);
 assert.equal(game.recruit(hq.id,'engineer'),true);
 assert.equal(game.recruit(barracks.id,'infantry'),true);
 assert.ok(hq.queueTypes.includes('engineer'));
 assert.ok(barracks.queueTypes.includes('infantry'));
});
