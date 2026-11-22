import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mesaLocation,mesaRampCoverage,raisedMesaCliffBlocked} from '../dist/src/reborn/raised-mesas.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';

const preset=globalThis.SandforgeDesertMaps.byId('mesa-highlands');
const world=()=>Simulation.campaign(
 preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion).world;

test('Mesa Highlands uses genuine elevated buildable sectors with flat tops, cliffs and usable ramps',()=>{
 assert.equal(preset.generatorVersion,7);
 const w=world();
 assert.equal(w.validation?.valid,true,JSON.stringify(w.validation));
 assert.equal(w.generated.landscapeKind,'mesa-highlands');
 assert.equal(w.generated.plateaus?.length,2);
 assert.equal(w.generated.ridges.length,0);
 for(const [i,mesa] of w.generated.plateaus.entries()){
  assert.ok(w.walkable(mesa.center,[],32),'summit blocked');
  assert.ok(w.buildable(mesa.center,100),'cannot construct on elevated summit');
  const top=w.terrainHeight(mesa.center.x,mesa.center.y);
  assert.ok(top>155,'highland must visibly rise above valley');
  const downhill={x:mesa.center.x+mesa.direction.x*mesa.rampEnd,
   y:mesa.center.y+mesa.direction.y*mesa.rampEnd};
  const low=w.terrainHeight(downhill.x,downhill.y);
  assert.ok(top-low>55,'summit is not meaningfully elevated');
  const section=[.55,.73,.87].map(t=>({
   x:mesa.center.x+mesa.direction.x*mesa.rampEnd*t,
   y:mesa.center.y+mesa.direction.y*mesa.rampEnd*t
  }));
  for(const p of section){
   assert.equal(mesaRampCoverage(p,mesa),1,'route is outside the actual carved ramp');
   assert.ok(w.walkable(p,[],22),'a point on the physical ramp is blocked');
  }
  const radius=mesa.topRadius+85,side={x:mesa.center.x+radius,
   y:mesa.center.y};
  assert.ok(raisedMesaCliffBlocked(side,mesa,1)||mesaRampCoverage(side,mesa)>.72);
  assert.ok(w.generated.roads.some(road=>road.some(p=>
    Math.hypot(p.x-mesa.center.x,p.y-mesa.center.y)<60)),
    'map lacks road through its raised bastion');
 }
 const loaded=Simulation.load(Simulation.campaign(
  preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion).save());
 assert.equal(loaded.world.generatorVersion,7,'new save must preserve physical plateau version');
});

test('Each actual cliff has world-height matched stratified PBR geometry, without floating cap',()=>{
 const w=world(),scene=new THREE.Scene(),half=w.size*.5;
 const heightAt=(x,z)=>w.terrainHeight(x,z);
 const meshes=createPlayableMesaCliffs({
  scene,size:w.size,heightAt,plateaus:w.generated.plateaus,lowQuality:true
 });
 assert.equal(meshes.length,1);
 const cliff=meshes[0];
 assert.ok(cliff.geometry.attributes.position.count>1000);
 assert.ok(cliff.material.map?.isTexture&&cliff.material.normalMap?.isTexture);
 assert.equal(cliff.userData.realTerrainFacade,true);
 const positions=cliff.geometry.getAttribute('position');
 for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/350))){
  const x=positions.getX(i)+half,z=positions.getZ(i)+half,y=positions.getY(i);
  assert.ok(Math.abs(y-heightAt(x,z)-.29)<.02,
   'cliff facade must follow terrain, not hang in the air');
 }
 const decorations=planDesertEcoregion({
  world:w,terrain:w.generated,mapId:preset.id,seed:preset.seed
 });
 for(const item of decorations)for(const mesa of w.generated.plateaus){
  assert.ok(Math.hypot(item.x-mesa.center.x,item.y-mesa.center.y)>=
   mesa.footRadius+130,'decorative rock intersects real mesa cliff');
 }
 cliff.removeFromParent();cliff.geometry.dispose();cliff.material.dispose();
});

test('v7 highlands remain deterministic; old v6 Plateau Crossroads stays loadable alongside new v10',()=>{
 const a=world(),b=world();
 assert.deepEqual(a.generated.battlefield.heights,b.generated.battlefield.heights);
 assert.deepEqual(a.blocked,b.blocked);
 const map=globalThis.SandforgeDesertMaps.byId('plateau-crossroads');
 assert.equal(map.generatorVersion,10,'new named Plateau Crossroads games receive larger playable heights');
 const old=Simulation.campaign(map.seed,map.mapVersion,map.terrain,6);
 assert.equal(Simulation.load(old.save()).world.generatorVersion,6,
  'old v6 Plateau Crossroads saves must not silently migrate to v10');
});
