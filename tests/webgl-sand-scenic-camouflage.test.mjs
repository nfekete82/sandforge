import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {DESERT_SURFACE_DETAIL,installDesertSurfaceDetail}
 from '../scripts/webgl-sand-surface-detail.js';
import {createScenicDesertHouse,chooseRareScenicHouseIndex,
 SCENIC_DESERT_HOUSE_VERSION} from '../scripts/webgl-scenic-desert-houses.js';
import {createBuildingYard,disposeBuildingYard,
 CAMO_NET_BUILDING_KINDS} from '../scripts/webgl-building-yard.js';

const txt=p=>readFileSync(p,'utf8');

test('rare abandoned houses use a single EXISTING large ruin slot',()=>{
 const sites=Array.from({length:10},(_,i)=>({
  variant:i%4===0?1:0,width:i%4===0?162:68,
  depth:i%4===0?119:54,height:i%4===0?75.6:18,rotation:i*.14
 }));
 const indices=sites.flatMap((s,i)=>s.variant===1?[i]:[]);
 for(const seed of [1,17,199,3622192284,0xffffffff]){
  const chosen=chooseRareScenicHouseIndex(sites,seed,{modern:true});
  assert.ok(indices.includes(chosen),'must replace an existing large-ruin footprint');
  assert.equal(chooseRareScenicHouseIndex(sites,seed,{modern:true}),chosen);
  assert.equal(chooseRareScenicHouseIndex(sites,seed,{modern:false}),-1,
   'old maps must remain unchanged');
 }
 assert.equal(chooseRareScenicHouseIndex([],10,{modern:true}),-1);
 const scene=txt('scripts/webgl-preview.js');
 assert.match(scene,/const rareHouse=chooseRareScenicHouseIndex\(terrain\.ruins,seed/);
 assert.match(scene,/modern:biome==='desert'&&spacious&&terrain\.battlefield\?\.generatorVersion===2/);
 assert.match(scene,/if\(i===rareHouse\)\{/);
 assert.match(scene,/anchor\.add\(createScenicDesertHouse\(ruin,seed,i\)\)/);
 assert.match(scene,/else if\(micro\)/);
 const build=txt('scripts/build.mjs');
 assert.match(build,/cpSync\('scripts\/webgl-scenic-desert-houses\.js','dist\/webgl-scenic-desert-houses\.js'\)/);
});

test('rare PBR houses have aged white plaster, dark windows, real roof shapes and NO unit interaction',()=>{
 const ruin={variant:1,width:162,depth:119,height:75.6,rotation:.5};
 const forms=new Set();
 for(let i=0;i<4;i++){
  const house=createScenicDesertHouse(ruin,1729,i);
  assert.equal(house.userData.scenicHouse,true);
  assert.equal(house.userData.nonPlayable,true);
  assert.equal(house.userData.version,SCENIC_DESERT_HOUSE_VERSION);
  const meshes=[];house.traverse(o=>{if(o.isMesh)meshes.push(o)});
  assert.ok(meshes.length>=20&&meshes.length<50,'real architecture without prop spam');
  assert.ok(meshes.some(o=>o.name==='WhitewashedHouseShell'));
  assert.ok(meshes.some(o=>o.name==='RecessedWindowVoid'));
  assert.ok(meshes.some(o=>o.name==='DesertDoorRecess'));
  assert.ok(meshes.filter(o=>o.name==='WindblownPlasterChip').length===3);
  assert.ok(meshes.every(o=>o.userData.nonPlayable||o.name==='WhitewashedPitchedGable'));
  const plaster=meshes.find(m=>m.name==='WhitewashedHouseShell');
  assert.equal(plaster.material.map.image.data.length,128*128*4);
  assert.equal(plaster.material.map.colorSpace,THREE.SRGBColorSpace);
  if(house.userData.variant===0){
   assert.equal(meshes.filter(o=>o.name==='AgedSlopedTileRoof').length,2);
   assert.equal(meshes.filter(o=>o.name==='WhitewashedPitchedGable').length,2);
  }else{
   assert.ok(meshes.some(o=>o.name==='DustyRoofSlab'));
   assert.ok(meshes.some(o=>o.name==='IncompleteRoofParapet'));
  }
  forms.add(house.userData.variant);
 }
 assert.equal(forms.size,2,'both pitched and flat-roof versions must exist');
});

test('camouflage nets cover only small, partial REAR yard sections on selected military buildings',()=>{
 assert.deepEqual([...CAMO_NET_BUILDING_KINDS],
  ['headquarters','barracks','research']);
 const yard=createBuildingYard('research',160);
 const net=yard.getObjectByName('SmallDesertCamouflageNet');
 assert.ok(net,'research building should have ONE small camo awning');
 assert.equal(net.userData.nonPlayable,true);
 assert.ok(net.position.z<0,'never over the front +Z doorway');
 assert.ok(net.position.x<0,'offset to a small rear-side corner only');
 const fabric=net.getObjectByName('PartialCamouflageMesh');
 assert.ok(fabric?.isMesh);
 assert.equal(fabric.material.transparent,true);
 assert.ok(fabric.material.opacity<.86);
 assert.ok(fabric.geometry.index.count<12*9*6,
  'open perforations rather than a solid opaque tarp');
 assert.ok(fabric.geometry.attributes.color,'matte multi-tone sand and olive material');
 assert.equal(fabric.castShadow,false);
 const poles=net.children.filter(c=>c.name==='CamoNetOuterPole');
 assert.equal(poles.length,2,'not a forest of net poles');
 assert.equal(yard.children.filter(c=>c.userData?.decorativeNet).length,1);
 disposeBuildingYard(yard);
 const energy=createBuildingYard('generator',160);
 assert.equal(energy.getObjectByName('SmallDesertCamouflageNet'),undefined);
 disposeBuildingYard(energy);
 const build=txt('scripts/webgl-building-yard.js');
 assert.match(build,/if\(CAMO_NET_BUILDING_KINDS\.includes\(kind\)\)attachSmallCamouflageNet\(root,width\)/);
 assert.match(build,/root\.userData=\{visualOnly:true,nonPlayable:true,buildingContext:kind\}/);
});

test('terrain Sand PBR masks wind, dunes and grain on original terrain mesh only',()=>{
 assert.equal(DESERT_SURFACE_DETAIL.revision,'nonperiodic-natural-desert-sediment-v5-20261116');
 assert.ok(DESERT_SURFACE_DETAIL.coverageStrength>=.40&&DESERT_SURFACE_DETAIL.coverageStrength<=.50);
 assert.ok(DESERT_SURFACE_DETAIL.gritStrength>=.10&&DESERT_SURFACE_DETAIL.gritStrength<=.13);
 const renderer={capabilities:{getMaxAnisotropy:()=>8}};
 const mat=new THREE.MeshStandardMaterial({roughness:.98});
 const maps=installDesertSurfaceDetail(mat,renderer);
 assert.ok(maps.mask.image.data.length===DESERT_SURFACE_DETAIL.size**2*4);
 let nonGrey=0;
 const data=maps.mask.image.data;
 for(let i=0;i<data.length;i+=4)if(data[i]!==data[i+1])nonGrey++;
 assert.ok(nonGrey>5000,'wind mask must be distinct from coverage/compaction');
 const shader={uniforms:{},
  vertexShader:'#include <common>\nvoid main(){#include <begin_vertex>}',
  fragmentShader:'#include <common>\nvoid main(){#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>}'};
 mat.onBeforeCompile(shader,renderer);
 assert.match(shader.vertexShader,/sfDesertRelief=1\.0-clamp\(normal\.y/);
 assert.match(shader.fragmentShader,/float sfDuneZone=/);
 assert.match(shader.fragmentShader,/float sfWindZone=/);
 assert.match(shader.fragmentShader,/vec3 sfFlatSandNormal=normal/);
 assert.match(shader.fragmentShader,/normal=normalize\(mix\(sfFlatSandNormal,normal,sfWindZone\)\)/);
 assert.match(shader.fragmentShader,/roughnessFactor=clamp\(mix\(/);
 assert.ok(shader.uniforms.sfDesertSilt&&shader.uniforms.sfDesertMask);
 assert.equal(installDesertSurfaceDetail(mat,renderer),maps,
  'one shader and one texture allocation, no repeat GPU leaks');
 Object.values(maps).forEach(texture=>texture.dispose());
 mat.dispose();
});

test('sand update is visual-only: gameplay terrain generation and building PBR stay intact',()=>{
 const base=txt('scripts/webgl-preview.js');
 assert.match(base,/if\(biome==='desert'&&terrain\.battlefield\)\{/);
 assert.match(base,/installDesertRegionalPBR\(material,renderer,desertRegion\?\.id\)/);
 assert.match(txt('scripts/webgl-desert-ground-pbr.js'),/return installDesertSandPBR\(material,renderer\)/);
 assert.match(base,/const chunks=4,segments=56,patch=size\/chunks/);
 assert.match(base,/normalMap,normalScale:new THREE\.Vector2/);
 const pbr=txt('scripts/webgl-sand-pbr.js');
 assert.match(pbr,/normalStrength:\.83/);
 assert.match(pbr,/material\.roughnessMap=maps\.roughness/);
 assert.match(pbr,/installDesertSurfaceDetail\(material,renderer\)/);
 const shader=txt('scripts/webgl-sand-surface-detail.js');
 assert.match(shader,/sfDesertGround=position\.xz/);
 assert.doesNotMatch(shader,/new THREE\.Mesh\(/,
  'no overlay meshes, geometry and navigation unchanged');
 const palette=txt('scripts/webgl-desert-style.js');
 assert.match(palette,/authoredSandVertexBlend:\.76/);
});


test('command centre security lamps face OUTWARD instead of shining at the wall',()=>{
 for(const kind of ['headquarters','barracks']){
  const yard=createBuildingYard(kind,160);
  yard.updateMatrixWorld(true);
  const perimeter=yard.getObjectByName('BasePerimeter_'+kind);
  assert.ok(perimeter,'missing '+kind+' yard');
  const lamps=perimeter.children.filter(c=>c.name==='SecurityLamp');
  assert.equal(lamps.length,2,'keep both original perimeter lamps');
  for(const lamp of lamps){
   const side=Math.sign(lamp.position.x);
   const head=lamp.getObjectByName('LampHead');
   const post=lamp.getObjectByName('LampPost');
   const diffuser=lamp.getObjectByName('LampDiffuser');
   assert.ok(head&&post&&diffuser,'all existing lamp details remain');
   const pos=new THREE.Vector3(),pole=new THREE.Vector3();
   head.getWorldPosition(pos);
   post.getWorldPosition(pole);
   assert.ok(side*(pos.x-pole.x)>6,
    'lamp head must project OUTWARD on '+(side<0?'left':'right')+' side of '+kind);
   diffuser.getWorldPosition(pos);
   assert.ok(side*(pos.x-pole.x)>6,
    'emissive diffuser must face OUTWARD, never point into the facade');
   assert.equal(lamp.userData.facesOutward,true);
  }
  disposeBuildingYard(yard);
 }
});
