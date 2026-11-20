import * as THREE from 'three';
import {DESERT_ECOREGIONS} from './webgl-desert-ecoregions.js';

/** Four genuine seamless surface looks on the SAME existing terrain mesh.
 * Source albedos: the original Sandforge wind-sand photo and the three
 * committed CC0 Sonoran/Mojave/Badlands PBR ground materials.
 * The original map's albedo, normal and roughness remain authoritative.
 * Per-zone roughness and coarse slope steer the secondary PBR looks.
 * All landscape masks are baked once, never generated per fragment/frame.
 */
export const DESERT_GROUND_BLEND_REVISION='authentic-ground-blending-v1';
const SAND='/src/assets/reborn/terrain/sand-wind-albedo-v1.webp';
const source={
 sand:SAND,
 sonoran:DESERT_ECOREGIONS['broken-empire'].ground.base,
 mojave:DESERT_ECOREGIONS['burning-horizon'].ground.base,
 badlands:DESERT_ECOREGIONS['last-stronghold'].ground.base
};
export const DESERT_GROUND_PROFILES=Object.freeze({
 'desert-strike':Object.freeze({
  layers:['sonoran','mojave','badlands'],base:'sand',
  zone:[.46,.25,.32],tiles:[440,310,540],seed:0x483c19,
  title:'Golden dunes / hardpan / gravel / dried sediment'
 }),
 'broken-empire':Object.freeze({
  layers:['badlands','mojave','sand'],base:'sonoran',
  zone:[.84,.60,.29],tiles:[395,285,600],seed:0x5da172,
  title:'Sonoran red sand / compacted badlands / gravel / dune dust'
 }),
 'burning-horizon':Object.freeze({
  layers:['badlands','sonoran','sand'],base:'mojave',
  zone:[.43,.79,.32],tiles:[480,350,610],seed:0x362a5c,
  title:'Mojave pale gravel / red hardpan / scattered stone / wind sand'
 }),
 'last-stronghold':Object.freeze({
  layers:['sonoran','mojave','sand'],base:'badlands',
  zone:[.74,.67,.52],tiles:[360,260,510],seed:0x174abd,
  title:'Eroded badlands / dark clay / cobbles / dry wash'
 })
});
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const smooth=t=>{const x=clamp(t);return x*x*(3-2*x);};
function hash2(x,y,seed){
 let s=(Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^seed)|0;
 s=Math.imul(s^(s>>>13),1274126177);
 return ((s^(s>>>16))>>>0)/4294967296;
}
function noise(u,v,frequency,seed){
 const x=u*frequency,y=v*frequency,ix=Math.floor(x),iy=Math.floor(y);
 const dx=smooth(x-ix),dy=smooth(y-iy);
 const a=hash2(ix,iy,seed),b=hash2(ix+1,iy,seed);
 const c=hash2(ix,iy+1,seed),d=hash2(ix+1,iy+1,seed);
 return (a+(b-a)*dx)*(1-dy)+(c+(d-c)*dx)*dy;
}
/** Pure function: a deterministic world-wide macro blend mask.
 * Each channel covers organic sediment patches without a square grid,
 * single repeating circle, bright decal, cliff geometry or extra mesh.
 * Returns RGB coverage: hardpan, gravel and sediment; sand is the base.
 */
export function bakeDesertGroundMasks(mapId,{seed=0,resolution=384}={}){
 const profile=DESERT_GROUND_PROFILES[mapId];
 if(!profile)return null;
 if(!Number.isInteger(resolution)||resolution<32||resolution>1024)
  throw Error('Invalid Sandforge blend resolution');
 const pixels=new Uint8Array(resolution*resolution*4);
 const salt=(seed^profile.seed)>>>0;
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const u=x/(resolution-1),v=y/(resolution-1);
  const warpX=(noise(u,v,6,salt^0x1737bd)-.5)*.052;
  const warpY=(noise(u,v,7,salt^0x4b8321)-.5)*.052;
  const a=u+warpX,b=v+warpY;
  const regional=noise(a,b,8,salt^0xa2c4f1);
  const gravel=noise(a+.17,b-.11,12,salt^0x87d12b);
  const fine=noise(a-.15,b+.21,28,salt^0x42d980);
  const shelf=noise(a+.31,b+.27,5,salt^0x12f7ab);
  const sediment=noise(a-.21,b-.17,9,salt^0x73d52e);
  // Four different features, not a single grayscale texture recolored.
  const hard=smooth((regional*.70+shelf*.30-.28)/.43);
  const grit=smooth((gravel*.66+fine*.34-.30)/.42);
  const wash=smooth((sediment*.73+(1-regional)*.27-.29)/.43);
  const i=(y*resolution+x)*4;
  pixels[i]=Math.round(clamp(hard)*255);
  pixels[i+1]=Math.round(clamp(grit)*255);
  pixels[i+2]=Math.round(clamp(wash)*255);
  pixels[i+3]=255;
 }
 return {pixels,resolution,mapId,seed};
}
export function createDesertGroundMaskTexture(renderer,mapId,options={}){
 const baked=bakeDesertGroundMasks(mapId,options);
 if(!baked)return null;
 const tex=new THREE.DataTexture(baked.pixels,baked.resolution,baked.resolution,THREE.RGBAFormat);
 tex.name='SandforgeNaturalGroundZones-'+mapId;
 tex.colorSpace=THREE.NoColorSpace;
 tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 tex.needsUpdate=true;
 return tex;
}
function texture(url){
 return new Promise(resolve=>{
  new THREE.TextureLoader().load(url,resolve,undefined,()=>resolve(null));
 });
}
/** Called AFTER the original asynchronous PBR installation completes.
 * It wraps existing onBeforeCompile hooks (oasis shading / wind-surface
 * detail), preserving existing PBR normals, terrain vertex colors and FoW.
 * Returns a disposal handle or null on missing extra art assets.
 */
export async function installAuthenticDesertGroundBlending(material,renderer,{
 mapId,seed=0,mapSize=6200,lowQuality=false
}={}){
 const profile=DESERT_GROUND_PROFILES[mapId];
 if(!profile||material.userData.sandforgeGroundBlending)return null;
 if(!Number.isFinite(mapSize)||mapSize<100)throw Error('Invalid map size');
 const urls=profile.layers.map(layer=>source[layer]);
 const extras=await Promise.all(urls.map(texture));
 if(extras.some(t=>!t)){
  extras.filter(Boolean).forEach(t=>t.dispose());
  console.warn('Sandforge ground blending disabled: missing committed CC0 texture for '+mapId);
  return null;
 }
 const mask=createDesertGroundMaskTexture(renderer,mapId,{
  seed,resolution:lowQuality?192:384
 });
 for(const t of extras){
  t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.generateMipmaps=true;
  t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  t.needsUpdate=true;
 }
 const prev=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
 const scales=profile.tiles,weights=profile.zone;
 material.onBeforeCompile=function(shader,webglRenderer){
  prev.call(this,shader,webglRenderer);
  shader.uniforms.sfNaturalZones={value:mask};
  shader.uniforms.sfGroundHardpan={value:extras[0]};
  shader.uniforms.sfGroundGravel={value:extras[1]};
  shader.uniforms.sfGroundSediment={value:extras[2]};
  const nl=String.fromCharCode(10);
  const varying='varying vec2 vSFGroundWorld; varying float vSFGroundSlope;';
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>'+nl+varying)
   .replace('#include <begin_vertex>','#include <begin_vertex>'+nl+
    'vSFGroundWorld=position.xz; vSFGroundSlope=1.0-clamp(normal.y,0.0,1.0);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
    '#include <common>'+nl+varying+nl+
    'uniform sampler2D sfNaturalZones;'+nl+
    'uniform sampler2D sfGroundHardpan;'+nl+
    'uniform sampler2D sfGroundGravel;'+nl+
    'uniform sampler2D sfGroundSediment;');
  const code=[
    '// One map-wide, non-repeating mask shared across all 16 terrain chunks.',
    'vec2 sfUV=clamp(vSFGroundWorld/'+mapSize.toFixed(1)+'+vec2(.5),vec2(.001),vec2(.999));',
    'vec3 sfZones=texture2D(sfNaturalZones,sfUV).rgb;',
    'float sfSlope=smoothstep(.014,.28,vSFGroundSlope);',
    'float sfHard=sfZones.r*'+weights[0].toFixed(3)+';',
    'float sfGravel=sfZones.g*'+weights[1].toFixed(3)+'*(.65+sfSlope*1.15);',
    'float sfSilt=sfZones.b*'+weights[2].toFixed(3)+'*(1.0-.35*sfSlope);',
    'float sfSand=.84;',
    'float sfSum=sfSand+sfHard+sfGravel+sfSilt;',
    '// Angled UV tiling prevents synchronized repetitions in adjacent biomes.',
    'vec2 sfHardUV=vec2(vSFGroundWorld.x*.866-vSFGroundWorld.y*.5,',
    '                        vSFGroundWorld.x*.5+vSFGroundWorld.y*.866)/'+scales[0].toFixed(1)+';',
    'vec2 sfGravelUV=vec2(vSFGroundWorld.x*.96+vSFGroundWorld.y*.28,',
    '                          -vSFGroundWorld.x*.28+vSFGroundWorld.y*.96)/'+scales[1].toFixed(1)+';',
    'vec2 sfSiltUV=vSFGroundWorld/'+scales[2].toFixed(1)+';',
    'vec3 sfHardColor=texture2D(sfGroundHardpan,sfHardUV).rgb;',
    'vec3 sfGravelColor=texture2D(sfGroundGravel,sfGravelUV).rgb;',
    'vec3 sfSedimentColor=texture2D(sfGroundSediment,sfSiltUV).rgb;',
    'diffuseColor.rgb=(diffuseColor.rgb*sfSand+sfHardColor*sfHard+',
    '   sfGravelColor*sfGravel+sfSedimentColor*sfSilt)/sfSum;'
  ].join(nl);
  shader.fragmentShader=shader.fragmentShader.replace(
    '#include <map_fragment>','#include <map_fragment>'+nl+code);
  shader.fragmentShader=shader.fragmentShader.replace(
    '#include <roughnessmap_fragment>',
    '#include <roughnessmap_fragment>'+nl+
    '// Hardpan compacts, gravel stays rough, silt settles naturally.'+nl+
    'roughnessFactor=clamp(roughnessFactor*(1.0-.055*sfHard/sfSum'+
    '+.035*sfGravel/sfSum-.018*sfSilt/sfSum),.78,1.0);');
 };
 material.customProgramCacheKey=()=>previousKey()+'-'+DESERT_GROUND_BLEND_REVISION+'-'+mapId;
 material.userData.sandforgeGroundBlending={
  revision:DESERT_GROUND_BLEND_REVISION,mapId,channels:4,mask,
  layers:[profile.base,...profile.layers],textures:extras,profile:profile.title
 };
 material.needsUpdate=true;
 let disposed=false;
 return {mapId,mask,textures:extras,materials:[material],revision:DESERT_GROUND_BLEND_REVISION,
  dispose(){
   if(disposed)return;disposed=true;
   for(const t of extras)t.dispose();mask.dispose();
   // Do not dispose the original ground material or its original PBR maps.
  }
 };
}
