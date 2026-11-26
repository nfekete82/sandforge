import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {factionRgb8} from '../scripts/sandforge-faction-palette.js';
import {calibratedScale,MODEL_HEIGHTS} from '../scripts/webgl-scale.js';
import {createBuildingYard,disposeBuildingYard} from '../scripts/webgl-building-yard.js';

const src=p=>readFileSync(p,'utf8');
function energyGlb(owner){
 const buf=readFileSync('dist/src/assets/reborn/buildings-3d/generator-'+owner+'.glb');
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
  assert.equal(m.doc.asset.generator,'sandforge-energy-core-pbr-v3-glass-dome-20261116');
  assert.ok(m.buf.length>15000);
  assert.ok(m.doc.meshes.length>=12&&m.doc.meshes.length<=16);
  assert.equal(m.doc.scenes[m.doc.scene].nodes.length,1);
  assert.ok(m.doc.nodes.some(n=>n.name==='SF_EnergyCore_PBR_Housing'));
  assert.ok(m.doc.nodes.some(n=>n.name==='SF_EnergyCore_PBR_team'));
  assert.ok(!m.doc.nodes.some(n=>/FactoryRollupDoor|radar|antenna|huge|spike/i.test(n.name)));
  assert.deepEqual(teamPixel(m),factionRgb8(owner),
   'roof stripes, energy ring and shields share exact canonical team paint');
 }
});

test('energy core has smaller desert housing and a tall dominant glass cylinder',()=>{
 const model=energyGlb(0);
 const bounds=model.doc.accessors.filter(x=>x.type==='VEC3'&&x.min&&x.max);
 const min=bounds.reduce((x,a)=>Math.min(x,a.min[1]),Infinity);
 const max=bounds.reduce((x,a)=>Math.max(x,a.max[1]),-Infinity);
 const left=bounds.reduce((x,a)=>Math.min(x,a.min[0]),Infinity);
 const right=bounds.reduce((x,a)=>Math.max(x,a.max[0]),-Infinity);
 assert.ok(max-min>=4.86&&max-min<=4.90,'translucent dome visibly crowns the glass reactor');
 assert.ok(right-left>=3.78&&right-left<=3.82,'housing is significantly narrower than old 5m model');
 const generator=src('scripts/generate-energy-core-pbr.mjs');
 assert.match(generator,/function buildParts\(\)/);
 assert.match(generator,/glassTube\(tube\.radius,tube\.bottom,tube\.top,tube\.sides\)/);
 assert.match(generator,/ring\('team',2\.04/);
 assert.match(generator,/for\(const x of \[-1\.52,1\.52\]\)/);
 assert.match(generator,/for\(const x of \[-1\.15,1\.15\]\)/);
 assert.doesNotMatch(generator,/FactoryRollupDoor|buildParts\(\)\s*\{[\s\S]*?\bFactoryRollupDoor\b/);
});

test('HUD, placement ghost and real game all use the authored faction assets',()=>{
 const build=src('scripts/build.mjs');
 const scene=src('scripts/webgl-battlefield.js');
 const portrait=src('scripts/webgl-portraits.js');
 assert.match(build,/scripts\/generate-energy-core-pbr\.mjs/);
 assert.match(build,/\['scripts\/generate-energy-core-pbr\.mjs',shippedBuildingDir\]/);
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


function rgbaPixel(m,name){
 const material=m.doc.materials.find(a=>a.name==='Sandforge_EnergyCore_'+name);
 assert.ok(material,'missing '+name+' PBR material');
 const id=m.doc.textures[material.pbrMetallicRoughness.baseColorTexture.index].source;
 const image=m.doc.images[id];
 const view=m.doc.bufferViews[image.bufferView];
 const png=m.buf.subarray(m.binOffset+view.byteOffset,
  m.binOffset+view.byteOffset+view.byteLength);
 const width=png.readUInt32BE(16);
 const raw=inflateSync(png.subarray(41,41+png.readUInt32BE(33)));
 const at=Math.floor(width/2)*(width*4+1)+1+Math.floor(width/2)*4;
 return {material,pixel:Array.from(raw.subarray(at,at+4))};
}

test('large clear glass cylinder ships with real BLEND alpha and visible team-powered column',()=>{
 for(const owner of [0,1]){
  const m=energyGlb(owner);
  const glass=rgbaPixel(m,'glass'),energy=rgbaPixel(m,'energy');
  assert.equal(glass.material.alphaMode,'BLEND','glass must be see-through');
  assert.ok(glass.material.pbrMetallicRoughness.roughnessFactor<=.2);
  assert.ok(glass.pixel[3]>=80&&glass.pixel[3]<=150,
   'opaque grey shading is not glass');
  assert.deepEqual(energy.pixel.slice(0,3),factionRgb8(owner),
   'inner energy core matches faction blue/red exactly');
  assert.ok(energy.material.extensions?.KHR_materials_unlit,
   'energy column visible without blowing out global lighting');
  const tubeMesh=m.doc.meshes.find(mesh=>mesh.name==='SF_EnergyCore_PBR_glass');
  assert.ok(tubeMesh,'authored optical glass cylinder');
  const a=m.doc.accessors[tubeMesh.primitives[0].attributes.POSITION];
  assert.ok(a.max[1]-a.min[1]>=2.24-1e-5);
  assert.ok(a.max[0]-a.min[0]>=2.3-1e-5);
  assert.equal(a.count,24*6*(1+8),'24 full tube facets plus eight curved transparent dome rings');
 }
});

test('live and ghost renders shrink the reactor instead of scaling it back up',()=>{
 const coreBounds={x:3.80,y:4.87,z:3.37};
 const factor=calibratedScale('generator','building',coreBounds,112);
 const width=coreBounds.x*factor,height=coreBounds.y*factor;
 assert.ok(width<72&&width>60,'the on-screen footprint must be ~40% smaller');
 assert.ok(height>=75&&height<=79.1,'tall glass tube remains easy to see');
 assert.equal(MODEL_HEIGHTS.generator,79);
 const battlefield=src('scripts/webgl-battlefield.js');
 assert.match(battlefield,/kind==='generator'&&model\.getObjectByName\('SF_EnergyCore_PBR_Housing'\)/);
 assert.match(battlefield,/entry\.kind==='generator'&&model\.getObjectByName\('SF_EnergyCore_PBR_Housing'\)/);
 assert.match(battlefield,/mesh\.castShadow=!glass/,'glass has no opaque shadow');
 assert.match(battlefield,/calibratedScale\(entry\.kind,type,dims,desired\)/);
 assert.match(battlefield,/calibratedScale\(kind,'building',size,spec\.width\)/);
 const yard=src('scripts/webgl-building-yard.js');
 assert.match(yard,/if\(kind==='generator'\)g\.scale\.setScalar\(\.66\)/);
 const catalog=src('src/reborn/catalog.ts');
 assert.match(catalog,/generator:\{name:'Energiekern',cost:150,buildTime:9,hp:500/);
 assert.match(catalog,/income:10/);
});

test('small generator has a real transparent hemispherical dome and textured side props',()=>{
 const source=src('scripts/generate-energy-core-pbr.mjs');
 assert.match(source,/export const ENERGY_GLASS_DOME=Object\.freeze\(\{radius:1\.15,base:4\.22,rise:\.65,segments:8\}\)/);
 assert.match(source,/function glassDome\(\)/);
 assert.match(source,/glassDome\(\);/);
 assert.doesNotMatch(source,/frustum\('steel_dark',4\.25,4\.39,1\.25,1\.15/,
  'no old opaque metal lid may hide the energy column');
 const yard=createBuildingYard('generator',112);
 const cache=yard.getObjectByName('BaseSupplyCache');
 assert.ok(cache);
 const props=[];
 cache.traverse(o=>{if(o.isMesh)props.push(o);});
 assert.ok(props.length>=3);
 assert.ok(props.some(o=>o.userData?.sandforgeBarracksPropPolish&&o.material?.map?.isTexture),
  'crates and barrels reuse authored tiled PBR wood/metal instead of flat fills');
 disposeBuildingYard(yard);
});
