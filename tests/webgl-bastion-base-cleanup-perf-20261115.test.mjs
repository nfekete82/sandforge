import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {removeBastionFrontShield} from '../scripts/webgl-bastion-visual.js';

function mockBastion(){
 const root=new THREE.Group();
 const originalMaterials=[];
 const feature=(name,geometry)=>{
  const material=new THREE.MeshStandardMaterial();
  originalMaterials.push(material);
  const mesh=new THREE.Mesh(geometry??new THREE.BoxGeometry(.2,.1,.2),material);
  mesh.name=name;root.add(mesh);return mesh;
 };
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([
  // The obsolete south/front (+Z) steel frame.
  -.45,.62,.71, .45,.62,.71, 0,.65,.71,
  // A side/back steel brace MUST survive.
  -.4,.25,-.5, .4,.25,-.5, 0,.4,-.4,
  // The ring/side steel at the front but outside the cut depth survives.
  -.3,.25,.45, .3,.25,.45, 0,.4,.50
 ],3));
 const rail=feature('AtlasUpgrade_bastion_steel',geometry);
 for(const name of [
  'AtlasUpgrade_bastion_camo','AtlasUpgrade_bastion_hazard',
  'AtlasUpgrade_bastion_identity_badge',
  'AtlasUpgrade_bastion_sand','AtlasUpgrade_bastion_rubber'
 ])feature(name);
 feature('BastionMkII_base_7');
 const radar=new THREE.Group();radar.name='RadarDish';root.add(radar);
 const capture=new THREE.Group();capture.name='CaptureSweep_Rotator';root.add(capture);
 return {root,rail,originalMaterials};
}

test('front rectangular bar, camo shield and hazard stripes are removed but circular base and radar survive',()=>{
 const {root,rail,originalMaterials}=mockBastion();
 const originalGeometry=rail.geometry;
 const report=removeBastionFrontShield(root);
 assert.equal(report.removedNodes,3);
 assert.equal(report.removedTriangles,1+12*3);
 assert.equal(report.remainingTriangles,2);
 assert.notEqual(rail.geometry,originalGeometry);
 assert.equal(rail.geometry.index.count,6);
 assert.equal(root.getObjectByName('AtlasUpgrade_bastion_camo'),undefined);
 assert.equal(root.getObjectByName('AtlasUpgrade_bastion_hazard'),undefined);
 assert.equal(root.getObjectByName('AtlasUpgrade_bastion_identity_badge'),undefined);
 for(const name of ['AtlasUpgrade_bastion_sand','AtlasUpgrade_bastion_rubber',
  'BastionMkII_base_7','RadarDish','CaptureSweep_Rotator'])
  assert.ok(root.getObjectByName(name),name+' must remain');
 assert.deepEqual(removeBastionFrontShield(root),report,'idempotence required when several Bastions reuse template');
 // No GPU material is mutated or disposed by simply removing scene nodes.
 for(const mat of originalMaterials)assert.equal(mat.color.getHex(),0xffffff);
});

test('all three November 11 Bastions have exactly the removable authored front components',()=>{
 const path='src/assets/reborn/buildings-3d/';
 for(const owner of [-1,0,1]){
  const f=readFileSync(path+'bastion-'+owner+'.glb');
  assert.equal(f.toString('ascii',0,4),'glTF');
  const scene=JSON.parse(f.toString('utf8',20,20+f.readUInt32LE(12)));
  const names=new Set(scene.nodes.map(n=>n.name));
  for(const part of ['AtlasUpgrade_bastion_camo','AtlasUpgrade_bastion_hazard',
   'AtlasUpgrade_bastion_steel','AtlasUpgrade_bastion_identity_badge',
   'AtlasUpgrade_bastion_sand','RadarDish','CaptureSweep_Rotator'])
   assert.ok(names.has(part),'missing '+part+' in owner '+owner);
  assert.ok(scene.animations.some(a=>a.name==='RadarSpin'));
 }
});

test('model cleanup is integrated only into Bastions, with build shipping the code',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/removeBastionFrontShield\(data\.scene\)/);
 assert.match(source,/const detail=cloneSkeleton\(data\.scene\)/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/webgl-bastion-visual\.js/);
});

test('presenter hot path uses a lazy index for service bays, not N-times-M scans',()=>{
 const source=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(source,/serviceBasesById\?\?=new Map/);
 assert.doesNotMatch(source,/this\.game\.bases\.find\(base=>base\.id===siteId/);
 const entry=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(entry,/reusableShadowShift\.copy\(controls\.target\)/);
 assert.match(entry,/stepCamera\(dt\);\s*controls\.update\(\);/);
 assert.doesNotMatch(entry,/controls\.update\(\);\s*stepCamera\(dt\)/);
});
