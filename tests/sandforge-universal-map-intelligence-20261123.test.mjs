import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignLayout} from '../dist/src/reborn/config.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {analyzePublicTopology,rankPublicFronts} from '../dist/src/reborn/map-intelligence.js';

const make=(id,owner,x,neighbors,income=20)=>({
 id,owner,point:{x,y:100},neighbors,income
});
const sectors=[
 make(0,1,0,[1,2]),make(1,-1,110,[0,3]),
 make(2,-1,210,[0,3]),make(3,0,350,[0,1,2,4]),
 make(4,0,470,[3])
];
const origin={x:0,y:100};

test('Topological frontier comes ONLY from public Bastion graph',()=>{
 const graph=analyzePublicTopology(sectors);
 assert.equal(graph[1].blueLinks,1);
 assert.equal(graph[1].redLinks,1);
 assert.equal(graph[1].gateway,true);
 assert.equal(graph[2].gateway,true);
 assert.equal(graph[0].neutralLinks,2);
 assert.equal(graph[4].fewExits,true);
 assert.equal(graph[4].redLinks,0);
});

test('Real routes beat straight-line shortcuts through cliffs',()=>{
 const paths=new Map([[110,{length:370,risk:0}],
  [210,{length:290,risk:1}],[350,{length:500,risk:0}]]);
 const run=(blueOwned=1,knownThreat=()=>false)=>
  rankPublicFronts({sectors,origin,worldSize:1500,blueOwned,
   route:p=>paths.get(p.x),knownThreat,maxPaths:12});
 const first=run();
 assert.equal(first[0].sector.id,2,
  'nearest Euclidean target is not the best physically reachable front');
 assert.ok(!first.some(t=>t.sector.owner===0),
  'one first BLUE Bastion must not trigger a HQ rush');
 assert.equal(first[0].topology.gateway,true);
 assert.equal(run(1,t=>t.id===2)[0].sector.id,1,
  'known danger must exclude an otherwise attractive public front');
 assert.ok(run(2).some(t=>t.sector.owner===0&&t.sector.id===3),
  'a genuinely contested public BLUE frontier is available later');
});

test('Unreachable, high-risk or physically excessive detours are rejected',()=>{
 const routes=new Map([[110,{length:5000,risk:0}],
  [210,{length:250,risk:8}],[350,{length:400,risk:0}]]);
 const query=blueOwned=>rankPublicFronts({sectors,origin,worldSize:1500,
  blueOwned,route:p=>routes.get(p.x),knownThreat:()=>false});
 assert.deepEqual(query(1),[]);
 assert.deepEqual(query(2).map(v=>v.sector.id),[3]);
 assert.deepEqual(rankPublicFronts({sectors,origin,worldSize:1500,
  blueOwned:2,route:()=>undefined,knownThreat:()=>false}),[]);
});

test('Unknown map and seed names are irrelevant; deterministic ID tie-break',()=>{
 const a=make(7,-1,300,[10,11]),b=make(4,-1,300,[10,11]),
  red=make(10,1,0,[7,4]),blue=make(11,0,480,[7,4]);
 const x=rankPublicFronts({sectors:[a,b,red,blue],origin,worldSize:1800,
  blueOwned:1,knownThreat:()=>false,route:()=>({length:330,risk:0})});
 assert.deepEqual(x.map(v=>v.sector.id),[4,7]);
 assert.deepEqual(x.map(v=>v.score),[x[0].score,x[0].score]);
});

test('Procedural seeds vary terrain and actual starting corners while same seed reproduces',()=>{
 const seeds=[1907,1908,1911,1916];
 const corners=new Set(seeds.map(seed=>campaignLayout(26,seed).headquarters.join(':')));
 assert.ok(corners.size>=2,'seed selection must cover several start corners');
 const a=Simulation.campaign(seeds[0],24,'oasis',10);
 const b=Simulation.campaign(seeds[1],24,'oasis',10);
 const duplicate=Simulation.campaign(seeds[0],24,'oasis',10);
 assert.equal(a.territories.length,8);
 assert.equal(b.territories.length,8);
 const signature=g=>g.territories.map(t=>[Math.round(t.point.x),Math.round(t.point.y)]);
 assert.deepEqual(signature(a),signature(duplicate),
  'repeatable generated terrain, not random hidden magic');
 assert.notDeepEqual(signature(a),signature(b),
  'unseen seed produces a new battlefield geometry');
 assert.deepEqual(a.startRegions,duplicate.startRegions,
  'repeatable actual HQ-less starting positions');
 assert.deepEqual(a.territories.map(t=>t.owner),duplicate.territories.map(t=>t.owner));
 for(const g of [a,b]){
  assert.equal(g.needsHeadquarters(0),true);
  assert.equal(g.needsHeadquarters(1),true);
  assert.equal(g.units.filter(u=>u.owner===0&&u.kind==='infantry').length,1);
  assert.equal(g.units.filter(u=>u.owner===1&&u.kind==='infantry').length,1);
 }
});
