import * as THREE from 'three';
import {disposeOwnedMeshes} from './webgl-resource-lifecycle.js';
import {barracksPropMaterial} from './webgl-barracks-prop-materials.js';

// Decorative props live next to authored buildings, independently of glTF
// loading and without altering building collision, navigation or saves.
const mat=(color,metalness=0,roughness=.82)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const rubber=mat('#252b29'),tread=mat('#525953',.38),steel=mat('#677471',.57,.52);
const wood=mat('#625b47'),sand=mat('#b9a77a'),olive=mat('#66735d'),dark=mat('#283335',.35);
function mesh(parent,name,geometry,material,x,y,z){
 const o=new THREE.Mesh(geometry,material);
 o.name=name;o.position.set(x,y,z);
 o.castShadow=true;o.receiveShadow=true;
 parent.add(o);return o;
}
function box(parent,name,size,material,x,y,z){
 return mesh(parent,name,new THREE.BoxGeometry(...size),material,x,y,z);
}
function wheel(parent,x,z,n){
 for(let i=0;i<n;i++){
  const w=mesh(parent,'SpareTyre',new THREE.TorusGeometry(10,3.2,9,24),
   rubber,x,5.5+i*5.8,z);
  w.rotation.x=-Math.PI/2;
  mesh(parent,'WheelHub',new THREE.CylinderGeometry(4,4,1.3,12),
   steel,x,5.5+i*5.8,z);
 }
}
// All infantry yard props already inherit the 0.48 building-yard scale.
// Scaling helmet and rifle assemblies a second time made them ~0.264 of
// the authored dimensions, smaller than the soldiers' head and weapon.
export const INFANTRY_YARD_PROP_SCALE=1;
function helmet(parent,x,z){
 const g=new THREE.Group();
 g.name='InfantryHelmetAssembly';g.position.set(x,14,z);
 g.scale.setScalar(INFANTRY_YARD_PROP_SCALE);parent.add(g);
 const shell=mesh(g,'InfantryHelmet',new THREE.SphereGeometry(
  9,16,9,0,Math.PI*2,0,Math.PI*.55),olive,0,4.8,0);
 shell.rotation.y=.2;
 const brim=mesh(g,'HelmetRim',new THREE.CylinderGeometry(9.5,9.5,1.8,16),
  dark,0,0,0);
 brim.rotation.y=.15;
}
function rifle(parent,x,z){
 const g=new THREE.Group();
 g.name='InfantryWeaponRackRifle';g.position.set(x,13,z);g.rotation.y=-.28;
 g.scale.setScalar(INFANTRY_YARD_PROP_SCALE);parent.add(g);
 box(g,'RifleReceiver',[4.6,4.3,14],dark,0,0,0);
 box(g,'RifleBarrel',[2.0,2.0,28],steel,0,0,19);
 box(g,'RifleStock',[5,3.8,11],wood,0,0,-12);
 box(g,'RifleMagazine',[3,9,4],steel,0,-6,0);
 box(g,'RifleSight',[2,3,4],steel,0,4,3);
}
/** Site decoration remains purely visual; there are deliberate openings along
 * the front (+Z) for engineers, infantry, factories and aircraft. Nothing here
 * enters the simulation's collision, terrain, build validation or save format. */
export const YARD_DECOR_KINDS=Object.freeze([
 'headquarters','barracks','factory','research','silo','interceptor',
 'generator'
]);
const fencedSites=new Set([
 'headquarters','barracks','factory','research','silo','interceptor'
]);
const fencePost=mat('#716d58',.22,.72);
const fenceRail=mat('#99967b',.34,.64);
const lampGlass=new THREE.MeshStandardMaterial({
 color:'#d7e8da',emissive:'#b3e5df',emissiveIntensity:.72,
 metalness:.08,roughness:.4
});
const crateBand=mat('#998b6a',.22,.77);
const barrelPaint=mat('#606f67',.27,.7);

function storageCrate(group,x,z,size=16,paint=olive){
 const g=new THREE.Group();g.name='SupplyCrate';g.position.set(x,0,z);group.add(g);
 box(g,'CrateBody',[size,size*.73,size*.84],paint,0,size*.365,0);
 box(g,'CrateLid',[size+2,2,size*.88],wood,0,size*.78,0);
 for(const side of [-1,1])
  box(g,'CrateBand',[2,size*.76,size*.88+1],crateBand,side*size*.33,size*.4,0);
 return g;
}
function supplyBarrel(group,x,z){
 const g=new THREE.Group();g.name='SupplyBarrel';g.position.set(x,0,z);group.add(g);
 mesh(g,'BarrelShell',new THREE.CylinderGeometry(6.4,6.4,17,10),barrelPaint,0,8.5,0);
 for(const height of [2.5,14.5])
  mesh(g,'BarrelBand',new THREE.CylinderGeometry(6.7,6.7,1.3,10),fenceRail,0,height,0);
 box(g,'BarrelCap',[8,1.2,8],dark,0,17.7,0);
}
function securityLamp(group,x,z,height=53){
 const g=new THREE.Group();g.name='SecurityLamp';g.position.set(x,0,z);
 // LampArm and LampHead project along the lamp's local +X axis.
 // At the LEFT side of the command centre that previously pointed back
 // into the facade; face the head and diffuser away from the wall instead.
 // The opposite/right perimeter lamp already points outward along +X.
 g.rotation.y=x<0?Math.PI:0;
 g.userData={visualOnly:true,nonPlayable:true,securityLamp:true,
  facesOutward:true};
 group.add(g);
 box(g,'LampFoot',[11,2.5,11],steel,0,1.25,0);
 mesh(g,'LampPost',new THREE.CylinderGeometry(1.8,2.1,height,8),fencePost,0,height*.5,0);
 box(g,'LampArm',[13,2.7,3.2],steel,5,height,0);
 box(g,'LampHead',[9,5.2,8],dark,9,height-1,0);
 // Emissive diffuser is visible at RTS zoom without expensive PointLights.
 box(g,'LampDiffuser',[7,1.4,6],lampGlass,9,height-4.1,0);
 return g;
}
function instanceBoxes(group,name,paint,parts){
 if(!parts.length)return;
 const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),paint,parts.length);
 instances.name=name;
 instances.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 const helper=new THREE.Object3D();
 for(let i=0;i<parts.length;i++){
  const p=parts[i];
  helper.position.set(p.x,p.y,p.z);
  helper.rotation.set(0,p.yaw??0,0);
  helper.scale.set(p.w,p.h,p.d);
  helper.updateMatrix();
  instances.setMatrixAt(i,helper.matrix);
 }
 instances.instanceMatrix.needsUpdate=true;
 instances.computeBoundingSphere();
 instances.castShadow=true;
 instances.receiveShadow=true;
 group.add(instances);
}
function instanceFenceWires(group,parts,{radius=.42,name='YardFenceMesh'}={}){
 if(!parts.length)return;
 const wires=new THREE.InstancedMesh(new THREE.CylinderGeometry(radius,radius,1,6),
  fenceRail,parts.length);
 wires.name=name;
 wires.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 const helper=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 const direction=new THREE.Vector3();
 for(let i=0;i<parts.length;i++){
  const p=parts[i];
  direction.set(p.dx,p.dy,p.dz);
  const length=direction.length();
  helper.position.set(p.x,p.y,p.z);
  helper.quaternion.setFromUnitVectors(up,direction.normalize());
  helper.scale.set(1,length,1);
  helper.updateMatrix();
  wires.setMatrixAt(i,helper.matrix);
 }
 wires.instanceMatrix.needsUpdate=true;
 wires.computeBoundingSphere();
 wires.castShadow=false;wires.receiveShadow=true;
 group.add(wires);
}
function perimeterFence(group,width){
 // Three sides only: rear and flanks; the front remains a wide OPEN gateway.
 // Posts, rails and chainlink-style X-bracing: three batched draw calls.
 const x=width*.65,rear=-width*.53,front=width*.28;
 const posts=[],rails=[],wires=[],seen=new Set();
 function line(x0,z0,x1,z1){
  const dx=x1-x0,dz=z1-z0,dist=Math.hypot(dx,dz);
  const steps=Math.max(2,Math.ceil(dist/26));
  const yaw=Math.atan2(dx,dz);
  for(let i=0;i<=steps;i++){
   const t=i/steps,px=x0+dx*t,pz=z0+dz*t;
   const key=px.toFixed(3)+':'+pz.toFixed(3);
   if(!seen.has(key)){
    seen.add(key);posts.push({x:px,y:10.5,z:pz,w:3.3,h:21,d:3.3});
   }
   if(i===steps)continue;
   const u=(i+.5)/steps;
   const mx=x0+dx*u,mz=z0+dz*u;
   for(const y of [7,16.5])
    rails.push({x:mx,y,z:mz,w:2.5,h:2,d:dist/steps+.8,yaw});
   const sx=dx/steps,sz=dz/steps;
   wires.push({x:mx,y:11.5,z:mz,dx:sx,dy:13,dz:sz});
   wires.push({x:mx,y:11.5,z:mz,dx:sx,dy:-13,dz:sz});
  }
 }
 line(-x,rear,x,rear);
 line(-x,rear,-x,front);
 line(x,rear,x,front);
 instanceBoxes(group,'YardFencePosts',fencePost,posts);
 instanceBoxes(group,'YardFenceRails',fenceRail,rails);
 instanceFenceWires(group,wires);
 group.userData.fencePosts=posts.length;
 group.userData.fenceRails=rails.length;
 group.userData.fenceWires=wires.length;
}

/** Barracks-only military wire perimeter. Unlike the old wooden fence, this
 * has slim steel posts and horizontal wire/barbs, no bulky rail or X braces.
 * Three sides plus two front sections keep the actual infantry exit clear. */
function perimeterBarracksWire(group,width,{factory=false,generator=false}={}){
 // Generator: small scaled perimeter with enough clearance for its front
 // service door, a shallow yard and no wire across the entrance.
 const x=width*(generator?.70:.65);
 const rear=-width*(generator?.54:.53);
 const front=width*(generator?.45:.28);
 const gateHalf=width*(generator?.28:.23);
 const posts=[],strands=[],barbs=[],seen=new Set();
 function segment(x0,z0,x1,z1){
  const dx=x1-x0,dz=z1-z0,dist=Math.hypot(dx,dz);
  const steps=Math.max(1,Math.ceil(dist/24));
  for(let i=0;i<=steps;i++){
   const t=i/steps,px=x0+dx*t,pz=z0+dz*t;
   const key=px.toFixed(2)+':'+pz.toFixed(2);
   if(!seen.has(key)){
    seen.add(key);
    posts.push({x:px,y:13.5,z:pz,w:1.45,h:27,d:1.45});
   }
   if(i===steps)continue;
   const sx=dx/steps,sz=dz/steps,ux=sx/(dist/steps),uz=sz/(dist/steps);
   const mx=px+sx*.5,mz=pz+sz*.5;
   for(const y of [7.5,14.5,21.5])
    strands.push({x:mx,y,z:mz,dx:sx,dy:0,dz:sz});
   // An upper twisted strand and sparse barbs, all instanced.
   barbs.push({x:mx,y:24.5,z:mz,dx:sx,dy:0,dz:sz});
   for(const u of [.25,.50,.75]){
    const bx=px+sx*u,bz=pz+sz*u;
    barbs.push({x:bx,y:24.5,z:bz,
     dx:uz*1.7,dy:2.9,dz:-ux*1.7});
    barbs.push({x:bx,y:24.5,z:bz,
     dx:-uz*1.7,dy:2.9,dz:ux*1.7});
   }
  }
 }
 segment(-x,rear,x,rear);
 segment(-x,rear,-x,front);
 // The separate vehicle repair deck starts at the factory's RIGHT side.
 // Keep the right front open instead of crossing its drive-on ramp with wire.
 segment(x,rear,x,factory?-width*.13:front);
 segment(-x,front,-gateHalf,front);
 if(!factory)segment(gateHalf,front,x,front);
 instanceBoxes(group,'BarracksWireFencePosts',fencePost,posts);
 instanceFenceWires(group,strands,{radius:.18,name:'BarracksWireFenceStrands'});
 instanceFenceWires(group,barbs,{radius:.12,name:'BarracksWireFenceBarbs'});
 group.userData.fencePosts=posts.length;
 group.userData.fenceRails=0;
 group.userData.fenceWires=strands.length+barbs.length;
 group.userData.barracksWireFence=true;
 group.userData.factoryWireFence=factory;
 group.userData.generatorWireFence=generator;
}

const barracksYardPaint=new Map([
 [rubber,'rubber'],[tread,'trackMetal'],[steel,'brightSteel'],
 [wood,'supplyWood'],[sand,'linen'],[olive,'helmetPaint'],
 [dark,'darkSteel'],[fencePost,'fenceSteel'],[fenceRail,'fenceSteel'],
 [crateBand,'darkSteel'],[barrelPaint,'olivePaint']
]);
/** Replace procedural single-color swatches in the barracks yard with real
 * tiled PBR maps. Leave the other buildings and emissive lamp glass alone. */
function textureBarracksYard(root){
 root.traverse(obj=>{
  if(!obj.isMesh)return;
  const role=barracksYardPaint.get(obj.material);
  if(role){
   obj.material=barracksPropMaterial(role);
   obj.userData.sandforgeBarracksPropPolish=true;
  }
 });
}

function addSiteDecor(root,kind,width){
 // Dedicated grouping avoids changing the legacy barracks/factory prop names
 // and lets renderer integration identify the decorations independently.
 const g=new THREE.Group();
 g.name='BasePerimeter_'+kind;
 g.userData={visualOnly:true,nonPlayable:true,siteDecor:true};
 // Keep a small generator's props and side lamp proportional to its new
 // compact reactor model. Rendering only: no navigation or collision change.
 if(kind==='generator')g.scale.setScalar(.66);
 root.add(g);
 const large=width>=155;
 if(['barracks','headquarters','factory','generator'].includes(kind))
  perimeterBarracksWire(g,width,{factory:kind==='factory',generator:kind==='generator'});
 else if(fencedSites.has(kind))perimeterFence(g,width);
 const supplies=new THREE.Group();
 // The original depot was centered at x=.55*width while its pallet
 // extended another 30+ units into the wire-fence line (x=.65*width).
 // Keep the barracks-only cache compact and clearly inside the perimeter.
 supplies.name='BaseSupplyCache';
 // Keep HQ crates clear of the thinner wire at small and real HQ sizes:
  // the outer crate lid reaches 20 units past the cache origin.
  // At width 160, .50 placed its edge at x=100: only 4 from the wire (x=104).
  // .47 leaves 8.8 clearance; real HQ width 225 has >20.
  supplies.position.set(kind==='barracks'?width*.49:kind==='headquarters'?width*.47:
  kind==='factory'?width*.43:width*.55,0,-width*.2);
 g.add(supplies);
 // Different silhouettes per facility, all deterministic and inexpensive.
 if(kind==='barracks'||kind==='headquarters'){
  // Fit all boxes, wood pallet and drum between the building facade
  // and side wire. Preserve crate/metal texture roles and visual shadows.
  storageCrate(supplies,0,0,14);
  storageCrate(supplies,14,9,10,sand);
  box(supplies,'SupplyPallet',[28,3.2,22],wood,3,1.6,3);
  supplyBarrel(supplies,-10,-11);
 }else{
  storageCrate(supplies,0,0,large?19:13);
  storageCrate(supplies,large?18:13,12,large?14:11,sand);
  if(kind!=='airfield'){
   box(supplies,'SupplyPallet',[43,3.2,27],wood,9,1.6,4);
   supplyBarrel(supplies,-16,-11);
   if(kind==='factory'||kind==='research'||kind==='headquarters')
    supplyBarrel(supplies,-3,-19);
  }
 }
 // Place masts near the side fencing, never along the open front door/spawn.
 const lampHeight=Math.min(60,Math.max(43,width*.29));
 securityLamp(g,-width*.56,width*.20,lampHeight);
 if(large&&kind!=='airfield')securityLamp(g,width*.53,-width*.40,lampHeight);
 if(kind==='headquarters'||kind==='research'||kind==='silo'){
  // A small technical crate station reads like base infrastructure.
  const service=new THREE.Group();
  service.name='ServiceStation';service.position.set(-width*.53,0,-width*.18);
  g.add(service);
  box(service,'ServiceConsole',[21,19,13],steel,0,9.5,0);
  box(service,'ConsoleScreen',[13,7,1.4],dark,0,17,7);
  box(service,'ConsoleIndicator',[9,2,1.6],lampGlass,0,20.5,7.2);
 }
 g.userData.lamps=g.children.filter(child=>child.name==='SecurityLamp').length;
 g.userData.supplyCrates=supplies.children.filter(child=>child.name==='SupplyCrate').length;
 // Tiny decorative details are already lit by sunlight/ambient PBR. Casting
 // and receiving a 2048px shadow map for every crate strap, wire and lamp
 // adds whole render passes while barely changing the image at RTS zoom.
 // Keep shadows on the building and original production-yard props.
 g.traverse(object=>{
  if(!object.isMesh)return;
  // Only the larger barracks-yard objects need an actual sunlight shadow.
  // Tiny fence wires/straps stay shadow-free to avoid shadow-map aliasing.
  const majorBarracksProp=(kind==='barracks'||kind==='headquarters')&&
   /^(CrateBody|CrateLid|SupplyPallet|BarrelShell|LampPost|LampHead)$/.test(object.name);
  object.castShadow=majorBarracksProp;
  object.receiveShadow=majorBarracksProp;
  // Decorative meshes must not compete with the building model when
  // recursive unit/building raycasts resolve game selection.
  object.raycast=()=>{};
 });
 return g;
}

/** Small, optional-looking military camo shade. NOT a roof replacement:
 * it shelters a little rear-side kit only, leaving main roof, flags, radar,
 * ventilation, entrance and production path completely clear.
 * Vertex colours and intentional perforations provide lightweight visual
 * fabric without a new downloaded texture or a separate terrain pass.
 */
export const CAMO_NET_DETAIL_VERSION='limited-rear-side-camo-mesh-v1';
export const CAMO_NET_BUILDING_KINDS=Object.freeze(['headquarters','barracks','research']);
const netPaint=new THREE.MeshStandardMaterial({
 color:'#e2ddce',vertexColors:true,roughness:1,metalness:0,
 side:THREE.DoubleSide,transparent:true,opacity:.83,depthWrite:false
});
function attachSmallCamouflageNet(root,width){
 const net=new THREE.Group();net.name='SmallDesertCamouflageNet';
 net.userData={visualOnly:true,nonPlayable:true,decorativeNet:true,
  version:CAMO_NET_DETAIL_VERSION};
 const w=Math.min(width*.30,58),d=Math.min(width*.24,40);
 // Offset to the REAR LEFT. Building access doors at local +Z stay clear.
 net.position.set(-width*.50,0,-width*.21);
 const geometry=new THREE.PlaneGeometry(w,d,12,9);
 const positions=geometry.getAttribute('position'),colors=[];
 const sandCol=new THREE.Color('#a99c76');
 const oliveCol=new THREE.Color('#747f60');
 const shadowCol=new THREE.Color('#7f806f');
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i);
  const nx=x/(w*.5),ny=y/(d*.5);
  const droop=2.1*(1-nx*nx)*(1-ny*ny);
  positions.setZ(i,-droop+.24*Math.sin(x*.52+y*.40));
  const n=Math.sin(Math.floor((x+w*.5)/9)*2.4+
   Math.floor((y+d*.5)/7)*3.17);
  const col=n>.32?oliveCol:n<-.34?sandCol:shadowCol;
  colors.push(col.r,col.g,col.b);
 }
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 // One open weave with small intentional diamond/triangle holes. Avoid
 // dense solid-looking camouflage tarps that obscure the building model.
 const original=Array.from(geometry.index.array),faces=[];
 for(let i=0;i<original.length;i+=3){
  const tri=i/3;
  if(tri%13===0||tri%19===7)continue;
  faces.push(original[i],original[i+1],original[i+2]);
 }
 geometry.setIndex(faces);geometry.computeVertexNormals();
 const fabric=new THREE.Mesh(geometry,netPaint);
 fabric.name='PartialCamouflageMesh';fabric.rotation.x=-Math.PI/2;
 fabric.position.y=27;
 fabric.castShadow=false;fabric.receiveShadow=true;fabric.raycast=()=>{};
 fabric.userData={visualOnly:true,nonPlayable:true,camoNetFabric:true};
 net.add(fabric);
 // Only two thin supports at the outer edge; the inner edge is attached
 // to the side of the building, not held by a forest of posts.
 for(const z of [-d*.46,d*.46]){
  const pole=mesh(net,'CamoNetOuterPole',
   new THREE.CylinderGeometry(.67,.86,26,6),fencePost,-w*.48,13,z);
  pole.raycast=()=>{};pole.castShadow=false;
 }
 // A minimal, low-cost net perimeter (two cords) gives a sagging silhouette.
 for(const z of [-d*.49,d*.49])
  box(net,'CamouflageNetRope',[w,.40,.55],fenceRail,0,27.0,z).raycast=()=>{};
 root.add(net);
 return net;
}
// Airfield has its own service yard with a true runway, apron and hangar.
// The generic crate cache was positioned at (+width*.55,-width*.2), which
// falls DIRECTLY on that runway and left visible boxes in the landing lane.
// Do not generate generic supply crates/lamp posts for the airfield at all.
export function createBuildingYard(kind,width=160){
 if(!YARD_DECOR_KINDS.includes(kind))return null;
 const root=new THREE.Group();
 root.name='sf-yard-'+kind;
 root.userData={visualOnly:true,nonPlayable:true,buildingContext:kind};
 // Place recognizable outdoor inventory at the flanks, not over the
 // doors or spawn lanes. Parent rotation follows the placed building.
 if(kind==='factory'){
  const g=new THREE.Group();g.name='VehicleSpareParts';
  // Move spares behind the new left-front wire instead of straddling it.
  g.position.set(-width*.43,0,width*.04);root.add(g);
  box(g,'RepairPallet',[63,4,45],wood,3,2,0);
  wheel(g,-17,-8,3);wheel(g,10,-10,2);
  box(g,'EngineBlock',[24,14,20],steel,30,12,2);
  for(const x of [23,30,37])box(g,'EngineCoolingFin',[3,6,23],tread,x,22,2);
  for(let i=0;i<8;i++){
   const link=box(g,'SpareTrackLink',[9,3,17],tread,-31+i*8,4,28);
   link.rotation.y=(i%2?-.06:.06);
   box(g,'TrackRidge',[8,2,3],steel,-31+i*8,6,28);
  }
  box(g,'ToolCase',[22,10,13],sand,31,7,-21);
  box(g,'ToolCaseHandle',[9,2,2],dark,31,13,-21);
 }else if(kind==='barracks'){
  const g=new THREE.Group();g.name='InfantryEquipment';
  // Geometry was authored at building scale: 19-unit helmets and ~53-unit
  // rifles looked as large as a human next to the 3D infantry (~36 units).
  // Keep all individual assets and their spacing proportional, without
  // changing collision, unit models, or the garage/barracks portal.
  g.scale.setScalar(.48);
  g.position.set(width*.43,0,width*.34);root.add(g);
  box(g,'EquipmentPallet',[79,4,46],wood,0,2,0);
  box(g,'HelmetRack',[75,4,13],steel,-1,12,-10);
  for(const x of [-24,0,24])helmet(g,x,-10);
  box(g,'WeaponRack',[10,27,49],wood,30,17,20);
  for(const [i,x] of [-1,0,1].entries())rifle(g,-25+i*18,17);
  for(let i=0;i<2;i++){
   box(g,'AmmunitionCrate',[16,12,13],olive,-26+i*19,10,33);
   box(g,'AmmunitionClasp',[11,2,2],steel,-26+i*19,17,39);
  }
 }
 addSiteDecor(root,kind,width);
 // Only three selected facilities get ONE small side awning; most buildings
 // have no camouflage fabric at all. Never cover doors or active roof gear.
 if(CAMO_NET_BUILDING_KINDS.includes(kind))attachSmallCamouflageNet(root,width);
 // The generator's side crates, pallet and barrels need the same authored
 // wood/steel/cloth PBR mapping as HQ supplies, not plain colored blocks.
 if(['barracks','headquarters','factory','generator'].includes(kind))
  textureBarracksYard(root);
 return root;
}

/** Mesh geometries are unique to each service yard; PBR materials are
 * module-shared and must remain alive for other factories and barracks. */
export function disposeBuildingYard(yard){
 if(!yard)return;
 // Instanced fences own GPU instance buffers in addition to their geometry.
 yard.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});
 disposeOwnedMeshes(yard,{materials:false});
 yard.removeFromParent();
}
