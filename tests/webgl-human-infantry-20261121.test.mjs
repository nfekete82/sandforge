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
  'Atlas_KneeL','Atlas_KneeR'];
 for(const name of names){
  const parent=new THREE.Group();parent.name=name;bone.add(parent);
  const old=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
   new THREE.MeshStandardMaterial({color:'orange'}));
  old.name='Atlas_ChestCeramic';parent.add(old);
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