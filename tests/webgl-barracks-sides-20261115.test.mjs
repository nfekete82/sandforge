import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {finishBarracksSides,disposeBarracksSides}
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
