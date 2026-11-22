import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {tankCannonMuzzleWorld} from '../scripts/webgl-tank-muzzle-origin.js';

function tank(angle=0){
 const node=new THREE.Group(),model=new THREE.Group();
 const turret=new THREE.Group();turret.name='Tank_Turret';
 const gun=new THREE.Group();gun.name='Tank_Gun';gun.position.y=19;
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(3,3,56,12),
  new THREE.MeshStandardMaterial());
 barrel.name='Tank_MainCannon';barrel.rotation.x=Math.PI/2;barrel.position.z=31;
 gun.add(barrel);turret.add(gun);model.add(turret);node.add(model);
 node.rotation.y=Math.PI/2-angle;
 return {node,detail:model,kind:'tank',tankRig:{gun,turret}};
}
test('rocket origin follows actual cannon lip and turret aim rather than tank center',()=>{
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const entry=tank(angle);
  const tip=tankCannonMuzzleWorld(entry,angle);
  assert.ok(tip);
  assert.ok(Math.abs(tip.y-19)<1e-4,'projectile must leave at cannon height');
  const forward=tip.x*Math.cos(angle)+tip.z*Math.sin(angle);
  assert.ok(forward>55&&forward<63,'launch must be at the front of the actual barrel');
  const across=-tip.x*Math.sin(angle)+tip.z*Math.cos(angle);
  assert.ok(Math.abs(across)<1e-4,'no sideways hull offset');
 }
});

test('real turret rotation changes the launch point without moving hull or roof MG',()=>{
 const entry=tank();
 const before=tankCannonMuzzleWorld(entry,0);
 entry.tankRig.turret.rotation.y=-Math.PI/2;
 const after=tankCannonMuzzleWorld(entry,Math.PI/2);
 assert.ok(before.distanceTo(after)>70);
 assert.ok(Math.abs(after.z-59)<5,'same barrel follows turret rotation');
 assert.deepEqual(entry.node.position.toArray(),[0,0,0]);
});

test('renderer and VFX use same muzzle for cannon rockets, tracers and smoke',()=>{
 const effect=readFileSync('scripts/webgl-combat-vfx.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(effect,/missile\.type==='antiArmor'&&entry\?\.kind==='tank'/);
 assert.match(effect,/tankCannonMuzzleWorld\(entry,missile\.angle\?\?0\)/);
 assert.match(effect,/shot\.kind==='tank'&&shot\.weapon==='cannon'/);
 assert.match(battlefield,/tankCannonMuzzleWorld\(this\.units\.get\(shot\.source\),shot\.angle\?\?0\)/);
 assert.match(build,/cpSync\('scripts\/webgl-tank-muzzle-origin\.js','dist\/webgl-tank-muzzle-origin\.js'\)/);
 assert.ok(!effect.includes("missile.type==='antiArmor'\n   ?entry?.detail?.getObjectByName('Tank_MainCannon')"),
  'anti-armor missile must use canonical muzzle');
});

test('missing tank model falls back safely; non-tank rocket launch unchanged',()=>{
 assert.equal(tankCannonMuzzleWorld({kind:'rocket'},0),null);
 assert.equal(tankCannonMuzzleWorld({kind:'tank',node:new THREE.Group()},0),null);
});
