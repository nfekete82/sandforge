import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const DIR='src/webgl-assets/buildings-3d/';
const DIST='dist/src/assets/reborn/buildings-3d/';
function readGLB(filename,root=DIR){
 const bytes=readFileSync(root+filename);
 assert.equal(bytes.toString('ascii',0,4),'glTF',filename);
 assert.equal(bytes.readUInt32LE(8),bytes.length,filename);
 const len=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON',filename);
 return {bytes,json:JSON.parse(bytes.toString('utf8',20,20+len))};
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('both team barracks are the real authored PBR version, not the retired prefab',()=>{
 for(const owner of [0,1]){
  const name='barracks-'+owner+'.glb',g=readGLB(name),nodes=new Set(g.json.nodes.map(n=>n.name));
  for(const node of ['door_leaf_L','door_leaf_R','door_recess_back',
    'door_panel_-1_0','roof_top_center'])
   assert.ok(nodes.has(node),name+' must contain '+node);
  for(const family of ['sandbag_','crate_','radar_'])
   assert.ok([...nodes].some(n=>n.startsWith(family)),name+' missing '+family+' props');
  assert.ok(g.json.images.length>=10,'PBR source textures must be preserved');
  assert.ok(g.bytes.length>1_000_000,'expect real authored GLB rather than a basic primitive');
  assert.equal(hash(g.bytes),hash(readGLB(name,DIST).bytes),
   'battlefield must load the actual checked final barracks binary');
 }
});

test('both command centres have enlarged dome, rear vents, rotors and current roof layout',()=>{
 for(const owner of [0,1]){
  const name='headquarters-'+owner+'.glb',g=readGLB(name),j=g.json,nodes=new Set(j.nodes.map(n=>n.name));
  assert.equal(j.asset.extras?.sandforgeHQRoofLayout,'centered-command-dome-roof-v4-canopy-20261116');
  assert.equal(j.asset.extras?.sandforgeHQVents,'flush-hq-vents-rear-v1-20261116');
  assert.equal(j.meshes.length,43);
  for(const node of ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_Dome_Shell',
   'HQ_Dome_Glazing','HQ_RearVent_Slats','HQ_Radar_01_LargeDish_Rotor',
   'HQ_Radar_02_PhasedArray_Rotor'])
   assert.ok(nodes.has(node),name+' missing '+node);
  assert.ok(j.images.length>=40,'HQ has original embedded camouflage, normals and roughness maps');
  assert.equal(hash(g.bytes),hash(readGLB(name,DIST).bytes),
   'HUD and battlefield must load the exact current PBR HQ');
 }
});

test('Bastion, Kaserne and Kommandozentrale all ship in ONE built dist',()=>{
 const b=readGLB('bastion-0.glb',DIST).json;
 assert.equal(b.asset.generator,'sandforge-bastion-radar-v3-tall-platform');
 assert.ok(b.animations.some(a=>a.name==='RadarSpin'));
 for(const name of ['barracks-0.glb','barracks-1.glb',
  'headquarters-0.glb','headquarters-1.glb','bastion-0.glb',
  'bastion-1.glb','bastion--1.glb'])
  assert.ok(existsSync(DIST+name),'all seven final model assets must be present: '+name);
});

test('shipped HQ and barracks surfaces have embedded UV-mapped albedo, normals and roughness',()=>{
 for(const kind of ['headquarters','barracks'])for(const team of [0,1]){
  const filename=kind+'-'+team+'.glb';
  const {json}=readGLB(filename,DIST);
  for(const mesh of json.meshes)for(const part of mesh.primitives){
   const material=json.materials[part.material];
   if(material.emissiveFactor?.some(value=>value>0))continue;
   const label=filename+' '+material.name;
   assert.ok(part.attributes.TEXCOORD_0!==undefined,label+' needs UVs');
   assert.ok(part.attributes.NORMAL!==undefined,label+' needs vertex normals');
   const pbr=material.pbrMetallicRoughness;
   for(const map of [pbr?.baseColorTexture,material.normalTexture,pbr?.metallicRoughnessTexture]){
    assert.ok(map,label+' needs albedo, normal and roughness maps');
    assert.ok(json.images[json.textures[map.index].source].bufferView!==undefined,label+' needs embedded images');
   }
  }
 }
});
