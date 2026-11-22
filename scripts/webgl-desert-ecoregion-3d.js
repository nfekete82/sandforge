import * as THREE from 'three';
import {planDesertEcoregion} from './webgl-desert-ecoregion-plan.js';
import {DESERT_MODEL_FILES,DESERT_MODEL_TARGET_HEIGHT} from './webgl-desert-ecoregions.js';
import {applyRockMineralVeins} from './webgl-rock-materials.js';

/** Loads independently authored, PBR-textured GLB sculptures.
 * No emergency cylinders, spheres, billboard shrubs or green tinted cones.
 * A missing or untextured asset is rejected, NOT silently replaced by junk.
 */
function prepareRealPbrModel(scene,kind){
 scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(scene);
 const dims=bounds.getSize(new THREE.Vector3());
 if(!Number.isFinite(dims.y)||dims.y<.01)
  throw new Error('Unusable '+kind+' GLB bounds');
 const height=DESERT_MODEL_TARGET_HEIGHT[kind],scale=height/dims.y,
  mid=bounds.getCenter(new THREE.Vector3()),geometries=[],
  materialSet=new Set(),textureSet=new Set();
 let totalTriangles=0;
 scene.traverse(node=>{
  if(!node.isMesh)return;
  if(node.isSkinnedMesh||node.morphTargetInfluences?.length)
   throw new Error(kind+': animated/skinned geometry is unsuitable for scenery instancing');
  const sourceMaterials=Array.isArray(node.material)?node.material:[node.material];
  if(!sourceMaterials.some(mat=>mat?.map?.isTexture))
   throw new Error(kind+': asset has no PBR albedo texture; refuse flat-color placeholder');
  const geometry=node.geometry?.clone();
  if(!geometry?.getAttribute('position')||!geometry.getAttribute('uv'))
   throw new Error(kind+': missing real mesh or UVs');
  geometry.applyMatrix4(node.matrixWorld);
  geometry.translate(-mid.x,-bounds.min.y,-mid.z);
  geometry.scale(scale,scale,scale);
  if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  for(const m of sourceMaterials){
   if(!m)return;
   materialSet.add(m);
   // Dark mineral marbling on the actual UV-mapped sandstone GLB only.
   // The botanical PBR materials remain entirely untouched.
   if(kind==='sandstone')applyRockMineralVeins(m,{strength:.54,frequency:1.75});
   // Thin organic Joshua leaves are physically double sided; do not
   // manufacture extra canopy shapes or change bark's material color.
   if(kind==='joshua')m.side=THREE.DoubleSide;
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','aoMap']){
    if(m[key]?.isTexture)textureSet.add(m[key]);
   }
  }
  const triangles=geometry.index?geometry.index.count/3:
   geometry.getAttribute('position').count/3;
  totalTriangles+=triangles;
  geometries.push({geometry,materials:sourceMaterials,name:node.name||kind});
 });
 if(!geometries.length)throw new Error(kind+': empty external model');
 return {geometries,materials:[...materialSet],textures:[...textureSet],
  triangles:totalTriangles,height};
}
export async function loadAuthenticDesertScenery({
 loader,scene,world,terrain=world?.generated,seed=world?.seed??0,
 mapId,heightAt,lowQuality=false,waterLayout=null
}){
 const placements=planDesertEcoregion({
  mapId,world,terrain,seed,lowQuality,waterLayout
 });
 const root=new THREE.Group();root.name='visual-authentic-desert-ecoregion';
 root.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,mapId};
 const meshes=[],prepared=[],failures=[];
 if(!placements.length)return {root,placements,meshes,failures,
  drawCalls:0,triangles:0,dispose:()=>{}};
 const dummy=new THREE.Object3D(),half=world.size*.5;
 for(const kind of ['sandstone','saguaro','joshua']){
  const points=placements.filter(p=>p.kind===kind);
  if(!points.length)continue;
  try{
   const model=await loader.loadAsync(DESERT_MODEL_FILES[kind]);
   const data=prepareRealPbrModel(model.scene,kind);
   prepared.push(data);
   for(const part of data.geometries){
    const instanced=new THREE.InstancedMesh(part.geometry,part.materials.length===1?
     part.materials[0]:part.materials,points.length);
    instanced.name='visual-desert-'+kind+'-'+part.name;
    instanced.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
     glbScenery:true,model:kind,modelAsset:DESERT_MODEL_FILES[kind]};
    instanced.raycast=()=>{};
    instanced.castShadow=!lowQuality;
    instanced.receiveShadow=true;
    for(const [i,p] of points.entries()){
     dummy.position.set(p.x-half,heightAt(p.x,p.y)-.7,p.y-half);
     dummy.rotation.set(p.lean,p.angle,0);
     dummy.scale.setScalar(p.scale);dummy.updateMatrix();
     instanced.setMatrixAt(i,dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate=true;
    instanced.computeBoundingSphere();
    root.add(instanced);meshes.push(instanced);
   }
  }catch(error){
   failures.push({kind,message:String(error?.message??error)});
   console.warn('Sandforge genuine 3D desert asset rejected:',kind,error);
  }
 }
 scene.add(root);
 const totalTriangles=meshes.reduce((n,m)=>n+m.count*
   (m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0);
 let disposed=false;
 return {
  root,placements,meshes,failures,drawCalls:meshes.length,
  triangles:totalTriangles,
  dispose(){
   if(disposed)return;disposed=true;root.removeFromParent();
   for(const part of prepared){
    for(const g of part.geometries)g.geometry.dispose();
    for(const m of part.materials)m.dispose();
    for(const tex of part.textures)tex.dispose();
   }
  }
 };
}
