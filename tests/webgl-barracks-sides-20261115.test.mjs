import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishBarracksSides,finishBarracksDesertPalette,BARRACKS_PALETTE_REVISION,disposeBarracksSides}
 from '../scripts/webgl-barracks-shell.js';

function fixture(){
 const root=new THREE.Group();
 root.name='Atlas_barracks';
 const basic=(name,mat)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);
  mesh.name=name;root.add(mesh);return mesh;
 };
 const sand=new THREE.MeshStandardMaterial({color:'#decda6'});
 const steel=new THREE.MeshStandardMaterial({color:'#635743'});
 basic('Atlas_CeramicHull_4',sand);
 basic('Atlas_ArmouredHull_3',steel);
 const door=basic('Atlas_BarracksBlastDoor_9',steel);
 return {root,door};
}
test('barracks flanks are solid, sand camouflage, symmetrical and idempotent',()=>{
 const {root,door}=fixture();
 const group=finishBarracksSides(root);
 assert.equal(finishBarracksSides(root),group);
 assert.equal(group.parent,root);
 assert.equal(group.getObjectByName('BarracksCamoSidePanel_-1_0')!==undefined,true);
 assert.equal(group.getObjectByName('BarracksCamoSidePanel_1_2')!==undefined,true);
 const walls=group.children.filter(n=>n.name.startsWith('BarracksSolidSideWall_'));
 assert.equal(walls.length,2);
 assert.ok(walls.every(m=>m.scale.z>=1.9&&m.scale.y>1));
 assert.equal(door.material.color.getHexString(),'635743','original doors unchanged');
 for(const side of [-1,1]){
  assert.equal(group.getObjectByName('BarracksSideVent_'+side)?.position.x*side>1.45,true);
 }
 assert.ok(group.children.every(m=>m.userData.visualOnly&&m.userData.nonPlayable));
 assert.ok(group.children.every(m=>m.position.z+m.scale.z/2<1.1),
  'portal approach at +Z must remain unobstructed');
 disposeBarracksSides(root);
 assert.equal(root.getObjectByName('SandforgeBarracksSideCladding'),undefined);
});

test('sand/khaki finish corrects the original painted barracks hull, keeps PBR textures and doors unchanged',()=>{
 const {root,door}=fixture();
 const ceramic=root.getObjectByName('Atlas_CeramicHull_4');
 const original=ceramic.material;
 const image=new THREE.Texture(),normal=new THREE.Texture(),roughness=new THREE.Texture();
 original.map=image;original.normalMap=normal;original.roughnessMap=roughness;
 const steel=root.getObjectByName('Atlas_ArmouredHull_3');
 const steelBefore=steel.material;
 finishBarracksSides(root);
 const count=finishBarracksDesertPalette(root);
 assert.ok(count>=3,'original hull, armor and painted exterior panels corrected');
 assert.equal(finishBarracksDesertPalette(root),0,'finish is idempotent');
 assert.notEqual(ceramic.material,original,'original glTF cache remains unchanged');
 assert.equal(original.userData.sandforgeBarracksPalette,undefined);
 assert.equal(ceramic.material.map,image);
 assert.equal(ceramic.material.normalMap,normal);
 assert.equal(ceramic.material.roughnessMap,roughness);
 assert.equal(ceramic.material.userData.sandforgeBarracksPalette,BARRACKS_PALETTE_REVISION);
 assert.equal(ceramic.material.userData.sandforgeColorMapCamo,true);
 assert.equal(steel.material.map,steelBefore.map);
 assert.equal(door.material,steelBefore,'animated door retains original metal finish');
 const shader={
  vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>'
 };
 ceramic.material.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfBarracksLocal=transformed/);
 assert.match(shader.fragmentShader,/sfSand\*sfGrain/);
 assert.match(shader.fragmentShader,/sfKhaki/);
 assert.doesNotMatch(shader.fragmentShader,/sfDesertWorld/);
 disposeBarracksSides(root);
});

test('Kasernen building ghost retains live validity material while the neutral desert shader is installed',()=>{
 const {root}=fixture();
 const mesh=root.getObjectByName('Atlas_CeramicHull_4');
 const original=mesh.material;
 const preview=original.clone();
 preview.userData={sandforgePreviewMaterial:true,
  sandforgePreviewValidColor:preview.color.clone(),
  sandforgePreviewInvalidColor:new THREE.Color('#f1786d')};
 mesh.material=preview;
 finishBarracksDesertPalette(root);
 assert.equal(mesh.material,preview,'the ghost owns this material; keep the pointer used by placement validity');
 const valid=preview.userData.sandforgePreviewValidColor.clone();
 preview.color.copy(preview.userData.sandforgePreviewInvalidColor);
 assert.notEqual(preview.color.getHex(),valid.getHex(),'invalid ghost still updates its color');
 assert.equal(original.userData.sandforgeBarracksPalette,undefined,'cached source remains untouched');
});
