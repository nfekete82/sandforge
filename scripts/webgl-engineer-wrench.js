import * as THREE from 'three';

/**
 * The November 11 Atlas engineer already has a stable, animated right-hand
 * socket (Atlas_WeaponSocket) and an authored tool backpack. Only replace
 * his visible pistol/shotgun; do not change his rig, UVs, animation tracks,
 * model scale, or any combat gameplay.
 *
 * Geometry and materials are reused by all pioneers, including placeholder
 * units in lite mode. Never dispose these shared resources per actor.
 */
let wrenchGeometry=null,gripGeometry=null,metalMaterial=null,gripMaterial=null;
function assets(){
 if(wrenchGeometry)return;
 // Open-ended repair spanner, one extruded silhouette (not a gun).
 const shape=new THREE.Shape();
 const outline=[
  [-.034,-.215],[.034,-.215],[.034,.09],[.087,.133],
  [.142,.153],[.161,.222],[.115,.247],[.081,.189],
  [.056,.171],[-.056,.171],[-.081,.189],[-.115,.247],
  [-.161,.222],[-.142,.153],[-.087,.133],[-.034,.09]
 ];
 shape.moveTo(...outline[0]);
 for(const [x,y] of outline.slice(1))shape.lineTo(x,y);
 shape.closePath();
 wrenchGeometry=new THREE.ExtrudeGeometry(shape,{
  depth:.032,steps:1,bevelEnabled:true,bevelSegments:1,
  bevelThickness:.004,bevelSize:.004,curveSegments:1
 });
 // A short rubberized grip remains visually subordinate to the steel head.
 gripGeometry=new THREE.BoxGeometry(.076,.105,.046);
 metalMaterial=new THREE.MeshStandardMaterial({
  color:'#adb3af',metalness:.72,roughness:.36
 });
 gripMaterial=new THREE.MeshStandardMaterial({
  color:'#353a37',metalness:.12,roughness:.8
 });
}

/** Returns the hand-held wrench object, if the requested model has a hand. */
export function equipEngineerWrench(model,{fallback=false}={}){
 if(!model)return null;
 if(model.userData.sandforgeUnarmedEngineer)
  return model.getObjectByName('Sandforge_Engineer_Wrench');
 assets();
 // These are the real animated GLB parents. Hiding only their render trees
 // avoids detaching animated bones or removing backpack/tool decorations.
 for(const name of ['Pistol','Shotgun','Atlas_Rifle']){
  const weapon=model.getObjectByName(name);
  if(weapon)weapon.visible=false;
 }
 const socket=fallback?model:model.getObjectByName('Atlas_WeaponSocket');
 if(!socket){
  console.warn('Sandforge engineer: authored right-hand weapon socket missing');
  return null;
 }
 const tool=new THREE.Group();
 tool.name='Sandforge_Engineer_Wrench';
 tool.userData.sandforgeRepairTool=true;
 const metal=new THREE.Mesh(wrenchGeometry,metalMaterial);
 metal.name='Repair_Wrench_Steel';
 const grip=new THREE.Mesh(gripGeometry,gripMaterial);
 grip.name='Repair_Wrench_Grip';
 grip.position.set(0,-.13,.018);
 tool.add(metal,grip);
 if(fallback){
  // Primitive placeholder coordinates are in world/game units, while GLB
  // coordinates are in character metres.
  tool.position.set(14,21,9);
  tool.scale.setScalar(22);
  tool.rotation.set(.12,0,.35);
 }else{
  // Hand socket follows the existing authored upper/lower-arm animation.
  // Centre the grip at the original pistol contact point.
  tool.position.set(-.045,.075,.025);
  tool.rotation.set(.18,0,.35);
 }
 tool.userData.restRotationZ=tool.rotation.z;
 socket.add(tool);
 model.userData.sandforgeUnarmedEngineer=true;
 return tool;
}

/** A tiny wrench turn when the simulation confirms active construction/repair. */
export function updateEngineerWrench(tool,working,time){
 if(!tool)return;
 const rest=tool.userData.restRotationZ??0;
 tool.rotation.z=rest+(working?Math.sin(time*12)*.18:0);
 tool.position.y=(tool.userData.restY??=tool.position.y)+
  (working?Math.sin(time*12)*.012:0);
}
