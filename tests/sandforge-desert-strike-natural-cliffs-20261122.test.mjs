import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mesaRampCoverage,mesaRampDirections} from '../dist/src/reborn/raised-mesas.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';
import {sharedStoneMaps,desertStrikeNaturalCliffMaps}
 from '../scripts/webgl-rock-materials.js';
import {readFileSync} from 'node:fs';

const preset=globalThis.SandforgeDesertMaps.byId('desert-strike');
const game=()=>Simulation.campaign(
 preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion);

test('Desert Strike cliff polish leaves actual elevation, four tank ramps and saves unchanged',()=>{
 const simulation=game(),world=simulation.world;
 assert.equal(world.generatorVersion,10);
 assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
 const central=world.generated.plateaus.find(m=>m.siteIndex===-1);
 assert.ok(central?.ramps);
 assert.equal(mesaRampDirections(central).length,4);
 assert.ok(world.buildable(central.center,100));
 const before={
  blocked:world.blocked.slice(),
  opaque:world.opaque.slice(),
  heights:world.generated.battlefield.heights.slice(),
  rampCenters:central.ramps.map(d=>({
   x:central.center.x+d.x*(central.topRadius+420),
   y:central.center.y+d.y*(central.topRadius+420)
  }))
 };
 const scene=new THREE.Scene();
 const meshes=createPlayableMesaCliffs({
  scene,size:world.size,heightAt:(x,z)=>world.terrainHeight(x,z),
  plateaus:world.generated.plateaus,lowQuality:true,mapId:'desert-strike'
 });
 assert.equal(meshes.length,1);
 assert.ok(scene.children.includes(meshes[0]));
 assert.deepEqual(world.blocked,before.blocked);
 assert.deepEqual(world.opaque,before.opaque);
 assert.deepEqual(world.generated.battlefield.heights,before.heights);
 for(const p of before.rampCenters){
  assert.ok(mesaRampCoverage({x:p.x,y:p.y},central)>.72);
  assert.ok(world.walkable(p,[],20),'one of four ramps is blocked');
  assert.ok(world.groundVehicleSlopeSafe(p,.215,20),
   'one of four vehicle-access ramps is too steep');
 }
 assert.equal(Simulation.load(simulation.save()).world.generatorVersion,10);
 for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}
});

test('Fractured desert cliff atlas tiles with natural hue and real baked PBR normals',()=>{
 const maps=desertStrikeNaturalCliffMaps(true);
 assert.equal(maps.variant,'desert-strike-fractured-sandstone');
 assert.ok(maps.map.isTexture&&maps.normalMap.isTexture&&maps.roughnessMap.isTexture);
 assert.equal(maps.map.wrapS,THREE.RepeatWrapping);
 assert.equal(maps.map.wrapT,THREE.RepeatWrapping);
 assert.equal(maps.normalMap.wrapS,THREE.RepeatWrapping);
 assert.equal(maps.roughnessMap.wrapT,THREE.RepeatWrapping);
 assert.equal(maps.map.colorSpace,THREE.SRGBColorSpace);
 assert.equal(maps.resolution,128);
 assert.equal(desertStrikeNaturalCliffMaps(true),maps,
  'generating one atlas per cliff would waste GPU memory');
 assert.notEqual(maps.map,sharedStoneMaps(true).map,
  'Desert Strike should not reuse the old uniform stripe texture');
 let unique=new Set();
 for(let i=0;i<maps.map.image.data.length;i+=43*4){
  unique.add(maps.map.image.data[i]);
 }
 assert.ok(unique.size>15,'stone albedo needs actual irregular fine detail');
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(src,/mapId:desertRegion\?\.id\?\?null/,'game must actually select new renderer');
});

test('cliff facades are nonfloating, clipped cleanly around all four ramp cuts',()=>{
 const w=game().world,scene=new THREE.Scene(),half=w.size*.5;
 const heightAt=(x,z)=>w.terrainHeight(x,z);
 const [cliff]=createPlayableMesaCliffs({
  scene,size:w.size,heightAt,plateaus:w.generated.plateaus,
  lowQuality:true,mapId:'desert-strike'
 });
 assert.ok(cliff,'natural cliffs missing');
 assert.equal(cliff.userData.rampCutMethod,'triangle-clipped-physical-slope');
 assert.equal(cliff.userData.cliffAtlas,'desert-strike-fractured-sandstone');
 assert.equal(cliff.userData.cliffUvMapping,'desert-strike-sandstone-arc-and-slope-v1');
 const pos=cliff.geometry.getAttribute('position');
 const uv=cliff.geometry.getAttribute('uv');
 const color=cliff.geometry.getAttribute('color');
 assert.ok(pos.count>3500,'cliff must have actual fracture-detail triangles');
 assert.equal(pos.count,uv.count);
 assert.equal(pos.count,color.count);
 assert.equal(pos.count%3,0);
 const central=w.generated.plateaus.find(p=>p.siteIndex===-1);
 const xyRange=[Infinity,Infinity,-Infinity,-Infinity];
 let largestFloating=0,deepInRamp=0,minU=Infinity,maxU=-Infinity;
 for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/1500))){
  const x=pos.getX(i)+half,z=pos.getZ(i)+half,y=pos.getY(i);
  const error=Math.abs(y-heightAt(x,z)-.29);
  largestFloating=Math.max(largestFloating,error);
  assert.ok(error<.045,'a piece of cliff is floating above its physical surface');
  assert.ok(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));
  minU=Math.min(minU,uv.getX(i));maxU=Math.max(maxU,uv.getX(i));
  xyRange[0]=Math.min(xyRange[0],x);xyRange[1]=Math.min(xyRange[1],z);
  xyRange[2]=Math.max(xyRange[2],x);xyRange[3]=Math.max(xyRange[3],z);
  // The original screenshot showed thin rock ribbons deep within the
  // four wide ramp corridors; no sampled cliff vertex should lie there.
  const dx=x-central.center.x,dz=z-central.center.y;
  const r=Math.hypot(dx,dz);
  if(r>=central.topRadius*.88&&r<=central.footRadius*1.12){
   if(mesaRampCoverage({x,y:z},central)>.78)deepInRamp++;
  }
 }
 assert.equal(deepInRamp,0,'loose rock strips still overlap the open ramp interiors');
 assert.ok(maxU-minU>14,'UVs should repeat along the true rock face');
 assert.ok(xyRange.every(Number.isFinite));
 assert.ok(largestFloating<.045);
 const vertexColors=[];
 for(let i=0;i<color.count;i+=Math.max(1,Math.floor(color.count/250))){
  vertexColors.push(color.getR(i));
 }
 assert.ok(Math.max(...vertexColors)-Math.min(...vertexColors)>.09,
  'the rock face needs pale rim, warm middle and weathered foot');
 cliff.removeFromParent();cliff.geometry.dispose();cliff.material.dispose();
});

test('old maps and historical cliff material remain unchanged',()=>{
 const w=game().world,scene=new THREE.Scene();
 const [old]=createPlayableMesaCliffs({
  scene,size:w.size,heightAt:(x,z)=>w.terrainHeight(x,z),
  plateaus:w.generated.plateaus,lowQuality:true
 });
 assert.ok(old);
 assert.equal(old.name,'Sandforge-Physical-Playable-Mesa-Cliffs');
 assert.equal(old.userData.cliffUvMapping,'unwrapped-arc-length-geodesic-v2');
 assert.equal(old.material.map,sharedStoneMaps(true).map);
 old.removeFromParent();old.geometry.dispose();old.material.dispose();
});
