import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {FACTION_BLUE,FACTION_RED,FACTION_PAINT,factionRgb8} from '../scripts/sandforge-faction-palette.js';

const asset='src/assets/reborn/buildings-3d/';
function glb(name){
 const data=readFileSync(asset+name+'.glb');
 assert.equal(data.toString('ascii',0,4),'glTF');
 assert.equal(data.readUInt32LE(4),2);
 assert.equal(data.readUInt32LE(8),data.length);
 const jsonLength=data.readUInt32LE(12);
 assert.equal(data.toString('ascii',16,20),'JSON');
 const doc=JSON.parse(data.toString('utf8',20,20+jsonLength));
 return {doc,data,binStart:20+jsonLength+8};
}
function texturePixel(file,materialName){
 const {doc,data,binStart}=file;
 const material=doc.materials.find(m=>m.name===materialName);
 assert.ok(material,materialName);
 assert.ok(material.extensions?.KHR_materials_unlit,materialName+' should be unlit');
 const texture=doc.textures[material.pbrMetallicRoughness.baseColorTexture.index];
 const view=doc.bufferViews[doc.images[texture.source].bufferView];
 const image=data.subarray(binStart+view.byteOffset,binStart+view.byteOffset+view.byteLength);
 assert.equal(image.subarray(1,4).toString('hex'),'504e47','PNG embedded');
 const width=image.readUInt32BE(16),len=image.readUInt32BE(33);
 assert.equal(image.toString('ascii',37,41),'IDAT','simple PNG atlas');
 const raw=inflateSync(image.subarray(41,41+len));
 const offset=(Math.floor(width/2)*(width*4+1))+1+(Math.floor(width/2)*4);
 return [...raw.subarray(offset,offset+3)];
}

test('one sRGB team paint is shared across 3D models and HUD',()=>{
 assert.equal(FACTION_BLUE,'#2c6799');
 assert.equal(FACTION_RED,'#a64b43');
 assert.notDeepEqual(factionRgb8(0),factionRgb8(1));
 const files=[
  ['webgl-building-roof-stripes.js','FACTION_PAINT'],
  ['webgl-entrance-banners.js','FACTION_FLAG_COLORS'],
  ['webgl-team-markings.js','FACTION_PAINT'],
  ['webgl-faction-accents.js','FACTION_PAINT'],
  ['webgl-bastion-capture.js','FACTION_BLUE'],
  ['webgl-battlefield.js','FACTION_BLUE'],
  ['webgl-strategic-buildings.js','FACTION_PAINT']
 ];
 for(const [name,symbol] of files){
  const src=readFileSync('scripts/'+name,'utf8');
  assert.match(src,new RegExp('import \\{[^\\n]*\\b'+symbol+'\\b[^\\n]*\\} from'));
 }
 assert.equal(FACTION_PAINT[0],FACTION_BLUE);
 assert.equal(FACTION_PAINT[1],FACTION_RED);
});

test('Bastion banner and signal base color match exact blue/red faction RGB',()=>{
 for(const owner of [0,1]){
  const file=glb('bastion-'+owner);
  assert.deepEqual(texturePixel(file,'Sandforge_Bastion_fabric'),factionRgb8(owner));
  assert.deepEqual(texturePixel(file,'Sandforge_Bastion_blue'),factionRgb8(owner));
  assert.deepEqual(texturePixel(file,'Sandforge_Bastion_beacon'),factionRgb8(owner));
 }
});

test('factory is authored PBR open-hall with a truly empty drive-through for both teams',()=>{
 for(const owner of [0,1]){
  const file=glb('factory-'+owner),doc=file.doc;
  assert.equal(doc.asset.generator,'sandforge-industrial-reference-factory-v3-20261120');
  const nodes=new Set(doc.nodes.map(n=>n.name));
  for(const name of ['SF_Factory_PBR_OpenBay','SF_Factory_PBR_roof',
    'SF_Factory_PBR_camo','SF_Factory_PBR_vent','SF_Factory_PBR_team'])
   assert.ok(nodes.has(name),'open factory '+owner+' missing '+name);
  assert.ok(!nodes.has('FactoryRollupDoor'),'no visible or hidden sliding shutter');
  assert.ok(doc.nodes.find(n=>n.name==='SF_Factory_PBR_OpenBay')?.extras?.openProductionExit);
  assert.ok(doc.meshes.length>=21&&doc.meshes.length<=38,
   'reference factory still batches all 3D detail by 23-38 authored PBR material meshes');
  assert.ok(file.data.length<18_000_000,'1024px PBR reference factory must remain GPU-friendly');
  assert.deepEqual(texturePixel(file,'Sandforge_Factory_team'),factionRgb8(owner));
  assert.ok(doc.materials.every(m=>!m.name.startsWith('Sandforge_Bastion_')));
  const facade=meshPositions(file,'SF_Factory_PBR_camo');
  assert.ok(facade.length>50);
  const blocked=facade.filter(([x,y,z])=>Math.abs(z-2.10)<.15&&
   x> -1.50*1.10&&x<1.85*1.10&&y>.4&&y<1.95);
  assert.equal(blocked.length,0,'no structural triangles block the wide central portal');
  assert.ok(doc.meshes.some(m=>m.name==='SF_Factory_PBR_white'),'facade has team-identification details');
  const roof=doc.nodes.find(n=>n.name==='SF_Factory_PBR_roof');
  const roofAcc=doc.accessors[doc.meshes[roof.mesh].primitives[0].attributes.POSITION];
  assert.ok(roofAcc.max[0]-roofAcc.min[0]>5.5);
 }
});

test('build regenerates factory GLBs before copying assets, not user-local binaries',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const i=build.indexOf("scripts/generate-factory-pbr.mjs");
 const j=build.indexOf("cpSync('src/assets', 'dist/src/assets'");
 assert.ok(i>=0&&j>i,'generator must run before dist export');
 assert.match(build,/cpSync\('scripts\/sandforge-faction-palette\.js','dist\/sandforge-faction-palette\.js'\)/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/for\(const owner of \[0,1\]\)exportTeam\(owner\)/);
 assert.match(gen,/SF_Factory_PBR_OpenBay/);
 assert.doesNotMatch(gen,/partName\s*=\s*['"]FactoryRollupDoor['"]/,
  'factory export has no movable door mesh');
 assert.match(gen,/key==='roof'\?1024/,'reference roof must use real 1024px embedded PBR texture');
 assert.match(gen,/metallicRoughnessTexture:\{index:orm\}/);
 assert.match(gen,/normalTexture:\{index:normal/);
 assert.doesNotMatch(gen,/sandforge-pbr-gesamt-test/);
 const game=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(game,/entry.kind==='factory'.*SF_Factory_PBR_roof/);
 const hud=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(hud,/const authoredFactory=kind==='factory'/);
 assert.match(hud,/const authoredAirfield=kind==='airfield'/);
 assert.match(hud,/const authoredGenerator=kind==='generator'/);
  assert.match(hud,/else if\(authoredFactory\|\|authoredAirfield\|\|authoredGenerator\)/);
 assert.match(hud,/DESERT_BUILDING_KINDS\.includes\(kind\)\|\|kind==='airfield'/);
});

test('open vehicle factory does not wait for a shutter; repair deck is independent',()=>{
 const gate=readFileSync('scripts/webgl-production-gates.js','utf8');
 const service=readFileSync('scripts/webgl-factory-service.js','utf8');
 assert.match(gate,/getObjectByName\('SF_Factory_PBR_OpenBay'\)/);
 assert.match(gate,/openBay:true/);
 assert.match(gate,/const driveStart=gate\.openBay\?0/);
 assert.match(gate,/if\(gate\.openBay\)return/);
 assert.match(service,/FactoryOpenAirRepairPlatform/);
 assert.match(service,/ONE open-air, drive-on service platform/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/permanently OPEN vehicle exit/);
 assert.match(gen,/Vehicle-facing PBR interior/);
});

/** Read authored GLB local geometry directly, without requiring WebGL. */
function meshPositions(file,name){
 const {doc,data,binStart}=file;
 const node=doc.nodes.find(n=>n.name===name);
 assert.ok(node?.mesh!==undefined,'Missing model part '+name);
 const access=doc.accessors[doc.meshes[node.mesh].primitives[0].attributes.POSITION];
 const view=doc.bufferViews[access.bufferView];
 assert.equal(access.type,'VEC3');
 const out=[];
 for(let i=0;i<access.count;i++){
  const offset=binStart+view.byteOffset+(access.byteOffset??0)+i*(view.byteStride??12);
  out.push([data.readFloatLE(offset),data.readFloatLE(offset+4),data.readFloatLE(offset+8)]);
 }
 return out;
}

test('all four roof paint sections avoid the raised roof ventilation housings',()=>{
 for(const owner of [0,1]){
  const file=glb('factory-'+owner);
  const roofPaint=meshPositions(file,'SF_Factory_PBR_team')
   .filter(([x,y,z])=>y>2.57);
  assert.ok(roofPaint.length>=96,'two split strips should yield four sections');
  assert.ok(roofPaint.every(([x,y,z])=>z<=-1.35+.0001||z>=-.18-.0001),
   'paint must NOT run under any of the two raised housings');
  const zones=new Set(roofPaint.map(([x,y,z])=>
   (x<0?'L':'R')+':'+(z<-1.35+.0001?'back':'front')));
  assert.deepEqual([...zones].sort(),['L:back','L:front','R:back','R:front']);
 }
});

test('factory reuses thin HQ/barracks wire, opens right side for repairs',()=>{
 const yard=readFileSync('scripts/webgl-building-yard.js','utf8');
 assert.match(yard,/perimeterBarracksWire\(g,width,\{factory:kind==='factory',generator:kind==='generator',research:kind==='research',silo:kind==='silo'\}\)/);
 assert.match(yard,/segment\(rightX,rear,rightX,factory\?-width\*\.13:front\)/);
 assert.match(yard,/const gateHalf=width\*\(factory\?\.36:/,
  'open vehicle factory needs room for tanks to leave without wire clipping');
 assert.match(yard,/if\(!factory\)segment\(gateHalf,front,rightX,front\)/);
 assert.match(yard,/BarracksWireFenceStrands/);
 assert.match(yard,/BarracksWireFenceBarbs/);
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(scene,/const artScale=finalFactoryArt\?1\.06:1/);
 assert.match(scene,/kind==='factory'&&model\.getObjectByName\('SF_Factory_PBR_roof'\)\?1\.06:1/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/FACTORY_WIDTH_FACTOR=1\.10/);
 assert.match(gen,/FACTORY_OPEN_BAY_HEIGHT=2\.14/);
});
