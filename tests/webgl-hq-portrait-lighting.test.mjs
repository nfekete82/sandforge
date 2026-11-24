import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 hasAuthoredHeadquartersPBR,prepareAuthoredHeadquartersPortrait,
 HQ_PORTRAIT_REVISION
} from '../scripts/webgl-hq-portrait.js';

function fixture(){
 const root=new THREE.Group();
 root.add(Object.assign(new THREE.Group(),{name:'HQ_Radar_01_LargeDish_Rotor'}));
 const maps=[new THREE.DataTexture(new Uint8Array([194,176,143,255]),1,1),
  new THREE.DataTexture(new Uint8Array([128,128,255,255]),1,1),
  new THREE.DataTexture(new Uint8Array([200,200,200,255]),1,1)];
 const add=(name,metalness=1)=>{
  const material=new THREE.MeshStandardMaterial({metalness,roughness:.38});
  material.name=name;
  material.map=maps[0];material.normalMap=maps[1];material.roughnessMap=maps[2];
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  mesh.name='HQ_Static_'+name;root.add(mesh);
  return material;
 };
 return {root,maps,wall:add('SF_OriginalPBR_walls'),
  roof:add('SF_OriginalPBR_roof'),canvas:add('SF_OriginalPBR_canvas'),
  dish:add('HQ_PBR_radar_steel'),door:add('HQ_PBR_black_grill')};
}

test('HQ thumbnail lowers exported metallic plaster, while preserving desert camouflage and normal maps',()=>{
 const {root,maps,wall,roof,canvas,dish,door}=fixture();
 assert.equal(hasAuthoredHeadquartersPBR(root),true);
 const materials=[wall,roof,canvas,dish,door], originals=materials.map(m=>m.map);
 const result=prepareAuthoredHeadquartersPortrait(root);
 assert.equal(result,4,'walls, roof, canvas and radar metal are adjusted, not dark door');
 for(const mat of [wall,roof,canvas]){
  assert.ok(mat.metalness<=.13);
  assert.ok(mat.roughness>=.76);
  assert.equal(mat.emissiveMap,maps[0]);
  assert.ok(mat.emissiveIntensity>=.15);
  assert.equal(mat.userData.sandforgeHQPortrait,HQ_PORTRAIT_REVISION);
 }
 assert.ok(dish.metalness<=.58);
 assert.equal(door.metalness,1,'black grille and entrance hardware stay dark');
 assert.equal(door.emissiveMap,null);
 for(const [i,m] of materials.entries()){
  assert.equal(m.map,originals[i]);
  assert.equal(m.normalMap,maps[1],'keep original PBR bump');
  assert.equal(m.roughnessMap,maps[2],'keep original roughness');
 }
 assert.equal(prepareAuthoredHeadquartersPortrait(root),0,'repeat must not layer more fill');
});

test('legacy HQ without authored PBR markers and barracks are not touched',()=>{
 for(const kind of ['barracks','headquarters']){
  const root=new THREE.Group(),mesh=new THREE.Mesh(
   new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({metalness:.92}));
  mesh.name=kind==='barracks'?'Atlas_barracks':'OldHQ';
  root.add(mesh);
  const old=mesh.material.metalness;
  assert.equal(hasAuthoredHeadquartersPBR(root),false);
  assert.equal(prepareAuthoredHeadquartersPortrait(root),0);
  assert.equal(mesh.material.metalness,old);
 }
});

test('HUD applies the authored-HQ-only path, real original texture atlas, and independent studio lights',()=>{
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(portrait,/kind==='headquarters'&&hasAuthoredHeadquartersPBR\(model\)/);
 assert.match(portrait,/if\(authoredHQ\)\{\s*(?:\/\/[^\n]*\n\s*)*prepareAuthoredHeadquartersPortrait\(model\)/);
 assert.match(portrait,/prepareAuthoredHeadquartersPortrait\(model\)/);
 assert.match(portrait,/return renderModelPortrait\(model,renderer,\{buildingCard:true,headquartersCard:authoredHQ\}\)/);
 assert.match(portrait,/headquartersCard\?3\.1/);
 assert.match(portrait,/new THREE\.AmbientLight\('#fff2dc',headquartersCard\?\.85:\.56\)/);
 assert.match(build,/cpSync\('scripts\/webgl-hq-portrait\.js','dist\/webgl-hq-portrait\.js'\)/);
 assert.ok(portrait.includes("if(kind==='barracks')finishBarracksDesertPalette(model)"),
  'Kaserne keeps previous portrait pipeline');
});

test('real HQ GLB contains embedded desert PBR maps affected by the correction',()=>{
 const raw=readFileSync('dist/src/assets/reborn/buildings-3d/headquarters-0.glb');
 assert.equal(raw.toString('ascii',0,4),'glTF');
 const j=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
 for(const materialName of ['SF_OriginalPBR_walls','SF_OriginalPBR_roof','SF_OriginalPBR_canvas']){
  const mat=j.materials.find(m=>m.name===materialName);
  assert.ok(mat,materialName);
  assert.ok(mat.pbrMetallicRoughness?.baseColorTexture,
   'HUD uses original embedded PBR atlas for '+materialName);
  assert.ok(mat.pbrMetallicRoughness?.metallicFactor>.9,
   'old exported metalness explains dark portrait '+materialName);
 }
 assert.ok(j.images.length>=40);
});
