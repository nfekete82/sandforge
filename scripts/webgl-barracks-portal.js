import * as THREE from 'three';

// The shipped barracks facade consists of separate textured airlock panels and
// solid hull volumes. Build an actual portal by clipping ONLY the handful of
// hull meshes intersecting the door cavity; preserve their original UV/PBR.
// No second opaque wall is left behind the sliding panels.
const localDoorBox=[
 [new THREE.Vector3( 1,0,0), .57], // x >= -.57
 [new THREE.Vector3(-1,0,0), .20], // x <=  .20
 [new THREE.Vector3(0, 1,0),-.25], // y >=  .25
 [new THREE.Vector3(0,-1,0),1.25], // y <= 1.25
 [new THREE.Vector3(0,0, 1),-.68], // z >=  .68
 [new THREE.Vector3(0,0,-1),1.64]  // z <= 1.64
];
// Newer shipped Kasernen-GLBs merge their visual door into one material
// batch ("AtlasUpgrade_barracks_steel"). Cut that *section of geometry*
// by the same 6-plane cavity; do not slice away the entire facade mesh.
const cutNames=/ArmouredHull|CeramicHull|AirlockHousing|AirlockArmour|EntryRecess|AtlasUpgrade_barracks_/;
const panelNames=/AirlockDoor|DoorCeramic|BarracksBlastDoor|BarracksDoorStiffener/;
const box=new THREE.BoxGeometry(1,1,1);
const dark=new THREE.MeshStandardMaterial({color:'#101716',roughness:1});
const floor=new THREE.MeshStandardMaterial({color:'#666054',roughness:.95});

const PBR_DOOR_PARTS=Object.freeze({
 right:['door_leaf_L','door_panel_-1_0','door_panel_-1_1','door_panel_-1_2','door_handle_-1'],
 left:['door_leaf_R','door_panel_1_0','door_panel_1_1','door_panel_1_2','door_handle_1']
});
/**
 * The newer ~11MB PBR barracks GLB has full-size, separate double doors.
 * Previous portal logic only recognized Atlas_BarracksBlastDoor; it created a
 * tiny phantom shutter at z=1.5 while the actual doors at z=4.0 stayed closed.
 * Here all visible panels and handles slide together without clipping the
 * newly authored facade or changing any building/actor physics.
 */
function preparePbrBarracksPortal(entry){
 const root=entry.detail;
 const left=root.getObjectByName('door_leaf_L');
 const right=root.getObjectByName('door_leaf_R');
 if(!left||!right||!root.getObjectByName('door_recess_back'))return null;
 const doorPanels=[];
 for(const [names,sign] of [[PBR_DOOR_PARTS.right,1],[PBR_DOOR_PARTS.left,-1]]){
  for(const name of names){
   const mesh=root.getObjectByName(name);
   if(!mesh)continue;
   doorPanels.push({mesh,x:mesh.position.x,sign});
  }
 }
 const recess=root.getObjectByName('door_recess_back');
 const hall=new THREE.Group();hall.name='BarracksPbrInterior';
 const part=(name,size,position,material)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  mesh.name=name;mesh.position.set(...position);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.raycast=()=>{};hall.add(mesh);
 };
 // Floor/rear wall remain physically within the facade's original envelope.
 part('BarracksPbrFloor',[2.50,.05,1.18],[0,.45,3.18],floor);
 part('BarracksPbrRear',[2.58,2.07,.07],[0,1.59,2.58],dark);
 for(const x of [-1.30,1.30])
  part('BarracksPbrSide',[.05,2.07,1.17],[x,1.59,3.18],dark);
 hall.visible=false;
 root.add(hall);
 const portal={kind:'barracks',pbrDoor:true,root,doorPanels,recess,
  initialRecessVisible:recess.visible,hall,materials:[],clipped:[],rebuilt:[],planes:[]};
 entry.barracksPortal=portal;
 return portal;
}

export function prepareBarracksPortal(entry,renderer){
 if(entry?.barracksPortal)return entry.barracksPortal;
 const root=entry?.detail;
 if(!root)return null;
 const authored=preparePbrBarracksPortal(entry);
 if(authored)return authored;
 const doorPanels=[],materials=[],clipped=[],rebuilt=[];
 const planes=localDoorBox.map(()=>new THREE.Plane());
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  if(panelNames.test(obj.name)){
   doorPanels.push({mesh:obj,y:obj.position.y,scaleY:obj.scale.y});
  }
  if(cutNames.test(obj.name)){
   const original=obj.material;
   clipped.push({mesh:obj,original});
   const clipMaterial=material=>{
    const m=material.clone();
    m.clippingPlanes=planes;m.clipIntersection=true;m.clipShadows=true;
    materials.push(m);return m;
   };
   obj.material=Array.isArray(original)?original.map(clipMaterial):clipMaterial(original);
  }
 });
 if(!doorPanels.some(p=>/BarracksBlastDoor/.test(p.mesh.name))){
  // The legacy exporter merged BarracksBlastDoor into AtlasUpgrade's steel
  // batch. It exists in model metadata but is NOT an individual glTF node.
  // Restore a separate render-only sliding shutter at its authored position
  // so the real infantry exit can open instead of freezing behind a wall.
  const steel=new THREE.MeshStandardMaterial({
   name:'Sandforge Barracks recovered door',color:'#756c5d',
   roughness:.74,metalness:.34
  });
  const shutter=new THREE.Mesh(new THREE.BoxGeometry(.74,.93,.11),steel);
  shutter.name='BarracksBlastDoor_Recovery';
  shutter.position.set(-.18,.77,1.501);
  shutter.castShadow=true;shutter.receiveShadow=true;shutter.raycast=()=>{};
  shutter.userData={visualOnly:true,nonPlayable:true,barracksDoorRecovery:true};
  root.add(shutter);rebuilt.push(shutter);
  doorPanels.push({mesh:shutter,y:shutter.position.y,scaleY:shutter.scale.y});
 }
 renderer.localClippingEnabled=true;
 const hall=new THREE.Group();
 hall.name='BarracksInterior';
 function part(name,size,at,material){
  const mesh=new THREE.Mesh(box,material);
  mesh.name=name;mesh.position.set(...at);mesh.scale.set(...size);
  hall.add(mesh);return mesh;
 }
 // Interior is behind the true cavity, not pasted over the closing panels.
 part('BarracksInteriorFloor',[.78,.035,.90],[-.18,.275,.91],floor);
 part('BarracksInteriorRear',[.80,.95,.025],[-.18,.73,.66],dark);
 part('BarracksInteriorCeiling',[.82,.025,.88],[-.18,1.24,1.08],dark);
 const portal={kind:'barracks',root,doorPanels,materials,clipped,rebuilt,planes,box:localDoorBox,
  hall,transform:null};
 root.add(hall);entry.barracksPortal=portal;
 updateBarracksPortalPlanes(portal,true);
 return portal;
}
export function updateBarracksPortalPlanes(portal,force=false){
 if(portal.pbrDoor)return; // PBR doorway consists of separate geometry; no clipping.
 portal.root.updateWorldMatrix(true,false);
 const matrix=portal.root.matrixWorld;
 if(!force&&portal.transform?.equals(matrix))return;
 portal.transform=matrix.clone();
 for(let i=0;i<portal.planes.length;i++){
  const [normal,constant]=portal.box[i];
  portal.planes[i].set(normal,constant).applyMatrix4(matrix);
 }
}
export function setBarracksDoorOpen(portal,open){
 if(portal.pbrDoor){
  // Keep the complete PBR gate intact: matching leaf, ribs and handle move
  // 1.38m sideways along the original facade when production completes.
  for(const panel of portal.doorPanels)panel.mesh.position.x=panel.x+panel.sign*open*1.38;
  portal.recess.visible=open<=.03&&portal.initialRecessVisible;
 }else for(const panel of portal.doorPanels){
  panel.mesh.position.y=panel.y+open*.66;
  panel.mesh.scale.y=panel.scaleY*(1-open*.97);
 }
 portal.hall.visible=open>.03;
}
export function disposeBarracksPortal(entry){
 const p=entry?.barracksPortal;if(!p)return;
 setBarracksDoorOpen(p,0);
 for(const {mesh,original} of p.clipped)mesh.material=original;
 for(const m of p.materials)m.dispose();
 for(const mesh of p.rebuilt){
  mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();
 }
 p.hall.removeFromParent();
 delete entry.barracksPortal;
}
