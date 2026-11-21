import * as THREE from 'three';
import {FACTION_PAINT} from './sandforge-faction-palette.js';

/** A coloured paint band directly on BOTH bomber wings, never a decal
 * plane or floating faction flag. Keep the source albedo, normal, ORM,
 * cockpit glass and original geometry completely unchanged.
 *
 * Only meshes touching the outer wing span receive a private material
 * clone. The painted pixels are selected in actual GLB-root coordinates,
 * so separate wing meshes / nested model transforms work identically.
 */
export const BOMBER_WING_STRIPES_REVISION='bomber-pbr-flush-wingbands-v1-20261121';
const exclude=/cockpit|canopy|glass|window|rotor|propeller|engine|exhaust|gear|wheel|tire|tyre|weapon|gun|antenna|flag|emblem|shadow|landing|light|lamp|sensor|thruster/i;
const finite=n=>Number.isFinite(n);
const f=n=>Number(n).toFixed(7);

function localBounds(model){
 model.updateWorldMatrix(true,true);
 const inverse=model.matrixWorld.clone().invert();
 const b=new THREE.Box3().makeEmpty();
 model.traverse(node=>{
  if(!node.isMesh||!node.geometry||node.userData?.teamMarking)return;
  if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
  if(node.geometry.boundingBox)
   b.union(node.geometry.boundingBox.clone().applyMatrix4(
    inverse.clone().multiply(node.matrixWorld)));
 });
 return b;
}

export function bomberWingStripeSpec(box){
 if(!box||box.isEmpty())return null;
 const size=box.getSize(new THREE.Vector3());
 if(!(size.x>0&&size.z>0&&size.y>0))return null;
 return Object.freeze({
  centerX:(box.min.x+box.max.x)*.5,
  centerZ:(box.min.z+box.max.z)*.5,
  halfSpan:size.x*.5,
  halfLength:size.z*.5,
  // One short transverse bar on each outer wing, not over the fuselage.
  inside:.52,outside:.64,
  chordStart:-.50,chordEnd:.50,
  topNormal:.52
 });
}

/** Returns count of wing surface meshes; never adds objects or colliders. */
export function paintBomberWingStripes(model,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 const bounds=localBounds(model),spec=bomberWingStripeSpec(bounds);
 if(!spec)return 0;
 const color=new THREE.Color(FACTION_PAINT[owner]);
 const inverse=model.matrixWorld.clone().invert();
 const rootToLocal=new THREE.Matrix4();
 let count=0;
 const painted=new Set();
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.isSkinnedMesh||
     mesh.userData?.teamMarking||exclude.test(mesh.name))return;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  if(!mesh.geometry.boundingBox)return;
  rootToLocal.multiplyMatrices(inverse,mesh.matrixWorld);
  const meshBounds=mesh.geometry.boundingBox.clone().applyMatrix4(rootToLocal);
  const overLeft=meshBounds.min.x<spec.centerX-spec.halfSpan*spec.inside &&
    meshBounds.max.x>spec.centerX-spec.halfSpan*spec.outside;
  const overRight=meshBounds.max.x>spec.centerX+spec.halfSpan*spec.inside &&
    meshBounds.min.x<spec.centerX+spec.halfSpan*spec.outside;
  if(!(overLeft||overRight))return;
  const meshToRoot=rootToLocal.clone();
  const upgrade=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   if(source.userData?.sandforgeBomberStripeRevision===BOMBER_WING_STRIPES_REVISION&&
      source.userData?.sandforgeBomberStripeOwner===owner)return source;
   // Isolate this bomber's paint: no shared glTF template or other plane
   // receives this material change.
   const material=source.clone();
   material.userData={...source.userData,
    sandforgeBomberWingOwned:true,
    sandforgeBomberStripeRevision:BOMBER_WING_STRIPES_REVISION,
    sandforgeBomberStripeOwner:owner};
   const previous=source.onBeforeCompile;
   const oldKey=source.customProgramCacheKey.bind(source);
   material.onBeforeCompile=function(shader,renderer){
    previous?.call(this,shader,renderer);
    const vertexDecl='uniform mat4 sfBomberMeshToRoot; varying vec3 sfBomberLocal; varying vec3 sfBomberNormal;';
    const fragDecl='varying vec3 sfBomberLocal; varying vec3 sfBomberNormal;';
    shader.uniforms.sfBomberMeshToRoot={value:meshToRoot.clone()};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\n'+vertexDecl);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfBomberLocal=(sfBomberMeshToRoot*vec4(position,1.0)).xyz;'
     +'\nsfBomberNormal=normalize(mat3(sfBomberMeshToRoot)*normal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\n'+fragDecl);
    const c=color;
    // Top-facing GLB triangles only. Two isolated bands over physical wings.
    // No extra draw calls, no billboard planes and no floating team badges.
    const body=[
     '#include <color_fragment>',
     'float sfWingSide=abs(sfBomberLocal.x-'+f(spec.centerX)+')/'+f(spec.halfSpan)+';',
     'float sfWingBand=smoothstep('+f(spec.inside-.018)+','+f(spec.inside)+',sfWingSide)'
       +'*(1.0-smoothstep('+f(spec.outside)+','+f(spec.outside+.018)+',sfWingSide));',
     'float sfWingChord=(sfBomberLocal.z-'+f(spec.centerZ)+')/'+f(spec.halfLength)+';',
     'float sfWingLength=smoothstep('+f(spec.chordStart-.08)+','+f(spec.chordStart)+',sfWingChord)'
       +'*(1.0-smoothstep('+f(spec.chordEnd)+','+f(spec.chordEnd+.08)+',sfWingChord));',
     'float sfWingTop=smoothstep('+f(spec.topNormal-.15)+','+f(spec.topNormal)+',sfBomberNormal.y);',
     'float sfWingInk=clamp(sfWingBand*sfWingLength*sfWingTop,0.0,1.0);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+
       [c.r,c.g,c.b].map(f).join(',')+'),sfWingInk*.94);'
    ].join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',body);
   };
   material.customProgramCacheKey=()=>oldKey()+'|'+BOMBER_WING_STRIPES_REVISION+
    '|'+owner+'|'+mesh.uuid;
   material.needsUpdate=true;
   painted.add(mesh.uuid);return material;
  };
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(upgrade):upgrade(mesh.material);
  rootToLocal.identity();
 });
 count=painted.size;
 model.userData.sandforgeBomberWingPaintedMeshes=count;
 model.userData.sandforgeBomberWingPaintRevision=BOMBER_WING_STRIPES_REVISION;
 return count;
}
