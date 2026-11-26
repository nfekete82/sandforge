import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {World} from '../dist/src/reborn/world.js';
import {RULES} from '../dist/src/reborn/config.js';
import {readFileSync} from 'node:fs';

function openWorld(version=3){
 const w=new World(2026,version);
 w.blocked.fill(0);
 w.opaque.fill(0);
 w.cliffIds.fill(-1);
 w.components.fill(0);
 return w;
}
const cell=(w,x,y)=>({x:(x+.5)*w.cell,y:(y+.5)*w.cell});
const route=(w,from,to,limit=Infinity)=>w.path(from,to,[],6,undefined,false,true,false,limit);

test('A* returns identical routes during repeated path requests and after profiler toggles',()=>{
 const w=openWorld();
 for(let y=65;y<=174;y++)w.blocked[y*RULES.grid+121]=1;
 const from=cell(w,42,120),to=cell(w,191,120);
 const reference=route(w,from,to);
 assert.ok(reference.length>1,'blocked direct route forces actual A*');
 for(let i=0;i<6;i++){
  w.profilePaths=(i%2)===0;
  assert.deepEqual(route(w,from,to),reference,
    'sparse epoch workspace must not leak path nodes between calls');
 }
 assert.ok(w.pathCalls>0);
});

test('A* workspace never caches stale obstacles after pathfinding changes mid-game',()=>{
 const w=openWorld();
 const from=cell(w,34,118),to=cell(w,198,118);
 w.blocked[118*RULES.grid+118]=1;
 const before=route(w,from,to);
 assert.ok(before.length>0);
 w.blocked.fill(0);
 const after=route(w,from,to);
 assert.deepEqual(after,[to],'destroyed wall unlocks direct move immediately');
 w.blocked[118*RULES.grid+118]=1;
 assert.deepEqual(route(w,from,to),before,
  'rebuilding wall restores the same route, no persistent stale memoization');
});

test('slope checks apply identically when the debug performance overlay enables profiling',()=>{
 const w=openWorld(24);
 assert.ok(w.generated?.battlefield);
 w.terrainSlope=(x,y)=>x>1500&&x<1810?.36:.03;
 w.terrainHeight=(x,y)=>Math.max(0,Math.min(65,(x-1500)*.36));
 const from={x:1000,y:1700},to={x:2210,y:1700};
 const unrestricted=route(w,from,to,Infinity);
 assert.ok(unrestricted.length,'unrestricted flight-like ground search remains traversable');
 w.profilePaths=false;
 const blocked=route(w,from,to,.215);
 assert.equal(blocked.length,0,'a whole-map vertical cliff strip is impassable for a tank');
 w.profilePaths=true;
 assert.deepEqual(route(w,from,to,.215),blocked,
  'profiling MUST NOT disable vehicle slope checks');
});

test('bounded A* performance does not allocate full 57,600-cell clear buffers per route',()=>{
 const source=readFileSync('src/reborn/world.ts','utf8');
 assert.match(source,/private pathEpoch=0/);
 assert.match(source,/seen:new Uint32Array\(n\),walkEpoch:new Uint32Array\(n\)/);
 assert.match(source,/const cellCost=\(i:number\)=>seen\[i\]===epoch/);
 assert.doesNotMatch(source,/costs\.fill\(Infinity\);prev\.fill\(-1\);closed\.fill\(0\)/);
 assert.match(source,/allowPartial,maxSlope,mesaLane\);\}/);
});

test('stability: repeated measured path queries do not grow the workspace each tick',()=>{
 const w=openWorld();
 const a=cell(w,38,90),b=cell(w,185,155);
 // Create a short but non-direct passage to force the reusable A* buffers.
 for(let y=88;y<165;y++)w.blocked[y*RULES.grid+121]=1;
 const at=performance.now();
 for(let i=0;i<18;i++){
  const target=i%2?a:b,origin=i%2?b:a;
  const result=route(w,origin,target);
  assert.ok(Array.isArray(result));
  assert.ok(result.length>0);
 }
 const ms=performance.now()-at;
 const workspace=w.pathWorkspace;
 assert.ok(workspace?.costs instanceof Float64Array);
 assert.equal(workspace.costs.length,RULES.grid**2);
 assert.ok(workspace.seen instanceof Uint32Array);
 assert.ok(workspace.walkEpoch instanceof Uint32Array);
 console.log('A* 18 queued route searches completed in '+ms.toFixed(1)+' ms');
});
