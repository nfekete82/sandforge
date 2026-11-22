import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';
import {mesaRampCoverage} from '../dist/src/reborn/raised-mesas.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';

const catalog=globalThis.SandforgeDesertMaps.maps;
const current=catalog.filter(p=>p.id!=='mesa-highlands');
const legacyVersions=new Map([
 ['desert-strike',5],['broken-empire',5],['burning-horizon',4],
 ['last-stronghold',5],['plateau-crossroads',6]
]);
function play(p,generator=p.generatorVersion){
 return Simulation.campaign(p.seed,p.mapVersion,p.terrain,generator);
}
test('Five existing worlds explicitly use v10; historical v4-v6 saves remain unchanged',()=>{
 assert.equal(current.length,5);
 for(const p of current){
  assert.equal(p.generatorVersion,10,p.id+' should select new geography');
  const old=play(p,legacyVersions.get(p.id));
  const restored=Simulation.load(old.save());
  assert.equal(restored.world.generatorVersion,legacyVersions.get(p.id));
  assert.deepEqual(restored.world.generated.battlefield.heights,
   old.world.generated.battlefield.heights,'legacy world heights changed');
  assert.deepEqual(restored.world.blocked,old.world.blocked,
   'legacy collision map changed');
 }
 assert.equal(catalog.find(p=>p.id==='mesa-highlands').generatorVersion,7);
});

for(const p of current)test(p.name+': real buildable connected highlands and genuine lowland relief',()=>{
 const game=play(p),w=game.world,g=w.generated;
 assert.equal(w.generatorVersion,10);
 assert.equal(w.validation?.valid,true,JSON.stringify(w.validation));
 assert.equal(w.validation.reachableSites,p.bastions);
 assert.equal(w.validation.tankReachableSites,p.bastions);
 assert.equal(g.landscapeKind,p.kind,'old biome identity lost');
 assert.ok(g.plateaus?.length>=1,'not a single elevated plateau');
 assert.ok(g.plateaus?.length<=3,'too much mountain density');
 const mapped=g.plateaus.map(m=>m.siteIndex);
 assert.equal(new Set(mapped).size,mapped.length,'duplicate plateau');
 for(const m of g.plateaus){
  const high=w.terrainHeight(m.center.x,m.center.y);
  const exit={x:m.center.x+m.direction.x*m.rampEnd,
   y:m.center.y+m.direction.y*m.rampEnd};
  const low=w.terrainHeight(exit.x,exit.y);
  assert.ok(high-low>45,'not genuinely raised above access valley');
  assert.ok(w.walkable(m.center,[],32),'inaccessible summit');
  assert.ok(w.buildable(m.center,100),'cannot build on summit');
  for(const fraction of [.60,.78,.93]){
   const q={x:m.center.x+m.direction.x*m.rampEnd*fraction,
    y:m.center.y+m.direction.y*m.rampEnd*fraction};
   assert.ok(mesaRampCoverage(q,m)>.7,'authored road misses real ramp');
   assert.ok(w.walkable(q,[],25),'ramp contains collision wall');
  }
 }
 const restored=Simulation.load(game.save());
 assert.equal(restored.world.generatorVersion,10);
 assert.deepEqual(restored.world.generated.plateaus,g.plateaus);
 const next=play(p);
 assert.deepEqual(next.world.generated.battlefield.heights,g.battlefield.heights,
  'fixed authored map heights must be deterministic');
 const scene=new THREE.Scene();
 const cliffs=createPlayableMesaCliffs({
  scene,size:w.size,heightAt:(x,z)=>w.terrainHeight(x,z),
  plateaus:g.plateaus,lowQuality:true
 });
 assert.equal(cliffs.length,1);
 assert.ok(cliffs[0].geometry.attributes.position.count>500);
 assert.ok(cliffs[0].material.map?.isTexture&&cliffs[0].material.normalMap?.isTexture);
 cliffs[0].removeFromParent();
 cliffs[0].geometry.dispose();cliffs[0].material.dispose();
 const scenery=planDesertEcoregion({world:w,terrain:g,mapId:p.id,seed:p.seed});
 for(const object of scenery)for(const m of g.plateaus){
  const x=object.x,y=object.y;
  assert.ok(Math.hypot(x-m.center.x,y-m.center.y)>m.footRadius+100,
   '3D rock or plant placed within highland cliff facade');
 }
});
