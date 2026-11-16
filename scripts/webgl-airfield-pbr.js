import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Rendering-only swap: the actual runway, taxi/landing path, serviced aircraft,
// fuel props, crew animations and one-bay game rules are never touched.
const assetCache=new Map();
const legacyHangar=/^(?:Hangar(?:Bay|Camo|Vertical|Roof|Side|Rear|Entry|Door|Center|Apron|Recessed|Hazard|Maintenance|Safety|Security|Angled|Service|Repair|Fuel)|AirfieldLeftControlTower)/;
const keepGround=/^(?:HangarCenterGuide|HangarApronStop|HangarSafetyChevron|HangarRepairSparks|HangarSecurityLamp)/;
export const AIRFIELD_PBR_REVISION='sandforge-airfield-pbr-v1-20261116';

function assetFor(owner){
 if(owner!==0&&owner!==1)return null;
 if(!assetCache.has(owner)){
  const url='/src/assets/reborn/buildings-3d/airfield-'+owner+'.glb';
  assetCache.set(owner,new GLTFLoader().loadAsync(url).catch(error=>{
   assetCache.delete(owner);
   throw error;
  }));
 }
 return assetCache.get(owner);
}
function styleGhost(model){
 const mats=new Set();
 model.traverse(node=>{
  if(!node.isMesh)return;
  // Never alter shared imported glTF material instances, also when the
  // construction preview disappears during a pending network request.
  const copy=m=>{const c=m.clone();c.transparent=true;c.opacity=.48;
   c.depthWrite=false;mats.add(c);return c;};
  node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
 });
 model.userData.airfieldGhostMaterials=mats;
}
function releaseGhost(model){
 for(const m of model?.userData?.airfieldGhostMaterials||[])m.dispose();
 model?.userData?.airfieldGhostMaterials?.clear();
}
/** Return immediately: the original hangar is displayed while a PBR GLB
 * downloads. No incomplete geometry or missing door is visible mid-load.
 * The owner's static and animated model swap together in one microtask. */
export function ensureAirfieldPbr(group,owner=0,{ghost=false}={}){
 if(!group||group.userData.airfieldPbrDisposed||owner!==0&&owner!==1)
  return Promise.resolve(false);
 if(group.userData.airfieldPbrOwner===owner&&group.userData.airfieldPbrModel)
  return Promise.resolve(true);
 if(group.userData.airfieldPbrPendingOwner===owner)
  return group.userData.airfieldPbrPromise??Promise.resolve(false);
 const token=(group.userData.airfieldPbrToken||0)+1;
 group.userData.airfieldPbrToken=token;
 group.userData.airfieldPbrPendingOwner=owner;
 const pending=assetFor(owner).then(data=>{
  if(group.userData.airfieldPbrDisposed||group.userData.airfieldPbrToken!==token)
   return false;
  const model=data.scene.clone(true);
  const left=model.getObjectByName('HangarDoorLeft_0');
  const right=model.getObjectByName('HangarDoorRight_0');
  const roof=model.getObjectByName('SF_Airfield_PBR_roof');
  if(!left?.isMesh||!right?.isMesh||!roof?.isMesh)
   throw new Error('Airfield PBR missing animated shutters / roof');
  model.name='SandforgeAirfieldPBR_'+owner;
  model.userData.sandforgeOriginalPBR=true;
  if(ghost)styleGhost(model);
  const gate=group.userData.bay0;
  // Preserve old door references to restore them on teardown or older saves.
  if(gate&&!group.userData.airfieldLegacyDoors)
   group.userData.airfieldLegacyDoors={left:gate.left,right:gate.right};
  const old=group.userData.airfieldPbrModel;
  if(old){old.removeFromParent();releaseGhost(old);}
  group.add(model);
  group.userData.airfieldPbrModel=model;
  group.userData.airfieldPbrOwner=owner;
  if(!group.userData.airfieldHiddenLegacy){
   group.userData.airfieldHiddenLegacy=[];
   for(const child of group.children){
    if(!child.isMesh||!legacyHangar.test(child.name)||
     keepGround.test(child.name))continue;
    if(child.visible){
     group.userData.airfieldHiddenLegacy.push(child);
     child.visible=false;
    }
   }
  }
  // Only a single pair of doors participates in the existing animation.
  if(gate){
   gate.left=left;gate.right=right;
   gate.open=Math.max(0,Math.min(1,gate.open));
   left.position.x=gate.cx-27-28*gate.open;
   right.position.x=gate.cx+27+28*gate.open;
   left.scale.y=right.scale.y=1-.94*gate.open;
   left.position.y=right.position.y=36+42*gate.open;
  }
  return true;
 }).catch(error=>{
  if(group.userData.airfieldPbrToken===token&&!group.userData.airfieldPbrDisposed)
   console.warn('Airfield PBR: legacy 3D hangar remains available',error);
  return false;
 }).finally(()=>{
  if(group.userData.airfieldPbrToken===token)
   group.userData.airfieldPbrPendingOwner=null;
 });
 group.userData.airfieldPbrPromise=pending;
 return pending;
}
/** The cached glTF stays alive for other buildings. Do not let the generic
 * yard disposer destroy its shared geometry, texture maps or materials. */
export function detachAirfieldPbr(group){
 if(!group)return;
 group.userData.airfieldPbrDisposed=true;
 group.userData.airfieldPbrToken=(group.userData.airfieldPbrToken||0)+1;
 const model=group.userData.airfieldPbrModel;
 if(model){model.removeFromParent();releaseGhost(model);}
 group.userData.airfieldPbrModel=null;
 const gate=group.userData.bay0,old=group.userData.airfieldLegacyDoors;
 if(gate&&old){gate.left=old.left;gate.right=old.right;}
 for(const child of group.userData.airfieldHiddenLegacy||[])child.visible=true;
 group.userData.airfieldHiddenLegacy=null;
}
