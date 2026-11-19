import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {generateMap} from '../dist/src/reborn/world-generation.js';
import {campaignLayout} from '../dist/src/reborn/config.js';
import {generateLandscapeNetwork} from '../dist/src/reborn/landscape-network.js';

test('v3 creates deterministic roads, physical cliffs and genuine wide passages',()=>{
 for(const version of [23,24,25,26]){
  const seed=2077,game=Simulation.campaign(seed,version,'mixed',3),world=game.world;
  const map=world.generated,old=new World(seed,version,'mixed',0,2);
  assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
  assert.equal(map.battlefield.generatorVersion,3);
  assert.equal(map.roads.length,map.corridors.length);
  assert.equal(map.ridges.length,1);
  assert.ok(map.ridges[0].ramps.length>=2);
  assert.notDeepEqual(map.battlefield.heights,old.generated.battlefield.heights);
  assert.notDeepEqual(map.roads,old.generated.roads);
  assert.deepEqual(map,generateMap(seed,version,'mixed',world.validation.candidate,3));
  for(const pass of map.ridges[0].ramps){
   const line=map.ridges[0].spine;
   let y=line[0].y;
   for(let i=1;i<line.length;i++)if(pass.x<=line[i].x){
    const a=line[i-1],b=line[i],t=Math.max(0,Math.min(1,(pass.x-a.x)/(b.x-a.x)));
    y=a.y+(b.y-a.y)*t;break;
   }
   assert.ok(world.walkable({x:pass.x,y},[],32),'pass must be physically tank accessible');
  }
  const sites=map.sites;
  for(const point of sites)assert.ok(world.walkable(point,[],32),'Bastion accessible');
  for(const route of map.roads){
   assert.ok(route.length>=3,'curved road has intermediate waypoints');
   for(const waypoint of route)assert.ok(world.walkable(waypoint,[],32),'road waypoint accessible');
  }
 }
});

test('new generator preserves save/load, start pads, budgets and Bastion reachability',()=>{
 for(const version of [23,24,25,26])
  for(const profile of ['open','dunes','rocky','oasis','mixed'])
   for(const seed of [0,1]){
    const game=Simulation.campaign(seed,version,profile,3),world=game.world;
    assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
    assert.equal(world.validation?.tankReachableSites,game.territories.length);
    assert.equal(world.validation?.connectedCells,world.validation?.freeCells);
    const layout=campaignLayout(version,seed);
    assert.ok(layout.headquarters.every(id=>world.walkable(world.generated.sites[id],[],32)));
    const saved=game.save(),loaded=Simulation.load(saved);
    assert.equal(loaded.world.generatorVersion,3);
    assert.equal(loaded.world.generated.battlefield.profile,profile);
    assert.deepEqual(loaded.world.generated,world.generated);
   }
});

test('v2 stays byte-for-byte deterministic with no additional road or ridge fields',()=>{
 for(const version of [23,26]){
  const old=new World(2026,version,'rocky',0,2);
  const again=new World(2026,version,'rocky',0,2);
  assert.deepEqual(old.generated,again.generated);
  assert.equal(old.generated.roads,undefined);
  assert.equal(old.generated.ridges.length,0);
 }
});
