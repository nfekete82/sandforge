import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {angleDelta,easeAngle,cannonKick,vehiclePose} from '../scripts/webgl-vehicle-polish.js';
import {particleFade,installParticleFade} from '../scripts/webgl-particle-finish.js';
import {finishDesertBuildingMaterials} from '../scripts/webgl-building-pbr.js';

const unit=()=>({kind:'tank',x:10,y:10,previousX:7,previousY:10,angle:0,hullAngle:0,walkDistance:10});
test('visual heading takes the short arc across +/-PI and is frame-rate independent',()=>{
 const from=Math.PI-.02,to=-Math.PI+.02;
 assert.ok(Math.abs(angleDelta(from,to)-.04)<1e-10);
 const once=easeAngle(from,to,.05);
 let many=from;for(let i=0;i<5;i++)many=easeAngle(many,to,.01);
 assert.ok(Math.abs(once-many)<1e-10);
 assert.ok(once>from&&once<from+.04);
 assert.equal(easeAngle(from,to,0),from);
});
test('terrain support follows both axes, caches parked actors and never writes simulation',()=>{
 const e={modelFootprint:80},u=unit(),original=JSON.stringify(u);let calls=0;
 const options={x:10,z:10,ground:2,time:1,dt:.05,active:true,heightAt:(x,z)=>{calls++;return x*.12+z*.06;}};
 const p=vehiclePose(e,u,options);
 assert.equal(calls,4);assert.ok(p.pitch<0);assert.ok(p.roll<0);
 for(let i=1;i<20;i++)vehiclePose(e,u,{...options,time:1+i*.05});
 assert.equal(calls,4,'parked visual support never re-samples');
 const saved={...p};vehiclePose(e,u,{...options,active:false,time:3});
 assert.deepEqual(p,saved,'pause freezes mechanical pose');
 assert.equal(JSON.stringify(u),original);
 vehiclePose(e,u,{...options,x:20,time:3});assert.equal(calls,8);
 vehiclePose(e,u,{...options,x:30,time:3.02});assert.equal(calls,8,'terrain limited to 10 Hz');
});
test('lite mode never adds terrain queries; invalid displacement resets without NaNs',()=>{
 const e={},u=unit();const o={x:10,z:10,time:1,dt:.05,active:true,lite:true,heightAt:()=>{throw Error('extra lite query');}};
 vehiclePose(e,u,o);u.x=1000;
 const p=vehiclePose(e,u,o);
 for(const key of ['yaw','aim','speed','pitch','roll'])assert.ok(Number.isFinite(p[key]),key);
 assert.equal(p.speed,0);assert.equal(p.heave,0);
});
test('cannon recoil has a fast small kick and a slow exact return',()=>{
 assert.equal(cannonKick(.20),0);assert.ok(Math.abs(cannonKick(.175)-.10)<1e-9);
 assert.ok(cannonKick(.10)<cannonKick(.175));assert.equal(cannonKick(0),0);
 assert.equal(cannonKick(-1),0);assert.equal(cannonKick(NaN),0);
});
test('smoke smoothly dissipates within its original footprint, flash has immediate onset',()=>{
 assert.equal(particleFade(1,1,true),0);
 assert.ok(particleFade(.8,1,true)>.9);
 assert.ok(particleFade(.1,1,true)<particleFade(.3,1,true));
 assert.equal(particleFade(0,1,true),0);assert.equal(particleFade(1,1,false),1);
 assert.equal(particleFade(1,0,true),0);
});
test('particle opacity is one bounded instanced attribute applied before alpha test',()=>{
 const g=new THREE.PlaneGeometry(),m=new THREE.MeshBasicMaterial();
 const attr=installParticleFade(g,m,28);
 assert.equal(attr.count,28);assert.equal(attr.isInstancedBufferAttribute,true);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <alphamap_fragment>\n#include <alphatest_fragment>'};
 m.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/sfFade=sfParticleFade/);
 assert.ok(shader.fragmentShader.indexOf('diffuseColor.a*=sfFade')<shader.fragmentShader.indexOf('#include <alphatest_fragment>'));
 g.dispose();m.dispose();
});
for(const kind of ['headquarters','barracks','factory','airfield'])
 for(const ghost of [false,true])test(`${kind}: full UV PBR and shader survive ${ghost?'moving ghost':'normal gameplay'} finish`,()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
 const map=()=>new THREE.DataTexture(new Uint8Array(16),2,2);
 const m=new THREE.MeshStandardMaterial({map:map(),normalMap:map(),roughnessMap:map(),aoMap:map(),roughness:.48,metalness:.62});
 m.userData.sandforgePreviewMaterial=ghost;
 const compile=()=>{};m.onBeforeCompile=compile;
 const mesh=new THREE.Mesh(geometry,m);mesh.name=kind==='factory'?'SF_Factory_PBR_camo':kind==='airfield'?'SF_Airfield_PBR_camo':'Atlas_CeramicHull';root.add(mesh);
 const textures=[m.map,m.normalMap,m.roughnessMap,m.aoMap];
 assert.equal(finishDesertBuildingMaterials(root,kind),0);
 root.position.set(100,0,200);root.rotation.y=1;
 assert.equal(finishDesertBuildingMaterials(root,kind),0);
 assert.equal(mesh.material,m);assert.equal(m.onBeforeCompile,compile);
 assert.deepEqual([m.map,m.normalMap,m.roughnessMap,m.aoMap],textures);
 assert.equal(m.roughness,.48);assert.equal(m.metalness,.62);
 assert.ok(geometry.attributes.uv&&geometry.attributes.normal);
 geometry.dispose();m.dispose();textures.forEach(t=>t.dispose());
});
test('new visual modules ship and source GLB generation still targets dist only',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 for(const name of ['webgl-vehicle-polish','webgl-particle-finish'])assert.ok(build.includes(`cpSync('scripts/${name}.js','dist/${name}.js')`));
 assert.match(build,/generate-factory-pbr\.mjs',shippedBuildingDir/);
 assert.match(build,/ensure-final-pbr-buildings\.mjs',shippedBuildingDir/);
});

test('light-only facade depth preserves custom PBR shader hooks and material sharing',async()=>{
 const {finishBuildingFacadeShading}=await import('../scripts/webgl-building-shading.js');
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({map:new THREE.Texture(),normalMap:new THREE.Texture(),roughnessMap:new THREE.Texture()});
 material.onBeforeCompile=shader=>{shader.fragmentShader+='\n// authored detail';};
 material.customProgramCacheKey=()=>'authored-detail-key';
 const a=new THREE.Mesh(new THREE.BoxGeometry(),material),b=a.clone();root.add(a,b);
 assert.equal(finishBuildingFacadeShading(root),1);
 assert.equal(a.material,b.material);assert.notEqual(a.material,material);
 assert.equal(a.material.map,material.map);assert.equal(a.material.normalMap,material.normalMap);
 const shader={vertexShader:'#include <common>\n#include <beginnormal_vertex>',fragmentShader:'#include <common>\n#include <aomap_fragment>'};
 a.material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/authored detail/);assert.match(shader.fragmentShader,/sfWall/);
 assert.ok(a.material.customProgramCacheKey().startsWith('authored-detail-key|'));
});

test('legacy fallback surfaces have real mipmapped UV albedo, normal and roughness maps',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());
 mesh.name='Atlas_CeramicHull';root.add(mesh);
 assert.equal(finishDesertBuildingMaterials(root,'barracks'),1);
 for(const map of [mesh.material.map,mesh.material.normalMap,mesh.material.roughnessMap]){
  assert.ok(map?.isDataTexture,'all visible fallback surfaces need real maps');
  // In Node the albedo uses the existing DOM-free fixture; browsers load SVG.
  assert.ok(map.image.width>0&&map.image.height>0);
 }
 assert.equal(mesh.material.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(mesh.material.normalMap.generateMipmaps,true);
 assert.equal(mesh.material.roughnessMap.generateMipmaps,true);
 assert.ok(geometry.attributes.uv&&geometry.attributes.normal);
 geometry.dispose();mesh.material.dispose();
});


test('vehicle support spreads convoy resampling and skips level service platforms',()=>{
 let calls=0;const heightAt=(x,z)=>{calls++;return x*.02+z*.03;};
 const even={},odd={},a={...unit(),id:2},b={...unit(),id:3};
 const sample=(entry,u,time,x=10)=>vehiclePose(entry,u,{x,z:10,time,dt:.05,active:true,heightAt});
 sample(even,a,0);sample(odd,b,0);assert.equal(calls,8);
 sample(even,a,.10,20);sample(odd,b,.10,20);assert.equal(calls,12);
 sample(even,a,.15,30);sample(odd,b,.15,30);assert.equal(calls,16);
 const docked={...unit(),id:4,factoryService:{baseId:10}};
 sample({},docked,0);assert.equal(calls,16,'service platform needs no terrain support queries');
 sample({productionMotion:{moving:true}},unit(),0);assert.equal(calls,16,'rollout stays level');
});
