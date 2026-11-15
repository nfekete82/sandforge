/**
 * Sandforge's approved Meshy low-poly rifleman. Keep imported UV/PBR maps:
 * the generic soldier camo pass intentionally overwrites foreign textures.
 * This model does not yet contain authored skeletal animation clips.
 */
export const SAND_FORGE_LOWPOLY_SOLDIER='/src/assets/meshy/infantry-animated.glb';
export const LOWPOLY_SOLDIER_REVISION='lowpoly-rigged-rifleman-20261115';

export function prepareLowpolySoldier(model,owner){
 if(!model)return false;
 model.userData={...model.userData,sandforgeLowpolySoldier:true,
  sandforgePreserveAuthoredMaterials:true,sandforgeLowpolyRevision:LOWPOLY_SOLDIER_REVISION};
 // The reference image has a blue armband. The red faction recolours only
 // saturated blue texels: camouflage, skin, armour and weapon remain intact.
 if(owner!==1)return true;
 const variants=new Map();
 model.traverse(node=>{
  if(!node.isMesh)return;
  const recolor=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   if(variants.has(source))return variants.get(source);
   const material=source.clone();
   const oldCompile=material.onBeforeCompile;
   const oldKey=material.customProgramCacheKey.bind(material);
   material.onBeforeCompile=function(shader,renderer){
    oldCompile?.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float sfBlueBand = smoothstep(.13,.31,diffuseColor.b-diffuseColor.r)
 * smoothstep(.065,.19,diffuseColor.b-diffuseColor.g)
 * smoothstep(.13,.29,diffuseColor.b);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.57,.065,.045),sfBlueBand*.95);`);
   };
   material.customProgramCacheKey=()=>oldKey()+':'+LOWPOLY_SOLDIER_REVISION+'-red';
   material.userData={...material.userData,sandforgeLowpolySoldierRed:true};
   material.needsUpdate=true;
   variants.set(source,material);
   return material;
  };
  node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
 });
 return true;
}
