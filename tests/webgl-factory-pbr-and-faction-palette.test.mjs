import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {FACTION_BLUE,FACTION_RED,FACTION_PAINT,factionRgb8} from '../scripts/sandforge-faction-palette.js';

const asset='dist/src/assets/reborn/buildings-3d/';
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

test('both faction factories ship the PBR shutter model and its faction paint',()=>{
 for(const owner of [0,1]){
  const file=glb('factory-'+owner),doc=file.doc;
  assert.equal(doc.asset.generator,'factory-three-bay-sawtooth-pbr-20261121');
  for(const name of ['FactoryRollupDoor','SF_Factory_PBR_roof_metal',
    'SF_Factory_PBR_camo','SF_Factory_PBR_vent','SF_Factory_PBR_team'])
   assert.ok(doc.nodes.some(n=>n.name===name),name);
  assert.equal(doc.nodes.filter(n=>n.name==='FactoryRollupDoor').length,1);
  assert.ok(doc.meshes.length<=38,'architecture remains batched by material');
  assert.ok(file.data.length<3_000_000,'the gameplay asset stays compact');
  assert.deepEqual(texturePixel(file,'Sandforge_Factory_team'),factionRgb8(owner));
  assert.ok(doc.materials.every(m=>!m.name.startsWith('Sandforge_Bastion_')));
  const facade=meshPositions(file,'SF_Factory_PBR_camo');
  assert.ok(facade.length>50);
  const door=meshPositions(file,'FactoryRollupDoor');
  assert.ok(Math.max(...door.map(v=>v[1]))-Math.min(...door.map(v=>v[1]))>1.68);
  const roof=meshPositions(file,'SF_Factory_PBR_roof');
  assert.ok(Math.max(...roof.map(v=>v[0]))-Math.min(...roof.map(v=>v[0]))>5.5);
 }
});

test('build regenerates both factory GLBs in the staged distribution',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(build,/\['scripts\/generate-factory-pbr\.mjs',shippedBuildingDir\]/);
 assert.match(build,/cpSync\('scripts\/sandforge-faction-palette\.js','dist\/sandforge-faction-palette\.js'\)/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/for\(const owner of \[0,1\]\)exportTeam\(owner\)/);
 assert.match(gen,/partName=g\.name==='door'\?'FactoryRollupDoor'/);
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

test('production supports the active shutter and the historical open workshop independently of repair',()=>{
 const gate=readFileSync('scripts/webgl-production-gates.js','utf8');
 const battlefield=readFileSync('scripts/webgl-battlefield.js','utf8');
 assert.match(gate,/getObjectByName\('SF_Factory_PBR_OpenBay'\)/);
 assert.match(gate,/openBay:true/);
 assert.match(gate,/const driveStart=gate\.openBay\?0/);
 assert.match(gate,/if\(gate\.openBay\)return/);
 assert.match(gate,/getObjectByName\('FactoryRollupDoor'\)/);
 assert.match(gate,/doorLiftHeight=finalFactory\?1\.70/);
 assert.doesNotMatch(battlefield,/createFactoryServiceYard\(/);
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

test('all three roof paint strips clear their ventilation housings',()=>{
 for(const owner of [0,1]){
  const file=glb('factory-'+owner);
  const roofPaint=meshPositions(file,'SF_Factory_PBR_team').filter(([,y])=>y>2.57);
  assert.equal(roofPaint.length,18,'one six-vertex strip per bay');
  const vents=meshPositions(file,'SF_Factory_PBR_vent').filter(([,y])=>y>2.8);
  for(let bay=0;bay<3;bay++){
   const strip=roofPaint.slice(bay*6,(bay+1)*6);
   const edge=Math.max(...strip.map(([x])=>x));
   const exit=Math.min(...vents.filter(([x])=>x>edge).map(([x])=>x));
   assert.ok(exit-edge>.001&&exit-edge<.15,'ventilation stays clear of the paint');
  }
 }
});

test('factory gate opens the right side of the thin wire perimeter for the rollout',()=>{
 const yard=readFileSync('scripts/webgl-building-yard.js','utf8');
 assert.match(yard,/perimeterBarracksWire\(g,width,\{factory:kind==='factory',generator:kind==='generator',research:kind==='research',silo:kind==='silo'\}\)/);
 assert.match(yard,/segment\(rightX,rear,rightX,factory\?-width\*\.13:front\)/);
 assert.match(yard,/if\(!factory\)segment\(gateHalf,front,rightX,front\)/);
 assert.match(yard,/BarracksWireFenceStrands/);
 assert.match(yard,/BarracksWireFenceBarbs/);
 const gen=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 assert.match(gen,/FACTORY_WIDTH_FACTOR=1\.10/);
 assert.match(gen,/FACTORY_GATE_OPEN_HEIGHT=1\.70/);
});
