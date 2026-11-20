import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {Simulation} from '../dist/src/reborn/simulation.js';
import '../scripts/webgl-desert-maps.js';
import {DESERT_ECOREGIONS,DESERT_MODEL_FILES,desertEcoregion} from '../scripts/webgl-desert-ecoregions.js';
import {planDesertEcoregion} from '../scripts/webgl-desert-ecoregion-plan.js';

const catalog=globalThis.SandforgeDesertMaps.maps;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const distSegment=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy||1,
  t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len));
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
};
test('exactly four distinct natural deserts; cacti only in native Sonoran, Joshua only in Mojave',()=>{
 assert.equal(catalog.length,4);
 assert.equal(Object.keys(DESERT_ECOREGIONS).length,4);
 const e=catalog.map(m=>desertEcoregion(m.id));
 assert.ok(e.every(Boolean));
 assert.equal(new Set(e.map(x=>x.key)).size,4);
 assert.equal(new Set(e.map(x=>x.terrainSource)).size,4);
 assert.equal(new Set(e.map(x=>x.palette.sand)).size,4);
 assert.equal(e[0].saguaro,0,'Sahara cannot grow North American Saguaro');
 assert.equal(e[0].joshua,0,'open Sandforge dune battlefield stays clean');
 assert.ok(e[1].saguaro>=18&&e[1].joshua===0);
 assert.ok(e[2].joshua>=20&&e[2].saguaro===0);
 assert.ok(e[3].rocks>=40&&e[3].saguaro===0&&e[3].joshua===0);
 assert.equal(desertEcoregion('snow'),null);
});

for(const map of catalog)test(map.name+': deterministic real-art placement respects roads, HQ pads and AI terrain',()=>{
 const game=Simulation.campaign(map.seed,map.mapVersion,map.terrain,map.generatorVersion);
 const world=game.world,terrain=world.generated,region=desertEcoregion(map.id);
 const originalSave=JSON.stringify(game.save()),blocked=Buffer.from(world.blocked);
 const query={mapId:map.id,world,terrain,seed:map.seed};
 const placed=planDesertEcoregion(query),again=planDesertEcoregion(query);
 assert.deepEqual(placed,again,'same map seed yields identical painted vegetation and rocks');
 const wanted=region.rocks+region.saguaro+region.joshua;
 assert.ok(placed.length>=Math.min(wanted,Math.floor(wanted*.65)),
   map.id+' must not look empty; sites='+placed.length+' expected='+wanted);
 const smaller=planDesertEcoregion({...query,lowQuality:true});
 assert.ok(smaller.length<=placed.length);
 for(const p of placed){
  assert.ok(p.x>290&&p.y>290&&p.x<world.size-290&&p.y<world.size-290,'stay away from hard black map void');
  assert.ok(world.walkable(p,[],p.kind==='sandstone'?20:22),'purely decorative, no real obstacles');
  assert.ok(world.terrainSlope(p.x,p.y)<=(p.kind==='sandstone'?.27:.135));
  assert.ok(terrain.sites.every(s=>distance(p,s)>=760),'never interfere with Bastion or HQ pads');
  assert.ok((terrain.roads??[]).every(road=>road.slice(1).every((to,i)=>
   distSegment(p,road[i],to)>=(p.kind==='sandstone'?180:145))),'no cactus/stone hides tank paths');
  assert.ok(p.scale>=.75&&p.scale<=1.25,'prop scale must stay plausible');
  assert.equal(p.mapId,map.id);
 }
 assert.equal(JSON.stringify(game.save()),originalSave,'never edit save data');
 assert.deepEqual(Buffer.from(world.blocked),blocked,'zero changes to vehicle or infantry collision masks');
});

function documentFromGLB(file){
 const data=readFileSync(file);
 assert.equal(data.toString('utf8',0,4),'glTF','real binary glTF, never an OBJ or painted sprite');
 assert.equal(data.readUInt32LE(4),2);
 assert.equal(data.readUInt32LE(8),data.length,'GLB length is valid');
 assert.equal(data.toString('utf8',16,20),'JSON');
 return JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)));
}
for(const [kind,url] of Object.entries(DESERT_MODEL_FILES))test('production '+kind+': actual UV-mapped 3D mesh with embedded PBR textures',()=>{
 const file='src'+url.replace('/src','');
 assert.ok(statSync(file).size>200_000,'no tiny placeholder file');
 assert.ok(statSync(file).size<20_000_000,'scenery must be optimized');
 const glb=documentFromGLB(file);
 assert.ok(glb.meshes.length&&glb.accessors?.length&&glb.images?.length);
 assert.ok(glb.materials?.some(m=>m.pbrMetallicRoughness?.baseColorTexture));
 const surfaces=glb.meshes.flatMap(m=>m.primitives??[]);
 assert.ok(surfaces.some(p=>Number.isInteger(p.attributes?.POSITION)));
 assert.ok(surfaces.some(p=>Number.isInteger(p.attributes?.TEXCOORD_0)));
 assert.ok(glb.textures?.length,'materials are real PBR maps, never one green color');
 const triangles=surfaces.reduce((s,p)=>s+(p.indices!==undefined?
  glb.accessors[p.indices].count:
  glb.accessors[p.attributes.POSITION].count)/3,0);
 assert.ok(triangles>400,'not a sphere or cylinder stand-in');
 assert.ok(triangles<350000,'GPU-aware true mesh LOD');
 console.log('DESERT_ASSET '+JSON.stringify({kind,triangles,bytes:statSync(file).size,images:glb.images.length}));
});
for(const region of Object.values(DESERT_ECOREGIONS).filter(r=>r.ground))test(region.key+': three real CC0 PBR ground images are committed locally',()=>{
 for(const [k,path] of Object.entries(region.ground)){
  const file='src'+path.replace('/src','');
  assert.ok(statSync(file).size>1200,k+' cannot be missing or a flat color');
  assert.equal(readFileSync(file).toString('ascii',8,12),'WEBP','actual WebP texture, not renamed JPG');
 }
});
test('new modern maps never use legacy green geometric shrub placeholders',()=>{
 const biome=readFileSync('scripts/webgl-biomes.js','utf8');
 const renderer=readFileSync('scripts/webgl-desert-ecoregion-3d.js','utf8');
 const preview=readFileSync('scripts/webgl-preview.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(biome,/selected==='desert'&&world\.mapVersion>=23\)return \{count:0,meshes:\[\]\}/);
 for(const forbidden of ['SphereGeometry(','CylinderGeometry(','ConeGeometry(','IcosahedronGeometry(','DodecahedronGeometry('])
  assert.ok(!renderer.includes(forbidden),'NO painted primitives in real 3D native scenery '+forbidden);
 assert.match(renderer,/loadAsync\(DESERT_MODEL_FILES\[kind\]\)/);
 assert.match(renderer,/mat\?\.map\?\.isTexture/);
 assert.match(renderer,/new THREE\.InstancedMesh/);
 assert.match(renderer,/nonBlocking:true/);
 assert.match(preview,/installDesertRegionalPBR/);
 assert.match(preview,/authenticDesertArt\?\.dispose\(\)/);
 for(const name of ['webgl-desert-ecoregions','webgl-desert-ecoregion-plan','webgl-desert-ecoregion-3d','webgl-desert-ground-pbr'])
  assert.ok(build.includes(name));
});
