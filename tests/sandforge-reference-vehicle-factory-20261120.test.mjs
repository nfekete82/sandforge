import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FACTION_BLUE,FACTION_RED} from '../scripts/sandforge-faction-palette.js';

function glb(owner){
 const buffer=readFileSync('src/assets/reborn/buildings-3d/factory-'+owner+'.glb');
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
test('factory reference has full angular pitched hangar roof, raised machinery wing and two proper exhaust towers',()=>{
 for(const owner of [0,1]){
  const asset=glb(owner),{doc,buffer}=asset;
  assert.equal(doc.asset.generator,'sandforge-industrial-reference-factory-v3-20261120');
  assert.ok(buffer.length<18_000_000,'a game asset must stay compact');
  const nodeNames=new Set(doc.nodes.map(n=>n.name));
  for(const name of ['SF_Factory_PBR_OpenBay','SF_Factory_PBR_ReferenceHangar_v3',
   'SF_Factory_PBR_roof','SF_Factory_PBR_stack','SF_Factory_PBR_roof_glazing',
   'SF_Factory_PBR_hazard_white','SF_Factory_PBR_hazard_rust',
   'SF_Factory_PBR_metal_cladding','SF_Factory_PBR_camo',
   'SF_Factory_PBR_vent','SF_Factory_PBR_team']){
    assert.ok(nodeNames.has(name),'missing original industrial detail '+name);
  }
  assert.ok(!nodeNames.has('FactoryRollupDoor'),'no blocking door in open hangar');
  const roof=positionBounds(asset,'SF_Factory_PBR_roof');
  assert.ok(roof.max[1]>3.10&&roof.min[1]<2.60,'roof slopes, not a flat cuboid');
  assert.ok(roof.count>100,'authentic roof is panelled with actual 3D surfaces');
  assert.ok(positionBounds(asset,'SF_Factory_PBR_roof_glazing').count>=48);
  const stacks=positionBounds(asset,'SF_Factory_PBR_stack');
  assert.ok(stacks.max[1]>5.5,'two tall technical stacks must be visible');
  assert.ok(stacks.count>=60);
  assert.ok(positionBounds(asset,'SF_Factory_PBR_hazard_white').count>=18);
  assert.ok(positionBounds(asset,'SF_Factory_PBR_hazard_rust').count>=18);
  assert.ok(doc.meshes.length<=38,'static architecture merged by PBR material, no tiny-mesh drawcall explosion');
 }
});
test('factory embeds authored 1024 roof PBR and proper normal/metallic roughness maps rather than painted placeholders',()=>{
 for(const owner of [0,1]){
  const asset=glb(owner),{doc}=asset;
  const names=['roof','camo','concrete','metal_cladding','stack','vent'];
  for(const name of names){
   const mat=doc.materials.find(m=>m.name==='Sandforge_Factory_'+name);
   assert.ok(mat,name+' exists');
   const pbr=mat.pbrMetallicRoughness;
   assert.ok(pbr.baseColorTexture,'colored albedo '+name);
   assert.ok(pbr.metallicRoughnessTexture,'gltf ORM '+name);
   assert.ok(mat.normalTexture,'real baked high-frequency relief '+name);
   const albedo=pngResolution(asset,pbr.baseColorTexture.index);
   const normal=pngResolution(asset,mat.normalTexture.index);
   const rough=pngResolution(asset,pbr.metallicRoughnessTexture.index);
   if(name==='roof')assert.deepEqual(albedo,{width:1024,height:1024});
   if(name==='camo'||name==='concrete'||name==='metal_cladding')
    assert.ok(albedo.width>=512,'main external PBR must be at least 512px');
   assert.ok(normal.width>=256&&rough.width>=256);
  }
  const team=doc.materials.find(m=>m.name==='Sandforge_Factory_team');
  const roofTeam=doc.materials.find(m=>m.name==='Sandforge_Factory_roof_team');
  for(const m of [team,roofTeam])
   assert.ok(m.extensions?.KHR_materials_unlit,'crisp color-coded roof bands');
  assert.deepEqual([FACTION_BLUE,FACTION_RED],['#2c6799','#a64b43']);
 }
});
test('hall exit stays physically open for vehicles, facade star plates stay beside the doorway',()=>{
 const src=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
 const gate=readFileSync('scripts/webgl-production-gates.js','utf8');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(src,/roofSystem\(\);[\s\S]*factoryUtilityWing\(\);[\s\S]*openFactoryApron\(\)/);
 assert.match(src,/[-]2\.00,2\.24/,'flags placed outside open exit');
 assert.match(src,/from the screenshot|match the distinctive reference silhouette/i);
 assert.match(gate,/if\(gate\.openBay\)return/);
 assert.match(gate,/const driveStart=gate\.openBay\?0/);
 assert.match(battle,/!model\.getObjectByName\('SF_Factory_PBR_ReferenceHangar_v3'\)/,
  'runtime must not overwrite the authored albedo/normal/ORM');
 assert.match(portraits,/!referenceFactory/,'HUD portrait must preserve new authored PBR too');
});
