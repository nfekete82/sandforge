import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 YARD_DECOR_KINDS,createBuildingYard,disposeBuildingYard,
 INFANTRY_YARD_PROP_SCALE
} from '../scripts/webgl-building-yard.js';

const count=(root,name)=>{
 let total=0;root.traverse(obj=>{if(obj.name===name)total++;});return total;
};

test('all major bases get supply crates and visible security lamps; small turrets stay clear',()=>{
 assert.deepEqual(YARD_DECOR_KINDS,[
  'headquarters','barracks','factory','research','silo','interceptor',
  'generator'
 ]);
 for(const kind of YARD_DECOR_KINDS){
  const width=kind==='generator'?112:180;
  const yard=createBuildingYard(kind,width);
  assert.equal(yard?.name,'sf-yard-'+kind);
  assert.equal(yard.userData.nonPlayable,true);
  const site=yard.getObjectByName('BasePerimeter_'+kind);
  assert.ok(site?.userData.siteDecor,'missing deterministic site decor for '+kind);
  assert.ok(site.userData.supplyCrates>=2,'supply stockpile '+kind);
  assert.ok(site.userData.lamps>=1,'lamp '+kind);
  assert.equal(count(site,'SupplyCrate'),site.userData.supplyCrates);
  assert.equal(count(site,'SecurityLamp'),site.userData.lamps);
  assert.ok(count(site,'LampDiffuser')>=1);
  assert.equal(site.getObjectByName('BaseSupplyCache')?.parent,site);
  disposeBuildingYard(yard);
  assert.equal(yard.parent,null);
 }
 assert.equal(createBuildingYard('turret',72),null);
 assert.equal(createBuildingYard('airfield',218),null,'the airfield apron remains clear');
});

test('large sites use three batched fence meshes, with wire bracing and an open frontage',()=>{
 for(const kind of ['headquarters','barracks','factory','research','silo','interceptor','generator']){
  const width=220,yard=createBuildingYard(kind,width);
  const site=yard.getObjectByName('BasePerimeter_'+kind);
  const wireOnly=kind!=='interceptor';
  const posts=site.getObjectByName(wireOnly?'BarracksWireFencePosts':'YardFencePosts');
  const rails=site.getObjectByName(wireOnly?'BarracksWireFenceStrands':'YardFenceRails');
  const wires=site.getObjectByName(wireOnly?'BarracksWireFenceBarbs':'YardFenceMesh');
  assert.equal(posts?.isInstancedMesh,true,kind+' has a single batched post draw call');
  assert.equal(rails?.isInstancedMesh,true,kind+' has a single batched rail draw call');
  assert.equal(wires?.isInstancedMesh,true,kind+' has a single batched wire draw call');
  assert.equal(posts.count,site.userData.fencePosts);
  if(wireOnly){
   assert.equal(rails.count+wires.count,site.userData.fenceWires);
   assert.equal(site.userData.fenceRails,0);
  }else{
   assert.equal(rails.count,site.userData.fenceRails);
   assert.equal(wires.count,site.userData.fenceWires);
  }
  assert.ok(posts.count>=12&&rails.count>=posts.count&&wires.count>=2*posts.count-4);
  // No fence sections span the positive-Z doorway/spawn passage.
  const matrix=posts.matrix.clone();
  const bounds=site.userData[kind+'FenceBounds'];
  const front=bounds?.front??width*.28,gateHalf=bounds?.gateHalf??width*(wireOnly?.23:.64);
  for(let i=0;i<posts.count;i++){
   posts.getMatrixAt(i,matrix);
   assert.ok(matrix.elements[14]<=front+.001);
   if(matrix.elements[14]>front-1){
    assert.ok(Math.abs(matrix.elements[12])>=gateHalf-.001,
     'front posts must remain on the two side flanks, not across the door');
   }
  }
  const before=posts.geometry;
  disposeBuildingYard(yard);
  assert.equal(yard.parent,null);
  // Geometry disposal stays instance-owned; module materials are shared.
  assert.ok(before.isBufferGeometry);
 }
});

test('the previous vehicle and infantry staging props remain recognizable',()=>{
 const factory=createBuildingYard('factory',200);
 assert.equal(count(factory,'SpareTyre'),5);
 assert.equal(count(factory,'SpareTrackLink'),8);
 assert.equal(count(factory,'EngineBlock'),1);
 const barracks=createBuildingYard('barracks',158);
 assert.equal(INFANTRY_YARD_PROP_SCALE,1);
 assert.equal(count(barracks,'InfantryHelmet'),3);
 assert.equal(count(barracks,'InfantryWeaponRackRifle'),3);
 for(const yard of [factory,barracks])disposeBuildingYard(yard);
});

test('yard remains presentation-only, built once, with existing safe teardown and no save changes',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const yard=readFileSync('scripts/webgl-building-yard.js','utf8');
 assert.match(battlefield,/if\(!entry\.yard\)/);
 assert.match(battlefield,/entry\.node\.add\(entry\.yard\)/);
 assert.match(battlefield,/disposeBuildingYard\(e\.yard\)/);
 assert.match(yard,/nonPlayable:true/);
 assert.match(yard,/instanceBoxes\(group,'YardFencePosts'/);
 assert.match(yard,/instanceBoxes\(group,'YardFenceRails'/);
 assert.match(yard,/instanceFenceWires\(group,wires\)/);
 assert.doesNotMatch(yard,/localStorage|\.save\(|\.buildError\(|\.pathfind\(/);
});


test('site dressing casts shadows only for major props and never participates in recursive selection raycasts',()=>{
 const yard=createBuildingYard('headquarters',225);
 const decor=yard.getObjectByName('BasePerimeter_headquarters');
 let checked=0;
 decor.traverse(object=>{
  if(!object.isMesh)return;
  checked++;
  const major=/^(CrateBody|CrateLid|SupplyPallet|BarrelShell|LampPost|LampHead)$/.test(object.name);
  assert.equal(object.castShadow,major,object.name);
  assert.equal(object.receiveShadow,major,object.name);
  // A cast ray from the top should never select the decorative mesh.
  const raycastCalls=[];
  object.raycast({ray:{}},raycastCalls);
  assert.equal(raycastCalls.length,0);
 });
 assert.ok(checked>15,'actual lights/crates/fence meshes checked');
 disposeBuildingYard(yard);
});
