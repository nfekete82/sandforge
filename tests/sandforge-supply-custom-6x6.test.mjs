import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const root='src/assets/reborn/supply-custom/';
function glb(team){
 const path=root+'supply-'+team+'.glb';
 assert.ok(existsSync(path),'authored custom supply GLB must be built: '+path);
 const bytes=readFileSync(path);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const length=bytes.readUInt32LE(12);
 const data=JSON.parse(bytes.subarray(20,20+length).toString('utf8').trim());
 const names=data.nodes.map(node=>node.name).filter(Boolean);
 return {bytes,data,names};
}
test('uploaded custom supply truck uses real PBR and separate 6x6 wheels',()=>{
 const a=glb(0),b=glb(1);
 assert.deepEqual(a.bytes,b.bytes,'team stripes are applied in Three.js not baked differently');
 assert.ok(a.data.meshes.length>=50,'premium hard-surface geometry');
 assert.ok(a.data.materials.length>=15,'authored game material palette');
 assert.ok(a.data.images.length>=2,'embedded camo and wooden crate textures');
 assert.ok(a.data.materials.some(mat=>mat.pbrMetallicRoughness?.baseColorTexture));
 for(const side of ['L','R'])
  for(const axle of ['FRONT','MID','REAR'])
   assert.ok(a.names.includes('wheel_'+axle+'_'+side),'each wheel has its own pivot');
 for(let i=0;i<8;i++)
  assert.ok(a.names.includes('cargo_stack_'+i),'each cargo stack must be independently hideable');
});
test('custom truck, HUD and build consume the same GLB rather than the old SVG icon',()=>{
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portraits=readFileSync('scripts/webgl-portraits.js','utf8');
 const logistics=readFileSync('scripts/webgl-supply-logistics.js','utf8');
 const custom=readFileSync('scripts/webgl-supply-custom.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(scene,/customSupplyTruckUrl\(owner\)/);
 assert.match(scene,/prepareCustomSupplyTruck\(model,entry\.owner\)/);
 assert.match(scene,/setSupplyTruckCargo\(entry\.detail\?\?entry\.placeholder,u\.supply/);
 assert.match(portraits,/loadAsync\(customSupplyTruckUrl\(0\)\)/);
 assert.match(portraits,/renderModelPortrait\(model,renderer,\{width:192,height:132\}\)/);
 assert.match(logistics,/setCustomSupplyCargo\(root,job\)/);
 assert.match(logistics,/animateCustomSupplyTruck\(root,entry,travel/);
 assert.match(custom,/cargo_stack_/);
 assert.match(custom,/wheel_/);
 assert.match(custom,/phase==='loading'/);
 assert.match(build,/cpSync\('scripts\/webgl-supply-custom\.js','dist\/webgl-supply-custom\.js'\)/);
});
