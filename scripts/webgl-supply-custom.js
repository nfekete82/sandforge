import * as THREE from 'three';

/** The uploaded, deterministic Sandforge 6×6 GLB is Z-up / +Y-forward.
 * This adapter changes only visual placement, not physics/collision or economy.
 * Authored cargo_stack_0..7 and wheel_FRONT/MID/REAR_L/R pivots stay independent.
 */
export const customSupplyTruckUrl=owner=>'/src/assets/reborn/supply-custom/supply-'+owner+'.glb';
export const isCustomSupplyTruck=root=>Boolean(root?.getObjectByName?.('wheel_FRONT_L'));

export function prepareCustomSupplyTruck(root,owner){
 if(!isCustomSupplyTruck(root))return false;
 // glTF was exported Z-up. Three.js actors are Y-up with local +Z forward.
 root.rotation.set(-Math.PI/2,Math.PI,0,'YXZ');
 // The uploaded GLB accidentally writes 1/255 into the RGB *and alpha*
 // baseColorFactor of its two baked textures. Three.js multiplies texture
 // pixels by that tiny factor: all beige camouflage and wooden crates render
 // almost black or vanish. Keep the original image maps, restore white tint.
 // Clone materials per actor: blue/red factions must never share mutations.
 const materialCopies=new Map();
 const fixMaterial=source=>{
  if(materialCopies.has(source))return materialCopies.get(source);
  const mat=source.clone();
  if(['Desert_Camouflage_PBR','Wooden_Crate_PBR'].includes(mat.name)){
   mat.color.setRGB(1,1,1);
   mat.opacity=1;
   mat.transparent=false;mat.alphaTest=0;mat.depthWrite=true;
   mat.roughness=mat.name==='Wooden_Crate_PBR'?.94:.83;
   mat.metalness=mat.name==='Wooden_Crate_PBR'?0:.12;
  }else if(mat.name==='Blackened_Chassis'){
   mat.color.set('#5b5b4d');mat.metalness=.40;
  }else if(mat.name==='Steel_Bars'){
   mat.color.set('#777968');mat.metalness=.45;
  }else if(mat.name==='Painted_Sand_Steel'){
   mat.color.set('#d4be94');mat.metalness=.19;
  }
  mat.needsUpdate=true;materialCopies.set(source,mat);return mat;
 };
 root.traverse(child=>{
  if(!child.isMesh)return;
  child.material=Array.isArray(child.material)?
   child.material.map(fixMaterial):fixMaterial(child.material);
 });
 // Real wheel pivots are authored as matrices: radius .70, Z-up.
 // Downsize the tyre assemblies, lower their centres to maintain ground
 // contact and open the rear axle spacing. Geometry and tyre tread stay PBR.
 for(const axle of ['FRONT','MID','REAR'])for(const side of ['L','R']){
  const wheel=root.getObjectByName('wheel_'+axle+'_'+side);
  if(!wheel)continue;
  wheel.scale.setScalar(.87);
  wheel.position.z=.70*.87;
  if(axle==='MID')wheel.position.y=-1.43;
  if(axle==='REAR')wheel.position.y=-3.13;
 }
 const paint=new THREE.MeshStandardMaterial({
  color:owner===0?'#367eac':'#a64e43',roughness:.68,metalness:.23
 });
 for(const side of [-1,1]){
  // Narrow painted identification bands on the real cargo sidewalls.
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.035,.82,.13),paint);
  stripe.position.set(side*1.305,-1.5,2.06);
  stripe.name='SF_Supply_FactionSideStripe_'+side;
  stripe.castShadow=false;stripe.receiveShadow=true;
  root.add(stripe);
 }
 root.userData.sandforgeOriginalPBR=true;
 root.userData.supplyTruckImported=true;
 return true;
}

/** One physical cargo stack per eighth of the authoritative 45-credit load.
 * Loading and unloading use the simulation's clock, never frame delta.
 * Once the simulation deposits credits, phase='seek' and cargo=0: ALL
 * containers stay hidden until the next actual pickup.
 */
export function supplyVisibleCrateCount(job,slots=8){
 const total=Math.max(0,Math.floor(Number(slots)||0));
 if(!total)return 0;
 const cargo=Math.max(0,Math.min(45,Number(job?.cargo)||0));
 const clock=Math.max(0,Number(job?.clock)||0);
 const phase=job?.phase;
 // No cargo in the actual economy means a genuinely empty truck.
 // The one exception is active loading, which fills the bed progressively.
 if(!cargo&&phase!=='loading')return 0;
 const portion=phase==='loading'?Math.min(1,clock/2.4):
  phase==='unloading'?Math.max(0,1-clock/1.4)*cargo/45:
  cargo/45;
 return Math.max(0,Math.min(total,Math.ceil(total*portion-1e-7)));
}
export function setCustomSupplyCargo(root,job){
 if(!isCustomSupplyTruck(root))return false;
 const stacks=root.userData.supplyCrates??(root.userData.supplyCrates=
  Array.from({length:8},(_,i)=>root.getObjectByName('cargo_stack_'+i)).filter(Boolean));
 if(stacks.length!==8){
  // Unknown GLB layout: let the generic supply handler take over rather
  // than silently claiming to hide cargo that cannot actually be found.
  return false;
 }
 const count=supplyVisibleCrateCount(job,stacks.length);
 if(root.userData.supplyVisibleCrates!==count){
  stacks.forEach((stack,i)=>{stack.visible=i<count;});
  root.userData.supplyVisibleCrates=count;
 }
 return true;
}

export function animateCustomSupplyTruck(root,entry,travel,dt,active,phase){
 if(!isCustomSupplyTruck(root))return false;
 const wheels=entry.supplyCustomRoot===root?entry.supplyCustomWheels:(()=>{
  entry.supplyCustomRoot=root;
  return entry.supplyCustomWheels=['FRONT','MID','REAR'].flatMap(axle=>
   ['L','R'].map(side=>root.getObjectByName('wheel_'+axle+'_'+side))).filter(Boolean);
 })();
 if(active&&Number.isFinite(travel)&&travel>.03&&travel<80){
  const diameter=entry.modelFootprint||76;
  const scale=diameter/7.815;
  const radius=Math.max(1,.70*.87*scale);
  for(const wheel of wheels)wheel.rotation.x-=travel/radius;
 }
 // A pair of tiny physical amber loading lamps, not hovering HUD badges.
 let lamps=root.userData.supplyLoadingLamps;
 if(!lamps){
  lamps=new THREE.Group();lamps.name='SF_Supply_LoadingLights';
  const lens=new THREE.MeshStandardMaterial({
   color:'#efaa38',emissive:'#ff7f12',emissiveIntensity:1.8,
   roughness:.35,metalness:.10
  });
  for(const side of [-1,1]){
   const led=new THREE.Mesh(new THREE.BoxGeometry(.12,.13,.10),lens);
   led.position.set(side*1.05,.52,2.55);lamps.add(led);
  }
  root.add(lamps);root.userData.supplyLoadingLamps=lamps;
 }
 lamps.visible=phase==='loading'||phase==='unloading';
 return true;
}
