import * as THREE from 'three';
import {FACTION_PAINT} from './sandforge-faction-palette.js';

/** Subtle painted faction strips on the REAL authored PBR roof surface.
 * One static non-interactive mesh per building, generated from ray samples
 * of the existing roof triangles. No floating flags, no extra collision and
 * no edits to the original GLB textures, geometry, radar or door pivots.
 * Coordinates are model-local; call before battlefield model normalization.
 */
export const ROOF_STRIPE_REVISION='authored-roof-stripes-v1-20261116';
export const ROOF_STRIPE_COLORS=FACTION_PAINT;
const MARK='SF_FactionRoofStripes';

function authoredRoofs(model,kind){
 if(kind==='headquarters'){
  if(!model.getObjectByName('HQ_Radar_01_LargeDish_Rotor'))return [];
  const roof=model.getObjectByName('HQ_Static_SF_OriginalPBR_roof');
  return roof?.isMesh?[roof]:[];
 }
 if(kind!=='barracks'||!model.getObjectByName('door_leaf_L')||
    !model.getObjectByName('roof_top_center'))return [];
 const roofs=[];
 model.traverse(node=>{
  if(node.isMesh&&/^roof_(?:top|main|plate|slab|surface)/i.test(node.name))
   roofs.push(node);
 });
 return roofs;
}

/** Return the number of stripes; safe to call on clones and repeated loads.
 * The ray probes hit only authored roof meshes, never the dome, canopy, radar,
 * props, terrain or other obstacles. Each of the two ribbons follows the roof
 * height/angle rather than hovering above it.
 */
export function paintFactionRoofStripes(model,kind,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 const existing=model.getObjectByName(MARK);
 if(existing){
  existing.material.color.set(ROOF_STRIPE_COLORS[owner]);
  existing.userData.owner=owner;
  return existing.userData.stripes??2;
 }
 const roofs=authoredRoofs(model,kind);
 if(!roofs.length)return 0;
 model.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3();
 for(const roof of roofs)bounds.union(new THREE.Box3().setFromObject(roof));
 if(bounds.isEmpty())return 0;
 const span=bounds.getSize(new THREE.Vector3());
 if(span.x<1||span.z<1)return 0;
 // Two longitudinal stripes inside the outer left/right roof panels.
 // Their width scales with the actual authored building, not the gameplay hitbox.
 const width=Math.min(.64,Math.max(.16,span.x*.048));
 const sides=[bounds.min.x+span.x*.19,bounds.max.x-span.x*.19];
 const startZ=bounds.min.z+span.z*.20,endZ=bounds.max.z-span.z*.20;
 const steps=12,offset=Math.max(.009,Math.min(.025,span.y*.018));
 const ray=new THREE.Raycaster();
 const down=new THREE.Vector3(0,-1,0);
 const originY=bounds.max.y+Math.max(2,span.y+1);
 // glTF roof winding is not guaranteed to face the ray on every exporter.
 // Temporarily allow both sides for sampling, restoring ALL source materials.
 const sidesBefore=new Map();
 for(const roof of roofs){
  for(const material of Array.isArray(roof.material)?roof.material:[roof.material]){
   if(!material||sidesBefore.has(material))continue;
   sidesBefore.set(material,material.side);
   material.side=THREE.DoubleSide;
  }
 }
 const vertices=[],indices=[];
 let stripes=0;
 try{
  const sample=(x,z)=>{
   ray.set(new THREE.Vector3(x,originY,z),down);
   const hit=ray.intersectObjects(roofs,false)[0];
   return hit?model.worldToLocal(hit.point.clone().addScaledVector(hit.face?.normal??
    new THREE.Vector3(0,1,0),0).add(new THREE.Vector3(0,offset,0))):null;
  };
  for(const centerX of sides){
   let segments=0;
   for(let i=0;i<steps;i++){
    const z0=startZ+(endZ-startZ)*i/steps,z1=startZ+(endZ-startZ)*(i+1)/steps;
    const a=sample(centerX-width/2,z0),b=sample(centerX+width/2,z0);
    const c=sample(centerX-width/2,z1),d=sample(centerX+width/2,z1);
    if(!a||!b||!c||!d)continue;
    const k=vertices.length/3;
    vertices.push(...a,...b,...c,...d);
    indices.push(k,k+2,k+1,k+1,k+2,k+3);
    segments++;
   }
   if(segments)stripes++;
  }
 }finally{
  for(const [material,side] of sidesBefore)material.side=side;
 }
 if(!stripes)return 0;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 // Flat painted identification must match the Bastion banner RGB,
 // independent of the strong desert sun and camera tone mapping.
 const material=new THREE.MeshBasicMaterial({
  color:ROOF_STRIPE_COLORS[owner],toneMapped:false,
  side:THREE.DoubleSide,depthWrite:true,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
 });
 const mark=new THREE.Mesh(geometry,material);
 mark.name=MARK;
 mark.castShadow=false;mark.receiveShadow=false;
 mark.raycast=()=>{};
 mark.userData={visualOnly:true,nonPlayable:true,roofFactionMarking:true,
  owner,stripes,revision:ROOF_STRIPE_REVISION};
 model.add(mark);
 return stripes;
}

/** Dispose only the owned stripe geometry; the authored GLB remains shared. */
export function disposeFactionRoofStripes(model){
 const mark=model?.getObjectByName?.(MARK);
 if(!mark)return false;
 mark.removeFromParent();
 mark.geometry?.dispose();
 mark.material?.dispose();
 return true;
}
