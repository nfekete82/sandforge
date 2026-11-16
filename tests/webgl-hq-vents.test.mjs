import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const DIR='src/assets/reborn/buildings-3d/';
function load(path){
 const b=readFileSync(path);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const length=b.readUInt32LE(12),json=JSON.parse(b.toString('utf8',20,20+length));
 return {b,json,binStart:20+length+8};
}
function vertices(glb,part){
 const {b,json,binStart}=glb;
 const node=json.nodes.find(n=>n.name===part);
 assert.ok(node,'missing '+part);
 const prim=json.meshes[node.mesh].primitives[0];
 const a=json.accessors[prim.attributes.POSITION],view=json.bufferViews[a.bufferView];
 const first=binStart+(view.byteOffset??0)+(a.byteOffset??0);
 const points=[];
 for(let i=0;i<a.count;i++){
  const p=first+i*(view.byteStride??12);
  points.push([b.readFloatLE(p),b.readFloatLE(p+4),b.readFloatLE(p+8)]);
 }
 return {points,primitive:prim};
}
test('HQ has two extra rear louvres with original embedded PBR textures in both teams',()=>{
 for(const owner of [0,1]){
  const glb=load(DIR+'headquarters-'+owner+'.glb'),doc=glb.json;
  assert.equal(doc.asset.extras?.sandforgeHQVents,'flush-hq-vents-rear-v1-20261116');
  assert.equal(doc.meshes.length,43);
  for(const [name,material] of [
   ['HQ_RearVent_Recess','HQ_PBR_RearVentRecess'],
   ['HQ_RearVent_Slats','HQ_PBR_RearVentSlats'],
   ['HQ_RearVent_Frame','HQ_PBR_RearVentFrame']]){
   const info=vertices(glb,name);
   assert.equal(doc.materials[info.primitive.material].name,material);
   assert.ok(info.primitive.attributes.TEXCOORD_0!==undefined);
   const xs=info.points.map(p=>p[0]),zs=info.points.map(p=>p[2]);
   assert.ok(Math.min(...xs)<-5.55&&Math.max(...xs)>5.55,'vent on BOTH back corners');
   assert.ok(Math.max(...zs)<-4.90,'rear vent must sit flush outside rear facade');
   assert.ok(doc.materials[info.primitive.material].pbrMetallicRoughness.baseColorTexture,
    'rear vents must use the original PBR maps');
  }
  for(const name of ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_Dome_Shell',
   'HQ_Radar_01_LargeDish_Rotor','HQ_Radar_03_MiniDish_Rotor'])
   assert.ok(doc.nodes.some(n=>n.name===name),'preserve door, dome and radar '+name);
 }
});
test('overlapping black side panels are behind the facade; original vents remain',()=>{
 for(const owner of [0,1]){
  const glb=load(DIR+'headquarters-'+owner+'.glb');
  for(const part of [
   'HQ_Static_HQ_PBR_antireflective_window','HQ_Static_HQ_PBR_black_grill']){
   const bad=vertices(glb,part).points.filter(([x,y,z])=>
    Math.abs(x)>7.05&&y>=1.60&&y<3.05&&z<3.30);
   assert.equal(bad.length,0,'no floating black side panels: '+part);
  }
  for(const part of ['HQ_Static_SF_VentRecessDark','HQ_Static_SF_VentSlatsGunmetal',
   'HQ_Static_SF_VentFrameCharcoal']){
   const points=vertices(glb,part).points;
   assert.ok(points.some(p=>p[0]>7.05));
   assert.ok(points.some(p=>p[0]<-7.05));
  }
 }
});
test('vent upgrade is idempotent on an already upgraded HQ GLB',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sandforge-hq-vents-')),dest=join(dir,'hq.glb');
 try{
  copyFileSync(DIR+'headquarters-0.glb',dest);
  const before=load(dest).json;
  execFileSync(process.execPath,['scripts/upgrade-hq-vents.mjs',dest],{stdio:'pipe'});
  const after=load(dest).json;
  assert.equal(after.meshes.length,before.meshes.length);
  assert.equal(after.nodes.length,before.nodes.length);
  assert.equal(after.images.length,before.images.length);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
