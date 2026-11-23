import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

function gltfFromGlb(file){
 const bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'glTF','valid GLB magic');
 assert.equal(bytes.readUInt32LE(4),2,'GLB version 2');
 assert.equal(bytes.readUInt32LE(8),bytes.length,'complete GLB without padding error');
 const jsonLength=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 return JSON.parse(bytes.toString('utf8',20,20+jsonLength).trim());
}
test('clean production build ships both blue and red fully textured flame tanks',()=>{
 for(const team of [0,1]){
  const path='dist/src/assets/reborn/animation/flamer-'+team+'.glb';
  assert.ok(existsSync(path),'ship a usable GLB for faction '+team);
  const gltf=gltfFromGlb(path);
  assert.ok(gltf.meshes?.length>=12,'detailed front/side/track model');
  assert.ok(gltf.images?.length>=12,'embedded PBR maps survive the build');
  assert.ok(gltf.materials.some(m=>m.name==='SF_Flamer_sand'));
  assert.ok(gltf.materials.some(m=>m.name==='SF_Flamer_rubber'));
  assert.ok(gltf.materials.some(m=>m.name==='SF_Flamer_team'));
  assert.ok(gltf.meshes.some(m=>/Track_L/.test(m.name)));
  assert.ok(gltf.meshes.some(m=>/Track_R/.test(m.name)));
  assert.ok(gltf.meshes.some(m=>/Flame_Projector/.test(m.name)));
 }
});
