#!/usr/bin/env node
/** Deterministic self-contained authored Sandforge logistics PBR GLBs.
 * No external AI assets, Meshy round-trips, Blender, CDN or tracked binary files.
 * Produces faction truck GLBs with six independent wheel pivots and an animated
 * rear loading hatch, plus an actual neutral storage hall whose 18 separate
 * pallet/crate stacks visibly deplete and replenish at runtime.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {factionRgb8} from './sandforge-faction-palette.js';
const OUT=process.argv[2]||'src/assets/reborn/supply-pbr';
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const pal={
 sand:[188,163,122],light:[215,193,158],stone:[151,136,111],
 camo:[174,150,108],camoDark:[118,122,91],olive:[89,103,79],
 khaki:[149,143,104],canvas:[151,143,112],wood:[113,83,51],
 woodLight:[169,127,76],steel:[96,105,102],edge:[53,60,59],
 black:[31,38,38],glass:[33,54,57],rubber:[34,36,34],
 hub:[120,114,93],amber:[221,153,66],white:[224,220,192],
 hazard:[191,149,76],team:factionRgb8(0)
};
const seedHash=(s)=>[...s].reduce((h,c)=>(Math.imul(h^c.charCodeAt(0),16777619)>>>0),2166136261);
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const be=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
function pngChunk(name,data){const tag=Buffer.from(name),raw=Buffer.concat([tag,data]);let c=0xffffffff;for(const byte of raw)c=crcTable[(c^byte)&255]^(c>>>8);return Buffer.concat([be(data.length),tag,data,be((c^0xffffffff)>>>0)])}
function png(name,color){
 // 192 px baked albedo per material, fine enough for close RTS camera
 // while keeping shared assets and streaming memory under control.
 const w=192,h=192,scan=Buffer.alloc(h*(1+w*4));
 let state=seedHash(name);
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const idx=y*(1+w*4)+1+x*4,noise=(rand()-.5)*12;
  const ox=(x+Math.floor(Math.sin(y*.11+name.length)*6))/w;
  const oy=(y+Math.floor(Math.cos(x*.12)*5))/h;
  const patch=Math.sin(ox*TAU*2.4+Math.sin(oy*11)*1.4)+Math.cos(oy*TAU*2.2+ox*8);
  let colorNow=color;
  if(name==='camo'&&patch>.55)colorNow=pal.camoDark;
  else if(name==='camo'&&patch<-.9)colorNow=pal.light;
  else if(name==='canvas'&&patch>.95)colorNow=pal.khaki;
  if(name==='wood'||name==='woodLight'){
   const grain=Math.sin((x*.7+Math.sin(y*.18))*2)*7+Math.cos(y*.3)*4;
   for(let k=0;k<3;k++)scan[idx+k]=clamp(Math.round(colorNow[k]+noise+grain),0,255);
  }else for(let k=0;k<3;k++)scan[idx+k]=clamp(Math.round(colorNow[k]+noise),0,255);
  scan[idx+3]=255;
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w,0);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',hdr),
  pngChunk('IDAT',deflateSync(scan,{level:8})),pngChunk('IEND',Buffer.alloc(0))]);
}
function newScene(name,owner){
 const colors={...pal,team:factionRgb8(owner===1?1:0)};
 const nodes=[{name,children:[]}],parts=new Map();
 function node(name,parent=0,translation=[0,0,0]){
  const i=nodes.length;nodes.push({name,translation,children:[]});nodes[parent].children.push(i);return i;
 }
 function part(mat,n=0){
  const key=n+':'+mat;
  if(!parts.has(key))parts.set(key,{mat,n,p:[],normal:[],uv:[],idx:[]});
  return parts.get(key);
 }
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function tri(mat,a,b,c,n=0){
  const g=part(mat,n),normal=cross(sub(b,a),sub(c,a)),len=Math.hypot(...normal)||1;
  const base=g.p.length/3;
  for(const [index,p] of [a,b,c].entries()){
   g.p.push(...p);g.normal.push(...normal.map(x=>x/len));
   g.uv.push(index===0?0:index===1?1:0,index===2?1:0);
  }
  g.idx.push(base,base+1,base+2);
 }
 const quad=(mat,a,b,c,d,n=0)=>{tri(mat,a,b,c,n);tri(mat,a,c,d,n)};
 function box(mat,[px,py,pz],[w,h,d],n=0,yaw=0){
  const sx=w/2,sy=h/2,sz=d/2,cs=Math.cos(yaw),sn=Math.sin(yaw);
  const v=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],
   [-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]]
   .map(([x,y,z])=>[px+x*cs+z*sn,py+y,pz+z*cs-x*sn]);
  for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(mat,v[a],v[b],v[c],v[d],n);
 }
 function wedge(mat,[px,py,pz],[w,h,d],n=0,rise=5){
  const sx=w/2,sz=d/2;
  const a=[px-sx,py,pz-sz],b=[px+sx,py,pz-sz],c=[px+sx,py,pz+sz],corner=[px-sx,py,pz+sz];
  const e=[px-sx,py+h-rise,pz-sz],f=[px+sx,py+h-rise,pz-sz],
   g=[px+sx,py+h,pz+sz],i=[px-sx,py+h,pz+sz];
  for(const four of [[a,b,c,corner],[e,i,g,f],[a,e,f,b],[b,f,g,c],[c,g,i,corner],[corner,i,e,a]])quad(mat,...four,n);
 }
 /** Proper outward-facing cylinder along X (old end-cap triangles were
  * degenerate and the huge rectangular cleats looked like giant black blobs).
  */
 function cylinderX(mat,r,width,n=0,segments=24,center=[0,0,0]){
  const [x,y,z]=center;
  const v=(u,ang)=>[x+u,y+r*Math.sin(ang),z+r*Math.cos(ang)];
  for(let i=0;i<segments;i++){
   const a=i*TAU/segments,b=(i+1)*TAU/segments;
   quad(mat,v(-width/2,a),v(width/2,a),v(width/2,b),v(-width/2,b),n);
   tri(mat,[x+width/2,y,z],v(width/2,b),v(width/2,a),n);
   tri(mat,[x-width/2,y,z],v(-width/2,a),v(-width/2,b),n);
  }
 }
 /** Low-profile tread ribs follow the tyre circumference tangentially,
  * not sharp cubes protruding through the wheel. All rotate with the pivot.
  */
 function tyreBand(n,r=12.2,width=9.4){
  const segments=28,half=width/2-.8;
  for(let i=0;i<segments;i++){
   const a=(i+.13)*TAU/segments,b=(i+.74)*TAU/segments;
   const p=(x,ang)=>[x,(r+.19)*Math.sin(ang),(r+.19)*Math.cos(ang)];
   quad('edge',p(-half,a),p(half,a),p(half,b),p(-half,b),n);
  }
 }
 function beam(mat,a,b,width,n=0){
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz)||1,
   mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,mz=(a[2]+b[2])/2;
  if(Math.abs(dy)>Math.abs(dx)+Math.abs(dz))box(mat,[mx,my,mz],[width,len,width],n);
  else box(mat,[mx,my,mz],[Math.abs(dx)+width,Math.abs(dy)+width,Math.abs(dz)+width],n);
 }
 function buildGLB(outFile,animations=[]){
  const gltf={asset:{version:'2.0',generator:'Sandforge authored logistics PBR build 2026-11-17'},
   scene:0,scenes:[{nodes:[0]}],nodes,meshes:[],materials:[],images:[],textures:[],
   samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
   buffers:[{byteLength:0}],bufferViews:[],accessors:[],animations:[]};
  const chunks=[];let offset=0;
  function append(blob,target){
   const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad}
   const pos=offset;chunks.push(blob);offset+=blob.length;const i=gltf.bufferViews.length;
   const v={buffer:0,byteOffset:pos,byteLength:blob.length};if(target)v.target=target;
   gltf.bufferViews.push(v);return i;
  }
  function accessor(values,type,dim,component,bounds=false){
   const raw=Buffer.alloc(values.length*4);
   values.forEach((v,i)=>component===5125?raw.writeUInt32LE(v>>>0,i*4):raw.writeFloatLE(v,i*4));
   const bufferView=append(raw,component===5125?34963:34962);
   const a={bufferView,componentType:component,count:values.length/dim,type};
   if(bounds){
    a.min=Array(dim).fill(Infinity);a.max=Array(dim).fill(-Infinity);
    values.forEach((v,i)=>{const d=i%dim;a.min[d]=Math.min(a.min[d],v);a.max[d]=Math.max(a.max[d],v)});
   }
   const i=gltf.accessors.length;gltf.accessors.push(a);return i;
  }
  const mats=new Map();
  function mat(name){
   if(mats.has(name))return mats.get(name);
   const image=gltf.images.length;
   gltf.images.push({bufferView:append(png(name,colors[name])),mimeType:'image/png'});
   gltf.textures.push({sampler:0,source:image});
   const id=gltf.materials.length;
   gltf.materials.push({name:'Sandforge_Logistics_'+name,pbrMetallicRoughness:{
    baseColorTexture:{index:image},metallicFactor:/^(steel|edge|black|hub)$/.test(name)?.50:.05,
    roughnessFactor:/^(glass|amber)$/.test(name)?.45:.87},doubleSided:false,
    emissiveFactor:[0,0,0]});
   mats.set(name,id);return id;
  }
  for(const p of parts.values()){
   const attrs={POSITION:accessor(p.p,'VEC3',3,5126,true),
    NORMAL:accessor(p.normal,'VEC3',3,5126),TEXCOORD_0:accessor(p.uv,'VEC2',2,5126)};
   const meshIndex=gltf.meshes.length;
   gltf.meshes.push({name:nodes[p.n].name+'_'+p.mat,
    primitives:[{attributes:attrs,indices:accessor(p.idx,'SCALAR',1,5125),material:mat(p.mat)}]});
   // Keep the named animation/stock group as a pivot, never collapse it.
   const child=nodes.length;
   nodes.push({name:'Mesh_'+nodes[p.n].name+'_'+p.mat,mesh:meshIndex});
   nodes[p.n].children.push(child);
  }
  for(const animation of animations){
   const channels=[],samplers=[];
   for(const track of animation.tracks){
    const input=accessor(track.times,'SCALAR',1,5126,true);
    const output=accessor(track.values,track.path==='rotation'?'VEC4':'VEC3',track.path==='rotation'?4:3,5126);
    const i=samplers.length;samplers.push({input,output,interpolation:'LINEAR'});
    channels.push({sampler:i,target:{node:track.node,path:track.path}});
   }
   gltf.animations.push({name:animation.name,samplers,channels});
  }
  const bin=Buffer.concat(chunks);gltf.buffers[0].byteLength=bin.length;
  const json=Buffer.from(JSON.stringify(gltf)),pj=(4-json.length%4)%4,pb=(4-bin.length%4)%4;
  const out=Buffer.alloc(12+8+json.length+pj+8+bin.length+pb);
  out.write('glTF',0,'ascii');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(json.length+pj,12);out.write('JSON',16,'ascii');json.copy(out,20);
  out.fill(0x20,20+json.length,20+json.length+pj);
  const at=20+json.length+pj;out.writeUInt32LE(bin.length+pb,at);out.write('BIN\0',at+4,'ascii');
  bin.copy(out,at+8);
  writeFileSync(join(OUT,outFile),out);
  console.log('PBR GLB '+outFile+' '+(out.length/1024).toFixed(1)+' KiB, '+gltf.meshes.length+
   ' textured mesh batches, '+gltf.animations.length+' authored animation clips');
 }
 return {box,wedge,cylinderX,tyreBand,beam,node,buildGLB};
}
function truck(owner){
 const a=newScene('SF_Supply_Truck_Root',owner),{box,wedge,cylinderX,tyreBand,node}=a;
 // 3-axle articulated field supply vehicle; nose is local +Z.
 box('edge',[0,13,-3],[48,7,105]);box('steel',[0,19,-2],[44,4,94]);
 box('black',[0,19,48],[50,9,14]);box('hub',[0,19,55],[48,4,8]);
 wedge('camo',[0,30,31],[47,24,31],0,5);
 wedge('light',[0,27,51],[49,13,20],0,5);
 box('camo',[0,22,50],[44,5,18]);
 // Windscreen visor and asymmetric cab doors.
 box('glass',[0,37.7,47.9],[39,12,2]);
 box('edge',[0,45,39],[49,4,38]);
 box('camoDark',[0,47,36],[41,2,34]);
 for(const side of [-1,1]){
  box('glass',[side*24.2,33,34],[2,12,18]);
  box('steel',[side*25,19.5,27],[2,18,23]);
  box('black',[side*26,25,31],[2,2,8]);
  box('edge',[side*27,35,43],[8,3,4]);
  box('steel',[side*25.5,38.5,45],[2,11,2]);
  box('team',[side*25.4,23.5,38],[2,5,19]);
  box('camo',[side*24,26,60],[4,11,21]);
  box('amber',[side*20,27,63],[7,7,2]);
  // Strong cab fenders make six wheels visually separate at camera distance.
  for(const z of [29,-15,-40]){
   box('edge',[side*26,22,z],[6,4,29]);
   box('hub',[side*26,24,z],[5,3,27]);
  }
 }
 for(let i=0;i<7;i++)box('edge',[-16+i*5.3,27,62],[2,10,2]);
 box('black',[0,17,64],[39,6,4]);
 box('amber',[-18,38,62],[7,4,2]);box('amber',[18,38,62],[7,4,2]);
 // High-detail delivery cab, load bed and armoured hard-shell container.
 box('steel',[0,20,-29],[50,7,66]);box('stone',[0,25,-30],[49,7,65]);
 box('camo',[0,43,-31],[52,30,62]);box('camoDark',[0,61,-31],[57,6,67]);
 box('light',[0,63.7,-31],[52,2,63]);
 for(const side of [-1,1]){
  box('olive',[side*27,44,-32],[2,7,55]);
  box('team',[side*28.3,44,-25],[2,5,39]);
  box('steel',[side*27.8,54,-32],[3,2,62]);
  box('edge',[side*26.9,34,-31],[3,2,65]);
  for(const z of [-52,-34,-16]){
   box('steel',[side*28.1,49,z],[2.8,26,2.8]);
   box('black',[side*29,39,z+7],[2,3,9]);
  }
  for(const z of [-53,-18])box('amber',[side*28.8,61,z],[3,4,5]);
 }
 // Roof cargo hatch clamps, metal ribs, three raised roof recesses.
 for(const z of [-56,-32,-10]){
  box('steel',[0,65.1,z],[50,2.5,3]);
  for(const x of [-21,21])box('edge',[x,66.7,z],[8,2,9]);
 }
 box('edge',[0,67,-38],[24,1.3,20]);
 for(let i=0;i<7;i++)box('steel',[-10+i*3.3,68.2,-38],[1.3,2,17]);
 // Rear loading doors are proper independently hinged GLB nodes.
 const doors=[];
 for(const side of [-1,1]){
  const hinge=node('SF_Supply_CargoDoor_'+(side<0?'L':'R'),0,[side*24,44,-63]);
  doors.push({node:hinge,side});
  box('olive',[-side*12,0,-1],[23,29,2.7],hinge);
  box('team',[-side*12,-2,-2.7],[18,4,1.2],hinge);
  for(const yy of [-11,9])box('steel',[-side*12,yy,-3.4],[20,2,1.2],hinge);
  box('edge',[-side*19,-.5,-3.8],[2,17,1],hinge);
 }
 // Separate cargo objects can be toggled after actual pickup.
 const cargo=node('SF_Supply_Cargo',0,[0,0,0]);
 for(const x of [-12,12])for(const z of [-55,-39]){
  box('wood',[x,43,z],[20,17,15],cargo);
  box('woodLight',[x,52,z],[21,2,16],cargo);
  for(const side of [-1,1])
   box('edge',[x+side*9,43,z],[2,17,15],cargo);
 }
 // Rounded low-profile military all-terrain tyres, 3 axles / 6 wheels.
 // Former mesh used 16 huge rotated rectangular cleats per tyre; viewed
 // isometrically those resembled gears/black rocks rather than real wheels.
 const wheels=[];
 for(const side of [-1,1])for(const [idx,z] of [[0,29],[1,-15],[2,-43]]){
  const label='SF_Supply_Wheel_'+(side<0?'L':'R')+'_'+idx;
  const pivot=node(label,0,[side*30,13.3,z]);wheels.push(pivot);
  cylinderX('rubber',12.2,9.4,pivot,28);
  tyreBand(pivot,12.2,9.4);
  // Separately coloured sidewall, recessed ring, hub and six lug nuts.
  cylinderX('black',9.1,10.2,pivot,28);
  cylinderX('steel',7.1,11.4,pivot,24);
  cylinderX('hub',5.5,12.1,pivot,24);
  cylinderX('edge',2.4,12.6,pivot,16);
  for(let i=0;i<6;i++){
   const angle=i*TAU/6,yy=Math.sin(angle)*4.15,zz=Math.cos(angle)*4.15;
   // Flush lug nuts: visually readable without spikes.
   cylinderX('steel',.85,1.1,pivot,8,[side*6.2,yy,zz]);
  }
 }

 for(const z of [-15,-43])box('edge',[0,12,z],[70,3,4]);
 box('black',[0,14,-65],[45,5,4]);box('amber',[-21,18,-67],[7,3,2]);box('amber',[21,18,-67],[7,3,2]);
 const spin={name:'SupplyWheelRoll',tracks:wheels.map(n=>{
  const times=[0,.25,.5,.75,1],values=[];
  for(let i=0;i<times.length;i++){const angle=TAU*i/4;values.push(Math.sin(angle/2),0,0,Math.cos(angle/2))}
  return {node:n,path:'rotation',times,values};
 })};
 const doorClip={name:'SupplyCargoDoorsOpen',tracks:doors.map(({node:n,side})=>{
  const times=[0,.3,.75],values=[];
  for(const value of [0,side*-.65,side*-1.15])values.push(0,Math.sin(value/2),0,Math.cos(value/2));
  return {node:n,path:'rotation',times,values};
 })};
 a.buildGLB('supply-'+owner+'.glb',[spin,doorClip]);
}
function crate(a,n,x,y,z,width=19,depth=17,kind='wood'){
 const {box}=a;
 box('wood',[x,y-9,z],[width+2,4,depth+2],n);
 if(kind==='wood'){
  box('woodLight',[x,y,z],[width,17,depth],n);
  box('wood',[x,y+9,z],[width+2,3,depth+2],n);
  for(const side of [-1,1]){
   box('wood',[x+side*(width/2-.6),y,z],[2.2,17,depth+2],n);
   box('edge',[x+side*width/3,y,z+depth/2+.4],[1.6,14,1.5],n);
  }
  box('wood',[x,y,z+depth/2+.7],[width+1,2.8,1.2],n);
  box('wood',[x,y,z-depth/2-.7],[width+1,2.8,1.2],n);
 }else{
  box('olive',[x,y,z],[width,17,depth],n);
  box('khaki',[x,y+9,z],[width+1,3,depth+1],n);
  for(const side of [-1,1]){
   box('steel',[x+side*width/2,y,z],[2,13,depth-2],n);
   box('black',[x+side*(width/2-3),y+6,z+depth/2],[2,3,2],n);
  }
  box('black',[x,y-1,z+depth/2+.4],[width-4,2,1.2],n);
 }
}
function depot(){
 const a=newScene('SF_Supply_Depot_PBR_Root',0),{box,wedge,beam,node}=a;
 // Real storage building remains readable, but has a large clean loading bay
 // and correctly scaled pallets. No scattered toy-sized loose objects.
 box('stone',[0,2,-71],[195,4,154]);
 box('edge',[0,4,-71],[192,2,150]);
 box('camo',[0,32,-112],[183,57,6]);
 for(const side of [-1,1]){
  box('camo',[side*91,35,-72],[6,64,143]);
  for(const z of [-129,-90,-53]){
   box('steel',[side*94,35,z],[5,53,5]);
   box('olive',[side*95,36,z+15],[3,19,25]);
  }
 }
 // Open front bay under a dark trussed roof; crates physically underneath.
 box('camo',[-79,34,-6],[26,60,7]);
 box('camo',[79,34,-6],[26,60,7]);
 box('camo',[0,58,-6],[145,12,7]);
 for(const x of [-62,62])box('steel',[x,31,-2],[7,54,8]);
 box('black',[0,36,-9],[112,42,2]);
 // OPEN STORAGE COURTYARD: a complete roof concealed all 18 stock groups
 // from the elevated RTS camera. Keep a roof over the rear offices, side
 // rails and exposed metal beams, but leave the pallet bays visibly open.
 box('edge',[0,71,-128],[204,8,34]);
 box('camo',[0,76,-128],[202,5,32]);
 box('camoDark',[-46,79,-128],[67,2,28]);
 box('khaki',[43,79,-128],[50,2,28]);
 for(const z of [-143,-110,-68,-28]){
  box('steel',[0,78,z],[195,3.3,3.5]);
 }
 for(const x of [-100,100])box('edge',[x,73,-75],[6,6,159]);
 // Short side sunshades without a solid ceiling above the crates.
 for(const x of [-91,91])box('canvas',[x,75,-65],[15,3,72]);
 // Deeper covered front platform; intentionally wide access lane in the middle.
 box('stone',[0,3,21],[185,6,60]);
 for(const x of [-91,91])box('edge',[x,5,21],[5,7,61]);
 for(const z of [7,38])box('hazard',[0,6,z],[160,1.3,3]);
 for(const x of [-87,87]){
  box('steel',[x,35,30],[7,61,7]);
  beam('edge',[x,60,30],[x*.85,76,-5],6);
  box('edge',[x,65,30],[16,5,14]);
 }
 // Weatherproof loading lip only: the stock at z -44/-11/+22
 // remains completely visible from above. A 25-unit lip shades the ramp.
 box('camo',[0,78,51],[191,7,24]);
 box('camoDark',[-44,82,51],[62,1.6,19]);
 box('light',[40,82,51],[47,1.6,19]);
 for(const x of [-91,91])box('steel',[x,80,34],[5,8,48]);
 for(const z of [34,65])box('edge',[0,82,z],[188,3,4]);
 for(const x of [-60,60])box('amber',[x,71,50],[33,3.5,4]);
 // Raised rear annex: real large shipping container, NOT a tiny shed.
 box('steel',[121,16,-102],[62,29,81]);
 box('camo',[121,38,-102],[65,18,84]);
 box('light',[121,49,-102],[68,4,88]);
 box('team',[154,27,-98],[2,6,56]);
 for(const z of [-136,-117,-99,-81,-62])box('edge',[154,30,z],[4,34,2]);
 for(const x of [102,142])box('black',[x,21,-58],[9,20,3]);
 // Roof utilities integrated into the surface instead of floating pieces.
 box('edge',[-38,83,-128],[42,4,30]);
 for(let i=0;i<7;i++)box('steel',[-55+i*5.5,87,-128],[2,4,26]);
 box('stone',[55,84,-128],[27,9,29]);
 for(let i=0;i<5;i++)box('black',[45+i*5,90,-127],[2,2,24]);
 // Corner markings and large, solid readable cargo doors.
 for(const x of [-63,63]){
  box('olive',[x,29,-2],[31,35,4]);
  box('team',[x,28,1],[20,5,2]);
  box('edge',[x,51,2],[31,3,4]);
  for(let i=0;i<4;i++)box('steel',[x-11+i*7,32,3],[2,24,2]);
 }
 // Eighteen intentionally full-sized stock groups. Their occupancy is mapped
 // to authoritative credits; disappearing/reappearing is visual only.
 for(let i=0;i<18;i++){
  const row=Math.floor(i/6),col=i%6;
  // Stock sits in side bays leaving a broad central lane for trucks.
  const side=col<3?-1:1,slot=col%3;
  const x=side*(48+slot*18),z=-44+row*33;
  const group=node('SF_DepotStock_'+String(i).padStart(2,'0'));
  crate(a,group,x,20,z,18,17,i%3===0?'metal':'wood');
  if(i%4===0)crate(a,group,x,41,z,16,16,'metal');
  if(i%3===1){
   box('canvas',[x,35,z],[19,4,20],group);
   box('wood',[x,38,z],[18,2,18],group);
  }
 }
 // Pallet support shelves large enough to be legible from RTS zoom.
 for(const side of [-1,1])for(const z of [-45,-11,22]){
  // All pallets live in the two storage bays, never as tiny debris
  // in the middle of the supply truck's broad drive-through route.
  box('wood',[side*77,10,z],[44,6,27]);
  for(const x of [side*59,side*95])box('wood',[x,5,z],[8,7,25]);
 }
 // One industrial loading-ramp gate; animated independently.
 const ramp=node('SF_DepotLoadingRamp',0,[0,6,46]);
 box('steel',[0,0,7],[51,3,28],ramp);
 box('hazard',[0,1,17],[52,1,4],ramp);
 for(const x of [-22,22])box('edge',[x,1,7],[3,3,25],ramp);
 const lamp=node('SF_Depot_LoadBeacon',0,[0,84,53]);
 box('edge',[0,0,0],[10,6,10],lamp);
 box('amber',[0,6,0],[7,7,7],lamp);
 const clip={name:'DepotRampLower',tracks:[{node:ramp,path:'rotation',
  times:[0,.3,1],values:[0,0,0,1,Math.sin(-.14),0,0,Math.cos(-.14),
   Math.sin(-.25),0,0,Math.cos(-.25)]}]};
 const beacon={name:'DepotBeaconPulse',tracks:[{node:lamp,path:'scale',
  times:[0,.5,1],values:[1,1,1,1.18,1.2,1.18,1,1,1]}]};
 a.buildGLB('supply-depot-neutral.glb',[clip,beacon]);
}
mkdirSync(OUT,{recursive:true});
for(const owner of [0,1])truck(owner);
depot();
