import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import '../scripts/webgl-map-presets.js';
import {World} from '../dist/src/reborn/world.js';
import {Simulation} from '../dist/src/reborn/simulation.js';
import {UNITS} from '../dist/src/reborn/catalog.js';
import {ridgeHeightAtX} from '../dist/src/reborn/ai36-terrain-routes.js';

const catalog=globalThis.SandforgeMapPresets;
const signature=w=>createHash('sha256')
 .update(JSON.stringify(w.generated.sites))
 .update(JSON.stringify(w.generated.ridges))
 .update(w.generated.battlefield.heights)
 .update(w.blocked)
 .digest('hex');

test('exactly three distinct named tactical maps and optional random map',()=>{
 assert.deepEqual(catalog.list.map(p=>p.id),[
  'staubkrone','frostpforte','schlangenfeste']);
 assert.equal(new Set(catalog.list.map(p=>p.seed)).size,3);
 assert.deepEqual(catalog.list.map(p=>p.bastions),[8,12,16]);
 assert.deepEqual(catalog.list.map(p=>p.archetype),[
  'open-basin','broken-escarpment','serpentine-canyon']);
 assert.deepEqual(catalog.list.map(p=>p.biome),['desert','snow','jungle']);
 assert.equal(catalog.byId('unknown'),null);
 for(const p of catalog.list){
  assert.ok(Object.isFrozen(p));
  assert.ok(p.description.length>35&&p.training.length>10);
  assert.equal(p.generatorVersion,5);
  assert.equal(p.landscape,'curated');
  assert.ok(catalog.matches(p,p));
  assert.equal(catalog.matches(p,{...p,seed:p.seed+1}),false);
 }
});

for(const p of catalog.list)test(p.name+': deterministic, fair fixed map and save round-trip',()=>{
 const game=Simulation.campaign(p.seed,p.mapVersion,p.terrain,p.generatorVersion);
 const w=game.world;
 assert.equal(w.generated.landscapeKind,p.archetype);
 assert.equal(game.territories.length,p.bastions);
 assert.equal(w.validation?.valid,true,JSON.stringify(w.validation));
 assert.equal(w.validation?.reachableSites,p.bastions);
 assert.equal(w.validation?.tankReachableSites,p.bastions);
 assert.equal(game.income(0),game.income(1));
 assert.equal(game.world.generated.battlefield.profile,p.terrain);
 const repeat=new World(p.seed,p.mapVersion,p.terrain,0,p.generatorVersion);
 assert.equal(signature(w),signature(repeat),'locked map changed on recreation');
 const saved=game.save();
 assert.equal(saved.generatorVersion,5,'curated map must remain versioned in saves');
 const restored=Simulation.load(saved);
 assert.equal(signature(restored.world),signature(w),'loading moved a pass or a Bastion');
 assert.deepEqual(restored.territories.map(x=>x.owner),game.territories.map(x=>x.owner));
});

for(const p of catalog.list.filter(p=>p.archetype!=='open-basin'))test(
 p.name+': at least one actual mountain pass is drivable for each paid ground vehicle',()=>{
 const world=new World(p.seed,p.mapVersion,p.terrain,0,p.generatorVersion);
 const ridge=world.generated.ridges[0];
 assert.ok(ridge?.ramps.length,'missing strategic passes');
 const results={};
 for(const kind of ['rover','tank','artillery']){
  const clearance=Math.max(0,UNITS[kind].radius-10);
  const slope=kind==='tank'?.215:kind==='artillery'?.185:.195;
  let driveable=0;
  for(const ramp of ridge.ramps){
   const middle=ridgeHeightAtX(ridge,ramp.x);
   const offset=Math.max(270,ridge.width*.5+210);
   const a={x:ramp.x,y:middle-offset},b={x:ramp.x,y:middle+offset};
   if(!world.walkable(a,[],clearance)||!world.walkable(b,[],clearance))
    continue;
   const route=world.path(a,b,[],clearance,undefined,false,false,false,slope);
   if(route.length&&Math.hypot(route.at(-1).x-b.x,route.at(-1).y-b.y)<world.cell*1.4)
    driveable++;
  }
  results[kind]=driveable;
  assert.ok(driveable>0,p.name+' '+kind+' no actual traversable pass: '+
   JSON.stringify(results));
 }
 console.log('CURATED_PASS',JSON.stringify({id:p.id,driveable:results}));
});

test('the WebGL title screen actually launches named selections and keeps random mode',()=>{
 const html=readFileSync('webgl-preview.html','utf8');
 const menu=readFileSync('scripts/webgl-title-menu.js','utf8');
 const game=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(html,/id="sf3d-map-preset"/);
 assert.match(html,/id="sf3d-random-controls"/);
 assert.match(html,/src="\/webgl-map-presets\.js"/);
 for(const p of catalog.list)assert.match(html,new RegExp('value="'+p.id+'"'));
 assert.match(menu,/selectedPreset\(\)/);
 assert.match(menu,/landscape:'curated',preset:preset\.id/);
 assert.match(menu,/play\(preset\.bastions,preset\.seed/);
 assert.match(game,/const curatedRequest=/);
 assert.match(game,/curatedRequest\?5/);
 assert.match(game,/SandforgeMapPresets\?\.matches/);
 assert.match(build,/cpSync\('scripts\/webgl-map-presets\.js'/);
});
