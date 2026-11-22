import * as THREE from 'three';
import {desertStrikeNaturalCliffMaps} from './webgl-rock-materials.js';

/**
 * Desert Strike: weathered sandstone lives INSIDE the authoritative ground
 * material. No second surface = no z-fighting, bright triangles, decal edge,
 * camera-dependent transparency sorting, or floating/overhanging polygons.
 * The existing real terrain (height, pathing, ramps, collision and saves)
 * remains completely untouched.
 */
export const DESERT_CLIFF_GROUND_REVISION='desert-strike-integrated-cliff-pbr-v1';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
const radiusFactor=(a,m)=>{
 const phase=m.seed*.00047+m.siteIndex*1.7;
 return 1+.045*Math.sin(a*5+phase)+.025*Math.cos(a*9-phase*.8);
};
export function cliffRampCoverage(p,m){
 const dx=p.x-m.center.x,dy=p.y-m.center.y;
 let coverage=0;
 for(const d of m.ramps?.length?m.ramps:[m.direction]){
  const along=dx*d.x+dy*d.y;
  const lateral=Math.abs(dx*d.y-dy*d.x);
  if(along<m.topRadius-80||along>m.rampEnd+80)continue;
  coverage=Math.max(coverage,1-smooth(
   (lateral-m.rampWidth*.56)/(m.rampWidth*.36)));
 }
 return coverage;
}

/** World-aligned coverage baked once. More precision than 224 terrain cells
 * and zero plateau/ramp computations per shader fragment or simulation tick.
 * R/G/B: stone coverage, discontinuous dark fissure, sunlit stone variation.
 */
export function bakeMesaCliffGroundMask({
 size,plateaus=[],resolution=512
}={}){
 if(!Number.isFinite(size)||size<=0)throw Error('Invalid cliff mask map size');
 if(!Number.isInteger(resolution)||resolution<32||resolution>1024)
  throw Error('Invalid cliff mask resolution');
 const pixels=new Uint8Array(resolution*resolution*4);
 const usable=plateaus.filter(m=>m?.center&&Number.isFinite(m.topRadius)&&
  Number.isFinite(m.footRadius)&&m.footRadius>m.topRadius);
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
  const px=(x+.5)*size/resolution,py=(y+.5)*size/resolution;
  const p={x:px,y:py};
  let stone=0,vein=0,grain=0;
  for(const m of usable){
   const dx=px-m.center.x,dy=py-m.center.y;
   const distance=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
   const radius=distance/radiusFactor(a,m);
   const t=(radius-m.topRadius)/(m.footRadius-m.topRadius);
   if(t<-.16||t>1.18)continue;
   const upper=smooth((t+.105)/.28);
   const lower=1-smooth((t-.72)/.43);
   const coverage=cliffRampCoverage(p,m);
   const openRamp=1-smooth((coverage-.10)/.46);
   const weight=clamp(upper*lower*openRamp);
   if(weight<=0)continue;
   // Coherent vertical erosion lines with irregular branching. They change
   // pigment only, NOT the physical mesa or the driveable slope.
   const weather=.5+.5*Math.sin(px*.018+py*.011+
    Math.sin(py*.032+px*.009)*1.6);
   const crack=Math.pow(.5+.5*Math.cos(a*37+
    .41*Math.sin(t*8+a*7)+m.seed*.0017),13);
   if(weight>stone){
    stone=weight;
    vein=clamp(.70*crack+.25*(1-weather));
    grain=clamp(.35+.48*weather+.16*Math.sin(a*13+t*21));
   }
  }
  const n=(y*resolution+x)*4;
  pixels[n]=Math.round(stone*255);
  pixels[n+1]=Math.round(vein*255);
  pixels[n+2]=Math.round(grain*255);
  pixels[n+3]=255;
 }
 return Object.freeze({pixels,resolution,size,revision:DESERT_CLIFF_GROUND_REVISION});
}

export function installMesaCliffGroundPBR(material,{
 size,plateaus,lowQuality=false
}={}){
 if(!material?.isMeshStandardMaterial)throw Error('Cliff paint requires MeshStandardMaterial');
 if(material.userData?.sandforgeIntegratedCliffs)return material.userData.sandforgeIntegratedCliffs;
 const baked=bakeMesaCliffGroundMask({size,plateaus,
  resolution:lowQuality?256:512});
 const mask=new THREE.DataTexture(baked.pixels,baked.resolution,baked.resolution,
  THREE.RGBAFormat);
 mask.name='Sandforge-Integrated-Desert-Strike-Cliff-Mask';
 mask.colorSpace=THREE.NoColorSpace;mask.wrapS=mask.wrapT=THREE.ClampToEdgeWrapping;
 mask.magFilter=THREE.LinearFilter;
 mask.minFilter=THREE.LinearMipmapLinearFilter;mask.generateMipmaps=true;
 mask.anisotropy=4;mask.needsUpdate=true;
 const rock=desertStrikeNaturalCliffMaps(lowQuality);
 const previous=material.onBeforeCompile;
 const previousKey=material.customProgramCacheKey.bind(material);
 const shaderKey=DESERT_CLIFF_GROUND_REVISION;
 material.onBeforeCompile=function(shader,renderer){
  previous.call(this,shader,renderer);
  shader.uniforms.sfCliffZone={value:mask};
  shader.uniforms.sfCliffStone={value:rock.map};
  shader.uniforms.sfCliffNormal={value:rock.normalMap};
  const nl=String.fromCharCode(10);
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>'+nl+
    'varying vec3 vSfMesaWorld;')
   .replace('#include <begin_vertex>','#include <begin_vertex>'+nl+
    'vSfMesaWorld=position;');
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <common>','#include <common>'+nl+
   'varying vec3 vSfMesaWorld;'+nl+
   'uniform sampler2D sfCliffZone;'+nl+
   'uniform sampler2D sfCliffStone;'+nl+
   'uniform sampler2D sfCliffNormal;');
  // This must run AFTER all previous ground PBR and additional sediment
  // layers. Use the unchanged real ground mesh for both sand and rock.
  const shade=[
   'vec2 sfMesaUV=clamp(vSfMesaWorld.xz/'+size.toFixed(1)+
     '+vec2(.5),vec2(.001),vec2(.999));',
   'vec3 sfMesaMask=texture2D(sfCliffZone,sfMesaUV).rgb;',
   'float sfMesaStone=smoothstep(.025,.92,sfMesaMask.r);',
   'vec2 sfMesaStoneUV=vec2(vSfMesaWorld.x*.73+vSfMesaWorld.z*.68,',
   'vSfMesaWorld.z*.73-vSfMesaWorld.x*.68)/126.0;',
   'vec3 sfMesaAlbedo=texture2D(sfCliffStone,sfMesaStoneUV).rgb;',
   // Pale tan rock shares the sand's warm daylight but not its bright orange.
   'sfMesaAlbedo*=vec3(.82,.78,.70)*mix(.70,1.07,sfMesaMask.b);',
   'sfMesaAlbedo*=1.0-.34*sfMesaMask.g;',
   'diffuseColor.rgb=mix(diffuseColor.rgb,sfMesaAlbedo,sfMesaStone*.87);'
  ].join(nl);
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <color_fragment>','#include <color_fragment>'+nl+shade);
  // Add real sandstone microfracture normal relief in VIEW SPACE, not
  // a fake raised overlay. No effect where alpha mask is empty.
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <normal_fragment_maps>','#include <normal_fragment_maps>'+nl+
   'vec3 sfMesaN=texture2D(sfCliffNormal,sfMesaStoneUV).rgb*2.0-1.0;'+nl+
   'vec3 sfMesaViewN=mat3(viewMatrix)*vec3(sfMesaN.x,0.0,sfMesaN.y);'+nl+
   'normal=normalize(normal+sfMesaViewN*sfMesaStone*.35);');
  shader.fragmentShader=shader.fragmentShader.replace(
   '#include <roughnessmap_fragment>',
   '#include <roughnessmap_fragment>'+nl+
   'roughnessFactor=mix(roughnessFactor,.96,sfMesaStone*.62);');
 };
 material.customProgramCacheKey=()=>previousKey()+'-'+shaderKey;
 const details={mask,rock,revision:shaderKey,drawCallsAdded:0,
  integratedIntoGround:true,
  dispose(){mask.dispose();}};
 material.userData.sandforgeIntegratedCliffs=details;
 material.needsUpdate=true;
 return details;
}
