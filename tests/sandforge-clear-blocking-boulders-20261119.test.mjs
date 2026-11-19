import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {World} from '../dist/src/reborn/world.js';

test('modern procedural maps produce no isolated physical mesas at any profile or generator',()=>{
 for(const version of [23,26])
  for(const generator of [2,3])
   for(const profile of ['open','rocky','mixed'])
    for(const seed of [0,2077]){
     const world=new World(seed,version,profile,0,generator);
     assert.equal(world.validation?.valid,true,`${version}/${generator}/${profile}/${seed}: ${JSON.stringify(world.validation)}`);
     assert.deepEqual(world.generated.mesas,[],`${version}/${generator}/${profile}/${seed}: generated isolated boulders`);
     assert.deepEqual(world.rocks,[],`${version}/${generator}/${profile}/${seed}: collision boulders remain`);
     assert.ok(world.generated.sites.every(p=>world.walkable(p,[],32)),'all Bastions must remain accessible');
     if(generator===2){
      assert.equal(world.generated.ridges.length,0,'v2 does not add canyon ridges');
      assert.ok(world.cliffIds.every(id=>id<0),'no hidden physical boulder cliff cells');
     }else{
      assert.ok(world.generated.ridges.length>0,'mountain ridges and tactical ramps remain');
     }
    }
});

test('pre-v23 historical maps retain their authored rock collision geometry',()=>{
 for(const version of [19,22]){
  const world=new World(2026,version);
  assert.ok(world.generated.mesas.length>0,'legacy maps retain physical rocks');
  assert.equal(world.rocks.length,world.generated.mesas.length);
 }
});

test('modern desert does not recreate rock meshes or visual boulder scatter',()=>{
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const environment=readFileSync('scripts/webgl-environment.js','utf8');
 const generation=readFileSync('src/reborn/world-generation.ts','utf8');
 assert.ok(generation.includes('const mesaTarget=modern?0:'));
 assert.ok(preview.includes('if(terrain.battlefield&&terrain.mesas.length)addBattlefieldRocks'));
 assert.ok(preview.includes("spacious&&biome==='desert'?0:spacious?420:1600"));
 assert.ok(environment.includes("if(!(biome==='desert'&&world.mapVersion>=23))this.addDebris()"));
});
