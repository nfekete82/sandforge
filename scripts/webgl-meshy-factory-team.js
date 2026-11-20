import * as THREE from 'three';

/** Non-destructive faction recolour on the *original* Meshy base-color map:
 * blue metal accents stay untouched for player 0, cobalt blue pixels
 * become red industrial enamel for player 1. Grayscale walls, weathered
 * metal, white hazard marks, normal/ORM and UVs remain as generated.
 */
export const MESHY_FACTORY_TEAM_REVISION='sandforge-real-meshy-factory-team-v2-deep-red';
export function paintMeshyFactoryTeam(model,owner){
 if(!model?.getObjectByName('SF_Factory_Meshy_ProductionRig'))return 0;
 model.userData.sandforgeOriginalPBR=true;
 if(owner===0)return 0; // original genuine Meshy BLUE pixels, untouched
 const clones=new Map();let count=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const rewrite=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(source.userData?.sandforgeMeshyTeamPaintRevision===MESHY_FACTORY_TEAM_REVISION)
    return source;
   if(clones.has(source))return clones.get(source);
   const mat=source.clone();
   const previous=source.onBeforeCompile;
   const oldKey=source.customProgramCacheKey.bind(source);
   mat.onBeforeCompile=function(shader,renderer){
    previous?.call(this,shader,renderer);
    const needle='#include <map_fragment>';
    if(!shader.fragmentShader.includes(needle))return;
    shader.fragmentShader=shader.fragmentShader.replace(needle,needle+'\n'+[
     '// Meshy original Atlas PBR: keep actual normal and ORM untouched.',
     'float sfB=diffuseColor.b,sfG=diffuseColor.g,sfR=diffuseColor.r;',
     '// Strong discrimination: old mid-strength blue must become RED,',
     '// not the magenta mixture seen with a partial colour replacement.',
     'float sfBlue=smoothstep(.008,.033,sfB-max(sfR,sfG))*',
     ' smoothstep(-.025,.030,sfG-sfR);',
     'vec3 sfRed=vec3(max(.24,sfB*1.72),sfB*.115,sfB*.070);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfRed,clamp(sfBlue,0.,1.));'
    ].join('\n'));
   };
   mat.customProgramCacheKey=()=>oldKey()+'|'+MESHY_FACTORY_TEAM_REVISION+'|red';
   mat.userData={...source.userData,sandforgeMeshyTeamPaintRevision:MESHY_FACTORY_TEAM_REVISION,
    sandforgeMeshyFactionOwned:true};
   mat.needsUpdate=true;clones.set(source,mat);count++;return mat;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(rewrite):rewrite(mesh.material);
 });
 return count;
}

/** Can be invoked repeatedly on a loaded model and after ownership changes.
 * No geometry/UV/texture allocation and no extra draw calls for team colour.
 */
export function meshyFactoryPortal(model){
 const door=model?.getObjectByName('FactoryRollupDoor');
 const start=model?.getObjectByName('SF_Factory_Meshy_RolloutStart');
 const exit=model?.getObjectByName('SF_Factory_Meshy_RolloutExit');
 if(!door?.isMesh||!start||!exit)return null;
 return {door,start,exit};
}
