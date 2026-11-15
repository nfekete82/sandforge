import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {planDesertVillages,createDesertVillages,DESERT_VILLAGE_ART_REVISION}
 from '../scripts/webgl-desert-village.js';

for(const seed of [2988452066,3610769721])test('4-Bastion map '+seed+': at least one visible ghost village, deterministic and clear of bastions',()=>{
 const game=Simulation.campaign(seed,23),world=game.world,terrain=world.generated;
 const params={world,terrain,seed,lowQuality:false};
 const villages=planDesertVillages(params);
 assert.ok(villages.length>=1,'at least one hamlet on the actual user map seed');
 assert.deepEqual(villages,planDesertVillages(params),'same layout for identical seed and terrain');
 for(const v of villages){
  assert.ok(v.x>=250&&v.y>=250&&v.x<=world.size-250&&v.y<=world.size-250);
  assert.ok(v.houses.length>=5);
  for(const site of terrain.sites)
   assert.ok(Math.hypot(site.x-v.x,site.y-v.y)>=290,
    'visual settlement must stay away from strategic bastions and HQ spawn');
  for(const h of v.houses){
   const c={x:h.x,y:h.y},index=world.index(c);
   assert.ok(index>=0&&!world.blocked[index]);
   assert.ok(world.walkable(c));
   assert.ok(Number.isFinite(h.angle)&&h.width>24&&h.height>=19);
  }
 }
 assert.deepEqual(planDesertVillages({...params,lowQuality:true}),
  planDesertVillages({...params,lowQuality:true}));
 const scene=new THREE.Scene(),half=world.size*.5;
 const art=createDesertVillages({
  ...params,scene,
  heightAt:(x,z)=>world.terrainHeight(x,z),
  pos:(x,z,y=world.terrainHeight(x,z))=>new THREE.Vector3(x-half,y,z-half)
 });
 assert.equal(art.villages.length,villages.length);
 assert.equal(art.drawCalls,5);
 assert.equal(art.meshes.length,4);
 assert.ok(art.roads?.isMesh);
 assert.equal(art.roads.userData.groundConforming,true);
 assert.equal(art.roads.userData.revision,DESERT_VILLAGE_ART_REVISION);
 assert.equal(art.roads.raycast.toString(),'()=>{}');
 assert.ok(art.roads.geometry.getAttribute('position').count>100);
 assert.ok(art.meshes.every(m=>m.isInstancedMesh&&m.count>0));
 assert.ok(art.meshes.every(m=>m.userData.nonPlayable===true&&m.raycast.toString()==='()=>{}'));
 assert.ok(scene.children.filter(x=>x.userData?.desertVillage).length===5);
 // Sampling the same triangle-interpolated map surface must never alter
 // the authoritative 20-Hz battlefield or its bastion owners.
 assert.ok(game.territories.every(x=>x.owner===-1||x.owner===0||x.owner===1));
 for(const mesh of art.meshes){mesh.geometry.dispose();mesh.material.dispose();}
 art.roads.geometry.dispose();art.roads.material.dispose();
});

test('sand palette is pale ochre/beige, gated to desert, not the old saturated orange',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(preview,/sandGold=new THREE\.Color\('#d9bb92'\)/);
 assert.match(preview,/sandLight=new THREE\.Color\('#ebd4b1'\)/);
 assert.match(preview,/riverSediment=new THREE\.Color\('#bda78a'\)/);
 assert.doesNotMatch(preview,/#e8b47b/);
 assert.match(preview,/spacious&&biome==='desert'\?createDesertVillages/);
 assert.match(build,/cpSync\('scripts\/webgl-desert-village\.js','dist\/webgl-desert-village\.js'\)/);
 assert.ok(existsSync('dist/webgl-desert-village.js'));
 assert.doesNotMatch(readFileSync('src/reborn/simulation.ts','utf8'),/createDesertVillages/);
});
