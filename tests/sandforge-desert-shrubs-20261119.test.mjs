import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {addBiomeVegetation,addDesertShrubs} from '../scripts/webgl-biomes.js';

function sample(seed=1427,lowQuality=false){
 const scene=new THREE.Scene(),size=4100;
 const world={size,walkable:()=>true,terrainSlope:()=>.025};
 const terrain={sites:[{x:2100,y:2100}],ruins:[{x:3100,y:1600}]};
 const game={units:[{x:400,y:400}]};
 const result=addBiomeVegetation({THREE,scene,world,terrain,game,
  heightAt:()=>0,seed,biome:'desert',lowQuality});
 return {scene,...result,size,terrain};
}
test('three visually distinct desert bush types are actually placed in the game scene',()=>{
 const r=sample();
 assert.equal(r.meshes.length,3);
 assert.ok(r.count>80&&r.count<=165);
 assert.equal(r.scene.children.length,3);
 assert.equal(r.meshes.reduce((sum,m)=>sum+m.count,0),r.count);
 assert.deepEqual(r.meshes.map(m=>m.userData.shrubKind),
  ['sage-scrub','dry-grass','thorn-bush']);
 assert.ok(r.meshes.every(m=>m.isInstancedMesh&&!m.castShadow&&m.receiveShadow));
 assert.ok(r.meshes.every(m=>m.userData.nonPlayable&&m.userData.visualOnly));
 assert.ok(r.meshes.every(m=>m.instanceColor&&m.instanceColor.array.length>=m.count*3));
 for(const mesh of r.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});

test('different seeds change scene layout; same seed is 100% deterministic',()=>{
 const a=sample(),b=sample(),c=sample(1428);
 assert.equal(a.count,b.count);
 for(let i=0;i<3;i++){
  assert.equal(a.meshes[i].count,b.meshes[i].count);
  const aa=a.meshes[i].instanceMatrix.array,bb=b.meshes[i].instanceMatrix.array;
  assert.deepEqual(Array.from(aa),Array.from(bb));
 }
 assert.notDeepEqual(Array.from(a.meshes[0].instanceMatrix.array),
  Array.from(c.meshes[0].instanceMatrix.array));
 for(const sampleData of [a,b,c])for(const mesh of sampleData.meshes){
  mesh.geometry.dispose();mesh.material.dispose();
 }
});

test('visual-only shrubs avoid strategic clearings and stay inside playable terrain',()=>{
 const r=sample(39,true);
 assert.ok(r.count<=60&&r.count>10,'lite mode uses a fixed low vegetation budget');
 const m=new THREE.Matrix4(),position=new THREE.Vector3();
 for(const mesh of r.meshes)for(let i=0;i<mesh.count;i++){
  mesh.getMatrixAt(i,m);position.setFromMatrixPosition(m);
  const x=position.x+r.size*.5,y=position.z+r.size*.5;
  assert.ok(x>=155&&x<=r.size-155&&y>=155&&y<=r.size-155);
  for(const p of r.terrain.sites.concat(r.terrain.ruins))
   assert.ok(Math.hypot(x-p.x,y-p.y)>=185);
 }
 for(const mesh of r.meshes){mesh.geometry.dispose();mesh.material.dispose();}
});
