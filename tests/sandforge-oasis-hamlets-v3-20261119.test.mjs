import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {generateOases} from '../scripts/webgl-oasis-generation.js';
import {planOasisVillages,OASIS_HAMLET_REVISION} from '../scripts/webgl-oasis-village-layout.js';
import {planDesertVillages,createDesertVillages,OASIS_VILLAGE_MODELS}
 from '../scripts/webgl-desert-village.js';

function modelFile(uri){
 return 'dist'+uri;
}
function readGlb(uri){
 const path=modelFile(uri);
 assert.ok(existsSync(path),'generated asset should exist in build output: '+path);
 const b=readFileSync(path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 assert.equal(b.readUInt32LE(16),0x4e4f534a);
 const json=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 assert.equal(json.asset.version,'2.0');
 assert.ok(json.meshes.length>=4);
 assert.ok(json.images.length>=4,'diffuse plus normal textures are embedded');
 assert.ok(json.materials.every(mat=>mat.normalTexture&&
   mat.pbrMetallicRoughness?.baseColorTexture&&mat.pbrMetallicRoughness.roughnessFactor>.8));
 assert.ok(json.accessors.some(a=>a.type==='VEC3'&&a.max&&a.min));
 assert.ok(json.meshes.every(mesh=>mesh.primitives.every(prim=>
   prim.attributes.POSITION!==undefined&&prim.attributes.NORMAL!==undefined&&
   prim.attributes.TEXCOORD_0!==undefined)));
 return json;
}

test('all six adobe variants are distinct self-contained textured binary GLBs',()=>{
 assert.equal(OASIS_VILLAGE_MODELS.length,6);
 assert.equal(new Set(OASIS_VILLAGE_MODELS).size,6);
 const models=OASIS_VILLAGE_MODELS.map(readGlb);
 const fingerprints=models.map(m=>m.accessors.filter(a=>a.type==='VEC3')
  .map(a=>a.count).join(','));
 assert.equal(new Set(fingerprints).size,6,'unique geometry, not recolored clones');
});

const sampleWorld=()=>{
 const world={
  seed:20261119,size:6500,mapVersion:26,generatorVersion:3,
  index:p=>p.x>=0&&p.y>=0&&p.x<6500&&p.y<6500?1:-1,
  blocked:new Uint8Array(2),walkable:()=>true,
  terrainSlope:()=>0,terrainHeight:()=>0
 };
 return {world,terrain:{
  sites:[{x:250,y:260},{x:6140,y:6170}],
  ruins:[],
  roads:[]
 },oases:[
  {id:0,x:2050,y:2300,radius:134,seed:2134321},
  {id:1,x:4380,y:4300,radius:129,seed:84320811}
 ]};
};

test('natural villages use true oasis locations, distinct size/rotation and non-overlapping plots',()=>{
 const {world,terrain,oases}=sampleWorld();
 const opts={world,terrain,oases,seed:101001};
 const villages=planOasisVillages(opts);
 assert.equal(villages.length,2);
 assert.deepEqual(villages,planOasisVillages(opts),'seed reproducibility');
 assert.ok(OASIS_HAMLET_REVISION.includes('adobe'));
 for(const village of villages){
  assert.ok(village.houses.length>=4&&village.houses.length<=6);
  assert.equal(village.architecturalStyle,'oasis-adobe');
  const origin=oases.find(x=>x.id===village.oasisId);
  assert.ok(origin,'village must reference an oasis');
  assert.ok(village.houses.every(h=>Math.hypot(h.x-origin.x,h.y-origin.y)>origin.radius*1.3));
  assert.ok(new Set(village.houses.map(h=>h.variant)).size>=4,'unique model types');
  assert.ok(new Set(village.houses.map(h=>Math.round(h.width))).size>=3,'different building proportions');
  assert.ok(new Set(village.houses.map(h=>Math.round(h.angle*180/Math.PI))).size>=3,'independent facade orientations');
  for(let i=0;i<village.houses.length;i++)
   for(let j=i+1;j<village.houses.length;j++){
    const a=village.houses[i],b=village.houses[j];
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>
     .5*Math.hypot(a.width,a.depth)+.5*Math.hypot(b.width,b.depth)+20,
     'houses must not overlap');
   }
 }
 const viaRenderPlanner=planDesertVillages(opts);
 assert.deepEqual(viaRenderPlanner,villages,'v3 selects new village planner');
});

test('rendered V3 buildings use batched authored GLBs without altering collision',async()=>{
 const {world,terrain,oases}=sampleWorld(),seed=101001;
 const scene=new THREE.Scene(),sources=[],modified=[];
 const mock=async url=>{
  sources.push(url);
  const group=new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(60,38,52),
   new THREE.MeshStandardMaterial({name:'original-pbr',roughness:.9})));
  return {scene:group};
 };
 const art=await createDesertVillages({
  world,terrain,seed,oases,scene,lowQuality:false,
  heightAt:()=>0,pos:(x,z,y=0)=>new THREE.Vector3(x-world.size/2,y,z-world.size/2),
  loadModel:mock,weatherModel:x=>modified.push(x)
 });
 assert.equal(sources.length,6,'loads six dedicated models');
 assert.equal(modified.length,0,'do not overwrite embedded GLB textures');
 assert.equal(art.villages.length,2);
 assert.ok(art.meshes.length>=5&&art.meshes.every(mesh=>mesh.isInstancedMesh));
 assert.ok(art.meshes.every(mesh=>mesh.userData.visualOnly&&mesh.raycast.toString()==='()=>{}'));
 assert.ok(art.meshes.every(mesh=>OASIS_VILLAGE_MODELS.includes(mesh.userData.source)));
 assert.ok(art.drawCalls<=25,'instanced mesh budget');
 assert.ok(art.roads?.userData.softRuts);
 assert.ok(art.roads?.material.transparent);
 art.roads.geometry.dispose();art.roads.material.dispose();
});

test('real v3 maps keep units and bases navigable beside any new oasis hamlets',()=>{
 for(const seed of [2077,42102026]){
  const game=Simulation.campaign(seed,23,'oasis',3),world=game.world,
   terrain=world.generated;
  const oases=generateOases({world,seed,startRegions:game.startRegions,
   heightAt:(x,z)=>world.terrainHeight(x,z)});
  const villages=planDesertVillages({world,terrain,seed,oases});
  for(const village of villages)for(const house of village.houses){
   assert.ok(world.walkable({x:house.x,y:house.y}));
   assert.ok(world.terrainSlope(house.x,house.y)<.2);
   assert.ok(terrain.sites.every(p=>Math.hypot(house.x-p.x,house.y-p.y)>780));
  }
  assert.ok(world.validation?.valid);
 }
});
