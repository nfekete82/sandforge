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
  ['webgl-entrance-banners.js','FACTION_PAINT'],
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

test('factory is a complete procedural authored-style PBR model for both teams',()=>{
 for(const owner of [0,1]){
  const file=glb('factory-'+owner),doc=file.doc;
  assert.equal(doc.asset.generator,'sandforge-factory-pbr-v1-20261116');
  const names=new Set(doc.nodes.map(n=>n.name));
  for(const part of ['FactoryRollupDoor','SF_Factory_PBR_roof',
   'SF_Factory_PBR_camo','SF_Factory_PBR_vent','SF_Factory_PBR_team'])
   assert.ok(names.has(part),'factory '+owner+' missing '+part);
  assert.ok(doc.meshes.length>=12&&doc.meshes.length<=22);
  assert.ok(file.data.length<1_200_000,'factory GLB must remain compact');
  assert.deepEqual(texturePixel(file,'Sandforge_Factory_team'),factionRgb8(owner));
  assert.ok(doc.materials.every(m=>!m.name.startsWith('Sandforge_Bastion_')),
   'factory must never ship material names copied from Bastion');
  const door=doc.nodes.find(n=>n.name==='FactoryRollupDoor');
  const mesh=doc.meshes[door.mesh];
  const accessor=doc.accessors[mesh.primitives[0].attributes.POSITION];
  assert.ok(accessor.min[1]>=-.01&&accessor.min[1]<.07);
  assert.ok(accessor.max[1]>=1.68&&accessor.max[1]<1.75,
   'new shutter must be ~12% taller than first factory');
  assert.ok(accessor.max[0]-accessor.min[0]>2.05,
   'new shutter must be ~15% wider than first factory');
  assert.ok(accessor.max[2]>2.25,'door must face +Z production rollout');
  assert.ok(doc.meshes.some(m=>m.name==='SF_Factory_PBR_white'),'two facade stars');
  const roof=doc.nodes.find(n=>n.name==='SF_Factory_PBR_roof');
  const roofAcc=doc.accessors[doc.meshes[roof.mesh].primitives[0].attributes.POSITION];
  assert.ok(roofAcc.max[0]-roofAcc.min[0]>5.5,'factory body must be ~10% wider');
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
 assert.match(gen,/FactoryRollupDoor/);
 assert.match(gen,/width=key==='roof'\?256:48/,'roof should have fine PBR paint, not magnified 48px grooves');
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

test('factory has one production gate; repair is still a separate OPEN platform',()=>{
 const gate=readFileSync('scripts/webgl-production-gates.js','utf8');
 const service=readFileSync('scripts/webgl-factory-service.js','utf8');
 assert.match(gate,/getObjectByName\('FactoryRollupDoor'\)/);
 assert.match(gate,/gate\.door\.scale\.y=1-pose\.open\*\.96/);
 assert.match(gate,/doorLiftHeight=finalFactory\?1\.70:1\.48/);
 assert.match(gate,/garageWidth=finalFactory\?2\.20:1\.52/);
 assert.match(service,/FactoryOpenAirRepairPlatform/);
 assert.match(service,/ONE open-air, drive-on service platform/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/single REAL FactoryRollupDoor/);
 assert.match(gen,/Leave the real doorway EMPTY/);
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
 assert.match(yard,/if\(!factory\)segment\(gateHalf,front,rightX,front\)/);
 assert.match(yard,/BarracksWireFenceStrands/);
 assert.match(yard,/BarracksWireFenceBarbs/);
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(scene,/const artScale=finalFactoryArt\?1\.06:1/);
 assert.match(scene,/kind==='factory'&&model\.getObjectByName\('SF_Factory_PBR_roof'\)\?1\.06:1/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/FACTORY_WIDTH_FACTOR=1\.10/);
 assert.match(gen,/FACTORY_GATE_OPEN_HEIGHT=1\.70/);
});
