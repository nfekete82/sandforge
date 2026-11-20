import {MESHY_STRUCTURE_ASSETS} from '/webgl-meshy-asset-flags.js';

export const MESHY_STRUCTURE_REVISION='sandforge-meshy-pbr-structures-20261121';
export function meshyStructurePath(kind){
 return MESHY_STRUCTURE_ASSETS[kind]
  ?'/src/assets/reborn/buildings-3d/meshy-structures/'+kind+'.glb':null;
}
/** Preserve source Meshy color/normal/ORM. Red team gets a color-only shader,
 * with no texture replacement, so blue and red share a single binary. */
export function prepareMeshyStructure(model,kind,owner=0){
 if(!model)return false;
 model.userData={...model.userData,sandforgeOriginalPBR:true,
  sandforgeMeshyStructure:kind,meshRevision:MESHY_STRUCTURE_REVISION};
 const recolored=new Map();
 model.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=true;node.receiveShadow=true;
  if(owner!==1)return;
  const paint=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(recolored.has(source))return recolored.get(source);
   const mat=source.clone(),previous=source.onBeforeCompile;
   const oldKey=source.customProgramCacheKey.bind(source);
   mat.onBeforeCompile=function(shader,renderer){
    previous?.call(this,shader,renderer);
    const marker='#include <map_fragment>';
    if(!shader.fragmentShader.includes(marker))return;
    shader.fragmentShader=shader.fragmentShader.replace(marker,marker+'\n'+[
     'float sfBlue=clamp((diffuseColor.b-max(diffuseColor.r,diffuseColor.g)) * 5.0,0.0,1.0);',
     'vec3 sfTeamRed=vec3(max(0.20,diffuseColor.b*1.40),diffuseColor.b*0.11,diffuseColor.b*0.08);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfTeamRed,sfBlue);'
    ].join('\n'));
   };
   mat.customProgramCacheKey=()=>oldKey()+'|sf-meshy-structure-'+kind+'-red';
   mat.userData={...mat.userData,sandforgeMeshyTeamOwned:true};
   mat.needsUpdate=true;recolored.set(source,mat);return mat;
  };
  node.material=Array.isArray(node.material)?node.material.map(paint):paint(node.material);
 });
 return true;
}
