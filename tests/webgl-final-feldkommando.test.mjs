import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {strategicGlbUrl} from '../scripts/webgl-strategic-glb.js';

const finalUrl='/src/assets/reborn/buildings-3d/sandforge_feldkommando_final.glb';
const path='src/assets/reborn/buildings-3d/sandforge_feldkommando_final.glb';
test('single final field HQ source serves live model, preview and strategic portrait',()=>{
 assert.equal(strategicGlbUrl('headquarters','inactive'),finalUrl);
 assert.equal(strategicGlbUrl('headquarters','active'),finalUrl);
 const scene=readFileSync('scripts/webgl-battlefield.js','utf8');
 const portrait=readFileSync('scripts/webgl-portraits.js','utf8');
 assert.match(scene,/if\(type==='building'&&kind==='headquarters'\)/);
 assert.match(scene,/return strategicGlbUrl\('headquarters','active'\)/);
 assert.match(portrait,/if\(kind==='headquarters'\)\{/);
 assert.match(scene,/SF_Feldkommando_Final/);
});
test('final HQ is a real mechanically articulated GLB, when locally installed',()=>{
 if(!existsSync(path))return; // binary is user-supplied until uploaded as asset commit
 const bytes=readFileSync(path);
 assert.equal(bytes.subarray(0,4).toString(),'glTF');
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const names=new Set(gltf.nodes.map(n=>n.name));
 for(const n of ['SF_Feldkommando_Final','Door_Left_Pivot','Door_Right_Pivot','Radar_Dish_Pivot'])
  assert.ok(names.has(n),'missing node '+n);
 for(const n of ['Doors_Open','Doors_Close','Doors_Cycle','Radar_Scan'])
  assert.ok(gltf.animations.some(a=>a.name===n),'missing clip '+n);
 const tris=gltf.meshes.reduce((sum,m)=>sum+m.primitives.reduce((acc,p)=>acc+gltf.accessors[p.indices].count/3,0),0);
 assert.equal(tris,10634,'authored source triangles plus dark single entrance');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'd40dbb535d754a4ab0e0532214ff2b3ae92fb7b011f1222c9c6ac8c41bca1151');
});
