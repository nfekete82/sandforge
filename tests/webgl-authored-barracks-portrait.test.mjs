import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {hasFinalBarracksPBR,prepareFinalBarracksPortrait,FINAL_BARRACKS_PORTRAIT_REVISION}
 from '../scripts/webgl-pbr-barracks-portrait.js';

function fixture(){
 const model=new THREE.Group();
 const maps=[
  new THREE.DataTexture(new Uint8Array([179,172,130,255]),1,1),
  new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1),
  new THREE.DataTexture(new Uint8Array([209,209,209,255]),1,1)
 ];
 const materials=new Map();
 function add(name,materialName){
  const mat=new THREE.MeshStandardMaterial({name:materialName,color:'#b9a17d',metalness:.98,roughness:.3});
  mat.map=maps[0];mat.normalMap=maps[1];mat.roughnessMap=maps[2];
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);mesh.name=name;
  model.add(mesh);materials.set(name,mat);
 }
 for(const name of ['door_leaf_L','door_leaf_R','door_recess_back','door_panel_-1_0',
  'roof_top_center'])add(name,name.startsWith('door')?'PBR_dark_door':'SF_OriginalPBR_roof');
 add('front_wall_1','SF_OriginalPBR_walls');
 add('radar_dish','SF_OriginalPBR_metal');
 return {model,materials,maps};
}
test('final PBR barracks is detected by real authored door/roof nodes',()=>{
 const {model}=fixture();
 assert.equal(hasFinalBarracksPBR(model),true);
 assert.equal(hasFinalBarracksPBR(new THREE.Group()),false);
 const missing=model.getObjectByName('door_panel_-1_0');missing.removeFromParent();
 assert.equal(hasFinalBarracksPBR(model),false,'do not modify legacy prefabs');
});

test('HUD keeps ORIGINAL PBR camouflage and lightens only stone/roof, never doors/radar',()=>{
 const {model,materials,maps}=fixture();
 const wall=materials.get('front_wall_1'),roof=materials.get('roof_top_center');
 const door=materials.get('door_leaf_L'),radar=materials.get('radar_dish');
 const wallHex=wall.color.getHex(),roofHex=roof.color.getHex();
 assert.equal(prepareFinalBarracksPortrait(model),2);
 for(const m of [wall,roof]){
  assert.equal(m.color.getHex(),m===wall?wallHex:roofHex,'no orange repaint');
  assert.ok(m.metalness<=.14);
  assert.ok(m.roughness>=.77);
  assert.equal(m.emissiveMap,maps[0]);
  assert.equal(m.normalMap,maps[1]);
  assert.equal(m.roughnessMap,maps[2]);
  assert.equal(m.userData.sandforgeBarracksPortrait,FINAL_BARRACKS_PORTRAIT_REVISION);
 }
 for(const m of [door,radar]){
  assert.equal(m.metalness,.98,'black entrance and radar remain dark metal');
  assert.equal(m.emissiveMap,null);
 }
 assert.equal(prepareFinalBarracksPortrait(model),0,'do not accumulate exposure on repeated renders');
});

test('live PBR models skip legacy shader and are polished exactly as in gameplay',()=>{
 const src=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(src,/kind==='barracks'&&hasFinalBarracksPBR\(model\)/);
 assert.match(src,/else if\(authoredBarracks\)\{/);
 assert.match(src,/if\(polishBarracksProps\(model\)\)model\.traverse/);
 assert.match(src,/prepareFinalBarracksPortrait\(model\)/);
 assert.match(src,/node\.geometry=node\.geometry\.clone\(\)/);
 assert.match(src,/node\.material\.map\(m=>m\.clone\(\)\)/,
  'avoid disposing the live polished-prop materials after rendering HUD');
 assert.match(build,/cpSync\('scripts\/webgl-pbr-barracks-portrait\.js','dist\/webgl-pbr-barracks-portrait\.js'\)/);
 assert.match(src,/if\(kind==='barracks'\)finishBarracksDesertPalette\(model\)/,
  'legacy barracks still retain previous fallback, only final PBR skips it');
 const world=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(world,/if\(type==='building'&&entry\.kind==='barracks'&&!hasMeshySkin\)polishBarracksProps\(model\)/);
});
