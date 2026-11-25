import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('scripts/webgl-battlefield.js','utf8');
const packaged='dist/src/assets/reborn/buildings-3d/';

function metadata(path){
 const buffer=readFileSync(path);
 assert.equal(buffer.toString('utf8',0,4),'glTF','GLB header');
 assert.equal(buffer.readUInt32LE(4),2,'GLB 2.0');
 assert.equal(buffer.readUInt32LE(8),buffer.length,'GLB length');
 assert.equal(buffer.toString('utf8',16,20),'JSON');
 const jsonLen=buffer.readUInt32LE(12);
 return JSON.parse(buffer.toString('utf8',20,20+jsonLen));
}

test('new HQ radar pivots are animated instead of adding fallback radar geometry',()=>{
 assert.match(source,/HQ_Radar_01_LargeDish_Rotor/);
 assert.match(source,/HQ_Radar_02_PhasedArray_Rotor/);
 assert.match(source,/HQ_Radar_03_MiniDish_Rotor/);
 assert.match(source,/mode:'authored-pbr-rotors'/);
 assert.match(source,/motion\.rotors\.forEach/);
 assert.match(source,/model\.userData\.sandforgeOriginalPBR=true/);
 assert.match(source,/mesh\.castShadow=true;mesh\.receiveShadow=true/);
});

test('HQ PBR GLB is real, UV-textured, and retains independent opening doors',()=>{
 const json=metadata(packaged+'headquarters-0.glb');
 const nodeNames=new Set(json.nodes.map(node=>node.name));
 for(const name of [
  'HQ_Radar_01_LargeDish_Rotor',
  'HQ_Radar_02_PhasedArray_Rotor',
  'HQ_Radar_03_MiniDish_Rotor',
  'HQ_door_leaf_L','HQ_door_leaf_R',
  'HQ_Static_SF_OriginalPBR_walls',
  'HQ_Static_SF_OriginalPBR_roof',
  'HQ_Static_HQ_PBR_antireflective_window'
 ])assert.ok(nodeNames.has(name),'missing named part: '+name);
 assert.ok(json.images.length>=18,'original PBR image textures must remain embedded');
 assert.ok(json.materials.some(x=>x.name==='SF_OriginalPBR_walls'));
 assert.ok(json.materials.some(x=>x.name==='HQ_PBR_radar_reflector'));
 assert.ok(json.meshes.length<=45,'keep this RTS asset in a small draw-call budget');
 assert.ok(json.meshes.length>=20,'must be a detailed 3D asset, not an image plane');
 assert.ok(json.meshes.some(x=>x.primitives.some(p=>p.attributes.TEXCOORD_0!==undefined)));
 assert.ok(json.meshes.every(x=>x.primitives.every(p=>p.attributes.POSITION!==undefined)));
});
test('both HQ team assets use the same geometry and preserve team selection',()=>{
 const filenames=['headquarters-0.glb','headquarters-1.glb'];
 const all=filenames.map(x=>metadata(packaged+x));
 assert.deepEqual(all.map(x=>x.meshes.length),[43,43],
  '35 original HQ meshes + three rear PBR vent batches + five dome surfaces');
 for(const g of all)assert.ok(g.materials.some(m=>m.name?.startsWith('HQ_PBR_')));
});
