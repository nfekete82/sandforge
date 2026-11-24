import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const DIST='dist/src/assets/reborn/buildings-3d/';
function readGLB(filename,root=DIST){
 const bytes=readFileSync(root+filename);
 assert.equal(bytes.toString('ascii',0,4),'glTF',filename);
 assert.equal(bytes.readUInt32LE(8),bytes.length,filename);
 const len=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON',filename);
 return {bytes,json:JSON.parse(bytes.toString('utf8',20,20+len))};
}

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

test('the standard build syncs authored PBR models in the staged distribution',()=>{
 const source=readFileSync('scripts/build.mjs','utf8');
 const ensure=source.indexOf("scripts/ensure-final-pbr-buildings.mjs");
 const bastion=source.indexOf("scripts/generate-bastion-radar.mjs");
 const copy=source.indexOf("cpSync('src/assets', 'dist/src/assets'");
 assert.ok(copy>=0&&ensure>copy&&bastion>ensure,
  'cannot silently build the legacy HQ/barracks while generating new Bastion');
 const script=readFileSync('scripts/ensure-final-pbr-buildings.mjs','utf8');
 assert.match(script,/sandforge-pbr-gesamt-test/);
 assert.match(script,/sandforge-kaserne-prop-polish/);
 assert.match(script,/sandforge-hq-pbr/);
 assert.match(script,/if\(!allGood\(stage\)\)throw Error/);
});
