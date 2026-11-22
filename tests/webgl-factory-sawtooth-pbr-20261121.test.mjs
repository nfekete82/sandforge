import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FACTION_PAINT,factionRgb8} from '../scripts/sandforge-faction-palette.js';
const source=readFileSync('scripts/generate-factory-pbr.mjs','utf8');
const FACTORY_SAWTOOTH_BAYS=3,FACTORY_GATE_OPEN_HEIGHT=1.70;
const FACTORY_SAWTOOTH_ROOF_REVISION='factory-three-bay-sawtooth-pbr-20261121';
assert.match(source,/export const FACTORY_SAWTOOTH_BAYS=3;/);
assert.match(source,/export const FACTORY_SAWTOOTH_ROOF_REVISION/);

function glb(owner){
 const bin=readFileSync('src/assets/reborn/buildings-3d/factory-'+owner+'.glb');
 assert.equal(bin.toString('utf8',0,4),'glTF');
 assert.equal(bin.readUInt32LE(4),2);
 assert.equal(bin.readUInt32LE(8),bin.length);
 const len=bin.readUInt32LE(12),doc=JSON.parse(bin.toString('utf8',20,20+len));
 return {bin,doc,start:20+len+8};
}
function material(doc,name){
 const found=doc.materials.find(m=>m.name==='Sandforge_Factory_'+name);
 assert.ok(found,'missing material '+name);return found;
}
function node(doc,name){
 const found=doc.nodes.find(n=>n.name===name);
 assert.ok(found,'missing model part '+name);
 return doc.meshes[found.mesh];
}
function points(file,name){
 const mesh=node(file.doc,name),primitive=mesh.primitives[0];
 const acc=file.doc.accessors[primitive.attributes.POSITION];
 const view=file.doc.bufferViews[acc.bufferView],out=[];
 for(let i=0;i<acc.count;i++){
  const at=file.start+view.byteOffset+(acc.byteOffset||0)+i*12;
  out.push([file.bin.readFloatLE(at),file.bin.readFloatLE(at+4),
   file.bin.readFloatLE(at+8)]);
 }
 return out;
}
function image(file,textureIndex){
 const doc=file.doc;
 const texture=doc.textures[textureIndex],
  view=doc.bufferViews[doc.images[texture.source].bufferView];
 const buf=file.bin.subarray(file.start+view.byteOffset,
  file.start+view.byteOffset+view.byteLength);
 assert.equal(buf.toString('hex',0,8),'89504e470d0a1a0a');
 return {width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
}

test('both team factories have REAL 3-bay sawtooth geometry plus proper embedded roof PBR atlases',()=>{
 assert.equal(FACTORY_SAWTOOTH_BAYS,3);
 for(const owner of [0,1]){
  const file=glb(owner),doc=file.doc;
  assert.equal(doc.asset.generator,FACTORY_SAWTOOTH_ROOF_REVISION);
  assert.ok(doc.nodes.some(n=>n.name==='FactoryRollupDoor'),'existing animated exit must survive');
  const roof=points(file,'SF_Factory_PBR_roof_metal');
  assert.equal(roof.length,FACTORY_SAWTOOTH_BAYS*6,
   'three physical sloping roof quads, not flat visual stickers');
  // An actual continuous 3-bay sawtooth shares X-boundaries between
  // adjacent sections: N panels have exactly N+1 unique X edges.
  const xs=new Set(roof.map(p=>p[0].toFixed(2)));
  assert.equal(xs.size,FACTORY_SAWTOOTH_BAYS+1,
   'neighboring sawtooth bays share their four physical edge coordinates');
  const bays=Array.from({length:FACTORY_SAWTOOTH_BAYS},(_,i)=>
   roof.slice(i*6,(i+1)*6));
  for(const [i,vertices] of bays.entries()){
   const left=Math.min(...vertices.map(p=>p[0]));
   const right=Math.max(...vertices.map(p=>p[0]));
   const low=Math.min(...vertices.map(p=>p[1]));
   const high=Math.max(...vertices.map(p=>p[1]));
   assert.ok(right-left>.9,'bay '+i+' must have real roof surface width');
   assert.ok(high-low>.55,'bay '+i+' must incline to a raised ridge');
   const leftY=vertices.filter(p=>Math.abs(p[0]-left)<.001).map(p=>p[1]);
   const rightY=vertices.filter(p=>Math.abs(p[0]-right)<.001).map(p=>p[1]);
   assert.ok(Math.max(...leftY)<Math.min(...rightY)-.55,
    'bay '+i+' must rise from its lower edge to its crest');
   if(i>0){
    const preceding=bays[i-1];
    const oldRight=Math.max(...preceding.map(p=>p[0]));
    assert.ok(Math.abs(oldRight-left)<.001,
     'consecutive bays must touch without a gap');
    const oldHigh=Math.max(...preceding.map(p=>p[1]));
    assert.ok(oldHigh-low>.55,
     'each new bay must reset downward to produce the sawtooth profile');
   }
  }
  const windows=points(file,'SF_Factory_PBR_roof_glass');
  assert.equal(windows.length,FACTORY_SAWTOOTH_BAYS*6*6,
   'every bay has six real upper-light windows');
  const glass=material(doc,'roof_glass'),metal=material(doc,'roof_metal'),
   trim=material(doc,'roof_trim');
  assert.equal(glass.alphaMode,'BLEND');
  assert.ok(glass.emissiveFactor.some(n=>n>.1),'glass should glow warm');
  for(const m of [glass,metal,trim]){
   assert.ok(m.normalTexture,'real glTF normal map is required');
   assert.ok(m.pbrMetallicRoughness.metallicRoughnessTexture,
    'real glTF roughness/metallic atlas is required');
   const tex=m.pbrMetallicRoughness.baseColorTexture.index;
   assert.equal(image(file,tex).width,512,'roof albedo is a 512px atlas');
   assert.equal(image(file,m.normalTexture.index).width,256);
   assert.equal(image(file,m.pbrMetallicRoughness.metallicRoughnessTexture.index).width,256);
  }
  assert.equal(image(file,material(doc,'camo').pbrMetallicRoughness.baseColorTexture.index).width,512,
   'desert camouflage walls must also receive an authored texture');
  assert.ok(file.bin.length<3_000_000,'optimized single-building asset');
 }
});
test('the real garage door, roof footprint, and faction strips remain intact',()=>{
 for(const owner of [0,1]){
  const file=glb(owner);
  const gate=points(file,'FactoryRollupDoor'),
   roof=points(file,'SF_Factory_PBR_roof'),
   paint=points(file,'SF_Factory_PBR_team');
  const y=gate.map(p=>p[1]);
  assert.ok(Math.max(...y)-Math.min(...y)>=FACTORY_GATE_OPEN_HEIGHT-.01,
   'the animated factory door must not be blocked by new roof');
  assert.ok(Math.max(...roof.map(p=>p[0]))-Math.min(...roof.map(p=>p[0]))>5.5,
   'building footprint remains unchanged');
  const paintOnRoof=paint.filter(p=>p[1]>2.60);
  assert.ok(paintOnRoof.length>=FACTORY_SAWTOOTH_BAYS*6,
   'the same blue or red faction paint must sit on all three slopes');
  const materialTeam=material(file.doc,'team');
  assert.ok(materialTeam.extensions?.KHR_materials_unlit,
   'faction paint must retain existing unlit palette treatment');
  assert.ok(FACTION_PAINT[owner]);
  assert.equal(factionRgb8(owner).length,3);
 }
});
