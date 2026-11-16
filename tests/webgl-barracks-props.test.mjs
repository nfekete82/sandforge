import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {polishBarracksProps} from '../scripts/webgl-barracks-props.js';
import {barracksPropMaps,BARRACKS_PROP_SURFACES} from '../scripts/webgl-barracks-prop-materials.js';

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
 assert.equal(root.userData.sandforgeOriginalPBR,true,
  'only the recognized final asset bypasses legacy building shaders');
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
  assert.ok(mesh.material.map?.isDataTexture,
   'every visible polished prop surface needs a real albedo texture: '+mesh.name);
  assert.ok(mesh.material.normalMap?.isDataTexture,
   'every polished prop needs a textile, wood or metal normal map: '+mesh.name);
  assert.ok(mesh.material.roughnessMap?.isDataTexture,
   'every polished prop needs a roughness map: '+mesh.name);
  assert.equal(mesh.material.map.colorSpace,THREE.SRGBColorSpace);
  assert.ok(mesh.geometry.attributes.uv,'PBR textures require usable UVs');
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
 assert.equal(sandbags.getObjectByName('BarracksSandbagStitch'),undefined,
  'no raised stripe/stitch meshes should float across the linen sacks');
 assert.equal(sandbags.children.length,10,
  'sandbag group must contain sacks only, without artificial bar-shaped seams');
 assert.ok(bags.every(b=>b.material.map?.isDataTexture &&
  b.material.normalMap?.isDataTexture &&
  b.material.roughnessMap?.isDataTexture),
 'the removal must keep the textured linen PBR surfaces');
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


test('every authored prop material has non-uniform color, normals and roughness maps',()=>{
 for(const role of Object.keys(BARRACKS_PROP_SURFACES)){
  const maps=barracksPropMaps(role);
  assert.equal(maps.color.image.width,256);
  assert.equal(maps.normal.image.width,256);
  assert.equal(maps.roughness.image.width,256);
  for(const tex of Object.values(maps)){
   assert.ok(tex.isDataTexture);
   assert.equal(tex.wrapS,THREE.RepeatWrapping);
   assert.equal(tex.wrapT,THREE.RepeatWrapping);
   assert.equal(tex.generateMipmaps,true);
  }
  const color=maps.color.image.data;
  const roughness=maps.roughness.image.data;
  const normal=maps.normal.image.data;
  let hasColorVariation=false,hasRoughnessVariation=false,hasNormalVariation=false;
  for(let i=4;i<color.length;i+=4){
   if(color[i]!==color[0])hasColorVariation=true;
   if(roughness[i+1]!==roughness[1])hasRoughnessVariation=true;
   if(normal[i]!==normal[0]||normal[i+1]!==normal[1])hasNormalVariation=true;
   if(hasColorVariation&&hasRoughnessVariation&&hasNormalVariation)break;
  }
  assert.ok(hasColorVariation,role+' must not be a single-color rectangle');
  assert.ok(hasRoughnessVariation,role+' must not have uniform roughness');
  assert.ok(hasNormalVariation,role+' must have real surface relief');
  assert.equal(barracksPropMaps(role),maps,'cached texture maps must be reused');
 }
});
