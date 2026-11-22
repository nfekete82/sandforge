import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {
 planMesaCliffDressing,cliffDressingRampCoverage,
 createMesaCliffDressing,dryCliffScrubGeometry
} from '../scripts/webgl-mesa-cliff-dressing.js';
import {readFileSync,existsSync} from 'node:fs';

const map=id=>globalThis.SandforgeDesertMaps.byId(id);
const simulation=id=>{
 const m=map(id);
 return Simulation.campaign(m.seed,m.mapVersion,m.terrain,m.generatorVersion);
};
test('Desert Strike has repeatable talus and cliff-foot shrubs on real terrain',()=>{
 const g=simulation('desert-strike'),w=g.world;
 const args={world:w,terrain:w.generated,seed:g.seed,lowQuality:false};
 const a=planMesaCliffDressing(args),b=planMesaCliffDressing(args);
 assert.deepEqual(a,b,'same fixed map and seed must reproduce the same visuals');
 assert.ok(a.stones.length>=8,'an actual fractured mesa should receive scree patches');
 assert.ok(a.shrubs.length>=2,'desert cliff foot needs sparse natural dry scrub');
 assert.ok(a.stones.length<=340&&a.shrubs.length<=100);
 for(const p of a.stones){
  assert.ok(p.width>2&&p.width<12);
  assert.ok(w.index(p)>=0);
  assert.ok(w.generated.plateaus.every(m=>cliffDressingRampCoverage(p,m)<=.18),
   'no scree at the four vehicle entrances');
 }
 for(const p of a.shrubs){
  assert.ok(w.walkable(p,[],14),'withered scrub may not sit in a cliff');
  assert.ok(w.terrainSlope(p.x,p.y)<.13);
  assert.ok(w.generated.plateaus.every(m=>cliffDressingRampCoverage(p,m)<.12),
   'plant must not overgrow a ramp');
 }
});
test('real 3D PBR talus and branched vegetation add at most two draw calls',()=>{
 const g=simulation('desert-strike'),w=g.world,scene=new THREE.Scene();
 const before={blocked:[...w.blocked],opaque:[...w.opaque],
  elevations:[...w.generated.battlefield.heights]};
 const view=createMesaCliffDressing({
  scene,world:w,terrain:w.generated,seed:g.seed,
  heightAt:(x,y)=>w.terrainHeight(x,y),lowQuality:true
 });
 assert.equal(view.drawCalls,2);
 assert.ok(scene.children.includes(view.root));
 assert.equal(view.meshes.length,2);
 assert.ok(view.meshes.every(m=>m.isInstancedMesh&&!m.castShadow&&m.receiveShadow));
 assert.ok(view.meshes.every(m=>
  m.userData.visualOnly&&m.userData.nonPlayable&&m.userData.nonBlocking&&
  m.userData.uvPbr&&m.material.map?.isTexture&&
  m.material.normalMap?.isTexture&&m.material.roughnessMap?.isTexture));
 assert.ok(view.meshes.every(m=>
  m.geometry.getAttribute('uv')?.count===m.geometry.getAttribute('position')?.count));
 assert.ok(view.meshes.every(m=>m.instanceColor?.count===m.count));
 assert.deepEqual([...w.blocked],before.blocked);
 assert.deepEqual([...w.opaque],before.opaque);
 assert.deepEqual([...w.generated.battlefield.heights],before.elevations);
 view.dispose();
 assert.equal(scene.children.includes(view.root),false);
});
test('vegetation is actual branching leaf geometry, not a cone or sphere',()=>{
 const hi=dryCliffScrubGeometry(),lite=dryCliffScrubGeometry(true);
 assert.equal(hi.userData.uvMapped,true);
 assert.equal(hi.userData.branchCount,11);
 assert.ok(hi.getAttribute('position').count>100);
 assert.ok(lite.getAttribute('position').count<hi.getAttribute('position').count);
 const p=hi.getAttribute('position');
 assert.ok(p.count===hi.getAttribute('normal').count);
 assert.ok(p.count===hi.getAttribute('uv').count);
 hi.dispose();lite.dispose();
});
test('historical terrain and non-plateau maps never receive replacement obstacles',()=>{
 const main=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(main,/createMesaCliffDressing\(\{scene,world,terrain,seed,heightAt/);
 assert.match(build,/cpSync\('scripts\/webgl-mesa-cliff-dressing\.js','dist\/webgl-mesa-cliff-dressing\.js'\)/);
 assert.ok(existsSync('dist/webgl-mesa-cliff-dressing.js'));
 const empty=planMesaCliffDressing({world:{mapVersion:22},terrain:{plateaus:[]}});
 assert.equal(empty.stones.length,0);
 assert.equal(empty.shrubs.length,0);
});
