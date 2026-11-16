/** Subtle ambient occlusion on vertical 3D building facades.
 * The old 0.22 emissive GLB fill made large side walls look flat despite
 * real sunlight and existing soft foundation contact shadows. Modulate the
 * physically lit reflected light by surface orientation instead: roof
 * planes retain full brightness, side walls receive a small diffuse shadow.
 *
 * Runs once on each completed model; no new meshes, textures, render passes,
 * raycast targets, collision changes or per-frame work.
 */
export const BUILDING_FACADE_SHADING_REVISION='subtle-building-facades-v1-20261115';
const skip=/glass|window|glazing|beacon|lamp|lightbulb|signal|emissive|glow|radar|display|screen|exhaust|flame|transparent|energy|laser/i;
export function finishBuildingFacadeShading(root){
 if(!root)return 0;
 const adjusted=new Map();let count=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.sandforgeBarracksPropPolish)return;
  const update=source=>{
   if(!source?.isMeshStandardMaterial||source.transparent||source.opacity<.99)return source;
   if(skip.test((mesh.name||'')+' '+(source.name||'')))return source;
   if(source.userData?.sandforgeBuildingFacadeShade===BUILDING_FACADE_SHADING_REVISION)return source;
   if(adjusted.has(source))return adjusted.get(source);
   // Already per-instance after faction tint / brightening / barracks finish.
   // Keep the cached GLB's shared PBR albedo, ORM and normal textures intact.
   const owned=source.userData?.sandforgeFactionTint||
    source.userData?.sandforgeBuildingFill||
    source.userData?.sandforgeBarracksPalette;
   const material=owned?source:source.clone();
   if(!owned)material.userData={...material.userData,sandforgeBuildingFacadeOwned:true};
   material.userData={...material.userData,
    sandforgeBuildingFacadeShade:BUILDING_FACADE_SHADING_REVISION};
   const priorCompile=material.onBeforeCompile;
   const priorProgramKey=material.customProgramCacheKey.bind(material);
   material.onBeforeCompile=function(shader,renderer){
    priorCompile?.call(this,shader,renderer);
    const varying='varying float sfFacadeExposure;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\n'+varying);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
     '#include <beginnormal_vertex>\nsfFacadeExposure=1.0-abs(normalize(objectNormal).y);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\n'+varying);
    // Applied AFTER the existing PBR/albedo/normal/camouflage evaluation.
    // Modulate direct and indirect light modestly; never overwrite a texture
    // or flatten the roughness/normal maps. Horizontal roofs stay untouched.
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
     '#include <aomap_fragment>\n'+
     'float sfWall=smoothstep(.18,.84,clamp(sfFacadeExposure,0.0,1.0));\n'+
     'reflectedLight.indirectDiffuse*=1.0-.17*sfWall;\n'+
     'reflectedLight.directDiffuse*=1.0-.055*sfWall;');
   };
   material.customProgramCacheKey=()=>priorProgramKey()+'|'+BUILDING_FACADE_SHADING_REVISION;
   material.needsUpdate=true;
   adjusted.set(source,material);count++;
   return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(update):update(mesh.material);
 });
 return count;
}
