import * as THREE from 'three';
import {setCustomSupplyCargo,animateCustomSupplyTruck} from './webgl-supply-custom.js';

/** Lightweight, wholly authored and self-contained Sandforge logistics art.
 * No external GLB, atlas, texture fetch or runtime geometry creation per frame.
 * All meshes are non-interactive visual dressing; the Simulation remains
 * authoritative for position, stock, credits, pathing and ownership.
 */
const mat=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:metalness?.77:.94,metalness});
const sand=mat('#b6a181'),khaki=mat('#837c62'),canvas=mat('#9a9272'),
 steel=mat('#343e3a',.14),rubber=mat('#292b29'),wood=mat('#726247'),stripe=mat('#d6c495');
function mesh(parent,name,geometry,material,x=0,y=0,z=0){
 const m=new THREE.Mesh(geometry,material);
 m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;
 m.userData={visualOnly:true,nonPlayable:true,supplyLogistics:true};
 m.raycast=()=>{};
 parent.add(m);return m;
}
const cube=(g,n,w,h,d,m,x,y,z)=>mesh(g,n,new THREE.BoxGeometry(w,h,d),m,x,y,z);
const cyl=(g,n,r1,r2,h,segments,m,x,y,z)=>mesh(g,n,
 new THREE.CylinderGeometry(r1,r2,h,segments),m,x,y,z);
/** A recognisable six-wheel covered field truck, rather than an armed Humvee.
 * Faction stripe is surface paint, never an artificial glowing flag.
 */
export function createSupplyTruckVisual(owner){
 const g=new THREE.Group();g.name='SF_SupplyTruck';
 g.userData={visualOnly:true,nonPlayable:true};
 const faction=mat(owner===0?'#29667b':'#8e4a3c');
 const cab=mat(owner===0?'#b5a78a':'#a89a7d');
 cube(g,'SupplyChassis',37,7,74,steel,0,13,0);
 cube(g,'SupplyCab',37,23,24,cab,0,27,24);
 cube(g,'SupplyWindscreen',30,11,2,steel,0,33,37);
 cube(g,'SupplyBonnet',37,13,15,cab,0,23,42);
 cube(g,'SupplyCargoBed',40,10,44,wood,0,23,-16);
 cube(g,'SupplyCanvasCover',42,20,43,canvas,0,37,-16);
 cube(g,'SupplyCargoTop',44,4,47,khaki,0,48,-16);
 for(const side of [-1,1]){
  cube(g,'SupplyTeamStripe'+side,2,6,42,faction,side*21,37,-16);
  for(const z of [-28,1,30]){
   const wheel=cyl(g,'SupplyWheel'+side+z,10,10,7,12,rubber,side*23,10,z);
   wheel.rotation.z=Math.PI/2;
   cyl(g,'SupplyHub'+side+z,4,4,7.5,10,steel,side*23,10,z).rotation.z=Math.PI/2;
  }
  cube(g,'SupplyMirror'+side,5,8,2,steel,side*22,34,31);
 }
 const cargo=new THREE.Group();cargo.name='SF_Supply_Cargo';
 cargo.position.set(0,5,-16);g.add(cargo);
 for(const x of [-10,10])for(const z of [-11,11])
  cube(cargo,'Supplies_LoadedCrate',16,15,17,sand,x,51,z);
 cargo.visible=false;
 g.userData.cargoGroup=cargo;
 return g;
}
export function createSupplyCacheVisual(){
 const root=new THREE.Group();root.name='SF_Neutral_SupplyCache';
 root.userData={visualOnly:true,nonPlayable:true};
 const ring=mesh(root,'SF_SupplyLocationMark',
  new THREE.RingGeometry(53,56,40),
  new THREE.MeshBasicMaterial({color:'#dec995',transparent:true,opacity:.48,depthWrite:false,side:THREE.DoubleSide}),0,1.3,0);
 ring.rotation.x=-Math.PI/2;
 // Two side-loaded containers + pallets, sand-coloured tarp and crates.
 cube(root,'SF_DepotPalletA',75,5,43,wood,-24,4,0);
 cube(root,'SF_DepotPalletB',75,5,43,wood,35,4,26);
 for(const [i,x,z] of [[0,-49,-8],[1,-4,-10],[2,26,26],[3,59,27],[4,-49,23],[5,58,-9]]){
  const block=cube(root,'SF_DepotCrate_'+i,35,23,32,i%2?khaki:sand,x,18,z);
  block.rotation.y=(i%3-1)*.17;
  cube(root,'SF_DepotLid_'+i,36,4,33,wood,x,31,z);
  for(const side of [-1,1])
   cube(root,'SF_DepotMetalBand_'+i+'_'+side,3,21,33,steel,x+side*14,19,z);
 }
 const canopy=cube(root,'SF_DepotTarpaulin',108,4,72,canvas,4,48,4);
 canopy.rotation.z=-.035;
 for(const x of [-46,46])for(const z of [-26,34])
  cyl(root,'SF_DepotStrut'+x+z,2,2,48,6,steel,x,24,z);
 const sign=cube(root,'SF_DepotSupplyMark',33,18,3,stripe,-2,62,4);
 sign.name='SF_SupplySource_NotAFactionBuilding';
 const piles=root.children.filter(n=>n.name.startsWith('SF_DepotCrate'));
 root.userData.piles=piles;
 return root;
}
/** The authored warehouse stays on screen after the final crate is taken.
 * Its eighteen large pallet groups disappear with decreasing stock and
 * return as the neutral depot automatically refills.
 */
export function updateSupplyCacheVisual(root,cache,{time=0,loading=false}={}){
 const fraction=Math.max(0,Math.min(1,cache.remaining/Math.max(1,cache.capacity)));
 const model=root?.userData?.pbrModel??root;
 // GLTF group lookups happen once per cloned depot, not 18 scene-tree
 // traversals per render frame (six sites can remain on screen for hours).
 const stocks=model.userData.supplyStockGroups??(model.userData.supplyStockGroups=
  Array.from({length:18},(_,i)=>
   model.getObjectByName?.('SF_DepotStock_'+String(i).padStart(2,'0'))).filter(Boolean));
 if(stocks.length===18){
  const count=Math.ceil(stocks.length*fraction);
  if(root.userData.lastStockModel!==model||root.userData.lastStockCount!==count){
   stocks.forEach((stock,i)=>{stock.visible=i<count;});
   root.userData.lastStockModel=model;root.userData.lastStockCount=count;
  }
  const ramp=model.getObjectByName('SF_DepotLoadingRamp');
  if(ramp)ramp.rotation.x+=((loading?-.45:0)-ramp.rotation.x)*.12;
  const beacon=model.getObjectByName('SF_Depot_LoadBeacon');
  if(beacon)beacon.scale.y=1+.12*Math.sin(time*2.2);
 }else{
  const fallback=root?.userData?.fallback??root;
  const piles=fallback?.userData?.piles??[];
  piles.forEach((m,i)=>{m.visible=i<Math.ceil(fraction*piles.length)});
 }
 root.visible=true;
}
export function setSupplyTruckCargo(root,job){
 if(setCustomSupplyCargo(root,job))return;
 const loaded=typeof job==='object'?Boolean(job?.cargo):Boolean(job);
 let cargo=root?.userData?.cargoGroup;
 if(!cargo&&root?.getObjectByName){
  cargo=root.getObjectByName('SF_Supply_Cargo');
  if(cargo)root.userData.cargoGroup=cargo;
 }
 if(cargo&&cargo.visible!==Boolean(loaded))cargo.visible=Boolean(loaded);
}
/** Actual 20 Hz physical movement, not free-running mixer clips, drives all
 * 6 truck wheels. Opening the large rear doors follows loading/unloading
 * state. Preview GLB clips remain available for Blender/asset inspection.
 */
export function animateSupplyTruckRig(root,unit,entry,travel,time,dt,active){
 if(!root?.getObjectByName)return;
 if(animateCustomSupplyTruck(root,entry,travel,dt,active,unit.supply?.phase))return;
 const rig=entry.supplyRigModel===root?entry.supplyRig:(()=>{
  entry.supplyRigModel=root;
  return entry.supplyRig={
   wheels:['L','R'].flatMap(side=>[0,1,2].map(i=>
    root.getObjectByName('SF_Supply_Wheel_'+side+'_'+i))).filter(Boolean),
   doors:[root.getObjectByName('SF_Supply_CargoDoor_L'),
    root.getObjectByName('SF_Supply_CargoDoor_R')]
  };
 })();
 if(entry.supplyVisualTime!==time){
  entry.supplyVisualTime=time;
  if(active&&Number.isFinite(travel)&&travel>.03&&travel<80){
   for(const wheel of rig.wheels)wheel.rotation.x-=travel/14.5;
  }
 }
 const opening=['loading','unloading'].includes(unit.supply?.phase);
 const step=Math.min(1,Math.max(0,dt)*4.5);
 rig.doors.forEach((door,i)=>{
  if(door)door.rotation.y+=((opening?1.10:0)*(i===0?1:-1)-door.rotation.y)*step;
 });
}
