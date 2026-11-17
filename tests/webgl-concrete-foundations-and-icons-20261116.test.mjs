import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {
 FOUNDATION_PAD_KINDS,SILO_FOUNDATION_APERTURE,foundationPadSpec,createBuildingFoundation,disposeBuildingFoundation
} from '../scripts/webgl-foundation-slabs.js';
import {servicePaint,previewServiceMaterial,disposeServicePaint}
 from '../scripts/webgl-service-materials.js';

test('low-profile detailed PBR foundations follow the actual building footprint',()=>{
 for(const [kind,width] of [
  ['headquarters',225],['barracks',158],['factory',200],
  ['generator',112],['turret',72],['research',170],
  ['silo',265],['interceptor',172]]){
  assert.ok(FOUNDATION_PAD_KINDS.includes(kind));
  const spec=foundationPadSpec(kind,width);
  assert.ok(spec.width>=width&&spec.width<width*1.2);
  assert.ok(spec.depth>width*.72&&spec.depth<width*1.0);
  const group=createBuildingFoundation(kind,width);
  const pad=group.getObjectByName('FacilityConcreteFoundationSurface');
  const lip=group.getObjectByName('FacilityConcreteFoundationLip');
  assert.ok(pad?.isMesh&&lip?.isMesh,kind+' requires a poured slab and low edge');
  assert.equal(pad.material.map?.image.width,256);
  assert.equal(pad.material.normalMap?.image.width,256);
  assert.ok(pad.material.roughness>.85);
  assert.ok(pad.userData.visualOnly&&pad.userData.nonPlayable);
  const box=new THREE.Box3().setFromObject(group);
  assert.ok(box.max.y<=1.2&&box.min.y>=-1,
   kind+' should be flush with the sand, not a raised plinth');
  assert.ok(box.max.x-box.min.x>=width);
  disposeBuildingFoundation(group);
 }
 assert.equal(createBuildingFoundation('wall',60),null,'wall segments have no tiled aprons');
 assert.equal(createBuildingFoundation('airfield',218),null,'runway already owns its concrete');
});

test('silo foundation leaves the whole rocket shaft uncovered',()=>{
 const foundation=createBuildingFoundation('silo',265);
 try{
  assert.equal(SILO_FOUNDATION_APERTURE.x,-17);
  assert.ok(SILO_FOUNDATION_APERTURE.radius>=61);
  for(const name of ['FacilityConcreteFoundationSurface','FacilityConcreteFoundationLip']){
   const mesh=foundation.getObjectByName(name);
   assert.equal(mesh.geometry.type,'ExtrudeGeometry',name+' must not be a solid slab');
   const shape=mesh.geometry.parameters.shapes;
   assert.equal(shape.holes.length,1,name+' must contain real open geometry');
   const hole=shape.holes[0];
   const points=hole.getPoints(64);
   const minX=Math.min(...points.map(p=>p.x));
   const maxX=Math.max(...points.map(p=>p.x));
   assert.ok(minX<-78&&maxX>44,'cutout must surround the offset rocket axis');
   assert.equal(mesh.userData.foundationAperture,SILO_FOUNDATION_APERTURE);
   assert.ok(Math.abs(mesh.rotation.x+Math.PI/2)<1e-6);
  }
  const regular=createBuildingFoundation('research',170);
  assert.equal(regular.getObjectByName('FacilityConcreteFoundationSurface').geometry.type,
   'BoxGeometry','all other buildings keep their original foundations');
  disposeBuildingFoundation(regular);
 }finally{disposeBuildingFoundation(foundation);}
});

test('same foundation generator is wired to live buildings and the build ghost',()=>{
 const live=readFileSync('scripts/webgl-grounding.js','utf8');
 const ghost=readFileSync('scripts/webgl-battlefield.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(live,/createBuildingFoundation\(entity.kind,diameter\)/);
 assert.match(live,/disposeBuildingFoundation\(item.userData.foundation\)/);
 assert.match(ghost,/createBuildingFoundation\(kind,spec.width\)/);
 assert.match(ghost,/previewFoundation=foundation/);
 assert.match(ghost,/disposeBuildingFoundation\(preview.userData.previewFoundation\)/);
 assert.match(build,/cpSync\('scripts\/webgl-foundation-slabs.js','dist\/webgl-foundation-slabs.js'\)/);
});

test('fine concrete and repair materials have real shared normal relief, no repeated giant swatches',()=>{
 const material=servicePaint(['#a99c82','#bcb19b','#ccc1a9'],{
  pattern:'slab',seed:73,repeat:2,roughness:.94
 });
 assert.equal(material.map.image.width,256);
 assert.equal(material.normalMap.image.height,256);
 assert.equal(material.map.anisotropy,8);
 assert.equal(material.normalMap.anisotropy,8);
 assert.equal(material.map.minFilter,THREE.LinearMipmapLinearFilter);
 assert.equal(material.normalMap.minFilter,THREE.LinearMipmapLinearFilter);
 const sourceUserData=material.userData;
 const ghost=previewServiceMaterial(material,{opacity:.48});
 assert.strictEqual(material.userData,sourceUserData,'preview cannot remove source GPU ownership');
 assert.equal(ghost.userData.sandforgeServiceTexture,undefined);
 assert.equal(ghost.userData.sandforgeServiceNormalMap,undefined);
 assert.strictEqual(ghost.map,material.map);
 assert.strictEqual(ghost.normalMap,material.normalMap);
 ghost.dispose();
 const g=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
 g.add(mesh);
 assert.equal(disposeServicePaint(g),2);
 material.dispose();mesh.geometry.dispose();
});

test('building PBR microrelief uses shared 256px stochastic textures without visible scanlines',()=>{
 const material=readFileSync('scripts/webgl-building-pbr.js','utf8');
 assert.match(material,/const n=256,pixels=new Uint8Array/);
 assert.match(material,/const hash=\(x,y\)=>/);
 assert.match(material,/tex.generateMipmaps=true;tex.anisotropy=8/);
 assert.match(material,/albedo.anisotropy=8/);
 assert.doesNotMatch(material,/const wave=Math.sin\(a\*Math.PI\*2\/16\)/);
});

test('subtle left-side SVG icons preserve every HUD action and four production tabs',()=>{
 const hud=readFileSync('scripts/webgl-classic-hud.js','utf8');
 const css=readFileSync('src/reborn/webgl-classic-hud.css','utf8');
 assert.match(hud,/panel.querySelectorAll\('#sf-tabs button\[data-tab\]'\)/);
 assert.match(hud,/panel.querySelectorAll\('#sf-command-buttons button\[data-action\]'\)/);
 assert.match(hud,/svg.classList.add\('sf-hud-label-icon'\)/);
 assert.match(hud,/svg.setAttribute\('aria-hidden','true'\)/);
 assert.match(hud,/button.prepend\(svg\)/);
 assert.match(css,/#sf-classic-root \.sf-hud-label-icon\{/);
 assert.match(css,/#sf-classic-root #sf-tabs button\[hidden\]/);
 assert.match(css,/#sf-classic-root #sf-command-buttons button\[hidden\]/);
 assert.equal((hud.match(/<button data-tab=/g)||[]).length,4);
 assert.doesNotMatch(hud,/data-tab="research"/);
});
