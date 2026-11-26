import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addBiomeVegetation} from '../scripts/webgl-biomes.js';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';
import {World} from '../dist/src/reborn/world.js';

const context=(mapVersion=24)=>{
 const scene=new THREE.Scene(),world={
  size:6200,mapVersion,walkable:()=>true,terrainSlope:()=>.01
 },terrain={sites:[],ruins:[]};
 return {THREE,scene,world,terrain,game:{units:[]},heightAt:()=>0,seed:824836862,biome:'desert'};
};

test('modern desert removes all three false-rock shrub meshes (stone blobs and cones)',()=>{
 for(const version of [23,24,25,26]){
  const args=context(version),before=args.scene.children.length;
  const art=addBiomeVegetation(args);
  assert.deepEqual(art,{count:0,meshes:[]});
  assert.equal(args.scene.children.length,before,'desert shrub meshes must not exist');
 }
});

test('legacy desert shrub appearance remains available to historical maps',()=>{
 const args=context(22),art=addBiomeVegetation(args);
 assert.ok(art.count>0);
 assert.equal(art.meshes.length,3);
 for(const mesh of art.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

const landscape=(showOutcrops)=>{
 const scene=new THREE.Scene(),size=6200;
 const roads=[[{x:350,y:1500},{x:800,y:1550},{x:1800,y:1620}]];
 const ridges=[{spine:Array.from({length:24},(_,i)=>({x:200+i*210,y:2700+Math.sin(i*.5)*50})),
  width:112,height:118,ramps:[{x:1500,width:260}],
  clearings:[{point:{x:350,y:2700},radius:340},{point:{x:3200,y:2200},radius:360}]}];
 const meshes=createLandscapeMeshes({scene,size,heightAt:(x,z)=>5+Math.sin(x*.004)+Math.cos(z*.004),
  roads,ridges,biome:'desert',showOutcrops});
 return {meshes,scene};
};

test('network landscape keeps mountains and scattered tire marks while dropping loose boulders',()=>{
 const standard=landscape(true);
 assert.ok(standard.meshes.some(m=>m.userData.rockOutcrops),'test geometry must generate outcrops');
 const clean=landscape(false);
 assert.ok(clean.meshes.some(m=>m.userData.erodedRidge),'real continuous mountain ridge is preserved');
 assert.ok(clean.meshes.some(m=>m.userData.unconnectedTrackRemnants&&m.userData.noBastionGuidance));
 assert.ok(!clean.meshes.some(m=>m.userData.roadNetwork),'desert rendering does not reveal the strategic route graph');
 assert.equal(clean.meshes.filter(m=>m.userData.rockOutcrops).length,0);
 assert.ok(clean.meshes.every(m=>!m.name.includes('sandstone-outcrops')));
 for(const data of [standard,clean])for(const mesh of data.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

test('preview disables all open desert boulder passes and retains physical mountain collision',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const wash=readFileSync('scripts/webgl-desert-art.js','utf8');
 const shrub=readFileSync('scripts/webgl-biomes.js','utf8');
 const environment=readFileSync('scripts/webgl-environment.js','utf8');
 assert.ok(preview.includes("if(spacious&&biome==='desert'&&terrain.battlefield)return 0"));
 assert.ok(preview.includes("showOutcrops:biome!=='desert'"));
 assert.ok(wash.includes('world.mapVersion>=23)return null'));
 assert.ok(shrub.includes("if(selected==='desert'&&world.mapVersion>=23)return {count:0,meshes:[]}"));
 assert.ok(environment.includes("if(!(biome==='desert'&&world.mapVersion>=23))this.addDebris()"));
 const gameWorld=new World(824836862,24,'mixed',0,3);
 assert.equal(gameWorld.validation?.valid,true);
 assert.equal(gameWorld.generated.mesas.length,0,'real isolated mesa obstacles gone');
 assert.equal(gameWorld.generated.ridges.length,1,'real canyon geometry retained');
 assert.ok(gameWorld.generated.roads.length>0,'strategic navigation roads remain');
 assert.ok(gameWorld.generated.sites.every(site=>gameWorld.walkable(site,[],32)));
});
