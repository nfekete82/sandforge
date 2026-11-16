#!/usr/bin/env node
// Reproducible 1:1 flightline-scale PBR hangar and small airfield tower.
 // The existing runway, terrain deformation, flight paths and repair mechanics
 // stay authoritative. The two animated shutter nodes retain exact names.
 // Builds blue and red GLBs without Meshy, external assets or Blender.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {factionRgb8} from './sandforge-faction-palette.js';
const OUT=process.argv[2]||'src/assets/reborn/buildings-3d';
const PI=Math.PI,TAU=2*PI;
// The door obeys the existing WebGL factory gate's upward opening.
// Work in the same local metre scale as the legacy FactoryRollupDoor.
// The 10% wider factory is visual-only. Game collision and service yard stay unchanged.
const FACTORY_WIDTH_FACTOR=1;
// The flightline's immutable hangar centre and existing single bay.
export const AIRFIELD_HANGAR_CENTER_X=-151;
export const AIRFIELD_HANGAR_FRONT_Z=18;
export const AIRFIELD_HANGAR_DOOR_CENTERS=Object.freeze([-178,-124]);
export const AIRFIELD_HANGAR_DOOR_Y=36;
export const AIRFIELD_HANGAR_DOOR_Z=23;
const colors={
 camo:[181,165,129],sand:[208,188,148],sand_light:[222,202,169],
 khaki:[139,141,108],olive:[91,107,80],roof:[93,101,82],
 concrete:[131,128,112],stone:[169,156,130],
 steel:[93,105,100],steel_dark:[42,51,51],steel_light:[151,158,140],
 door:[79,89,83],vent:[39,49,49],glass:[41,60,64],
 warning:[196,165,101],team:factionRgb8(0),white:[226,216,184]
};
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,t)=>a.map(x=>x*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/(Math.hypot(...a)||1));
const pt=(radius,y,angle)=>[radius*Math.cos(angle),y,radius*Math.sin(angle)];
const groups=new Map();
function material(name,part=''){const key=part+':'+name;if(!groups.has(key))groups.set(key,{name,part,p:[],n:[],uv:[],i:[]});return groups.get(key)}
function tri(g,a,b,c,uv=[[0,0],[1,0],[1,1]]){const normal=unit(cross(sub(b,a),sub(c,a))),index=g.p.length/3;for(const [k,v]of [a,b,c].entries()){g.p.push(...v);g.n.push(...normal);g.uv.push(...uv[k]);}g.i.push(index,index+1,index+2)}
function quad(g,a,b,c,d){tri(g,a,b,c);tri(g,a,c,d,[[0,0],[1,1],[0,1]])}
function box(mat,at,size,rotation=0,part=''){
 const g=material(mat,part),[sx,sy,sz]=size.map(x=>x/2),co=Math.cos(rotation),si=Math.sin(rotation);
 const p=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]].map(([x,y,z])=>[(at[0]+x*co+z*si)*FACTORY_WIDTH_FACTOR,at[1]+y,at[2]+z*co-x*si]);
 for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(g,p[a],p[b],p[c],p[d]);
}
// All coordinates are in AIRFIELD SERVICE YARD local space (before the
// existing .90/.84/.82 compact transform). No collision/physics is generated.
function star(x,y,z,r=5){
 const g=material('white'),center=[x,y,z],points=[];
 for(let i=0;i<10;i++){
  const a=Math.PI/2+i*Math.PI/5,rad=(i%2?r*.42:r);
  points.push([x+Math.cos(a)*rad,y+Math.sin(a)*rad,z]);
 }
 for(let i=0;i<10;i++)tri(g,center,points[i],points[(i+1)%10]);
}
function buildParts(){
 groups.clear();
 const cx=AIRFIELD_HANGAR_CENTER_X,front=AIRFIELD_HANGAR_FRONT_Z;
 // A sand-coloured sealed single-bay hangar: no second decorative garage.
 box('concrete',[cx,1.9,-77],[125,3.3,194]);
 box('stone',[cx,4,-77],[120,3.5,190]);
 box('camo',[cx,35,-170],[118,69,6]);
 for(const side of [-1,1]){
  const x=cx+side*59;
  box('camo',[x,37,-77],[6,72,187]);
  for(const z of [-147,-110,-73,-36]){
   box('steel',[x+side*3.5,35,z],[4,64,6]);
   box('olive',[x+side*5,47,z+10],[2,19,14]);
  }
  box('steel_dark',[x+side*5,58,-73],[2.5,10,57]);
  box('steel_light',[x+side*6,57,-73],[3,2.5,52]);
 }
 // Roof: low, ribbed camouflaged industrial arch with matte PBR panels.
 const count=10,halfWidth=61;
 const arc=x=>76+17*Math.sqrt(Math.max(0,1-(x/68)**2));
 for(let j=0;j<count;j++){
  const x0=-halfWidth+j*2*halfWidth/count;
  const x1=-halfWidth+(j+1)*2*halfWidth/count;
  const y0=arc(x0),y1=arc(x1);
  const panel= j%3===0?'khaki':j%3===1?'roof':'olive';
  box(panel,[cx+(x0+x1)/2,(y0+y1)/2,-77],
   [Math.hypot(x1-x0,y1-y0)+1.5,2.8,192],
   Math.atan2(y1-y0,x1-x0));
  for(const z of [-147,-94,-40,13])
   box('steel',[cx+(x0+x1)/2,(y0+y1)/2+2.2,z],
    [Math.hypot(x1-x0,y1-y0)+1.6,1.6,2.7],
    Math.atan2(y1-y0,x1-x0));
 }
 // Dark roof ventilators, none overlapped by the blue identification strips.
 for(const side of [-1,1]){
  const x=cx+side*33;
  box('stone',[x,93,-105],[19,6.5,25]);
  box('vent',[x,98,-105],[16,3.6,22]);
  for(let i=0;i<5;i++)box('steel_dark',[x-6.0+i*3,100.7,-105],[1.3,1.5,21]);
  // Two longitudinal PBR-painted strips, INTERRUPTED before the vents.
  for(const [z0,z1] of [[-153,-125],[-73,-14]]){
   // Match the curved roof height at x +/-40; paint is flush, not floating.
   const x=40,roofY=76+17*Math.sqrt(1-(x/68)**2)+1.5;
   box('team',[cx+side*x,roofY,(z0+z1)/2],[3,.35,z1-z0]);
  }
 }
 // True doorway opening is kept empty behind the moving shutter.
 box('steel_dark',[cx,79,front],[122,7,10]);
 for(const side of [-1,1]){
  const x=cx+side*59;
  box('sand',[x,39,front],[10,76,11]);
  box('steel',[x,39,front+6],[5,72,8]);
  box('warning',[x,8,front+9],[5,10,2.5]);
 }
 box('steel_light',[cx,76,front+7],[117,4,3]);
 box('steel_dark',[cx,70,front+12],[55,5.6,4]);
 // Flag pennants fixed to the facade on both sides of the gate.
 for(const x of [cx-57,cx+57]){
  // Side-mounted flags sit on the immobile door columns, not the shutters.
  box('steel_dark',[x,61,front+9],[10,30,3.0]);
  box('team',[x,61,front+11],[8.5,25,1]);
  star(x,63,front+11.7,3.7);
 }
 for(const [part,offset] of [['HangarDoorLeft_0',-27],['HangarDoorRight_0',27]]){
  // Mesh is LOCAL to a node translated by the exporter to the currently
  // authored dynamic-gate position. The existing update loop may translate
  // and shrink this mesh to open the bay without remapping coordinates.
  box('door',[0,0,0],[52,64,5],0,part);
  for(const yy of [-22,-11,0,11,22])
   box('door',[0,yy,3.2],[48,1.65,1.8],0,part);
  for(const x of [-23.7,23.7])
   box('door',[x,0,3.2],[1.2,61,1.5],0,part);
 }
 // Roof truss bases, outdoor electrical cabinets and in-ground flood lights.
 for(const x of [cx-64,cx+64]){
  box('concrete',[x,2,front+1],[15,4,15]);
  box('steel_dark',[x,39,front+8],[5,73,4]);
  box('steel_light',[x,75,front+8],[13,4,9]);
 }
 box('steel',[cx-73,19,-119],[17,34,18]);
 box('sand',[cx-73,35,-119],[17,4,19]);
 // Compact control tower on the far LEFT of the hangar, not on the taxiway.
 const towerX=-269,towerZ=-81;
 box('concrete',[towerX,3,towerZ],[44,6,47]);
 box('camo',[towerX,45,towerZ],[35,81,34]);
 for(const y of [24,54,79])
  box('steel',[towerX,y,towerZ],[40,3.3,38]);
 box('steel_dark',[towerX,92,towerZ],[49,5,46]);
 box('glass',[towerX,106,towerZ],[44,22,40]);
 for(const x of [towerX-22,towerX+22])
  box('steel',[x,107,towerZ],[3,21,44]);
 for(const z of [towerZ-19,towerZ+19])
  box('steel',[towerX,107,z],[44,21,3]);
 box('roof',[towerX,120,towerZ],[53,5.5,49]);
 box('steel_dark',[towerX+15,130,towerZ-12],[3,21,3]);
 box('warning',[towerX+15,140,towerZ-12],[6,2.7,6]);
 box('team',[towerX,112,towerZ+21],[13,7,.8]);
 // Near hangar and tower use neutral service accessories; the runway
 // remains untouched and terrain-draped by webgl-airfield-service.js.
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
  for(let c=0;c<3;c++)scan[i+c]=Math.max(0,Math.min(255,rgb[c]+noise));scan[i+3]=255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width,0);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',hdr),pngChunk('IDAT',deflateSync(scan,{level:8})),pngChunk('IEND',Buffer.alloc(0))]);
}
function exportTeam(owner){
 const pal=JSON.parse(JSON.stringify(colors));
 if(owner===1)pal.team=factionRgb8(1);
 
 
 buildParts();
 const gltf={asset:{version:'2.0',generator:'sandforge-airfield-pbr-v1-20261116'},
 extensionsUsed:['KHR_materials_unlit'],scene:0,
 scenes:[{nodes:[0]}],nodes:[{name:'SF_Airfield_PBR_Root',children:[]}],
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
   const factionSurface=g.name==='team';
   gltf.images.push({bufferView:append(png(color,g.name)),mimeType:'image/png'});
   gltf.textures.push({sampler:0,source:image});
   gltf.materials.push({name:'Sandforge_Airfield_'+g.name,pbrMetallicRoughness:{
    baseColorTexture:{index:image},metallicFactor:/metal|bronze|gunmetal/.test(g.name)?.45:.07,
    roughnessFactor:.83},
    ...(factionSurface?{extensions:{KHR_materials_unlit:{}}}:{}),
    // No cyan emissive boost on painted team identifiers.
    emissiveFactor:[0,0,0],doubleSided:true});
   names.set(g.name,mat);
  }
  const pos=accessor(g.p,'VEC3',3,5126,true),norm=accessor(g.n,'VEC3',3,5126),
   uv=accessor(g.uv,'VEC2',2,5126),indices=accessor(g.i,'SCALAR',1,5125);
  const mesh=gltf.meshes.length;
  const partName=g.part||'SF_Airfield_PBR_'+g.name;
  gltf.meshes.push({name:partName,
   primitives:[{attributes:{POSITION:pos,NORMAL:norm,TEXCOORD_0:uv},indices,material:names.get(g.name)}]});
  const node=gltf.nodes.length;
  const isLeft=partName==='HangarDoorLeft_0',isRight=partName==='HangarDoorRight_0';
  gltf.nodes.push({name:partName,mesh,
   ...(isLeft||isRight?{translation:[AIRFIELD_HANGAR_CENTER_X+(isLeft?-27:27),AIRFIELD_HANGAR_DOOR_Y,AIRFIELD_HANGAR_DOOR_Z]}:{})});
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
 const name='airfield-'+owner+'.glb';
 writeFileSync(join(OUT,name),out);
 console.log('Generated '+name+': '+out.length+' bytes, '+gltf.meshes.length+' meshes, '+
  gltf.images.length+' textures, split animated hangar shutters and compact tower');
}
mkdirSync(OUT,{recursive:true});for(const owner of [0,1])exportTeam(owner);
