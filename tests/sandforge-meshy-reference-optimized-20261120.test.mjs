import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareMeshyFactory} from '../scripts/prepare-meshy-factory.mjs';
const path='src/assets/reborn/buildings-3d/factory-meshy-optimized.glb';
function inspect(b){
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(8),b.length);
 const n=b.readUInt32LE(12),doc=JSON.parse(b.toString('utf8',20,20+n));
 const triangles=doc.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>
  sum+(doc.accessors[p.indices]?.count??0)/3,0);
 return {doc,triangles,bytes:b.length};
}
test('actual Meshy 7.1 reference model is present and optimized for interactive RTS',()=>{
 assert.ok(existsSync(path));
 const {doc,triangles,bytes}=inspect(readFileSync(path));
 assert.ok(triangles>=35000&&triangles<=130000,'must not render source 2M triangles');
 assert.ok(bytes<10_000_000,'must not serve original 69 MB model');
 assert.ok(doc.materials.length>0&&doc.textures.length>=3);
 assert.ok(doc.materials.some(m=>m.normalTexture&&
  m.pbrMetallicRoughness?.metallicRoughnessTexture&&
  m.pbrMetallicRoughness?.baseColorTexture));
 assert.equal(doc.extensionsUsed?.includes('EXT_meshopt_compression'),false,
  'do not require extra decoder not configured in existing GLTFLoader');
});
test('Meshy now becomes the real player and enemy factory with a removable 3D shutter',()=>{
 const output=mkdtempSync(join(tmpdir(),'sandforge-meshy-qa-'));
 try{
  const result=prepareMeshyFactory(path,output);
  assert.equal(result.status,'ready');
  assert.equal(result.output.length,2);
  for(let team=0;team<2;team++){
   const {doc,triangles}=inspect(readFileSync(join(output,'factory-'+team+'.glb')));
   assert.ok(triangles>35000);
   assert.ok(doc.nodes.some(n=>n.name==='SF_Factory_Meshy_ProductionRig'));
   assert.ok(doc.nodes.some(n=>n.name==='FactoryRollupDoor'));
   assert.ok(doc.nodes.some(n=>n.name==='SF_Factory_Meshy_RolloutExit'));
   assert.equal(doc.nodes.some(n=>n.name==='SF_Factory_PBR_OpenBay'),false);
   assert.equal(doc.asset.extras.owner,team);
  }
 }finally{rmSync(output,{recursive:true,force:true});}
});
test('the actual game now selects real Meshy shutter GLBs and keeps procedural backup',()=>{
 const build=readFileSync('scripts/build.mjs','utf8');
 const battle=readFileSync('scripts/webgl-battlefield.js','utf8');
 const viewer=readFileSync('scripts/webgl-meshy-factory-viewer.js','utf8');
 assert.match(build,/prepare-meshy-factory\.mjs/);
 assert.match(build,/factory-meshy-source\.glb.*force:true/);
 assert.match(battle,/SF_Factory_Meshy_ProductionRig/);
 assert.match(battle,/paintMeshyFactoryTeam/);
 assert.match(viewer,/factory-procedural-0\.glb/);
 assert.match(viewer,/factory-0\.glb/);
 assert.match(build,/webgl-meshy-factory\.html/);
});
