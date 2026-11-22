import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {attachScoutRocketPods,detachScoutRocketPods,scoutPodCamouflageTexture}
 from '../scripts/webgl-scout-rocket-pods.js';

test('PBR desert camo is a real repeating mipmapped 128px sRGB albedo, not flat paint',()=>{
 const map=scoutPodCamouflageTexture(0);
 try{
  assert.equal(map.isDataTexture,true);
  assert.equal(map.image.width,128);
  assert.equal(map.image.height,128);
  assert.equal(map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(map.minFilter,THREE.LinearMipmapLinearFilter);
  const swatches=new Set();
  for(let i=0;i<map.image.data.length;i+=64)
   swatches.add(map.image.data.slice(i,i+3).join(':'));
  assert.ok(swatches.size>=20,'visible camouflage irregularity and fine surface detail');
 }finally{map.dispose();}
});

test('2 compact launch bores per side are attached close to helicopter cabin, not out on floating boxes',()=>{
 const entry={kind:'scout',owner:0,node:new THREE.Group()};
 attachScoutRocketPods(entry);
 const root=entry.scoutRocketPods;
 assert.equal(root.children.length,2);
 assert.equal(entry.scoutRocketMuzzles.length,2);
 const albedos=new Set();
 for(const pod of root.children){
  assert.ok(Math.abs(pod.position.x)<=26&&Math.abs(pod.position.x)>=16);
  assert.ok(pod.position.y>=16,'rocket pods ride alongside cabin');
  const fairings=pod.children.filter(x=>x.isMesh&&x.material.map);
  assert.equal(fairings.length,2,'textured rounded fairing and stub pylon');
  for(const body of fairings)albedos.add(body.material.map);
  assert.ok(pod.children.filter(x=>x.isMesh&&x.material.color?.getHexString()==='1d2420').length===2);
 }
 assert.equal(albedos.size,1,'both pods share one owned texture');
 assert.equal(entry.node.children[0],root);
 const ownedMap=[...albedos][0];
 let disposed=false;
 const original=ownedMap.dispose.bind(ownedMap);
 ownedMap.dispose=()=>{disposed=true;original();};
 detachScoutRocketPods(entry);
 assert.equal(disposed,true,'dispose only pod-owned camouflage resources');
 assert.equal(entry.node.children.length,0);
});

test('vehicle slope checks reject a physically steep hill even when navigation cells are open',()=>{
 const w=new World(2026,24,'mixed');
 w.blocked.fill(0);w.components.fill(0);
 w.terrainSlope=(x,y)=>x>935&&x<1065?.34:.06;
 w.terrainHeight=(x,y)=>Math.max(0,Math.min(30,(x-935)*.34));
 const before={x:900,y:1100},after={x:1100,y:1100};
 assert.equal(w.walkable(before),true);
 assert.equal(w.walkable(after),true,'grid considers both sites walkable');
 assert.equal(w.line(before,after,[],12),true,'legacy line test has no physical slope gate');
 assert.equal(w.groundVehicleStepSafe(before,after,.215,22),false);
 assert.equal(w.line(before,after,[],12,.215),false,
  'vehicle path segment cannot climb steep rock even without a blocked cell');
 assert.equal(w.groundVehicleSlopeSafe({x:990,y:1100},.215,22),false);
 assert.equal(w.groundVehicleSlopeSafe({x:900,y:1100},.215,22),true);
});

test('actual A* moving-unit route never includes illegal steep cliff waypoints',()=>{
 const w=new World(2027,24,'mixed');
 w.blocked.fill(0);w.components.fill(0);
 const boundary=1150;
 w.terrainSlope=(x,y)=>x>boundary&&x<boundary+160?.34:.04;
 w.terrainHeight=(x,y)=>Math.max(0,Math.min(50,(x-boundary)*.34));
 const a={x:900,y:1500},b={x:1600,y:1500};
 const route=w.path(a,b,[],12,undefined,false,true,true,.215);
 let prev=a;
 for(const point of route){
  assert.equal(w.groundVehicleStepSafe(prev,point,.215,22),true);
  prev=point;
 }
 assert.ok(route.every(p=>p.x<=boundary+1),
  'A* can approach the obstacle but cannot send a tank across the closed slope strip');
});

test('new collision rule applies only to modern ground vehicles, not flight or old map saves',()=>{
 const s=readFileSync('src/reborn/simulation.ts','utf8');
 assert.match(s,/vehicle&&this\.world\.mapVersion>=23/);
 assert.match(s,/this\.world\.groundVehicleStepSafe\(u,p,slopeLimit,spec\.radius\)/);
 assert.match(s,/this\.world\.path\(u,target,routeObstacles,clearance,risk,spec\.flying,u\.exactPath,true,slopeLimit\)/);
 const orig=new World(2026,0);
 assert.equal(orig.groundVehicleStepSafe({x:500,y:500},{x:800,y:900},.001,22),true,
  'no mesh heightfield, existing pre-3D navigation must not change');
});
