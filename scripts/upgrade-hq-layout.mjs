#!/usr/bin/env node
// Physically rearrange the authored PBR HQ roof, preserving materials, doors
// and radar pivots. Runs before upgrade-hq-dome.mjs on the original 35-mesh GLB.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
const VERSION='centered-command-dome-roof-v4-canopy-20261116';
const pad=n=>(4-n%4)%4;
const ROOF_RADARS=Object.freeze({
 'HQ_Radar_01_LargeDish_Rotor':[-4.90,5.79,-3.15],
 'HQ_Radar_02_PhasedArray_Rotor':[5.87,5.23,.20],
 'HQ_Radar_03_MiniDish_Rotor':[5.42,5.45,3.08]
});
const mastMove=[5.12,-.65];
// Side awning: same right-hand wall, but centered along the facade and ~55%
// wider, with the original supports, footplates and supplies following it.
const awningZ=z=>(z-2.75)*1.55+.18;
function readGlb(path){
 const b=readFileSync(path);
 if(b.length<28||b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
  throw Error('Invalid GLB 2: '+path);
 let json,bin;
 for(let o=12;o<b.length;){
  const length=b.readUInt32LE(o),tag=b.toString('ascii',o+4,o+8);
  if(o+8+length>b.length)throw Error('invalid chunk');
  if(tag==='JSON')json=JSON.parse(b.toString('utf8',o+8,o+8+length));
  if(tag==='BIN\0')bin=Buffer.from(b.subarray(o+8,o+8+length));
  o+=8+length;
 }
 if(!json||!bin||json.buffers?.length!==1)throw Error('Missing geometry/image buffers');
 return {json,bin};
}
function writeGlb(path,json,bin){
 json.buffers[0].byteLength=bin.length;
 const bytes=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.concat([bytes,Buffer.alloc(pad(bytes.length),0x20)]);
 const binChunk=pad(bin.length)?Buffer.concat([bin,Buffer.alloc(pad(bin.length))]):bin;
 const out=Buffer.alloc(12+8+jsonChunk.length+8+binChunk.length);
 out.write('glTF',0,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(jsonChunk.length,12);out.write('JSON',16,'ascii');jsonChunk.copy(out,20);
 const p=20+jsonChunk.length;out.writeUInt32LE(binChunk.length,p);out.write('BIN\0',p+4,'ascii');binChunk.copy(out,p+8);
 const tmp=path+'.roof-tmp';writeFileSync(tmp,out);readGlb(tmp);renameSync(tmp,path);
}
function upgrade(path){
 const {json,bin}=readGlb(path),nodes=new Map(json.nodes.map(n=>[n.name,n]));
 for(const name of ['HQ_Static_SF_OriginalPBR_canvas','HQ_Static_SF_AwningSteelFoot',
  'HQ_Static_HQ_PBR_radar_steel','HQ_Static_HQ_PBR_black_grill',
  'HQ_door_leaf_L','HQ_door_leaf_R',...Object.keys(ROOF_RADARS)])
  if(!nodes.has(name))throw Error('Missing authored HQ part: '+name);
 json.asset.extras??={};
 if(json.asset.extras.sandforgeHQRoofLayout===VERSION){console.log('Roof layout already updated: '+path);return;}
 if(json.asset.extras.sandforgeHQRoofLayout)throw Error('Unknown roof-layout version in '+path);
 let shifted=0;
 function changeVertices(name,predicate,transform){
  const node=nodes.get(name);if(!node||node.mesh===undefined)return;
  for(const primitive of json.meshes[node.mesh].primitives){
   const acc=json.accessors[primitive.attributes.POSITION];
   if(acc.componentType!==5126||acc.type!=='VEC3')throw Error('Unexpected POS accessor '+name);
   const view=json.bufferViews[acc.bufferView],stride=view.byteStride??12,start=(view.byteOffset??0)+(acc.byteOffset??0);
   if(stride<12)throw Error('Bad vertex stride '+name);
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<acc.count;i++){
    const p=start+i*stride;if(p+12>bin.length)throw Error('Out-of-bounds vertex '+name);
    let v=[bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)];
    if(predicate(...v)){v=transform(...v);for(let axis=0;axis<3;axis++)bin.writeFloatLE(v[axis],p+axis*4);shifted++;}
    for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],v[a]);hi[a]=Math.max(hi[a],v[a]);}
   }
   acc.min=lo;acc.max=hi;
  }
 }
 // Three real pivots remain independently animated by SandforgeBattlefield.
 for(const [name,target] of Object.entries(ROOF_RADARS)){
  const n=nodes.get(name);
  if(n.matrix){n.matrix[12]=target[0];n.matrix[13]=target[1];n.matrix[14]=target[2];}
  else n.translation=target.slice();
 }
 // The mast is combined by material. Move upper lattice, steel and light
 // to the right-rear roof corner without shifting windows or roof panels.
 const mast=(x,y,z)=>x>-.5&&x<1.55&&y>4.40&&z>-3.60&&z<-2.02;
 for(const name of ['HQ_Static_HQ_PBR_radar_steel','HQ_Static_HQ_PBR_black_grill'])
  changeVertices(name,mast,(x,y,z)=>[x+mastMove[0],y,z+mastMove[1]]);
 // The two teams name the same roof beacon differently after material
 // batching: blue_signal for blue, red_status for red. Both have the same
 // original upper-mast coordinates and must follow the moved lattice.
 const beacon=['HQ_Static_HQ_PBR_blue_signal','HQ_Static_HQ_PBR_red_status']
  .find(name=>nodes.has(name));
 if(!beacon)throw Error('Missing team-specific HQ mast beacon in '+path);
 changeVertices(beacon,()=>true,(x,y,z)=>[x+mastMove[0],y,z+mastMove[1]]);
 // Dedicated awning canopy and support footplates.
 for(const name of ['HQ_Static_SF_OriginalPBR_canvas','HQ_Static_SF_AwningSteelFoot'])
  changeVertices(name,()=>true,(x,y,z)=>[x,y,awningZ(z)]);
 // Matching steel braces and the crates under the canopy, not the facade.
 changeVertices('HQ_Static_SF_OriginalPBR_steel',
  (x,y,z)=>x>7.0&&y<4.25&&z>1.05&&z<4.55,(x,y,z)=>[x,y,awningZ(z)]);
 changeVertices('HQ_Static_SF_OriginalPBR_crates',
  (x,y,z)=>x>7.05&&z>1.05&&z<4.55,(x,y,z)=>[x,y,awningZ(z)]);
 // Some of the original steel support rods were coplanar with the stretched
 // fabric. They z-fought with the canvas and appeared as black diagonal cuts.
 // Keep the rods, but recess the parts under the actual sloped fabric plane.
 // Only the awning steel is affected, not the HQ walls, door or roof dishes.
 const fabricY=x=>3.4542+(x-6.9426)*(2.9184-3.4542)/(8.7318-6.9426);
 changeVertices('HQ_Static_SF_OriginalPBR_steel',
  (x,y,z)=>x>=6.91&&x<=8.75&&z>=-2.09&&z<=2.45&&
    y>fabricY(x)-.11&&y<fabricY(x)+.24,
  (x,y,z)=>[x,Math.min(y,fabricY(x)-.17),z]);
 json.asset.extras.sandforgeHQRoofLayout=VERSION;
 writeGlb(path,json,bin);
 console.log('HQ roof/awning/radars updated: '+path+' ('+shifted+' vertices)');
}
if(process.argv.length<3)throw Error('Usage: node scripts/upgrade-hq-layout.mjs <headquarters-0.glb> [headquarters-1.glb]');
for(const file of process.argv.slice(2))upgrade(resolve(file));
