import * as THREE from 'three';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** Smoke thins out within the existing bounded sprite footprint and lifetime. */
export function particleFade(life,ttl,dissipates){
 if(!(ttl>0)||!(life>0))return 0;
 const remaining=Math.max(0,Math.min(1,life/ttl));
 return smooth(remaining/(dissipates?.65:.35))*
  (dissipates?smooth((ttl-life)/Math.min(.09,ttl*.15)):1);
}
/** One float per existing pooled instance. No new materials, passes or draws. */
export function installParticleFade(geometry,material,max){
 const opacity=new THREE.InstancedBufferAttribute(new Float32Array(max),1);
 opacity.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('sfParticleFade',opacity);
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nattribute float sfParticleFade; varying float sfFade;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nsfFade=sfParticleFade;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
   '#include <common>\nvarying float sfFade;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',
   '#include <alphamap_fragment>\ndiffuseColor.a*=sfFade;');
 };
 material.customProgramCacheKey=()=>'sandforge-pooled-particle-fade-v1';
 material.needsUpdate=true;
 return opacity;
}
