#!/usr/bin/env node
// Dependency-free Sandforge capture Bastion: 3 faction GLB2 assets, PBR textures,
// batched geometry and separately animated RadarSpin. No downloads or Python.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {factionRgb8} from './sandforge-faction-palette.js';
const OUT=process.argv[2]||'src/assets/reborn/buildings-3d';
const PI=Math.PI,TAU=2*PI;
// Lift the octagonal tower by 60% above its unchanged capture foundation.
// The independently rotating radar geometry retains its rigid dimensions.
const TOWER_STRETCH=1.60,TOWER_STRETCH_START=1.31,RADAR_PIVOT_Y=6.14;
const BEACON_X=-2.45,BEACON_Z=-.94;
const liftedY=y=>y<=TOWER_STRETCH_START?y:
 TOWER_STRETCH_START+(y-TOWER_STRETCH_START)*TOWER_STRETCH;
const colors={sandstone:[190,157,116],sand_light:[214,181,133],sand_shadow:[125,112,90],olive:[95,104,75],metal:[63,67,65],metal_light:[112,119,112],metal_dark:[26,34,36],amber:[231,159,69],blue:factionRgb8(0),white:[227,225,209],camo:[189,158,113],fabric:factionRgb8(0),sandbag:[178,158,123],bronze:[124,105,69],gunmetal:[41,45,44],radar_base:[82,80,70],beacon:factionRgb8(0)};
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
 const p=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]].map(([x,y,z])=>[at[0]+x*co+z*si,at[1]+y,at[2]+z*co-x*si]);
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
function star(frontZ=2.42){
 const g=material('white'),center=[0,3.73,frontZ],points=[];
 for(let i=0;i<10;i++){const a=PI/2+i*TAU/10,r=i%2?.16:.39;points.push([r*Math.cos(a),3.73+r*Math.sin(a),frontZ]);}
 for(let i=0;i<10;i++)tri(g,center,points[i],points[(i+1)%10]);
}
function buildParts(){
 groups.clear();
 // Broad capture pad with a much taller, buttressed desert-camo tower.
 frustum('metal_dark',.06,.69,3.68,3.52,12);
 frustum('sandstone',.62,.90,3.48,3.35,12);
 frustum('sand_light',.88,1.31,3.30,3.07,12);
 ring('bronze',1.30,2.83,3.26,.11);
 for(let i=0;i<12;i++){const a=i*TAU/12+PI/12,x=3.43*Math.cos(a),z=3.43*Math.sin(a);
 box(i%3===0?'olive':'sandstone',[x,.98,z],[.87,.40,.28],-a);
 box('blue',[3.59*Math.cos(a),.91,3.59*Math.sin(a)],[.40,.09,.045],-a);}
 frustum('camo',1.21,5.16,2.26,1.78,8);frustum('sandstone',1.18,1.78,2.47,2.20,8);
 frustum('sand_shadow',3.25,3.55,2.04,1.97,8);
 frustum('sandstone',4.72,5.12,2.18,2.07,8);
 cylinder('metal_dark',2.14,5.11,5.29,12);
 ring('metal',5.21,1.54,2.36,.25,12);ring('sand_light',5.42,2.21,2.40,.23,12);
 for(let i=0;i<8;i++){const a=(i+.5)*TAU/8+PI/8,x=2.15*Math.cos(a),z=2.15*Math.sin(a);
 box('metal_dark',[x,1.95,z],[.68,.32,.12],-a);
 box('blue',[x,2.13,z],[.48,.06,.13],-a);
 for(const y of [2.34,4.04])box('metal_dark',[1.92*Math.cos(a),y,1.92*Math.sin(a)],[.60,.30,.10],-a);
 const a2=i*TAU/8+PI/8;beam('metal',pt(2.44,1.46,a2),pt(1.78,4.86,a2),.18);}
 box('fabric',[0,3.78,2.29],[1.04,1.88,.10]);
 box('gunmetal',[0,4.75,2.34],[1.17,.075,.14]);star();
 box('metal_dark',[0,1.70,2.46],[1.15,.72,.11]);
 for(const x of [-.55,.55])box('metal_light',[x,1.71,2.54],[.07,.78,.14]);
 for(let i=0;i<12;i++){const a=i*TAU/12,p=pt(2.32,5.60,a),q=pt(2.32,5.60,(i+1)*TAU/12);
 box('gunmetal',p,[.09,.48,.09]);
 beam('metal_light',[p[0],5.80,p[2]],[q[0],5.80,q[2]],.066);}
 for(const a of [PI/6,PI/2,5*PI/6,7*PI/6,11*PI/6])for(let j=0;j<4;j++){
 const ang=a+(j-1.5)*.07;box('sandbag',pt(3.24,1.38,ang),[.49,.23,.32],-ang);}
 // Solid octagonal mechanical seat: platform + armoured bearing + steel spindle.
 // Stationary housing intersects the rotating foot by ~9 cm so the radar
 // has no gap at any angle. Visible in isometric camera view.
 frustum('radar_base',5.55,5.78,1.14,1.03,12);
 frustum('radar_base',5.78,6.13,.86,.60,12);
 ring('bronze',5.77,.77,1.08,.095,12);
 cylinder('metal_dark',.49,6.00,6.15,12);
 for(let i=0;i<4;i++){const a=i*PI/2+PI/4;
  beam('gunmetal',pt(1.39,5.61,a),pt(.62,6.05,a),.13);}
 // Radar geometry remains LOCAL to the independent pivot RADAR_PIVOT_Y.
 cylinder('metal_dark',.65,-.08,.13,12,[0,0,0],true);
 cylinder('metal',.43,.13,.46,12,[0,0,0],true);
 cylinder('bronze',.36,.43,.69,12,[0,0,0],true);
 box('gunmetal',[0,1.17,0],[2.88,1.23,.16],0,true);
 box('bronze',[0,1.17,.12],[2.62,1.00,.056],0,true);
 for(let i=0;i<9;i++)box('metal_dark',[-1.2+i*.30,1.17,.16],[.025,.99,.026],0,true);
 for(let i=0;i<6;i++)box('metal_dark',[0,.73+i*.18,.16],[2.57,.025,.027],0,true);
 for(const x of [-1.34,1.34])box('metal_light',[x,1.17,.05],[.13,1.23,.16],0,true);
 beam('metal',[-.7,.46,-.17],[-.94,.85,-.11],.12,true);
 beam('metal',[.7,.46,-.17],[.94,.85,-.11],.12,true);
 // Dedicated far-side beacon mount: radius 2.62 vs the rotor sweep <1.55.
 // The cyan/red/neutral beacon never intersects the spinning rectangle.
 box('radar_base',[BEACON_X,5.70,BEACON_Z],[.72,.20,.69]);
 beam('metal_dark',[-2.12,5.53,-.80],[BEACON_X,5.73,BEACON_Z],.13);
 cylinder('metal_dark',.27,5.77,5.97,12,[BEACON_X,0,BEACON_Z]);
 beam('metal_dark',[BEACON_X,5.91,BEACON_Z],[BEACON_X,6.92,BEACON_Z],.095);
 box('metal',[BEACON_X,6.33,BEACON_Z],[.32,.34,.28]);
 cylinder('beacon',.17,6.81,7.04,12,[BEACON_X,0,BEACON_Z]);
 // Scale ONLY the tower's stationary geometry, preserving a level deck and
 // rigid rotor head. Rebuild normals to avoid mis-shaded sloped walls.
 for(const g of groups.values()){
  if(g.rotor)continue;
  for(let i=1;i<g.p.length;i+=3)g.p[i]=liftedY(g.p[i]);
  for(let i=0;i<g.p.length;i+=9){
   const p=g.p.slice(i,i+3),q=g.p.slice(i+3,i+6),r=g.p.slice(i+6,i+9);
   const n=unit(cross(sub(q,p),sub(r,p)));
   for(let j=0;j<3;j++)g.n.splice(i+j*3,3,...n);
  }
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
  const i=y*(width*4+1)+1+x*4,noise=['blue','fabric','beacon'].includes(key)?0:Math.round((random()-.5)*17);
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
 if(owner===1){pal.blue=factionRgb8(1);pal.fabric=factionRgb8(1);}
 if(owner===-1){pal.blue=[165,152,120];pal.fabric=[109,104,88];}
 pal.beacon=pal.blue.slice();
 buildParts();
 const gltf={asset:{version:'2.0',generator:'sandforge-bastion-radar-v3-tall-platform'},
 extensionsUsed:['KHR_materials_unlit'],scene:0,
 scenes:[{nodes:[0]}],nodes:[{name:'BastionRoot',children:[1]},{name:'BastionRadarRotor',translation:[0,liftedY(RADAR_PIVOT_Y),0],children:[]}],
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
   const factionSurface=['blue','fabric','beacon'].includes(g.name);
   gltf.images.push({bufferView:append(png(color,g.name)),mimeType:'image/png'});
   gltf.textures.push({sampler:0,source:image});
   gltf.materials.push({name:'Sandforge_Bastion_'+g.name,pbrMetallicRoughness:{
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
  gltf.meshes.push({name:'Bastion'+(g.rotor?'Radar':'Static')+'_'+g.name,
   primitives:[{attributes:{POSITION:pos,NORMAL:norm,TEXCOORD_0:uv},indices,material:names.get(g.name)}]});
  const node=gltf.nodes.length;gltf.nodes.push({name:'Bastion'+(g.rotor?'Radar':'Static')+'_'+g.name,mesh});
  gltf.nodes[g.rotor?1:0].children.push(node);
 }
 const times=[],quats=[];for(let i=0;i<=16;i++){const theta=i*TAU/16;
  times.push(i*.5);quats.push(0,Math.sin(theta/2),0,Math.cos(theta/2));}
 const ti=accessor(times,'SCALAR',1,5126,true),qi=accessor(quats,'VEC4',4,5126);
 gltf.animations=[{name:'RadarSpin',samplers:[{input:ti,output:qi,interpolation:'LINEAR'}],
  channels:[{sampler:0,target:{node:1,path:'rotation'}}]}];
 const bin=Buffer.concat(chunks);gltf.buffers[0].byteLength=bin.length;
 const json=Buffer.from(JSON.stringify(gltf)),jp=(4-json.length%4)%4,bp=(4-bin.length%4)%4;
 const total=12+8+json.length+jp+8+bin.length+bp,out=Buffer.alloc(total);
 out.write('glTF',0,4,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
 out.writeUInt32LE(json.length+jp,12);out.write('JSON',16,4,'ascii');json.copy(out,20);
 out.fill(0x20,20+json.length,20+json.length+jp);
 const at=20+json.length+jp;
 out.writeUInt32LE(bin.length+bp,at);out.write('BIN\0',at+4,4,'ascii');bin.copy(out,at+8);
 const name='bastion-'+owner+'.glb';
 writeFileSync(join(OUT,name),out);
 console.log('Generated '+name+': '+out.length+' bytes, '+gltf.meshes.length+' meshes, '+
  gltf.images.length+' textures, RadarSpin');
}
mkdirSync(OUT,{recursive:true});for(const owner of [-1,0,1])exportTeam(owner);
