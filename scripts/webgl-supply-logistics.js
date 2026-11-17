import * as THREE from 'three';

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
/** Show visible stock depletion without modifying authoritative World geometry. */
export function updateSupplyCacheVisual(root,cache){
 const fraction=Math.max(0,Math.min(1,cache.remaining/Math.max(1,cache.capacity)));
 root.visible=cache.remaining>0;
 const piles=root.userData.piles??[];
 piles.forEach((m,i)=>{m.visible=i<Math.ceil(fraction*piles.length)});
}
export function setSupplyTruckCargo(root,loaded){
 const cargo=root?.userData?.cargoGroup;
 if(cargo)cargo.visible=loaded;
}
