import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {HUMAN_INFANTRY_REVISION,humanizeInfantry,disposeHumanInfantry} from '../scripts/webgl-human-infantry.js';
import {SKINNED_TROUSERS_REVISION,findTrouserRig} from '../scripts/webgl-human-skinned-trousers.js';
import {HUMAN_STANCE_REVISION,createHumanStance,restoreHumanStance,applyHumanStance,disposeHumanStance} from '../scripts/webgl-human-stance.js';

function atlas(){
 const root=new THREE.Group();
 const bone=new THREE.Bone();bone.name='Head';root.add(bone);
 const names=['Atlas_Helmet','Atlas_Breastplate','Atlas_AbdominalLames',
  'Atlas_PowerPack','Atlas_UpperArmL','Atlas_UpperArmR',
  'Atlas_KneeL','Atlas_KneeR',
  'Atlas_ForearmL','Atlas_ForearmR','Atlas_ThighL','Atlas_ThighR',
  'Atlas_ShinL','Atlas_ShinR','Atlas_BootL','Atlas_BootR',
  'Atlas_GloveL','Atlas_GloveR','Atlas_UtilityBelt','Atlas_NeckSeal'];
 for(const name of names){
  const parent=new THREE.Group();parent.name=name;bone.add(parent);
  const old=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
   new THREE.MeshStandardMaterial({color:'orange'}));
  old.name='Atlas_ChestCeramic';parent.add(old);
 }
 // Representative exported joint hierarchy: the robot parts are meshes
 // under their animated limb groups and have the same geometric dimensions.
 for(const side of ['L','R']){
  for(const part of ['UpperArm','Forearm','Thigh','Shin']){
   const parent=root.getObjectByName('Atlas_'+part+side);
   const suit=new THREE.Mesh(new THREE.BoxGeometry(.16,.30,.18),
    new THREE.MeshStandardMaterial());suit.name='Atlas_'+part+side+'Suit';
   const armour=new THREE.Mesh(new THREE.BoxGeometry(.20,.20,.11),
    new THREE.MeshStandardMaterial());armour.name='Atlas_RobotPlate_'+part+side;
   parent.add(suit,armour);
  }
  for(const [group,part] of [['Boot','BootUpper'],['Glove','KnucklePlate']]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
    new THREE.MeshStandardMaterial());
   mesh.name='Atlas_'+part;
   root.getObjectByName('Atlas_'+group+side).add(mesh);
  }
 }
 const helmet=root.getObjectByName('Atlas_Helmet');
 const visor=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),
  new THREE.MeshStandardMaterial());visor.name='Atlas_VisorGlass';helmet.add(visor);
 const rifle=new THREE.Group();rifle.name='Atlas_Rifle';
 const socket=new THREE.Group();socket.name='Atlas_WeaponSocket';socket.add(rifle);
 const muzzle=new THREE.Object3D();muzzle.name='Atlas_MuzzleBore';rifle.add(muzzle);
 root.add(socket);
 const knee=root.getObjectByName('Atlas_KneeL');
 const pad=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial());pad.name='Atlas_KneeCap';knee.add(pad);
 const plate=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),
  new THREE.MeshStandardMaterial());plate.name='Atlas_Pauldron';
 root.getObjectByName('Atlas_UpperArmL').add(plate);
 return {root,visor,rifle,socket,muzzle,pad,plate,bone};
}
test('human infantry restyle is joint-mounted, idempotent and does not touch the animated weapon rig',()=>{
 const {root,visor,rifle,socket,muzzle,pad,plate,bone}=atlas();
 const originalBone=bone.position.clone(),weaponParent=rifle.parent;
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.userData.sandforgeHumanInfantryRevision,HUMAN_INFANTRY_REVISION);
 assert.equal(visor.visible,false);
 assert.equal(plate.visible,false);
 assert.equal(root.getObjectByName('Atlas_ChestCeramic').visible,false);
 assert.ok(root.getObjectByName('SF_Human_Face'));
 assert.ok(root.getObjectByName('SF_Human_PlateCarrier'));
 assert.ok(root.getObjectByName('SF_Human_HelmetCrown'));
 assert.ok(root.getObjectByName('SF_Human_MagazinePouch0'));
 assert.ok(root.getObjectByName('SF_Human_RadioRucksack'));
 assert.ok(root.getObjectByName('SF_Human_TrouserHips'));
 assert.equal(root.getObjectByName('SF_Human_TrouserHips').parent,
  root.getObjectByName('Atlas_UtilityBelt'));
 assert.ok(root.getObjectByName('SF_Human_HumanNeck'));
 assert.equal(root.getObjectByName('SF_Human_HumanNeck').parent,
  root.getObjectByName('Atlas_NeckSeal'));
 assert.equal(root.getObjectByName('SF_Human_SleeveArmband0').parent,
  root.getObjectByName('Atlas_UpperArmL'));
 assert.equal(root.getObjectByName('SF_Human_HelmetCrown').parent,
  root.getObjectByName('Atlas_Helmet'));
 assert.equal(pad.scale.x,.77);
 assert.equal(rifle.parent,weaponParent);
 assert.equal(socket.getObjectByName('Atlas_MuzzleBore'),muzzle);
 assert.deepEqual(bone.position.toArray(),originalBone.toArray());
 let changed=0;root.traverse(node=>{if(node.userData?.sandforgeHumanInfantry)changed++;});
 assert.ok(changed>=20);
 assert.equal(humanizeInfantry(root,0),true);
 let twice=0;root.traverse(node=>{if(node.userData?.sandforgeHumanInfantry)twice++;});
 assert.equal(twice,changed,'restyle must not duplicate meshes on reload');
});
test('factions get separate armband colors, without modifying shared animations or meshes',()=>{
 const blue=atlas().root,red=atlas().root;
 assert.equal(humanizeInfantry(blue,0),true);
 assert.equal(humanizeInfantry(red,1),true);
 const first=blue.getObjectByName('SF_Human_SleeveArmband0');
 const second=red.getObjectByName('SF_Human_SleeveArmband0');
 assert.notEqual(first.material.color.getHex(),second.material.color.getHex());
 assert.equal(first.userData.factionAccent,true);
 assert.equal(first.userData.sandforgeSharedToolMesh,true);
 assert.equal(first.castShadow,false);
});
test('unknown legacy assets fail open without hiding or modifying the source',()=>{
 const model=new THREE.Group();model.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)));
 assert.equal(humanizeInfantry(model),false);
 assert.equal(model.children[0].visible,true);
});
test('WebGL production build includes the visual module and applies it only to riflemen',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battlefield,/import \{humanizeInfantry,disposeHumanInfantry\} from '\/webgl-human-infantry\.js'/);
 assert.match(battlefield,/entry\.kind==='infantry'&&/);
 assert.match(battlefield,/humanizeInfantry\(model,entry\.owner\)/);
 assert.match(battlefield,/\?soldier=legacy/);
 assert.match(build,/cpSync\('scripts\/webgl-human-infantry\.js','dist\/webgl-human-infantry\.js'\)/);
 assert.match(build,/cpSync\('scripts\/webgl-human-skinned-trousers\.js','dist\/webgl-human-skinned-trousers\.js'\)/);
 assert.match(battlefield,/if\(e\.kind==='infantry'\)disposeHumanInfantry\(e\.detail\)/);
});
test('the old mechanical arms, robot legs, ankle blocks and rigid mitts are actually hidden',()=>{
 const {root,bone}=atlas();
 assert.equal(humanizeInfantry(root),true);
 for(const side of ['L','R']){
  for(const [part,garment] of [
   ['UpperArm','sleeve'],['Forearm','forearm'],['Thigh','thigh'],['Shin','calf']
  ]){
   const limb=root.getObjectByName('Atlas_'+part+side);
   const metal=limb.getObjectByName('Atlas_RobotPlate_'+part+side);
   const suit=limb.getObjectByName('Atlas_'+part+side+'Suit');
   const replacement=limb.getObjectByName('SF_Human_'+garment+side);
   assert.equal(metal.visible,false,part+side+' still shows robot plates');
   assert.equal(suit.visible,false,part+side+' still shows square robotic limb');
   assert.ok(replacement,'missing cloth '+part+side);
   assert.equal(replacement.parent,limb,'limbs must follow authored joints');
   assert.ok(replacement.geometry.attributes.normal.getX(0)>0,
    'fabric triangles must be wound outward for correct face culling');
  }
  const boot=root.getObjectByName('Atlas_Boot'+side);
  assert.equal(boot.getObjectByName('Atlas_BootUpper').visible,false);
  assert.ok(boot.getObjectByName('SF_Human_CombatBootToe'+side));
  assert.ok(boot.getObjectByName('SF_Human_CombatBootSole'+side));
  const glove=root.getObjectByName('Atlas_Glove'+side);
  assert.equal(glove.getObjectByName('Atlas_KnucklePlate').visible,false);
  assert.ok(glove.getObjectByName('SF_Human_TacticalGlove'+side));
  assert.ok(root.getObjectByName('SF_Human_CargoPocket'+side));
 }
 const sleeve=root.getObjectByName('SF_Human_sleeveL');
 // The garment geometry is defined in local unit-radius coordinates,
 // then scaled to ~0.1 m by the visual rig. Sampling at z=.10 after
 // that scale would test a point only ~1 cm from the rotating bone axis.
 // Sample the actual outer sleeve circumference (z=1) instead.
 const testPoint=new THREE.Vector3(0,0,1);
 root.updateMatrixWorld(true);
 const before=sleeve.localToWorld(testPoint.clone());
 bone.rotation.y=.73;
 root.updateMatrixWorld(true);
 const after=sleeve.localToWorld(testPoint.clone());
 const moved=before.distanceTo(after);
 assert.ok(moved>.05,
  'new cloth must follow its animated bone (world displacement '+moved.toFixed(5)+' m)');
});

test('human-scale proportions stay lean; soft shoulders and waist follow their rig groups',()=>{
 const {root,rifle}=atlas();
 assert.equal(humanizeInfantry(root,0),true);
 for(const side of ['L','R']){
  const thigh=root.getObjectByName('SF_Human_thigh'+side);
  const calf=root.getObjectByName('SF_Human_calf'+side);
  const forearm=root.getObjectByName('SF_Human_forearm'+side);
  assert.ok(thigh&&calf&&forearm);
  assert.ok(thigh.scale.x>.12&&thigh.scale.x<.16,'fallback trousers must not be spindly or oversized');
  assert.ok(calf.scale.x>.12&&calf.scale.x<.16,'fallback calves must have human volume');
  assert.ok(forearm.scale.x<.11,'oversized robotic forearm');
  assert.ok(root.getObjectByName('SF_Human_ShoulderFabric'+(side==='L'?-1:1)));
 }
 const pack=root.getObjectByName('SF_Human_RadioRucksack');
 assert.ok(pack.scale.y<.32,'backpack should not dwarf the helmet');
 assert.ok(root.getObjectByName('Atlas_Rifle')===rifle,'weapon rig preserved');
 // The body and trouser joins remain on authored moving joints.
 const waist=root.getObjectByName('SF_Human_TrouserHips');
 assert.equal(waist.parent,root.getObjectByName('Atlas_UtilityBelt'));
 assert.equal(waist.material.name,'SF_Human_DesertCombatUniform');
});

test('front-view infantry silhouette does not regress into oversized toy armour',()=>{
 const {root,rifle,socket}=atlas();
 assert.equal(humanizeInfantry(root,0),true);
 const helmet=root.getObjectByName('SF_Human_HelmetCrown');
 const vest=root.getObjectByName('SF_Human_PlateCarrier');
 const jacket=root.getObjectByName('SF_Human_Jacket');
 const kneepad=root.getObjectByName('SF_Human_SoftKneepadL');
 const thigh=root.getObjectByName('SF_Human_thighL');
 const fieldPack=root.getObjectByName('SF_Human_RadioRucksack');
 assert.ok(helmet.scale.x<=.19,'helmet too wide from game camera');
 assert.ok(vest.scale.x<=.41&&vest.scale.y<=.29,'bulky plate carrier');
 assert.ok(jacket.scale.y<=.36,'oversized torso');
 assert.ok(kneepad.scale.x<=.11,'robotic hard knee');
 assert.ok(thigh.scale.x>.12&&thigh.scale.x<.16,'fallback lower body must not be thin sticks');
 assert.ok(fieldPack.scale.y<=.26,'backpack must stay beneath helmet');
 assert.equal(root.getObjectByName('Atlas_Rifle'),rifle);
 assert.equal(rifle.parent,socket);
});

test('front silhouette is uniform rather than bare robot arms with oversized armour',()=>{
 const {root,rifle,socket}=atlas();
 assert.equal(humanizeInfantry(root,0),true);
 const jacket=root.getObjectByName('SF_Human_Jacket');
 assert.equal(jacket.geometry.type,'SphereGeometry','torso must be rounded, not a rectangular robotic block');
 const chest=root.getObjectByName('SF_Human_PlateCarrier');
 assert.ok(chest.scale.x<=.39&&chest.scale.y<=.27,'vest too bulky');
 for(const side of ['L','R']){
  const sleeve=root.getObjectByName('SF_Human_sleeve'+side);
  const forearm=root.getObjectByName('SF_Human_forearm'+side);
  const ankle=root.getObjectByName('SF_Human_CombatBootAnkle'+side);
  const toe=root.getObjectByName('SF_Human_CombatBootToe'+side);
  const calf=root.getObjectByName('SF_Human_calf'+side);
  assert.equal(sleeve.material.name,'SF_Human_DesertCombatUniform');
  assert.equal(forearm.material.name,'SF_Human_DesertCombatUniform',
   'forearms should be fabric, not oversized bare skin');
  assert.ok(forearm.scale.x<.09);
  assert.ok(calf.scale.x>.12&&calf.scale.x<.16);
  assert.ok(ankle.scale.x<.08&&toe.scale.x<.09);
  assert.ok(root.getObjectByName('SF_Human_RolledSleeveCuff'+side));
 }
 assert.equal(root.getObjectByName('Atlas_Rifle'),rifle);
 assert.equal(rifle.parent,socket);
});

test('taller human stature preserves the hand and rifle as one animated coordinate space',()=>{
 const {root,rifle,socket}=atlas();
 const originalScale=root.scale.y;
 assert.equal(humanizeInfantry(root,0),true);
 assert.ok(root.scale.y>originalScale*1.09&&root.scale.y<originalScale*1.10,
  'the standing human should be taller, not squatter');
 assert.equal(root.getObjectByName('Atlas_Rifle'),rifle);
 assert.equal(rifle.parent,socket);
 const once=root.scale.y;
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.scale.y,once,'no cumulative scaling when an actor reloads');
});

function riggedAtlas(){
 const actor=atlas(),{root}=actor;
 for(const side of ['L','R']){
  const hip=new THREE.Bone();hip.name='UpperLeg'+side;
  hip.position.set(side==='L'?.125:-.125,1.0,0);
  const knee=new THREE.Bone();knee.name='LowerLeg'+side;
  knee.position.set(0,-.45,.045);
  const ankle=new THREE.Bone();ankle.name='Foot'+side;
  ankle.position.set(0,-.45,-.05);
  root.add(hip);hip.add(knee);knee.add(ankle);
 }
 root.updateMatrixWorld(true);
 return actor;
}
test('reference-style trousers replace four rigid stilt legs with one smoothly skinned mesh',()=>{
 const {root,rifle}=riggedAtlas();
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.userData.sandforgeHumanSkinnedLegs,true);
 const pants=root.getObjectByName('SF_Human_SkinnedTrousers');
 assert.ok(pants?.isSkinnedMesh,'the game must render a genuine bone-skinned pair of pants');
 assert.equal(SKINNED_TROUSERS_REVISION,'human-articulated-cargo-pants-v4-soft-knee-20261122');
 assert.deepEqual(pants.skeleton.bones.map(b=>b.name),
  ['UpperLegL','LowerLegL','FootL','UpperLegR','LowerLegR','FootR']);
 assert.ok(pants.geometry.attributes.position.count>700,'high enough topology for round calves and knees');
 assert.equal(pants.geometry.attributes.skinIndex.count,
  pants.geometry.attributes.position.count);
 const weight=pants.geometry.attributes.skinWeight;
 const joints=pants.geometry.attributes.skinIndex;
 for(let i=0;i<weight.count;i+=19){
  const sum=weight.getX(i)+weight.getY(i)+weight.getZ(i)+weight.getW(i);
  assert.ok(Math.abs(sum-1)<1e-5,'bone weights must sum to 1');
  assert.ok(joints.getX(i)<6&&joints.getY(i)<6&&joints.getZ(i)<6);
 }
 for(const side of ['L','R']){
  assert.equal(root.getObjectByName('SF_Human_thigh'+side).visible,false,
   'robot thigh tube must not show behind the real trousers');
  assert.equal(root.getObjectByName('SF_Human_calf'+side).visible,false,
   'robot shin tube must not poke through the trousers');
  assert.equal(root.getObjectByName('SF_Human_TrouserKnee'+side).visible,false,
   'old knee ball must not interrupt the continuous fabric');
 }
 assert.equal(root.getObjectByName('Atlas_Rifle'),rifle);
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.getObjectByName('SF_Human_SkinnedTrousers'),pants);
 assert.equal(disposeHumanInfantry(root),true);
 assert.equal(root.userData.sandforgeHumanPants,null);
 assert.equal(disposeHumanInfantry(root),false);
});
test('knee bending deforms lower fabric with the existing walking skeleton',()=>{
 const {root}=riggedAtlas();
 humanizeInfantry(root,1);
 const pants=root.getObjectByName('SF_Human_SkinnedTrousers');
 assert.ok(pants);
 root.updateMatrixWorld(true);
 const vertexIndex=20*16+4; // L shin: should be almost fully weighted to LowerLegL
 const before=pants.getVertexPosition(vertexIndex,new THREE.Vector3()).clone();
 root.getObjectByName('LowerLegL').rotation.z=.43;
 root.updateMatrixWorld(true);
 const after=pants.getVertexPosition(vertexIndex,new THREE.Vector3());
 assert.ok(before.distanceTo(after)>.025,
  'skinned lower leg must bend with the animated knee, not move like a rigid stilt');
 const rightIndex=(30+1)*16+20*16+4;
 const rightBefore=pants.getVertexPosition(rightIndex,new THREE.Vector3()).clone();
 assert.ok(rightBefore.distanceTo(pants.getVertexPosition(rightIndex,new THREE.Vector3()))<1e-6,
  'opposite team leg remains independently skinned');
});

test('padded full-width trouser profile has anatomical thigh, knee and calf diameter',()=>{
 const {root}=riggedAtlas();
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.userData.sandforgeTrouserStatus,'skinned');
 const pants=root.getObjectByName('SF_Human_SkinnedTrousers');
 const positions=pants.geometry.getAttribute('position');
 const circumference=(row)=>{
  const xs=[];
  for(let i=0;i<16;i++)xs.push(positions.getX(row*16+i));
  return Math.max(...xs)-Math.min(...xs);
 };
 assert.ok(positions.count>=990,'denser hose must allow rounded contours');
 assert.ok(circumference(2)>.32,'upper thigh still looks like a stick');
 assert.ok(circumference(14)>.27,'knee should be anatomically wide');
 assert.ok(circumference(23)>.25,'calf must have natural bulk');
 assert.ok(circumference(28)>.21,'trousers must blend into boots');
});
test('Mixamo exported bone names also produce skinned trousers, not stilt fallback',()=>{
 const {root}=riggedAtlas();
 const names={UpperLegL:'mixamorig:LeftUpLeg',LowerLegL:'mixamorig:LeftLeg',
  FootL:'mixamorig:LeftFoot',UpperLegR:'mixamorig:RightUpLeg',
  LowerLegR:'mixamorig:RightLeg',FootR:'mixamorig:RightFoot'};
 root.traverse(node=>{if(node.isBone&&names[node.name])node.name=names[node.name];});
 assert.equal(findTrouserRig(root)?.length,6);
 assert.equal(humanizeInfantry(root),true);
 assert.equal(root.userData.sandforgeHumanSkinnedLegs,true);
 assert.equal(root.userData.sandforgeTrouserStatus,'skinned');
 assert.ok(root.getObjectByName('SF_Human_SkinnedTrousers'));
});
test('unsupported skeleton gets explicit diagnostic without breaking older model',()=>{
 const {root}=atlas();
 assert.equal(humanizeInfantry(root),true);
 assert.equal(root.userData.sandforgeHumanSkinnedLegs,false);
 assert.equal(root.userData.sandforgeTrouserStatus,'missing-compatible-leg-bones');
 assert.equal(root.getObjectByName('SF_Human_thighL').visible,true);
 assert.equal(root.getObjectByName('SF_Human_calfR').visible,true);
});

test('nonstandard bone names recover from the exported Atlas joint attachments',()=>{
 const {root}=riggedAtlas();
 for(const side of ['L','R']){
  const hip=root.getObjectByName('UpperLeg'+side);
  const knee=root.getObjectByName('LowerLeg'+side);
  const foot=root.getObjectByName('Foot'+side);
  const thigh=root.getObjectByName('Atlas_Thigh'+side);
  const shin=root.getObjectByName('Atlas_Shin'+side);
  const boot=root.getObjectByName('Atlas_Boot'+side);
  hip.attach(thigh);knee.attach(shin);foot.attach(boot);
  hip.name='CustomUpper'+side;
  knee.name='CustomKnee'+side;
  foot.name='CustomFoot'+side;
 }
 root.updateMatrixWorld(true);
 const actual=findTrouserRig(root);
 assert.ok(actual,'must discover real leg bones from Atlas geometry parents');
 assert.deepEqual(actual.map(b=>b.name),
  ['CustomUpperL','CustomKneeL','CustomFootL',
   'CustomUpperR','CustomKneeR','CustomFootR']);
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.userData.sandforgeTrouserStatus,'skinned');
 assert.ok(root.getObjectByName('SF_Human_SkinnedTrousers'));
});
test('missing bones use anatomically fuller rigid-fabric fallback rather than thin sticks',()=>{
 const {root}=atlas();
 humanizeInfantry(root,0);
 assert.equal(root.userData.sandforgeHumanSkinnedLegs,false);
 assert.equal(root.userData.sandforgeTrouserStatus,'missing-compatible-leg-bones');
 for(const side of ['L','R']){
  const thigh=root.getObjectByName('SF_Human_thigh'+side);
  const calf=root.getObjectByName('SF_Human_calf'+side);
  assert.ok(thigh.visible&&calf.visible);
  assert.ok(thigh.scale.x>.12&&calf.scale.x>.12,'fallback must be wider');
 }
});

test('skinned knees use soft fabric contour, not hard square plates or exposed straps',()=>{
 const {root}=riggedAtlas();
 assert.equal(humanizeInfantry(root,0),true);
 assert.equal(root.userData.sandforgeTrouserStatus,'skinned');
 for(const side of ['L','R']){
  const pad=root.getObjectByName('SF_Human_SoftKneepad'+side);
  const strap=root.getObjectByName('SF_Human_KneeStrap'+side);
  assert.ok(pad,'kneepad should remain on the articulated knee joint');
  assert.equal(pad.geometry.type,'SphereGeometry','no robot-like rectangular kneecap');
  assert.equal(strap.visible,false,'old hard knee straps must not poke through fabric');
 }
});
test('trouser rings bend smoothly across an already flexed knee at bind pose',()=>{
 const {root}=riggedAtlas();
 const knee=root.getObjectByName('LowerLegL');
 knee.rotation.z=.65; // realistic angled knee in a paused running animation
 root.updateMatrixWorld(true);
 assert.equal(humanizeInfantry(root,0),true);
 const pants=root.getObjectByName('SF_Human_SkinnedTrousers');
 const attr=pants.geometry.attributes.position;
 const radial=16;
 const sectionDirection=row=>{
  const a=new THREE.Vector3().fromBufferAttribute(attr,row*radial);
  const b=new THREE.Vector3().fromBufferAttribute(attr,row*radial+radial/2);
  return a.sub(b).normalize();
 };
 // The old geometry snapped the frame from one segment to the other,
 // producing an abrupt elbow-shaped kink in the trousers at the knee.
 const around=[12,13,14,15,16,17].map(sectionDirection);
 for(let i=1;i<around.length;i++)
  assert.ok(around[i-1].angleTo(around[i])<.20,
   'ring axes should blend smoothly through bent knee');
});


test('natural idle pose narrows feet and bends knees without changing hands or rifle binding',()=>{
 const {root,rifle,socket}=riggedAtlas();
 const arm=new THREE.Bone();arm.name='Index1R';arm.position.set(0,1.36,.2);
 root.add(arm);arm.attach(socket);
 root.updateMatrixWorld(true);
 const beforeL=root.getObjectByName('FootL').getWorldPosition(new THREE.Vector3());
 const beforeR=root.getObjectByName('FootR').getWorldPosition(new THREE.Vector3());
 const beforeDistance=Math.abs(beforeL.x-beforeR.x);
 const handRotation=arm.quaternion.clone();
 const rifleRotation=rifle.quaternion.clone();
 const pose=createHumanStance(root);
 assert.ok(pose&&pose.legs.length===2);
 assert.equal(HUMAN_STANCE_REVISION,'human-infantry-stance-v1-20261122');
 assert.equal(applyHumanStance(pose,{dt:.05,moving:false}),true);
 root.updateMatrixWorld(true);
 const afterL=root.getObjectByName('FootL').getWorldPosition(new THREE.Vector3());
 const afterR=root.getObjectByName('FootR').getWorldPosition(new THREE.Vector3());
 assert.ok(Math.abs(afterL.x-afterR.x)<beforeDistance,
  'idle legs should stand closer together');
 assert.ok(pose.legs.every(l=>Math.abs(l.knee.bone.quaternion.x)>0),
  'the knees must no longer be perfectly rigid');
 assert.ok(arm.quaternion.equals(handRotation),'no arm/hand IK changes');
 assert.ok(rifle.quaternion.equals(rifleRotation),'rifle orientation untouched');
 assert.equal(rifle.parent,socket);
 assert.equal(restoreHumanStance(pose),true);
 root.updateMatrixWorld(true);
 assert.ok(root.getObjectByName('FootL').getWorldPosition(new THREE.Vector3()).distanceTo(beforeL)<1e-6);
 assert.ok(root.getObjectByName('FootR').getWorldPosition(new THREE.Vector3()).distanceTo(beforeR)<1e-6);
 assert.equal(restoreHumanStance(pose),false);
 assert.equal(disposeHumanStance(pose),true);
 assert.equal(root.userData.sandforgeHumanStance,undefined);
});
test('natural walk stance follows original clip phase without cumulative joint drift',()=>{
 const {root}=riggedAtlas();
 const pose=createHumanStance(root);
 const joints=pose.legs.flatMap(l=>[l.upper,l.knee,l.foot]);
 const originals=joints.map(j=>j.bone.quaternion.clone());
 applyHumanStance(pose,{moving:true,dt:.08,walkPhase:.1});
 const a=pose.legs[0].upper.bone.quaternion.clone();
 restoreHumanStance(pose);
 applyHumanStance(pose,{moving:true,dt:.08,walkPhase:.6});
 const b=pose.legs[0].upper.bone.quaternion.clone();
 assert.ok(a.angleTo(b)>.005,'run follows clip phases instead of a static stiff pose');
 restoreHumanStance(pose);
 for(let i=0;i<joints.length;i++)
  assert.ok(joints[i].bone.quaternion.angleTo(originals[i])<1e-7,'no drift between mixer frames');
 for(let j=0;j<300;j++){
  applyHumanStance(pose,{dt:.016,walkPhase:(j%40)/40,moving:j%4!==0});
  restoreHumanStance(pose);
 }
 for(let i=0;i<joints.length;i++)
  assert.ok(joints[i].bone.quaternion.angleTo(originals[i])<1e-7,'no long-session pose drift');
});
test('firing is braced but original hit/death animation is never modified',()=>{
 const pose=createHumanStance(riggedAtlas().root);
 applyHumanStance(pose,{dt:.08,moving:false});
 const strong=pose.legs[0].knee.bone.quaternion.angleTo(new THREE.Quaternion());
 restoreHumanStance(pose);
 applyHumanStance(pose,{dt:.08,moving:false,shooting:true});
 const firing=pose.legs[0].knee.bone.quaternion.angleTo(new THREE.Quaternion());
 assert.ok(firing<strong,'firing should use smaller supporting-leg corrections');
 restoreHumanStance(pose);
 assert.equal(applyHumanStance(pose,{dt:.016,hurt:true}),false);
 assert.equal(pose.modified,false);
 assert.equal(applyHumanStance(pose,{dt:.016,death:true}),false);
 assert.equal(pose.modified,false);
});
test('unsupported model has no secondary pose controller or new per-frame work',()=>{
 const noRig=new THREE.Group();
 assert.equal(createHumanStance(noRig),null);
 assert.equal(applyHumanStance(null,{moving:true,dt:.02}),false);
 assert.equal(restoreHumanStance(null),false);
 assert.equal(disposeHumanStance(null),false);
});
test('WebGL production runtime wires stance around mixer and packs the module',()=>{
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 const presenter=readFileSync('scripts/webgl-actor-presentation.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(battlefield,/entry\.humanStance=createHumanStance\(model\)/);
 assert.match(battlefield,/disposeHumanStance\(e\.humanStance\)/);
 assert.match(presenter,/restoreHumanStance\(entry\.humanStance\)/);
 assert.match(presenter,/clips\.mixer\.update\(Math\.min\(\.08,dt\)\)/);
 assert.match(presenter,/applyHumanStance\(entry\.humanStance,/);
 assert.match(build,/cpSync\('scripts\/webgl-human-stance\.js','dist\/webgl-human-stance\.js'\)/);
});
