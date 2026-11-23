import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 flameJetEndpoints,FLAME_JET_NOZZLE_OFFSET,FLAME_JET_LIFETIME
} from '../scripts/webgl-flame-jet.js';

test('fire ribbon starts at the barrel and terminates on the targeted soldier',()=>{
 const source={x:1000,y:1000},target={x:1210,y:1000};
 const jet=flameJetEndpoints(source,target,15,18,4096);
 assert.ok(jet);
 assert.equal(jet.range,210);
 assert.equal(jet.offset,FLAME_JET_NOZZLE_OFFSET);
 assert.equal(jet.x0,1000+FLAME_JET_NOZZLE_OFFSET-2048);
 assert.equal(jet.z0,1000-2048);
 assert.equal(jet.x1,1210-2048);
 assert.equal(jet.z1,1000-2048);
 assert.equal(jet.y0,44);
 assert.equal(jet.y1,36);
 assert.ok(FLAME_JET_LIFETIME>.25,'plume overlaps successive volleys');
});

test('short fire jets start within range; zero-length shots spawn no geometry',()=>{
 assert.equal(flameJetEndpoints({x:9,y:7},{x:9,y:7},0,0,100),null);
 const jet=flameJetEndpoints({x:10,y:10},{x:30,y:10},0,0,100);
 assert.ok(jet);
 assert.ok(jet.offset<jet.range);
 assert.ok(jet.x0<jet.x1);
});
