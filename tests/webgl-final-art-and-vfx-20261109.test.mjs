import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3} from 'three';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';

test('silo and lab retain their major 3D signatures after static batching',()=>{
 const silo=createStrategicBuilding('silo',0);
 const lab=createStrategicBuilding('research',0);
 const hull=silo.getObjectByName('Silo_RocketBody');
 const nose=silo.getObjectByName('Silo_RocketNose');
 const joint=silo.getObjectByName('Silo_RocketHatchJoint');
 const opening=silo.getObjectByName('Silo_TerrainOcclusion');
 assert.ok(hull?.isMesh&&nose?.isMesh&&joint?.isMesh&&opening?.isMesh);
 const bodyBounds=new Box3().setFromObject(hull);
 const noseBounds=new Box3().setFromObject(nose);
 const jointBounds=new Box3().setFromObject(joint);
 assert.equal(joint.geometry.type,'TorusGeometry');
 assert.ok(Math.abs(bodyBounds.max.y-noseBounds.min.y)<.01,'nose meets the hull without a gap');
 assert.ok(Math.abs(jointBounds.min.y-opening.position.y)<.05,'the seal meets the shaft opening');
 assert.ok(bodyBounds.min.y<opening.position.y&&bodyBounds.max.y>jointBounds.max.y);
 assert.ok(lab.getObjectByName('Research_Radar'));
 assert.ok(lab.getObjectByName('Research_SensorArray'));
 for(const model of [silo,lab]){
  assert.ok(model.children.some(o=>o.name.startsWith('SF_StaticBatch_')));
  const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.ok(meshes.length<65,'one launch facility should not cause dozens of per-frame draw calls');
 }
});

test('strategic flight missile uses shared rocket geometries and recycles them',()=>{
 const source=readFileSync('scripts/webgl-strategic-effects.js','utf8');
 assert.match(source,/sharedFlame:new THREE\.ConeGeometry/);
 assert.match(source,/rocketNose:new THREE\.ConeGeometry/);
 assert.match(source,/root\.name='Strategic_Missile_'/);
 assert.match(source,/s\.upperHull,s\.olive/);
 assert.match(source,/s\.rocketNose,s\.graphite/);
 assert.match(source,/rocket\.removeFromParent\(\);this\.rockets\.delete\(id\)/);
 const update=source.slice(source.indexOf(' update(active=true){'),source.indexOf(' dispose(){'));
 assert.doesNotMatch(update,/new THREE\.(?:CylinderGeometry|ConeGeometry|BoxGeometry)/);
});

test('ruin-road dressing is visual-only, instanced and costs no per-frame update',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 const start=source.indexOf('function addBuriedRuinRoad(');
 const end=source.indexOf('function dressRuinDamage(',start);
 assert.ok(start>=0&&end>start);
 const road=source.slice(start,end);
 assert.match(road,/new THREE\.InstancedMesh/);
 assert.match(road,/nonPlayable:true,roadFragment:true/);
 assert.match(road,/castShadow=false;mesh\.receiveShadow=false/);
 assert.match(source,/addBuriedRuinRoad\(anchor,ruin,i\)/);
});
