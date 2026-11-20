import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {planBurnedSedans,BURNED_SEDAN_COUNTS} from '../scripts/webgl-burned-sedan-plan.js';
import {createBurnedSedanWrecks} from '../scripts/webgl-burned-sedan-3d.js';

const maps=globalThis.SandforgeDesertMaps.maps;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const roadDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,
  ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
for(const map of maps)test(map.name+': fixed terrain props, real 3D shapes, no pathing or save mutation',()=>{
 const g=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const w=g.world,t=w.generated;
 const originalSave=JSON.stringify(g.save()),blocked=new Uint8Array(w.blocked),
  count=Object.keys(w.generated).length;
 const opts={world:w,terrain:t,seed:g.seed,mapId:map.id};
 const planned=planBurnedSedans(opts);
 assert.equal(planned.length,BURNED_SEDAN_COUNTS[map.id],map.name+' expected complete prop family');
 assert.deepEqual(planned,planBurnedSedans(opts),'fixed seeds must also freeze decor');
 const lite=planBurnedSedans({...opts,lowQuality:true});
 assert.ok(lite.length<=planned.length&&lite.length>=2);
 for(const p of planned){
  assert.ok(w.walkable(p,[],38),'wreck is placed where game can still drive');
  assert.ok(w.terrainSlope(p.x,p.y)<=.135);
  assert.ok(p.x>240&&p.y>240&&p.x<w.size-240&&p.y<w.size-240);
  assert.ok(t.sites.every(site=>dist(site,p)>=940),'Bastion/HQ build pad must stay clear');
  assert.ok(t.ruins.every(r=>dist(r,p)>=Math.max(r.width,r.depth)*.6+75));
  assert.ok((t.roads??[]).every(road=>road.slice(1).every((to,i)=>
    roadDistance(p,road[i],to)>=115)),'roads should remain clearly visible');
 }
 const scene=new THREE.Scene();
 const art=createBurnedSedanWrecks({...opts,scene,
  heightAt:(x,y)=>w.terrainHeight(x,y)});
 assert.equal(art.root.parent,scene);
 assert.equal(art.placements.length,planned.length);
 assert.ok(art.drawCalls<=10,'only five merged PBR draws per damaged shell variant');
 assert.ok(art.triangles>500,'real spatial geometry, not one photograph');
 assert.equal(art.root.userData.nonBlocking,true);
 const meshes=art.root.children;
 assert.equal(meshes.length,art.drawCalls);
 assert.ok(meshes.some(m=>m.userData.material==='shell'));
 assert.ok(meshes.some(m=>m.userData.material==='glass'));
 assert.ok(meshes.some(m=>m.userData.material==='rubber'));
 assert.ok(meshes.some(m=>m.userData.material==='iron'));
 assert.ok(meshes.every(m=>m.isInstancedMesh&&m.count>0&&
  m.userData.visualOnly&&m.userData.nonPlayable&&
  m.userData.nonBlocking&&m.raycast.toString()==='()=>{}'));
 for(const m of meshes){
  assert.ok(m.geometry.getAttribute('normal')?.count>=3,'even tiny broken-glass triangles need 3D normals');
  assert.ok(m.geometry.getAttribute('uv')?.count>=3,'every shell and glass shard needs proper UVs');
  assert.ok(m.geometry.boundingSphere?.radius>0);
 }
 assert.ok(meshes.find(m=>m.userData.material==='shell').material.map?.isTexture);
 assert.ok(meshes.find(m=>m.userData.material==='shell').material.normalMap?.isTexture);
 assert.equal(JSON.stringify(g.save()),originalSave,'no decor state in saved campaign');
 assert.deepEqual(w.blocked,blocked,'not a single physical collision cell changed');
 assert.equal(Object.keys(w.generated).length,count,'terrain authority untouched');
 art.dispose();art.dispose();
 assert.equal(art.root.parent,null,'cleanup detaches meshes for full scene release');
});
test('four-map-only decoration and actual WebGL package integration',()=>{
 const menu=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(menu,/desertMap&&biome==='desert'/);
 assert.match(menu,/createBurnedSedanWrecks/);
 assert.match(menu,/burnedSedans\?\.dispose\(\)/);
 assert.match(build,/cpSync\('scripts\/webgl-burned-sedan-3d\.js'/);
 assert.match(build,/cpSync\('scripts\/webgl-burned-sedan-plan\.js'/);
 const g=Simulation.campaign(2074,23,'dunes',4);
 assert.deepEqual(planBurnedSedans({world:g.world,terrain:g.world.generated,
  seed:g.seed,mapId:null}),[]);
});
