import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {factionRgb8} from '../scripts/sandforge-faction-palette.js';

const src=p=>readFileSync(p,'utf8');
function energyGlb(owner){
 const buf=readFileSync('src/assets/reborn/buildings-3d/generator-'+owner+'.glb');
 assert.equal(buf.toString('ascii',0,4),'glTF');
 assert.equal(buf.readUInt32LE(4),2);
 assert.equal(buf.readUInt32LE(8),buf.length);
 const length=buf.readUInt32LE(12);
 const doc=JSON.parse(buf.toString('utf8',20,20+length));
 return {buf,doc,binOffset:28+length};
}
function teamPixel(m){
 const material=m.doc.materials.find(a=>a.name==='Sandforge_EnergyCore_team');
 assert.ok(material,'authored energy faction material');
 assert.ok(material.extensions?.KHR_materials_unlit,
  'ownership blue/red must be lit independently of desert sun');
 const texture=m.doc.textures[material.pbrMetallicRoughness.baseColorTexture.index];
 const image=m.doc.images[texture.source];
 const view=m.doc.bufferViews[image.bufferView];
 const png=m.buf.subarray(m.binOffset+view.byteOffset,
  m.binOffset+view.byteOffset+view.byteLength);
 assert.equal(png.toString('hex',1,4),'504e47');
 const width=png.readUInt32BE(16),compressed=png.readUInt32BE(33);
 const pixels=inflateSync(png.subarray(41,41+compressed));
 const offset=Math.floor(width/2)*(width*4+1)+1+Math.floor(width/2)*4;
 return Array.from(pixels.subarray(offset,offset+3));
}

test('both teams receive small, valid 3D PBR energy-core GLBs',()=>{
 for(const owner of [0,1]){
  const m=energyGlb(owner);
  assert.equal(m.doc.asset.generator,'sandforge-energy-core-pbr-v1-20261116');
  assert.ok(m.buf.length>15000);
  assert.ok(m.doc.meshes.length>=10&&m.doc.meshes.length<=16);
  assert.equal(m.doc.scenes[m.doc.scene].nodes.length,1);
  assert.ok(m.doc.nodes.some(n=>n.name==='SF_EnergyCore_PBR_Housing'));
  assert.ok(m.doc.nodes.some(n=>n.name==='SF_EnergyCore_PBR_team'));
  assert.ok(!m.doc.nodes.some(n=>/FactoryRollupDoor|radar|antenna|huge|spike/i.test(n.name)));
  assert.deepEqual(teamPixel(m),factionRgb8(owner),
   'roof stripes, energy ring and shields share exact canonical team paint');
 }
});

test('energy core is visibly LOW and simple, with a compact central power cell',()=>{
 const model=energyGlb(0);
 const bounds=model.doc.accessors.filter(x=>x.type==='VEC3'&&x.min&&x.max);
 const min=bounds.reduce((x,a)=>Math.min(x,a.min[1]),Infinity);
 const max=bounds.reduce((x,a)=>Math.max(x,a.max[1]),-Infinity);
 const left=bounds.reduce((x,a)=>Math.min(x,a.min[0]),Infinity);
 const right=bounds.reduce((x,a)=>Math.max(x,a.max[0]),-Infinity);
 assert.ok(max-min<3.25,'power core must not become another huge reactor tower');
 assert.ok(right-left>=4.9&&right-left<=5.1,'compact building body');
 const generator=src('scripts/generate-energy-core-pbr.mjs');
 assert.match(generator,/function buildParts\(\)/);
 assert.match(generator,/ring\('team',2\.94/);
 assert.match(generator,/for\(const x of \[-1\.65,1\.65\]\)/);
 assert.match(generator,/for\(const x of \[-1\.64,1\.64\]\)/);
 assert.doesNotMatch(generator,/FactoryRollupDoor|buildParts\(\)\s*\{[\s\S]*?\bFactoryRollupDoor\b/);
});

test('HUD, placement ghost and real game all use the authored faction assets',()=>{
 const build=src('scripts/build.mjs');
 const scene=src('scripts/webgl-battlefield.js');
 const portrait=src('scripts/webgl-portraits.js');
 assert.match(build,/scripts\/generate-energy-core-pbr\.mjs/);
 assert.ok(build.indexOf('generate-energy-core-pbr.mjs')<
  build.indexOf("cpSync('src/assets', 'dist/src/assets'"),
  'always generate actual GLBs BEFORE dist asset export');
 assert.match(scene,/entry\.kind==='generator'&&model\.getObjectByName\('SF_EnergyCore_PBR_Housing'\)/);
 assert.match(scene,/model\.userData\.sandforgeOriginalPBR=true/);
 assert.match(portrait,/kind==='generator'\)\&\&renderer/);
 assert.match(portrait,/const authoredGenerator=kind==='generator'/);
 assert.match(portrait,/authoredFactory\|\|authoredAirfield\|\|authoredGenerator/);
 const catalog=src('src/reborn/catalog.ts');
 assert.match(catalog,/generator:\{name:'Energiekern',cost:150,buildTime:9,hp:500/);
 assert.match(catalog,/income:10/);
});

test('airfield landing strip is clear, with a fully round 360° tower',()=>{
 const terrain=src('scripts/webgl-airfield-service.js');
 const airfield=src('scripts/generate-airfield-pbr.mjs');
 assert.doesNotMatch(terrain,/box\(group,'AirfieldTouchdownRubber'/);
 assert.doesNotMatch(terrain,/for\(const x of \[-11,33\]\)/);
 assert.match(terrain,/AirfieldRunwayCenterDash/);
 assert.match(terrain,/AirfieldRunwayThreshold/);
 assert.match(airfield,/AIRFIELD_TOWER_SIDES=20/);
 assert.match(airfield,/cylindricalShell\('camo',towerX,towerZ,17\.5,17\.5,6,93/);
 assert.match(airfield,/cylindricalShell\('glass',towerX,towerZ,23,23,97\.5,117\.5/);
 assert.match(airfield,/cylindricalShell\('roof',towerX,towerZ,27\.0,27\.0,119\.5,124/);
});
