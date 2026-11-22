import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {mesaRampCoverage,mesaRampDirections} from '../dist/src/reborn/raised-mesas.js';
import {createPlayableMesaCliffs} from '../scripts/webgl-raised-mesa-cliffs.js';
import {sharedStoneMaps} from '../scripts/webgl-rock-materials.js';
import {readFileSync} from 'node:fs';

const preset=globalThis.SandforgeDesertMaps.byId('desert-strike');
const game=()=>Simulation.campaign(
 preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion);

test('Desert Strike uses only physical terrain and never draws coplanar cliff overlay',()=>{
 const simulation=game(),world=simulation.world;
 assert.equal(world.generatorVersion,10);
 assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
 const central=world.generated.plateaus.find(m=>m.siteIndex===-1);
 assert.equal(mesaRampDirections(central).length,4);
 const blocked=world.blocked.slice(),heights=world.generated.battlefield.heights.slice();
 const scene=new THREE.Scene();
 const meshes=createPlayableMesaCliffs({scene,size:world.size,
  heightAt:(x,z)=>world.terrainHeight(x,z),plateaus:world.generated.plateaus,
  lowQuality:true,mapId:'desert-strike'});
 assert.deepEqual(meshes,[],'no visual cliff skin may overlap real plateau');
 assert.equal(scene.children.length,0);
 assert.deepEqual(world.blocked,blocked);
 assert.deepEqual(world.generated.battlefield.heights,heights);
 for(const d of central.ramps){
  const p={x:central.center.x+d.x*(central.topRadius+420),
   y:central.center.y+d.y*(central.topRadius+420)};
  assert.ok(mesaRampCoverage(p,central)>.72);
  assert.ok(world.walkable(p,[],20));
  assert.ok(world.groundVehicleSlopeSafe(p,.215,20));
 }
 assert.equal(Simulation.load(simulation.save()).world.generatorVersion,10);
});

test('actual ground vertex shades real steep Desert Strike slopes without blending',()=>{
 const source=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(source,/desertRegion\?\.id==='desert-strike'/);
 assert.match(source,/const cliffFace=smooth\(\(slope-\.19\)\/\.30\)/);
 assert.match(source,/vertexColor\.lerp\(new THREE\.Color\('#78604c'\),cliffFace\*\.75\)/);
 const cliffCode=readFileSync('scripts/webgl-raised-mesa-cliffs.js','utf8');
 assert.match(cliffCode,/if\(mapId==='desert-strike'\)return \[\]/);
});

test('older maps retain their previous cliff presentation',()=>{
 const w=game().world,scene=new THREE.Scene();
 const [old]=createPlayableMesaCliffs({
  scene,size:w.size,heightAt:(x,z)=>w.terrainHeight(x,z),
  plateaus:w.generated.plateaus,lowQuality:true
 });
 assert.ok(old);
 assert.equal(old.name,'Sandforge-Physical-Playable-Mesa-Cliffs');
 assert.equal(old.material.map,sharedStoneMaps(true).map);
 old.removeFromParent();old.geometry.dispose();old.material.dispose();
});
