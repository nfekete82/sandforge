import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {attachTeamMarkings,detachTeamMarkings,
 ARMOUR_IDENTIFICATION_REVISION} from '../scripts/webgl-team-markings.js';

const src=p=>readFileSync(p,'utf8');
function rig(kind='tank'){
 const root=new THREE.Group(),turret=new THREE.Group();
 turret.name='Tank_Turret';
 turret.position.set(0,.7,0);
 const original=new THREE.Mesh(new THREE.BoxGeometry(2.8,.72,3.25),
  new THREE.MeshStandardMaterial({color:'#9b9882',roughness:.85}));
 original.name='Tank_ArmourDeck';
 turret.add(original);
 const gun=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,2.1,8),
  original.material);
 gun.name='Tank_GunBarrel';
 turret.add(gun);
 root.add(turret);
 const entry={node:new THREE.Group(),detail:root,kind};
 return {root,entry,turret,original,gun};
}
test('tank and artillery get NO additional mast or floating flags, only on-surface paint',()=>{
 for(const kind of ['tank','artillery']){
  const {root,entry,turret,original,gun}=rig(kind);
  const initialCount=turret.children.length;
  assert.equal(attachTeamMarkings(entry,0,kind,68,40),null);
  assert.equal(entry.teamMarkings,undefined);
  assert.equal(turret.children.length,initialCount);
  assert.ok(!root.getObjectByName('TeamFlagpole'));
  assert.ok(!root.getObjectByName('TeamArmourFlag'));
  assert.ok(!root.getObjectByName('TeamTurretRoofMark'));
  assert.ok(original.material.userData.sandforgeArmourOwnedPaint);
  assert.equal(original.material.userData.sandforgeArmourPaint,
   ARMOUR_IDENTIFICATION_REVISION);
  assert.equal(gun.material.userData.sandforgeArmourPaint,undefined,
   'never paint gun/barrel surfaces');
  assert.equal(original.geometry.attributes.position.count,24,
   'do not mutate real GLB triangle geometry');
 }
});
test('actual turret PBR shader paints tiny two-tone faction markings only on top-facing armour',()=>{
 const {entry,original}=rig();
 attachTeamMarkings(entry,0,'tank',68,40);
 const material=original.material;
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>'};
 material.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfArmourPosition=position;sfArmourNormal=normal/);
 assert.match(shader.fragmentShader,/float sfArmourTop=smoothstep/);
 assert.match(shader.fragmentShader,/float sfArmourHeight=smoothstep/);
 assert.match(shader.fragmentShader,/float sfInk=/);
 assert.match(shader.fragmentShader,/diffuseColor.rgb=mix/);
 assert.doesNotMatch(shader.fragmentShader,/gl_FragDepth|discard|texture2D\(.*flag/);
 assert.ok(material.isMeshStandardMaterial,'preserve original PBR material');
 assert.equal(material.map,null,'no new flag texture downloads');
});
test('team change updates the exact same material without multiplying planes',()=>{
 const {entry,turret,original}=rig();
 attachTeamMarkings(entry,0,'tank',68,40);
 const material=original.material;
 const oldKey=material.customProgramCacheKey();
 const geometry=original.geometry;
 attachTeamMarkings(entry,1,'tank',68,40);
 assert.equal(original.material,material);
 assert.equal(original.geometry,geometry);
 assert.equal(turret.children.length,2);
 assert.equal(material.userData.sandforgeArmourPaintOwner,1);
 assert.notEqual(material.customProgramCacheKey(),oldKey);
 assert.equal(entry.teamMarkings,undefined);
 detachTeamMarkings(entry);
 assert.equal(turret.children.length,2);
});
test('turret fallback with missing rig does not create any new billboards either',()=>{
 const {entry,root}=rig();
 const flat=root.children[0].children[0].clone();
 flat.name='Tank_Hull_Armour';
 root.clear();root.add(flat);
 attachTeamMarkings(entry,0,'tank',72,41);
 assert.ok(!entry.teamMarkings);
 assert.equal(root.children.length,1);
 assert.equal(flat.material.userData.sandforgeArmourPaintOwner,0);
});
test('cleanup releases only actor-owned armour-paint clones',()=>{
 const battlefield=src('scripts/webgl-battlefield.js');
 const markings=src('scripts/webgl-team-markings.js');
 assert.match(battlefield,/disposeTaggedMaterials\(e\.detail,'sandforgeArmourOwnedPaint'\)/);
 assert.match(markings,/if\(kind==='tank'\|\|kind==='artillery'\)\{\s*\/\/ No freestanding flags/);
 assert.doesNotMatch(markings,/new THREE\.Mesh\(poleGeo/);
 assert.doesNotMatch(markings,/['"]TeamFlagpole['"]/);
 assert.doesNotMatch(markings,/patch\(group,'TeamArmourFlag'/);
 assert.match(markings,/shader\.fragmentShader=shader\.fragmentShader\.replace\('#include <color_fragment>',paint\)/);
});
