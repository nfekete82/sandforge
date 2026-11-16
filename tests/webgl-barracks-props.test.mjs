import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {polishBarracksProps} from '../scripts/webgl-barracks-props.js';

function marker(name){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),
  new THREE.MeshStandardMaterial({color:'#bbac92'}));
 mesh.name=name;return mesh;
}
function originalBarracks(){
 const root=new THREE.Group();
 for(const name of ['sandbag_-1_0_0','sandbag_1_0_0','crate_0',
  'crate_top_reinforcement_0_-1','radar_mast','radar_dish',
  'roof_panel','BarracksBlastDoor'])root.add(marker(name));
 return root;
}

test('replaces named original PBR props without changing hull, gate or gameplay objects',()=>{
 const root=originalBarracks();
 const gate=root.getObjectByName('BarracksBlastDoor');
 const roof=root.getObjectByName('roof_panel');
 const sandbag=root.getObjectByName('sandbag_-1_0_0');
 const crate=root.getObjectByName('crate_0');
 const radar=root.getObjectByName('radar_dish');
 assert.equal(polishBarracksProps(root),true);
 assert.equal(sandbag.visible,false);
 assert.equal(crate.visible,false);
 assert.equal(radar.visible,false);
 assert.equal(gate.visible,true);
 assert.equal(roof.visible,true);
 assert.equal(root.getObjectByName('BarracksPolishedProps').parent,root);
 const props=root.getObjectByName('BarracksPolishedProps');
 assert.ok(props.getObjectByName('BarracksPolishedSandbags'));
 assert.ok(props.getObjectByName('BarracksPolishedCrates'));
 assert.ok(props.getObjectByName('BarracksPolishedDish'));
 assert.ok(props.getObjectByName('ParabolicReflector'));
 assert.equal(polishBarracksProps(root),false,'second application must be a no-op');
 assert.equal(root.children.filter(o=>o.name==='BarracksPolishedProps').length,1);
 props.traverse(mesh=>{
  if(!mesh.isMesh)return;
  assert.equal(mesh.userData.sandforgeBarracksPropPolish,true);
  assert.ok(mesh.material.isMeshStandardMaterial);
  assert.ok(mesh.geometry.attributes.normal,'every polished mesh has vertex normals');
 });
});

test('requires all three named prop families to avoid corrupting legacy barracks',()=>{
 const legacy=new THREE.Group();
 legacy.add(marker('Atlas_BarracksBlastDoor'),marker('Atlas_CeramicHull'));
 assert.equal(polishBarracksProps(legacy),false);
 assert.equal(legacy.children.length,2);
 const partial=new THREE.Group();
 partial.add(marker('radar_dish'),marker('crate_0'));
 assert.equal(polishBarracksProps(partial),false);
 assert.equal(partial.getObjectByName('crate_0').visible,true);
});

test('sandsacks, crates and radar use separate grounded model-space groups',()=>{
 const root=originalBarracks();polishBarracksProps(root);
 const g=root.getObjectByName('BarracksPolishedProps');
 const sandbags=g.getObjectByName('BarracksPolishedSandbags');
 const crates=g.getObjectByName('BarracksPolishedCrates');
 const radar=g.getObjectByName('BarracksPolishedDish');
 const bags=[];
 sandbags.traverse(x=>{if(x.name==='BarracksLinenSandbag')bags.push(x);});
 assert.equal(bags.length,10);
 assert.equal(crates.children.length,4);
 for(const b of crates.children){
  assert.ok(Math.abs(b.position.x)<=6.5);
  assert.ok(Math.abs(b.position.z)<=5.0);
 }
 const dish=g.getObjectByName('ParabolicReflector');
 assert.ok(dish.geometry.attributes.position.count>100);
 assert.ok(dish.geometry.index.count>400);
 const box=new THREE.Box3().setFromObject(radar);
 assert.ok(box.min.y>4.0&&box.max.y<7.0);
});
