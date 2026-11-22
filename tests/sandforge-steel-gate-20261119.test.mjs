import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStrategicBuilding} from '../scripts/webgl-strategic-buildings.js';
import {isPassableFriendlyGate} from '../dist/src/reborn/defensive-wall.js';

const models=[];
const create=(kind,owner=0)=>{
 const m=createStrategicBuilding(kind,owner);models.push(m);return m;
};
const meshes=root=>{
 const found=[];root.traverse(x=>{if(x.isMesh)found.push(x);});return found;
};

test('the double gate replaces two wall sections with a 190-unit clear steel portal',()=>{
 const wall=create('wall'),gate=create('wallGate');
 const wb=new THREE.Box3().setFromObject(wall);
 const gb=new THREE.Box3().setFromObject(gate);
 assert.ok(gb.max.y>wb.max.y+8,'gate header and towers project above the wall');
 assert.ok(gb.max.x-gb.min.x>205&&gb.max.x-gb.min.x<=220,
  'complete gate must span two 109-unit wall sections');
 assert.equal(gate.userData.gateClearOpeningWidth,190);
 assert.ok(gate.userData.gateClearOpeningHeight>62);
 const [left,right]=gate.userData.gateLeaves;
 assert.ok(left?.isGroup&&right?.isGroup);
 assert.equal(left.position.x,-95);
 assert.equal(right.position.x,95);
 const a=meshes(left).find(m=>m.material.name.includes('riveted steel armour'));
 const b=meshes(right).find(m=>m.material.name.includes('riveted steel armour'));
 assert.ok(a&&b,'two distinct steel swing doors');
 assert.ok(new THREE.Box3().setFromObject(a).max.y>=54,'tall, plated leaves');
 assert.ok(a.material.metalness>.7&&a.material.map?.isTexture);
 assert.ok(a.material.userData.sandforgeAuthoredMetal,
  'building faction tint must not replace steel with desert-camouflage shader');
 assert.equal(a.material.map,b.material.map);
});

for(const owner of [0,1])test('closed metal leaves block the visual roadway, opening makes it clear',()=>{
 const gate=create('wallGate',owner),doors=gate.userData.gateLeaves;
 const ray=new THREE.Raycaster(new THREE.Vector3(0,26,-90),
  new THREE.Vector3(0,0,1),0,180);
 gate.updateMatrixWorld(true);
 assert.ok(ray.intersectObjects(gate.children,true).length>0,
  'closed gate shows an actual solid armored door');
 doors[0].rotation.y=-1.48;doors[1].rotation.y=1.48;
 gate.updateMatrixWorld(true);
 assert.equal(ray.intersectObjects(gate.children,true).length,0,
  'open double leaves, frame and floodlights do not obstruct road at actor height');
 // Faction-sensitive simulation collision is unchanged by the visual model.
 const site={kind:'wallGate',owner,hp:800,buildRemaining:0};
 assert.ok(isPassableFriendlyGate(site,owner));
 assert.equal(isPassableFriendlyGate(site,1-owner),false);
});

test('metal gate is render-batched, textured and does not create 60+ draw calls each',()=>{
 const blue=create('wallGate',0),red=create('wallGate',1);
 const m0=meshes(blue),m1=meshes(red);
 assert.ok(m0.length<=20,'static details and each articulated leaf are batched by material');
 assert.equal(m0.length,m1.length,'both teams share the same geometry budget');
 const materials=m0.map(m=>m.material);
 assert.ok(materials.some(m=>m.name.includes('warning sheet metal')&&m.map?.isTexture));
 assert.ok(materials.some(m=>m.name.includes('warm floodlights')&&m.emissiveIntensity>.5));
 assert.ok(materials.some(m=>m.name.includes('heavy gunmetal frame')));
 assert.ok(materials.some(m=>m.name.includes('brushed reinforced ribs')));
 assert.ok(m0.some(m=>m.userData.barbedWire));
 const steel=m0.find(m=>m.material.name.includes('riveted steel armour'));
 const other=m1.find(m=>m.material.name.includes('riveted steel armour'));
 assert.equal(steel.material.map,other.material.map,
  'all gates reuse one sheet-metal texture allocation');
});
