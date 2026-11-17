import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.env.SANDFORGE_SUPPLY_GLB_TEST_DIR??'dist/supply-pbr-qa';
function glb(name){
 const filename=join(dir,name),bytes=readFileSync(filename);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2,'GLB 2.0');
 assert.equal(bytes.readUInt32LE(8),bytes.length,'valid GLB file length');
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const jsonSize=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8').trim());
 const binOffset=20+jsonSize;
 assert.equal(bytes.toString('ascii',binOffset+4,binOffset+8),'BIN\0');
 assert.ok(json.buffers[0].byteLength<=bytes.readUInt32LE(binOffset),'GLB BIN chunk has sufficient bytes');
 assert.ok(json.meshes?.length>12,'meaningful detailed geometry');
 assert.ok(json.materials?.length>=10,'multi-material PBR atlas');
 assert.ok(json.images?.length>=10,'textures embedded in the GLB');
 assert.ok(json.materials.every(m=>m.pbrMetallicRoughness?.baseColorTexture),'all material groups actually textured');
 assert.ok(json.meshes.every(m=>m.primitives.every(p=>p.attributes.POSITION!==undefined&&
  p.attributes.NORMAL!==undefined&&p.attributes.TEXCOORD_0!==undefined)),'correct GLTF mesh attributes');
 const names=json.nodes.map(n=>n.name);
 return {json,names,bytes};
}
test('deterministically exported six-wheel faction GLBs contain real camo PBR materials',()=>{
 const blue=glb('supply-0.glb'),red=glb('supply-1.glb');
 assert.ok(blue.json.meshes.length>=25);
 assert.ok(red.json.meshes.length>=25);
 assert.notDeepEqual(blue.bytes,red.bytes,'faction paint is real in embedded GLB textures');
 for(const g of [blue,red]){
  assert.equal(g.names.filter(n=>/^SF_Supply_Wheel_[LR]_[012]$/.test(n)).length,6);
  assert.ok(g.names.includes('SF_Supply_Cargo'));
  assert.ok(g.names.includes('SF_Supply_CargoDoor_L'));
  assert.ok(g.names.includes('SF_Supply_CargoDoor_R'));
  for(const anim of ['SupplyWheelRoll','SupplyCargoDoorsOpen']){
   const clip=g.json.animations.find(a=>a.name===anim);
   assert.ok(clip,anim+' is exported as a real GLB animation');
   assert.ok(clip.channels.length>=2);
  }
 }
});
test('depot GLB contains a true storage hall and eighteen individually hideable pallet stacks',()=>{
 const g=glb('supply-depot-neutral.glb');
 assert.ok(g.json.meshes.length>=32,'substantial warehouse geometry and crates');
 const groups=g.names.filter(n=>/^SF_DepotStock_\d{2}$/.test(n));
 assert.equal(groups.length,18,'never draw all 18 tiny crates as one unhideable mesh');
 assert.ok(g.names.includes('SF_DepotLoadingRamp'));
 assert.ok(g.names.includes('SF_Depot_LoadBeacon'));
 assert.ok(g.json.animations.some(a=>a.name==='DepotRampLower'));
 assert.ok(g.json.animations.some(a=>a.name==='DepotBeaconPulse'));
});
test('WebGL integration loads authored models, never adds generic floating badges, keeps emptied warehouse',()=>{
 const stage=readFileSync('scripts/webgl-battlefield.js','utf8');
 const visuals=readFileSync('scripts/webgl-supply-logistics.js','utf8');
 const build=readFileSync('scripts/build.mjs','utf8');
 assert.match(stage,/supply-pbr\/supply-'/);
 assert.match(stage,/supply-depot-neutral\.glb/);
 assert.match(stage,/animateSupplyTruckRig/);
 assert.match(stage,/entry\.kind!=='supply'\)\s*attachTeamMarkings/);
 assert.match(visuals,/SF_DepotStock_/);
 assert.match(visuals,/root\.visible=true/);
 assert.match(visuals,/SF_Supply_Wheel_/);
 assert.match(visuals,/SF_Supply_CargoDoor_/);
 assert.match(build,/generate-supply-pbr\.mjs/);
 assert.ok(existsSync('scripts/generate-supply-pbr.mjs'));
});
