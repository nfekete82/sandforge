import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {strategicGlbUrl} from '../scripts/webgl-strategic-glb.js';

const url='/src/assets/reborn/buildings-3d/sandforge_feldkommando_lowpoly_1geschoss.glb';
const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_lowpoly_1geschoss.glb';
const sha256='9510d83548e798a3daf42e139a5984255b33088ccda3cda7d761b1b920dea3b9';

test('single low-poly HQ source serves gameplay, building preview and HUD portrait',()=>{
 assert.equal(strategicGlbUrl('headquarters','inactive'),url);
 assert.equal(strategicGlbUrl('headquarters','active'),url);
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(scene,/if\(type==='building'&&kind==='headquarters'\)/);
 assert.match(scene,/return strategicGlbUrl\('headquarters','active'\)/);
 assert.match(portrait,/renderStrategicPortrait\(kind,renderer\)/);
 assert.match(scene,/getObjectByName\('Radar_Pivot'\)/);
});

test('original 3,842-triangle low-poly GLB has exactly one real doorway and radar pivot',()=>{
 assert.ok(existsSync(path), 'GitHub asset installer must commit the exact low-poly GLB');
 const bytes=readFileSync(path);
 assert.equal(bytes.subarray(0,4).toString(),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.length,98228);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sha256);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const names=new Set(gltf.nodes.map(n=>n.name));
 for(const name of ['Gate_Left_Pivot','Gate_Right_Pivot','Radar_Pivot',
  'HQ_Flag','TeamBanner_Left','TeamBanner_Right'])assert.ok(names.has(name),name);
 assert.ok(!gltf.animations?.length, 'rotating door and radar pivots are animated at runtime');
 const tris=gltf.meshes.reduce((sum,m)=>sum+m.primitives.reduce(
  (acc,p)=>acc+gltf.accessors[p.indices].count/3,0),0);
 assert.equal(tris,3842);
 assert.equal(gltf.materials.filter(m=>m.pbrMetallicRoughness?.baseColorTexture).length,0,
  'the building has material colors, not moving projected texture maps');
});

test('low-poly HQ has one hinged gate, isolated radar and faction-safe flat PBR materials',()=>{
 const gates=readFileSync('scripts/webgl-production-gates.js','utf8');
 const accents=readFileSync('scripts/webgl-faction-accents.js','utf8');
 assert.match(gates,/portal\.hinged/);
 assert.match(gates,/Gate_Left_Pivot/);
 assert.match(gates,/Gate_Right_Pivot/);
 assert.match(accents,/sandforgeLowpolyTeamCloth/);
});
