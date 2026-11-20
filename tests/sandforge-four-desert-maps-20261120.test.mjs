import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import '../scripts/webgl-desert-maps.js';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';

const catalog=globalThis.SandforgeDesertMaps;
const geometryHash=world=>createHash('sha256')
 .update(JSON.stringify(world.generated.sites))
 .update(JSON.stringify(world.generated.ridges))
 .update(JSON.stringify(world.generated.roads))
 .update(world.generated.battlefield.heights)
 .update(world.blocked)
 .digest('hex');

test('exactly four named original v4 desert maps, with C&C-inspired doctrines',()=>{
 assert.equal(catalog.maps.length,4);
 assert.deepEqual(catalog.maps.map(x=>x.id),[
  'desert-strike','broken-empire','burning-horizon','last-stronghold']);
 assert.deepEqual(catalog.maps.map(x=>x.name),[
  'Desert Strike','Broken Empire','Burning Horizon','Last Stronghold']);
 assert.deepEqual(catalog.maps.map(x=>x.inspiration),[
  'Tournament Desert','Fallen Empire','Twilight Flame','Defcon 6']);
 assert.deepEqual(catalog.maps.map(x=>x.kind),[
  'open-basin','broken-escarpment','diagonal-ridge','serpentine-canyon']);
 assert.equal(new Set(catalog.maps.map(x=>x.seed)).size,4);
 for(const map of catalog.maps){
  assert.equal(map.generatorVersion,4,'do not switch to the earlier v5 experimental terrain');
  assert.equal(map.biome,'desert','only original desert graphics');
  assert.ok(Object.isFrozen(map),'locked battlefields are immutable');
  assert.ok(catalog.matches(map,{...map,terrain:map.terrain,kind:map.kind}));
  assert.ok(!catalog.matches(map,{...map,seed:map.seed+1}));
  assert.ok(!catalog.matches(map,{...map,biome:'jungle'}));
 }
 assert.equal(catalog.byId('not-a-map'),null);
});

for(const map of catalog.maps)test(map.name+': playable fair deterministic original map and save/load',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world;
 assert.equal(world.generatorVersion,4);
 assert.equal(world.generated.landscapeKind,map.kind);
 assert.equal(world.generated.battlefield.profile,map.terrain);
 assert.equal(world.validation?.valid,true,JSON.stringify(world.validation));
 assert.equal(game.territories.length,map.bastions);
 assert.equal(world.validation?.reachableSites,map.bastions);
 assert.equal(world.validation?.tankReachableSites,map.bastions);
 assert.equal(game.income(0),game.income(1),'initial economy should be fair');
 const next=new World(map.seed,map.mapVersion,map.terrain,0,map.generatorVersion);
 assert.equal(geometryHash(world),geometryHash(next),
  'same map seed should reproduce the same scenery and routes');
 const loaded=Simulation.load(game.save());
 assert.equal(loaded.world.generatorVersion,4);
 assert.equal(geometryHash(loaded.world),geometryHash(world),
  'existing savegame geometry must be byte-for-byte unchanged');
});

test('main menu contains only the four desert maps, locked to the existing renderer',()=>{
 const html=readFileSync('webgl-preview.html','utf8');
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const renderer=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(html,/id="sf3d-desert-map"/);
 assert.match(html,/src="\/webgl-desert-maps\.js"/);
 for(const map of catalog.maps){
  assert.match(html,new RegExp('value="'+map.id+'"'));
  assert.match(html,new RegExp(map.name.toUpperCase()));
 }
 assert.equal((html.match(/<option value="(?:desert-strike|broken-empire|burning-horizon|last-stronghold)"/g)||[]).length,4);
 assert.doesNotMatch(html,/id="sf3d-biome"/);
 assert.doesNotMatch(html,/id="sf3d-terrain"/);
 assert.doesNotMatch(html,/id="sf3d-landscape"/);
 assert.doesNotMatch(html,/id="sf3d-map-size"/);
 assert.match(menu,/play\(map\.bastions,map\.seed/);
 assert.match(menu,/biome:'desert'/);
 assert.match(menu,/mapId:map\.id/);
 assert.match(renderer,/SandforgeDesertMaps\?\.matches/);
 assert.match(renderer,/desertMapId:desertMap\?\.id/);
 assert.match(build,/cpSync\('scripts\/webgl-desert-maps\.js'/);
 assert.doesNotMatch(renderer,/createCuratedMapArt|CURATED_PALETTES/);
 assert.match(renderer,/installDesertSandPBR/,'keep existing premium sand shading');
});
