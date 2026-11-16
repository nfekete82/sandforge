import * as THREE from 'three';

// Every visible Barracks prop surface uses a PBR texture set, not a flat tint.
// Deterministic 256px tiling maps are generated once and shared by all instances.
// Independent of the WebGL facade/camouflage shader used by older buildings.
const SIZE=256;
export const BARRACKS_PROP_SURFACES=Object.freeze({
 linen:Object.freeze({base:[191,161,117],metalness:0,roughness:.93,relief:1.1,seed:101}),
 linenShade:Object.freeze({base:[174,148,107],metalness:0,roughness:.95,relief:1.15,seed:102}),
 stitching:Object.freeze({base:[137,111,73],metalness:0,roughness:.97,relief:.60,seed:103}),
 olivePaint:Object.freeze({base:[107,120,82],metalness:.06,roughness:.82,relief:.46,seed:201}),
 oliveLid:Object.freeze({base:[129,139,98],metalness:.09,roughness:.78,relief:.40,seed:202}),
 supplyWood:Object.freeze({base:[144,115,78],metalness:0,roughness:.91,relief:.85,seed:301}),
 darkSteel:Object.freeze({base:[62,70,66],metalness:.65,roughness:.57,relief:.48,seed:401}),
 brightSteel:Object.freeze({base:[152,159,152],metalness:.72,roughness:.49,relief:.36,seed:402}),
 dishMetal:Object.freeze({base:[119,136,130],metalness:.70,roughness:.52,relief:.34,seed:403}),
 fenceSteel:Object.freeze({base:[66,72,67],metalness:.74,roughness:.64,relief:.44,seed:404}),
 helmetPaint:Object.freeze({base:[100,112,79],metalness:.22,roughness:.85,relief:.55,seed:405}),
 rubber:Object.freeze({base:[47,49,43],metalness:.03,roughness:.97,relief:.75,seed:501}),
 trackMetal:Object.freeze({base:[85,91,79],metalness:.55,roughness:.78,relief:.64,seed:502})
});

const mapsByRole=new Map(),materialsByRole=new Map();
const clamp=(v,low=0,high=1)=>Math.min(high,Math.max(low,v));
function hash(x,y,seed){
 let h=Math.imul(x+seed*17,374761393)^Math.imul(y+seed*31,668265263);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,y,step,seed){
 const grid=SIZE/step;
 const ix=Math.floor(x/step),iy=Math.floor(y/step);
 const u=x/step-ix,v=y/step-iy;
 const sx=u*u*(3-2*u),sy=v*v*(3-2*v);
 const a=hash(ix%grid,iy%grid,seed);
 const b=hash((ix+1)%grid,iy%grid,seed);
 const c=hash(ix%grid,(iy+1)%grid,seed);
 const d=hash((ix+1)%grid,(iy+1)%grid,seed);
 return ((a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy);
}

function pixel(role,x,y,spec){
 const large=noise(x,y,64,spec.seed),medium=noise(x,y,16,spec.seed+13);
 const dust=noise(x,y,32,spec.seed+29),fine=hash(x,y,spec.seed+51)-.5;
 const weaveX=x%5===0?1:0,weaveY=y%5===0?1:0;
 const stitchWeave=weaveX*.28+weaveY*.27;
 const paintScratch=hash(Math.floor(x/2),Math.floor(y/7),spec.seed+73)>.992?1:0;
 const lengthwise=Math.sin(2*Math.PI*(y*13/SIZE+Math.sin(x*2*Math.PI*2/SIZE)*.14));
 const metalBrush=Math.sin(2*Math.PI*y*64/SIZE);
 let relief=(medium-.5)*.26+fine*.17,colorOffset=(large-.5)*18+(medium-.5)*14+fine*10;
 let roughness=spec.roughness+(dust-.5)*.095+fine*.035;
 if(role==='linen'||role==='linenShade'||role==='stitching'){
  relief+=(stitchWeave-.12)*.52;
  colorOffset+=(stitchWeave-.12)*32-(dust>.64?8:0);
  roughness+=.015*stitchWeave;
 }else if(role==='supplyWood'){
  relief+=lengthwise*.22;
  colorOffset+=lengthwise*13-(dust>.77?8:0);
 }else if(role==='darkSteel'||role==='brightSteel'||role==='dishMetal'||role==='fenceSteel'||role==='trackMetal'){
  relief+=metalBrush*.035+paintScratch*.25;
  colorOffset+=metalBrush*3+paintScratch*18;
  roughness+=paintScratch*.16;
 }else{
  relief+=(paintScratch?.12:0)-(dust>.73?.13:0);
  colorOffset+=paintScratch*12-(dust>.68?10:0);
 }
 // These values are generated in texture space; unlike the old world-space
 // shader they stay attached when the building preview moves or rotates.
 return {rgb:spec.base.map((v,i)=>Math.round(clamp(v+colorOffset+(i===2?fine*4:0),10,245))),
  height:relief,roughness:clamp(roughness,.25,1)};
}
function makeTexture(data,name,srgb=false){
 const texture=new THREE.DataTexture(data,SIZE,SIZE,THREE.RGBAFormat);
 texture.name=name;
 if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.magFilter=THREE.LinearFilter;
 texture.anisotropy=4;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return texture;
}

export function barracksPropMaps(role){
 if(mapsByRole.has(role))return mapsByRole.get(role);
 const spec=BARRACKS_PROP_SURFACES[role];
 if(!spec)throw new Error('Unknown barracks PBR material: '+role);
 const color=new Uint8Array(SIZE*SIZE*4);
 const normal=new Uint8Array(SIZE*SIZE*4);
 const rough=new Uint8Array(SIZE*SIZE*4);
 const heights=new Float32Array(SIZE*SIZE);
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const i=y*SIZE+x,k=i*4,p=pixel(role,x,y,spec);
  heights[i]=p.height;
  for(let c=0;c<3;c++)color[k+c]=p.rgb[c];
  color[k+3]=255;
  const r=Math.round(p.roughness*255);
  rough[k]=r;rough[k+1]=r;rough[k+2]=r;rough[k+3]=255;
 }
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const k=(y*SIZE+x)*4;
  const left=heights[y*SIZE+(x+SIZE-1)%SIZE],right=heights[y*SIZE+(x+1)%SIZE];
  const top=heights[((y+SIZE-1)%SIZE)*SIZE+x],bottom=heights[((y+1)%SIZE)*SIZE+x];
  const dx=(right-left)*spec.relief,dy=(bottom-top)*spec.relief;
  const len=Math.hypot(dx,dy,1);
  normal[k]=Math.round((-.5*dx/len+.5)*255);
  normal[k+1]=Math.round((-.5*dy/len+.5)*255);
  normal[k+2]=Math.round((.5/len+.5)*255);
  normal[k+3]=255;
 }
 const maps=Object.freeze({
  color:makeTexture(color,'Barracks '+role+' base color',true),
  normal:makeTexture(normal,'Barracks '+role+' normal'),
  roughness:makeTexture(rough,'Barracks '+role+' roughness')
 });
 mapsByRole.set(role,maps);
 return maps;
}
export function barracksPropMaterial(role){
 if(materialsByRole.has(role))return materialsByRole.get(role);
 const spec=BARRACKS_PROP_SURFACES[role],maps=barracksPropMaps(role);
 const material=new THREE.MeshStandardMaterial({
  color:'#ffffff',map:maps.color,normalMap:maps.normal,
  roughnessMap:maps.roughness,roughness:1,metalness:spec.metalness
 });
 material.name='Barracks PBR '+role;
 material.normalScale.set(.72,.72);
 material.userData={
  sandforgeBarracksPropMaterial:true,
  sandforgeColorMapCamo:true
 };
 materialsByRole.set(role,material);
 return material;
}
