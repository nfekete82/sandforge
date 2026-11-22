import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function glb(file){
 const b=readFileSync(file);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const jlen=b.readUInt32LE(12);
 assert.equal(b.toString('ascii',16,20),'JSON');
 return JSON.parse(b.toString('utf8',20,20+jlen));
}
const PATH='src/assets/reborn/buildings-3d/';
test('both PBR HQ GLBs have the same textured command dome without losing animation pivots',()=>{
 for(const owner of [0,1]){
  const doc=glb(PATH+'headquarters-'+owner+'.glb');
  const names=new Set(doc.nodes.map(n=>n.name));
  const materialNames=new Set(doc.materials.map(m=>m.name));
  assert.equal(doc.meshes.length,43,'35 authored + 3 rear vent + 5 dome meshes');
  for(const name of ['HQ_Dome_Shell','HQ_Dome_Base','HQ_Dome_Glazing',
   'HQ_Dome_Armour','HQ_Dome_Frame',
   'HQ_Radar_01_LargeDish_Rotor','HQ_Radar_02_PhasedArray_Rotor',
   'HQ_Radar_03_MiniDish_Rotor','HQ_door_leaf_L','HQ_door_leaf_R'])
   assert.ok(names.has(name),'missing '+name+' team '+owner);
  for(const name of ['SF_OriginalPBR_roof','SF_OriginalPBR_concrete',
   'HQ_PBR_antireflective_window','HQ_PBR_radar_steel','HQ_PBR_black_grill'])
   assert.ok(materialNames.has(name),'real textured PBR material missing: '+name);
  for(const name of ['HQ_Dome_Shell','HQ_Dome_Base','HQ_Dome_Glazing',
   'HQ_Dome_Armour','HQ_Dome_Frame']){
   const node=doc.nodes.find(n=>n.name===name);
   const primitive=doc.meshes[node.mesh].primitives[0];
   assert.ok(primitive.attributes.NORMAL!==undefined,'normal map coordinates '+name);
   assert.ok(primitive.attributes.TEXCOORD_0!==undefined,'PBR UVs '+name);
   assert.ok(doc.materials[primitive.material].pbrMetallicRoughness.baseColorTexture,
    name+' requires an actual image instead of flat color');
  }
  const shell=doc.nodes.find(n=>n.name==='HQ_Dome_Shell');
  const mesh=doc.meshes[shell.mesh],acc=doc.accessors[mesh.primitives[0].attributes.POSITION];
  assert.ok(acc.max[1]>=6.62,'large dome must visually raise roof silhouette');
  assert.ok(acc.min[1]>5.25,'dome must be placed above existing roof');
  assert.ok(doc.images.length>=40,'preserve existing HQ PBR texture images');
 }
});
test('dome generator is idempotent and preserves radar, doors and embedded images',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sandforge-hq-dome-'));
 const file=join(dir,'hq.glb');
 try{
  copyFileSync(PATH+'headquarters-0.glb',file);
  const before=glb(file);
  execFileSync(process.execPath,['scripts/upgrade-hq-dome.mjs',file],{stdio:'pipe'});
  const after=glb(file);
  assert.equal(after.meshes.length,before.meshes.length);
  assert.equal(after.images.length,before.images.length);
  for(const name of ['HQ_Radar_01_LargeDish_Rotor','HQ_door_leaf_L'])
   assert.ok(after.nodes.some(n=>n.name===name));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
