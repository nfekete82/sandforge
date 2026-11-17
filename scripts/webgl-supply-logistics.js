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
 cube(g,'SupplyCargoBed',42,5,48,wood,0,23,-16);
 // Open provisional flatbed, not a large black canvas box while GLB loads.
 for(const side of [-1,1])cube(g,'SupplySideRail'+side,3,13,46,khaki,side*20,30,-16);
 cube(g,'SupplyFrontRail',42,14,3,khaki,0,30,8);
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
 // Loader-independent fallback matches the authored 3D depot: open concrete,
 // full overhead visibility and eighteen separate pallets; no dark tarpaulin.
 const root=new THREE.Group();root.name='SF_Neutral_SupplyCache';
 root.userData={visualOnly:true,nonPlayable:true};
 const concrete=mat('#aaa99e'),concreteLight=mat('#c6c0b0');
 const curb=mat('#85867b'),hazard=mat('#ccaf6a');
 cube(root,'SF_DepotConcretePad',266,4,230,concrete,0,2,-42);
 cube(root,'SF_DepotConcreteTop',259,1,225,concreteLight,0,4.5,-42);
 for(const x of [-131,131])cube(root,'SF_DepotCurb_'+x,3,3,228,curb,x,5,-42);
 for(const z of [-155,72])cube(root,'SF_DepotCurb_'+z,262,3,3,curb,0,5,z);
 for(const x of [-24,24])cube(root,'SF_DepotLoadingLane'+x,2,.3,54,hazard,x,5.5,40);
 const piles=[];
 for(let i=0;i<18;i++){
  const row=Math.floor(i/6),col=i%6,side=col<3?-1:1,slot=col%3;
  const x=side*(46+slot*34),z=-114+row*58;
  const group=new THREE.Group();
  group.name='SF_DepotStock_'+String(i).padStart(2,'0');root.add(group);
  cube(group,'SupplyPallet',28,5,30,wood,x,9,z);
  cube(group,'SupplyCrate',24,18,24,i%3===0?khaki:sand,x,24,z);
  cube(group,'SupplyCrateTop',25,2,25,wood,x,34,z);
  for(const sideRail of [-1,1])cube(group,'SupplyCrateReinforcement',2,18,24,steel,
   x+sideRail*10.5,24,z);
  if(i%4===0)cube(group,'SupplyExtraCrate',22,16,22,khaki,x,45,z);
  piles.push(group);
 }
 root.userData.piles=piles;
 return root;
}
/** Low-profile concrete logistics yard. 18 crates remain readable from above
 * and disappear/return in lockstep with the server-authoritative stock. */
/** The depot slab stays on screen after the final crate is taken.
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

function supplyOperationProgress(job){
 if(job?.phase!=='loading'&&job?.phase!=='unloading')return null;
 const duration=job.phase==='loading'?2.4:1.4;
 return {mode:job.phase,fraction:Math.min(1,Math.max(0,(Number(job.clock)||0)/duration))};
}
// Shared billboarding assets: a single crate icon/text texture for every
// delivery truck. No DOM element, label texture or 3D geometry allocated
// on a hot frame; HUD only exists for active loading/unloading actors.
let supplyOperationSprites=null;
function supplyHudSkin(){
 if(supplyOperationSprites)return supplyOperationSprites;
 const labelMat=text=>{
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(17,31,28,.89)';
  ctx.beginPath();ctx.roundRect(6,7,372,82,16);ctx.fill();
  ctx.strokeStyle='rgba(115,225,174,.90)';ctx.lineWidth=4;ctx.stroke();
  // Compact 3D-looking crate glyph, readable at normal tactical zoom.
  ctx.fillStyle='#cda778';ctx.fillRect(29,27,43,39);
  ctx.fillStyle='#f0ce99';ctx.fillRect(29,24,43,10);
  ctx.fillStyle='#826744';ctx.fillRect(48,26,5,38);
  ctx.fillStyle='#e0f2dd';ctx.font='bold 37px sans-serif';ctx.textBaseline='middle';
  ctx.fillText(text,88,49);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  return new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,
   depthTest:false,toneMapped:false});
 };
 supplyOperationSprites={
  loading:labelMat('LÄDT KISTEN'),unloading:labelMat('ENTLÄDT'),
  bar:new THREE.SpriteMaterial({color:'#182922',transparent:true,opacity:.94,
   depthWrite:false,depthTest:false,toneMapped:false}),
  fill:new THREE.SpriteMaterial({color:'#79edb6',transparent:true,opacity:.97,
   depthWrite:false,depthTest:false,toneMapped:false})
 };
 return supplyOperationSprites;
}
/** Compact floating load-progress display above a truck, visible only while
 * it actually loads at a depot or unloads at a surviving friendly HQ.
 * Real job.clock, not frame time, drives its progress; paused matches freeze.
 */
export function updateSupplyLoadingIndicator(entry,job){
 const progress=supplyOperationProgress(job);
 if(!progress){
  if(entry?.supplyLoadingIndicator)entry.supplyLoadingIndicator.visible=false;
  return;
 }
 if(!entry?.node)return;
 let hud=entry.supplyLoadingIndicator;
 if(!hud){
  const materials=supplyHudSkin();
  hud=new THREE.Group();hud.name='SF_SupplyLoadingIndicator';
  hud.userData={visualOnly:true,nonPlayable:true};
  const label=new THREE.Sprite(materials.loading);
  label.name='SupplyLoadingLabel';label.position.y=13;
  label.scale.set(101,25,1);label.renderOrder=44;hud.add(label);
  const unload=new THREE.Sprite(materials.unloading);
  unload.name='SupplyUnloadingLabel';unload.position.y=13;
  unload.scale.set(101,25,1);unload.renderOrder=44;hud.add(unload);
  const bar=new THREE.Sprite(materials.bar);
  bar.position.y=-7;bar.scale.set(87,7,1);bar.renderOrder=44;hud.add(bar);
  const fill=new THREE.Sprite(materials.fill);
  fill.position.y=-7;fill.renderOrder=45;hud.add(fill);
  hud.userData={loading:label,unloading:unload,fill};
  entry.node.add(hud);entry.supplyLoadingIndicator=hud;
 }
 hud.visible=true;
 hud.position.set(0,Math.max(65,entry.modelHeight??65)+34,0);
 hud.userData.loading.visible=progress.mode==='loading';
 hud.userData.unloading.visible=progress.mode==='unloading';
 const width=Math.max(.001,83*progress.fraction);
 hud.userData.fill.scale.set(width,4.7,1);
 hud.userData.fill.position.x=-41.5+width*.5;
}
