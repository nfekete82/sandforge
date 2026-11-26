import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {BUILDINGS} from '../dist/src/reborn/catalog.js';
import {createDefensiveBunker} from '../scripts/webgl-strategic-buildings.js';
import {createFortifiedBunker,FORTIFIED_BUNKER_REVISION,BUNKER_VISUAL_PORT_COUNT,updateBunkerFlagWind}
 from '../scripts/webgl-fortified-bunker.js';
import {MILITARY_MICRO_PBR_REVISION,militarySurfaceRole,enhanceMilitaryMicroPBR}
 from '../scripts/webgl-military-micro-pbr.js';
import {tintFactionMaterials} from '../scripts/webgl-faction-accents.js';
import {finishBuildingFacadeShading} from '../scripts/webgl-building-shading.js';

test('authored bunker keeps FIVE genuine recessed ports, a proper roof, one real team flag and native hitbox',()=>{
 assert.equal(BUNKER_VISUAL_PORT_COUNT,5);
 assert.equal(BUILDINGS.bunker.width,155);
 assert.equal(BUILDINGS.bunker.hp,1500);
 for(const owner of [0,1]){
  const b=createFortifiedBunker(owner);
  assert.equal(b.userData.visualRevision,FORTIFIED_BUNKER_REVISION);
  assert.equal(b.userData.bunkerFiringPorts,5);
  for(let i=1;i<=8;i++){
   if([1,2,3,7,8].includes(i))
    assert.ok(b.getObjectByName('Bunker_Embrasure_'+i),
     'five dark real-world recesses must remain identifiable');
  }
  const flags=b.children.filter(m=>m.userData?.bunkerFlag);
  assert.equal(flags.length,1);
  assert.ok(flags[0].material.map?.isTexture);
  assert.match(flags[0].name,owner===0?/BlueFactionFlag/:/RedFactionFlag/);
  assert.equal(flags[0].material.roughness,.97);
  const views=b.children.filter(m=>m.isMesh);
  assert.ok(views.length<=22,'static architecture is material-batched rather than dozens of GPU draws');
  const concrete=views.find(m=>m.material?.name==='Bunker cast concrete PBR');
  assert.ok(concrete?.material.map?.isTexture);
  assert.ok(concrete.material.normalMap?.isTexture);
  assert.ok(concrete.material.roughnessMap?.isTexture);
  assert.equal(concrete.material.map.image.width,512);
  assert.equal(concrete.material.normalMap.image.width,512);
  const bounds=new THREE.Box3().setFromObject(b);
  assert.ok(bounds.min.x>=-79&&bounds.max.x<=79);
  assert.ok(bounds.min.z>=-79&&bounds.max.z<=79,
   'new visual geometry may not enlarge real bunker placement footprint');
  assert.ok(bounds.max.y<=105,'flag may not grow into a gigantic antenna');
  assert.equal(tintFactionMaterials(b,owner,'bunker','building'),0,
   'generic khaki repaint must not destroy authored bunker materials');
  assert.equal(finishBuildingFacadeShading(b),0,
   'own PBR shading must not receive duplicate generic facade passes');
  const preview=b.getObjectByName('Bunker_PBR_StaticBatch_0');
  assert.ok(preview,'strategic fallback / ghost shares the same completed model');
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'',uniforms:{}};
  flags[0].material.onBeforeCompile(shader);
  assert.match(shader.vertexShader,/sfBunkerFlagClock/);
  assert.ok(shader.uniforms.sfBunkerFlagClock);
  updateBunkerFlagWind(23.7);
  assert.equal(shader.uniforms.sfBunkerFlagClock.value,23.7);
  b.traverse(m=>{if(m.isMesh){m.geometry?.dispose();m.material?.dispose();}});
 }
});
test('blue and red flags use distinct true team-coloured cloth texture',()=>{
 const a=createFortifiedBunker(0),b=createFortifiedBunker(1);
 const l=a.children.find(m=>m.userData?.bunkerFlag).material.map;
 const r=b.children.find(m=>m.userData?.bunkerFlag).material.map;
 assert.notEqual(l,r);
 assert.notDeepEqual(Array.from(l.image.data.slice(0,100)),Array.from(r.image.data.slice(0,100)));
});

test('military microdetail is selective: existing material textures, team glass and machinery are preserved',()=>{
 const mat=new THREE.MeshStandardMaterial({
  name:'Desert paint armour',color:'#a79b7e',roughness:.82,metalness:.26
 });
 const orig=new THREE.DataTexture(new Uint8Array([202,195,173,255]),1,1);
 orig.needsUpdate=true;mat.map=orig;
 const g=new THREE.Group();
 const paint=new THREE.Mesh(new THREE.BoxGeometry(6,2,12),mat);
 paint.name='Tank_HullArmour';g.add(paint);
 const glassMat=new THREE.MeshStandardMaterial({name:'CockpitGlass',transparent:true,opacity:.61});
 const canopy=new THREE.Mesh(new THREE.BoxGeometry(2,1,3),glassMat);
 canopy.name='WindowGlass';g.add(canopy);
 assert.equal(militarySurfaceRole('tank','unit',paint.name,mat.name,mat),'armour');
 assert.equal(militarySurfaceRole('tank','unit',canopy.name,glassMat.name,glassMat),null);
 assert.equal(militarySurfaceRole('infantry','unit',paint.name,mat.name,mat),null);
 const output=enhanceMilitaryMicroPBR(g,{kind:'tank',type:'unit'});
 assert.equal(output.materials,1);
 assert.equal(output.revision,MILITARY_MICRO_PBR_REVISION);
 assert.equal(paint.material.map,orig);
 assert.equal(paint.material.color.getHex(),mat.color.getHex());
 assert.equal(paint.material.roughness,mat.roughness);
 assert.equal(paint.material.metalness,mat.metalness);
 assert.equal(canopy.material,glassMat,'cockpit glass must be identical');
 assert.ok(paint.material.userData.sandforgeMilitaryMicroPBROwned);
 const shader={
  vertexShader:'#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>',
  fragmentShader:'#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  uniforms:{}
 };
 paint.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/sfMicroSample/);
 assert.match(shader.fragmentShader,/roughnessFactor=clamp/);
 assert.ok(shader.uniforms.sfMicroSurface.value.image.width===512);
 assert.equal(shader.uniforms.sfMicroSurface.value.colorSpace,THREE.NoColorSpace);
 const again=enhanceMilitaryMicroPBR(g,{kind:'tank',type:'unit'});
 assert.equal(again.materials,0,'never compose duplicate PBR shaders');
 paint.material.dispose();orig.dispose();glassMat.dispose();
});
test('build/renderer use actual improved PBR on authored GLB vehicles/buildings and original bunker rules',()=>{
 const actor=readFileSync('scripts/webgl-battlefield.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(actor,/enhanceMilitaryMicroPBR\(model,\{kind:entry\.kind,type\}\)/);
 assert.match(actor,/disposeTaggedMaterials\(e\.detail,'sandforgeMilitaryMicroPBROwned'\)/);
 assert.match(preview,/updateBunkerFlagWind\(now\*\.001\)/);
 assert.match(build,/webgl-fortified-bunker\.js/);
 assert.match(build,/webgl-military-micro-pbr\.js/);
 assert.match(readFileSync('scripts/webgl-strategic-buildings.js','utf8'),
  /if\(kind==='bunker'\)return createDefensiveBunker\(owner\)/);
 for(const owner of [0,1]){
  const active=createDefensiveBunker(owner);
  assert.equal(active.userData.bunkerFiringPorts,5);
  const marker=active.getObjectByName('Bunker_FactionMarker');
  assert.ok(marker?.isMesh);
  assert.equal('#'+marker.material.color.getHexString(),owner===0?'#2c6799':'#a64b43');
 }
});
