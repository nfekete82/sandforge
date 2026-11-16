import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS,BUILDINGS} from '../dist/src/reborn/catalog.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';
import {prepareHeadquartersPortal,setHeadquartersDoorOpen,disposeHeadquartersPortal}
 from '../scripts/webgl-headquarters-portal.js';
import {SandforgeProductionGates} from '../scripts/webgl-production-gates.js';

function createHqPbrFixture(){
 const detail=new THREE.Group();
 const names=['HQ_door_recess_back','HQ_door_leaf_L','HQ_door_leaf_R',
  'HQ_door_panel_-1_0','HQ_door_panel_-1_1','HQ_door_panel_-1_2','HQ_door_handle_-1',
  'HQ_door_panel_1_0','HQ_door_panel_1_1','HQ_door_panel_1_2','HQ_door_handle_1',
  'HQ_Static_SF_OriginalPBR_walls','HQ_Static_SF_OriginalPBR_roof',
  'HQ_Static_SF_OriginalPBR_trim'];
 for(const name of names){
  const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
   new THREE.MeshStandardMaterial({name:'Original PBR '+name}));
  m.name=name;detail.add(m);
 }
 const node=new THREE.Group();node.add(detail);
 detail.scale.setScalar(13);
 return {entry:{kind:'headquarters',node,detail},node,detail};
}
test('legacy factory visual entries without kind still initialize their real rollup door',()=>{
 const detail=new THREE.Group(),door=new THREE.Group();
 door.name='FactoryRollupDoor';detail.add(door);
 const node=new THREE.Group();node.add(detail);
 const entry={node,detail}; // old presenter fixture had no entry.kind
 const presenter=new SandforgeProductionGates({game:{time:0,productionReleases:[]},
  bases:new Map(),renderer:{localClippingEnabled:false}});
 const gate=presenter.prepare(entry);
 assert.ok(gate,'old factories must not lose production animation');
 assert.equal(gate.kind,'factory');
 assert.equal(gate.door,door);
 presenter.detach(entry);
 assert.equal(entry.gate,undefined);
});

test('HQ uses barracks-style thin barbed wire, with clear front engineer exit',()=>{
 const width=BUILDINGS.headquarters.width;
 assert.equal(width,225);
 const yard=createBuildingYard('headquarters',width);
 const perimeter=yard.getObjectByName('BasePerimeter_headquarters');
 assert.ok(perimeter.userData.barracksWireFence);
 assert.equal(perimeter.getObjectByName('YardFenceRails'),undefined);
 const posts=perimeter.getObjectByName('BarracksWireFencePosts');
 const strands=perimeter.getObjectByName('BarracksWireFenceStrands');
 const barbs=perimeter.getObjectByName('BarracksWireFenceBarbs');
 assert.ok(posts.isInstancedMesh&&strands.isInstancedMesh&&barbs.isInstancedMesh);
 assert.ok(strands.geometry.parameters.radiusTop<.25);
 const mat=new THREE.Matrix4(),pos=new THREE.Vector3();
 for(let i=0;i<posts.count;i++){
  posts.getMatrixAt(i,mat);pos.setFromMatrixPosition(mat);
  assert.ok(!(Math.abs(pos.z-width*.28)<.1&&Math.abs(pos.x)<width*.23),
   'front engineer exit cannot contain fence posts');
 }
 const supplies=yard.getObjectByName('BaseSupplyCache');
 assert.ok(supplies&&perimeter.getObjectByName('ServiceStation'));
 yard.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(supplies);
 assert.ok(bounds.max.x<width*.65-6,'HQ supply cache must clear side fence');
 assert.ok(bounds.min.z>-width*.53+6,'HQ supply cache must clear rear fence');
 assert.ok(strands.material.map?.isDataTexture&&strands.material.normalMap?.isDataTexture,
  'HQ fence receives barracks PBR maps, not flat colors');
 const crate=yard.getObjectByName('CrateBody');
 assert.ok(crate.material.map?.isDataTexture,'HQ crates should be properly textured');
 disposeBuildingYard(yard);
});

test('HQ imported PBR doors slide with handles, leaving all original textured materials',()=>{
 const {entry,detail}=createHqPbrFixture();
 const left=detail.getObjectByName('HQ_door_leaf_L');
 const right=detail.getObjectByName('HQ_door_leaf_R');
 const handle=detail.getObjectByName('HQ_door_handle_-1');
 const facade=detail.getObjectByName('HQ_Static_SF_OriginalPBR_walls');
 const originalMaterial=facade.material;
 const portal=prepareHeadquartersPortal(entry);
 assert.ok(portal.hqPbrDoor);
 assert.equal(portal.parts.length,10);
 assert.equal(prepareHeadquartersPortal(entry),portal);
 setHeadquartersDoorOpen(portal,1);
 assert.ok(left.position.x>1.6&&right.position.x<-1.6);
 assert.equal(left.position.x,handle.position.x);
 assert.equal(portal.recess.visible,false);
 assert.equal(portal.hall.visible,true);
 assert.equal(facade.material,originalMaterial);
 disposeHeadquartersPortal(entry);
 assert.equal(entry.headquartersPortal,undefined);
 assert.equal(left.position.x,0);
 assert.equal(right.position.x,0);
 assert.equal(handle.position.x,0);
 assert.equal(detail.getObjectByName('HeadquartersPbrInterior'),undefined);
});

test('real HQ simulation keeps pioneer recruitment and emits a production release',()=>{
 const g=new Simulation(20261116,2);
 g.aiClock=-1e8;g.credits[0]=10000;
 const hq=g.bases.find(b=>b.owner===0&&b.kind==='headquarters');
 assert.ok(hq);
 assert.equal(g.producer(0,'engineer').id,hq.id);
 const initial=g.units.filter(u=>u.owner===0&&u.kind==='engineer').length;
 g.stageWebGLProduction=true;
 assert.equal(g.recruit(hq.id,'engineer'),true);
 for(let i=0;i<250&&g.units.filter(u=>u.owner===0&&u.kind==='engineer').length===initial;i++)g.step();
 assert.equal(g.units.filter(u=>u.owner===0&&u.kind==='engineer').length,initial+1);
 const produced=g.productionReleases.find(e=>e.baseId===hq.id&&e.kind==='engineer');
 assert.ok(produced,'simulation must publish HQ pioneer completion');
 assert.equal(g.units.some(u=>u.id===produced.unitId),true);
 assert.ok(!hq.queueTypes.includes('engineer'),'unit must leave production queue');
});

test('pioneer appears from real HQ gate before rally and never changes simulation data',()=>{
 const {entry,node}=createHqPbrFixture();
 const base={id:101,kind:'headquarters',owner:0,hp:1400,facing:0,x:1000,y:1000};
 const unit={id:203,kind:'engineer',owner:0,hp:110,x:1150,y:1130,
  orders:[],angle:0,fire:0,combatTarget:null};
 const event={baseId:101,unitId:203,kind:'engineer',at:10,owner:0,
  from:{x:base.x,y:base.y},to:{x:unit.x,y:unit.y}};
 const game={time:10,bases:[base],units:[unit],stageWebGLProduction:true,
  productionReleases:[],extendProductionDeparture(){},cancelProductionDeparture(){}};
 const actor={node:new THREE.Group()};
 const bf={game,bases:new Map([[101,entry]]),units:new Map([[203,actor]]),
  renderer:{localClippingEnabled:false},
  world:{size:2000,walkable:()=>true},heightAt:()=>0,
  entityPosition:()=>new THREE.Vector3(150,0,130)};
 const presenter=new SandforgeProductionGates(bf);
 game.productionReleases.push(event);
 const before={x:unit.x,y:unit.y,hp:unit.hp};
 const step=t=>{
  game.time=10+t;actor.node.visible=true;
  actor.node.position.set(150,0,130);
  presenter.update(true,1);
 };
 step(0);
 assert.equal(presenter.active.size,1,'HQ pioneer event must create an opening');
 assert.ok(entry.gate.portal.hqPbrDoor);
 step(2.1);
 assert.ok(entry.gate.portal.parts[0].mesh.position.x>0);
 assert.ok(actor.node.position.z>48,
  'pioneer should be exiting the front HQ door, not the unrelated factory garage');
 assert.equal(unit.x,before.x);
 assert.equal(unit.y,before.y);
 const duration=presenter.active.get(base.id).duration;
 step(1.25+duration+1.1);
 assert.equal(presenter.active.size,0);
 assert.equal(entry.gate.portal.parts[0].mesh.position.x,0,
  'HQ doors must automatically close');
 assert.equal(unit.hp,before.hp);
 presenter.dispose();
});
