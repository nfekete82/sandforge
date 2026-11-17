import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyAirfieldRollup,AIRFIELD_ROLLUP_SLATS} from './webgl-airfield-rollup.js';
import {finishDesertBuildingMaterials} from './webgl-building-pbr.js';

// Rendering-only swap: the actual runway, taxi/landing path, serviced aircraft,
// fuel props, crew animations and one-bay game rules are never touched.
const assetCache=new Map();
const legacyHangar=/^(?:Hangar(?:Bay|Camo|Vertical|Roof|Side|Rear|Entry|Door|Center|Apron|Recessed|Hazard|Maintenance|Safety|Security|Angled|Service|Repair|Fuel)|AirfieldLeftControlTower)/;
const keepGround=/^(?:HangarCenterGuide|HangarApronStop|HangarSafetyChevron|HangarRepairSparks|HangarSecurityLamp)/;
export const AIRFIELD_PBR_REVISION='sandforge-airfield-pbr-v2-rollup-satellite-20261116';

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
   c.depthWrite=false;
   c.userData={...c.userData,sandforgePreviewMaterial:true};
   mats.add(c);return c;};
  node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material);
 });
 model.userData.airfieldGhostMaterials=mats;
}
function releaseGhost(model){
 for(const m of model?.userData?.airfieldGhostMaterials||[])m.dispose();
 model?.userData?.airfieldGhostMaterials?.clear();
 // The finished hangar clones only its wall material for the shared
 // barracks paint. Dispose that instance, never the cached source GLB/maps.
 const owned=new Set();
 model?.traverse?.(mesh=>{
  if(!mesh.isMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  for(const material of materials){
   if(material?.userData?.sandforgeBuildingPBROwned)owned.add(material);
  }
 });
 for(const material of owned)material.dispose();
}
/** Return immediately: the original hangar is displayed while a PBR GLB
 * downloads. No incomplete geometry or missing door is visible mid-load.
 * The owner's static and animated model swap together in one microtask. */
export function ensureAirfieldPbr(group,owner=0,{ghost=false}={}){
 if(!group||group.userData.airfieldPbrDisposed||owner!==0&&owner!==1)
  return Promise.resolve(false);
 // Node/unit tests render the legacy yard without a browser asset server.
 if(typeof window==='undefined')return Promise.resolve(false);
 // Missing local asset? Keep the old hangar without retrying/flooding logs
 // every frame. A fresh page load can retry after a corrected build.
 if(group.userData.airfieldPbrFailedOwner===owner)return Promise.resolve(false);
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
  const slats=Array.from({length:AIRFIELD_ROLLUP_SLATS},(_,i)=>
   model.getObjectByName('HangarRollupSlat_0_'+String(i).padStart(2,'0')));
  const drum=model.getObjectByName('HangarRollupDrum_0');
  const rotor=model.getObjectByName('AirfieldTowerDishRotor');
  const roof=model.getObjectByName('SF_Airfield_PBR_roof');
  if(slats.some(s=>!s?.isMesh)||!drum?.isMesh||!rotor||!roof?.isMesh)
   throw new Error('Airfield PBR missing roll-up slats, roof or satellite rotor');
  model.name='SandforgeAirfieldPBR_'+owner;
  model.userData.sandforgeOriginalPBR=true;
  model.traverse(node=>{
   if(node.isMesh){
    node.receiveShadow=true;
    node.castShadow=/^SF_Airfield_PBR_(?:camo|roof|stone)$/.test(node.name);
   }
  });
  if(ghost)styleGhost(model);
  // Three.js does not copy onBeforeCompile in Material.clone(). Apply the
  // wall texture AFTER making ghost materials so the construction preview
  // renders identical camouflage without leaking owned resources.
  finishDesertBuildingMaterials(model,'airfield');
  const gate=group.userData.bay0;
  // Preserve fallback shutters until the entire replacement GLB is loaded.
  if(gate&&!group.userData.airfieldLegacyDoors)
   group.userData.airfieldLegacyDoors={
    left:gate.left,right:gate.right,slats:gate.slats,drum:gate.drum
   };
  const old=group.userData.airfieldPbrModel;
  if(old){old.removeFromParent();releaseGhost(old);}
  group.add(model);
  group.userData.airfieldPbrModel=model;
  group.userData.airfieldPbrOwner=owner;
  group.userData.airfieldPbrFailedOwner=null;
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
  // One vertically rolling curtain; the original two halves are hidden
  // together with legacy hangar meshes once the GLB is ready.
  if(gate){
   gate.slats=slats;gate.drum=drum;
   applyAirfieldRollup(gate,gate.open);
  }
  group.userData.airfieldDishRotor=rotor;
  return true;
 }).catch(error=>{
  if(group.userData.airfieldPbrToken===token&&!group.userData.airfieldPbrDisposed){
   group.userData.airfieldPbrFailedOwner=owner;
   console.warn('Airfield PBR: legacy 3D hangar remains available',error);
  }
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
 if(gate&&old){
  gate.left=old.left;gate.right=old.right;
  gate.slats=old.slats??null;gate.drum=old.drum??null;
 }
 group.userData.airfieldDishRotor=null;
 for(const child of group.userData.airfieldHiddenLegacy||[])child.visible=true;
 group.userData.airfieldHiddenLegacy=null;
}
