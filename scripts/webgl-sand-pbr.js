import * as THREE from 'three';
import {installDesertSurfaceDetail,DESERT_SURFACE_DETAIL} from './webgl-sand-surface-detail.js';

/** Original authored, seamless golden wind-ripple sand image.
 * The source albedo is generated from Sandforge's new reference artwork.
 * Normal/roughness textures are baked ONCE in the browser, from this same
 * exact tile. Consequently all three maps have identical UVs and seams.
 *
 * Gamebuilding GLBs never touch these maps; only the modern desert terrain
 * gets PBR. Runtime terrain fallback remains playable if the asset fails.
 */
export const SANDFORGE_SAND_PBR={
 revision:'multiscale-natural-pbr-v4-20261116',
 surfaceDetailRevision:DESERT_SURFACE_DETAIL.revision,
 albedo:'/src/assets/reborn/terrain/sand-wind-albedo-v1.webp',
 sourceSize:512,
 generatedMapsSize:1024,
 normalStrength:.83,
 roughnessRange:[.89,.985],
};
export const SAND_PBR_TERRAIN_REPEAT=1;

/** Periodic/tiling derivatives: no bright spot decal, screen-space overlay,
 * atlas from building GLBs, fake surface height or per-frame shader cost.
 */
export function createSandNormalAndRoughness(image,renderer,{size=1024}={}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Sandforge sand PBR requires 2D Canvas');
 ctx.drawImage(image,0,0,size,size);
 const source=ctx.getImageData(0,0,size,size).data;
 const lum=new Float32Array(size*size);
 for(let i=0;i<lum.length;i++){
  const o=i*4;
  lum[i]=(source[o]*.23+source[o+1]*.69+source[o+2]*.08)/255;
 }
 const normal=ctx.createImageData(size,size);
 const rough=ctx.createImageData(size,size);
 const t=2*Math.PI;
 const pick=(x,y)=>lum[((y+size)%size)*size+((x+size)%size)];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const o=(y*size+x)*4;
  // Follow small photographic surface features and superimpose a restrained
  // wind ripple at the EXACT same period as the seamless painted albedo.
  // 42-period waves keep the phase continuous at either edge of the tile.
  const phase=t*(42*x/size+7*y/size)+.22*Math.sin(t*3*y/size);
  const ridge=Math.cos(phase);
  const dX=(pick(x+2,y)-pick(x-2,y))*.58+ridge*.055;
  const dY=(pick(x,y+2)-pick(x,y-2))*.58+ridge*.008;
  let nx=-dX*SANDFORGE_SAND_PBR.normalStrength;
  let ny=-dY*SANDFORGE_SAND_PBR.normalStrength;
  const inv=1/Math.hypot(nx,ny,1);
  nx*=inv;ny*=inv;
  normal.data[o]=Math.round((nx*.5+.5)*255);
  normal.data[o+1]=Math.round((ny*.5+.5)*255);
  normal.data[o+2]=Math.round((inv*.5+.5)*255);
  normal.data[o+3]=255;

  // Dry grain is almost fully matte, its local roughness changes slightly
  // with compacted areas. Never introduce glossy water/white spot decals.
  const v=Math.max(SANDFORGE_SAND_PBR.roughnessRange[0],
   Math.min(SANDFORGE_SAND_PBR.roughnessRange[1],.944+(lum[y*size+x]-.70)*.066));
  const r=Math.round(v*255);
  rough.data[o]=r;rough.data[o+1]=r;rough.data[o+2]=r;rough.data[o+3]=255;
 }
 const make=(pixels,colorSpace)=>{
  const c=document.createElement('canvas');c.width=c.height=size;
  c.getContext('2d').putImageData(pixels,0,0);
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=colorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  tex.generateMipmaps=true;
  return tex;
 };
 return {
  normal:make(normal,THREE.NoColorSpace),
  roughness:make(rough,THREE.NoColorSpace),
 };
}
export async function installDesertSandPBR(material,renderer,{url=SANDFORGE_SAND_PBR.albedo}={}){
 const albedo=await new Promise(resolve=>{
  new THREE.TextureLoader().load(url,resolve,undefined,()=>resolve(null));
 });
 if(!albedo)return false; // Leave the existing procedural sand fallback.
 let maps;
 try{
  maps=createSandNormalAndRoughness(albedo.image,renderer);
 }catch(error){
  albedo.dispose();
  console.warn('Sandforge desert PBR maps unavailable; using fallback:',error);
  return false;
 }
 albedo.colorSpace=THREE.SRGBColorSpace;
 albedo.wrapS=albedo.wrapT=THREE.RepeatWrapping;
 albedo.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
 albedo.generateMipmaps=true;
 albedo.needsUpdate=true;
 const oldMap=material.map,oldNormal=material.normalMap,oldRough=material.roughnessMap;
 material.map=albedo;
 material.color.set('#ffffff'); // Real albedo owns the pigment, no double tint.
 material.normalMap=maps.normal;
 material.normalScale.set(.82,.82);
 material.roughnessMap=maps.roughness;
 material.roughness=1;
 material.metalness=0;
 // Blend two additional tiled surface maps *inside* the existing physical
 // material; do not layer decals or additional ground geometry.
 installDesertSurfaceDetail(material,renderer);
 material.needsUpdate=true;
 material.userData={...material.userData,
  sandforgeSandPBR:SANDFORGE_SAND_PBR.revision,
  sandforgeSandPBRUrl:url};
 if(oldMap&&oldMap!==albedo)oldMap.dispose();
 if(oldNormal&&oldNormal!==maps.normal)oldNormal.dispose();
 if(oldRough&&oldRough!==maps.roughness)oldRough.dispose();
 return true;
}
