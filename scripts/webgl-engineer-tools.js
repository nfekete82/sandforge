import * as THREE from 'three';

/**
 * Original Nov 11 pioneer: keep his animated combat pistol and rig.
 * Equip a physical open-ended wrench in the same right-hand socket; show
 * the wrench while repairing/building, pistol while walking or defending.
 * No modifications to the authored GLB, its UVs or animation tracks.
 */
let steelGeometry,gripGeometry,steelMaterial,gripMaterial;
function sharedWrenchAssets(){
 if(steelGeometry)return;
 const outline=[
  [-.034,-.215],[.034,-.215],[.034,.09],[.087,.133],
  [.142,.153],[.161,.222],[.115,.247],[.081,.189],
  [.056,.171],[-.056,.171],[-.081,.189],[-.115,.247],
  [-.161,.222],[-.142,.153],[-.087,.133],[-.034,.09]
 ];
 const shape=new THREE.Shape();
 shape.moveTo(...outline[0]);
 for(const point of outline.slice(1))shape.lineTo(...point);
 shape.closePath();
 steelGeometry=new THREE.ExtrudeGeometry(shape,{
  depth:.032,steps:1,bevelEnabled:true,bevelSegments:1,
  bevelThickness:.004,bevelSize:.004,curveSegments:1
 });
 gripGeometry=new THREE.BoxGeometry(.076,.105,.046);
 steelMaterial=new THREE.MeshStandardMaterial({color:'#adb3af',metalness:.72,roughness:.36});
 gripMaterial=new THREE.MeshStandardMaterial({color:'#353a37',metalness:.12,roughness:.8});
}

/** Works on both original animated engineer GLBs and their lite placeholder. */
export function equipEngineerTools(model,{fallback=false}={}){
 if(!model)return null;
 if(model.userData.sandforgeEngineerToolsEquipped){
  return {wrench:model.getObjectByName('Sandforge_Engineer_Wrench'),
   pistol:model.getObjectByName(fallback?'Sandforge_Engineer_Pistol_Fallback':'Atlas_Rifle')
    ??model.getObjectByName('Pistol')};
 }
 const socket=fallback?model:model.getObjectByName('Atlas_WeaponSocket');
 if(!socket){console.warn('Sandforge pioneer: hand socket missing');return null;}
 sharedWrenchAssets();

 // The GLB contains two overlapping legacy weapon representations. Retain
 // the authored little Atlas pistol; hide only duplicate import groups.
 const pistol=fallback?model.getObjectByName('Sandforge_Engineer_Pistol_Fallback'):
  model.getObjectByName('Atlas_Rifle')??model.getObjectByName('Pistol');
 if(!fallback){
  for(const name of ['Shotgun','Pistol']){
   const duplicate=model.getObjectByName(name);
   if(duplicate&&duplicate!==pistol)duplicate.visible=false;
  }
 }
 const wrench=new THREE.Group();
 wrench.name='Sandforge_Engineer_Wrench';
 wrench.userData.sandforgeRepairTool=true;
 const metal=new THREE.Mesh(steelGeometry,steelMaterial);
 metal.name='Repair_Wrench_Steel';
 metal.userData.sandforgeSharedToolMesh=true;
 const grip=new THREE.Mesh(gripGeometry,gripMaterial);
 grip.name='Repair_Wrench_Grip';
 grip.userData.sandforgeSharedToolMesh=true;
 grip.position.set(0,-.13,.018);
 wrench.add(metal,grip);
 if(fallback){
  wrench.position.set(14,21,9);
  wrench.scale.setScalar(22);
  wrench.rotation.set(.12,0,.35);
 }else{
  // Atlas_WeaponSocket is parented to the animated right-hand bone.
  wrench.position.set(-.045,.075,.025);
  wrench.scale.setScalar(1.42);
  wrench.rotation.set(.18,0,.35);
 }
 wrench.userData.restRotationZ=wrench.rotation.z;
 wrench.userData.restY=wrench.position.y;
 wrench.visible=true;
 socket.add(wrench);
 model.userData.sandforgeEngineerToolsEquipped=true;
 return {wrench,pistol};
}

/** Visual-only. Pioneer carries the wrench at idle and while working. */
export function updateEngineerTools(equipment,working,time){
 if(!equipment?.wrench)return;
 const {wrench,pistol}=equipment;
 wrench.visible=true;
 if(pistol)pistol.visible=false;
 const rest=wrench.userData.restRotationZ;
 wrench.rotation.z=rest+(working?Math.sin(time*12)*.18:0);
 wrench.position.y=wrench.userData.restY+(working?Math.sin(time*12)*.012:0);
}
