import * as THREE from 'three';
import {FACTION_FLAG_COLORS,FACTION_FLAG_WHITE} from './webgl-faction-flags.js';

/** Two small, matte faction pennants fixed to the AUTHORED facade beside
 * the actual PBR door. Never attach them to animated door leaves.
 * Placement is calculated from the current glTF door/facade geometry,
 * so the same code works for both final blue/red building assets and HUD.
 */
export const ENTRANCE_BANNER_REVISION='facade-faction-star-plaques-v2-20261116';
export const ENTRANCE_BANNER_COLORS=FACTION_FLAG_COLORS;
const MARK='SF_FactionEntranceBanners';
const FRONT_OFFSET=.028;

function entrance(model,kind){
 const names=kind==='headquarters'?['HQ_door_leaf_L','HQ_door_leaf_R']:
  kind==='barracks'?['door_leaf_L','door_leaf_R']:null;
 if(!names)return null;
 if(kind==='headquarters'&&!model.getObjectByName('HQ_Radar_01_LargeDish_Rotor'))return null;
 if(kind==='barracks'&&!model.getObjectByName('roof_top_center'))return null;
 const leaves=names.map(name=>model.getObjectByName(name));
 if(leaves.some(leaf=>!leaf?.isMesh))return null;
 model.updateWorldMatrix(true,true);
 const inverse=model.matrixWorld.clone().invert(),bounds=new THREE.Box3();
 for(const leaf of leaves){
  const box=new THREE.Box3().setFromObject(leaf);
  if(box.isEmpty())return null;
  bounds.union(box.applyMatrix4(inverse));
 }
 return bounds.isEmpty()?null:bounds;
}
function facadeMeshes(model,kind){
 const faces=[];
 const named=kind==='headquarters'?/^HQ_Static_SF_OriginalPBR_walls$/i:
  /^(?:front_wall|wall_front|facade|wall_|outer_wall|hull_)/i;
 model.traverse(node=>{
  if(!node.isMesh||node.userData?.visualOnly)return;
  if(named.test(node.name))faces.push(node);
 });
 return faces;
}
function starShape(radius){
 const shape=new THREE.Shape();
 for(let i=0;i<10;i++){
  const r=i%2===0?radius:radius*.43;
  const a=Math.PI/2+i*Math.PI/5;
  const x=r*Math.cos(a),y=r*Math.sin(a);
  if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
 }
 shape.closePath();return shape;
}
function pennantShape(w,h){
 // Energy-core-style rectangular star plaque instead of loose pennants.
 const s=new THREE.Shape();
 s.moveTo(-w/2,h/2);s.lineTo(w/2,h/2);
 s.lineTo(w/2,-h/2);s.lineTo(-w/2,-h/2);s.closePath();
 return s;
}
function freeMaterials(root){
 const geometries=new Set(),materials=new Set();
 root.traverse(node=>{
  if(!node.isMesh)return;
  if(node.geometry)geometries.add(node.geometry);
  for(const m of Array.isArray(node.material)?node.material:[node.material])
   if(m)materials.add(m);
 });
 root.removeFromParent();
 for(const g of geometries)g.dispose();
 for(const m of materials)m.dispose();
}
/** Adds EXACTLY two banners, not a generic flag on every building. Returns
 * zero when a third-party/legacy model lacks the actual doorway/facade.
 * Materials are unique to the decoration, not cloned from the GLB atlas.
 */
export function paintFactionEntranceBanners(model,kind,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 const already=model.getObjectByName(MARK);
 if(already){
  already.userData.owner=owner;
  already.getObjectByName('SF_FactionPennant')?.material?.color.set(ENTRANCE_BANNER_COLORS[owner]);
  return 2;
 }
 const door=entrance(model,kind),faces=facadeMeshes(model,kind);
 if(!door||!faces.length)return 0;
 const d=door.getSize(new THREE.Vector3());
 if(d.x<.35||d.y<.35)return 0;
 const cx=(door.min.x+door.max.x)/2;
 const width=Math.max(.24,Math.min(.53,d.x*.17));
 const height=Math.max(.45,Math.min(.87,d.y*.43));
 const y=door.min.y+d.y*.62;
 const offset=d.x/2+width*.72;
 // Probe the two static facade surfaces along local -Z. Do not place flags
 // at a guessed world height or on sliding doors, trim, glass, roof or props.
 const startZ=door.max.z+Math.max(3,d.x*2);
 const direction=new THREE.Vector3(0,0,-1).transformDirection(model.matrixWorld);
 const ray=new THREE.Raycaster();
 const placements=[];
 const originalSides=new Map();
 for(const face of faces)for(const material of Array.isArray(face.material)?face.material:[face.material]){
  if(!material||originalSides.has(material))continue;
  originalSides.set(material,material.side);material.side=THREE.DoubleSide;
 }
 try{
  for(const sign of [-1,1]){
   const x=cx+sign*offset;
   const origin=model.localToWorld(new THREE.Vector3(x,y,startZ));
   ray.set(origin,direction);
   const hits=ray.intersectObjects(faces,false);
   const hit=hits.map(h=>model.worldToLocal(h.point.clone()))
    .find(p=>Math.abs(p.z-door.max.z)<Math.max(.85,d.x*.30));
   if(!hit)return 0;
   placements.push(new THREE.Vector3(x,y,hit.z+FRONT_OFFSET));
  }
 }finally{
  for(const [material,side] of originalSides)material.side=side;
 }
 const group=new THREE.Group();group.name=MARK;
 group.userData={owner,visualOnly:true,nonPlayable:true,entranceBanners:true,
  revision:ENTRANCE_BANNER_REVISION};
 // Use the identical unlit faction paint as roof stripes and Bastion fabric.
 // Matte-looking solid paint, without sunlight shifting it toward cyan.
 const cloth=new THREE.MeshBasicMaterial({
  color:ENTRANCE_BANNER_COLORS[owner],toneMapped:false,side:THREE.DoubleSide
 });
 const ivory=new THREE.MeshBasicMaterial({color:FACTION_FLAG_WHITE,side:THREE.DoubleSide,
  toneMapped:false});
 const steel=new THREE.MeshStandardMaterial({color:'#4e5750',roughness:.77,metalness:.28});
 const pennantGeometry=new THREE.ShapeGeometry(pennantShape(width,height));
 const starGeometry=new THREE.ShapeGeometry(starShape(width*.25));
 const barGeometry=new THREE.BoxGeometry(width+.07,.045,.065);
 const shieldGeometry=new THREE.BoxGeometry(width+.095,height+.095,.055);
 for(const [i,position] of placements.entries()){
  const mount=new THREE.Group();
  mount.name='SF_EntranceBanner_'+(i===0?'Left':'Right');
  mount.position.copy(position);
  const backing=new THREE.Mesh(shieldGeometry,steel);
  backing.name='SF_FactionStarPlaqueBacking';
  backing.position.z=-.019;
  backing.castShadow=false;backing.receiveShadow=false;mount.add(backing);
  const fabric=new THREE.Mesh(pennantGeometry,cloth);
  fabric.name='SF_FactionPennant';
  fabric.position.z=.018;
  fabric.castShadow=false;fabric.receiveShadow=false;mount.add(fabric);
  const star=new THREE.Mesh(starGeometry,ivory);
  star.name='SF_PennantStar';star.position.set(0,height*.01,.031);
  star.castShadow=false;star.receiveShadow=false;mount.add(star);
  const rail=new THREE.Mesh(barGeometry,steel);
  rail.name='SF_FacadeBannerRail';
  rail.position.set(0,height*.5+.025,.018);
  rail.castShadow=false;rail.receiveShadow=false;mount.add(rail);
  mount.traverse(node=>{if(node.isMesh)node.raycast=()=>{};});
  group.add(mount);
 }
 model.add(group);
 return 2;
}
export function disposeFactionEntranceBanners(model){
 const group=model?.getObjectByName?.(MARK);
 if(!group)return false;
 freeMaterials(group);return true;
}
