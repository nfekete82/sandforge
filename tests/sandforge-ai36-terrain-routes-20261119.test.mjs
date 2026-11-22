import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {terrainAwareTravelEstimate,rankTerrainRecaptureSquad,ridgeHeightAtX}
 from '../dist/src/reborn/ai36-terrain-routes.js';

const ridge={
 spine:[{x:-1200,y:0},{x:0,y:0},{x:1200,y:0}],
 width:118,height:122,ramps:[{x:0,width:350}],
 clearings:[]
};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('KI3.6 avoids choosing a deceptively close infantry squad behind an impassable ridge',()=>{
 const target={x:0,y:320};
 const closeButDetoured={id:10,x:950,y:-70};
 const fartherButFast={id:11,x:0,y:-980};
 assert.ok(dist(closeButDetoured,target)<dist(fartherButFast,target),
  'geometric straight-line order would prefer the wrong soldier');
 assert.ok(terrainAwareTravelEstimate(closeButDetoured,target,[ridge])>
  terrainAwareTravelEstimate(fartherButFast,target,[ridge]));
 assert.deepEqual(rankTerrainRecaptureSquad(
  [closeButDetoured,fartherButFast],target,[ridge],1).map(u=>u.id),[11]);
});

test('terrain recapture stays deterministic, neutral on same side, and never reads hidden enemies',()=>{
 const target={x:200,y:250};
 const allies=[
  {id:7,x:-300,y:100},
  {id:8,x:300,y:150},
  {id:9,x:50,y:-800},
  {id:3,x:300,y:150}
 ];
 assert.equal(ridgeHeightAtX(ridge,25),0);
 assert.equal(terrainAwareTravelEstimate({x:300,y:200},target,[ridge]),
  dist({x:300,y:200},target),'same side needs no mountain penalty');
 assert.equal(terrainAwareTravelEstimate(allies[2],target,[]),
  dist(allies[2],target),'old map without ridges is unchanged');
 const openPassA={x:0,y:-600},openPassB={x:0,y:550};
 assert.equal(terrainAwareTravelEstimate(openPassA,openPassB,[ridge]),
  dist(openPassA,openPassB),'true crossing at a mountain pass needs no detour');
 const outsideA={x:1800,y:-220},outsideB={x:1800,y:350};
 assert.equal(terrainAwareTravelEstimate(outsideA,outsideB,[ridge]),
  dist(outsideA,outsideB),'walking around the ridge tip needs no pass detour');
 const previous=rankTerrainRecaptureSquad(allies,target,[ridge],3).map(u=>u.id);
 assert.deepEqual(previous,rankTerrainRecaptureSquad(
  allies.slice().reverse(),target,[ridge],3).map(u=>u.id));
 assert.equal(new Set(previous).size,3);
 const source=readFileSync('src/reborn/ai36-terrain-routes.ts','utf8');
 assert.doesNotMatch(source,/canSee\(|memories\[|\.owner|\.hp/);
});

test('real v3 random battlefields have pass-aware finite estimates and preserve playable paths',()=>{
 for(const version of [24,26])
  for(const seed of [2077,42102026]){
   const game=Simulation.campaign(seed,version,'mixed',3);
   const world=game.world,ridges=world.generated.ridges;
   assert.equal(world.validation?.valid,true);
   assert.equal(ridges.length,1);
   assert.ok(ridges[0].ramps.length>=2);
   const sites=world.generated.sites;
   const a=sites[0],b=sites[sites.length-1],baseline=dist(a,b);
   const estimate=terrainAwareTravelEstimate(a,b,ridges);
   assert.ok(Number.isFinite(estimate)&&estimate>=baseline);
   for(const pass of ridges[0].ramps){
    const x=pass.x,y=ridgeHeightAtX(ridges[0],x);
    assert.ok(world.walkable({x,y},[],5),'physical pass remains accessible');
   }
  }
});

test('AI36 terrain route ranking is an opt-in v3-only policy, no save schema changes',()=>{
 const source=readFileSync('src/reborn/tactical-ai.ts','utf8');
 assert.match(source,/g\.world\.generatorVersion===3\s*\?rankTerrainRecaptureSquad/);
 assert.match(source,/:near\.slice\(0,readiness\)/);
 const game=Simulation.campaign(3123,24,'mixed',2);
 assert.equal(game.world.generatorVersion,2);
 assert.equal(game.tactical.ai36Mode,'coordinated');
 assert.equal(JSON.stringify(game.save()).includes('terrainAwareTravelEstimate'),false);
});
