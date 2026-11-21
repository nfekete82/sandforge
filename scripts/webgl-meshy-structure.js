import * as THREE from 'three';
import {MESHY_STRUCTURE_ASSETS} from './webgl-meshy-asset-flags.js';

// Vehicle factory is the visual reference for every Sandforge structure:
// original PBR albedo/normal/ORM, dusty khaki armour, dark steel, restrained
// blue/red enamel. Do not flatten a Meshy texture atlas into plain-color boxes.
export const MESHY_STRUCTURE_REVISION='sandforge-meshy-matched-hq-factory-albedo-v3-20261121';
export const SANDFORGE_INDUSTRIAL_PALETTE=Object.freeze({
 sand:'#c3ae8a',armour:'#a08d6d',steel:'#444a45',concrete:'#aaa08b',
 blue:'#1b508d',red:'#a7332e'
});
export function meshyStructurePath(kind){
 return MESHY_STRUCTURE_ASSETS[kind]
  ?'/src/assets/reborn/buildings-3d/meshy-structures/'+kind+'.glb':null;
}

// Bounds in GLB-local metres, independent of placed building, team rotation,
// calibrated Three scale, camera and collision. Excludes cosmetics/markers.
export function meshyLocalBounds(root){
 const result=new THREE.Box3().makeEmpty(),inverse=new THREE.Matrix4();
 const transform=new THREE.Matrix4();
 root.updateWorldMatrix(true,true);inverse.copy(root.matrixWorld).invert();
 root.traverse(node=>{
  if(!node.isMesh||!node.geometry||node.userData?.sandforgeStyleDecoration)return;
  if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
  transform.multiplyMatrices(inverse,node.matrixWorld);
  const part=node.geometry.boundingBox.clone().applyMatrix4(transform);
  if(Number.isFinite(part.min.x))result.union(part);
 });
 return result;
}
function addInfantryExitMarkers(model,bounds){
 if(model.getObjectByName('SF_Meshy_InfantryRolloutStart'))return;
 const size=bounds.getSize(new THREE.Vector3());
 const center=bounds.getCenter(new THREE.Vector3());
 const y=bounds.min.y+size.y*.075,front=bounds.max.z;
 for(const [name,z] of [
  ['SF_Meshy_InfantryRolloutStart',front+size.z*.05],
  ['SF_Meshy_InfantryRolloutExit',front+size.z*.30]
 ]){
  const anchor=new THREE.Group();anchor.name=name;
  anchor.position.set(center.x,y,z);
  anchor.userData={visualOnly:true,nonBlocking:true,sandforgeExitMarker:true};
  model.add(anchor);
 }
}
/**
 * One industrial colour grade for all 6 Meshy structures. Only modifies
 * atlas sample values in the physically lit PBR shader; original images,
 * UVs, normal maps, roughness, metalness and geometry are untouched.
 * Each instance owns its Material clone (no cross-faction cache mutation).
 */
export function prepareMeshyStructure(model,kind,owner=0){
 if(!model)return false;
 if(model.userData.sandforgeMeshyStyleRevision===MESHY_STRUCTURE_REVISION&&
    model.userData.sandforgeMeshyStyleOwner===owner)return true;
 model.userData={...model.userData,sandforgeOriginalPBR:true,
  sandforgeMeshyStructure:kind,meshRevision:MESHY_STRUCTURE_REVISION,
  sandforgeMeshyStyleRevision:MESHY_STRUCTURE_REVISION,
  sandforgeMeshyStyleOwner:owner};
 const originalBounds=meshyLocalBounds(model);
 if(['barracks','headquarters'].includes(kind)&&!originalBounds.isEmpty())
  addInfantryExitMarkers(model,originalBounds);
 const recolored=new Map(),meshes=[];
 model.traverse(node=>{
  if(!node.isMesh||node.userData?.sandforgeStyleDecoration)return;
  node.receiveShadow=true;meshes.push(node);
  const paint=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(recolored.has(source))return recolored.get(source);
   const mat=source.clone(),previous=source.onBeforeCompile;
   const oldKey=source.customProgramCacheKey.bind(source);
   mat.onBeforeCompile=function(shader,renderer){
    previous?.call(this,shader,renderer);
    // Grade AFTER authored camouflage/facade layers, never before: the
    // factory may still run its legacy color_fragment wall shader. Working
    // at roughnessmap_fragment sees the FINAL painted albedo on both models.
    const marker='#include <roughnessmap_fragment>';
    if(!shader.fragmentShader.includes(marker))return;
    const industrial=[
     '// Unified Sandforge industrial grade: retain original PBR atlas detail.',
     'float sfMax=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);',
     'float sfMin=min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);',
     'float sfLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));',
     'float sfNeutral=1.0-smoothstep(.085,.31,sfMax-sfMin);',
     // Sand/olive painted panels only. Shadowed grilles, black portals and
     // cobalt team trim are excluded by the tan chroma mask.
     'float sfTan=max(0.0,diffuseColor.r-diffuseColor.b);',
     'float sfSandPanel=smoothstep(.025,.13,sfTan)*smoothstep(.08,.25,sfLum);',
     'sfSandPanel*=1.0-smoothstep(.78,.98,sfLum);',
     // A single target tone for both facilities, but keep all baked scratches,
     // dirt, noise and edge wear: this remains a multiplier, not an overlay.
     'vec3 sfPanelTone=vec3(1.035,1.005,.965);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*sfPanelTone,sfSandPanel*.58);',
     // The photographed HQ atlas is visibly darker than the genuine Meshy
     // vehicle factory. Correct that source-specific exposure only on the
     // tan facade, not radar dishes/doors/blue piping/transparent glazing.
     kind==='headquarters'?
      'diffuseColor.rgb+=vec3(.075,.068,.053)*sfSandPanel;':
      kind==='factory'?
       'diffuseColor.rgb+=vec3(.010,.011,.010)*sfSandPanel;':
       'diffuseColor.rgb+=vec3(.018,.017,.014)*sfSandPanel;',
     'diffuseColor.rgb=clamp(diffuseColor.rgb,vec3(0.0),vec3(1.0));'
    ];
    if(owner===1)industrial.push(
     'float sfBlue=clamp((diffuseColor.b-max(diffuseColor.r,diffuseColor.g))*5.2,0.0,1.0);',
     'vec3 sfTeamRed=vec3(max(.20,diffuseColor.b*1.45),diffuseColor.b*.11,diffuseColor.b*.08);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfTeamRed,sfBlue);'
    );
    else if(owner!==0)industrial.push(
     '// Neutral Bastions must not show blue team lights before capture.',
     'float sfBlue=clamp((diffuseColor.b-max(diffuseColor.r,diffuseColor.g))*5.2,0.0,1.0);',
     'vec3 sfNeutralMetal=vec3(.39,.41,.37)*max(.28,sfLum);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfNeutralMetal,sfBlue);'
    );
    shader.fragmentShader=shader.fragmentShader.replace(marker,
      marker+'\n'+industrial.join('\n'));
    // Dusted military surfaces read consistently under the same desert sun,
    // while roughness maps and physical metal reflections remain effective.
    const rough='#include <roughnessmap_fragment>';
    if(shader.fragmentShader.includes(rough))
     shader.fragmentShader=shader.fragmentShader.replace(rough,rough+
      '\nroughnessFactor=clamp(roughnessFactor+.025,0.0,1.0);');
    if(kind==='generator'){
     const glow='#include <emissivemap_fragment>';
     const highlight=owner===1?
      'diffuseColor.r-max(diffuseColor.b,diffuseColor.g)':
      'diffuseColor.b-max(diffuseColor.r,diffuseColor.g)';
     if(shader.fragmentShader.includes(glow))
      shader.fragmentShader=shader.fragmentShader.replace(glow,glow+'\n'+
       'float sfCoreGlow=clamp(('+highlight+')*4.8,0.0,1.0);\n'+
       'totalEmissiveRadiance+=diffuseColor.rgb*sfCoreGlow*.58;');
    }
   };
   mat.customProgramCacheKey=()=>oldKey()+'|'+MESHY_STRUCTURE_REVISION+
    '|'+kind+'|'+owner;
   mat.userData={...source.userData,sandforgeMeshyTeamOwned:true,
    sandforgeMeshyStyleRevision:MESHY_STRUCTURE_REVISION};
   mat.needsUpdate=true;
   recolored.set(source,mat);return mat;
  };
  node.material=Array.isArray(node.material)?node.material.map(paint):paint(node.material);
 });
 // A Meshy GLB can have hundreds of tiny rivet/detail meshes. Keep all real
 // PBR detail in the colour pass, but reserve shadow-map passes for the
 // largest structural shapes. This is particularly important for 5 bunkers.
 const maxShadow={bastion:9,bunker:10,generator:10,airfield:14,
  barracks:15,headquarters:18}[kind]??14;
 const largest=meshes.map(mesh=>{
  if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
  const size=mesh.geometry.boundingSphere?.radius??0;
  return {mesh,size:size*Math.max(mesh.scale.x,mesh.scale.y,mesh.scale.z)};
 }).sort((a,b)=>b.size-a.size).slice(0,maxShadow);
 const casters=new Set(largest.map(x=>x.mesh));
 for(const mesh of meshes)mesh.castShadow=casters.has(mesh);
 return true;
}
