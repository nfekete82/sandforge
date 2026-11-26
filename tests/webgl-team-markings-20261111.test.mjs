import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TEAM_MARKING_COLORS,ARMOUR_IDENTIFICATION_REVISION,HELICOPTER_STRIPES_REVISION,attachTeamMarkings,detachTeamMarkings}
 from '../scripts/webgl-team-markings.js';
test('all infantry roles have no floating flag/armband planes; actual PBR uniform stays untouched',()=>{
 assert.equal(TEAM_MARKING_COLORS[0],'#2c6799');
 assert.equal(TEAM_MARKING_COLORS[1],'#a64b43');
 for(const owner of [0,1])for(const kind of ['infantry','heavy','medic','rocket','engineer']){
  const node=new THREE.Group(),detail=new THREE.Group();
  const realUniform=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
   new THREE.MeshStandardMaterial({name:'Atlas faction enamel',
    color:owner===0?'#205b98':'#a7312a'}));
  realUniform.name='Atlas_Pauldron';
  detail.add(realUniform);node.add(detail);
  const entry={node,detail};
  const old=new THREE.Group();
  old.name='SandforgeTeamUniformAndFlags';
  old.userData.teamMarkings=true;
  old.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1)));
  node.add(old);entry.teamMarkings=old;
  const sourceMat=realUniform.material,sourceColor=sourceMat.color.getHex();
  assert.equal(attachTeamMarkings(entry,owner,kind,32,40),null,kind);
  assert.equal(entry.teamMarkings,null,kind+' old flags detached');
  assert.equal(old.parent,null,kind+' visual flags are gone');
  assert.equal(node.children.length,1,kind+' no new flag group created');
  assert.equal(realUniform.material,sourceMat,kind+' keeps original skinned-team material');
  assert.equal(sourceMat.color.getHex(),sourceColor);
  assert.equal(attachTeamMarkings(entry,owner,kind,32,40),null);
  assert.equal(node.children.length,1,'no extra geometry after repeated updates');
 }
});
test('authored soldier model keeps its genuine blue/red shoulder, chest and helmet paint',()=>{
 const design=readFileSync('scripts/animation/detailed-infantry.js','utf8');
 for(const part of ['Pectoral','PackStripe','HelmetStripe','Pauldron','ForearmPlate']){
  assert.match(design,new RegExp("['\"]"+part+"['\"].*m\\.team"),
   part+' remains painted into animated soldier model');
 }
 // No changes to cached glTFs, model skeletons or gameplay team ownership.
 const logic=readFileSync('scripts/webgl-team-markings.js','utf8');
 assert.match(logic,/if\(infantryKinds\.has\(kind\)\)\{[\s\S]*?detachTeamMarkings\(entry\);[\s\S]*?return null;/);
 assert.doesNotMatch(logic,/patch\(group,'TeamArmband_/);
 assert.doesNotMatch(logic,/patch\(group,'TeamChestPatch'/);
});
test('tanks and artillery use armour paint, Humvees retain door badges and bombers carry paint on their wings',()=>{
 for(const kind of ['tank','artillery','bomber']){
  const node=new THREE.Group(),detail=new THREE.Group();node.add(detail);
  const hull=new THREE.Mesh(new THREE.BoxGeometry(8,1,5),new THREE.MeshStandardMaterial());
  detail.add(hull);
  const entry={node,detail};
  for(const owner of [0,1]){
   assert.equal(attachTeamMarkings(entry,owner,kind,125,50),null);
   assert.equal(node.children.length,1,'no floating group for '+kind);
   if(kind==='bomber'){
    const bands=detail.getObjectByName('SandforgeBomberFlushWingPaint');
    assert.ok(bands?.geometry.getAttribute('position').count>0);
    assert.equal('#'+bands.material.color.getHexString(),TEAM_MARKING_COLORS[owner]);
   }else assert.equal(hull.material.userData.sandforgeArmourPaintOwner,owner);
  }
 }
 const entry={node:new THREE.Group()};
 assert.ok(attachTeamMarkings(entry,0,'rover',125,50).getObjectByName('TeamDoor_1'));
 assert.equal(attachTeamMarkings(entry,1,'rover',125,50).userData.owner,1);
 assert.equal(entry.node.children.length,1);
 detachTeamMarkings(entry);
});
test('tank insignia follows its rotating GLB turret and preserves the authored material maps',()=>{
 const node=new THREE.Group(),model=new THREE.Group(),turret=new THREE.Group();
 turret.name='Tank_Turret';
 const normalMap=new THREE.Texture(),map=new THREE.Texture();
 const source=new THREE.MeshStandardMaterial({map,normalMap});
 const housing=new THREE.Mesh(new THREE.BoxGeometry(.91,.37,.83),source);
 housing.position.set(0,1.20,-.13);turret.add(housing);model.add(turret);node.add(model);
 const entry={node,detail:model};
 const legacy=new THREE.Group();node.add(legacy);entry.teamMarkings=legacy;
 assert.equal(attachTeamMarkings(entry,0,'tank',95,46),null);
 assert.equal(legacy.parent,null);
 const painted=housing.material;
 assert.notEqual(painted,source);
 assert.equal(painted.userData.sandforgeArmourPaint,ARMOUR_IDENTIFICATION_REVISION);
 assert.equal(painted.map,map);
 assert.equal(painted.normalMap,normalMap);
 assert.equal(source.userData.sandforgeArmourPaint,undefined);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>'};
 painted.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfArmourPosition=position/);
 assert.match(shader.fragmentShader,/sfArmourNormal\.y/);
 attachTeamMarkings(entry,0,'tank',95,46);
 assert.equal(housing.material,painted,'repeat updates reuse the material');
 turret.rotation.y=.9;
 assert.equal(housing.parent,turret,'insignia follows turret rotation automatically');
 const replacement=new THREE.Group(),turret2=turret.clone();
 turret2.children[0].material=source;
 replacement.add(turret2);entry.detail=replacement;
 attachTeamMarkings(entry,1,'tank',95,46);
 assert.equal(turret2.children[0].material.userData.sandforgeArmourPaintOwner,1,
  'apply the paint to a replacement streamed GLB');
 assert.equal(painted.userData.sandforgeArmourPaintOwner,0);
 assert.equal(entry.teamMarkings,null);
});
test('badges are cosmetic, never interactive and kept outside persistent game state',()=>{
 const entry={node:new THREE.Group()},group=attachTeamMarkings(entry,0,'rover');
 assert.ok(group.children.length>0);
 assert.ok(group.children.every(o=>o.userData.nonPlayable&&o.userData.visualOnly));
 assert.equal(new THREE.Raycaster(new THREE.Vector3(0,100,0),new THREE.Vector3(0,-1,0)).intersectObject(group,true).length,0);
 assert.ok(readFileSync('scripts/webgl-battlefield.js','utf8').includes('detachTeamMarkings(e)'));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-team-markings.js'));
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/teamMarkings|sandforgeArmourPaint/);
 assert.equal(attachTeamMarkings(entry,0,'headquarters'),null);
});


test('transport helicopter paints thin blue/red stripes directly into the authored fuselage, without floating aircraft flags',()=>{
 const actor=new THREE.Group(),model=new THREE.Group(),map=new THREE.Texture(),normalMap=new THREE.Texture();
 const original=new THREE.MeshStandardMaterial({name:'Weathered desert camouflage PBR',map,normalMap});
 const fuselage=new THREE.Mesh(new THREE.BoxGeometry(2.8,3,7),original);
 fuselage.name='Airframe_Weathered_desert_camouflage_PBR';model.add(fuselage);actor.add(model);
 const entry={node:actor,detail:model};
 // Old free-standing patches must also disappear on an existing actor.
 const legacy=new THREE.Group();legacy.userData.teamMarkings=true;actor.add(legacy);entry.teamMarkings=legacy;
 assert.equal(attachTeamMarkings(entry,0,'scout',140,61),null);
 assert.equal(entry.teamMarkings,null);
 assert.equal(actor.children.length,1,'no new floating geometry around helicopter');
 assert.equal(fuselage.material.userData.sandforgeHelicopterStripes,HELICOPTER_STRIPES_REVISION);
 assert.equal(fuselage.material.userData.sandforgeHelicopterStripeOwner,0);
 assert.equal(fuselage.material.map,map);
 assert.equal(fuselage.material.normalMap,normalMap);
 assert.equal(original.userData.sandforgeHelicopterStripes,undefined,'shared GLB material must remain pristine');
 const paint=fuselage.material,shader={
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>'
 };
 paint.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfHeliLocal=transformed/);
 assert.match(shader.fragmentShader,/sfSide.*sfHeliLocal\.x/);
 assert.match(shader.fragmentShader,/sfCargo.*sfHeliLocal\.z/);
 assert.match(shader.fragmentShader,/sfBlueBand/);
 assert.match(shader.fragmentShader,/diffuseColor\.rgb=mix/);
 const keyBlue=paint.customProgramCacheKey();
 assert.equal(attachTeamMarkings(entry,0,'scout'),null,'repeated updates do not clone materials or add sprites');
 assert.equal(fuselage.material,paint);
 assert.equal(attachTeamMarkings(entry,1,'scout'),null,'red uses same body paint with new owner');
 assert.notEqual(paint.customProgramCacheKey(),keyBlue);
 assert.equal(paint.userData.sandforgeHelicopterStripeOwner,1);
 assert.equal(actor.children.length,1);
});
