import * as THREE from 'three';
import {MESHY_STRUCTURE_ASSETS} from './webgl-meshy-asset-flags.js';
const hqDoorStates=new WeakMap();

// Vehicle factory is the visual reference for every Sandforge structure:
// original PBR albedo/normal/ORM, dusty khaki armour, dark steel, restrained
// blue/red enamel. Do not flatten a Meshy texture atlas into plain-color boxes.
export const MESHY_STRUCTURE_REVISION='sandforge-hq-door-badge-glsl-radar-safe-v6';
export const SANDFORGE_INDUSTRIAL_PALETTE=Object.freeze({
 sand:'#c3ae8a',armour:'#a08d6d',steel:'#444a45',concrete:'#aaa08b',
 blue:'#1b508d',red:'#a7332e'
});
export function meshyStructurePath(kind){
 if(kind==='airfield'&&MESHY_STRUCTURE_ASSETS.airfieldReference)
  return '/src/assets/reborn/buildings-3d/meshy-structures/airfield-reference-20261121.glb';
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
// Image-authored HQ front double door: original +Z facade, to the right
// of the radar tower and to the left of the annex. These ratios describe
// the existing Meshy door location, not a new geometric garage prop.
export const MESHY_HQ_ENGINEER_DOOR=Object.freeze({
 // Photographed ORIGINAL double-door, between the radar mast and the annex.
 // The previously used x=.60 was too far toward the right-side hangar.
 xFraction:.47,
 facadeZFraction:.77,
 insideOffsetFraction:.045,
 outsideOffsetFraction:.085
});
// Raycast ONCE when the HQ GLB loads. This finds the actual wall surface at
// the illustrated door; the annex and fence make the overall +Z bounding
// box a poor approximation of the entrance.
function findHeadquartersDoorFacadeZ(model,bounds,x,y){
 const size=bounds.getSize(new THREE.Vector3());
 const estimated=bounds.min.z+size.z*MESHY_HQ_ENGINEER_DOOR.facadeZFraction;
 try{
  model.updateWorldMatrix(true,true);
  const origin=model.localToWorld(new THREE.Vector3(
   x,y,bounds.max.z+size.z*.20));
  const forward=new THREE.Vector3(0,0,-1).transformDirection(model.matrixWorld);
  const ray=new THREE.Raycaster(origin,forward,0,size.z*1.5);
  const inv=new THREE.Matrix4().copy(model.matrixWorld).invert();
  const hits=ray.intersectObject(model,true)
   .filter(hit=>hit.object?.isMesh&&!hit.object.userData?.sandforgeStyleDecoration)
   .map(hit=>hit.point.clone().applyMatrix4(inv).z)
   .filter(z=>z>bounds.min.z+size.z*.58&&z<bounds.min.z+size.z*.95);
  hits.sort((a,b)=>Math.abs(a-estimated)-Math.abs(b-estimated));
  if(hits.length)return hits[0];
 }catch(error){
  console.warn('Meshy HQ facade probe: using surveyed doorway fallback',error);
 }
 return estimated;
}
function addInfantryExitMarkers(model,bounds){
 if(model.getObjectByName('SF_Meshy_InfantryRolloutStart'))return;
 const size=bounds.getSize(new THREE.Vector3());
 const center=bounds.getCenter(new THREE.Vector3());
 const headquarters=model.userData.sandforgeMeshyStructure==='headquarters';
 const y=bounds.min.y+size.y*.075;
 const doorX=headquarters?
  bounds.min.x+size.x*MESHY_HQ_ENGINEER_DOOR.xFraction:center.x;
 const doorwayZ=headquarters?
  findHeadquartersDoorFacadeZ(model,bounds,doorX,bounds.min.y+size.y*.18):
  bounds.max.z;
 // Start hidden within the actual existing doorway and walk straight out.
 // The previous markers were BOTH in front of the HQ's bounding box;
 // that made engineers spawn beside the artificial freestanding shutter.
 const startZ=headquarters?
  doorwayZ-size.z*MESHY_HQ_ENGINEER_DOOR.insideOffsetFraction:
  doorwayZ+size.z*.05;
 const exitZ=headquarters?
  doorwayZ+size.z*MESHY_HQ_ENGINEER_DOOR.outsideOffsetFraction:
  doorwayZ+size.z*.30;
 if(headquarters)model.userData.sandforgeRealHQDoorway={x:doorX,z:doorwayZ};
 for(const [name,z] of [
  ['SF_Meshy_InfantryRolloutStart',startZ],
  ['SF_Meshy_InfantryRolloutExit',exitZ]
 ]){
  const anchor=new THREE.Group();anchor.name=name;
  anchor.position.set(doorX,y,z);
  anchor.userData={visualOnly:true,nonBlocking:true,sandforgeExitMarker:true,
   realHeadquartersDoor:headquarters};
  model.add(anchor);
 }
}
/**
 * One industrial colour grade for all 6 Meshy structures. Only modifies
 * atlas sample values in the physically lit PBR shader; original images,
 * UVs, normal maps, roughness, metalness and geometry are untouched.
 * Each instance owns its Material clone (no cross-faction cache mutation).
 */
/** The original Meshy atlas contains both REAL patterned door leaves and
 * the surrounding wall in the same mesh. Do not create a detached shutter.
 * Open that precise door region in the fragment shader, from the centre to
 * the hinges, preserving its original weathered door texture while closed.
 * A very thin dark inset sits BEHIND the original doorway, not in front. */
function prepareEmbeddedHeadquartersDoor(model,bounds){
 const existing=hqDoorStates.get(model);
 if(existing)return existing;
 const surveyed=model.userData.sandforgeRealHQDoorway;
 if(!surveyed||bounds.isEmpty())return null;
 const dim=bounds.getSize(new THREE.Vector3());
 const bottom=bounds.min.y+dim.y*.027;
 const height=dim.y*.235;
 const halfWidth=dim.x*.073;
 const depth=Math.max(dim.z*.015,.0005);
 const inset=new THREE.Mesh(
  new THREE.PlaneGeometry(halfWidth*1.94,height*.96),
  new THREE.MeshStandardMaterial({
   color:'#11191a',roughness:.96,metalness:.15,
   side:THREE.DoubleSide,depthWrite:true
  })
 );
 inset.name='SF_Meshy_HQ_OriginalDoor_Interior';
 inset.position.set(surveyed.x,bottom+height*.52,surveyed.z-depth);
 inset.userData={sandforgeStyleDecoration:true,visualOnly:true,
  nonBlocking:true,realMeshyDoorInset:true};
 inset.castShadow=false;inset.receiveShadow=false;inset.raycast=()=>{};
 model.add(inset);
 const door={
  kind:'headquarters',mode:'original-meshy-double-door',
  open:0,uniforms:[],inset,centerX:surveyed.x,z:surveyed.z,
  bottom,height,halfWidth,depth
 };
 hqDoorStates.set(model,door);
 return door;
}
export function meshHeadquartersDoor(model){
 return model?hqDoorStates.get(model)??null:null;
}
export function setMeshyHeadquartersDoorOpen(door,amount){
 if(!door)return;
 door.open=Math.max(0,Math.min(1,Number(amount)||0));
 for(const uniform of door.uniforms)uniform.value=door.open;
}
export function disposeMeshyHeadquartersDoor(model){
 const door=meshHeadquartersDoor(model);
 if(!door)return;
 setMeshyHeadquartersDoorOpen(door,0);
 door.inset.removeFromParent();
 door.inset.geometry?.dispose();
 door.inset.material?.dispose();
 door.uniforms.length=0;
 hqDoorStates.delete(model);
}
/** Original photographed HQ carried a painted WHITE star on the right annex.
 * Its Meshy atlas is shared across body and canopy; remove only white
 * near the right hand annex using UV-preserving PBR shader filtering. */
// Meshy occasionally exports the emblem as its own raised mesh. Remove
// explicit badge geometry in addition to painting over baked atlas pixels.
// Do not change any wall, door, antenna, flag or hangar structure.
export function removeHeadquartersEmblemMeshes(model){
 let removed=0;
 const emblem=/^(?:.*[_ -])?(?:star[_ -]?emblem|faction[_ -]?crest|shield[_ -]?badge|white[_ -]?star|insignia|emblem)(?:[_ -].*)?$/i;
 const nodes=[];
 model.traverse(node=>{
  if(node!==model&&node.isMesh&&emblem.test(node.name))nodes.push(node);
 });
 for(const node of nodes){node.removeFromParent();removed++;}
 model.userData.sandforgeRemovedHQBadgeMeshes=removed;
 return removed;
}
/** Hide the entire baked crest on the RIGHT annex (not just bright star
 * pixels). Each Meshy mesh has its own local coordinate space; apply the
 * mesh-to-HQ transform BEFORE comparing it to the common building bounds.
 * The old filter compared local vertex positions with whole-HQ bounds,
 * so it simply missed most of the photographed emblem. */
function removeHeadquartersAnnexStar(shader,bounds,meshToHQ,door){
 const dim=bounds.getSize(new THREE.Vector3()),min=bounds.min;
 const f=n=>Number(n).toFixed(6);
 const decl='varying vec3 sfHQMatRootPos; varying vec3 sfHQMatRootNormal;';
 const doorUniform={value:door?.open??0};
 shader.uniforms.sfHQDoorOpen=doorUniform;
 if(door)door.uniforms.push(doorUniform);
 const marker='#include <common>';
 shader.uniforms.sfHQMeshToRoot={value:meshToHQ.clone()};
 shader.vertexShader=shader.vertexShader.replace(marker,marker+'\n'+
  'uniform mat4 sfHQMeshToRoot;\n'+decl);
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
  '#include <begin_vertex>\n'+
  'sfHQMatRootPos=(sfHQMeshToRoot*vec4(position,1.0)).xyz;\n'+
  'sfHQMatRootNormal=normalize(mat3(sfHQMeshToRoot)*normal);');
 shader.fragmentShader=shader.fragmentShader.replace(marker,marker+'\n'+decl+'\nuniform float sfHQDoorOpen;');
 return [
  '// Paint out the complete right-hangar emblem: shield AND star.',
  'vec3 sfHQNormalized=(sfHQMatRootPos-vec3('+[min.x,min.y,min.z].map(f).join(',')+'))',
  ' / vec3('+[dim.x,dim.y,dim.z].map(v=>f(Math.max(.0001,v))).join(',')+');',
  // The annex is on the +X right and faces front +Z. Smooth borders blend
  // the replacement into the existing dirty gunmetal, not a flat badge.
  'float sfBadgeX=smoothstep(.54,.61,sfHQNormalized.x)*(1.0-smoothstep(.96,.995,sfHQNormalized.x));',
  // The GLB bounds include the TALL left radar tower, so the right hangar
  // emblem sits low in the total height; the former .13-.80 band missed it.
  'float sfBadgeY=smoothstep(.010,.045,sfHQNormalized.y)*(1.0-smoothstep(.48,.57,sfHQNormalized.y));',
  'float sfBadgeZ=smoothstep(.24,.39,sfHQNormalized.z);',
  'float sfBadgeFacing=.78+.22*abs(sfHQMatRootNormal.z);',
  'float sfBadgeMask=clamp(sfBadgeX*sfBadgeY*sfBadgeZ*sfBadgeFacing*3.0,0.0,1.0);',
  // Preserve weathering and subtle metal variation, not the high-contrast
  // atlas logo. Material normal/roughness/metallic textures remain unchanged.
  'float sfSteelWeather=.92+.05*fract(sin(dot(sfHQMatRootPos.xz,vec2(12.9898,78.233)))*43758.5453);',
  'vec3 sfUnmarkedMetal=vec3(.175,.189,.183)*sfSteelWeather;',
  'diffuseColor.rgb=mix(diffuseColor.rgb,sfUnmarkedMetal,sfBadgeMask);',
  // Cut only the real double door's front-facing triangles. While closed
  // the ORIGINAL atlas is visible. Opening slides the two visible leaves
  // outward from their centre; the dark interior is already inset behind it.
  'float sfDoorX=abs(sfHQMatRootPos.x-'+f(door?.centerX??0)+');',
  'float sfDoorY=sfHQMatRootPos.y-'+f(door?.bottom??0)+';',
  'float sfDoorZ=abs(sfHQMatRootPos.z-'+f(door?.z??0)+');',
  'float sfDoorAllowed=step(sfDoorX,'+f(door?.halfWidth??0)+')',
  ' *step(0.0,sfDoorY)*step(sfDoorY,'+f(door?.height??0)+')',
  ' *step(sfDoorZ,'+f(Math.max(door?.depth??0,.0001)*5)+')',
  ' *step(.20,abs(sfHQMatRootNormal.z));',
  'if(sfHQDoorOpen>.001 && sfDoorAllowed>.5 &&',
  'sfDoorX<'+f(door?.halfWidth??0)+'*sfHQDoorOpen*.99)discard;'
 ];
}
export function prepareMeshyStructure(model,kind,owner=0){
 if(!model)return false;
 if(model.userData.sandforgeMeshyStyleRevision===MESHY_STRUCTURE_REVISION&&
    model.userData.sandforgeMeshyStyleOwner===owner)return true;
 model.userData={...model.userData,sandforgeOriginalPBR:true,
  sandforgeMeshyStructure:kind,meshRevision:MESHY_STRUCTURE_REVISION,
  sandforgeMeshyStyleRevision:MESHY_STRUCTURE_REVISION,
  sandforgeMeshyStyleOwner:owner};
 if(kind==='headquarters')removeHeadquartersEmblemMeshes(model);
 const originalBounds=meshyLocalBounds(model);
 if(['barracks','headquarters'].includes(kind)&&!originalBounds.isEmpty())
  addInfantryExitMarkers(model,originalBounds);
 if(kind==='headquarters'&&!originalBounds.isEmpty())
  prepareEmbeddedHeadquartersDoor(model,originalBounds);
 const recolored=new Map(),meshes=[];
 model.updateWorldMatrix(true,true);
 const modelInverse=model.matrixWorld.clone().invert();
 model.traverse(node=>{
  if(!node.isMesh||node.userData?.sandforgeStyleDecoration)return;
  node.receiveShadow=true;meshes.push(node);
  // Meshy uses shared atlas materials across multiple submeshes, but the
  // HQ emblem shader requires a different mesh-to-root matrix per mesh.
  const localCache=kind==='headquarters'?new Map():recolored;
  const meshToHQ=new THREE.Matrix4().multiplyMatrices(modelInverse,node.matrixWorld);
  const paint=source=>{
   if(!source?.isMeshStandardMaterial||!source.map)return source;
   if(localCache.has(source))return localCache.get(source);
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
    if(kind==='headquarters')industrial.push(...removeHeadquartersAnnexStar(shader,originalBounds,meshToHQ,meshHeadquartersDoor(model)));
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
   localCache.set(source,mat);return mat;
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
