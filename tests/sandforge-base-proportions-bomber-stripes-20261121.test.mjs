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
import {FACTION_PAINT} from '../scripts/sandforge-faction-palette.js';
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
test('balance both helicopter rocket pods for the front-view cabin silhouette',()=>{
 assert.deepEqual(scoutRocketPodMount(-1),{x:-25,y:18,z:-5});
 assert.deepEqual(scoutRocketPodMount(1),{x:14,y:18,z:-5});
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 assert.equal(entry.scoutRocketPods.children[0].position.x,-25);
 assert.equal(entry.scoutRocketPods.children[1].position.x,14);
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
test('bomber retains both original GLB wings and textures; flush paint never patches shaders',()=>{
 for(const owner of [0,1]){
  const {model,left,right,fuselage,cockpit,original,tex}=sampleBomber();
  const entry={kind:'bomber',owner,node:new THREE.Group(),detail:model};
  entry.node.add(model);
  const originalWingGeometry=[left.geometry,right.geometry];
  const originalCount=model.children.length;
  attachTeamMarkings(entry,owner,'bomber',180,60);
  assert.equal(entry.teamMarkings,undefined);
  assert.equal(entry.node.getObjectByName('SandforgeTeamUniformAndFlags'),undefined);
  assert.equal(model.children.length,originalCount+1,'only one surface overlay is added');
  assert.equal(model.userData.sandforgeBomberWingPaintedMeshes,2);
  assert.equal(model.userData.sandforgeBomberWingPaintRevision,BOMBER_WING_STRIPES_REVISION);
  assert.equal(left.material,original,'original port wing shader is unchanged');
  assert.equal(right.material,original,'original starboard wing shader is unchanged');
  assert.equal(fuselage.material,original);
  assert.equal(cockpit.material,original);
  assert.equal(left.geometry,originalWingGeometry[0]);
  assert.equal(right.geometry,originalWingGeometry[1]);
  assert.equal(left.material.map,tex);
  assert.equal(right.material.map,tex);
  const stripe=model.getObjectByName('SandforgeBomberFlushWingPaint');
  assert.ok(stripe?.isMesh);
  assert.ok(stripe.geometry.attributes.position.count>0);
  assert.equal(stripe.material.color.getHex(),new THREE.Color(
   FACTION_PAINT[owner]).getHex(), 'wing geometry uses canonical team paint');
  assert.equal(stripe.material.depthWrite,false);
  assert.equal(stripe.castShadow,false);
  assert.equal(stripe.userData.nonPlayable,true);
  const box=new THREE.Box3().setFromObject(left);
  assert.ok(box.getSize(new THREE.Vector3()).x>20,'port wing still exists');
 }
});
test('bomber surface bands recolour without stacking geometry or altering wing shaders',()=>{
 const {model,left,right,original}=sampleBomber();
 assert.equal(paintBomberWingStripes(model,0),2);
 const first=model.getObjectByName('SandforgeBomberFlushWingPaint');
 const blue=first.material.color.getHex();
 assert.equal(paintBomberWingStripes(model,0),2);
 assert.equal(model.getObjectByName('SandforgeBomberFlushWingPaint'),first);
 assert.equal(paintBomberWingStripes(model,1),2);
 const second=model.getObjectByName('SandforgeBomberFlushWingPaint');
 assert.notEqual(second,first);
 assert.notEqual(second.material.color.getHex(),blue);
 assert.equal(first.parent,null);
 assert.equal(model.children.filter(c=>c.name==='SandforgeBomberFlushWingPaint').length,1);
 assert.equal(left.material,original);
 assert.equal(right.material,original);
});
test('rear-right bomber paint is mirrored onto the left wing with identical proportions',()=>{
 const {model,left,right,original}=sampleBomber();
 assert.equal(paintBomberWingStripes(model,0),2);
 const paint=model.getObjectByName('SandforgeBomberFlushWingPaint');
 const vertices=paint.geometry.getAttribute('position');
 assert.equal(vertices.count%6,0);
 const perWing=vertices.count/2;
 assert.ok(perWing>0);
 // The two halves use identical source triangles; left reverses winding
 // because mirroring about the aircraft longitudinal centre flips normals.
 for(let i=0;i<perWing;i+=3){
  for(let k=0;k<3;k++){
   const leftIndex=i+k;
   const rightIndex=perWing+i+[0,2,1][k];
   assert.ok(Math.abs(vertices.getX(leftIndex)+vertices.getX(rightIndex))<1e-5,
    'left/right span must be mirror images');
   assert.ok(Math.abs(vertices.getY(leftIndex)-vertices.getY(rightIndex))<1e-5,
    'left/right stripe surfaces must have the same elevation');
   assert.ok(Math.abs(vertices.getZ(leftIndex)-vertices.getZ(rightIndex))<1e-5,
    'left/right stripe positions along the chord must match');
  }
 }
 assert.equal(left.material,original);
 assert.equal(right.material,original);
});
test('physical wing band mask is narrow and limited to top-facing upper-wing metal',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-40,0,-22),new THREE.Vector3(40,9,22));
 const spec=bomberWingStripeSpec(box);
 assert.ok(spec);
 assert.ok(spec.outside-spec.inside<=.12);
 assert.ok(spec.inside>.5);
 assert.ok(spec.topNormal>.5);
});

test('authored bomber GLB reports the actual wing surfaces for in-game paint calibration',()=>{
 const file=readFileSync('src/assets/reborn/animation/bomber-0.glb');
 assert.equal(file.toString('ascii',0,4),'glTF');
 const jsonLength=file.readUInt32LE(12);
 const gltf=JSON.parse(file.toString('utf8',20,20+jsonLength));
 assert.ok(gltf.meshes?.length>0);
 const samples=gltf.nodes?.filter(n=>Number.isInteger(n.mesh)).map(n=>{
  const mesh=gltf.meshes[n.mesh];
  const volumes=(mesh.primitives||[]).map(p=>{
   const a=gltf.accessors[p.attributes?.POSITION];
   if(!a?.min||!a?.max)return null;
   const span=a.max.map((v,i)=>+(v-a.min[i]).toFixed(2));
   return span;
  }).filter(Boolean);
  return {name:n.name||mesh.name||'unnamed',position:n.translation,
   rot:n.rotation,scale:n.scale,extents:volumes};
 })??[];
 // Real model reference, never replace the GLB to get team markings.
 console.info('SANDFORGE_REAL_BOMBER_NODES',JSON.stringify(samples.slice(0,90)));
 assert.ok(samples.length>0);
});
