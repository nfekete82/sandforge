import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/src/reborn/simulation.js';

/** A* heap ties are semantically significant because waypoint choices
 * influence finite-sim ticks and AI campaigns. The paired GitHub test
 * separately asserts that complete game states match unmodified main. */
test('new heap keeps identical A* output across repeated seeded low-risk, risk and partial queries',()=>{
 for(const [seed,version,terrain,gen] of [
  [9999,24,'oasis',10],[2026,25,'rocky',10],[1907,26,'dunes',10]
 ]){
  const g=Simulation.campaign(seed,version,terrain,gen),world=g.world;
  const sites=g.territories.map(t=>t.point);
  const samples=[
   [sites[0],sites[Math.floor(sites.length/2)]],
   [sites[sites.length-1],sites[1]],
   [sites[1],sites[sites.length-2]]
  ];
  const risk=new Float32Array(world.blocked.length);
  for(let n=0;n<risk.length;n++)if(n%37===0)risk[n]=.75;
  for(const [start,goal] of samples)for(const withRisk of [false,true]){
   const args=[start,goal,[],5,withRisk?risk:undefined,false,false,false];
   const baseline=world.path(...args);
   for(let repeated=0;repeated<4;repeated++)
    assert.deepEqual(world.path(...args),baseline,
     'search tie order must be deterministic '+[seed,version,withRisk,repeated]);
   const partial=world.path(start,goal,[],5,undefined,false,false,true);
   for(let repeated=0;repeated<3;repeated++)
    assert.deepEqual(world.path(start,goal,[],5,undefined,false,false,true),partial);
  }
 }
});
test('heap algorithm no longer allocates {i,f} per A* OPEN insert',()=>{
 const source=await import('node:fs').then(fs=>fs.readFileSync('src/reborn/world.ts','utf8'));
 assert.match(source,/const heapIndex:number\[\]=\[\],heapPriority:number\[\]=\[\]/);
 assert.doesNotMatch(source,/push\(\{i:j,f:g\+h\(j\)\}\)/);
});
