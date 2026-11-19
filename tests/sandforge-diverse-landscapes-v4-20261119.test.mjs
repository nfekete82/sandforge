import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {streamSeed} from '../dist/src/reborn/battlefield-terrain.js';
import {LANDSCAPE_LABELS,generateLandscapeNetwork} from '../dist/src/reborn/landscape-network.js';

const expected=['open-basin','broken-escarpment','diagonal-ridge','serpentine-canyon'];
const seeds=new Map();
for(let i=1;i<300&&seeds.size!==4;i++){
 const kind=expected[streamSeed(i,'landscape-archetype')%4];
 if(!seeds.has(kind))seeds.set(kind,i);
}

test('new generator exposes all four deterministic, visibly distinct map archetypes',()=>{
 assert.equal(seeds.size,4,'four public landscape archetypes can be found');
 for(const kind of expected){
  assert.ok(LANDSCAPE_LABELS[kind]?.length>4);
  const seed=seeds.get(kind),world=new World(seed,24,'mixed',0,4);
  assert.equal(world.generatorVersion,4);
  assert.equal(world.generated?.landscapeKind,kind);
  assert.equal(world.generated?.battlefield.generatorVersion,4);
  assert.equal(world.validation?.valid,true,JSON.stringify({seed,kind,
   errors:world.validation?.errors,candidate:world.validation?.candidate}));
  assert.equal(world.generated.roads.length,world.generated.corridors.length);
  assert.equal(world.generated.mesas.length,0,'no boulders that block building');
  assert.equal(world.generated.ridges.length,kind==='open-basin'?0:1);
  if(kind!=='open-basin')assert.ok(world.generated.ridges[0].ramps.length>=1);
  assert.ok(world.validation.tankReachableSites===world.generated.sites.length);
  assert.ok(world.validation.buildAreaSamples.every(n=>n>=65));
 }
});

test('v4 landscape identities alter mountain footprint, pass count and road topology',()=>{
 const maps=Object.fromEntries([...seeds].map(([kind,seed])=>[
  kind,new World(seed,24,'mixed',0,4).generated
 ]));
 assert.equal(maps['open-basin'].ridges.length,0);
 assert.equal(maps['broken-escarpment'].ridges[0].ramps.length,1);
 assert.equal(maps['diagonal-ridge'].ridges[0].ramps.length,2);
 assert.equal(maps['serpentine-canyon'].ridges[0].ramps.length,3);
 const points=k=>maps[k].roads.map(road=>road.map(p=>
  [Math.round(p.x/100),Math.round(p.y/100)]));
 assert.notDeepEqual(points('open-basin'),points('serpentine-canyon'));
 assert.notDeepEqual(points('broken-escarpment'),points('diagonal-ridge'));
 assert.notDeepEqual(maps['open-basin'].sites,maps['diagonal-ridge'].sites);
});

test('v4 is deterministic across regenerations and fallback candidate stability',()=>{
 for(const [kind,seed] of seeds){
  const a=new World(seed,24,'mixed',0,4),b=new World(seed,24,'mixed',0,4);
  assert.equal(a.generated.landscapeKind,kind);
  assert.deepEqual(a.generated.sites,b.generated.sites);
  assert.deepEqual(a.generated.ridges,b.generated.ridges);
  assert.deepEqual(a.generated.roads,b.generated.roads);
  assert.deepEqual(a.generated.battlefield.heights,b.generated.battlefield.heights);
 }
});

test('existing generator-v3 and earlier maps never adopt v4 terrain identities',()=>{
 const seed=824836862;
 const old=new World(seed,24,'mixed',0,3);
 const modern=new World(seed,24,'mixed',0,4);
 assert.equal(old.generated.battlefield.generatorVersion,3);
 assert.equal(old.generated.landscapeKind,undefined);
 assert.equal(old.generated.ridges.length,1);
 assert.equal(modern.generated.battlefield.generatorVersion,4);
 assert.notDeepEqual(old.generated.sites,modern.generated.sites);
 const classic=new World(seed,24,'mixed',0,2);
 assert.equal(classic.generated.ridges.length,0);
 assert.equal(classic.generated.roads,undefined);
});

test('new varied maps save and restore their exact matching terrain geometry',()=>{
 const seed=seeds.get('serpentine-canyon');
 const game=Simulation.campaign(seed,24,'mixed',4);
 const save=game.save();
 assert.equal(save.generatorVersion,4);
 const restored=Simulation.load(save);
 assert.equal(restored.world.generatorVersion,4);
 assert.equal(restored.world.generated.landscapeKind,'serpentine-canyon');
 assert.deepEqual(restored.world.generated.sites,game.world.generated.sites);
 assert.deepEqual(restored.world.generated.ridges,game.world.generated.ridges);
});

test('new WebGL matches v4 default; historic saves and explicit classic remain selectable',()=>{
 const src=readFileSync('scripts/webgl-preview.js','utf8');
 assert.match(src,/query\.get\('landscape'\)==='classic'\?2/);
 assert.match(src,/query\.get\('landscape'\)==='network-v3'\?3:4/);
 assert.match(src,/terrain\.battlefield\?\.generatorVersion>=3\?/);
 assert.ok(src.includes('const game=session??Simulation.campaign'));
});
