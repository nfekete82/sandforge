import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FACTION_BLUE,FACTION_RED} from '../scripts/sandforge-faction-palette.js';

function glb(owner){
 const buffer=readFileSync('dist/src/assets/reborn/buildings-3d/factory-'+owner+'.glb');
 assert.equal(buffer.toString('ascii',0,4),'glTF');
 const length=buffer.readUInt32LE(12),doc=JSON.parse(buffer.toString('utf8',20,20+length));
 return {buffer,doc,offset:28+length};
}
function pngResolution(asset,idx){
 const tex=asset.doc.textures[idx],img=asset.doc.images[tex.source];
 assert.ok(img?.mimeType==='image/png');
 const view=asset.doc.bufferViews[img.bufferView];
 const bytes=asset.buffer.subarray(asset.offset+view.byteOffset,asset.offset+view.byteOffset+view.byteLength);
 assert.equal(bytes.toString('hex',1,4),'504e47');
 return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
}
function positionBounds(asset,name){
 const n=asset.doc.nodes.find(n=>n.name===name);
 assert.ok(n?.mesh!==undefined,name+' must contain actual triangles');
 const m=asset.doc.meshes[n.mesh],a=asset.doc.accessors[m.primitives[0].attributes.POSITION];
 return {min:a.min,max:a.max,count:a.count};
}
test('factory reference has sloping metal bays, clerestory glazing and rooftop machinery',()=>{
 for(const owner of [0,1]){
  const asset=glb(owner),{doc,buffer}=asset;
  assert.equal(doc.asset.generator,'factory-three-bay-sawtooth-pbr-20261121');
  assert.ok(buffer.length<3_000_000,'the gameplay GLB stays compact');
  const roof=positionBounds(asset,'SF_Factory_PBR_roof_metal');
  assert.ok(roof.max[1]>3.2&&roof.min[1]<2.65);
  assert.equal(roof.count,18);
  assert.equal(positionBounds(asset,'SF_Factory_PBR_roof_glass').count,108);
  const exhaust=positionBounds(asset,'SF_Factory_PBR_vent');
  assert.ok(exhaust.max[1]>3.8&&exhaust.count>=180);
  assert.ok(positionBounds(asset,'SF_Factory_PBR_warning').count>=72);
  assert.ok(doc.meshes.length<=38,'the architecture is batched by material');
 }
});
test('factory embeds color, normals and metallic roughness for its detailed roof surfaces',()=>{
 for(const owner of [0,1]){
  const asset=glb(owner),{doc}=asset;
  for(const name of ['roof','roof_metal','roof_trim','roof_glass']){
   const mat=doc.materials.find(m=>m.name==='Sandforge_Factory_'+name);
   assert.ok(mat,name+' exists');
   const pbr=mat.pbrMetallicRoughness;
   assert.deepEqual(pngResolution(asset,pbr.baseColorTexture.index),{width:512,height:512});
   assert.deepEqual(pngResolution(asset,mat.normalTexture.index),{width:256,height:256});
   assert.deepEqual(pngResolution(asset,pbr.metallicRoughnessTexture.index),{width:256,height:256});
  }
  const camo=doc.materials.find(m=>m.name==='Sandforge_Factory_camo');
  assert.deepEqual(pngResolution(asset,camo.pbrMetallicRoughness.baseColorTexture.index),{width:512,height:512});
  const team=doc.materials.find(m=>m.name==='Sandforge_Factory_team');
  assert.ok(team.extensions?.KHR_materials_unlit,'original faction markings stay crisp');
  assert.deepEqual([FACTION_BLUE,FACTION_RED],['#2c6799','#a64b43']);
 }
});
test('facade star plates are outside the animated shutter and live rendering preserves authored PBR',()=>{
 for(const owner of [0,1]){
  const asset=glb(owner);
  const shutter=positionBounds(asset,'FactoryRollupDoor');
  const stars=positionBounds(asset,'SF_Factory_PBR_white');
  assert.ok(stars.min[0]<shutter.min[0]&&stars.max[0]>shutter.max[0]);
  assert.ok(stars.min[2]>shutter.max[2]);
 }
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(battle,/entry\.kind==='factory'&&model\.getObjectByName\('SF_Factory_PBR_roof'\)&&[\s\S]*?getObjectByName\('FactoryRollupDoor'\)\)\)[\s\S]*?sandforgeOriginalPBR=true/);
 assert.match(portraits,/const authoredFactory=kind==='factory'/);
 assert.match(portraits,/authoredFactory\|\|authoredAirfield\|\|authoredGenerator/);
});
