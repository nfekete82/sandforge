import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addBarracksContactShadows} from '../scripts/webgl-barracks-contact-shadows.js';
import {createBuildingYard} from '../scripts/webgl-building-yard.js';

function finalBarracks(){
 const root=new THREE.Group();
 root.userData.sandforgeOriginalPBR=true;
 const wall=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),
  new THREE.MeshStandardMaterial({color:'#bcb29b'}));
 wall.name='BarracksOriginalFacade';
 root.add(wall);
 return {root,wall,originalMaterial:wall.material};
}

test('adds only visual contact decals to the recognized final barracks',()=>{
 const {root,wall,originalMaterial}=finalBarracks();
 const before=root.children.length;
 const shadows=addBarracksContactShadows(root);
 assert.ok(shadows);
 assert.equal(shadows.name,'BarracksSoftContactShadows');
 assert.equal(shadows.children.length,14);
 assert.equal(root.children.length,before+1);
 assert.equal(wall.material,originalMaterial,'GLB PBR materials must stay untouched');
 assert.equal(wall.castShadow,false,'do not alter original mesh shadow configuration');
 assert.equal(shadows.userData.nonPlayable,true);
 assert.equal(addBarracksContactShadows(root),null,'must be idempotent');
 assert.equal(root.children.length,before+1);
 const names=new Set(shadows.children.map(m=>m.name));
 for(const name of ['BarracksFrontEaveAO','BarracksLeftEaveAO',
  'BarracksRightEaveAO','BarracksBackEaveAO','BarracksGateLintelAO',
  'BarracksAwningGroundAO','BarracksSandbagGroundAO_-1',
  'BarracksCrateGroundAO_3','BarracksRoofDishAO','BarracksRoofHVACAO'])
  assert.ok(names.has(name),'missing '+name);
 for(const obj of shadows.children){
  assert.ok(obj.isMesh);
  assert.equal(obj.userData.visualOnly,true);
  assert.equal(obj.userData.nonPlayable,true);
  assert.equal(obj.userData.factionAccent,true,
   'ownership repaint must not recolor contact shadow maps');
  assert.equal(obj.castShadow,false);
  assert.equal(obj.receiveShadow,false);
  assert.equal(obj.material.transparent,true);
  assert.equal(obj.material.depthWrite,false);
  assert.equal(obj.material.depthTest,true);
  assert.equal(obj.material.map?.isDataTexture,true);
  assert.equal(obj.material.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(obj.geometry.attributes.uv.count,4);
 }
});

test('does not affect old or unknown barracks variants',()=>{
 const legacy=new THREE.Group();
 const roof=new THREE.Mesh(new THREE.BoxGeometry(4,1,4),new THREE.MeshStandardMaterial());
 legacy.add(roof);
 assert.equal(addBarracksContactShadows(legacy),null);
 assert.equal(legacy.children.length,1);
 assert.equal(roof.material.map,null);
});

test('contact texture alpha is soft and wall shading fades downwards',()=>{
 const {root}=finalBarracks(),group=addBarracksContactShadows(root);
 const ground=group.getObjectByName('BarracksSandbagGroundAO_-1');
 const wall=group.getObjectByName('BarracksFrontEaveAO');
 const rgba=ground.material.map.image.data;
 const w=ground.material.map.image.width;
 const opacity=(x,y)=>rgba[(y*w+x)*4+3];
 assert.ok(opacity(64,64)>opacity(2,2)+100,
  'soft ground contact should fade out toward its edges');
 const wallRgba=wall.material.map.image.data;
 const wallOpacity=(x,y)=>wallRgba[(y*wall.material.map.image.width+x)*4+3];
 assert.ok(wallOpacity(64,120)>wallOpacity(64,10)+100,
  'ambient eave shade should fade downward');
 assert.ok(ground.scale.x>ground.scale.y,
  'ground contact should be wide and shallow around sandbags');
});

test('major HQ and barracks yard props cast real sun shadows while thin fences remain shadow-free',()=>{
 const barracks=createBuildingYard('barracks',160);
 const crate=barracks.getObjectByName('CrateBody');
 const post=barracks.getObjectByName('BarracksWireFencePosts');
 assert.ok(crate?.castShadow,'large supply crate should cast an actual shadow');
 assert.ok(post&&!post.castShadow,'thin fence posts must not add aliasing');
 const headquarters=createBuildingYard('headquarters',160);
 assert.equal(headquarters.getObjectByName('CrateBody').castShadow,true);
 assert.equal(headquarters.getObjectByName('BarracksWireFencePosts').castShadow,false);
 const factory=createBuildingYard('factory',160);
 assert.equal(factory.getObjectByName('CrateBody').castShadow,false);
});
