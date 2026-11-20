import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';
import {desertEcoregion} from '../scripts/webgl-desert-ecoregions.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const world={
 seed:2026,size:6200,
 walkable:()=>true,terrainSlope:()=>.05
};
const terrain={battlefield:{},sites:[],ruins:[],roads:[]};

test('natural scenery patches are deterministic, sparse and respect quality budget',()=>{
 for(const mapId of ['broken-empire','burning-horizon','last-stronghold']){
  const region=desertEcoregion(mapId),options={world,terrain,seed:2026,mapId};
  const full=planDesertEcoregion(options);
  const again=planDesertEcoregion(options);
  const lite=planDesertEcoregion({...options,lowQuality:true});
  assert.deepEqual(full,again,'identical seed must produce identical PBR instance transforms');
  assert.equal(full.length,region.rocks+region.saguaro+region.joshua,
   'do not silently increase GPU geometry budget');
  assert.ok(lite.length<=full.length,'low quality stays less demanding');
  for(const p of full){
   assert.ok(p.x>290&&p.y>290&&p.x<5910&&p.y<5910,
    'never position visual art outside the safe map border');
   assert.ok(p.scale>=.75&&p.scale<=1.25,'keep realistic model scale');
   assert.equal(p.mapId,mapId);
  }
  if(mapId!=='last-stronghold'){
   const kind=mapId==='broken-empire'?'saguaro':'joshua';
   const plants=full.filter(p=>p.kind===kind);
   const nearby=plants.filter((p,i)=>plants.some((q,j)=>j!==i&&distance(p,q)<550));
   assert.ok(nearby.length>=6,'natural desert vegetation should grow in small stands');
  }
 }
});

test('navigation change is opt-in for modern physical maps, with fallback',()=>{
 const source=readFileSync('src/reborn/world.ts','utf8');
 assert.match(source,/const verifyApproach=allowPartial&&!air&&this\.generatorVersion===5&&/);
 assert.match(source,/this\.line\(start,near,obstacles,clearance,maxSlope\)/);
 assert.match(source,/this\.physicalPassAvailable\(near,far,clearance,maxSlope\)/);
 assert.match(source,/const pass=directlyReachablePass\?\?/);
 // Never persist a new state flag or reveal units hidden by Fog of War.
 assert.doesNotMatch(source,/this\.generated!\.enemy/);
});
