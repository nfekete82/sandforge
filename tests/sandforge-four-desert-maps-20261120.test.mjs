import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import '../scripts/webgl-desert-maps.js';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';
import {selectDesertAIDoctrine,DESERT_AI_DOCTRINES} from '../dist/src/reborn/desert-ai-doctrine.js';

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
  assert.equal(map.generatorVersion,5,'fixed desert maps must have driveable v5 pass grading');
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
 assert.equal(world.generatorVersion,5);
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
 assert.equal(loaded.world.generatorVersion,5);
 assert.equal(geometryHash(loaded.world),geometryHash(world),
  'existing savegame geometry must be byte-for-byte unchanged');
});

for(const map of catalog.maps.filter(p=>p.kind!=='open-basin'))test(
 map.name+': all real mountain passes are physically driveable by paid ground vehicles',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world,ridge=world.generated.ridges[0];
 assert.ok(ridge?.ramps.length,'missing fixed mountain crossings');
 for(const pass of ridge.ramps)for(const kind of ['rover','tank','artillery']){
  const clearance=Math.max(0,UNITS[kind].radius-10);
  const slope=kind==='tank'?.215:kind==='artillery'?.185:.195;
  const crossing={x:pass.x,y:ridgeHeightAtX(ridge,pass.x)};
  assert.ok(world.walkable(crossing,[],clearance),
   map.name+' '+kind+' impassable ramp '+pass.x);
  assert.ok(world.groundVehicleSlopeSafe(crossing,slope,clearance+10),
   map.name+' '+kind+' has an undriveable visual pass '+pass.x);
  const offset=ridge.width*.5+210;
  const before={x:crossing.x,y:crossing.y-offset};
  const after={x:crossing.x,y:crossing.y+offset};
  const route=world.path(before,after,[],clearance,undefined,false,false,false,slope);
  assert.ok(route.length&&Math.hypot(route.at(-1).x-after.x,
    route.at(-1).y-after.y)<world.cell*1.4,
   map.name+' '+kind+' physically cannot cross pass '+pass.x);
 }
});

test('historical v4 saves remain untouched after grading only new v5 fixed maps',()=>{
 const p=catalog.maps.at(-1),old=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
 const version5=Simulation.campaign(p.seed,p.mapVersion,p.terrain,5);
 assert.equal(old.world.generatorVersion,4);
 assert.equal(version5.world.generatorVersion,5);
 assert.notEqual(geometryHash(old.world),geometryHash(version5.world),
  'v5 must actually correct old mountain ramp slopes');
 const oldLoad=Simulation.load(old.save());
 assert.equal(oldLoad.world.generatorVersion,4);
 assert.equal(geometryHash(oldLoad.world),geometryHash(old.world));
});

test('four map-specific AI doctrines are calibrated from paid A/B results',()=>{
 assert.equal(DESERT_AI_DOCTRINES.length,4);
 const expected=['off','coordinated','coordinated','off'];
 for(const [i,p] of catalog.maps.entries()){
  const world=Simulation.campaign(p.seed,p.mapVersion,p.terrain,p.generatorVersion);
  assert.equal(world.tactical.ai37Mode,expected[i],p.name+' doctrine');
  const match=selectDesertAIDoctrine({
   seed:p.seed,mapVersion:p.mapVersion,profile:p.terrain,kind:p.kind,
   generatorVersion:p.generatorVersion
  });
  assert.equal(match?.id,p.id);
  const restored=Simulation.load(world.save());
  assert.equal(restored.tactical.ai37Mode,expected[i],
   'saving cannot change the same battlefield AI doctrine');
  assert.equal(selectDesertAIDoctrine({...p,seed:p.seed+1,profile:p.terrain}),null);
  assert.equal(selectDesertAIDoctrine({...p,profile:p.terrain,generatorVersion:4}),null,
   'old v4 AI and historical battle balance must remain unchanged');
 }
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
