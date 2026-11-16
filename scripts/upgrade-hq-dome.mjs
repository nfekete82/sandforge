#!/usr/bin/env node
// Sandforge HQ: PBR command dome for both HQ GLBs. Pure Node.js.
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
// Tall, centered observation dome makes the command centre distinct from
// the barracks. Radius +64%, height +~90%, atop the EXISTING larger HQ roof.
const N=48,PI=Math.PI,cx=0,cz=-.12,R=3.15,base=4.75,collar=5.50,top=8.12;
const surfaces=[['Shell','SF_OriginalPBR_roof'],['Base','SF_OriginalPBR_concrete'],
 ['Glazing','HQ_PBR_antireflective_window'],['Armour','HQ_PBR_radar_steel'],['Frame','HQ_PBR_black_grill']];
const vec=(a,r,y)=>[cx+r*Math.cos(a),y,cz+r*Math.sin(a)];
const normal=p=>{const n=Math.hypot(...p)||1;return p.map(v=>v/n);};
function mesh(){return {p:[],n:[],uv:[],idx:[]};}
function v(g,p,n,uv){const k=g.p.length/3;g.p.push(...p);g.n.push(...normal(n));g.uv.push(...uv);return k;}
function quad(g,a,b,c,d){
 const u=b.map((x,i)=>x-a[i]),w=c.map((x,i)=>x-a[i]);
 const n=normal([u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]);
 const q=[v(g,a,n,[0,0]),v(g,b,n,[1,0]),v(g,c,n,[1,1]),v(g,d,n,[0,1])];
 g.idx.push(q[0],q[1],q[2],q[0],q[2],q[3]);
}
function cylinder(g,r,y0,y1,a0=0,a1=PI*2){
 const steps=Math.max(1,Math.ceil(N*(a1-a0)/(PI*2)));
 for(let i=0;i<steps;i++){
  const a=a0+(a1-a0)*i/steps,b=a0+(a1-a0)*(i+1)/steps;
  quad(g,vec(a,r,y0),vec(a,r,y1),vec(b,r,y1),vec(b,r,y0));
 }
}
function ring(g,ri,ro,y){for(let i=0;i<N;i++){
 const a=2*PI*i/N,b=2*PI*(i+1)/N;
 quad(g,vec(a,ri,y),vec(b,ri,y),vec(b,ro,y),vec(a,ro,y));
}}
function geoms(){
 const g=Object.fromEntries(surfaces.map(([name])=>[name,mesh()]));
 const S=g.Shell,B=g.Base,G=g.Glazing,A=g.Armour,F=g.Frame;
 const rings=13;
 for(let i=0;i<=rings;i++){
  const t=.025+(PI/2-.025)*i/rings,rr=R*Math.sin(t),y=collar+(top-collar)*Math.cos(t);
  for(let j=0;j<=N;j++){
   const a=j*2*PI/N;
   v(S,vec(a,rr,y),[Math.sin(t)*Math.cos(a)/R,Math.cos(t)/(top-collar),Math.sin(t)*Math.sin(a)/R],[j/N*3,i/rings*1.7]);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<N;j++){
  const a=i*(N+1)+j,b=a+N+1;S.idx.push(a,a+1,b+1,a,b+1,b);
 }
 ring(S,0,R*Math.sin(.025),top);
 cylinder(B,R+.19,base,base+.37);ring(B,R-.04,R+.26,base+.39);
 for(let i=0;i<12;i++){
  const a=i*PI/6+.043,b=(i+1)*PI/6-.043;
  cylinder(G,R+.115,base+.13,base+.32,a,b);
  cylinder(F,R+.165,base+.10,base+.13,a,b);
  cylinder(F,R+.165,base+.32,base+.355,a,b);
 }
 cylinder(A,R+.195,base+.39,collar);
 cylinder(A,R+.235,base-.03,base+.10);
 cylinder(F,R+.235,base+.38,base+.43);
 ring(F,R-.07,R+.23,collar+.012);
 for(let i=0;i<12;i++){
  const phi=i*PI/6,half=.017;
  for(let k=0;k<10;k++){
   const points=t=>[vec(phi-half,R*Math.sin(t)+.017,collar+(top-collar)*Math.cos(t)+.019),
    vec(phi+half,R*Math.sin(t)+.017,collar+(top-collar)*Math.cos(t)+.019)];
   const [a,b]=points(.085+(PI/2-.11)*k/10),[c,d]=points(.085+(PI/2-.11)*(k+1)/10);
   quad(F,a,c,d,b);
  }
 }
 return g;
}
function load(file){
 const raw=readFileSync(file);
 if(raw.length<28||raw.toString('ascii',0,4)!=='glTF'||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length)
  throw Error('Ungültige GLB v2: '+file);
 let json,bin;
 for(let at=12;at<raw.length;){
  const len=raw.readUInt32LE(at),tag=raw.toString('ascii',at+4,at+8),start=at+8;
  if(start+len>raw.length)throw Error('Ungültiger GLB-Chunk: '+file);
  if(tag==='JSON')json=JSON.parse(raw.toString('utf8',start,start+len));
  if(tag==='BIN\0')bin=raw.subarray(start,start+len);
  at=start+len;
 }
 if(!json||!bin||json.buffers?.length!==1)throw Error('GLB ohne JSON/BIN: '+file);
 return {json,bin};
}
const pad=n=>(4-n%4)%4;
function upgrade(file){
 const {json,bin}=load(file),names=new Set(json.nodes.map(n=>n.name));
 for(const name of ['HQ_door_leaf_L','HQ_door_leaf_R','HQ_Radar_01_LargeDish_Rotor',
  'HQ_Radar_02_PhasedArray_Rotor','HQ_Radar_03_MiniDish_Rotor'])
  if(!names.has(name))throw Error('GLB ohne HQ-Bauteil: '+name+' '+file);
 if(names.has('HQ_Dome_Shell')){console.log('Kuppel bereits vorhanden: '+file);return;}
 const mat=new Map(json.materials.map((x,i)=>[x.name,i]));
 for(const [,m] of surfaces)if(!mat.has(m))throw Error('PBR Material fehlt: '+m);
 let cursor=bin.length;const chunks=[bin];
 const append=(typed,target)=>{
  const offsetPad=pad(cursor);if(offsetPad){chunks.push(Buffer.alloc(offsetPad));cursor+=offsetPad;}
  const bytes=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),offset=cursor;
  cursor+=bytes.length;chunks.push(bytes);
  const i=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});return i;
 };
 const accessor=(arr,size,type,bounds=false)=>{
  const view=append(arr,arr instanceof Uint32Array?34963:34962);
  const a={bufferView:view,componentType:arr instanceof Uint32Array?5125:5126,count:arr.length/size,type};
  if(bounds){a.min=Array(size).fill(Infinity);a.max=Array(size).fill(-Infinity);
   for(let i=0;i<arr.length;i++){
    const j=i%size;a.min[j]=Math.min(a.min[j],arr[i]);a.max[j]=Math.max(a.max[j],arr[i]);
   }
  }
  const i=json.accessors.length;json.accessors.push(a);return i;
 };
 const built=geoms();
 for(const [name,material] of surfaces){
  const g=built[name];
  const a=accessor(Float32Array.from(g.p),3,'VEC3',true);
  const b=accessor(Float32Array.from(g.n),3,'VEC3');
  const c=accessor(Float32Array.from(g.uv),2,'VEC2');
  const d=accessor(Uint32Array.from(g.idx),1,'SCALAR');
  const meshIdx=json.meshes.length;
  json.meshes.push({name:'HQ_Dome_'+name,primitives:[{attributes:{POSITION:a,NORMAL:b,TEXCOORD_0:c},indices:d,material:mat.get(material)}]});
  const nodeIdx=json.nodes.length;json.nodes.push({name:'HQ_Dome_'+name,mesh:meshIdx});
  json.nodes[0].children.push(nodeIdx);
 }
 if(pad(cursor)){chunks.push(Buffer.alloc(pad(cursor)));cursor+=pad(cursor);}
 json.buffers[0].byteLength=cursor;
 const data=Buffer.from(JSON.stringify(json)),str=Buffer.concat([data,Buffer.alloc(pad(data.length),32)]);
 const binary=Buffer.concat(chunks),out=Buffer.alloc(12+8+str.length+8+binary.length);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(str.length,12);out.write('JSON',16,4,'ascii');str.copy(out,20);
 const off=20+str.length;out.writeUInt32LE(binary.length,off);out.write('BIN\0',off+4,4,'ascii');binary.copy(out,off+8);
 const temp=file+'.dome-tmp';writeFileSync(temp,out);load(temp);renameSync(temp,file);
 console.log('Dachkuppel integriert: '+file+' ('+(out.length/1048576).toFixed(2)+' MiB)');
}
if(process.argv.length<3)throw Error('Usage: node scripts/upgrade-hq-dome.mjs <headquarters-0.glb> [headquarters-1.glb]');
for(const file of process.argv.slice(2))upgrade(resolve(file));
