import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mesaRampCoverage,mesaRampDirections,raisedMesaCliffBlocked}
 from '../dist/src/reborn/raised-mesas.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
import {CANYON_GEOLOGY} from '../scripts/webgl-authentic-canyon-geology.js';

const catalog=globalThis.SandforgeDesertMaps.maps;
const maps=catalog.filter(p=>p.id!=='mesa-highlands');
const campaign=(m,v=m.generatorVersion)=>Simulation.campaign(
 m.seed,m.mapVersion,m.terrain,v);
const map=catalog.find(m=>m.id==='desert-strike');

test('new desert maps use v10 while all v9 saves regenerate identical geology',()=>{
 assert.equal(maps.length,5);
 for(const m of maps){
  assert.equal(m.generatorVersion,10);
  const old=campaign(m,9);
  const restored=Simulation.load(old.save());
  assert.equal(restored.world.generatorVersion,9);
  assert.deepEqual(restored.world.blocked,old.world.blocked);
  assert.deepEqual(restored.world.generated.battlefield.heights,
   old.world.generated.battlefield.heights);
 }
 assert.equal(catalog.find(m=>m.id==='mesa-highlands').generatorVersion,7);
});

test('Desert Strike contains a genuinely CENTRAL broad buildable plateau with four open ways',()=>{
 const w=campaign(map).world;
 assert.equal(w.validation?.valid,true,JSON.stringify(w.validation));
 const central=w.generated.plateaus?.find(m=>m.siteIndex===-1);
 assert.ok(central,'central plateau absent from physical map');
 assert.ok(Math.abs(central.center.x-w.size*.5)<w.size*.045);
 assert.ok(Math.abs(central.center.y-w.size*.5)<w.size*.045);
 assert.ok(central.topRadius>=700,'central buildable summit too small');
 assert.ok(central.footRadius>central.topRadius+160);
 assert.equal(central.ramps?.length,4);
 assert.deepEqual(central.ramps,[
  {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}
 ]);
 assert.equal(mesaRampDirections(central).length,4);
 assert.ok(w.buildable(central.center,100),'cannot build on the central highland');
 assert.ok(w.walkable(central.center,[],32));
 const summit=w.terrainHeight(central.center.x,central.center.y);
 for(const d of central.ramps){
  const at=(radius)=>({x:central.center.x+d.x*radius,
   y:central.center.y+d.y*radius});
  const foot=at(central.rampEnd);
  assert.ok(summit-w.terrainHeight(foot.x,foot.y)>65,
   'the central plateau must physically rise above the valley');
  for(const t of [central.topRadius*.92,central.topRadius+100,
   central.topRadius+370,central.rampEnd*.83,central.rampEnd*.93]){
   const p=at(t);
   assert.ok(mesaRampCoverage(p,central)>.72,
    'physical ramp missing one cardinal side');
   assert.equal(raisedMesaCliffBlocked(p,central,w.terrainSlope(p.x,p.y)),false,
    'cliff collision blocks the motorable entrance');
   assert.ok(w.walkable(p,[],18),'ramp position collides');
  }
  assert.ok(w.generated.roads.some(road=>road.some(p=>
   Math.hypot(p.x-foot.x,p.y-foot.y)<6)),
   'real 3D road does not reach this ramp');
 }
});

test('older highlands gain optional 2-way approaches only where safe',()=>{
 let twoWay=0;
 for(const m of maps){
  const w=campaign(m).world;
  assert.equal(w.validation?.valid,true,JSON.stringify(w.validation));
  assert.equal(w.validation.reachableSites,m.bastions);
  assert.equal(w.validation.tankReachableSites,m.bastions);
  for(const mesa of w.generated.plateaus??[]){
   const dirs=mesaRampDirections(mesa);
   assert.ok([1,2,4].includes(dirs.length));
   if(dirs.length===2)twoWay++;
   if(mesa.siteIndex>=0){
    assert.ok(w.buildable(mesa.center,100),'bastion shelf lost construction clearance');
   }
   for(const d of dirs)for(const t of [.65,.86,.96]){
    const p={x:mesa.center.x+d.x*mesa.rampEnd*t,
     y:mesa.center.y+d.y*mesa.rampEnd*t};
    assert.ok(w.walkable(p,[],20),'extra physical ramp blocked');
   }
  }
 }
 assert.ok(twoWay>=1,'at least one original mesa must have two independent approaches');
});

test('gray ridge walls now share warm sandstone palette, PBR atlas and world-scale UVs',()=>{
 const palette=CANYON_GEOLOGY['last-stronghold'];
 assert.equal(palette.base.toLowerCase(),'#a38160');
 assert.equal(palette.dark.toLowerCase(),'#594635');
 const stronghold=catalog.find(m=>m.id==='last-stronghold');
 const world=campaign(stronghold).world,scene=new THREE.Scene();
 const meshes=createLandscapeMeshes({
  scene,size:world.size,heightAt:(x,z)=>world.terrainHeight(x,z),
  roads:[],ridges:world.generated.ridges,plateaus:world.generated.plateaus,
  mapId:stronghold.id,biome:'desert',showOutcrops:false,lowQuality:true
 });
 const ridge=meshes.find(m=>m.userData?.erodedRidge);
 assert.ok(ridge,'original dark cliff has no replacement');
 assert.equal(ridge.userData.cliffUvMapping,'shared-sandstone-arc-length-v10');
 assert.ok(ridge.material.map?.isTexture);
 assert.ok(ridge.material.normalMap?.isTexture);
 assert.ok(ridge.material.roughnessMap?.isTexture);
 assert.equal(ridge.material.map.wrapS,THREE.RepeatWrapping);
 const u=ridge.geometry.getAttribute('uv');
 assert.ok(u.count>1000);
 let minU=Infinity,maxU=-Infinity,maxV=-Infinity;
 for(let i=0;i<u.count;i+=Math.max(1,Math.floor(u.count/400))){
  minU=Math.min(minU,u.getX(i));
  maxU=Math.max(maxU,u.getX(i));
  maxV=Math.max(maxV,u.getY(i));
 }
 assert.ok(maxU-minU>10,'wall texture must repeat over actual cliff length');
 assert.ok(maxV>1,'vertical face must have repeat-scaled PBR texture');
 const raised=createPlayableMesaCliffs({
  scene,size:world.size,heightAt:(x,z)=>world.terrainHeight(x,z),
  plateaus:world.generated.plateaus,lowQuality:true
 })[0];
 assert.ok(raised.material.map===ridge.material.map,
  'old grey rock and new sandstone cliff should use the same albedo atlas');
 for(const mesh of [...meshes,raised]){
  mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
 }
});
