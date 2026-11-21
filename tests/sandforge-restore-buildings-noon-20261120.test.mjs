import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('playable game uses PRE-Meshy building designs from 20 Nov midday',()=>{
 const build=read('scripts/build.mjs');
 const sourceFlags=read('scripts/webgl-meshy-asset-flags.js');
 assert.match(build,/const BUILDING_ART_REFERENCE='2026-11-20T11:20:39\+01:00'/);
 assert.match(build,/const available=Object.fromEntries\(kinds.map\(kind=>\[kind,false\]\)\)/);
 assert.match(build,/available\.airfieldReference=false/);
 assert.match(build,/execFileSync\(process.execPath,\['scripts\/ensure-final-pbr-buildings\.mjs'\]/);
 assert.match(build,/execFileSync\(process.execPath,\['scripts\/generate-factory-pbr\.mjs'\]/);
 assert.doesNotMatch(build,/execFileSync\(process.execPath,\['scripts\/prepare-meshy-factory\.mjs'\]/);
 assert.doesNotMatch(build,/factory-procedural-\$\{team\}\.glb/);
 assert.match(sourceFlags,/headquarters:false/);
 assert.match(sourceFlags,/barracks:false/);
});
test('midday factory rollup remains, but external repair lift is retired',()=>{
 const factory=read('scripts/generate-factory-pbr.mjs');
 const battlefield=read('scripts/webgl-battlefield.js');
 assert.match(factory,/FACTORY_WIDTH_FACTOR=1\.10/);
 assert.match(factory,/FactoryRollupDoor/);
 assert.doesNotMatch(factory,/SF_Factory_PBR_OpenBay/);
 assert.match(battlefield,/model\.getObjectByName\('FactoryRollupDoor'\)/);
 assert.doesNotMatch(battlefield,/createFactoryServiceYard\(/);
 assert.doesNotMatch(battlefield,/updateFactoryServiceYard\(/);
 assert.match(battlefield,/disposeFactoryServiceYard/);
 assert.match(battlefield,/paintFactionRoofStripes\(model,kind,0\)/);
});
test('original generated airfield, bastion, reactor and bunker fallback remain active',()=>{
 const build=read('scripts/build.mjs');
 for(const name of ['generate-airfield-pbr','generate-energy-core-pbr','generate-bastion-radar']){
  assert.match(build,new RegExp('scripts/'+name.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'\\.mjs'));
 }
 const bunker=read('scripts/webgl-fortified-bunker.js');
 assert.match(bunker,/meshyStructurePath\('bunker'\)/);
 const strategic=read('scripts/webgl-strategic-buildings.js');
 assert.match(strategic,/export function createDefensiveBunker\(owner=0\)/);
 assert.match(strategic,/Bunker_Embrasure_/);
 assert.doesNotMatch(strategic,/return createFortifiedBunker\(owner\)/);
 assert.match(read('scripts/webgl-battlefield.js'),/meshyStructurePath\('bastion'\)/);
 assert.match(read('scripts/webgl-battlefield.js'),/const ownerBeacon=meshyStructurePath\('bastion'\)\?/);
 const manifest=read('scripts/webgl-meshy-asset-flags.js');
 for(const kind of ['barracks','airfield','bastion','bunker','headquarters','generator'])
  assert.match(manifest,new RegExp(kind+':false'));
});
test('after build, dist manifest never enables evening Meshy building skins',()=>{
 if(!existsSync('dist/webgl-meshy-asset-flags.js'))return;
 const src=read('dist/webgl-meshy-asset-flags.js');
 const start=src.indexOf('Object.freeze('),end=src.indexOf(');',start);
 assert.ok(start>0&&end>start);
 const active=JSON.parse(src.slice(start+'Object.freeze('.length,end));
 for(const [kind,present] of Object.entries(active))
  assert.equal(present,false,'new Meshy building must stay disabled: '+kind);
});
