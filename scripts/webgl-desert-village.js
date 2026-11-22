import * as THREE from 'three';
import {renderGroundHeightSampler} from './webgl-environment.js';
import {DESERT_SCENIC_STYLE as desertStyle} from './webgl-desert-style.js';
import {planOasisVillages,OASIS_HAMLET_REVISION} from './webgl-oasis-village-layout.js';

/** Scenic hamlets made entirely from the EXISTING authored canyon ruin GLTFs.
 * Never build houses from boxes and never use dark road plates. Both ruin GLTFs
 * are shared with the established terrain.ruins pipeline and receive its real
 * weathered plaster/stone textures. Decorative, seeded, and never collidable.
 */
export const DESERT_VILLAGE_ART_REVISION='authored-ruins-bastion-clearance-v3-20261116';
// Every house and its worn tracks must remain outside the Bastion capture zone.
// Clearance is checked for each actual house, not only the hamlet's center.
export const BASTION_VILLAGE_CLEARANCE=1150;
export const DESERT_VILLAGE_MODELS=Object.freeze([
 '/src/assets/reborn/canyon-3d/ruin-house.gltf',
 '/src/assets/reborn/canyon-3d/ruin-depot.gltf'
]);
export const OASIS_VILLAGE_MODELS=Object.freeze([
 '/src/assets/reborn/oasis-village/oasis-main-house.glb',
 '/src/assets/reborn/oasis-village/oasis-flat-house.glb',
 '/src/assets/reborn/oasis-village/oasis-courtyard-house.glb',
 '/src/assets/reborn/oasis-village/oasis-small-hut.glb',
 '/src/assets/reborn/oasis-village/oasis-ruined-house.glb',
 '/src/assets/reborn/oasis-village/oasis-market-house.glb'
]);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rng=seed=>{
 let s=(seed^0x73c9a515)>>>0;
 return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
};
const at=(v,x,z)=>{
 const c=Math.cos(v.angle),s=Math.sin(v.angle);
 return {x:v.x+x*c+z*s,y:v.y-x*s+z*c};
};
const allowed=(world,p)=>{
 const i=world.index(p);
 return i>=0&&!world.blocked[i]&&(!world.walkable||world.walkable(p));
};

/** Spread just three authored ruins across a believable, sparse hamlet.
 * Keep native base/territory clearance and preserve the authoritative map.
 */
export function planDesertVillages({world,terrain,seed=world?.seed??0,lowQuality=false,oases=[]}){
 if(!world?.size||!world?.index||!terrain?.sites)return [];
 // V3 villages follow the actual oasis layout. V1/V2 hamlets and saves stay unchanged.
 if(world.generatorVersion===3&&oases.length)
  return planOasisVillages({world,terrain,seed,lowQuality,oases});
 const random=rng(seed),target=lowQuality?1:2,chosen=[];
 const fixed=[...terrain.sites,...(terrain.ruins??[])];
 const margin=360,plots=[
  [-195,-160],[170,-112],[-80,205]
 ];
 for(let attempt=0;attempt<600&&chosen.length<target;attempt++){
  const x=margin+random()*(world.size-margin*2);
  const y=margin+random()*(world.size-margin*2);
  const angle=Math.floor(random()*4)*Math.PI/2+(random()-.5)*.45;
  const center={x,y,angle};
  if(!allowed(world,center)||
   terrain.sites.some(site=>distance(site,center)<BASTION_VILLAGE_CLEARANCE+320)||
   fixed.some(point=>distance(point,center)<330)||
   chosen.some(point=>distance(point,center)<650))continue;
  const count=lowQuality?2:3;
  const houses=[];
  for(let i=0;i<count;i++){
   const [dx,dz]=plots[i],point=at(center,dx+(random()-.5)*42,dz+(random()-.5)*42);
   if(!allowed(world,point)||
    terrain.sites.some(site=>distance(site,point)<BASTION_VILLAGE_CLEARANCE)||
    fixed.some(f=>distance(f,point)<200)||
    houses.some(h=>distance(h,point)<225)||
    (world.terrainSlope?.(point.x,point.y)??0)>.19)break;
   // Modern v10 battlefields use three different weathered adobe GLBs,
   // including a genuinely broken house, instead of repeating a tiny
   // two-model canyon hut. The position and collision rules stay unchanged.
   const modernAdobe=world.generatorVersion>=10;
   const adobeVariants=[0,2,4],adobeKinds=['main_house','courtyard_house','ruin_house'];
   houses.push({
    x:point.x,y:point.y,
    angle:angle+(random()-.5)*.48,
    width:76+random()*20,
    depth:modernAdobe?65+random()*18:undefined,
    height:39+random()*9,
    variant:modernAdobe?adobeVariants[i]:i===2?1:0,
    ...(modernAdobe?{kind:adobeKinds[i]}:{}),
    damage:modernAdobe?i===2:random()>.42,
    tint:modernAdobe?.91+random()*.10:Math.floor(random()*3)
   });
  }
  if(houses.length!==count)continue;
  // A settlement's tire tracks also stay away from Bastion grounds, not just
  // the authored masonry. These three lane samples cover the full track.
  const roadEnds=[at(center,0,-230),at(center,0,230)];
  if(roadEnds.some(p=>terrain.sites.some(s=>distance(p,s)<BASTION_VILLAGE_CLEARANCE)))continue;
  chosen.push({...center,houses,roadLength:460});
 }
 return chosen;
}

/** Tiny pairs of wind-worn tire ruts on the underlying landscape. RGBA vertex
 * colors fade the path at both ends and both edges; NO broad rectangular
 * asphalt, concrete or floating translucent overlay. One draw call.
 */
function makeTracks(villages,world,pos,heightAt){
 const sample=renderGroundHeightSampler(heightAt,world.size);
 const positions=[],colors=[],indices=[];
 const colorsOf=[
  new THREE.Color(desertStyle.roadDust),
  new THREE.Color(desertStyle.roadRuts)
 ];
 const lanes=[
  {offset:0,halfWidth:12.5,alpha:.085,color:0},
  {offset:-13,halfWidth:2.4,alpha:.26,color:1},
  {offset:13,halfWidth:2.4,alpha:.26,color:1}
 ];
 for(const v of villages){
  const steps=46,columns=4;
  for(const lane of lanes){
   const start=positions.length/3;
   for(let j=0;j<=steps;j++){
    const t=j/steps,z=(t-.5)*v.roadLength;
    const wobble=Math.sin(t*8.3+v.x*.002)*4.2+Math.sin(t*17.1+v.y*.001)*1.4;
    const taper=Math.pow(Math.sin(Math.PI*t),.7);
    for(let k=0;k<columns;k++){
     const cross=[-1,-.48,.48,1][k];
     const p=at(v,wobble+lane.offset+cross*lane.halfWidth,z);
     const point=pos(p.x,p.y,sample(p.x,p.y)+.30);
     positions.push(point.x,point.y,point.z);
     const c=colorsOf[lane.color];
     // Reflect path irregularity without unbounded randomness or z-fighting.
     const fade=taper*(k===0||k===columns-1?0:.78);
     colors.push(c.r,c.g,c.b,fade*lane.alpha);
     if(j<steps&&k<columns-1){
      const a=start+j*columns+k,b=a+columns;
      indices.push(a,a+1,b,a+1,b+1,b);
     }
    }
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geometry.setIndex(indices);geometry.computeBoundingSphere();
 geometry.userData={groundConforming:true,softRuts:true};
 return geometry;
}

/** Efficient GLB instancing: one renderer draw per authored ruin mesh,
 * regardless of whether a village has 3 or 5 buildings. Each instance keeps
 * the prototype's actual roof, doorway, weathered masonry, and rubble.
 * World.bases, blocked cells and traffic paths are NOT modified.
 */
export async function createDesertVillages({
 scene,world,terrain,pos,heightAt,seed=world?.seed??0,lowQuality=false,oases=[],
 loadModel,weatherModel
}){
 const villages=planDesertVillages({world,terrain,seed,lowQuality,oases});
 if(!villages.length)return {villages:[],meshes:[],roads:null,drawCalls:0};
 if(typeof loadModel!=='function')throw Error('Desert village requires authored GLTF model loader');
 const oasisStyle=villages.some(v=>v.architecturalStyle==='oasis-adobe');
 // Current v10 desert villages have their own authored PBR adobe models.
 // Historical map versions retain their original two canyon GLTF sources.
 const modernAdobe=world.generatorVersion>=10;
 const modelUrls=oasisStyle||modernAdobe?OASIS_VILLAGE_MODELS:DESERT_VILLAGE_MODELS;
 const gltfs=await Promise.all(modelUrls.map(url=>loadModel(url)));
 const templates=gltfs.map((data,variant)=>{
  const source=data.scene.clone(true);
  if(!oasisStyle&&!modernAdobe)weatherModel?.(source); // Keep modern GLB baked PBR maps
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source);
  const extent=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  const anchor=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
  const submeshes=[];
  source.traverse(part=>{
   if(!part.isMesh||!part.geometry)return;
   submeshes.push({
    geometry:part.geometry,
    material:part.material,
    local:new THREE.Matrix4().multiplyMatrices(anchor,part.matrixWorld)
   });
  });
  if(!submeshes.length)throw Error('Ruin GLTF '+variant+' has no renderable geometry');
  return {submeshes,height:extent.y,width:Math.max(.001,extent.x,extent.z)};
 });
 const houses=villages.flatMap(v=>v.houses);
 const meshes=[];
 const origin=new THREE.Vector3(),quaternion=new THREE.Quaternion();
 const scale=new THREE.Vector3(),worldMatrix=new THREE.Matrix4(),transformed=new THREE.Matrix4();
 for(let type=0;type<templates.length;type++){
  const template=templates[type],entries=houses.filter(h=>h.variant===type);
  if(!entries.length)continue;
  for(let index=0;index<template.submeshes.length;index++){
   const part=template.submeshes[index];
   const material=part.material;
   const mesh=new THREE.InstancedMesh(part.geometry,material,entries.length);
   mesh.name='visual-authored-'+(oasisStyle||modernAdobe?'oasis-adobe-'+type:'abandoned-'+(type===0?'house':'depot'))+'-'+index;
   mesh.userData={
    visualOnly:true,nonPlayable:true,desertVillage:true,authoredRuin:true,
    source:modelUrls[type],revision:oasisStyle?OASIS_HAMLET_REVISION:modernAdobe?'modern-adobe-ruins-v2-20261122':DESERT_VILLAGE_ART_REVISION
   };
   mesh.castShadow=false;mesh.receiveShadow=true;
   mesh.raycast=()=>{};mesh.frustumCulled=false;
   mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
   for(let j=0;j<entries.length;j++){
    const house=entries[j],base=pos(house.x,house.y,heightAt(house.x,house.y)-1.3);
    origin.copy(base);
    quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,house.angle);
    // V3: realistic width/height variation while preserving believable doors
    // and the authored GLTF roof and masonry detail. Legacy remains identical.
    const factor=Math.min(house.width/template.width,house.height/Math.max(1,template.height));
    if(house.kind){
     const horizontal=house.width/template.width;
     const vertical=Math.max(horizontal*.76,Math.min(horizontal*1.16,
      house.height/Math.max(1,template.height)));
     const depth=(house.depth??house.width)/template.width;
     scale.set(horizontal,vertical,depth);
    }else scale.setScalar(factor);
    if(house.kind)mesh.setColorAt(j,new THREE.Color().setRGB(house.tint,house.tint*.992,house.tint*.979));
    worldMatrix.compose(origin,quaternion,scale);
    transformed.multiplyMatrices(worldMatrix,part.local);
    mesh.setMatrixAt(j,transformed);
   }
   mesh.instanceMatrix.needsUpdate=true;
   mesh.computeBoundingSphere();
   scene.add(mesh);meshes.push(mesh);
  }
 }
 const road=new THREE.Mesh(makeTracks(villages,world,pos,heightAt),
  new THREE.MeshBasicMaterial({
   vertexColors:true,transparent:true,opacity:.64,depthWrite:false,
   polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide
  }));
 road.name='visual-worn-sand-village-tracks';
 road.userData={
  visualOnly:true,nonPlayable:true,desertVillage:true,softRuts:true,
  groundConforming:true,revision:DESERT_VILLAGE_ART_REVISION
 };
 road.castShadow=false;road.receiveShadow=false;road.raycast=()=>{};
 scene.add(road);
 return {villages,meshes,roads:road,drawCalls:meshes.length+1};
}
