import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {HUMAN_INFANTRY_REVISION,humanizeInfantry} from '../scripts/webgl-human-infantry.js';

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
 assert.match(battlefield,/import \{humanizeInfantry\} from '\/webgl-human-infantry\.js'/);
 assert.match(battlefield,/entry\.kind==='infantry'&&/);
 assert.match(battlefield,/humanizeInfantry\(model,entry\.owner\)/);
 assert.match(battlefield,/\?soldier=legacy/);
 assert.match(build,/cpSync\('scripts\/webgl-human-infantry\.js','dist\/webgl-human-infantry\.js'\)/);
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
  assert.ok(thigh.scale.x<.11,'oversized robotic thigh');
  assert.ok(calf.scale.x<.11,'oversized mechanical calf');
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
 assert.ok(thigh.scale.x<=.10,'oversized lower body');
 assert.ok(fieldPack.scale.y<=.26,'backpack must stay beneath helmet');
 assert.equal(root.getObjectByName('Atlas_Rifle'),rifle);
 assert.equal(rifle.parent,socket);
});
