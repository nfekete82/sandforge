import * as THREE from 'three';
import {FACTION_PAINT,FACTION_BLUE,FACTION_RED} from './sandforge-faction-palette.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Zero-Hour-style recognizable strategic structures. Procedural originals,
 * avoiding missing GLB placeholders. Created ONCE per building, NOT per frame.
 * Geometry and material lifetime belongs to the existing fallback disposal.
 */
/** A single shared, deterministic sandstone/paint grain provides subtle PBR
 * surface detail instead of the old flat-color primitives. The same texture is
 * used for world models and their 3D roster snapshots; no external asset fetch.
 * Kept for the lifetime of the WebGL module (material disposal doesn't own it).
 */
const materialGrain=(()=>{
 const width=128,height=128,rgba=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const hash=Math.imul(x+117,374761393)^Math.imul(y+61,668265263);
  const fine=((hash^(hash>>>13))&31)-15;
  const broad=5*Math.sin(x*.17+y*.09)+5*Math.cos(y*.11-x*.07);
  const tone=Math.max(204,Math.min(254,237+fine*.54+broad));
  const index=(y*width+x)*4;
  rgba[index]=tone;rgba[index+1]=tone-2;rgba[index+2]=tone-4;rgba[index+3]=255;
 }
 const texture=new THREE.DataTexture(rgba,width,height,THREE.RGBAFormat);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(2,2);
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return texture;
})();

/** Baked, repeating desert camouflage for the silo's largest concrete
 * surfaces. Unlike tiny colored boxes, this is genuine albedo detail on the
 * bunker walls and armoured hatch doors. A single GPU texture is shared by
 * all silo meshes and the matching 3D construction-card portrait.
 */
const siloDesertCamo=(()=>{
 const n=256,rgba=new Uint8Array(n*n*4);
 const colors=[[205,184,139],[165,153,116],[117,123,91],[187,167,125]];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x*Math.PI*2/n,v=y*Math.PI*2/n;
  // Periodic field: irregular organic sand/khaki/olive patches, seamless
  // at the wrap boundary, with subtle dusty micrograin and worn edges.
  const field=.75*Math.sin(2*u+.82*Math.sin(3*v))+
   .61*Math.cos(3*v-.58*Math.sin(2*u))+
   .35*Math.sin(4*u-3*v+.4)+.17*Math.cos(5*v+4*u);
  const band=field>.73?2:field>.08?1:field<-.75?3:0;
  const hash=(Math.imul(x+97,73856093)^Math.imul(y+31,19349663))>>>0;
  const dust=(hash%23)-11,grain=dust*.48;
  const pos=(y*n+x)*4;
  for(let c=0;c<3;c++)rgba[pos+c]=Math.max(0,Math.min(255,
   Math.round(colors[band][c]+grain)));
  rgba[pos+3]=255;
 }
 const t=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 t.name='Sandforge silo desert khaki olive camouflage';
 t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(3,3);
 t.magFilter=THREE.LinearFilter;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.generateMipmaps=true;
 t.needsUpdate=true;
 return t;
})();

/** Static destructible base wall, rendered once and shared by preview and game. */
function createDefensiveWall(owner){
 const root=new THREE.Group();root.name='Strategic_wall';
 root.userData={visualOnly:true,defensiveWall:true};
 // Textured sand/khaki/olive camouflage on the actual concrete faces, not
 // a flat overlay. Reuse the existing deterministic Sandforge PBR albedo;
 // the very same model is drawn in-game, for the ghost and the HUD tile.
 const concrete=new THREE.MeshStandardMaterial({
  name:'Sandforge defensive wall | desert camouflage',
  color:'#fff7e7',roughness:.9,metalness:.04,
  map:siloDesertCamo,bumpMap:materialGrain,bumpScale:.24
 });
 // The albedo is already camouflage: do not cover it with the generic
 // world-position shader (it would slide across a moving build preview).
 concrete.userData={sandforgeWallCamouflage:true,sandforgeColorMapCamo:true};
 const cap=new THREE.MeshStandardMaterial({color:'#817960',roughness:.84,metalness:.19,
  map:materialGrain,bumpMap:materialGrain,bumpScale:.1});
 const stripe=new THREE.MeshStandardMaterial({color:FACTION_PAINT[owner],
  roughness:.6,metalness:.25});
 const add=(w,h,d,x,y,z,mat,name)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;
  root.add(m);
 };
 add(109,7,30,0,4,0,cap,'WallFooting');
 for(const x of [-35,0,35]){
  add(33,32,18,x,24,0,concrete,'WallArmoredPanel');
  add(33,5,21,x,42,0,cap,'WallCoping');
  add(27,2,22,x,46,0,stripe,'WallFactionBand');
 }
 for(const x of [-52,52]){
  add(8,47,25,x,26,0,cap,'WallPillar');
  add(10,5,28,x,51,0,concrete,'WallPillarTop');
 }
 return root;
}
export const STRATEGIC_BUILDING_KINDS=Object.freeze(['research','silo','interceptor','wall']);
export const isStrategicBuilding=kind=>STRATEGIC_BUILDING_KINDS.includes(kind);
export function createStrategicBuilding(kind,owner=0){
 if(!isStrategicBuilding(kind))return null;
 if(kind==='wall')return createDefensiveWall(owner);
 const root=new THREE.Group();
 root.name='Strategic_'+kind;
 root.userData.visualOnly=true;
 const faction=FACTION_PAINT[owner];
 const researchCamo=kind==='research';
 const siloCamo=kind==='silo';
 const structuralCamo=researchCamo||siloCamo;
 const mats={
  base:new THREE.MeshStandardMaterial({color:structuralCamo?'#bba882':'#968b73',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.32,roughness:.84,metalness:.11}),
  panel:new THREE.MeshStandardMaterial({color:researchCamo?'#999477':faction,map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.56,metalness:.39}),
  metal:new THREE.MeshStandardMaterial({color:researchCamo?'#766f5b':'#626b69',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.48,metalness:.57}),
  stone:new THREE.MeshStandardMaterial({color:structuralCamo?'#d5c297':'#c0ab89',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.48,roughness:.91,metalness:.02}),
  black:new THREE.MeshStandardMaterial({color:researchCamo?'#585345':'#252b29',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.07,roughness:.68,metalness:.38}),
  glow:new THREE.MeshStandardMaterial({color:FACTION_PAINT[owner],
   emissive:FACTION_PAINT[owner],emissiveIntensity:.34,metalness:.25,roughness:.4}),
  trim:new THREE.MeshStandardMaterial({color:structuralCamo?'#d3bd91':'#c2ac84',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.62,metalness:.36}),
  vent:new THREE.MeshStandardMaterial({color:researchCamo?'#505249':'#343c3b',roughness:.77,metalness:.35}),
  glass:new THREE.MeshStandardMaterial({color:FACTION_PAINT[owner],
   emissive:FACTION_PAINT[owner],emissiveIntensity:.18,metalness:.26,roughness:.34})
 };
 // Shared khaki/sand/olive PBR camouflage for research and missile silo.
 // Interceptor, dark metal, windows and faction signal beacons are untouched.
 if(structuralCamo){
  mats.steel=new THREE.MeshStandardMaterial({color:'#aaa082',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.12,roughness:.75,metalness:.18});
  mats.camoOlive=new THREE.MeshStandardMaterial({color:'#7f846b',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.14,roughness:.9,metalness:.04});
  // Silo sand-tone panels reuse its three-tone armoured albedo.
  // Research retains an independent sand highlight; this saves the silo
  // one draw call and maintains the original <=20 mesh budget.
  if(researchCamo){
   mats.camoSand=new THREE.MeshStandardMaterial({color:'#d1bd93',map:materialGrain,
    bumpMap:materialGrain,bumpScale:.16,roughness:.88,metalness:.05});
   // Actual baked albedo across the LAB WALLS and ROOF, not just painted
   // accessory boxes. Reuse the shared 256px, seam-free desert texture.
   // Own material but no extra texture allocation or frame-time shader cost.
   mats.researchArmor=new THREE.MeshStandardMaterial({
    color:'#f3efe3',map:siloDesertCamo,bumpMap:materialGrain,bumpScale:.22,
    roughness:.88,metalness:.07});
   mats.researchArmor.userData={sandforgeColorMapCamo:true};
  }
 }
 // The silo should be a recognisable armoured launch complex, not a
 // generic box with a lone tower. Both skins share faction ID colours.
 if(kind==='silo'){
  mats.armor=new THREE.MeshStandardMaterial({color:'#b3a581',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.23,roughness:.72,metalness:.22});
  mats.steel=new THREE.MeshStandardMaterial({color:'#8d8770',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.1,roughness:.6,metalness:.4});
  mats.warning=new THREE.MeshStandardMaterial({color:'#cda956',roughness:.62,metalness:.18});
  mats.rocketBody=new THREE.MeshStandardMaterial({color:'#787b66',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.09,roughness:.71,metalness:.25});
  mats.rocketPanel=new THREE.MeshStandardMaterial({color:'#bab497',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.08,roughness:.66,metalness:.27});
  mats.rocketNose=new THREE.MeshStandardMaterial({color:'#363e3c',roughness:.51,metalness:.44});
  mats.rocketAccent=new THREE.MeshStandardMaterial({color:'#b38a4e',roughness:.66,metalness:.2});
  // Give the large bunker and hatch faces a real tiled camouflage albedo.
  // Keep fine concrete grain as bump; rocket, hatches' dark iron, metallic
  // machinery and team-colored glass keep their own original materials.
  for(const role of ['base','armor']){
   mats[role].map=siloDesertCamo;
   // Near-white warm binder keeps the albedo colors true while remaining
   // eligible for the same subtle blue/red ownership tint as other walls.
   mats[role].color.set('#f3efe3');
   mats[role].userData={...mats[role].userData,sandforgeColorMapCamo:true};
  }
 }
 // Names allow one shared camouflage pass while leaving service glass,
 // signal beacons and recessed dark vents in their original PBR material.
 for(const [name,material] of Object.entries(mats))material.name='SF_'+name;
 function add(geometry,material,x,y,z,rx=0,ry=0,rz=0){
  const mesh=new THREE.Mesh(geometry,typeof material==='string'?mats[material]??mats.metal:material);
  mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  return mesh;
 }
 const box=(w,h,d,m,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const cyl=(top,bottom,h,m,x,y,z,n=12)=>add(new THREE.CylinderGeometry(top,bottom,h,n),m,x,y,z);
 const foundation=(w,d)=>{
  box(w,8,d,'black',0,4,0);
  box(w*.91,5,d*.90,'stone',0,10,0);
 };
 // All new strategic structures share the authored HQ's sand-concrete base,
 // heavy metal roof, corner buttresses, dark gaskets, blue service glass,
 // industrial roof equipment and small mechanically believable details.
 const support=(x,z,height=68)=>{
  box(13,height,13,'metal',x,height/2+11,z);
  box(16,4,16,'trim',x,height+10,z);
  box(10,2,10,'black',x,height+13,z);
 };
 const grille=(x,y,z,w=20)=>{
  box(w,17,2.5,'vent',x,y,z);
  for(let i=0;i<5;i++)box(w-3,.85,2.8,'trim',x,y-6+i*3,z+.3);
 };
 if(kind==='research'){
  // All authored dimensions below remain in native model units for the
  // 3D portrait and construction ghost. The shared visual root is reduced
  // once AFTER batching, so the ghost and finished structure match exactly.
  foundation(178,149);
  box(159,60,124,'base',0,43,0);
  // Thin armored cladding carries the THREE-TONE texture on the real walls.
  // Keep front windows, louvers and entrance in front of the camo plates.
  box(157,53,1.8,'researchArmor',0,42,-62.5);
  box(157,53,1.8,'researchArmor',0,42,62.5);
  for(const side of [-1,1])
   box(1.8,53,121,'researchArmor',side*80.1,42,0);
  box(149,1.8,115,'researchArmor',0,84,0);
  box(164,5,130,'metal',0,15,0);
  box(170,9,136,'black',0,77,0);
  box(159,2,129,'trim',0,82,0);
  // Heavy sidewalls and distinct structural columns like the original HQ.
  for(const x of [-72,72])for(const z of [-55,55])support(x,z,65);
  for(const z of [-50,0,50]){
   box(5,50,8,'metal',-82,42,z);
   box(5,50,8,'metal',82,42,z);
  }
  // Purposeful three-tone desert camouflage on large structural surfaces,
  // not on the radar dish, glass, signal beacons or service vents.
  // Thin raised plates stay outside the collision footprint and are batched
  // with the other static PBR details (no per-frame geometry or draw calls).
  for(const side of [-1,1]){
   for(const [z,y,length,height,paint] of [
    [-38,36,21,17,'camoOlive'],
    [-8,56,24,13,'camoSand'],
    [27,39,19,21,'camoOlive']
   ])box(1.2,height,length,paint,side*80.4,y,z);
  }
  for(const [x,width,paint] of [
   [-65,20,'camoOlive'],[-20,27,'camoSand'],
   [28,23,'camoOlive'],[66,15,'camoSand']
  ])box(width,7,1.2,paint,x,66,62.8);
  for(const [x,z,width,depth,paint] of [
   [-62,-41,20,19,'camoOlive'],
   [-64,39,27,16,'camoSand'],
   [58,48,24,16,'camoOlive'],
   [70,-39,14,23,'camoSand']
  ])box(width,1.2,depth,paint,x,84.4,z);
  // The facade is not a blank box: entrance, framed windows and shutters.
  box(41,49,5,'black',0,42,65);
  box(34,42,5.8,'metal',0,40,68);
  box(27,30,6,'vent',0,39,71);
  for(let i=0;i<6;i++)box(28,2.4,6.2,'steel',0,25+i*5.1,72);
  for(const x of [-53,53]){
   box(37,28,4,'metal',x,48,65);
   box(31,20,4.4,'glass',x,48,67.4);
   box(34,3,5,'trim',x,60,68);
   box(3.2,24,5,'black',x,48,69);
   box(37,3,5,'black',x,35,68);
   for(let i=0;i<3;i++)box(8,2.3,4,'steel',x-12+i*12,32,67);
  }
  // Protective roof ribs and low raised instrument pods create a compact
  // laboratory silhouette like the reference instead of a blank cuboid.
  for(const x of [-58,58])for(const z of [-42,42]){
   box(22,5,23,'camoOlive',x,87,z);
   box(17,2,19,'metal',x,90,z);
  }
  for(const x of [-52,0,52]){
   box(30,20,4,'vent',x,45,-64);
   for(let j=0;j<5;j++)box(27,1.7,5,'trim',x,38+j*3.6,-66);
  }
  // Louver and edge framing exposes the same crafted metalwork as the factory.
  for(const x of [-71,71])for(const z of [-42,0,42]){
   box(3.5,26,6,'trim',x,49,z);
  }
  box(168,3,135,'trim',0,73,0);
  for(const x of [-63,-42,-21,0,21,42,63]){
   box(1.7,3,132,'metal',x,82,0);
  }
  // Central instrument room; its stepped roof replaces the old flat roof.
  box(70,22,69,'metal',-21,96,-11);
  box(66,17,65,'panel',-21,97,-11);
  box(76,5,75,'black',-21,109,-11);
  box(73,2,72,'trim',-21,112,-11);
  for(const x of [-45,-22,1]){
   box(17,9,3,'glass',x,101,24);
   box(18,2,4,'trim',x,106,25);
  }
  // Compact, articulated dish like the Bastion radar: a real concave
  // reflector, narrow rim and centered receiver, not a giant vertical hoop.
  // The swivel sits entirely on its own solid instrument-room roof pedestal.
  box(43,5,41,'black',-21,116,-11);
  box(39,2,38,'trim',-21,120,-11);
  cyl(10,12,13,'metal',-21,127.5,-11,14);
  cyl(15,17,5,'black',-21,136,-11,18);
  const radarYaw=new THREE.Group();
  radarYaw.name='Research_RadarMount';
  radarYaw.position.set(-21,140,-11);
  root.add(radarYaw);
  const radarTilt=new THREE.Group();
  radarTilt.rotation.x=-.32;
  radarYaw.add(radarTilt);
  const reflectorProfile=Array.from({length:13},(_,i)=>{
   const r=i*1.55;
   return new THREE.Vector2(r,5.6*Math.pow(i/12,2));
  });
  const dish=new THREE.Mesh(new THREE.LatheGeometry(reflectorProfile,28),mats.steel);
  dish.name='Research_Radar';
  dish.castShadow=true;dish.receiveShadow=true;
  radarTilt.add(dish);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(18.6,.9,6,32),mats.trim);
  rim.name='Research_RadarRim';
  rim.position.y=5.6;rim.rotation.x=-Math.PI/2;
  rim.castShadow=true;radarTilt.add(rim);
  const receiver=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,15,8),mats.metal);
  receiver.name='Research_ReceiverArm';
  receiver.position.y=10;
  receiver.castShadow=true;radarTilt.add(receiver);
  const feed=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,2.5,10),mats.glow);
  feed.name='Research_ReceiverFeed';feed.position.y=18;
  radarTilt.add(feed);
  // An identifiable roof HVAC bank, shielded server stacks, cabling and ducts.
  for(const z of [-30,-5,20]){
   box(26,14,18,'metal',43,91,z);
   grille(43,94,z+9.9,21);
   box(28,2,20,'trim',43,99,z);
  }
  // Short protected telemetry masts, not a second forest of tall pipes.
  for(const x of [18,60]){
   cyl(2.6,3.2,20,'metal',x,99,-52);
   cyl(4.1,4.1,2.5,'glow',x,110.5,-52);
  }
  box(30,3,52,'black',40,83,-5);
  for(let i=0;i<5;i++)box(3,3.2,52,'trim',26+i*7,86,-5);
  for(const x of [-73,73])for(const z of [-55,55]){
   cyl(3,4,8,'black',x,85,z);
   cyl(4,4,2,'glow',x,89.5,z);
  }
  // Reference-inspired field laboratory: raised segmented observation deck,
  // protected data centre, slanted sensor modules and rooftop service rails.
  // Every static piece is merged by material below into a few PBR batches.
  box(47,26,39,'camoSand',-49,29,-38);
  box(50,4,42,'trim',-49,44,-38);
  for(const z of [-54,-38,-22])grille(-73,29,z,22);
  for(const x of [-56,-20,18,55]){
   box(21,4,16,'steel',x,86,43);
   box(18,2.8,13,'camoOlive',x,89,43);
  }
  // Large articulated side array signals scientific purpose at RTS zoom.
  const array=add(new THREE.BoxGeometry(44,3,29),'panel',
   45,108,-11,-.40,0,.08);
  array.name='Research_SensorArray';
  for(const x of [28,42,56,70])box(3.2,7,26,'trim',x,109,-11);
  // Armored, slanted antenna panel and perimeter cable trays stay distinct.
  for(const z of [-47,43]){
   box(68,2.2,2.5,'trim',38,112,z);
   for(const x of [6,40,71])box(2.5,20,2.5,'metal',x,102,z);
  }
  // Exterior pipes and roof access ladder: depth and believable engineering.
  for(const y of [28,37,46,55])box(3,1.7,54,'steel',81,y,-3);
  for(const z of [-47,-12,23]){
   box(5,6,3,'metal',82,56,z);
   box(3.1,3,3,'glow',82,59,z);
  }
 }else if(kind==='silo'){
  // SUNKEN LAUNCH SHAFT: a low sand-camouflaged concrete installation.
  // No tall launch podium or walkways at rocket-tip height. The broad slab
  // stays flush with the playable terrain; the dark shaft is a visual hole
  // (no terrain modification, collider, new physics or save-file changes).
  foundation(230,207);
  box(219,6,196,'base',0,14,0);
  box(211,3,187,'armor',0,18.2,0);
  // Sand/olive armored outer lip and low perimeter edging.
  for(const z of [-97,97]){
   box(222,4,7,'metal',0,19.5,z);
   for(const x of [-88,-44,0,44,88])box(19,1.8,5,'camoOlive',x,22.5,z);
  }
  for(const x of [-109,109])box(7,4,187,'metal',x,19.5,0);

  // A sunken dark shaft, not a solid raised drum. This shallow visual cutout
  // lies over the ground slab, surrounding the below-grade part of the missile.
  // A thin grained rim and recessed inner shadow distinguish the opening.
  const rocketX=-17;
  cyl(78,78,2.5,'steel',rocketX,20.7,0,48);
  cyl(70,70,2,'black',rocketX,22.3,0,48);
  const well=cyl(59,59,1.4,'vent',rocketX,23.7,0,48);
  well.name='Silo_RecessedLaunchWell';
  const lip=add(new THREE.TorusGeometry(72,3.2,10,48),'trim',
   rocketX,24.3,0,-Math.PI/2);
  lip.name='Silo_LaunchRim';
  add(new THREE.TorusGeometry(61,1.4,8,48),'steel',
   rocketX,24.6,0,-Math.PI/2);
  // The paired retractable blast doors are PARKED level with the apron, not
  // suspended above the rocket. Distinct panels make the launch bay legible.
  for(const x of [rocketX-85,rocketX+85]){
   box(25,3.8,109,'armor',x,22,0);
   box(20,1.2,103,'steel',x,24.6,0);
   for(const z of [-44,-22,0,22,44])
    box(19,1.8,4,'black',x,25.4,z);
  }
  // Small circumferential clamps and worn warning plates remain below the
  // missile nose. Entire hatch looks integrated at RTS camera distances.
  for(let i=0;i<10;i++){
   const angle=i*Math.PI*2/10;
   const px=rocketX+Math.cos(angle)*78,pz=Math.sin(angle)*78;
   box(11,2.2,8,i%2?'camoOlive':'trim',px,24,pz).rotation.y=-angle;
  }

  // Keep the original named, high-detail multi-stage rocket and materials.
  // Every piece uses the same physical Y offset; the nozzle and lower stage
  // now sit BELOW the 24-unit apron so only the upper missile protrudes.
  const rocketInset=104;
  const rocketCyl=(top,bottom,h,material,y,segments=24)=>
   cyl(top,bottom,h,material,rocketX,y-rocketInset,0,segments);
  const hull=rocketCyl(22.5,23.5,72,'rocketBody',128);
  hull.name='Silo_RocketBody';
  rocketCyl(21.5,22.5,31,'rocketPanel',179);
  rocketCyl(22,22.5,8,'rocketNose',164.5);
  rocketCyl(18.8,21.5,9,'rocketPanel',201);
  const ogive=add(new THREE.ConeGeometry(18.8,42,24),'rocketNose',
   rocketX,226-rocketInset,0);
  ogive.name='Silo_RocketNose';
  for(const [y,radius,width,material] of [
   [94,22.5,3.2,'rocketNose'],[106,23.2,1.6,'rocketAccent'],
   [148,22.6,1.8,'trim'],[162,23.1,2.5,'rocketNose'],
   [194,21.4,2.2,'rocketAccent'],[206,18.8,1.8,'rocketNose']
  ]){
   const seam=add(new THREE.TorusGeometry(radius,width,8,32),
    material,rocketX,y-rocketInset,0,-Math.PI/2);
   if(y===162)seam.name='Silo_RocketStageSeam';
  }
  for(let n=0;n<8;n++){
   const angle=n*Math.PI/4;
   const x=rocketX+Math.cos(angle)*22.8,z=Math.sin(angle)*22.8;
   const p=add(new THREE.BoxGeometry(3,21,1.8),'rocketPanel',
    x,133-rocketInset,z,0,-angle,0);
   p.castShadow=false;
  }
  for(let n=0;n<4;n++){
   const angle=n*Math.PI/2;
   add(new THREE.BoxGeometry(19,30,3.3),'rocketBody',
    rocketX+Math.cos(angle)*24,111-rocketInset,Math.sin(angle)*24,
    0,-angle,-.31);
  }
  rocketCyl(14,18,8,'rocketNose',87.5,20);
  rocketCyl(12.5,12.5,2,'rocketAccent',83,20);
  for(const side of [-1,1])for(const z of [-7,7]){
   box(5,12,9,'steel',rocketX+side*23,111-rocketInset,z);
   box(8,3,11,'trim',rocketX+side*26,115-rocketInset,z);
  }

  // Flat control bunker on the RIGHT of the shaft, all within the original
  // footprint. The main rocket, not an industrial roof tower, is the focus.
  box(52,24,73,'base',78,24,-2);
  box(54,3,76,'metal',78,38,-2);
  box(57,3,78,'armor',78,41,-2);
  for(const [x,y,width,height,paint] of [
   [62,26,18,12,'camoOlive'],[85,24,16,11,'armor']
  ])box(width,height,1.2,paint,x,y,-39.1);
  for(const z of [-20,8,27]){
   box(3,14,12,'black',105,25,z);
   box(3.4,9,10,'glass',107,26,z);
   box(4,1.8,12,'trim',108,32,z);
  }
  box(19,22,4,'black',78,22,35);
  box(16,19,4,'metal',78,22,38);
  for(let i=0;i<4;i++)box(16,1.6,4.5,'trim',78,15+i*5,39);

  // Low-profile control consoles, exhausts and guarded service lighting.
  for(const z of [-78,76]){
   box(25,7,15,'camoOlive',80,23,z);
   box(21,2.3,12,'steel',80,28,z);
  }
  for(const z of [-72,65]){
   box(20,5,12,'vent',-86,23,z);
   for(let i=0;i<3;i++)box(17,1.4,13,'trim',-86,21+i*2.3,z);
  }
  for(const [x,z] of [[-99,-79],[96,-79],[-99,81],[96,81]]){
   cyl(3.7,4.7,14,'metal',x,26,z,10);
   cyl(4.5,4.5,3,'glow',x,34,z,12);
  }
  // A narrow maintenance channel around the hatch, without an overhead
  // bridge or a large platform concealing the recessed well.
  for(const z of [-87,87]){
   box(98,2.5,6,'metal',-17,21,z);
   for(const x of [-59,-26,7,28])
    box(9,1.5,7,'trim',x,23,z);
  }
  for(const x of [-96,102])box(5,3,29,'camoOlive',x,19,-1);
 }else{
  foundation(170,150);
  box(142,35,127,'base',0,32,0);
  box(153,5,136,'metal',0,52,0);
  for(const x of [-42,42]){
   box(45,22,85,'panel',x,68,0);
   for(const z of [-28,0,28]){
    const tube=add(new THREE.CylinderGeometry(11,11,49,12),mats.metal,
     x,85,z,.68,0,0);
    tube.name='Interceptor_Tube';
    const cap=add(new THREE.ConeGeometry(10,16,12),mats.stone,
     x,119,z,.68,0,0);
    cap.name='Interceptor_Rocket';
   }
  }
  cyl(6,8,67,'metal',0,91,-49,12);
  const radar=add(new THREE.CylinderGeometry(31,15,8,22),mats.panel,
   0,131,-47,.33,0,0);
  radar.name='Interceptor_Radar';
  cyl(5,5,11,'glow',0,145,-47);
  for(const x of [-67,67])for(const z of [-55,55])
   box(10,11,10,'glow',x,66,z);
 }
 const batched=batchStaticParts(root,kind);
 // Lab enlarged to visually match the modern command centre and factory.
 // All original components, roof radar, HUD portrait and placement ghost use
 // the SAME root transform. Preserve costs, research timing and PBR textures.
 if(kind==='research'){
  batched.scale.set(.86,.86,.86);
  batched.userData.compactResearch=true;
  batched.userData.referenceInspiredCamo=true;
 }
 return batched;
}

/** Static roof details, window ribs and facade panels are aggressively merged
 * by PBR material after placement, so the more detailed facilities do not
 * cost hundreds of WebGL draw calls. Named mechanical/animation parts remain
 * individually addressable. If a geometry cannot be combined, retain it.
 */
function batchStaticParts(root,kind){
 const groups=new Map();
 for(const mesh of [...root.children]){
  if(!mesh.isMesh||mesh.name)continue;
  const items=groups.get(mesh.material)??[];
  items.push(mesh);
  groups.set(mesh.material,items);
 }
 let batch=0;
 for(const [material,items] of groups){
  if(items.length<2)continue;
  const geometries=items.map(mesh=>{
   mesh.updateMatrix();
   const geometry=mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrix);
   return geometry;
  });
  let merged=null;
  try{merged=mergeGeometries(geometries,false);}
  catch(error){console.warn('Strategic static mesh batch fallback',kind,error);}
  finally{for(const geometry of geometries)geometry.dispose();}
  if(!merged)continue;
  const combined=new THREE.Mesh(merged,material);
  combined.name='SF_StaticBatch_'+kind+'_'+batch++;
  combined.castShadow=true;combined.receiveShadow=true;
  for(const mesh of items){
   root.remove(mesh);
   mesh.geometry.dispose();
  }
  root.add(combined);
 }
 return root;
}
