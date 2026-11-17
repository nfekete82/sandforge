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

export function setCustomSupplyCargo(root,job){
 if(!isCustomSupplyTruck(root))return false;
 const stacks=root.userData.supplyCrates??(root.userData.supplyCrates=
  Array.from({length:8},(_,i)=>root.getObjectByName('cargo_stack_'+i)).filter(Boolean));
 const phase=job?.phase;
 const value=Math.max(0,Math.min(45,Number(job?.cargo)||0));
 const progress=phase==='loading'?Math.min(1,(Number(job?.clock)||0)/2.4):
  phase==='unloading'?Math.max(0,1-(Number(job?.clock)||0)/1.4):value/45;
 const count=Math.max(0,Math.min(stacks.length,Math.ceil(stacks.length*progress-1e-6)));
 stacks.forEach((node,i)=>{node.visible=i<count;});
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
  const radius=Math.max(1,.70*scale);
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
