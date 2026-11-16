#!/usr/bin/env node
// Replace doubled-up side window plates with the original flush PBR louvers
// and add matching rear vents. Never alter entrance, radar pivots or textures.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
const VERSION='flush-hq-vents-rear-v1-20261116';
const pad=n=>(4-n%4)%4;
function parse(path){
 const b=readFileSync(path);
 if(b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)
  throw Error('Invalid GLB: '+path);
 const length=b.readUInt32LE(12);
 if(b.toString('ascii',16,20)!=='JSON')throw Error('GLB without JSON');
 const json=JSON.parse(b.toString('utf8',20,20+length)),at=20+length;
 if(b.toString('ascii',at+4,at+8)!=='BIN\0')throw Error('GLB without BIN');
 const bin=Buffer.from(b.subarray(at+8,at+8+b.readUInt32LE(at)));
 return {json,bin};
}
function box(g,x,y,z,w,h,d){
 const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,k=z+d/2;
 const v=[[a,c,f],[b,c,f],[b,e,f],[a,e,f],[a,c,k],[b,c,k],[b,e,k],[a,e,k]];
 for(const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){
  const off=g.p.length/3;
  for(let i=0;i<4;i++){g.p.push(...v[face[i]]);g.uv.push(...[[0,0],[1,0],[1,1],[0,1]][i]);}
  g.indices.push(off,off+1,off+2,off,off+2,off+3);
 }
}
function upgrade(path){
 const {json,bin}=parse(path),nodes=new Map(json.nodes.map(n=>[n.name,n]));
 json.asset.extras??={};
 if(json.asset.extras.sandforgeHQVents===VERSION){console.log('HQ vents already fixed: '+path);return;}
 if(json.asset.extras.sandforgeHQVents)throw Error('Unknown HQ vent revision in '+path);
 const side=['HQ_Static_HQ_PBR_antireflective_window','HQ_Static_HQ_PBR_black_grill'];
 const sourceMaterials=['HQ_PBR_antireflective_window','HQ_PBR_black_grill','HQ_PBR_radar_steel'];
 const mats=['HQ_PBR_RearVentRecess','HQ_PBR_RearVentSlats','HQ_PBR_RearVentFrame'];
 for(const name of [...side,'HQ_Static_SF_VentRecessDark','HQ_Static_SF_VentSlatsGunmetal','HQ_Static_SF_VentFrameCharcoal'])
  if(!nodes.has(name))throw Error('Missing original HQ mesh: '+name);
 const materials=new Map(json.materials.map((m,i)=>[m.name,i]));
 for(const name of sourceMaterials)if(!materials.has(name))throw Error('Missing original PBR material '+name);
 // Reuse embedded color/normal/roughness maps of existing military steel;
 // darken the tints to match the original Kasernenvent slats and housings.
 const tints=[[.38,.40,.39,1],[.72,.73,.71,1],[.42,.45,.43,1]];
 for(let i=0;i<mats.length;i++){
  const source=json.materials[materials.get(sourceMaterials[i])];
  const clone=JSON.parse(JSON.stringify(source));
  clone.name=mats[i];clone.pbrMetallicRoughness.baseColorFactor=tints[i];
  const idx=json.materials.length;json.materials.push(clone);materials.set(mats[i],idx);
 }
 // Authored black glass and black frames cover the ORIGINAL side louvers.
 // Hide ONLY the four side overlays inside the facade; leave side vents,
 // front windows and the animated HQ entry completely untouched.
 let moved=0;
 for(const name of side)for(const prim of json.meshes[nodes.get(name).mesh].primitives){
  const a=json.accessors[prim.attributes.POSITION],view=json.bufferViews[a.bufferView];
  if(a.type!=='VEC3'||a.componentType!==5126)throw Error('Unexpected GLB vertices '+name);
  const first=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??12;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<a.count;i++){
   const p=first+i*stride,v=[bin.readFloatLE(p),bin.readFloatLE(p+4),bin.readFloatLE(p+8)];
   if(Math.abs(v[0])>7.05&&v[1]>=1.60&&v[1]<3.05&&v[2]<3.30){
    v[0]=Math.sign(v[0])*6.68;bin.writeFloatLE(v[0],p);moved++;
   }
   for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}
  }
  a.min=lo;a.max=hi;
 }
 if(moved<130)throw Error('Expected side overlays missing: '+moved);
 const recess={p:[],uv:[],indices:[]},slats={p:[],uv:[],indices:[]},frame={p:[],uv:[],indices:[]};
 // Rear wall already has one wide central grille. Two matching vent assemblies
 // flank it, using the EXACT embedded louver PBR materials from both sides.
 for(const x of [-4.90,4.90]){
  box(recess,x,2.73,-5.015,1.65,.92,.12);
  for(let i=0;i<5;i++)box(slats,x,2.42+i*.148,-5.115,1.39,.062,.055);
  box(frame,x,2.25,-5.135,1.76,.095,.11);
  box(frame,x,3.20,-5.135,1.76,.095,.11);
  box(frame,x-.827,2.725,-5.135,.095,.97,.11);
  box(frame,x+.827,2.725,-5.135,.095,.97,.11);
 }
 let cursor=bin.length;const chunks=[bin];
 function view(array,target){
  if(pad(cursor)){chunks.push(Buffer.alloc(pad(cursor)));cursor+=pad(cursor);}
  const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),offset=cursor;
  chunks.push(bytes);cursor+=bytes.length;
  const idx=json.bufferViews.length;
  json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});return idx;
 }
 function accessor(array,size,type,bounds=false){
  const idx=json.accessors.length;
  const result={bufferView:view(array,array instanceof Uint32Array?34963:34962),
   componentType:array instanceof Uint32Array?5125:5126,count:array.length/size,type};
  if(bounds){
   result.min=Array(size).fill(Infinity);result.max=Array(size).fill(-Infinity);
   for(let i=0;i<array.length;i++){const axis=i%size;
    result.min[axis]=Math.min(result.min[axis],array[i]);
    result.max[axis]=Math.max(result.max[axis],array[i]);
   }
  }
  json.accessors.push(result);return idx;
 }
 for(const [name,geometry,material] of [['Recess',recess,mats[0]],['Slats',slats,mats[1]],['Frame',frame,mats[2]]]){
  const pos=accessor(Float32Array.from(geometry.p),3,'VEC3',true);
  const uv=accessor(Float32Array.from(geometry.uv),2,'VEC2');
  const indices=accessor(Uint32Array.from(geometry.indices),1,'SCALAR');
  const mesh=json.meshes.length;
  json.meshes.push({name:'HQ_RearVent_'+name,primitives:[{
   attributes:{POSITION:pos,TEXCOORD_0:uv},indices,material:materials.get(material)
  }]});
  const node=json.nodes.length;json.nodes.push({name:'HQ_RearVent_'+name,mesh});
  json.nodes[0].children.push(node);
 }
 if(pad(cursor)){chunks.push(Buffer.alloc(pad(cursor)));cursor+=pad(cursor);}
 json.buffers[0].byteLength=cursor;json.asset.extras.sandforgeHQVents=VERSION;
 const j=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.concat([j,Buffer.alloc(pad(j.length),32)]);
 const binary=Buffer.concat(chunks),out=Buffer.alloc(12+8+jsonChunk.length+8+binary.length);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(jsonChunk.length,12);out.write('JSON',16,4,'ascii');jsonChunk.copy(out,20);
 const start=20+jsonChunk.length;
 out.writeUInt32LE(binary.length,start);out.write('BIN\0',start+4,4,'ascii');binary.copy(out,start+8);
 const tmp=path+'.vent-tmp';writeFileSync(tmp,out);parse(tmp);renameSync(tmp,path);
 console.log('Flush side + matching rear vents: '+path+' ('+moved+' overlapping vertices hidden)');
}
if(process.argv.length<3)throw Error('Usage: node scripts/upgrade-hq-vents.mjs <HQ-blue.glb> [HQ-red.glb]');
for(const file of process.argv.slice(2))upgrade(resolve(file));
