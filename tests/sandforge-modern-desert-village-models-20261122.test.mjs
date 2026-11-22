import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../scripts/webgl-desert-maps.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {planDesertVillages,OASIS_VILLAGE_MODELS}
 from '../scripts/webgl-desert-village.js';

test('Desert Strike v10 villages select three distinct PBR adobe models, not canyon huts',()=>{
 const preset=globalThis.SandforgeDesertMaps.byId('desert-strike');
 const g=Simulation.campaign(preset.seed,preset.mapVersion,preset.terrain,preset.generatorVersion);
 const villages=planDesertVillages({world:g.world,terrain:g.world.generated,seed:preset.seed});
 assert.ok(villages.length>0,'missing seeded test settlement');
 for(const village of villages){
  const names=village.houses.map(h=>h.kind);
  assert.deepEqual(names,['main_house','courtyard_house','ruin_house']);
  assert.deepEqual(village.houses.map(h=>h.variant),[0,2,4]);
  assert.ok(village.houses.every(h=>h.tint>.9&&h.tint<1.02));
 }
 assert.equal(OASIS_VILLAGE_MODELS.length,6);
});

test('real village renderer loads modern adobe GLBs and preserves historic canyon sources',()=>{
 const code=readFileSync('scripts/webgl-desert-village.js','utf8');
 assert.match(code,/const modernAdobe=world\.generatorVersion>=10/);
 assert.match(code,/const modelUrls=oasisStyle\|\|modernAdobe\?OASIS_VILLAGE_MODELS:DESERT_VILLAGE_MODELS/);
 assert.match(code,/if\(!oasisStyle&&!modernAdobe\)weatherModel/);
 assert.match(code,/variant:modernAdobe\?adobeVariants\[i\]:i===2\?1:0/);
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/generate-oasis-adobe-glbs\.mjs/);
});
