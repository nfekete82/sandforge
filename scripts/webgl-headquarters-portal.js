import * as THREE from 'three';

// The final 11.7MB Sandforge HQ PBR glTF uses separate door leaves
// and surface trims. Animate those existing parts without duplicating
// an Atlas door, repainting textures or touching gameplay collision.
const LEFT=['HQ_door_leaf_L','HQ_door_panel_-1_0','HQ_door_panel_-1_1',
 'HQ_door_panel_-1_2','HQ_door_handle_-1'];
const RIGHT=['HQ_door_leaf_R','HQ_door_panel_1_0','HQ_door_panel_1_1',
 'HQ_door_panel_1_2','HQ_door_handle_1'];
const HOLD=1.68;

export function prepareHeadquartersPortal(entry){
 if(entry?.headquartersPortal)return entry.headquartersPortal;
 const root=entry?.detail;
 if(!root)return null;
 const left=root.getObjectByName('HQ_door_leaf_L');
 const right=root.getObjectByName('HQ_door_leaf_R');
 const recess=root.getObjectByName('HQ_door_recess_back');
 if(!left||!right||!recess)return null;
 const parts=[];
 for(const [names,sign] of [[LEFT,1],[RIGHT,-1]])for(const name of names){
  const mesh=root.getObjectByName(name);
  if(mesh)parts.push({mesh,x:mesh.position.x,sign});
 }
 // The recess is a thin painted mesh, not collision geometry. A dark hall
 // remains visible only while the actual leaves are open.
 const hall=new THREE.Group();
 hall.name='HeadquartersPbrInterior';
 const baseMaterial=root.getObjectByName('HQ_Static_SF_OriginalPBR_roof')?.material;
 const trimMaterial=root.getObjectByName('HQ_Static_SF_OriginalPBR_trim')?.material;
 if(baseMaterial){
  const floor=new THREE.Mesh(new THREE.BoxGeometry(3.1,.07,1.16),baseMaterial);
  floor.name='HeadquartersPbrEntryFloor';
  floor.position.set(0,.59,4.19);floor.receiveShadow=true;floor.raycast=()=>{};
  hall.add(floor);
 }
 if(trimMaterial){
  const back=new THREE.Mesh(new THREE.BoxGeometry(3.1,2.58,.07),trimMaterial);
  back.name='HeadquartersPbrEntryBack';
  back.position.set(0,1.79,3.84);back.receiveShadow=true;back.raycast=()=>{};
  hall.add(back);
 }
 hall.visible=false;root.add(hall);
 const portal={hqPbrDoor:true,root,recess,
  initialRecessVisible:recess.visible,parts,hall};
 entry.headquartersPortal=portal;
 return portal;
}
export function setHeadquartersDoorOpen(portal,amount){
 const open=Math.max(0,Math.min(1,amount));
 for(const part of portal.parts)
  part.mesh.position.x=part.x+part.sign*HOLD*open;
 portal.recess.visible=open<=.03&&portal.initialRecessVisible;
 portal.hall.visible=open>.03;
}
export function disposeHeadquartersPortal(entry){
 const portal=entry?.headquartersPortal;
 if(!portal)return;
 setHeadquartersDoorOpen(portal,0);
 portal.hall.removeFromParent();
 delete entry.headquartersPortal;
}
