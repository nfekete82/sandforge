import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {servicePaint,disposeServicePaint} from './webgl-service-materials.js';

// ONE open-air, drive-on service platform to the RIGHT of the authored
// OPEN vehicle factory. Its separate production hall now has no gate or door.
// No service-side garage, enclosing walls, roof, shutters or hidden tunnels.
// Decorative visuals only: gameplay, service point (192,45), lift altitude
// (9.5), collision and the paid repair system remain authoritative elsewhere.
const mat=(color,metalness=.18,roughness=.81)=>
 new THREE.MeshStandardMaterial({color,metalness,roughness});
function block(root,name,size,at,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
 mesh.name=name;mesh.position.set(...at);
 mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
 mesh.userData={visualOnly:true,nonPlayable:true};
 root.add(mesh);return mesh;
}

export function createFactoryServiceYard(){
 const root=new THREE.Group();
 root.name='FactoryOpenAirRepairPlatform';
 root.userData={visualOnly:true,nonPlayable:true,maintenance:true,openAirPlatform:true};
 const yellow=mat('#d7b36c'),dark=mat('#35413b'),steel=mat('#68736b',.47,.57);
 const sandConcrete=servicePaint(['#b9ab90','#a99d85','#c8b99c'],{
  pattern:'concrete',seed:39,repeat:3,roughness:.98
 });
 const deck=servicePaint(['#515d54','#6d796e','#8b9687'],{
  pattern:'metal',seed:19,repeat:3,metalness:.52,roughness:.63
 });
 const apron=servicePaint(['#b1a38a','#c7b69b','#9e957f'],{
  pattern:'concrete',seed:41,repeat:4,roughness:.98
 });
 const grip=servicePaint(['#6b776c','#849082','#4e5952'],{
  pattern:'metal',seed:18,repeat:2,metalness:.38,roughness:.74
 });
 const cx=192;
 // A compact apron (not a second garage or passage). The main-production
 // path remains on the existing open workshop GLB side of this separate slab.
 block(root,'FactoryVehicleRepairApron',[132,.8,184],[cx,.39,76],apron);
 block(root,'VehicleRepairBaySurface_0',[103,.24,116],[cx,1.02,57],sandConcrete);
 // Hydraulic service deck: top = 9.5, the EXACT value used by
 // FACTORY_LIFT_HEIGHT/serviceVisualGround on repaired/parked vehicles.
 block(root,'VehicleLiftPlatform_0',[92,3,91],[cx,8,45],deck);
 const ramp=block(root,'VehicleDriveOnRamp_0',[88,2,70],[cx,4.2,121],grip);
 ramp.rotation.x=.125;
 // The inclined ramp physically meets the 9.5 deck at its upper end and
 // naturally sinks into the low apron at its lower end.
 for(const z of [-26,-13,0,13,26])
  block(ramp,'RepairRampGrip_'+z,[79,.10,2],[0,1.05,z],steel);
 // Low-profile painted safety guides, not garage walls or pillars.
 for(const side of [-1,1]){
  block(root,'HydraulicVehicleLiftRail_0',[5,.45,75],[cx+side*33,9.73,45],steel);
  block(root,'VehiclePlatformSafetyStrip_0',[2,.08,87],[cx+side*44.3,9.56,45],yellow);
  // No pair of dark tyre stripes in front of the repair ramp: they looked
  // like permanent skid marks even when no vehicle had driven here.
  for(const z of [0,80])
   block(root,'FactoryPlatformEdgeMarker_0',[5,.45,8],[cx+side*48,9.72,z],yellow);
 }
 // Compact service instruments stay OUTSIDE the platform/vehicle lane.
 block(root,'FactoryRepairToolTray_0',[15,6,19],[cx+66,3.1,-12],deck);
 block(root,'FactoryRepairEquipmentPad_0',[21,.5,25],[cx+66,.75,-12],sandConcrete);
 // Low-poly logistics corner BEHIND the lift (negative Z), not on the
 // +Z drive-on ramp. These are visual-only props with no collision, targets
 // or effect on vehicle repair/exit trajectories.
 const supplies=new THREE.Group();
 supplies.name='FactoryRearRepairSupplies_0';
 supplies.userData={visualOnly:true,nonPlayable:true,decorativeSupplies:true};
 root.add(supplies);
 const crateWood=mat('#887855',.06,.94),crateTop=mat('#ae986d',.06,.9);
 const crateBand=mat('#655f48',.22,.79);
 const barrelOlive=mat('#65715c',.29,.68),barrelBlue=mat('#526969',.31,.64);
 const barrelRim=mat('#383f38',.42,.6);
 function crate(i,x,z,w,d,h){
  block(supplies,'FactoryRepairCrate_'+i,[w,h,d],[x,h/2,z],crateWood);
  block(supplies,'FactoryRepairCrateLid_'+i,[w+1.4,2,d+1.4],[x,h+1,z],crateTop);
  for(const side of [-1,1])
   block(supplies,'FactoryRepairCrateBrace_'+i+'_'+side,
    [2,h-.7,d+.7],[x+side*(w*.35),h/2,z],crateBand);
 }
 function barrel(i,x,z,paint){
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(6.3,6.3,17,12),
   paint);
  drum.name='FactoryRepairBarrel_'+i;
  drum.position.set(x,8.5,z);
  supplies.add(drum);
  for(const y of [2.2,14.7]){
   const rim=new THREE.Mesh(new THREE.CylinderGeometry(6.6,6.6,1.4,12),
    barrelRim);
   rim.name='FactoryRepairBarrelRim_'+i+'_'+y;
   rim.position.set(x,y,z);supplies.add(rim);
  }
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(5.6,5.6,.8,12),
   barrelRim);
  lid.name='FactoryRepairBarrelLid_'+i;
  lid.position.set(x,17.2,z);supplies.add(lid);
 }
 crate(0,cx-47,-29,19,16,14);
 crate(1,cx-24,-39,16,15,12);
 crate(2,cx-11,-23,13,12,10);
 barrel(0,cx+21,-30,barrelOlive);
 barrel(1,cx+35,-37,barrelBlue);
 barrel(2,cx+49,-28,barrelOlive);
 const indicator=block(root,'RepairStatusIndicator_0',[8,.7,8],[cx+54,1.8,113],yellow);
 indicator.visible=false;
 const glow=block(root,'VehicleWeldingFlash_0',[4,3.3,4],[cx+35,12.5,45],yellow);
 glow.visible=false;
 const icon=new THREE.Group();icon.name='FactoryRepairIcon_0';
 icon.position.set(cx,22,45);icon.visible=false;root.add(icon);
 const iconMat=new THREE.MeshBasicMaterial({
  color:'#95ffd0',transparent:true,opacity:.82,depthTest:false,depthWrite:false
 });
 const circle=new THREE.Mesh(new THREE.TorusGeometry(11,1.7,8,28),iconMat);
 circle.name='FactoryRepairCircle_0';circle.rotation.x=-Math.PI/2;circle.raycast=()=>{};
 icon.add(circle);
 block(icon,'FactoryRepairCrossHorizontal_0',[14,1.3,3],[0,0,0],iconMat);
 block(icon,'FactoryRepairCrossVertical_0',[3,1.3,14],[0,0,0],iconMat);
 const sparks=new THREE.Group();sparks.name='FactoryWeldingSparks_0';
 sparks.position.set(cx+25,16,42);sparks.visible=false;root.add(sparks);
 const sparkMat=new THREE.MeshBasicMaterial({
  color:'#ffe19a',transparent:true,opacity:.85,depthTest:false,depthWrite:false
 });
 for(let n=0;n<7;n++){
  const shard=new THREE.Mesh(new THREE.ConeGeometry(1.2,5+n%3*2,4),sparkMat);
  shard.position.set(Math.cos(n*2.4)*5,n%3*2,Math.sin(n*2.4)*5);
  shard.raycast=()=>{};sparks.add(shard);
 }
 root.userData.bay0={indicator,glow,icon,sparks};
 root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.raycast=()=>{};}});
 return root;
}
export function updateFactoryServiceYard(entry,base,units,time){
 const yard=entry.factoryServiceYard;if(!yard)return;
 const state=yard.userData.bay0;
 const vehicle=units.find(u=>u.hp>0&&u.factoryService?.baseId===base.id&&
  (u.factoryService?.bay===0||u.factoryService?.bay===1));
 state.indicator.visible=Boolean(vehicle);
 const phase=vehicle?.factoryService?.phase;
 const repairing=phase==='repair';
 state.glow.visible=repairing&&Math.sin(time*20)>-.2;
 state.icon.visible=repairing||phase==='ready';
 state.sparks.visible=repairing;
 if(state.icon.visible){
  state.icon.position.y=22+Math.sin(time*3)*2;
  state.icon.rotation.y=time*.32;
 }
 if(repairing){
  state.sparks.rotation.y=time*5;
  state.sparks.children.forEach((spark,n)=>{
   spark.visible=Math.sin(time*29+n*3.1)>.05;
   spark.position.y=(n%3)*2+Math.max(0,Math.sin(time*12+n*1.9))*5;
  });
 }
 if(state.indicator.visible)state.indicator.scale.y=1+.18*Math.sin(time*4);
}
export function disposeFactoryServiceYard(entry){
 const group=entry?.factoryServiceYard;
 if(!group)return;
 group.removeFromParent();disposeServicePaint(group);disposeOwnedMeshes(group);
 entry.factoryServiceYard=null;
}
