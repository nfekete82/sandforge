import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {BUILDINGS,UNITS} from '../dist/src/reborn/catalog.js';
import {
 BASE_BUILDING_VISUAL_SCALE,FACTORY_VISUAL_SCALE,visualBuildingScale,
 visualUnitScale,calibratedScale
} from '../scripts/webgl-scale.js';
import {scoutRocketPodMount,attachScoutRocketPods,detachScoutRocketPods}
 from '../scripts/webgl-scout-rocket-pods.js';
import {attachTeamMarkings} from '../scripts/webgl-team-markings.js';
import {paintBomberWingStripes,bomberWingStripeSpec,BOMBER_WING_STRIPES_REVISION}
 from '../scripts/webgl-bomber-wing-stripes.js';

test('base architecture matches scale family without touching gameplay footprints',()=>{
 assert.deepEqual(BASE_BUILDING_VISUAL_SCALE,{
  headquarters:.92,barracks:1.10,research:1.08,factory:.92
 });
 assert.equal(FACTORY_VISUAL_SCALE,.92);
 const scaled=Object.fromEntries(Object.entries(BASE_BUILDING_VISUAL_SCALE)
  .map(([kind,scale])=>[kind,BUILDINGS[kind].width*scale]));
 assert.ok(scaled.headquarters>scaled.factory);
 assert.ok(Math.abs(scaled.factory-scaled.research)<2);
 assert.ok(Math.abs(scaled.factory-scaled.barracks)<15);
 assert.ok(scaled.factory>=180&&scaled.factory<=190);
 assert.equal(BUILDINGS.headquarters.width,225);
 assert.equal(BUILDINGS.barracks.width,158);
 assert.equal(BUILDINGS.research.width,170);
 assert.equal(BUILDINGS.factory.width,200);
 assert.equal(BUILDINGS.factory.radius,70);
 for(const [kind,value]of Object.entries(BASE_BUILDING_VISUAL_SCALE)){
  const width=BUILDINGS[kind].width;
  const fitted=calibratedScale(kind,'building',{x:width,y:65,z:width*.85},width);
  assert.ok(fitted>0);
  assert.equal(visualBuildingScale(kind),value);
 }
});
test('tank and garage door remain proportionate while all simulation dimensions are unchanged',()=>{
 assert.equal(visualUnitScale('tank'),1.16);
 assert.equal(UNITS.tank.width,90);
 assert.equal(UNITS.tank.radius,22);
 assert.equal(BUILDINGS.factory.width,200);
 const current=UNITS.tank.width*visualUnitScale('tank')/
   (BUILDINGS.factory.width*visualBuildingScale('factory'));
 const old=UNITS.tank.width*1.23/(BUILDINGS.factory.width*.90*1.06);
 assert.ok(current<=old,'physical tank/garage clearance must improve, not worsen');
 assert.ok(current<.58);
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/const artScale=1;/);
 assert.match(source,/calibratedScale\(kind,'building',size,spec\.width\);/);
 assert.match(source,/kind==='research'\)strategic\.scale\.multiplyScalar\(visualBuildingScale\(kind\)\)/);
 assert.match(source,/\['turret','factory','headquarters','barracks'\]\.includes\(kind\)/);
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 assert.match(gates,/FactoryRollupDoor/);
 assert.match(gates,/productionGatePose/);
});
test('restore front-left helicopter rocket pod, keep the already-correct right fixed',()=>{
 assert.deepEqual(scoutRocketPodMount(-1),{x:-22,y:18,z:-5});
 assert.deepEqual(scoutRocketPodMount(1),{x:17,y:18,z:-5});
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 assert.equal(entry.scoutRocketPods.children[0].position.x,-22);
 assert.equal(entry.scoutRocketPods.children[1].position.x,17);
 assert.equal(entry.scoutRocketMuzzles.length,2);
 detachScoutRocketPods(entry);
});
const sampleBomber=()=>{
 const model=new THREE.Group();
 const tex=new THREE.DataTexture(new Uint8Array([180,165,128,255]),1,1);
 tex.needsUpdate=true;
 const original=new THREE.MeshStandardMaterial({map:tex,roughness:.85,metalness:.2});
 const left=new THREE.Mesh(new THREE.BoxGeometry(24,.4,12),original);
 left.name='Bomber_MainWing_Port';left.position.set(-27,3,0);
 const right=new THREE.Mesh(new THREE.BoxGeometry(24,.4,12),original);
 right.name='Bomber_MainWing_Starboard';right.position.set(27,3,0);
 const fuselage=new THREE.Mesh(new THREE.BoxGeometry(9,8,49),original);
 fuselage.name='Bomber_Fuselage';fuselage.position.y=3;
 const cockpit=new THREE.Mesh(new THREE.BoxGeometry(8,4,11),original);
 cockpit.name='Bomber_CockpitGlass';cockpit.position.set(0,6,17);
 model.add(left,right,fuselage,cockpit);
 return {model,left,right,fuselage,cockpit,original,tex};
};
test('bomber no longer adds floating flags; both team wing stripes live in PBR triangles',()=>{
 for(const owner of [0,1]){
  const {model,left,right,fuselage,cockpit,original,tex}=sampleBomber();
  const entry={kind:'bomber',owner,node:new THREE.Group(),detail:model};
  entry.node.add(model);
  const oldMeshCount=model.children.length;
  attachTeamMarkings(entry,owner,'bomber',180,60);
  assert.equal(entry.teamMarkings,undefined);
  assert.equal(entry.node.getObjectByName('SandforgeTeamUniformAndFlags'),undefined);
  assert.equal(model.children.length,oldMeshCount);
  assert.equal(model.userData.sandforgeBomberWingPaintedMeshes,2);
  assert.equal(model.userData.sandforgeBomberWingPaintRevision,BOMBER_WING_STRIPES_REVISION);
  assert.notEqual(left.material,original);
  assert.notEqual(right.material,original);
  assert.equal(left.material.map,tex);
  assert.equal(right.material.map,tex);
  assert.equal(fuselage.material,original);
  assert.equal(cockpit.material,original);
  const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>',
   uniforms:{}};
  left.material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.sfBomberMeshToRoot.value.isMatrix4);
  assert.match(shader.vertexShader,/sfBomberLocal/);
  assert.match(shader.fragmentShader,/sfWingInk/);
  assert.match(shader.fragmentShader,/sfWingTop/);
  assert.match(shader.fragmentShader,/diffuseColor.rgb=mix/);
  assert.equal(model.children.length,oldMeshCount);
 }
});
test('bomber stripes recolour after faction change without double-injecting GLSL',()=>{
 const {model,left,right}=sampleBomber();
 assert.equal(paintBomberWingStripes(model,0),2);
 const first=left.material,second=right.material;
 assert.equal(paintBomberWingStripes(model,1),2);
 assert.equal(left.material,first);
 assert.equal(right.material,second);
 assert.equal(first.userData.sandforgeBomberStripeOwner,1);
 assert.equal(second.userData.sandforgeBomberStripeOwner,1);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
   fragmentShader:'#include <common>\n#include <color_fragment>',
   uniforms:{}};
 first.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/sfWingBand/);
 assert.equal((shader.vertexShader.match(/sfBomberMeshToRoot/g)||[]).length,3);
});
test('physical wing band mask is narrow and limited to top-facing upper-wing metal',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-40,0,-22),new THREE.Vector3(40,9,22));
 const spec=bomberWingStripeSpec(box);
 assert.ok(spec);
 assert.ok(spec.outside-spec.inside<=.12);
 assert.ok(spec.inside>.5);
 assert.ok(spec.topNormal>.5);
});
