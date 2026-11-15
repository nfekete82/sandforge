import * as THREE from 'three';

// Cosmetic side cladding for the original 11 November barracks GLB.
// Authored model coordinates are Y-up and front-facing +Z. The existing
// armoured hull, portal, clips, textures and all interaction stay intact.
// Apply the same finish to game actors, construction ghosts and HUD portrait.
export function finishBarracksSides(model){
 if(!model)return null;
 const root=model.getObjectByName('Atlas_barracks')??model;
 const found=root.getObjectByName('SandforgeBarracksSideCladding');
 if(found)return found;
 let sand=null,steel=null;
 root.traverse(node=>{
  if(!node.isMesh)return;
  if(!sand&&/Atlas_CeramicHull_/.test(node.name))sand=Array.isArray(node.material)?node.material[0]:node.material;
  if(!steel&&/Atlas_ArmouredHull_/.test(node.name))steel=Array.isArray(node.material)?node.material[0]:node.material;
 });
 const group=new THREE.Group();
 group.name='SandforgeBarracksSideCladding';
 group.userData={visualOnly:true,nonPlayable:true,barracksSideFinish:true};
 const geometry=new THREE.BoxGeometry(1,1,1);
 const material=(source,color,roughness,metalness)=>{
  const m=source?.isMeshStandardMaterial?source.clone():new THREE.MeshStandardMaterial();
  m.color.set(color);m.roughness=roughness;m.metalness=metalness;
  m.userData={...m.userData,sandforgeBarracksSideMaterial:true};
  return m;
 };
 const paints=[
  material(sand,'#d6c49c',.86,.08),
  material(sand,'#b5ae8a',.9,.06),
  material(sand,'#bcb08d',.88,.07)
 ];
 const edge=material(steel,'#736b58',.67,.37);
 const vent=material(steel,'#3f4540',.78,.33);
 function box(name,scale,position,mat){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name=name;mesh.scale.set(...scale);mesh.position.set(...position);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,nonPlayable:true};
  group.add(mesh);return mesh;
 }
 for(const side of [-1,1]){
  // An uninterrupted sand-coloured structural wall behind the individually
  // fitted cladding cassettes; no blue gaps at oblique camera angles.
  box('BarracksSolidSideWall_'+side,[.09,1.07,1.94],
   [side*1.395,.78,0],paints[0]);
  for(let i=0;i<3;i++){
   const z=-.64+i*.64;
   box('BarracksCamoSidePanel_'+side+'_'+i,[.065,.88,.595],
    [side*1.462,.83,z],paints[(i+(side===1?0:1))%3]);
  }
  for(const z of [-.319,.319]){
   box('BarracksPanelJoint_'+side+'_'+z,[.029,.89,.026],
    [side*1.504,.83,z],edge);
  }
  // One recessed service vent per flank; the airlock at +Z stays untouched.
  box('BarracksSideVent_'+side,[.032,.23,.37],
   [side*1.506,.98,-.48],vent);
  for(let i=0;i<3;i++)box('BarracksVentLouvre_'+side+'_'+i,
   [.038,.023,.33],[side*1.529,.91+i*.068,-.48],edge);
 }
 root.add(group);
 return group;
}

export function disposeBarracksSides(model){
 const group=model?.getObjectByName('SandforgeBarracksSideCladding');
 if(!group)return;
 const geometries=new Set(),materials=new Set();
 group.traverse(node=>{
  if(!node.isMesh)return;
  geometries.add(node.geometry);
  for(const m of Array.isArray(node.material)?node.material:[node.material])
   if(m)materials.add(m);
 });
 group.removeFromParent();group.clear();
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
}
