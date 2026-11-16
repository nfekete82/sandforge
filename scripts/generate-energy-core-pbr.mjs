#!/usr/bin/env node
// Reproducible Sandforge Energy Core GLBs: a genuinely small desert housing
// underneath one tall, wide, translucent glass energy cylinder. All faction
// energy accents use the exact central blue/red faction palette.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {factionRgb8} from './sandforge-faction-palette.js';
const OUT=process.argv[2]||'src/assets/reborn/buildings-3d';
const PI=Math.PI,TAU=2*PI;
// Gameplay/placement/collision live entirely in Simulation, not this GLB.
export const ENERGY_CORE_VERSION='small-glass-energy-cylinder-v2-20261116';
export const ENERGY_GLASS_CYLINDER=Object.freeze({radius:1.15,bottom:1.98,top:4.22,sides:24});
const FACTORY_WIDTH_FACTOR=1;
const colors={
 camo:[198,177,137],sand:[211,193,157],sand_light:[224,204,170],
 khaki:[148,144,113],olive:[92,107,82],roof:[90,95,77],
 concrete:[132,130,111],stone:[177,165,138],
 steel:[91,98,91],steel_dark:[45,51,50],steel_light:[142,146,128],
 door:[73,81,76],vent:[41,49,48],glass:[150,192,201],
 energy:factionRgb8(0),
 warning:[201,161,89],team:factionRgb8(0),white:[226,216,184]
};
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,t)=>a.map(x=>x*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const pt=(radius,y,angle)=>[radius*Math.cos(angle),y,radius*Math.sin(angle)];
const groups=new Map();
function material(name,rotor=false){const key=(rotor?'r:':'s:')+name;if(!groups.has(key))groups.set(key,{name,rotor,p:[],n:[],uv:[],i:[]});return groups.get(key)}
function tri(g,a,b,c,uv=[[0,0],[1,0],[1,1]]){const normal=unit(cross(sub(b,a),sub(c,a))),index=g.p.length/3;for(const [k,v]of [a,b,c].entries()){g.p.push(...v);g.n.push(...normal);g.uv.push(...uv[k]);}g.i.push(index,index+1,index+2)}
function quad(g,a,b,c,d){tri(g,a,b,c);tri(g,a,c,d,[[0,0],[1,1],[0,1]])}
function box(mat,at,size,rotation=0,rotor=false){
 const g=material(mat,rotor),[sx,sy,sz]=size.map(x=>x/2),co=Math.cos(rotation),si=Math.sin(rotation);
 const p=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]].map(([x,y,z])=>[(at[0]+x*co+z*si)*FACTORY_WIDTH_FACTOR,at[1]+y,at[2]+z*co-x*si]);
 for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(g,p[a],p[b],p[c],p[d]);
}
function frustum(mat,y0,y1,r0,r1,sides=12,angle=PI/8){
 const g=material(mat);for(let i=0;i<sides;i++){let a=i*TAU/sides+angle,b=(i+1)*TAU/sides+angle;
 quad(g,pt(r0,y0,a),pt(r0,y0,b),pt(r1,y1,b),pt(r1,y1,a));
 tri(g,[0,y0,0],pt(r0,y0,b),pt(r0,y0,a));tri(g,[0,y1,0],pt(r1,y1,a),pt(r1,y1,b));
 }
}
function ring(mat,y,r0,r1,height=.13,sides=12){
 const g=material(mat);for(let i=0;i<sides;i++){const a=TAU*i/sides,b=TAU*(i+1)/sides;
 quad(g,pt(r0,y,a),pt(r1,y,a),pt(r1,y,b),pt(r0,y,b));
 quad(g,pt(r0,y+height,a),pt(r0,y+height,b),pt(r1,y+height,b),pt(r1,y+height,a));
 quad(g,pt(r1,y,a),pt(r1,y+height,a),pt(r1,y+height,b),pt(r1,y,b));
 }
}
function cylinder(mat,r,y0,y1,sides=12,at=[0,0,0],rotor=false){
 const g=material(mat,rotor);for(let i=0;i<sides;i++){const a=i*TAU/sides,b=(i+1)*TAU/sides,p=(ang,y)=>add(pt(r,y,ang),at);
 quad(g,p(a,y0),p(b,y0),p(b,y1),p(a,y1));tri(g,add([0,y1,0],at),p(a,y1),p(b,y1));
 }
}
function beam(mat,a,b,width=.09,rotor=false){
 const direction=unit(sub(b,a)),right=unit(cross(direction,[0,0,1])),forward=unit(cross(direction,right));
 const offset=(p,x,z)=>add(add(p,mul(right,x)),mul(forward,z)),w=width/2;
 const low=[offset(a,-w,-w),offset(a,w,-w),offset(a,w,w),offset(a,-w,w)],high=[offset(b,-w,-w),offset(b,w,-w),offset(b,w,w),offset(b,-w,w)],g=material(mat,rotor);
 for(let i=0;i<4;i++){const j=(i+1)%4;quad(g,low[i],low[j],high[j],high[i]);}quad(g,...low.slice().reverse());quad(g,...high);
}
function star(x,y,z,r=.105){
 const g=material('white'),center=[x*FACTORY_WIDTH_FACTOR,y,z],points=[];
 for(let i=0;i<10;i++){const a=PI/2+i*TAU/10,d=i%2?r*.43:r;
  points.push([(x+d*Math.cos(a))*FACTORY_WIDTH_FACTOR,y+d*Math.sin(a),z]);}
 for(let i=0;i<10;i++)tri(g,center,points[i],points[(i+1)%10]);
}
/** Deliberately lower, narrower desert bunker with a large, framed glass
 * reactor tube taking centre stage ABOVE the roof. The original energy-core
 * building has been replaced, not piled with more free-standing decoration.
 *
 * Local units remain small and source-controlled. webgl-scale.js gives this
 * specific building a smaller render footprint without modifying collision.
 */
function buildParts(){
 groups.clear();
 // Low single-storey shell, materially smaller than the previous 5.0m hall.
 box('concrete',[0,.10,0],[3.80,.20,3.37]);
 box('stone',[0,.23,0],[3.64,.18,3.22]);
 box('camo',[0,.95,0],[3.38,1.38,2.92]);
 // Shallow side panels, never enough attachments to hide the glass.
 for(const side of [-1,1]){
  box('sand',[side*1.70,.99,0],[.10,1.46,3.02]);
  box('steel_dark',[side*1.77,1.25,0],[.05,.11,2.76]);
 }
 box('steel_dark',[0,1.72,0],[3.71,.15,3.26]);
 box('roof',[0,1.82,0],[3.57,.09,3.12]);
 for(const z of [-1.62,1.62])
  box('steel_light',[0,1.85,z],[3.61,.09,.08]);
 // The slender faction roof lines run well OUTSIDE the glass cylinder.
 for(const x of [-1.52,1.52])
  box('team',[x,1.879,0],[.12,.014,2.48]);

 // Actual translucent glass reactor casing with a prominent vertical
 // silhouette, 24 true sides, no opaque cylinder passing for glass.
 const tube=ENERGY_GLASS_CYLINDER;
 frustum('steel_dark',1.87,2.04,1.29,1.18,tube.sides);
 ring('team',2.04,1.16,1.28,.072,tube.sides);
 cylinder('glass',tube.radius,tube.bottom,tube.top,tube.sides);
 // Real inner energy column visible THROUGH the glass, in exact team blue
 // (or red). Narrow so the glass remains the main visual object.
 cylinder('energy',.42,2.16,4.09,20);
 ring('steel_light',2.27,.44,.59,.06,20);
 ring('team',3.96,.44,.59,.055,20);
 // Four slim supporting struts with zero clipping into the casing.
 for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2;
  const r=1.18,x=r*Math.cos(a),z=r*Math.sin(a);
  beam('steel',[x,2.02,z],[x,4.22,z],.075);
 }
 ring('steel_light',4.19,1.13,1.25,.065,tube.sides);
 frustum('steel_dark',4.25,4.39,1.25,1.15,tube.sides);
 ring('team',4.26,1.11,1.25,.055,tube.sides);
 // Small round upper valve cap; no large turret, lamps or extra spires.
 cylinder('steel_light',.25,4.39,4.48,16);

 // One simple stationary service door on the FRONT (+Z).
 box('steel_dark',[0,.91,1.493],[.77,1.15,.07]);
 box('door',[0,.90,1.54],[.66,1.04,.045]);
 box('vent',[0,1.30,1.57],[.43,.09,.029]);
 box('steel_light',[.23,.86,1.58],[.040,.09,.028]);
 // Two small, firmly mounted team stars. Same sRGB as Bastion / HQ flags.
 for(const x of [-1.15,1.15]){
  box('steel_dark',[x,1.04,1.493],[.39,.49,.048]);
  box('team',[x,1.05,1.530],[.29,.39,.025]);
  star(x,1.05,1.554,.105);
 }
 // Two slim rear cooling grills. Keep all roof space around the cylinder.
 for(const x of [-1.34,1.34]){
  box('vent',[x,1.14,-1.499],[.35,.51,.040]);
  for(let k=0;k<3;k++)
   box('steel',[x,1.02+k*.14,-1.529],[.28,.028,.024]);
 }
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
function pngChunk(type,data){const name=Buffer.from(type);return Buffer.concat([be(data.length),name,data,be(crc32(Buffer.concat([name,data])))]);}
function png(color,key){
 const width=48,height=48;let state=(color[0]*2161+color[1]*3191+color[2]*5779)>>>0;
 const scan=Buffer.alloc((width*4+1)*height);
 const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Uniform paint: same sRGB as the team roof stripes and the static flags.
  const i=y*(width*4+1)+1+x*4,noise=(key==='team'||key==='white')?0:Math.round((random()-.5)*17);
  let rgb=color;
  if(key==='camo'){const blob=Math.sin(x*.27+Math.cos(y*.31)*2.1)+Math.cos(y*.28-x*.12);
   if(blob>.73)rgb=[82,91,64];else if(blob<-.80)rgb=[128,134,96];}
  // Embedded optical glass map: faint vertical streaks, translucent center
  // and brighter rim, not the old opaque dark glass color.
  if(key==='glass'){
   const edge=Math.pow(Math.abs((x-width*.5)/(width*.5)),2);
   const reflection=8*Math.sin(x*.32+y*.055);
   rgb=color.map((v,k)=>Math.min(255,v+reflection+(k===2?8:0)+edge*8));
  }
  for(let c=0;c<3;c++)scan[i+c]=Math.max(0,Math.min(255,rgb[c]+noise));
  scan[i+3]=key==='glass'?Math.round(111+17*Math.sin(x*.35)+
   12*Math.cos(y*.16)):255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width,0);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',hdr),pngChunk('IDAT',deflateSync(scan,{level:8})),pngChunk('IEND',Buffer.alloc(0))]);
}
function exportTeam(owner){
 const pal=JSON.parse(JSON.stringify(colors));
 if(owner===1){pal.team=factionRgb8(1);pal.energy=factionRgb8(1);}
 
 
 buildParts();
 const gltf={asset:{version:'2.0',generator:'sandforge-energy-core-pbr-v2-glass-20261116'},
 extensionsUsed:['KHR_materials_unlit'],scene:0,
 scenes:[{nodes:[0]}],nodes:[{name:'SF_EnergyCore_PBR_Root',children:[]}],
 meshes:[],materials:[],images:[],textures:[],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
 buffers:[{byteLength:0}],bufferViews:[],accessors:[],animations:[]};
 const chunks=[];let offset=0;
 function append(raw,target){const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad}
  const off=offset;chunks.push(raw);offset+=raw.length;const id=gltf.bufferViews.length;
  const view={buffer:0,byteOffset:off,byteLength:raw.length};if(target)view.target=target;
  gltf.bufferViews.push(view);return id;}
 function accessor(array,type,dimensions,component,bounds=false){
  const isIndex=component===5125,raw=Buffer.alloc(array.length*4);
  array.forEach((v,i)=>isIndex?raw.writeUInt32LE(v>>>0,i*4):raw.writeFloatLE(v,i*4));
  const view=append(raw,isIndex?34963:34962),a={bufferView:view,componentType:component,count:array.length/dimensions,type};
  if(bounds){a.min=Array(dimensions).fill(Infinity);a.max=Array(dimensions).fill(-Infinity);
   array.forEach((v,i)=>{const k=i%dimensions;a.min[k]=Math.min(a.min[k],v);a.max[k]=Math.max(a.max[k],v)});}
  const id=gltf.accessors.length;gltf.accessors.push(a);return id;
 }
 const names=new Map();for(const g of groups.values()){
  if(!names.has(g.name)){
   const mat=gltf.materials.length,color=pal[g.name],image=gltf.images.length;
   const factionSurface=g.name==='team'||g.name==='energy';
   const opticalGlass=g.name==='glass';
   gltf.images.push({bufferView:append(png(color,g.name)),mimeType:'image/png'});
   gltf.textures.push({sampler:0,source:image});
   gltf.materials.push({name:'Sandforge_EnergyCore_'+g.name,
    ...(opticalGlass?{alphaMode:'BLEND'}:{}),
    pbrMetallicRoughness:{
     baseColorTexture:{index:image},
     metallicFactor:opticalGlass?.08:/metal|bronze|gunmetal/.test(g.name)?.45:.07,
     roughnessFactor:opticalGlass?.13:.84
    },
    ...(factionSurface?{extensions:{KHR_materials_unlit:{}}}:{}),
    emissiveFactor:[0,0,0],doubleSided:true});
   names.set(g.name,mat);
  }
  const pos=accessor(g.p,'VEC3',3,5126,true),norm=accessor(g.n,'VEC3',3,5126),
   uv=accessor(g.uv,'VEC2',2,5126),indices=accessor(g.i,'SCALAR',1,5125);
  const mesh=gltf.meshes.length;
  const partName=g.name==='camo'?'SF_EnergyCore_PBR_Housing':'SF_EnergyCore_PBR_'+g.name;
  gltf.meshes.push({name:partName,
   primitives:[{attributes:{POSITION:pos,NORMAL:norm,TEXCOORD_0:uv},indices,material:names.get(g.name)}]});
  const node=gltf.nodes.length;gltf.nodes.push({name:partName,mesh});
  gltf.nodes[0].children.push(node);
 }
 const bin=Buffer.concat(chunks);gltf.buffers[0].byteLength=bin.length;
 const json=Buffer.from(JSON.stringify(gltf)),jp=(4-json.length%4)%4,bp=(4-bin.length%4)%4;
 const total=12+8+json.length+jp+8+bin.length+bp,out=Buffer.alloc(total);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
 out.writeUInt32LE(json.length+jp,12);out.write('JSON',16,4,'ascii');json.copy(out,20);
 out.fill(0x20,20+json.length,20+json.length+jp);
 const at=20+json.length+jp;
 out.writeUInt32LE(bin.length+bp,at);out.write('BIN\0',at+4,4,'ascii');bin.copy(out,at+8);
 const name='generator-'+owner+'.glb';
 writeFileSync(join(OUT,name),out);
 console.log('Generated '+name+': '+out.length+' bytes, '+gltf.meshes.length+' meshes, '+
  gltf.images.length+' textures, a large translucent 24-side energy cylinder');
}
mkdirSync(OUT,{recursive:true});for(const owner of [0,1])exportTeam(owner);
