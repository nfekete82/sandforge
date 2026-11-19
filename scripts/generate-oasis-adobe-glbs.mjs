#!/usr/bin/env node
/** Build five original, textured, game-ready GLB2 adobe buildings for Sandforge.
 * Deterministic, no external downloads, API or Blender required. Single
 * primitive per material, baked mineral textures and reasonable geometry count.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';

const OUTPUT=process.argv[2]??'src/assets/reborn/oasis-village';
const TYPES=['main-house','flat-house','courtyard-house','small-hut','ruined-house','market-house'];
const palette={
 plaster:[201,174,136],stone:[175,144,107],roof:[215,189,147],
 timber:[100,75,53],shadow:[54,47,42],tile:[174,129,85],accent:[143,106,72]
};
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b){let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
function pngChunk(name,data){const t=Buffer.from(name);return Buffer.concat([be(data.length),t,data,be(crc(Buffer.concat([t,data])))]);}
function png(name,normal=false){
 const w=128,h=128,raw=Buffer.alloc((w*4+1)*h),color=palette[name];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const index=y*(w*4+1)+1+x*4;
  const r=Math.sin((x*13.7+y*59.7+name.length*17)*1.37)*43758.5453;
  const noise=(r-Math.floor(r))-.5;
  const strata=Math.sin(y*.19+Math.sin(x*.11)*.78);
  const bricks=name==='stone'?((y%28)<2||((x+(Math.floor(y/28)%2)*21)%42)<2)?-.28:0:0;
  const wear=.11*strata+.22*noise+bricks;
  const channels=normal?
   [127+18*noise,127+17*strata,252]:
   color.map(v=>Math.max(1,Math.min(255,v*(.95+wear*.15))));
  raw[index]=channels[0];raw[index+1]=channels[1];
  raw[index+2]=channels[2];raw[index+3]=255;
 }
 const head=Buffer.alloc(13);head.writeUInt32BE(w,0);head.writeUInt32BE(h,4);head[8]=8;head[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',head),
  pngChunk('IDAT',deflateSync(raw,{level:7})),pngChunk('IEND',Buffer.alloc(0))]);
}
function makeBuilding(type){
 const groups=new Map();
 const material=name=>{if(!groups.has(name))groups.set(name,{p:[],n:[],uv:[],i:[]});return groups.get(name);};
 function tri(name,a,b,c,uv=[[0,0],[1,0],[1,1]]){
  const g=material(name),ab=b.map((n,i)=>n-a[i]),ac=c.map((n,i)=>n-a[i]);
  const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const len=Math.hypot(...cross)||1,normal=cross.map(v=>v/len);
  const i=g.p.length/3;
  for(let j=0;j<3;j++){g.p.push(...[a,b,c][j]);g.n.push(...normal);g.uv.push(...uv[j]);}
  g.i.push(i,i+1,i+2);
 }
 function quad(mat,a,b,c,d){tri(mat,a,b,c);tri(mat,a,c,d,[[0,0],[1,1],[0,1]]);}
 function box(mat,x,y,z,w,h,d,angle=0){
  if(w<=0||h<=0||d<=0)throw Error('Invalid box dimensions');
  const c=Math.cos(angle),s=Math.sin(angle);
  const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
   [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,e])=>{
   const xx=a*w*.5,zz=e*d*.5;return [x+xx*c+zz*s,y+b*h*.5,z+zz*c-xx*s];
  });
  for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],
   [1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(mat,v[a],v[b],v[c],v[d]);
 }
 function frameDoor(cx,front,width=14,height=21){
  box('shadow',cx,height/2+.4,front+.42,width,height,1.0);
  for(const side of [-1,1])box('stone',cx+side*(width/2+1.2),height/2+.4,front+.9,2.7,height+2,2.6);
  box('stone',cx,height+1.2,front+.9,width+7,3.3,2.7);
  box('timber',cx,height*.5,front+1.01,width*.77,height*.86,1.1);
  box('shadow',cx+width*.24,height*.47,front+1.7,.7,1.8,.6);
  for(let i=0;i<3;i++)box('stone',cx,1+i*1.6,front+3+i*1.9,width+7,1.1,3.7);
 }
 function window(x,y,front,width=10){
  box('shadow',x,y,front+.65,width,10,1.4);
  box('stone',x,y+6,front+1.1,width+4,2.7,2.3);
  box('stone',x,y-6,front+1.0,width+3,2.0,2.2);
  for(const dx of [-width*.24,width*.24])box('timber',x+dx,y,front+1.5,1.1,10,1);
 }
 function roof(w,d,h,cx=0,cz=0){
  box('tile',cx,h,cz,w+5,2.0,d+5);
  box('roof',cx,h+1.7,cz,w+5,.9,d+5);
  for(const side of [-1,1]){
   box('plaster',cx+side*w*.5,h+5.8,cz,4.8,9.2,d+7);
   box('stone',cx,h+5.8,cz+side*d*.5,w+8,9.2,4.8);
  }
  // Slight staggered lintels and rooftop skylight/water containers.
  box('stone',cx-w*.21,h+3.1,cz-d*.16,w*.15,4,d*.20);
 }
 function crate(x,z,s=1){box('timber',x,4*s,z,7*s,8*s,6*s);box('stone',x,8.5*s,z,7.4*s,1*s,6.4*s);}
 function house(w,d,h){
  box('stone',0,.85,0,w+9,2,d+9);
  box('plaster',0,h/2+1,0,w,h,d);
  // Underlying masonry and chipped corner ledges.
  for(const x of [-w*.5,w*.5])box('stone',x,h*.22,0,2.8,h*.44,d+2);
  roof(w,d,h+1);
  frameDoor(-w*.16,d*.5,13,h*.47);
  window(w*.30,h*.52,d*.5,10);
  window(-w*.35,h*.58,d*.5,8);
  for(const z of [-d*.31,d*.22])box('stone',w*.50,h*.61,z,1.7,h*.19,10);
  for(const x of [-w*.40,w*.40])box('timber',x,h+8,-d*.2,1.5,16,1.6);
 }
 if(type==='main-house'){
  house(116,98,48);
  box('plaster',35,31,-26,48,60,42);
  roof(48,42,61,35,-26);
  box('stone',-72,9,-5,12,18,95);
  box('stone',-50,8,-57,53,16,9);
  for(const x of [-78,-52])crate(x,63,.95);
  // Open air court and front awning.
  box('timber',37,26,57,58,3,22);
  for(const x of [10,66])box('timber',x,14,65,3,25,3);
 }else if(type==='flat-house'){
  house(96,74,40);
  box('stone',-54,9,-29,7,18,39);
  box('timber',24,24,49,35,2.5,19);
  for(const x of [10,38])box('timber',x,12,58,2.6,24,2.6);
  crate(-53,43,1.3);crate(-46,52,.73);
 }else if(type==='courtyard-house'){
  // U-shape with genuinely open courtyard and distinct roof elevations.
  box('stone',0,.9,0,142,2,132);
  box('plaster',-43,25,-13,47,48,112);
  box('plaster',43,23,-13,47,44,112);
  box('plaster',0,28,-46,126,54,47);
  roof(47,112,50,-43,-13);roof(47,112,46,43,-13);
  roof(126,47,56,0,-46);
  box('stone',0,10,63,146,18,7);
  box('stone',-70,13,20,7,23,84);
  frameDoor(-43,46,12,19);
  window(42,21,46,11);
  // Staircase and rooftop stairs.
  for(let i=0;i<5;i++)box('stone',38,1.8+i*3.7,-6+i*6,21,3.6+i*5,7);
  crate(15,33,1.4);
 }else if(type==='small-hut'){
  house(63,56,31);
  box('timber',-26,26,-6,23,2,19);
  for(const x of [-36,-19])box('timber',x,15,4,2,24,2);
  crate(36,35,1.15);
 }else if(type==='ruined-house'){
  box('stone',0,.85,0,98,2,85);
  box('plaster',-35,18,-24,21,35,38);
  box('plaster',7,14,-39,60,27,9);
  box('plaster',36,18,-10,10,35,70);
  box('plaster',-8,9,30,48,17,11);
  box('tile',-30,37,-22,28,2,22,.12);
  box('shadow',36,13,27,5,12,1);
  for(let i=0;i<13;i++){
   const a=i*2.399963,rad=31+(i%4)*13;
   box(i%3?'stone':'tile',Math.cos(a)*rad,1.2+(i%3),
    Math.sin(a)*rad,3+(i%3)*2,2+(i%4)*2,5+i%5,a);
  }
 }else if(type==='market-house'){
  house(104,78,41);
  box('plaster',60,18,-11,38,34,54);
  roof(38,54,36,60,-11);
  box('timber',-10,30,51,103,3,35);
  for(const x of [-53,-17,21,58])box('timber',x,16,67,3,29,3);
  for(let i=0;i<4;i++)crate(-44+i*21,74,.75+(i%2)*.3);
 }
 return groups;
}
function glb(name,groups){
 const gltf={asset:{version:'2.0',generator:'Sandforge Procedural Oasis Adobe PBR'},
  scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],
  buffers:[{byteLength:0}],bufferViews:[],accessors:[],images:[],textures:[],
  materials:[],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]};
 const chunks=[];let offset=0;
 const append=(raw,target)=>{
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
  const view=gltf.bufferViews.length;
  gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:raw.length,...(target?{target}:{})});
  chunks.push(raw);offset+=raw.length;return view;
 };
 const accessor=(values,dimensions,component=5126)=>{
  const raw=Buffer.alloc(values.length*4);
  for(let i=0;i<values.length;i++)if(component===5125)raw.writeUInt32LE(values[i],i*4);
   else raw.writeFloatLE(values[i],i*4);
  const view=append(raw,component===5125?34963:34962),a={
   bufferView:view,componentType:component,count:values.length/dimensions,
   type:dimensions===3?'VEC3':dimensions===2?'VEC2':'SCALAR'
  };
  if(component===5126&&dimensions===3){
   a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<values.length;i+=3)for(let j=0;j<3;j++){
    a.min[j]=Math.min(a.min[j],values[i+j]);a.max[j]=Math.max(a.max[j],values[i+j]);}
  }
  const id=gltf.accessors.length;gltf.accessors.push(a);return id;
 };
 for(const [materialName,g] of groups){
  const diffuse=gltf.textures.length;
  gltf.images.push({bufferView:append(png(materialName)),mimeType:'image/png'});
  gltf.textures.push({sampler:0,source:gltf.images.length-1});
  const normal=gltf.textures.length;
  gltf.images.push({bufferView:append(png(materialName,true)),mimeType:'image/png'});
  gltf.textures.push({sampler:0,source:gltf.images.length-1});
  const m=gltf.materials.length;
  gltf.materials.push({name:'oasis-'+materialName,normalTexture:{index:normal,scale:.37},
   pbrMetallicRoughness:{baseColorTexture:{index:diffuse},
    metallicFactor:0,roughnessFactor:.95},doubleSided:false});
  const mesh=gltf.meshes.length;
  gltf.meshes.push({name:materialName,primitives:[{
   attributes:{POSITION:accessor(g.p,3),NORMAL:accessor(g.n,3),TEXCOORD_0:accessor(g.uv,2)},
   indices:accessor(g.i,1,5125),material:m,mode:4
  }]});
  const node=gltf.nodes.length;gltf.nodes.push({mesh,name:materialName});
  gltf.scenes[0].nodes.push(node);
 }
 const binary=Buffer.concat(chunks);gltf.buffers[0].byteLength=binary.length;
 const json=Buffer.from(JSON.stringify(gltf)),jp=(4-json.length%4)%4,bp=(4-binary.length%4)%4;
 const output=Buffer.alloc(12+8+json.length+jp+8+binary.length+bp);
 let o=0;output.writeUInt32LE(0x46546c67,o);o+=4;output.writeUInt32LE(2,o);o+=4;
 output.writeUInt32LE(output.length,o);o+=4;output.writeUInt32LE(json.length+jp,o);o+=4;
 output.writeUInt32LE(0x4e4f534a,o);o+=4;
 json.copy(output,o);o+=json.length;output.fill(32,o,o+jp);o+=jp;
 output.writeUInt32LE(binary.length+bp,o);o+=4;output.writeUInt32LE(0x004e4942,o);o+=4;
 binary.copy(output,o);o+=binary.length;output.fill(0,o,o+bp);
 return output;
}
mkdirSync(OUTPUT,{recursive:true});
for(const kind of TYPES){
 const bytes=glb(kind,makeBuilding(kind));
 const filename=join(OUTPUT,'oasis-'+kind+'.glb');
 writeFileSync(filename,bytes);
 console.log('Generated '+filename+': '+bytes.length+' bytes (embedded PBR PNGs)');
}
