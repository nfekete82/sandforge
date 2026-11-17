import * as THREE from 'three';
import {servicePaint} from './webgl-service-materials.js';

// Shared 256px albedo + normal atlas. One upload serves every facility,
// including its placement ghost: never generate one texture per building.
const concrete=servicePaint(['#a99c82','#bcb19b','#ccc1a9'],{
 pattern:'slab',seed:73,repeat:2,metalness:.03,roughness:.94
});
const concreteEdge=new THREE.MeshStandardMaterial({
 color:'#807969',roughness:.94,metalness:.04
});
// Keep the foundation opening aligned with the procedural missile silo.
// Both the live grounding pass and the construction ghost use this cutout.
export const SILO_FOUNDATION_APERTURE=Object.freeze({
 x:-17,z:0,radius:61.6
});
export const FOUNDATION_PAD_KINDS=Object.freeze([
 'headquarters','barracks','factory','generator',
 'turret','research','silo','interceptor'
]);

/** Only the visual foundations; these are not additional colliders.
 * Airfield already has its own paved aprons/runway; walls remain on terrain
 * so long wall chains never create overlapping rectangular concrete strips.
 */
export function foundationPadSpec(kind,width=160){
 if(!FOUNDATION_PAD_KINDS.includes(kind))return null;
 const w=Math.max(50,Number(width)||160);
 const wide=kind==='silo'?1.07:kind==='factory'?1.10:
  kind==='headquarters'?1.10:1.09;
 const deep=kind==='silo'?.85:kind==='turret'?.95:
  kind==='factory'?.79:.80;
 return {
  width:Math.round(w*wide),
  depth:Math.round(w*deep),
  thickness:1.30,
  x:0,z:0
 };
}

/** A real ring-shaped foundation for the silo: a plain rectangular slab used
 * to span its launch aperture, leaving a light tiled 'floor' beneath the
 * missile despite the shaft geometry being correctly cut out above it.
 * Subtract the same aperture from BOTH ground-level concrete surfaces.
 * The surrounding foundation stays one cheap static mesh per material.
 */
function siloFoundationGeometry(w,h,d){
 const boundary=new THREE.Shape();
 boundary.moveTo(-w/2,-d/2);
 boundary.lineTo(w/2,-d/2);
 boundary.lineTo(w/2,d/2);
 boundary.lineTo(-w/2,d/2);
 boundary.closePath();
 const aperture=new THREE.Path();
 aperture.absarc(SILO_FOUNDATION_APERTURE.x,
  SILO_FOUNDATION_APERTURE.z,SILO_FOUNDATION_APERTURE.radius,
  0,Math.PI*2,true);
 boundary.holes.push(aperture);
 return new THREE.ExtrudeGeometry(boundary,{
  depth:h,steps:1,bevelEnabled:false,curveSegments:64
 });
}

/** Two thin slabs instead of a chunky foundation block. The shadow-colored
 * bottom lip enters the sand; detailed tile grout remains on the top.
 * Both ghost and finished model use this exact geometry and placement.
 */
export function createBuildingFoundation(kind,width){
 const shape=foundationPadSpec(kind,width);
 if(!shape)return null;
 const group=new THREE.Group();
 group.name='FacilityConcreteFoundation_'+kind;
 group.userData={visualOnly:true,nonPlayable:true,foundation:true,
  padWidth:shape.width,padDepth:shape.depth};
 const add=(name,w,h,d,y,mat)=>{
  // Do NOT Material.clone() the shared PBR source: Three.js serializes
  // userData, and source owns two 256px DataTextures there. Reconstruct only
  // the inexpensive material params while sharing the GPU texture atlases.
  const owned=new THREE.MeshStandardMaterial({
   color:mat.color,map:mat.map??null,normalMap:mat.normalMap??null,
   normalScale:mat.normalScale?.clone(),metalness:mat.metalness,
   roughness:mat.roughness,side:mat.side
  });
  const isSilo=kind==='silo';
  const geometry=isSilo?siloFoundationGeometry(w,h,d):
   new THREE.BoxGeometry(w,h,d);
  const mesh=new THREE.Mesh(geometry,owned);
  mesh.name=name;
  if(isSilo){
   // Extrude XY footprint rotated to XZ; offset to preserve the old
   // slab's y +/- h/2 limits exactly (no new collision or foundation height).
   mesh.rotation.x=-Math.PI/2;
   mesh.position.set(shape.x,y-h/2,shape.z);
   mesh.userData.foundationAperture=SILO_FOUNDATION_APERTURE;
  }else mesh.position.set(shape.x,y,shape.z);
  mesh.material.userData={sandforgeFoundationMaterial:true};
  mesh.userData={visualOnly:true,nonPlayable:true,foundation:true};
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
  group.add(mesh);return mesh;
 };
 // Top at y=1.15, bottom at -0.15: only a thin concrete edge is visible.
 add('FacilityConcreteFoundationLip',shape.width+4,.80,shape.depth+4,
  -.39,concreteEdge);
 add('FacilityConcreteFoundationSurface',shape.width,shape.thickness,shape.depth,
  .50,concrete);
 return group;
}
export function disposeBuildingFoundation(group){
 if(!group)return;
 const geometries=new Set(),materials=new Set();
 group.traverse(o=>{
  if(!o.isMesh)return;
  if(o.geometry)geometries.add(o.geometry);
  if(o.material)materials.add(o.material);
 });
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
 group.removeFromParent();
 // Shared concrete.map and concrete.normalMap intentionally survive:
 // owned by this module, not any one building.
}
