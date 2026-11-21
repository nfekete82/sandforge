import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {attachMeshyHeadquartersRadarMotion,updateMeshyHeadquartersRadarMotion,
 MESHY_HQ_RADAR_SPEEDS,MESHY_HQ_RADAR_REVISION}
 from '../scripts/webgl-meshy-hq-radars.js';

test('Meshy HQ radar moves slowly without adding a duplicate dish or losing PBR maps',()=>{
 const root=new THREE.Group();
 root.userData.sandforgeMeshyStructure='headquarters';
 const map=new THREE.DataTexture(new Uint8Array([110,95,80,255]),1,1);
 const normal=new THREE.DataTexture(new Uint8Array([127,127,255,255]),1,1);
 const steel=new THREE.MeshStandardMaterial({map,normalMap:normal,
  roughnessMap:map,metalnessMap:map,roughness:.8,metalness:.35});
 const body=new THREE.Mesh(new THREE.BoxGeometry(10,2,7),steel);
 body.position.y=1;root.add(body);
 for(const [x,z] of [[-3,-1],[1,1]]){
  const mount=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,1.4,24),steel);
  mount.position.set(x,8,z);root.add(mount);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),steel);
  dish.position.set(x,8.9,z);root.add(dish);
 }
 const childCount=root.children.length;
 const state=attachMeshyHeadquartersRadarMotion(root);
 assert.ok(state);
 assert.equal(state.mode,'meshy-dishes-gpu');
 assert.equal(root.children.length,childCount); // no fake radar mesh
 assert.ok(state.animatedMeshes>=2);
 assert.equal(root.userData.meshyHQSatellites,state);
 assert.equal(attachMeshyHeadquartersRadarMotion(root),state);
 const mount=root.children.find(x=>x.position.y===8);
 assert.ok(mount.material.userData.sandforgeMeshyHQDishMotion);
 assert.equal(mount.material.map,map);
 assert.equal(mount.material.normalMap,normal);
 assert.equal(mount.material.roughnessMap,map);
 assert.equal(mount.material.metalnessMap,map);
 const shader={
  vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <map_fragment>\n#include <roughnessmap_fragment>',
  uniforms:{}
 };
 mount.material.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/sfHQDishRotate/);
 assert.match(shader.vertexShader,/sfHQDishRotateNormal/);
 assert.equal(shader.uniforms.sfHQDishYaw.value.x,0);
 const initial=state.angles.slice();
 updateMeshyHeadquartersRadarMotion(state,1);
 assert.ok(Math.abs(state.angles[0]-MESHY_HQ_RADAR_SPEEDS[0])<1e-8);
 assert.ok(Math.abs(state.angles[1]-MESHY_HQ_RADAR_SPEEDS[1])<1e-8);
 assert.notDeepEqual(state.angles,initial);
 assert.equal(shader.uniforms.sfHQDishYaw.value.x,state.angles[0]);
 assert.equal(shader.uniforms.sfHQDishYaw.value.y,state.angles[1]);
 assert.equal(MESHY_HQ_RADAR_SPEEDS[0]<.1,true);
 assert.equal(MESHY_HQ_RADAR_REVISION.includes('slow-dishes'),true);
});
test('HQ motion presenter rotates only original Meshy dish, paused games freeze',()=>{
 const file=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(file,/attachMeshyHeadquartersRadarMotion\(entry.detail\)/);
 assert.match(file,/updateMeshyHeadquartersRadarMotion\(motion,dt\)/);
 assert.match(file,/else if\(active\)\{/);
 const script=readFileSync('scripts/build.mjs','utf8');
 assert.match(script,/webgl-meshy-hq-radars\.js/);
});
