import * as THREE from 'three';
import {desertEcoregion} from './webgl-desert-ecoregions.js';
import {installDesertSandPBR} from './webgl-sand-pbr.js';
export const DESERT_REGIONAL_PBR_REVISION='four-authentic-desert-cc0-materials-v1';
/** An actual 1K CC0 albedo/normal/roughness set for each ground type.
 * All 16 terrain chunks share the SAME MeshStandardMaterial; no new draw calls
 * and no color-only replacement. Authentic geometric height, roads, A*,
 * black map void and Fog of War are unchanged.
 */
export async function installDesertRegionalPBR(material,renderer,mapId){
 const region=desertEcoregion(mapId);
 if(!region?.ground){
  return installDesertSandPBR(material,renderer);
 }
 const loader=new THREE.TextureLoader();
 const urls=[region.ground.base,region.ground.normal,region.ground.rough];
 const results=await Promise.all(urls.map(url=>new Promise(resolve=>
  loader.load(url,t=>resolve(t),undefined,()=>resolve(null)))));
 if(results.some(x=>!x)){
  results.filter(Boolean).forEach(t=>t.dispose());
  console.warn('Sandforge region '+mapId+' missing authentic PBR textures; retaining original photographed sand.');
  return installDesertSandPBR(material,renderer);
 }
 const [base,normal,rough]=results;
 for(const tex of results){
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps=true;
  tex.needsUpdate=true;
 }
 base.colorSpace=THREE.SRGBColorSpace;
 normal.colorSpace=rough.colorSpace=THREE.NoColorSpace;
 const old=[material.map,material.normalMap,material.roughnessMap];
 material.map=base;
 material.normalMap=normal;
 material.normalScale.set(.70,.70);
 material.roughnessMap=rough;
 material.roughness=1;
 material.metalness=0;
 material.color.set('#ffffff');
 material.needsUpdate=true;
 material.userData={...material.userData,
  sandforgeEcoregion:region.key,
  sandforgeGroundPBR:DESERT_REGIONAL_PBR_REVISION,
  sandforgeGroundUrl:region.ground.base};
 for(const tex of old)if(tex&&!results.includes(tex))tex.dispose();
 return true;
}
