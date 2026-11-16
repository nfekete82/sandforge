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
 door:[79,89,83],door_corrugated:[94,110,104],gate_frame:[92,109,102],
 vent:[39,49,49],glass:[118,167,180],
 roof_corrugated:[110,120,96],
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
// A genuine 360-degree, 20-facet circular tower. Generated directly into
// the authored GLB so construction ghost, live scene and HUD use one shape.
export const AIRFIELD_TOWER_SIDES=20;
function cylindricalShell(mat,cx,cz,rBottom,rTop,bottom,top,{caps=false}={}){
 const g=material(mat);
 for(let i=0;i<AIRFIELD_TOWER_SIDES;i++){
  const a=i*TAU/AIRFIELD_TOWER_SIDES,b=(i+1)*TAU/AIRFIELD_TOWER_SIDES;
  const lowerA=[cx+Math.cos(a)*rBottom,bottom,cz+Math.sin(a)*rBottom];
  const lowerB=[cx+Math.cos(b)*rBottom,bottom,cz+Math.sin(b)*rBottom];
  const upperA=[cx+Math.cos(a)*rTop,top,cz+Math.sin(a)*rTop];
  const upperB=[cx+Math.cos(b)*rTop,top,cz+Math.sin(b)*rTop];
  // Winding faces outward. Cabin glazing has NO opaque interior filler.
  quad(g,lowerA,upperA,upperB,lowerB);
  if(caps){
   tri(g,[cx,top,cz],upperB,upperA);
   tri(g,[cx,bottom,cz],lowerA,lowerB);
  }
 }
}
export const AIRFIELD_DISH_PIVOT='AirfieldTowerDishRotor';
// Actual 3D roller drum on a horizontal axle. Its independent mesh node
// rotates with the shutter animation; all coordinates are pivot-local.
function rollerDrum(part='HangarRollupDrum_0'){
 const g=material('door_corrugated',part),n=20,R=6;
 for(let i=0;i<n;i++){
  const a=i*TAU/n,b=(i+1)*TAU/n;
  quad(g,[-56,R*Math.cos(a),R*Math.sin(a)],[56,R*Math.cos(a),R*Math.sin(a)],
   [56,R*Math.cos(b),R*Math.sin(b)],[-56,R*Math.cos(b),R*Math.sin(b)]);
 }
}
// 24-sided concave satellite reflector (plus real mast/feed boom). The whole
// reflector is one GLB node, centered over the round airfield control tower.
function satelliteDish(part=AIRFIELD_DISH_PIVOT){
 const g=material('steel_light',part),n=24,R=11;
 const v=(r,a)=>{
  const yy=r*Math.sin(a),d=2.5*(r/R)**2;
  return [r*Math.cos(a),11+yy*.84+d*.36,2+yy*.36-d*.84];
 };
 for(let j=0;j<5;j++)for(let i=0;i<n;i++){
  const a=i*TAU/n,b=(i+1)*TAU/n,r0=j*R/5,r1=(j+1)*R/5;
  quad(g,v(r0,a),v(r1,a),v(r1,b),v(r0,b));
 }
 for(let i=0;i<n;i++){
  const a=i*TAU/n,b=(i+1)*TAU/n;
  quad(g,v(R,a),v(R+1,a),v(R+1,b),v(R,b));
 }
 box('steel_light',[0,3.1,0],[3.2,6.2,3.2],0,part);
 box('steel_light',[0,10.2,7.2],[1.1,1.2,12.5],0,part);
 box('steel_light',[0,10.2,13],[3,3,3],0,part);
}
// A continuous barrel vault, with physical corrugation running lengthwise.
// Roof panels are NOT a row of disconnected, tilted rectangular boxes.
export const AIRFIELD_ROOF_SEGMENTS=108;
// Tall semi-elliptic Quonset-style vault. Eaves meet the 73m side walls,
// while the 108m crown forms a clearly readable round hangar silhouette.
const ROOF_HALF_WIDTH=61,ROOF_BASE_Y=73,ROOF_RISE=35;
const roofHeight=x=>ROOF_BASE_Y+ROOF_RISE*Math.sqrt(Math.max(0,1-(x/61.5)**2))+
 .65*Math.cos(x*TAU/6.7);
function barrelRoof(cx,front=20,back=-173){
 const roof=material('roof_corrugated');
 const face=material('camo'),rim=material('steel_light');
 const from=-ROOF_HALF_WIDTH,to=ROOF_HALF_WIDTH;
 for(let j=0;j<AIRFIELD_ROOF_SEGMENTS;j++){
  const x0=from+(to-from)*j/AIRFIELD_ROOF_SEGMENTS;
  const x1=from+(to-from)*(j+1)/AIRFIELD_ROOF_SEGMENTS;
  const y0=roofHeight(x0),y1=roofHeight(x1);
  const a=[cx+x0,y0,back],b=[cx+x0,y0,front];
  const d=[cx+x1,y1,back],e=[cx+x1,y1,front];
  const u0=(x0-from)/(to-from),u1=(x1-from)/(to-from);
  // Continuous UVs: one coherent corrugated-metal PBR texture over the vault.
  tri(roof,a,b,e,[[u0,0],[u0,3],[u1,3]]);
  tri(roof,a,e,d,[[u0,0],[u1,3],[u1,0]]);
  // Solid barrel gables close the door opening. UVs span the complete
  // facade (not one camo repeat per 1m roof segment).
  for(const z of [front-.5,back+.5]){
   const low0=[cx+x0,73.5,z],low1=[cx+x1,73.5,z];
   const high1=[cx+x1,y1,z],high0=[cx+x0,y0,z];
   tri(face,low0,low1,high1,[[u0,0],[u1,0],[u1,1]]);
   tri(face,low0,high1,high0,[[u0,0],[u1,1],[u0,1]]);
  }
  // Reinforcing ribs follow the SAME curvature; no straight bars pierce it.
  for(const z of [back+2,-107,-43,front-2]){
   const offset=1.15;
   quad(rim,[cx+x0,y0+offset,z-1],[cx+x0,y0+offset,z+1],
    [cx+x1,y1+offset,z+1],[cx+x1,y1+offset,z-1]);
  }
 }
 // Two team markings: flush against the arch and interrupted at the vents.
 const team=material('team');
 for(const side of [-1,1])for(const [z0,z1] of [[-153,-126],[-74,-15]]){
  const x0=side*40-1.4,x1=side*40+1.4;
  const sampleCount=4;
  for(let j=0;j<sampleCount;j++){
   const x=x0+(x1-x0)*j/sampleCount,n=x0+(x1-x0)*(j+1)/sampleCount;
   quad(team,[cx+x,roofHeight(x)+.55,z0],[cx+x,roofHeight(x)+.55,z1],
    [cx+n,roofHeight(n)+.55,z1],[cx+n,roofHeight(n)+.55,z0]);
  }
 }
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
 // The actual corrugated steel barrel shell replaces the entire row of
 // disconnected rectangular roof plates seen in the previous build.
 barrelRoof(cx);
 // Dark roof ventilators, none overlapped by the blue identification strips.
 for(const side of [-1,1]){
  const x=cx+side*33;
  // Vent plinths follow the higher curved roof rather than being buried.
  box('stone',[x,107,-105],[19,6.5,25]);
  box('vent',[x,112,-105],[16,3.6,22]);
  for(let i=0;i<5;i++)box('steel_dark',[x-6.0+i*3,114.7,-105],[1.3,1.5,21]);
  // Curved faction strips are generated together with barrelRoof(), never
  // through the raised ventilation housings or as hovering cuboids.
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
 // Real single FULL-WIDTH roller shutter: 16 independent horizontal
 // metallic slats, never two doors sliding apart. All are animated upward.
 for(let i=0;i<16;i++){
  const part='HangarRollupSlat_0_'+String(i).padStart(2,'0');
  box('door_corrugated',[0,0,0],[109,3.92,3.8],0,part);
 }
 rollerDrum();
 // Weathered, textured jamb rails and protective coil housing.
 for(const x of [cx-57,cx+57])
  box('gate_frame',[x,39,front+11],[4.5,71,6.5]);
 box('gate_frame',[cx,76.5,front+12],[119,14,18]);
 box('steel_dark',[cx,68,front+20],[110,2.8,2.2]);
 // Roof truss bases, outdoor electrical cabinets and in-ground flood lights.
 for(const x of [cx-64,cx+64]){
  box('concrete',[x,2,front+1],[15,4,15]);
  box('steel_dark',[x,39,front+8],[5,73,4]);
  box('steel_light',[x,75,front+8],[13,4,9]);
 }
 box('steel',[cx-73,19,-119],[17,34,18]);
 box('sand',[cx-73,35,-119],[17,4,19]);
 // Rounded military control tower to the LEFT of the hangar, outside
 // aircraft paths. The shaft, observation room and canopy are all 20-sided.
 const towerX=-269,towerZ=-81;
 cylindricalShell('concrete',towerX,towerZ,22,22,0,6,{caps:true});
 cylindricalShell('camo',towerX,towerZ,17.5,17.5,6,93,{caps:true});
 for(const y of [24,54,79])
  cylindricalShell('steel',towerX,towerZ,19.1,19.1,y-1.65,y+1.65);
 // Broad round observation deck with a slim circular safety apron.
 cylindricalShell('steel_dark',towerX,towerZ,25,25,92,97,{caps:true});
 // Panoramic glazing covers ALL 360 degrees, not four rectangular walls.
 // Each facet is a large vertical glass window with a thin steel mullion.
 cylindricalShell('glass',towerX,towerZ,23,23,97.5,117.5);
 for(let i=0;i<AIRFIELD_TOWER_SIDES;i++){
  const a=i*TAU/AIRFIELD_TOWER_SIDES;
  const x=towerX+23.25*Math.cos(a),z=towerZ+23.25*Math.sin(a);
  box('steel_dark',[x,107.5,z],[1.05,21.2,1.55],-a);
 }
 // Continuous round lower and upper glazing rings prevent floating panes.
 cylindricalShell('steel',towerX,towerZ,23.9,23.9,96,98);
 cylindricalShell('steel_dark',towerX,towerZ,23.9,23.9,117,119.5);
 // Single circular canopy, subtle olive roof and a small obstruction beacon.
 cylindricalShell('roof',towerX,towerZ,27.0,27.0,119.5,124,{caps:true});
 cylindricalShell('steel_light',towerX,towerZ,27.3,27.3,122.5,124.1);
 satelliteDish();
 box('steel_dark',[towerX+10,133,towerZ-8],[2.9,19,2.9]);
 box('warning',[towerX+10,143,towerZ-8],[5.5,3.2,5.5]);
 box('team',[towerX,112,towerZ+23.8],[12,7,.85]);
 // Near hangar and tower use neutral service accessories; the runway
 // remains untouched and terrain-draped by webgl-airfield-service.js.
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
function pngChunk(type,data){const name=Buffer.from(type);return Buffer.concat([be(data.length),name,data,be(crc32(Buffer.concat([name,data])))]);}
function png(color,key){
 const corrugated=key==='roof_corrugated';
 const width=corrugated?256:48,height=corrugated?256:48;
 let state=(color[0]*2161+color[1]*3191+color[2]*5779)>>>0;
 const scan=Buffer.alloc((width*4+1)*height);
 const random=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Uniform paint: same sRGB as the team roof stripes and the static flags.
  const i=y*(width*4+1)+1+x*4,noise=(key==='team'||key==='white')?0:Math.round((random()-.5)*17);
  let rgb=color;
  if(key==='camo'){const blob=Math.sin(x*.27+Math.cos(y*.31)*2.1)+Math.cos(y*.28-x*.12);
   if(blob>.73)rgb=[82,91,64];else if(blob<-.80)rgb=[128,134,96];}
  if(corrugated){
   // Embedded, tileable olive/khaki corrugated-sheet texture; 18
   // longitudinal folds, sun-faded crowns, dark seams and dusty streaks.
   // No third-party texture, network download or non-deterministic noise.
   const fold=Math.cos(x*TAU*18/width);
   const crest=Math.pow((1+fold)/2,4)*15;
   const seam=Math.pow((1-fold)/2,10)*-17;
   const weather=4*Math.sin(y*.055+Math.sin(x*.09))+
    3*Math.cos(y*.19+x*.035)+(random()-.5)*10;
   const patina=crest+seam+weather;
   rgb=color.map((v,ch)=>v+patina*(ch===1?1:.83));
  }
  for(let c=0;c<3;c++)scan[i+c]=Math.max(0,Math.min(255,rgb[c]+(corrugated?0:noise)));scan[i+3]=key==='glass'?210:255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(width,0);hdr.writeUInt32BE(height,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',hdr),pngChunk('IDAT',deflateSync(scan,{level:8})),pngChunk('IEND',Buffer.alloc(0))]);
}
function exportTeam(owner){
 const pal=JSON.parse(JSON.stringify(colors));
 if(owner===1)pal.team=factionRgb8(1);
 
 
 buildParts();
 const gltf={asset:{version:'2.0',generator:'sandforge-airfield-pbr-v2-rollup-satellite-20261116'},
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
   gltf.materials.push({name:'Sandforge_Airfield_'+g.name,
    ...(g.name==='glass'?{alphaMode:'BLEND'}:{}),pbrMetallicRoughness:{
    baseColorTexture:{index:image},metallicFactor:g.name==='roof_corrugated'?.21:
     /metal|bronze|gunmetal/.test(g.name)?.45:.07,
    roughnessFactor:g.name==='roof_corrugated'?.90:g.name==='glass'?.20:.83},
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
  const slat=partName.match(/^HangarRollupSlat_0_(\\d{2})$/);
  const drum=partName==='HangarRollupDrum_0';
  const rotor=partName===AIRFIELD_DISH_PIVOT;
  gltf.nodes.push({name:partName,mesh,
   ...(slat?{translation:[AIRFIELD_HANGAR_CENTER_X,6+Number(slat[1])*4,
     AIRFIELD_HANGAR_FRONT_Z+8]}:
     drum?{translation:[AIRFIELD_HANGAR_CENTER_X,75,AIRFIELD_HANGAR_FRONT_Z+14]}:
     rotor?{translation:[-269,128,-81]}:{})});
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
  gltf.images.length+' textures, 16 roll-up slats and glass tower satellite');
}
mkdirSync(OUT,{recursive:true});for(const owner of [0,1])exportTeam(owner);
