import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {createAirfieldServiceYard,disposeAirfieldServiceYard}
 from '../scripts/webgl-airfield-service.js';
import {removeRunwaySkidArtifacts}
 from '../scripts/webgl-airfield-runway-clearance.js';
import {buildingSurfaceRole,DESERT_BUILDING_IMAGES,finishDesertBuildingMaterials}
 from '../scripts/webgl-building-pbr.js';

test('both new military facilities receive same organic CAMOUFLAGE, not flat plaster',()=>{
 assert.equal(buildingSurfaceRole('airfield','SF_Airfield_PBR_camo'),'facilityWall');
 assert.equal(buildingSurfaceRole('factory','SF_Factory_PBR_camo'),'facilityWall');
 assert.equal(buildingSurfaceRole('barracks','Atlas_CeramicHull_4'),'wall');
 assert.equal(buildingSurfaceRole('headquarters','Atlas_CeramicHull_7'),'wall');
 const path='.'+DESERT_BUILDING_IMAGES.facilityWall;
 assert.ok(existsSync(path));
 const svg=readFileSync(path,'utf8');
 assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.match(svg,/fill="#c9b18a"/);
 assert.match(svg,/fill="#717459"/);
 assert.match(svg,/transform="translate\(/);
 assert.ok((svg.match(/<path /g)||[]).length>=80,'large overlapping ORGANIC patches');
 assert.doesNotMatch(svg,/<rect x="(?:8|16|24|32)" y="0" width="8" height="8"/,
  'no 8-pixel digital checker camouflage');
 const shaded=new THREE.Group();
 for(const name of ['SF_Airfield_PBR_camo','SF_Factory_PBR_camo']){
  const material=new THREE.MeshStandardMaterial({color:'#a19579'});
  const m=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),material);
  m.name=name;shaded.add(m);
 }
 // Models are normally separate: each has one eligible facade shell.
 for(const [kind,name] of [['airfield','SF_Airfield_PBR_camo'],
  ['factory','SF_Factory_PBR_camo']]){
  const m=shaded.getObjectByName(name),root=new THREE.Group();
  root.add(m);
  assert.equal(finishDesertBuildingMaterials(root,kind),1);
  const mat=m.material;
  assert.equal(mat.userData.sandforgeBuildingPBRRole,'facilityWall');
  const shader={
   vertexShader:'#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>',uniforms:{}
  };
  mat.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/float sfWear=1\.0/);
  assert.match(shader.fragmentShader,/sfPaint\*sfWear,1\.000/);
  if(kind==='airfield')assert.match(shader.fragmentShader,/sfBuildingLocal\*0\.015/);
  assert.strictEqual(shader.uniforms.sfBuildingAlbedo.value.isTexture,true);
  root.remove(m);
  m.geometry.dispose();
  m.material.dispose();
 }
});

test('black runway skid trio is removed without touching landing marks, buildings or runway',()=>{
 const root=new THREE.Group();
 const yard=createAirfieldServiceYard(0);
 root.add(yard);
 const originalRunway=yard.getObjectByName('AirfieldExtendedRunway');
 assert.ok(originalRunway?.isMesh);
 const dark=new THREE.MeshStandardMaterial({color:'#101310',roughness:.95});
 const white=new THREE.MeshStandardMaterial({color:'#e8dfc8'});
 const stripe=(name,z,material=dark,x=32)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(17,1.5,4.3),material);
  m.name=name;m.position.set(x,3.1,z);yard.add(m);return m;
 };
 const artifacts=[stripe('LegacyUnlabelledRubber_1',-40),
  stripe('LegacyUnlabelledRubber_2',-21),
  stripe('LegacyUnlabelledRubber_3',-2)];
 const validPaint=stripe('ValidWhiteLandingMark',35,white);
 const outside=stripe('HangarExteriorToolPart',35,dark,-185);
 const high=stripe('HangarAntennaDark',35,dark,32);
 high.position.y=30;
 // The maintenance drawers were the last two dark runway strokes:
 // the cleanup hid the low one but left two higher ones visible.
 const cabinets=yard.children.filter(m=>
  m.name==='HangarMaintenanceToolCabinet'||m.name==='HangarCabinetDrawer');
 assert.equal(cabinets.length,8,'two maintenance cabinets and six drawers retained');
 const runwayLeft=originalRunway.position.x-originalRunway.geometry.parameters.width/2;
 for(const furniture of cabinets){
  const right=furniture.position.x+furniture.geometry.parameters.width/2;
  assert.ok(right<runwayLeft-2,furniture.name+' may not overlap the runway');
 }
 const entry={node:root,airfieldServiceYard:yard};
 const removed=removeRunwaySkidArtifacts(entry);
 assert.equal(removed,3,'remove only three unlabelled black bars in runway');
 assert.ok(artifacts.every(m=>m.visible===false));
 assert.equal(removeRunwaySkidArtifacts(entry),0,'idempotent');
 assert.equal(validPaint.visible,true);
 assert.equal(outside.visible,true);
 assert.equal(high.visible,true);
 assert.equal(originalRunway.visible,true);
 assert.ok(yard.children.some(m=>m.name==='AirfieldRunwayCenterDash'&&m.visible),
  'white centerline remains visible');
 // all materials and meshes are disposed once by the yard cleanup
 disposeAirfieldServiceYard({airfieldServiceYard:yard});
});

test('runtime cleanup executes after each asynchronously replaced hangar GLB',()=>{
 const src=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(src,/removeRunwaySkidArtifacts\(entry\)/);
 assert.match(src,/entry\.airfieldRunwaySweptPBR!==entry\.airfieldServiceYard\.userData\.airfieldPbrModel/);
 assert.match(src,/entry\.airfieldRunwaySweptDetail!==entry\.detail/);
 assert.match(readFileSync('scripts/build.mjs','utf8'),
  /cpSync\('scripts\/webgl-airfield-runway-clearance.js','dist\/webgl-airfield-runway-clearance.js'\)/);
});
