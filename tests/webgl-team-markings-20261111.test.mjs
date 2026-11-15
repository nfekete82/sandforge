import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {TEAM_MARKING_COLORS,HELICOPTER_STRIPES_REVISION,attachTeamMarkings,detachTeamMarkings}
 from '../scripts/webgl-team-markings.js';
test('all infantry roles have no floating flag/armband planes; actual PBR uniform stays untouched',()=>{
 assert.equal(TEAM_MARKING_COLORS[0],'#198fe0');
 assert.equal(TEAM_MARKING_COLORS[1],'#e34e43');
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
test('tanks have turret flags, Humvees have door marks and bombers keep their wing marks',()=>{
 for(const [kind,tag] of [['tank','TeamArmourFlag'],['artillery','TeamArmourFlag'],
  ['rover','TeamDoor_1'],['bomber','TeamAircraftWing_-1']]){
  const entry={node:new THREE.Group()};
  assert.ok(attachTeamMarkings(entry,0,kind,125,50).getObjectByName(tag),kind);
  assert.equal(attachTeamMarkings(entry,1,kind,125,50).userData.owner,1);
  assert.equal(entry.node.children.length,1);
  detachTeamMarkings(entry);
 }
});
test('tank flags are mounted on the rotating GLB turret, not floating above the hull',()=>{
 const node=new THREE.Group(),model=new THREE.Group(),turret=new THREE.Group();
 turret.name='Tank_Turret';
 const housing=new THREE.Mesh(new THREE.BoxGeometry(.91,.37,.83),new THREE.MeshStandardMaterial());
 housing.position.set(0,1.20,-.13);turret.add(housing);model.add(turret);node.add(model);
 const entry={node,detail:model};
 const marking=attachTeamMarkings(entry,0,'tank',95,46);
 assert.equal(marking.parent,turret);
 const flag=marking.getObjectByName('TeamArmourFlag');
 const pole=marking.getObjectByName('TeamFlagpole');
 assert.ok(flag&&pole);
 assert.ok(flag.scale.x<.5&&flag.scale.y<.25,'flag must be small in model units');
 assert.ok(pole.position.y-pole.scale.y*.5<1.42,'mast begins at roof level');
 const prev=marking;
 assert.equal(attachTeamMarkings(entry,0,'tank',95,46),prev);
 turret.rotation.y=.9;
 assert.equal(marking.parent,turret,'insignia follows turret rotation automatically');
 const replacement=new THREE.Group(),turret2=turret.clone();
 replacement.add(turret2);entry.detail=replacement;
 assert.notEqual(attachTeamMarkings(entry,0,'tank',95,46),prev,
  'replace old marker when streaming fallback becomes the GLB');
 assert.equal(entry.teamMarkings.parent,turret2);
 detachTeamMarkings(entry);
});
test('badges are cosmetic, never interactive and kept outside persistent game state',()=>{
 const entry={node:new THREE.Group()},group=attachTeamMarkings(entry,0,'tank');
 assert.ok(group.children.every(o=>o.userData.nonPlayable&&o.userData.visualOnly));
 assert.ok(readFileSync('scripts/webgl-battlefield.js','utf8').includes('detachTeamMarkings(e)'));
 assert.ok(readFileSync('scripts/build.mjs','utf8').includes('webgl-team-markings.js'));
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
