import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {BASTION_RUIN_CLEARANCE} from '../dist/src/reborn/world-generation.js';
import {planDesertVillages,BASTION_VILLAGE_CLEARANCE}
 from '../scripts/webgl-desert-village.js';
const separation=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('modern procedural terrains never place ruin houses within a Bastion pad',()=>{
 assert.equal(BASTION_RUIN_CLEARANCE,1150);
 for(const version of [23,24,25,26])for(const seed of [2988452066,3610769721,42102026,145110]){
  const game=Simulation.campaign(seed,version),terrain=game.world.generated;
  for(const ruin of terrain.ruins)for(const site of terrain.sites)
   assert.ok(separation(ruin,site)>BASTION_RUIN_CLEARANCE,
    'ruin blocks Bastion on map '+version+' seed '+seed);
 }
});
test('scenic hamlet houses AND access lanes maintain at least 1150m Bastion clearance',()=>{
 assert.equal(BASTION_VILLAGE_CLEARANCE,1150);
 for(const version of [23,24,25,26])for(const seed of [2988452066,3610769721,42102026,145110]){
  const game=Simulation.campaign(seed,version),terrain=game.world.generated;
  const hamlets=planDesertVillages({world:game.world,terrain,seed});
  for(const hamlet of hamlets){
   for(const site of terrain.sites){
    assert.ok(separation(hamlet,site)>=BASTION_VILLAGE_CLEARANCE+320,
     'village center too close to Bastion');
    const c=Math.cos(hamlet.angle),s=Math.sin(hamlet.angle);
    for(const dz of [-hamlet.roadLength/2,0,hamlet.roadLength/2]){
     const road={x:hamlet.x+dz*s,y:hamlet.y+dz*c};
     assert.ok(separation(road,site)>=BASTION_VILLAGE_CLEARANCE,
      'ruin tracks cross a Bastion pad');
    }
   }
   for(const house of hamlet.houses)for(const site of terrain.sites)
    assert.ok(separation(house,site)>=BASTION_VILLAGE_CLEARANCE,
     'abandoned house too close to Bastion');
  }
 }
});
test('visual-only hamlet planner stays seeded and cannot reintroduce obstacles',()=>{
 const game=Simulation.campaign(2988452066,23),terrain=game.world.generated,world=game.world;
 const one=planDesertVillages({world,terrain,seed:game.seed});
 const two=planDesertVillages({world,terrain,seed:game.seed});
 assert.deepEqual(one,two);
 assert.ok(one.length<=2);
 assert.ok(one.every(h=>h.houses.length===3));
});
