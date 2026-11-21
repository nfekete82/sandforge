import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import '../scripts/webgl-desert-maps.js';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';
import {selectDesertAIDoctrine,DESERT_AI_DOCTRINES,fixedDesertLateAirSupport} from '../dist/src/reborn/desert-ai-doctrine.js';

const catalog=globalThis.SandforgeDesertMaps;
const classicMaps=catalog.maps.filter(map=>['desert-strike','broken-empire','burning-horizon','last-stronghold'].includes(map.id));
const geometryHash=world=>createHash('sha256')
 .update(JSON.stringify(world.generated.sites))
 .update(JSON.stringify(world.generated.ridges))
 .update(JSON.stringify(world.generated.roads))
 .update(world.generated.battlefield.heights)
 .update(world.blocked)
 .digest('hex');

test('four original maps retain their identity; the five existing maps now use v9 expanded highlands',()=>{
 assert.equal(classicMaps.length,4);
 assert.equal(catalog.maps.length,6);
 const custom=catalog.byId('plateau-crossroads');
 assert.equal(custom.generatorVersion,9);
 assert.equal(custom.kind,'plateau-crossroads');
 assert.equal(custom.bastions,16);
 assert.deepEqual(classicMaps.map(x=>x.id),[
  'desert-strike','broken-empire','burning-horizon','last-stronghold']);
 assert.deepEqual(classicMaps.map(x=>x.name),[
  'Desert Strike','Broken Empire','Burning Horizon','Last Stronghold']);
 assert.deepEqual(classicMaps.map(x=>x.inspiration),[
  'Tournament Desert','Fallen Empire','Twilight Flame','Defcon 6']);
 assert.deepEqual(classicMaps.map(x=>x.kind),[
  'open-basin','broken-escarpment','diagonal-ridge','serpentine-canyon']);
 assert.equal(new Set(catalog.maps.map(x=>x.seed)).size,6);
 for(const map of classicMaps){
  assert.equal(map.generatorVersion,9,'v9 enlarged plateaus are the new match default');
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
 assert.equal(world.generatorVersion,map.generatorVersion);
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
 assert.equal(loaded.world.generatorVersion,map.generatorVersion);
 assert.equal(geometryHash(loaded.world),geometryHash(world),
  'existing savegame geometry must be byte-for-byte unchanged');
});

for(const map of catalog.maps.filter(p=>p.generatorVersion===9&&p.kind!=='open-basin'))test(
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

test('historical v4 and v5 maps retain their old geometry even after v9 highlands',()=>{
 const p=catalog.byId('last-stronghold'),old=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
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
 for(const [i,p] of classicMaps.entries()){
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
  if(p.id==='burning-horizon')assert.equal(
   selectDesertAIDoctrine({...p,profile:p.terrain,generatorVersion:4})?.mode,
   'coordinated','Burning Horizon historical v4 doctrine remains');
  else assert.equal(
   selectDesertAIDoctrine({...p,profile:p.terrain,generatorVersion:4}),null,
   'historical unmatched v4 doctrine remains disabled');
 }
});

test('paid late-game air support survives the offensive ground doctrine only on fixed Last Stronghold',()=>{
 for(const p of catalog.maps){
  const g=Simulation.campaign(p.seed,p.mapVersion,p.terrain,p.generatorVersion);
  const eligible=fixedDesertLateAirSupport(
   selectDesertAIDoctrine({
    seed:g.seed,mapVersion:g.world.mapVersion,
    profile:g.world.generated.battlefield.profile,
    kind:g.world.generated.landscapeKind,
    generatorVersion:g.world.generatorVersion
   }),g.tactical.ai37Mode==='coordinated');
  assert.equal(g.tactical.lateAirSupportEnabled,eligible,p.name);
  if(p.id==='last-stronghold'){
   assert.equal(g.tactical.ai37Mode,'off');
   assert.equal(eligible,true,'attack doctrine must still guide already-paid R-01 and bombers');
  }
  if(p.id==='desert-strike')assert.equal(eligible,false,
   'no unauthorized late-air change on the small open map');
 }
 const p=catalog.maps.find(p=>p.id==='last-stronghold');
 const historic=Simulation.campaign(p.seed,p.mapVersion,p.terrain,4);
 historic.tactical.ai37Mode='off';
 assert.equal(historic.tactical.lateAirSupportEnabled,false,
  'offensive support exception must not leak into old v4 saves');
 assert.equal(fixedDesertLateAirSupport(null,false),false,
  'unknown maps never get free air-support privileges');
});

test('main menu offers the six original and authored desert maps',()=>{
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
 assert.equal((html.match(/<option value="(?:desert-strike|broken-empire|burning-horizon|last-stronghold|plateau-crossroads|mesa-highlands)"/g)||[]).length,6);
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
