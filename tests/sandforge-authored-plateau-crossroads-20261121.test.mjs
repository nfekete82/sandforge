import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';
import {planCanyonPbrOutcrops} from '../scripts/webgl-canyon-pbr-outcrops.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
import {readFileSync} from 'node:fs';

const map=globalThis.SandforgeDesertMaps.byId('plateau-crossroads');
const distanceSegment=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,s=(dx*dx+dy*dy)||1;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/s));
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};

test('authored Plateau Crossroads: deterministic playable geometry with 3 plateaus, 4 real gaps',()=>{
 assert.ok(map);
 assert.equal(map.generatorVersion,8);
 assert.equal(map.bastions,16);
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world;
 assert.equal(world.generatorVersion,8);
 assert.equal(world.generated.landscapeKind,'plateau-crossroads');
 assert.equal(world.generated.ridges.length,3);
 assert.equal(world.generated.ridges.reduce((n,r)=>n+r.ramps.length,0),4);
 assert.ok(world.generated.roads.length>=20);
 assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
 assert.equal(world.validation?.reachableSites,16);
 assert.equal(world.validation?.tankReachableSites,16);
 assert.equal(Simulation.load(game.save()).world.generatorVersion,8);
 const second=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 assert.deepEqual(world.generated.ridges,second.world.generated.ridges);
 assert.deepEqual(world.generated.roads,second.world.generated.roads);
});

test('authored Plateau Crossroads: passes are clear of blocked rock cells for tanks and artillery',()=>{
 const world=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion).world;
 for(const [i,ridge] of world.generated.ridges.entries())for(const pass of ridge.ramps){
  const mid={x:pass.x,y:ridgeHeightAtX(ridge,pass.x)};
  for(const kind of ['rover','tank','artillery']){
   const clearance=Math.max(0,UNITS[kind].radius-10);
   const slope=kind==='tank'?.215:kind==='artillery'?.185:.195;
   assert.ok(world.walkable(mid,[],clearance),'ridge '+i+' '+kind+' blocked crossing');
   assert.ok(world.groundVehicleSlopeSafe(mid,slope,clearance+10),
    'ridge '+i+' '+kind+' unsuitable ramp slope');
   const offset=ridge.width*1.3+260;
   const from={x:mid.x,y:mid.y-offset};
   const to={x:mid.x,y:mid.y+offset};
   const path=world.path(from,to,[],clearance,undefined,false,false,false,slope);
   assert.ok(path.length&&Math.hypot(path.at(-1).x-to.x,path.at(-1).y-to.y)<world.cell*1.4,
    'ridge '+i+' '+kind+' cannot cross the actual pass');
  }
 }
});

test('authored Plateau Crossroads: prominent cliff, visible dirt roads and no extra rock in rock',()=>{
 const world=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion).world;
 const blocked=world.blocked.slice(),scene=new THREE.Scene();
 const meshes=createLandscapeMeshes({
  scene,size:world.size,heightAt:(x,z)=>world.terrainHeight(x,z),
  roads:world.generated.roads,ridges:world.generated.ridges,
  biome:'desert',mapId:map.id,lowQuality:true,showOutcrops:false
 });
 const cliff=meshes.find(m=>m.userData?.erodedRidge);
 const road=meshes.find(m=>m.userData?.roadNetwork);
 assert.ok(cliff?.geometry?.attributes?.position?.count>1000,'large plateau cliff is missing');
 assert.ok(road?.geometry?.attributes?.position?.count>1000,'visible valley road geometry missing');
 assert.ok(cliff.material.map?.isTexture&&cliff.material.normalMap?.isTexture,
  'the cliff must keep photographic PBR sandstone');
 assert.equal(meshes.filter(m=>m.userData?.rockOutcrops).length,0);
 assert.deepEqual(planCanyonPbrOutcrops({world,mapId:map.id}),[]);
 const stones=planDesertEcoregion({world,mapId:map.id});
 for(const p of stones)for(const ridge of world.generated.ridges){
  for(let i=1;i<ridge.spine.length;i++){
   assert.ok(distanceSegment(p,ridge.spine[i-1],ridge.spine[i])>=
    ridge.width*2.1+(p.kind==='sandstone'?90:65),'stone intersects plateau cliff');
  }
 }
 assert.deepEqual(world.blocked,blocked,'all decorations must remain non-colliding');
 for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

test('Plateau Crossroads is selectable from 3D menu while original maps remain available',()=>{
 const menu=readFileSync('webgl-preview.html','utf8');
 for(const name of ['desert-strike','broken-empire','burning-horizon','last-stronghold','plateau-crossroads']){
  assert.match(menu,new RegExp('value="'+name+'"'));
 }
});


test('old Plateau Crossroads v6 geometry and save remain exactly reproducible',()=>{
 const old=Simulation.campaign(map.seed,map.mapVersion,map.terrain,6);
 assert.equal(old.world.generatorVersion,6);
 assert.equal(old.world.generated.ridges.length,3);
 const restored=Simulation.load(old.save());
 assert.equal(restored.world.generatorVersion,6);
 assert.deepEqual(restored.world.generated.battlefield.heights,
  old.world.generated.battlefield.heights);
 assert.deepEqual(restored.world.blocked,old.world.blocked);
});
