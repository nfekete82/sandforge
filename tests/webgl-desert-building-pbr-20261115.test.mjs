import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_BUILDING_PBR_REVISION,DESERT_BUILDING_IMAGES,DESERT_BUILDING_KINDS,buildingSurfaceRole,finishDesertBuildingMaterials}
 from '../scripts/webgl-building-pbr.js';

test('five actual building graphics shipped, original models still present',()=>{
 assert.deepEqual(DESERT_BUILDING_KINDS,['barracks','headquarters','factory','airfield']);
 assert.match(readFileSync('scripts/build.mjs','utf8'),/webgl-building-pbr\.js/);
 assert.ok(existsSync('dist/webgl-building-pbr.js'));
 for(const [role,path] of Object.entries(DESERT_BUILDING_IMAGES)){
  assert.ok(existsSync('.'+path),role+' SVG texture available');
  const svg=readFileSync('.'+path,'utf8');
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.length>1300);
  assert.match(svg,/<\/svg>$/);
 }
 assert.ok(readFileSync('.'+DESERT_BUILDING_IMAGES.camo,'utf8').length>80000);
 for(const kind of DESERT_BUILDING_KINDS)for(let team=0;team<=1;team++)
  assert.ok(existsSync('src/assets/reborn/buildings-3d/'+kind+'-'+team+'.glb'));
});
test('wall/camouflage/roof/metal/trim classify only safe exterior parts',()=>{
 for(const [kind,mesh,role] of [
  ['barracks','Atlas_CeramicHull_4','wall'],
  ['barracks','BarracksCamoSidePanel_1_0','camo'],
  ['barracks','BarracksSolidSideWall_-1','wall'],
  ['barracks','BarracksPanelJoint_1_0.319','trim'],
  ['barracks','Atlas_BarracksRoofCamo_8','camo'],
  ['factory','FactoryRoofArmor','roof'],
  ['factory','ServiceWallCassette','camo'],
  ['factory','SF_Factory_PBR_camo','camo'],
  ['airfield','SF_Airfield_PBR_camo','camo'],
  ['factory','Atlas_ArmouredHull_3','metal'],
  ['headquarters','HeadquartersRoofArmourA','roof'],
  ['headquarters','Atlas_CeramicHull_7','wall']
 ])assert.equal(buildingSurfaceRole(kind,mesh,''),role,mesh);
 for(const kind of DESERT_BUILDING_KINDS)
  for(const name of ['ArmouredBlastDoorLeft','FactoryBlastShutter','FactoryRollupDoor',
   'BarracksBlastDoor','RadarSpin','FactionIdentification','FanSafetyGrille',
   'SideWindow','GateHazardStripe','LadderRail','SealedEquipmentCase'])
   assert.equal(buildingSurfaceRole(kind,name,'Ceramic Paint'),null,kind+':'+name);
 assert.equal(buildingSurfaceRole('airfield','RoofCamo',''),null);
 assert.equal(buildingSurfaceRole('airfield','SF_Airfield_PBR_roof_corrugated',''),null);
 assert.equal(buildingSurfaceRole('factory','SF_Factory_PBR_roof',''),null);
 assert.equal(buildingSurfaceRole('airfield','HangarRollupSlat_0_00',''),null);
});
function fixture(){
 const root=new THREE.Group(),originals=new Map();
 for(const name of ['Atlas_CeramicHull_4','BarracksCamoSidePanel_1_0',
  'BarracksPanelJoint_1_0.319','FactoryRoofArmor','ArmouredBlastDoorLeft','SideWindow']){
  const source=new THREE.MeshStandardMaterial({color:'#bb9677',roughness:.72});
  source.map=new THREE.Texture();source.normalMap=new THREE.Texture();
  source.roughnessMap=new THREE.Texture();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),source);
  mesh.name=name;root.add(mesh);originals.set(name,source);
 }
 return {root,originals};
}
test('PBR textures are triplanar in local coordinates, preserve original GLB maps, no geometry',()=>{
 const {root,originals}=fixture();
 assert.equal(finishDesertBuildingMaterials(root,'barracks')>=3,true);
 assert.equal(finishDesertBuildingMaterials(root,'barracks'),0,'idempotent');
 assert.equal(root.children.length,6);
 for(const mesh of root.children){
  const source=originals.get(mesh.name);
  const role=buildingSurfaceRole('barracks',mesh.name);
  if(!role){
   assert.equal(mesh.material,source);
   continue;
  }
  assert.notEqual(mesh.material,source);
  assert.equal(source.userData.sandforgeBuildingPBRRevision,undefined);
  assert.equal(mesh.material.map,source.map);
  assert.equal(mesh.material.normalMap,source.normalMap);
  assert.equal(mesh.material.roughnessMap,source.roughnessMap);
  assert.equal(mesh.material.userData.sandforgeBuildingPBRRevision,DESERT_BUILDING_PBR_REVISION);
  const shader={
   vertexShader:'#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}
  };
  mesh.material.onBeforeCompile(shader,{});
  assert.match(shader.vertexShader,/sfBuildingLocal=transformed/);
  assert.match(shader.fragmentShader,/texture2D\(sfBuildingAlbedo,sfP\./);
  assert.doesNotMatch(shader.fragmentShader,/sfDesertWorld|sfBarracksLocal/);
  assert.equal(shader.uniforms.sfBuildingAlbedo.value.isTexture,true);
 }
});
test('authored factory and airfield only repaint wall shells with barracks camouflage',()=>{
 for(const [kind,wall,roof,gate] of [
  ['factory','SF_Factory_PBR_camo','SF_Factory_PBR_roof','FactoryRollupDoor'],
  ['airfield','SF_Airfield_PBR_camo','SF_Airfield_PBR_roof_corrugated','HangarRollupSlat_0_00']
 ]){
  const model=new THREE.Group();
  for(const name of [wall,roof,gate]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),
    new THREE.MeshStandardMaterial({color:'#8c8272'}));
   mesh.name=name;model.add(mesh);
  }
  const originalRoof=model.getObjectByName(roof).material;
  const originalGate=model.getObjectByName(gate).material;
  const count=finishDesertBuildingMaterials(model,kind);
  assert.equal(count,1,'only exterior shell is repainted for '+kind);
  const painted=model.getObjectByName(wall);
  assert.equal(painted.material.userData.sandforgeBuildingPBRRole,'camo');
  assert.equal(painted.material.customProgramCacheKey().includes('|'+kind+'|camo'),true);
  const shader={
   vertexShader:'#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}
  };
  painted.material.onBeforeCompile(shader,{});
  assert.ok(shader.fragmentShader.includes('sfBuildingAlbedo'),'shared barracks texture');
  if(kind==='airfield')assert.ok(shader.fragmentShader.includes('sfBuildingLocal*0.055'),
   'authored hangar uses correct physical-scale camouflage');
  assert.strictEqual(model.getObjectByName(roof).material,originalRoof);
  assert.strictEqual(model.getObjectByName(gate).material,originalGate);
  assert.equal(finishDesertBuildingMaterials(model,kind),0,'idempotent');
 }
 const loader=readFileSync('scripts/webgl-airfield-pbr.js','utf8');
 assert.match(loader,/if\(ghost\)styleGhost\(model\);[\s\S]*finishDesertBuildingMaterials\(model,'airfield'\)/);
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(battle,/finishDesertBuildingMaterials\(model,'factory'\)/);
 const hud=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(hud,/if\(authoredFactory\|\|authoredAirfield\)finishDesertBuildingMaterials\(model,kind\)/);
});

test('construction ghost keeps its material pointer and invalid site tint',()=>{
 const {root}=fixture(),mesh=root.getObjectByName('BarracksCamoSidePanel_1_0');
 const mat=mesh.material.clone();
 mat.userData={sandforgePreviewMaterial:true,
  sandforgePreviewValidColor:new THREE.Color('#b9cbad'),
  sandforgePreviewInvalidColor:new THREE.Color('#e77b66')};
 mesh.material=mat;finishDesertBuildingMaterials(root,'barracks');
 assert.equal(mesh.material,mat);
 assert.equal(mat.userData.sandforgeBuildingPBROwned,false);
 mat.color.copy(mat.userData.sandforgePreviewInvalidColor);
 assert.equal(mat.color.getHex(),mat.userData.sandforgePreviewInvalidColor.getHex());
});
test('game, build ghost, all 3 HUD portraits share finish, no simulation change',()=>{
 const game=readFileSync('scripts/webgl-battlefield.js','utf8');
 const hud=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(game,/finishDesertBuildingMaterials\(model,entry\.kind\)/);
 assert.match(game,/finishDesertBuildingMaterials\(model,kind\)/);
 assert.match(hud,/finishDesertBuildingMaterials\(model,kind\)/);
 assert.match(hud,/waitForDesertBuildingTextures\(\)/);
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/finishDesertBuildingMaterials/);
 for(const kind of ['airfield','tank','infantry'])assert.equal(finishDesertBuildingMaterials(fixture().root,kind),0);
});
