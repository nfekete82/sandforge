import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';

const maps=globalThis.SandforgeDesertMaps.maps.filter(p=>p.id!=='mesa-highlands');
const campaign=(map,version)=>Simulation.campaign(map.seed,map.mapVersion,map.terrain,version);

test('five current desert maps use v9, while previously saved v8 terrain and route masks are stable',()=>{
 assert.equal(maps.length,5);
 for(const map of maps){
  assert.equal(map.generatorVersion,9);
  const old=campaign(map,8);
  assert.equal(old.world.generatorVersion,8);
  const restored=Simulation.load(old.save());
  assert.equal(restored.world.generatorVersion,8);
  assert.deepEqual(restored.world.generated.battlefield.heights,old.world.generated.battlefield.heights);
  assert.deepEqual(restored.world.blocked,old.world.blocked);
 }
});

for(const map of maps)test(map.name+': safe expanded highlands, stable navigation and real PBR walls',()=>{
 const previous=campaign(map,8).world,world=campaign(map,9).world;
 assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
 assert.equal(world.validation.reachableSites,map.bastions);
 assert.equal(world.validation.tankReachableSites,map.bastions);
 const old=previous.generated.plateaus??[],now=world.generated.plateaus??[];
 assert.ok(now.length>=1,'map must retain an elevated building area');
 assert.equal(now.length,old.length,'expansion must not remove an authored highland');
 let growth=0;
 for(let i=0;i<now.length;i++){
  const former=old.find(m=>m.siteIndex===now[i].siteIndex);
  assert.ok(former,'do not move a working historical highland');
  assert.ok(now[i].topRadius>=former.topRadius,'new top must never shrink');
  assert.ok(now[i].footRadius>=former.footRadius);
  assert.ok(now[i].rampWidth>=former.rampWidth);
  growth+=now[i].topRadius-former.topRadius;
  assert.ok(world.buildable(now[i].center,100),'expanded summit should still allow construction');
  assert.ok(world.walkable(now[i].center,[],32));
  for(const t of [.6,.78,.93]){
   const point={x:now[i].center.x+now[i].direction.x*now[i].rampEnd*t,
    y:now[i].center.y+now[i].direction.y*now[i].rampEnd*t};
   assert.ok(world.walkable(point,[],24),'ramp must stay unblocked');
  }
 }
 const scene=new THREE.Scene(),size=world.size;
 const mesh=createPlayableMesaCliffs({
  scene,size,heightAt:(x,z)=>world.terrainHeight(x,z),
  plateaus:now,lowQuality:true
 })[0];
 assert.equal(mesh.userData.cliffUvMapping,'unwrapped-arc-length-geodesic-v2');
 assert.equal(mesh.userData.cliffTextureWorldTile,150);
 const position=mesh.geometry.getAttribute('position');
 const uv=mesh.geometry.getAttribute('uv');
 assert.ok(position.count>3000,'cliff should be highly tessellated');
 assert.ok(uv.count===position.count);
 assert.equal(mesh.material.map.wrapS,THREE.RepeatWrapping);
 assert.equal(mesh.material.map.wrapT,THREE.RepeatWrapping);
 assert.equal(mesh.material.normalMap.wrapS,THREE.RepeatWrapping);
 assert.equal(mesh.material.normalMap.wrapT,THREE.RepeatWrapping);
 assert.equal(mesh.material.roughnessMap.wrapS,THREE.RepeatWrapping);
 let maxU=0,maxV=0;
 for(let i=0;i<uv.count;i+=Math.max(1,Math.floor(uv.count/700))){
  assert.ok(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i)));
  maxU=Math.max(maxU,uv.getX(i));
  maxV=Math.max(maxV,uv.getY(i));
  const x=position.getX(i)+size*.5,z=position.getZ(i)+size*.5;
  const y=position.getY(i);
  assert.ok(Math.abs(y-world.terrainHeight(x,z)-.29)<.025,
   'cliff PBR surface must sit precisely on physical ground');
 }
 assert.ok(maxU>15,'texture must tile along cliff circumference instead of stretching');
 assert.ok(maxV>.9,'texture must tile down the physically measured cliff slope');
 mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
 assert.equal(Simulation.load(campaign(map,9).save()).world.generatorVersion,9);
 console.log('Expanded',map.id,'plateaus:',now.length,'sum of increased summit radii:',growth);
});

test('some of the actual five landscapes are measurably larger than their prior v8 topography',()=>{
 let enlarged=0,total=0;
 for(const map of maps){
  const old=campaign(map,8).world.generated.plateaus??[];
  const next=campaign(map,9).world.generated.plateaus??[];
  for(const p of next){
   const previous=old.find(m=>m.siteIndex===p.siteIndex);
   const delta=p.topRadius-previous.topRadius;
   if(delta>0)enlarged++;
   total+=delta;
  }
 }
 assert.ok(enlarged>=2,'at least two real buildable summit footprints must grow');
 assert.ok(total>=180,'v9 should noticeably increase, not merely rename, highlands');
});
