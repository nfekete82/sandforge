#!/usr/bin/env node
// Reproducible full 3D, photo-reference architectural vehicle factory,
// physically textured roof, vent equipment, utility wing and open exit.
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
export const FACTORY_REFERENCE_REVISION='sandforge-industrial-reference-factory-v3-20261120';
export const FACTORY_OPEN_BAY_WIDTH=3.36;
export const FACTORY_OPEN_BAY_HEIGHT=2.14;
export const FACTORY_ROOF_VENT_GAP=Object.freeze([-1.35,-.18]);
const colors={
 camo:[160,164,151],sand:[188,187,168],sand_light:[213,207,184],
 wall_weather:[155,158,148],metal_cladding:[137,145,141],
 roof_rib:[110,118,112],roof_glazing:[63,86,87],pipe:[113,121,115],
 stack:[147,154,149],hazard_white:[208,207,189],hazard_rust:[185,92,58],
 khaki:[148,144,113],olive:[92,107,82],roof:[142,145,137],
 concrete:[132,130,111],stone:[177,165,138],
 steel:[104,112,107],steel_dark:[51,58,57],steel_light:[160,168,162],
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
// Architectural trapezoidal panels are REAL non-planar GLB geometry.
// Unlike dozens of rectangular roof blocks, they create a true silhouette
// with lighting, visible thickness and baked UVs for high-res PBR maps.
function roofPlate(mat,points,thickness=.065){
 const g=material(mat),upper=points.map(p=>[p[0]*FACTORY_WIDTH_FACTOR,p[1],p[2]]),
 lower=upper.map(p=>[p[0],p[1]-thickness,p[2]]);
 quad(g,upper[0],upper[1],upper[2],upper[3]);
 quad(g,lower[3],lower[2],lower[1],lower[0]);
 for(let i=0;i<4;i++){const n=(i+1)%4;quad(g,upper[i],lower[i],lower[n],upper[n]);}
}
function roofY(x){return 2.55+(x<-.10?(x+2.50)/2.40*.66:(2.50-x)/2.60*.66);}
function roofLine(mat,x0,x1,z0,z1,lift=.015){
 roofPlate(mat,[[x0,roofY(x0)+lift,z0],[x1,roofY(x1)+lift,z0],
  [x1,roofY(x1)+lift,z1],[x0,roofY(x0)+lift,z1]],.012);
}
function roofSystem(){
 // The original game image has a heavy, sloping metal hangar roof with
 // separate raised recessed HVAC/skylight racks, a colored long ridge,
 // strong painted eaves and exposed industrial brackets.
 for(const [z0,z1] of [[-2.30,-1.65],[-1.65,-1.00],[-1.00,-.35],[-.35,.30],
  [.30,.95],[.95,1.60],[1.60,2.31]]){
  roofPlate('roof',[[-2.50,2.55,z0],[-.10,3.21,z0],
   [-.10,3.21,z1],[-2.50,2.55,z1]],.07);
  roofPlate('roof',[[ -.10,3.21,z0],[2.50,2.55,z0],
   [2.50,2.55,z1],[-.10,3.21,z1]],.07);
 }
 // Thick fascia on every side, contrasting riveted black metal.
 for(const x of [-2.50,2.50])
  box('roof_rib',[x,2.52,0],[.145,.21,4.84]);
 for(const z of [-2.36,2.36])
  beam('roof_rib',[-2.53,2.53,z],[2.53,2.53,z],.105);
 beam('metal_cladding',[-.10,3.24,-2.37],[-.10,3.24,2.37],.13);
 // Raised factory-made roof glass and three well-defined framed equipment
 // trays: front-to-back modules are visible from the tactical camera.
 for(const [z0,z1] of [[-1.92,-1.27],[-.77,-.12],[.46,1.11]]){
  roofLine('steel_dark',-2.13,-.55,z0-.055,z1+.055,.080);
  roofLine('roof_glazing',-2.06,-.62,z0,z1,.100);
  for(const z of [z0+.05,z1-.05])
   beam('steel_light',[-2.08,roofY(-2.08)+.13,z],[-.59,roofY(-.59)+.13,z],.055);
  for(const x of [-2.05,-1.70,-1.36,-1.02,-.64])
   roofLine('roof_rib',x,x+.03,z0,z1,.125);
 }
 // Built-in corrugated roof and pitched narrow raised panels.
 for(let x=-2.40;x<2.47;x+=.165){
  if(Math.abs(x)<.15)continue;
  roofLine('roof_rib',x,x+.026,-2.27,2.27,.022);
 }
 // Two blue/red faction marks, split around ventilation support zone.
 for(const x of [-1.55,1.55])for(const [z0,z1] of [
  [-1.71,FACTORY_ROOF_VENT_GAP[0]],[FACTORY_ROOF_VENT_GAP[1],1.51]
 ])roofLine('team',x-.072,x+.072,z0,z1,.17);
 // Long architectural stripe at the right roofline, as on the screenshot.
 roofLine('team',2.38,2.48,-2.24,2.24,.066);
 // HVAC array: 4 genuinely inset fan-blowers, panel-by-panel grilles.
 for(const [x,z] of [[.69,.38],[1.23,.40],[.72,1.08],[1.26,1.08]]){
  const y=roofY(x)+.14;
  box('metal_cladding',[x,y,z],[.40,.11,.44]);
  box('steel_dark',[x,y+.067,z],[.29,.016,.33]);
  for(let k=0;k<5;k++)
   box('steel_light',[x-.123+k*.061,y+.081,z],[.024,.013,.31]);
  box('roof_rib',[x,y+.10,z-.17],[.40,.06,.045]);
 }
 // Angled external roof supports and collector / coolant piping.
 for(const z of [-2.10,2.10])for(const x of [-2.0,-1.15,.65,1.65]){
  const y=roofY(x);
  beam('steel_light',[x,y-.34,z],[x,y-.01,z],.056);
 }
 beam('pipe',[-.32,3.31,-1.95],[1.35,3.43,-1.95],.064);
}
function factoryUtilityWing(){
 // Raised right-rear mechanical assembly, visually separate from the
 // sloped main hangar. Two blue/red capped exhaust towers and one large
 // vertical louver block match the distinctive reference silhouette.
 box('steel_dark',[1.48,3.35,-1.36],[1.78,.30,1.70]);
 box('wall_weather',[1.50,3.83,-1.40],[1.58,.90,1.43]);
 box('metal_cladding',[1.48,4.36,-1.40],[1.80,.17,1.65]);
 box('steel_light',[1.47,4.49,-1.40],[1.57,.09,1.39]);
 // Large front-facing black radiator / intake grille and horizontal fins.
 box('steel_dark',[1.48,3.76,-.633],[1.29,.63,.053]);
 for(let i=0;i<7;i++)
  box('steel_light',[1.48,3.49+i*.092,-.594],[1.27,.024,.040]);
 for(const x of [.78,2.20])
  box('roof_rib',[x,3.73,-.59],[.085,.82,.075]);
 // Two tall individually machined exhaust stacks with faction-color caps.
 for(const x of [1.06,1.85]){
  box('steel_dark',[x,4.51,-1.66],[.36,.34,.37]);
  box('stack',[x,5.12,-1.66],[.26,.92,.26]);
  box('metal_cladding',[x,5.61,-1.66],[.32,.09,.32]);
  box('team',[x,5.68,-1.66],[.35,.075,.35]);
  box('vent',[x,5.73,-1.66],[.24,.026,.24]);
  for(const z of [-1.82,-1.50])
   box('steel_dark',[x,5.10,z],[.29,.03,.022]);
 }
 // Lower exhaust return / accessory transformer on the rear right.
 box('concrete',[2.02,.32,-.86],[.50,.60,.62]);
 box('metal_cladding',[2.02,.72,-.86],[.55,.13,.68]);
 for(let k=0;k<4;k++)box('vent',[2.24,.48,-1.04+k*.12],[.04,.22,.075]);
 // Industrial utility cables stay above the roof or OUTSIDE the exit lane.
 beam('pipe',[.84,4.09,-.84],[.84,3.28,-.24],.075);
 beam('pipe',[2.21,4.06,-1.75],[2.42,2.65,-1.91],.065);
}
// Stenciled warnings and real independent thin plates, not an opaque gate.
function openFactoryApron(){
 box('concrete',[.18,.105,2.71],[3.36,.16,1.34]);
 for(let i=-6;i<=6;i++){
  const x=.18+i*.230;
  // Painted diagonal hazard chevrons running across the full access ramp.
  const a=[x-.11,.194,2.82],b=[x+.015,.194,2.82],
   c=[x+.25,.194,3.33],d=[x+.11,.194,3.33];
  const g=material(i%2===0?'hazard_white':'hazard_rust');
  quad(g,a.map((v,j)=>j===0?v*FACTORY_WIDTH_FACTOR:v),
   b.map((v,j)=>j===0?v*FACTORY_WIDTH_FACTOR:v),
   c.map((v,j)=>j===0?v*FACTORY_WIDTH_FACTOR:v),
   d.map((v,j)=>j===0?v*FACTORY_WIDTH_FACTOR:v));
 }
 for(const x of [-1.28,1.62]){
  box('steel_dark',[x,.199,2.78],[.04,.024,1.02]);
  // Stepped cable and ramp drainage grates.
  for(const z of [2.39,2.65,3.12])
   box('steel_light',[x,.208,z],[.13,.015,.11]);
 }
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
 // Open ramp is authored separately at the end of this 3D build.
 // The reference-inspired sloped sheet-metal roof replaces the old flat
 // primitive top. Machinery remains legible and entirely beyond exit height.
 roofSystem();
 factoryUtilityWing();
 // The ramp has authentic diagonally striped concrete instead of a shutter.
 openFactoryApron();
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
 box('steel_dark',[.18,2.47,2.30],[3.39,.10,.10]);
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
 const gltf={asset:{version:'2.0',generator:FACTORY_REFERENCE_REVISION},
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
