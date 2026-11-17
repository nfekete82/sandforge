import * as THREE from 'three';
import {FACTION_PAINT,FACTION_BLUE,FACTION_RED} from './sandforge-faction-palette.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SILO_FOUNDATION_APERTURE} from './webgl-foundation-slabs.js';

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

/** Deterministic, tileable stamped-steel panels for the recessed missile-silo
 * launch deck. Metallic plates, bevelled seams, sparse rivets and fine brushed
 * wear make the hatch readable from the zoomed-out RTS camera. One shared PBR
 * texture serves the construction ghost, HUD portrait and live building.
 */
const siloSteelPlate=(()=>{
 const n=256,rgba=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const px=x%64,py=y%64;
  const seam=px<3||py<3?-43:0;
  const bevel=(px>=3&&px<7||py>=3&&py<7)?13:0;
  const rivet=((px-12)**2+(py-12)**2<9||
   (px-52)**2+(py-52)**2<9)?-31:0;
  const hash=(Math.imul(x+317,374761393)^Math.imul(y+71,668265263))>>>0;
  const brushed=5*Math.sin(x*.29)+3*Math.cos(x*.075+y*.017);
  const grain=((hash^(hash>>>13))&31)-15;
  const patina=seam+bevel+rivet+brushed+grain*.39;
  const i=(y*n+x)*4;
  const base=[196,202,198];
  for(let c=0;c<3;c++)
   rgba[i+c]=Math.max(0,Math.min(255,Math.round(base[c]+patina)));
  rgba[i+3]=255;
 }
 const texture=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 texture.name='Sandforge silo stamped steel maintenance panels';
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 // ExtrudeGeometry uses local model-unit UVs; ~11 large plates span the deck.
 texture.repeat.set(.012,.014);
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return texture;
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
   emissive:FACTION_PAINT[owner],emissiveIntensity:kind==='silo'?.53:.34,metalness:.25,roughness:.4}),
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
  // The hatch platform is actual brushed, riveted steel, not sandy plaster.
  // Reuse the existing metal batch instead of adding a draw call per plate.
  mats.metal.color.set('#c3cbc5');
  mats.metal.map=siloSteelPlate;
  mats.metal.roughness=.43;
  mats.metal.metalness=.76;
  mats.metal.bumpScale=.12;
  // This is an authored steel albedo, not a candidate for the generic
  // khaki world-space camouflage shader or moving construction-ghost paint.
  mats.metal.userData={...mats.metal.userData,sandforgeAuthoredMetal:true};
  mats.warning=new THREE.MeshStandardMaterial({color:'#cda956',roughness:.62,metalness:.18});
  mats.rocketBody=new THREE.MeshStandardMaterial({color:'#a8b3b2',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.075,roughness:.38,metalness:.82});
  mats.rocketPanel=new THREE.MeshStandardMaterial({color:'#d1d6cf',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.06,roughness:.42,metalness:.77});
  mats.rocketNose=new THREE.MeshStandardMaterial({color:'#829198',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.05,roughness:.32,metalness:.81});
  mats.rocketAccent=new THREE.MeshStandardMaterial({color:'#a7a997',
   roughness:.44,metalness:.73});
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
  // Actual cut-out concrete: the launch aperture is a HOLE in the slab,
  // not the previous black cylinder painted over a solid roof.
  // All dimensions are local to the existing game footprint (no physics edit).
  const rocketX=SILO_FOUNDATION_APERTURE.x,shaftRadius=61;
  const deckShape=new THREE.Shape();
  deckShape.moveTo(-115,-103.5);
  deckShape.lineTo(115,-103.5);
  deckShape.lineTo(115,103.5);
  deckShape.lineTo(-115,103.5);
  deckShape.closePath();
  const hole=new THREE.Path();
  hole.absarc(rocketX,0,shaftRadius,0,Math.PI*2,true);
  deckShape.holes.push(hole);
  const deck=add(new THREE.ExtrudeGeometry(deckShape,{
   depth:7,steps:1,bevelEnabled:false,curveSegments:64
  }),'metal',0,1.4,0,-Math.PI/2);
  // Retain the stable mesh name for saves/tests; its visible finish is now
  // weathered steel rather than the old uniform tan concrete surface.
  deck.name='Silo_ExcavatedConcreteDeck';
  deck.userData={launchAperture:true,shaftRadius,shaftX:rocketX};
  // The steel-walled shaft is 35 units deep. Its floor is genuinely below
  // grade, so the perspective reveals a recessed cylinder rather than a
  // shallow black disk painted on top of the platform.
  const wallMaterial=new THREE.MeshStandardMaterial({
   name:'SF_SiloShaftInterior',color:'#333b3b',map:materialGrain,
   bumpMap:materialGrain,bumpScale:.10,
   metalness:.55,roughness:.71,side:THREE.BackSide
  });
  const inside=add(new THREE.CylinderGeometry(
   shaftRadius-.3,shaftRadius-.3,35.5,64,1,true),
   wallMaterial,rocketX,-9.15,0);
  inside.name='Silo_InnerShaftWall';
  inside.castShadow=false;inside.receiveShadow=true;
  const floorMaterial=new THREE.MeshStandardMaterial({
   name:'SF_SiloShaftFloor',color:'#111918',roughness:.96,metalness:.12
  });
  const well=add(new THREE.CylinderGeometry(shaftRadius-1,shaftRadius-1,.45,64),
   floorMaterial,rocketX,-26.6,0);
  well.name='Silo_RecessedLaunchWell';
  well.castShadow=false;well.receiveShadow=true;

  // The real terrain renderer continues underneath all buildings: cutting
  // the concrete foundation alone would expose pale desert/sand at y=0,
  // hiding the underground floor and making the rocket appear to stand on
  // a paved surface again. This nearly-black, unlit depth occluder sits
  // just ABOVE the terrain but BELOW the steel hatch lip. The 3D shaft
  // walls still extend down to the true -26.6 model-unit floor. No terrain
  // displacement, pathfinding, world shadow or save-state changes.
  const depthMaskMaterial=new THREE.MeshBasicMaterial({
   name:'SF_SiloDepthOcclusion',color:'#080e11',side:THREE.DoubleSide,
   depthWrite:true
  });
  const occlusion=add(new THREE.CircleGeometry(shaftRadius-1.0,64),
   depthMaskMaterial,rocketX,1.42,0,-Math.PI/2);
  occlusion.name='Silo_TerrainOcclusion';
  occlusion.castShadow=false;occlusion.receiveShadow=false;
  occlusion.userData={visualOnly:true,nonPlayable:true,
   hidesUnderlyingTerrain:true};

  // Visible vertical steel stiffeners and two retaining hoops make the
  // empty depth legible even when the missile is still in the silo.
  for(let i=0;i<16;i++){
   const a=i*Math.PI/8;
   const bar=box(1.7,25,1.5,'steel',
    rocketX+Math.cos(a)*(shaftRadius-1),-8,Math.sin(a)*(shaftRadius-1));
   bar.rotation.y=-a;
  }
  for(const y of [6.4,2.75,-9.4,-20.8])
   add(new THREE.TorusGeometry(shaftRadius-.9,.95,6,64),
    'steel',rocketX,y,0,-Math.PI/2);

  // Layered heavy hatch collar, without any polygon crossing the open pit.
  const lip=add(new THREE.RingGeometry(shaftRadius+.35,shaftRadius+15,64),
   'metal',rocketX,8.49,0,-Math.PI/2);
  lip.name='Silo_LaunchRim';
  lip.castShadow=false;
  const gasket=add(new THREE.TorusGeometry(shaftRadius+.65,2,8,64),
   'black',rocketX,8.9,0,-Math.PI/2);
  gasket.name='Silo_HatchGasket';
  gasket.castShadow=false;
  add(new THREE.TorusGeometry(shaftRadius+13.7,1.7,8,64),
   'steel',rocketX,9.2,0,-Math.PI/2);

  // Thick parked blast-door leaves and flush mechanical fasteners.
  // Keep the center aperture completely clear.
  for(const x of [rocketX-87,rocketX+84]){
   box(18,3.0,97,'metal',x,9.0,0);
   for(const z of [-40,-20,0,20,40])
    box(16,1.2,2.2,'steel',x,11.0,z);
  }
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12;
   const x=rocketX+Math.cos(a)*73,z=Math.sin(a)*73;
   const clasp=box(7,1.3,3.6,'steel',x,9.8,z);
   clasp.rotation.y=-a;
  }
  for(let i=0;i<12;i++){
   const a=i*Math.PI/6;
   cyl(1.75,1.75,.85,'trim',rocketX+Math.cos(a)*77.6,
    9.4,Math.sin(a)*77.6,8);
  }

  // Distinct cylindrical brushed-steel stage topped by a shorter pointed
  // nosecone. Lower engine is hidden in the REAL shaft, never a floating cone.
  const hull=cyl(16.3,17.2,27,'rocketBody',rocketX,12.8,0,32);
  hull.name='Silo_RocketBody';
  cyl(16.0,16.2,7.5,'rocketPanel',rocketX,25.4,0,32);
  const seam=add(new THREE.TorusGeometry(16.4,1.15,8,32),
   'rocketAccent',rocketX,29.0,0,-Math.PI/2);
  seam.name='Silo_RocketStageSeam';
  const ogive=add(new THREE.ConeGeometry(15.7,30,32),'rocketNose',
   rocketX,43.9,0);
  ogive.name='Silo_RocketNose';
  for(const y of [10.4,19.2,29.1])
   add(new THREE.TorusGeometry(16.4,.72,6,32),
    'rocketAccent',rocketX,y,0,-Math.PI/2);
  // Dark nozzle sits below deck level at the bottom of the rocket stage.
  cyl(11.5,13.6,7,'vent',rocketX,-3.2,0,24);
  // Low camouflaged command/maintenance block to the RIGHT of the pit.
  box(43,22,66,'base',91,16,-10);
  box(47,3,70,'armor',91,28.5,-10);
  for(const z of [-32,-13,7])
   box(3,12,9,'black',112.8,17,z);
  for(const z of [-26,3])
   box(3.5,8,7,'glass',113,18,z);
  box(16,16,3,'black',91,15,24);
  box(13,14,2.5,'steel',91,15,25.8);
  for(const y of [10,14,18])
   box(14,1.5,3,'trim',91,y,27.3);
  // A few distinct service modules, not a second full-height building.
  for(const z of [-72,66]){
   box(18,6,12,'camoOlive',90,11,z);
   box(19,2,13,'steel',90,15,z);
  }
  for(const z of [-68,65])box(19,6,12,'vent',-94,10,z);
  for(const [x,z] of [[-102,-85],[104,-85],[-102,82],[105,82]]){
   cyl(3,4,10,'metal',x,14,z,10);
   cyl(4,4,2,'glow',x,20,z,10);
  }
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
