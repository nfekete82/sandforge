import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {World} from '../dist/src/reborn/world.js';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
import {desertRidgeGroundShade} from '../scripts/webgl-desert-art.js';

test('natural ridge tint has soft continuous falloff and keeps original PBR detail',()=>{
 assert.equal(desertRidgeGroundShade(0,0),1);
 assert.equal(desertRidgeGroundShade(.079,0),1);
 assert.ok(desertRidgeGroundShade(.15,30)<1);
 assert.ok(desertRidgeGroundShade(.15,30)>.8);
 assert.ok(desertRidgeGroundShade(.30,60)<desertRidgeGroundShade(.15,30));
 assert.ok(desertRidgeGroundShade(0,130)<1,'flat high ground is subtly shaded');
 assert.equal(desertRidgeGroundShade(0,0),desertRidgeGroundShade(NaN,Infinity));
 for(let slope=0;slope<=.6;slope+=.01){
  const shade=desertRidgeGroundShade(slope,150);
  assert.ok(Number.isFinite(shade)&&shade>=.76-1e-12&&shade<=1);
  const next=desertRidgeGroundShade(slope+.001,150);
  assert.ok(Math.abs(next-shade)<.004,'no abrupt polygon edge');
 }
});

test('modern desert preview shades original sand and skips ONLY extra ridge carpet',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(source,/const nativeDesertRidgeShade=biome==='desert'&&world\.mapVersion>=19&&\s*terrain\.battlefield\?\.generatorVersion>=3/);
 assert.match(source,/vertexColor\.multiplyScalar\(desertRidgeGroundShade\(slope,h\)\)/);
 assert.match(source,/ridges:nativeDesertRidgeShade\?\[\]:terrain\.ridges/);
 assert.match(source,/const h=heightAt\(x,z\),k=j\*\(segments\+1\)\+i/);
 assert.match(source,/map:texture,normalMap,normalScale:/,'same physical sand and wind texture');
 assert.match(source,/installDesertRegionalPBR\(material,renderer,desertRegion\?\.id\)/);
 assert.match(source,/createPlayableMesaCliffs\(\{scene,size,heightAt,plateaus:/,
  'genuine playable mesa faces remain independently preserved');
});

test('ridge carpet goes away, physical heightfield and pathing remain unchanged',()=>{
 const world=new World(824836862,24,'mixed',0,3);
 assert.equal(world.validation?.valid,true);
 assert.ok(world.generated.ridges.length>0,'test requires a real canyon ridge');
 const samples=[
  {x:world.size*.23,y:world.size*.31},
  {x:world.size*.45,y:world.size*.52},
  {x:world.size*.72,y:world.size*.68}
 ];
 const before={blocked:Array.from(world.blocked),
  heights:samples.map(p=>world.terrainHeight(p.x,p.y)),
  walk:samples.map(p=>world.walkable(p,[],20)),
  slope:samples.map(p=>world.terrainSlope(p.x,p.y)),
  generator:world.generatorVersion};
 const scene=new THREE.Scene();
 const meshes=createLandscapeMeshes({
  scene,size:world.size,
  heightAt:(x,z)=>world.terrainHeight(x,z),
  roads:world.generated.roads??[],ridges:[],
  plateaus:world.generated.plateaus??[],
  biome:'desert',seed:world.seed,
  bastions:world.generated.sites,showOutcrops:false
 });
 assert.equal(meshes.filter(m=>m.userData?.erodedRidge).length,0);
 assert.equal(meshes.filter(m=>m.userData?.rockOutcrops).length,0);
 assert.equal(scene.children.filter(m=>m.userData?.erodedRidge).length,0);
 assert.ok(meshes.every(m=>m.userData?.visualOnly),'visual changes only');
 assert.deepEqual({blocked:Array.from(world.blocked),
  heights:samples.map(p=>world.terrainHeight(p.x,p.y)),
  walk:samples.map(p=>world.walkable(p,[],20)),
  slope:samples.map(p=>world.terrainSlope(p.x,p.y)),
  generator:world.generatorVersion},before);
 for(const mesh of meshes){
  mesh.removeFromParent();
  mesh.geometry?.dispose();
  mesh.material?.dispose();
 }
});
