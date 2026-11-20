import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {planDesertWaterways} from '../scripts/webgl-desert-water-plan.js';
import {createCinematicDesertWaterways,cinematicWaterMaterial} from '../scripts/webgl-desert-water-3d.js';

const maps=globalThis.SandforgeDesertMaps.maps;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
 ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
for(const map of maps)test(map.name+': large shallow water is seeded, local and avoids real roads',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world,terrain=world.generated,save=JSON.stringify(game.save());
 const obstacles=Buffer.from(world.blocked),args={mapId:map.id,world,terrain,seed:map.seed};
 const full=planDesertWaterways(args);
 const second=planDesertWaterways(args);
 const lite=planDesertWaterways({...args,lowQuality:true});
 assert.deepEqual(full,second);
 assert.ok(lite.lakes.length<=full.lakes.length);
 const wet=map.id==='desert-strike'||map.id==='broken-empire';
 if(wet)assert.ok(full.lakes.length>=1,map.id+' should have visible major water');
 else assert.equal(full.lakes.length,0,'dry highlands and badlands remain dry');
 assert.ok(full.lakes.length<=2&&full.rivers.length<=1);
 for(const lake of full.lakes){
  assert.ok(lake.radius>=155&&lake.radius<=255);
  assert.ok(lake.x>300&&lake.y>300);
  for(const site of terrain.sites)assert.ok(distance(lake,site)>lake.radius+570,
   'lake may not cover Bastion or HQ');
  for(const road of terrain.roads??[])for(let i=1;i<road.length;i++)
   assert.ok(segmentDistance(lake,road[i-1],road[i])>lake.radius+90);
 }
 for(const river of full.rivers){
  assert.ok(full.lakes.some(l=>l.id===river.lakeId));
  assert.ok(river.points.length>=20);
  for(const p of river.points)assert.ok(p.x>90&&p.y>90&&
   p.x<world.size-90&&p.y<world.size-90);
 }
 const scene=new THREE.Scene();
 const water=createCinematicDesertWaterways({scene,world,terrain,
  heightAt:(x,z)=>world.terrainHeight(x,z),...args,lowQuality:true});
 assert.equal(water.drawCalls,2*(water.layout.lakes.length+water.layout.rivers.length));
 assert.equal(water.meshes.length+water.shores.length,water.drawCalls);
 assert.ok(water.shores.every(m=>m.userData.wetShore&&m.material.isMeshStandardMaterial));
 assert.ok(water.meshes.every(m=>m.userData.visualOnly&&m.userData.shallowPassable));
 water.update(11.2);
 assert.ok(water.materials.filter(m=>m.userData.waterTime).every(m=>m.userData.waterTime.value===11.2));
 water.dispose();assert.equal(scene.children.includes(water.root),false);
 assert.equal(JSON.stringify(game.save()),save,'no simulation rule or save mutation');
 assert.deepEqual(Buffer.from(world.blocked),obstacles,'collision grid unchanged');
});
test('water is GPU animated PBR without expensive reflection or extra render passes',()=>{
 const m=cinematicWaterMaterial(true),normal=m.normalMap;
 assert.ok(m.isMeshPhysicalMaterial);assert.equal(m.depthWrite,false);
 assert.equal(m.transparent,true);assert.equal(m.userData.cinematicWater.shallowPassable,true);
 const shader={vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <normal_fragment_maps>\n#include <color_fragment>',
  uniforms:{}};
 m.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/sfWaterTime/);
 assert.match(shader.vertexShader,/transformed\.y/);
 assert.match(shader.fragmentShader,/sfFoam/);
 assert.match(shader.fragmentShader,/sfCurrent/);
 assert.ok(shader.uniforms.sfWaterTime===m.userData.waterTime);
 assert.equal(m.normalMap,normal);
 m.dispose();
});
