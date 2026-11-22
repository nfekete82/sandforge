import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {
 createSparseTrackFragments,createLandscapeMeshes
} from '../scripts/webgl-landscape-network.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('dust tracks are reproducible, short, disconnected and nowhere near Bastions',()=>{
 const size=5400,seed=9999;
 const bastions=[
  {x:900,y:850},{x:2200,y:1700},{x:4000,y:3500},
  {x:900,y:4200},{x:3100,y:2800}
 ];
 const opts={size,seed,bastions,heightAt:()=>0};
 const paths=createSparseTrackFragments(opts);
 assert.deepEqual(paths,createSparseTrackFragments(opts));
 assert.notDeepEqual(paths,createSparseTrackFragments({...opts,seed:seed+1}));
 assert.ok(paths.length>=9&&paths.length<=34);
 for(const route of paths){
  assert.equal(route.length,7);
  const length=route.slice(1).reduce((sum,p,i)=>sum+dist(p,route[i]),0);
  assert.ok(length>55&&length<235,'no artificial long straight roads');
  for(const p of route){
   assert.ok(p.x>100&&p.y>100&&p.x<size-100&&p.y<size-100);
   assert.ok(bastions.every(b=>dist(p,b)>=340),
    'scars must not disclose hidden Bastions');
  }
 }
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
  assert.ok(dist(paths[i][3],paths[j][3])>190,
   'isolated marks must never join into one persistent road');
 }
});

test('traces stay off steep rock, cliffs and any supplied impassable geometry',()=>{
 const options={size:4100,seed:401,bastions:[],
  heightAt:(x,y)=>x>1900&&x<2100?x*3:0,
  walkable:p=>p.x>450};
 const paths=createSparseTrackFragments(options);
 assert.ok(paths.length>5);
 for(const route of paths)for(const p of route){
  assert.ok(p.x>450,'blocked cells are omitted');
  const slope=Math.hypot(
   options.heightAt(p.x+14,p.y)-options.heightAt(p.x-14,p.y),
   options.heightAt(p.x,p.y+14)-options.heightAt(p.x,p.y-14))/28;
  assert.ok(slope<=.14,'no painted tire marks climbing an untraversable cliff');
 }
});

test('real generated Bastion road graph is not rendered on desert: one sparse draw call only',()=>{
 const g=new Simulation(9999,24,false,false,'oasis',10);
 const w=g.world,roads=structuredClone(w.generated.roads);
 const ownerBefore=g.territories.map(t=>t.owner),blockedBefore=w.blocked.slice();
 const scene=new THREE.Scene(),size=w.size,bastions=g.territories.map(t=>t.point);
 const meshes=createLandscapeMeshes({
  scene,size,roads:w.generated.roads,seed:g.seed,bastions,
  heightAt:(x,z)=>w.terrainHeight(x,z),ridges:[],plateaus:[],
  biome:'desert',mapId:'desert-strike',lowQuality:true,showOutcrops:false
 });
 const trace=meshes.find(m=>m.userData?.unconnectedTrackRemnants);
 assert.ok(trace,'sparse desert marks must be visible');
 assert.equal(trace.userData.roadNetwork,false);
 assert.equal(trace.userData.noBastionGuidance,true);
 assert.ok(trace.userData.fragmentCount>=9);
 assert.ok(trace.userData.fragmentCount<=34);
 assert.equal(meshes.filter(m=>m.userData?.unconnectedTrackRemnants).length,1,
  'avoid fragment meshes per track: single batched draw call');
 const positions=trace.geometry.getAttribute('position');
 assert.ok(positions.count>100);
 for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/800))){
  const p={x:positions.getX(i)+size*.5,y:positions.getZ(i)+size*.5};
  assert.ok(bastions.every(b=>dist(p,b)>305),
   'a visible track cannot point directly into Bastion capture radius');
 }
 assert.deepEqual(w.generated.roads,roads,'no mutation of authoritative road graph');
 assert.deepEqual(w.blocked,blockedBefore,'no extra collision or blocked vehicle routes');
 assert.deepEqual(g.territories.map(t=>t.owner),ownerBefore);
 for(const m of meshes){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
});

test('snow and jungle keep old terrain road renderer, no change to old biome look',()=>{
 const start={x:200,y:200},end={x:1250,y:960},size=2000;
 for(const biome of ['snow','jungle']){
  const scene=new THREE.Scene();
  const meshes=createLandscapeMeshes({
   scene,size,heightAt:()=>0,roads:[[start,end]],
   ridges:[],plateaus:[],biome,seed:91,lowQuality:true
  });
  assert.equal(meshes.length,1);
  assert.equal(meshes[0].name,'procedural-v3-soft-sand-roads');
  assert.equal(meshes[0].userData.roadNetwork,true);
  assert.equal(meshes[0].userData.unconnectedTrackRemnants,false);
  for(const m of meshes){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
 }
});

test('3D preview passes current Bastion sites into visual-only renderer',()=>{
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(src,/seed,bastions:game\.territories\.map\(t=>t\.point\)/);
 assert.match(src,/const groundTracks=new SandforgeGroundTracks/);
 assert.match(src,/groundTracks\.capture\(\)/);
});
