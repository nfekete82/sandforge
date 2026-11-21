import * as THREE from 'three';

/** Rotate original Meshy satellite-dish vertices IN PLACE on the GPU.
 * No fake duplicate radar, no texture atlas edits and no expensive geometry
 * rebuilds. The photo-to-3D Meshy HQ has no authored dish pivot nodes;
 * model-space height/top-left masks isolate the two highest roof assemblies.
 *
 * Slower than the old authored 0.18rad/s dishes: full revolution ~105s/140s.
 */
export const MESHY_HQ_RADAR_REVISION='sandforge-meshy-hq-slow-dishes-v1';
export const MESHY_HQ_RADAR_SPEEDS=Object.freeze([Math.PI*2/105,-Math.PI*2/140]);
const tmp=new THREE.Vector3();
const boundsScratch=new THREE.Box3();

function meshLocalBounds(root){
 root.updateWorldMatrix(true,true);
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert();
 const transform=new THREE.Matrix4(),bounds=new THREE.Box3().makeEmpty();
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.userData?.sandforgeStyleDecoration)return;
  mesh.geometry.computeBoundingBox();
  transform.multiplyMatrices(inverse,mesh.matrixWorld);
  bounds.union(boundsScratch.copy(mesh.geometry.boundingBox).applyMatrix4(transform));
 });
 return bounds;
}
function radarZones(bounds){
 const dim=bounds.getSize(new THREE.Vector3());
 if(bounds.isEmpty()||dim.x<.001||dim.y<.001||dim.z<.001)return [];
 // Two visible satellite assemblies, left tower and smaller central array.
 // All coordinates are GLB-root-local and survive calibrated actor scale.
 return [
  {center:new THREE.Vector3(bounds.min.x+dim.x*.185,0,
     bounds.min.z+dim.z*.42),
   cutoff:bounds.min.y+dim.y*.77,
   radius:Math.max(dim.x,dim.z)*.21},
  {center:new THREE.Vector3(bounds.min.x+dim.x*.475,0,
     bounds.min.z+dim.z*.48),
   cutoff:bounds.min.y+dim.y*.79,
   radius:Math.max(dim.x,dim.z)*.16}
 ];
}
function candidateIntersects(box,zone){
 return box.max.y>=zone.cutoff&&
   box.max.x>=zone.center.x-zone.radius&&
   box.min.x<=zone.center.x+zone.radius&&
   box.max.z>=zone.center.z-zone.radius&&
   box.min.z<=zone.center.z+zone.radius;
}

const uniformsGLSL=[
 'uniform mat4 sfHQToRoot;',
 'uniform mat4 sfHQFromRoot;',
 'uniform vec4 sfHQDishA;',
 'uniform vec4 sfHQDishB;',
 'uniform vec2 sfHQDishCutoff;',
 'uniform vec2 sfHQDishYaw;',
 'float sfHQDishSelect(vec3 p,vec4 z,float minY){',
 ' vec2 d=p.xz-z.xz;',
 ' return step(minY,p.y)*(1.0-step(z.w*z.w,dot(d,d)));',
 '}',
 'vec3 sfHQDishRotate(vec3 p,vec4 center,float a){',
 ' float c=cos(a),s=sin(a);',
 ' vec3 v=p-center.xyz;',
 ' return vec3(v.x*c+v.z*s,v.y,-v.x*s+v.z*c)+center.xyz;',
 '}',
 'vec3 sfHQDishRotateNormal(vec3 n,float a){',
 ' float c=cos(a),s=sin(a);',
 ' return vec3(n.x*c+n.z*s,n.y,-n.x*s+n.z*c);',
 '}'
].join('\n');

/** Material clones are instance-owned, not glTF cache owned.
 * Shader uniforms are updated only while gameplay is active.
 * The color/normal/roughness/metalness texture maps remain untouched. */
export function attachMeshyHeadquartersRadarMotion(model){
 if(!model||model.userData.sandforgeMeshyStructure!=='headquarters')return null;
 if(model.userData.meshyHQSatellites)return model.userData.meshyHQSatellites;
 const bounds=meshLocalBounds(model),zones=radarZones(bounds);
 if(zones.length!==2)return null;
 const rootInv=new THREE.Matrix4().copy(model.matrixWorld).invert();
 const state={kind:'headquarters',mode:'meshy-dishes-gpu',
  angles:[0,0],shaderUniforms:[],animatedMeshes:0,zones,
  model,revision:MESHY_HQ_RADAR_REVISION};
 model.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.userData?.sandforgeStyleDecoration)return;
  mesh.updateWorldMatrix(true,false);
  const toRoot=new THREE.Matrix4().multiplyMatrices(rootInv,mesh.matrixWorld);
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  const rootBox=mesh.geometry.boundingBox.clone().applyMatrix4(toRoot);
  if(!zones.some(zone=>candidateIntersects(rootBox,zone)))return;
  const fromRoot=new THREE.Matrix4().copy(toRoot).invert();
  const add=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   const mat=source.clone(),previous=source.onBeforeCompile;
   const prevKey=source.customProgramCacheKey.bind(source);
   mat.onBeforeCompile=(shader,renderer)=>{
    previous?.call(mat,shader,renderer);
    shader.uniforms.sfHQToRoot={value:toRoot};
    shader.uniforms.sfHQFromRoot={value:fromRoot};
    shader.uniforms.sfHQDishA={value:new THREE.Vector4(
     zones[0].center.x,0,zones[0].center.z,zones[0].radius)};
    shader.uniforms.sfHQDishB={value:new THREE.Vector4(
     zones[1].center.x,0,zones[1].center.z,zones[1].radius)};
    shader.uniforms.sfHQDishCutoff={value:new THREE.Vector2(
     zones[0].cutoff,zones[1].cutoff)};
    const yaw={value:new THREE.Vector2(state.angles[0],state.angles[1])};
    shader.uniforms.sfHQDishYaw=yaw;state.shaderUniforms.push(yaw);
    const inject='#include <common>';
    shader.vertexShader=shader.vertexShader.replace(inject,inject+'\n'+uniformsGLSL);
    const normal='#include <beginnormal_vertex>';
    shader.vertexShader=shader.vertexShader.replace(normal,normal+'\n'+[
     'vec3 sfHQNormRoot=(sfHQToRoot*vec4(position,1.0)).xyz;',
     'float sfHQNormA=sfHQDishSelect(sfHQNormRoot,sfHQDishA,sfHQDishCutoff.x);',
     'float sfHQNormB=(1.0-sfHQNormA)*sfHQDishSelect(sfHQNormRoot,sfHQDishB,sfHQDishCutoff.y);',
     'vec3 sfHQN=mat3(sfHQToRoot)*objectNormal;',
     'if(sfHQNormA>.5)sfHQN=sfHQDishRotateNormal(sfHQN,sfHQDishYaw.x);',
     'else if(sfHQNormB>.5)sfHQN=sfHQDishRotateNormal(sfHQN,sfHQDishYaw.y);',
     'if(sfHQNormA>.5||sfHQNormB>.5)objectNormal=normalize(mat3(sfHQFromRoot)*sfHQN);'
    ].join('\n'));
    const start='#include <begin_vertex>';
    shader.vertexShader=shader.vertexShader.replace(start,start+'\n'+[
     'vec3 sfHQRootPos=(sfHQToRoot*vec4(transformed,1.0)).xyz;',
     'float sfHQA=sfHQDishSelect(sfHQRootPos,sfHQDishA,sfHQDishCutoff.x);',
     'float sfHQB=(1.0-sfHQA)*sfHQDishSelect(sfHQRootPos,sfHQDishB,sfHQDishCutoff.y);',
     'if(sfHQA>.5)sfHQRootPos=sfHQDishRotate(sfHQRootPos,sfHQDishA,sfHQDishYaw.x);',
     'else if(sfHQB>.5)sfHQRootPos=sfHQDishRotate(sfHQRootPos,sfHQDishB,sfHQDishYaw.y);',
     'if(sfHQA>.5||sfHQB>.5)transformed=(sfHQFromRoot*vec4(sfHQRootPos,1.0)).xyz;'
    ].join('\n'));
   };
   mat.customProgramCacheKey=()=>prevKey()+'|'+MESHY_HQ_RADAR_REVISION;
   mat.userData={...source.userData,sandforgeMeshyTeamOwned:true,
    sandforgeMeshyHQDishMotion:true};
   mat.needsUpdate=true;return mat;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(add):add(mesh.material);
  state.animatedMeshes++;
 });
 if(!state.animatedMeshes)return null;
 model.userData.meshyHQSatellites=state;
 return state;
}
export function updateMeshyHeadquartersRadarMotion(state,dt){
 if(!state||state.mode!=='meshy-dishes-gpu'||!Number.isFinite(dt)||dt<=0)return;
 for(let i=0;i<state.angles.length;i++)
  state.angles[i]=(state.angles[i]+dt*MESHY_HQ_RADAR_SPEEDS[i])%(Math.PI*2);
 for(const uniform of state.shaderUniforms)
  uniform.value.set(state.angles[0],state.angles[1]);
}
