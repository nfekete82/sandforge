import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLandscapeMeshes} from '../scripts/webgl-landscape-network.js';

const geometryOptions=()=>({
 scene:new THREE.Scene(),
 size:2400,
 heightAt:(x,z)=>6+2*Math.sin(x*.003)+Math.cos(z*.004),
 roads:[
  [{x:120,y:900},{x:570,y:840},{x:1100,y:880},{x:2050,y:970}],
  [{x:800,y:1300},{x:1080,y:880},{x:1430,y:380}],
 ],
 ridges:[{
  spine:Array.from({length:21},(_,i)=>({x:110+i*102,y:500+Math.sin(i*.42)*45})),
  width:118,height:122,
  ramps:[{x:1120,width:280}],
  clearings:[{point:{x:350,y:500},radius:240},
             {point:{x:1770,y:500},radius:175}]
 }],
 biome:'desert'
});

test('v3 sand roads are one vertex-alpha mesh with feathered sides, not two stacked bands',()=>{
 const setup=geometryOptions();
 const meshes=createLandscapeMeshes(setup);
 const roads=meshes.filter(m=>m.userData.roadNetwork);
 assert.equal(roads.length,1);
 const mesh=roads[0],attr=mesh.geometry.getAttribute('color');
 assert.equal(attr.itemSize,4,'RGBA needed for physically fading road edges');
 assert.ok(mesh.material.transparent);
 assert.equal(mesh.material.depthWrite,false);
 assert.equal(mesh.userData.visualOnly,true);
 assert.ok(mesh.geometry.getAttribute('position').count>300);
 let zeros=0,intermediate=0,max=0;
 for(let i=0;i<attr.count;i++){
  const alpha=attr.getW(i);
  assert.ok(alpha>=0&&alpha<=.3,`road alpha out of range: ${alpha}`);
  if(alpha<.001)zeros++;
  if(alpha>.07&&alpha<.3)intermediate++;
  max=Math.max(max,alpha);
 }
 assert.ok(max>.13,'visible subtle road wear');
 assert.ok(zeros>20,'transparent road edges');
 assert.ok(intermediate>100,'gradual shoulders, not an opaque strip');
 assert.equal(mesh.castShadow,false);
});

test('v3 rock formations are connected low-poly hills, with real smooth gaps and no repeated teeth',()=>{
 const setup=geometryOptions();
 const meshes=createLandscapeMeshes(setup);
 const rock=meshes.find(m=>m.userData.erodedRidge);
 assert.ok(rock,'natural sandstone mesh');
 assert.equal(rock.userData.physicalCliffPresentation,true);
 assert.equal(rock.geometry.getAttribute('color').itemSize,3);
 const positions=rock.geometry.getAttribute('position');
 assert.ok(positions.count>500,'continuous connected geography, not isolated pillars');
 let maxRise=0, highInPass=0, highInBuildPad=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i)+setup.size/2;
  const z=positions.getZ(i)+setup.size/2;
  const rise=positions.getY(i)-setup.heightAt(x,z);
  assert.ok(Number.isFinite(rise)&&rise>=0&&rise<160);
  maxRise=Math.max(maxRise,rise);
  if(Math.abs(x-1120)<95&&rise>15)highInPass++;
  if(Math.hypot(x-350,z-500)<220&&rise>15)highInBuildPad++;
 }
 assert.ok(maxRise>45,'tactical mountainous relief remains visible');
 assert.equal(highInPass,0,'open tank pass must not be visually blocked');
 assert.equal(highInBuildPad,0,'build pads remain free from mountains');
});

test('the renderer is deterministic and cannot intercept mouse orders',()=>{
 const a=createLandscapeMeshes(geometryOptions());
 const b=createLandscapeMeshes(geometryOptions());
 assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){
  assert.equal(a[i].name,b[i].name);
  assert.equal(a[i].geometry.getAttribute('position').count,b[i].geometry.getAttribute('position').count);
  const av=a[i].geometry.getAttribute('position').array;
  const bv=b[i].geometry.getAttribute('position').array;
  assert.deepEqual(av,bv,'same map produces identical geometry');
  const hits=[];a[i].raycast(new THREE.Raycaster(),hits);
  assert.deepEqual(hits,[],'clicks must pass through cosmetic terrain');
 }
});
