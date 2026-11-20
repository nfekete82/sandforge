#!/usr/bin/env node
// Reproducible game-ready Sandforge vehicle factory: 2 authored-desert PBR GLBs,
// single REAL FactoryRollupDoor, fixed team roofs/flags and no second side garage.
// The open-air repair platform remains a separate existing gameplay object.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {factionRgb8} from './sandforge-faction-palette.js';
const OUT=process.argv[2]||'src/assets/reborn/buildings-3d';
const PI=Math.PI,TAU=2*PI;
// Wide, roofed, OPEN production hall: true drive-through exit, no gate leaf.
// Geometry stays in factory GLB model metres. Simulation collision and the
// independent open-air repair platform remain unchanged.
export const FACTORY_WIDTH_FACTOR=1.10;
export const FACTORY_OPEN_BAY_WIDTH=3.36;
export const FACTORY_OPEN_BAY_HEIGHT=2.14;
export const FACTORY_ROOF_VENT_GAP=Object.freeze([-1.35,-.18]);
const colors={
 camo:[198,177,137],sand:[211,193,157],sand_light:[224,204,170],
 khaki:[148,144,113],olive:[92,107,82],roof:[90,95,77],
 concrete:[132,130,111],stone:[177,165,138],
 steel:[91,98,91],steel_dark:[45,51,50],steel_light:[142,146,128],
 door:[73,81,76],vent:[41,49,48],glass:[42,60,62],
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
/** Closed one-storey low-poly/PBR production hall, precisely aligned with
 * WebGL ProductionGates' original FactoryRollupDoor local dimensions.
 * There is NO secondary maintenance garage; that existing service module
 * builds its own open-air lifting platform at (192,45).
 */
function buildParts(){
 groups.clear();
 // Layered reinforced plinth and industrial foundation.
 box('concrete',[0,.09,0],[5.12,.18,4.84]);
 box('stone',[0,.21,0],[4.85,.24,4.53]);
 for(const x of [-2.46,2.46])box('steel_dark',[x,.18,0],[.12,.33,4.71]);
 for(const z of [-2.31,2.31])box('steel_dark',[0,.18,z],[4.97,.33,.12]);
 // More architectural industrial hall: a 3.3-metre wide permanently open
 // entrance, 2.14 metres high, up to the underside of the steel roof.
 // The drive lane is FREE, not obscured by a single triangle or shutter.
 box('camo',[-2.28,1.30,0],[.35,2.20,4.18]);
 box('camo',[2.28,1.30,0],[.35,2.20,4.18]);
 box('camo',[0,1.32,-2.11],[4.58,2.21,.31]);
 // Narrow left/right shoulders: central portal from -1.50 to +1.85.
 box('camo',[-1.91,1.30,2.10],[.80,2.20,.24]);
 box('camo',[2.01,1.30,2.10],[.62,2.20,.24]);
 // Industrial top beam, clear headroom for the articulated rocket truck.
 box('steel_dark',[.18,2.225,2.13],[3.56,.18,.34]);
 box('steel_light',[.18,2.29,2.33],[3.61,.10,.12]);
 for(const [x,z] of [[-2.23,2.15],[2.23,2.15]]){
  box('sand',[x,1.20,z],[.30,2.38,.36]);
  box('steel_dark',[x,1.25,z+.20],[.09,1.90,.055]);
 }
 // Reinforced rectangular doorway jambs are bolted to the exterior, but
 // terminate OUTSIDE the actual drive corridor.
 for(const x of [-1.56,1.91]){
  box('steel',[x,1.28,2.34],[.09,1.91,.12]);
  for(const y of [.42,1.01,1.61,2.04])
   box('steel_light',[x,y,2.405],[.14,.052,.055]);
 }
 // Vehicle-facing PBR interior, actually visible without opening a door:
 // grippy workshop floor with thin tracks, structural ceiling trusses,
 // working-strip illumination and maintenance tool cabinets at the SIDES.
 box('concrete',[.18,.235,.21],[3.30,.035,4.44]);
 for(const x of [-.86,1.22]){
  box('steel_dark',[x,.252,.32],[.065,.024,4.26]);
  for(const z of [-1.65,-.95,-.25,.45,1.15,1.85])
   box('warning',[x,.271,z],[.07,.013,.12]);
 }
 // Overhead I-beam lattice and credible industrial suspended lamp housings.
 for(const z of [-1.62,-.42,1.14]){
  box('steel_dark',[.18,2.23,z],[3.75,.095,.14]);
  for(const x of [-1.10,1.46]){
   box('steel',[x,2.21,z],[.085,.12,.28]);
   box('white',[x,2.13,z],[.68,.020,.055]);
  }
 }
 for(const x of [-1.97,1.99]){
  // Real ventilation grilles with slats in the workshop sidewalls.
  for(const z of [-1.49,-.65,.18,1.10]){
   box('steel_dark',[x,1.36,z],[.07,.55,.35]);
   for(let i=0;i<4;i++)
    box('steel_light',[x+Math.sign(x)*.045,1.15+i*.14,z],[.017,.030,.30]);
  }
 }
 // Short lateral equipment consoles and lift controls don't obstruct
 // tracked vehicles or the main single-vehicle production lane.
 for(const [x,z] of [[-1.95,-1.06],[2.00,-.56]]){
  box('khaki',[x,.45,z],[.33,.65,.74]);
  box('steel_dark',[x,.81,z],[.36,.07,.76]);
  box('glass',[x,1.02,z],[.036,.22,.31]);
 }
 // Painted exterior tracks and broad roll-out apron connect the hall to
 // the legal simulation spawn; this is NOT the external repair platform.
 box('concrete',[.18,.135,2.72],[3.25,.12,1.25]);
 for(const x of [-.89,1.25]){
  box('steel_dark',[x,.209,2.78],[.060,.022,1.07]);
 }
 // Loading gantry, robust side ledges and roof exhaust remain visible.
 // Stacked roof slab, weathered grey-green flat finish and real overhang.
 box('steel_dark',[0,2.40,0],[5.22,.19,4.85]);
 box('roof',[0,2.52,0],[5.08,.10,4.70]);
 for(const x of [-2.40,2.40])
  box('steel_light',[x,2.56,0],[.12,.17,4.81]);
 for(const z of [-2.31,2.31])
  box('steel_light',[0,2.56,z],[4.96,.16,.12]);
 // Exactly two team roof stripes, with a split around the raised skylight /
 // ventilation housings. Four short paint sections total, NEVER under vents.
 // Keep both strips symmetric; the same gaps persist for blue and red GLBs.
 for(const x of [-1.55,1.55])for(const [z0,z1] of [
  [-1.71,FACTORY_ROOF_VENT_GAP[0]],[FACTORY_ROOF_VENT_GAP[1],1.51]
 ]){
  const length=z1-z0;
  box('team',[x,2.586,(z0+z1)/2],[.16,.018,length]);
 }
 // Broad exhaust plenums and dark angled ventilation grilles.
 box('stone',[-.88,2.70,-.66],[1.13,.28,.95]);
 box('steel_dark',[-.88,2.85,-.66],[.97,.11,.81]);
 for(let i=0;i<6;i++)
  box('vent',[-1.29+i*.16,2.915,-.66],[.074,.026,.64]);
 box('stone',[1.34,2.68,-.77],[1.05,.25,.77]);
 box('steel',[1.34,2.86,-.77],[.90,.14,.61]);
 for(let i=0;i<5;i++)box('vent',[.99+i*.18,2.955,-.77],[.075,.026,.50]);
 // Two modest industrial exhaust stacks, separate from exit vehicle path.
 for(const [x,z,h] of [[-1.92,-1.48,.65],[1.91,-1.46,.84]]){
  box('steel_dark',[x,2.69+h*.5,z],[.22,h,.22]);
  box('steel_light',[x,2.70+h,z],[.34,.12,.33]);
  box('vent',[x,2.77+h,z],[.21,.065,.20]);
 }
 // Side wall cooling ribs, conduit pipes and functional windows.
 for(const x of [-2.49,2.49]){
  for(const z of [-1.54,-.92,-.30,.32,.95])
   box('steel',[x,1.57,z],[.16,.66,.12]);
  box('vent',[x,1.74,-.50],[.20,.38,1.11]);
  for(const z of [-.94,-.60,-.26,-.02])
   box('steel_light',[x+Math.sign(x)*.11,1.74,z],[.045,.034,.22]);
 }
 // Front industrial signage on upper lintel and hazard rails (not a toy).
 for(const x of [-.78,1.16]){
  box('warning',[x,1.71,2.43],[.12,.20,.03]);
 }
 box('steel_dark',[.18,2.40,2.30],[3.39,.10,.10]);
 for(const x of [-1.35,1.69]){
  box('steel_dark',[x,1.43,2.27],[.65,.94,.16]);
  box('team',[x,1.46,2.363],[.40,.60,.022]);
  star(x,1.46,2.381,.13);
 }
 // One outside utility cabinet and small crates, away from the right-hand
 // repair platform. All are fixed visual meshes with no gameplay collision.
 box('khaki',[-2.13,.54,1.59],[.44,.74,.34]);
 box('steel_dark',[-2.13,.82,1.775],[.36,.11,.03]);
 for(const x of [-1.94,-1.45]){
  box('sand',[x,.30,2.38],[.39,.35,.31]);
  box('steel_dark',[x,.31,2.56],[.40,.034,.025]);
 }
 // Continuous ground-level production apron already extends past the
 // open doorway, no elevated ramp, shutter track or trigger collider.
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
function pngChunk(type,data){const name=Buffer.from(type);return Buffer.concat([be(data.length),name,data,be(crc32(Buffer.concat([name,data])))]);}
function png(color,key){
 // Roof paint needs fine quiet mineral grain, not a magnified 48px pattern
 // that looks like deep parallel grooves under golden-hour grazing light.
 const width=key==='roof'?256:48,height=key==='roof'?256:48;
 let state=(color[0]*2161+color[1]*3191+color[2]*5779)>>>0;
 const scan=Buffer.alloc((width*4+1)*height);
 const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Uniform paint: same sRGB as the team roof stripes and the static flags.
  const i=y*(width*4+1)+1+x*4,
  noise=(key==='team'||key==='white')?0:
   Math.round((random()-.5)*(['roof','camo'].includes(key)?5:17));
  let rgb=color;
  // Do not bake the old 48px sine-wave camouflage into the exterior:
  // the factory uses the same high-detail wall atlas as HQ and barracks.
  // A quiet sandy base remains visible briefly before PBR shader upload.
  for(let c=0;c<3;c++)scan[i+c]=Math.max(0,Math.min(255,rgb[c]+noise));scan[i+3]=255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width,0);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',hdr),pngChunk('IDAT',deflateSync(scan,{level:8})),pngChunk('IEND',Buffer.alloc(0))]);
}
function exportTeam(owner){
 const pal=JSON.parse(JSON.stringify(colors));
 if(owner===1)pal.team=factionRgb8(1);
 
 
 buildParts();
 const gltf={asset:{version:'2.0',generator:'sandforge-open-vehicle-factory-v2-20261120'},
 extensionsUsed:['KHR_materials_unlit'],scene:0,
 scenes:[{nodes:[0]}],nodes:[{name:'SF_Factory_PBR_Root',children:[]}],
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
   gltf.materials.push({name:'Sandforge_Factory_'+g.name,pbrMetallicRoughness:{
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
  const partName='SF_Factory_PBR_'+g.name;
  gltf.meshes.push({name:partName,
   primitives:[{attributes:{POSITION:pos,NORMAL:norm,TEXCOORD_0:uv},indices,material:names.get(g.name)}]});
  const node=gltf.nodes.length;gltf.nodes.push({name:partName,mesh});
  gltf.nodes[0].children.push(node);
 }
 // Named non-rendered locator for the forever-open drive-out presenter.
 // Use its parent (the original authored model) as the transform root.
 const openBay=gltf.nodes.length;
 gltf.nodes.push({name:'SF_Factory_PBR_OpenBay',translation:[.18,.23,1.10],
  extras:{openProductionExit:true,vehicleDriveThrough:true}});
 gltf.nodes[0].children.push(openBay);
 const bin=Buffer.concat(chunks);gltf.buffers[0].byteLength=bin.length;
 const json=Buffer.from(JSON.stringify(gltf)),jp=(4-json.length%4)%4,bp=(4-bin.length%4)%4;
 const total=12+8+json.length+jp+8+bin.length+bp,out=Buffer.alloc(total);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
 out.writeUInt32LE(json.length+jp,12);out.write('JSON',16,4,'ascii');json.copy(out,20);
 out.fill(0x20,20+json.length,20+json.length+jp);
 const at=20+json.length+jp;
 out.writeUInt32LE(bin.length+bp,at);out.write('BIN\0',at+4,4,'ascii');bin.copy(out,at+8);
 const name='factory-'+owner+'.glb';
 writeFileSync(join(OUT,name),out);
 console.log('Generated '+name+': '+out.length+' bytes, '+gltf.meshes.length+' meshes, '+
  gltf.images.length+' textures, one permanently OPEN vehicle exit');
}
mkdirSync(OUT,{recursive:true});for(const owner of [0,1])exportTeam(owner);
