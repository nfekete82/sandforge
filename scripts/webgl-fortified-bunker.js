import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FACTION_PAINT} from './sandforge-faction-palette.js';

/** Fully original visual-only bunker revision:
 * - solid angular concrete with actual 5 slotted openings (not dark stickers)
 * - recessed armored roof, protected rear entrance, blast ribs, vents,
 *   exterior bolting and bevelled buttresses
 * - unique 512px physically textured concrete albedo / normal / roughness
 * - two-sided wind-animated blue/red fabric ownership flag
 *
 * Same footprint and 5 occupant rules. All permanent static architecture
 * is merged per MATERIAL to limit draw calls, not one mesh per rivet.
 */
export const FORTIFIED_BUNKER_REVISION='sandforge-fortified-pbr-bunker-v2-20261120';
export const BUNKER_VISUAL_PORT_COUNT=5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const flagClock={value:0};
export function updateBunkerFlagWind(time){
 flagClock.value=Number.isFinite(time)?time:0;
}
let bunkerTextureSet=null;
function noise(x,y,salt=0){
 let a=Math.imul(x+19,374761393)^Math.imul(y+71,668265263)^salt;
 a=Math.imul(a^(a>>>13),1274126177);
 return ((a^(a>>>16))>>>0)/4294967295;
}
function bunkerPbrTextures(){
 if(bunkerTextureSet)return bunkerTextureSet;
 const n=512,color=new Uint8Array(n*n*4),
  normals=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4),
  relief=new Float32Array(n*n);
 const elevation=(x,y)=>{
  const u=(x+n)%n,v=(y+n)%n;
  const aggregate=Math.sin(u*.029+Math.sin(v*.018)*1.2)*.20+
   Math.cos(v*.039-u*.016)*.15+
   Math.sin(u*.089+v*.052)*.055;
  return aggregate+(noise(u,v,17)-.5)*.065;
 };
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*4;
  const grain=noise(x,y,11)-.5;
  const formSeam=(x%128<2||y%128<2)?-.13:0;
  const leak=Math.max(0,Math.sin(x*.035-y*.06+1.8))*.05;
  const streak=Math.sin(x*.015+y*.072)*.04;
  const worn=.87+grain*.095+elevation(x,y)*.115+formSeam-leak+streak;
  const c=clamp(worn,.53,1);
  color[i]=Math.round(234*c);color[i+1]=Math.round(230*c);
  color[i+2]=Math.round(215*c);color[i+3]=255;
  const r=clamp(.84+(noise(x,y,21)-.5)*.20+(.9-c)*.25,.58,1);
  rough[i]=rough[i+1]=rough[i+2]=Math.round(255*r);
  rough[i+3]=255;relief[y*n+x]=elevation(x,y)+(formSeam*1.5);
 }
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const left=relief[y*n+(x+n-1)%n],right=relief[y*n+(x+1)%n],
   up=relief[((y+n-1)%n)*n+x],down=relief[((y+1)%n)*n+x],
   dx=(left-right)*1.55,dy=(up-down)*1.55,
   length=Math.hypot(dx,dy,1),i=(y*n+x)*4;
  normals[i]=Math.round((dx/length*.5+.5)*255);
  normals[i+1]=Math.round((dy/length*.5+.5)*255);
  normals[i+2]=Math.round((1/length*.5+.5)*255);
  normals[i+3]=255;
 }
 const map=(pixels,name,srgb=false)=>{
  const tex=new THREE.DataTexture(pixels,n,n,THREE.RGBAFormat);
  tex.name=name;tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;
  return tex;
 };
 bunkerTextureSet=Object.freeze({
  color:map(color,'Bunker weathered cast concrete PBR albedo',true),
  normal:map(normals,'Bunker aggregate and cracks normal map'),
  rough:map(rough,'Bunker dust and seepage PBR roughness')
 });
 return bunkerTextureSet;
}
const flags=new Map();
function flagTexture(owner){
 if(flags.has(owner))return flags.get(owner);
 const n=256,wide=256,high=128,pixels=new Uint8Array(wide*high*4);
 const paint=new THREE.Color(FACTION_PAINT[owner]??FACTION_PAINT[0]);
 const rgb=paint.getHex();
 const c=[(rgb>>>16)&255,(rgb>>>8)&255,rgb&255];
 for(let y=0;y<high;y++)for(let x=0;x<wide;x++){
  const at=(y*wide+x)*4,u=x/(wide-1),v=y/(high-1),
   thread=(noise(x,y,owner*19)-.5)*.12+
    .025*Math.sin(u*110+v*17);
  const emblem=Math.abs(u-.55)+Math.abs(v-.5)*1.30<.20;
  const center=Math.abs(u-.55)+Math.abs(v-.5)*1.30<.10;
  const rim=u<.023||u>.975||v<.025||v>.975;
  for(let i=0;i<3;i++){
   const pigment=emblem?(center?c[i]*.52:237+i*2):rim?c[i]*.77:c[i];
   pixels[at+i]=Math.round(clamp(pigment*(1+thread),0,255));
  }
  pixels[at+3]=255;
 }
 const tex=new THREE.DataTexture(pixels,wide,high,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;
 flags.set(owner,tex);return tex;
}
function flagMaterial(owner){
 const material=new THREE.MeshStandardMaterial({
  name:'Bunker faction cloth '+owner,
  color:'#ffffff',map:flagTexture(owner),side:THREE.DoubleSide,
  metalness:0,roughness:.97
 });
 const compile=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,renderer){
  compile?.call(this,shader,renderer);
  shader.uniforms.sfBunkerFlagClock=flagClock;
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nuniform float sfBunkerFlagClock;')
   .replace('#include <begin_vertex>',[
    '#include <begin_vertex>',
    'float sfFlagFreeEdge=smoothstep(-11.5,10.8,position.x);',
    'float sfFlagWave=sin(position.x*.32+sfBunkerFlagClock*2.1+position.y*.13);',
    'transformed.z+=sfFlagWave*(.22+1.65*sfFlagFreeEdge);'
   ].join('\n'));
 };
 material.customProgramCacheKey=()=>FORTIFIED_BUNKER_REVISION+'-cloth-'+owner;
 material.userData={sandforgeBunkerFlag:true,sandforgeAuthoredBunker:true};
 return material;
}
export function createFortifiedBunker(owner=0){
 const root=new THREE.Group();
 root.name='Sandforge_DefenseBunker';
 root.userData={visualOnly:true,nonPlayable:true,bunkerFiringPorts:5,
  factionOwner:owner,visualRevision:FORTIFIED_BUNKER_REVISION,authoredPBR:true};
 const maps=bunkerPbrTextures();
 const concrete=new THREE.MeshStandardMaterial({
  name:'Bunker cast concrete PBR',color:'#9f9b8e',map:maps.color,
  normalMap:maps.normal,normalScale:new THREE.Vector2(.75,.75),
  roughnessMap:maps.rough,roughness:.93,metalness:.02
 });
 const plaster=new THREE.MeshStandardMaterial({
  name:'Bunker chipped light concrete PBR',color:'#c0b5a0',map:maps.color,
  normalMap:maps.normal,normalScale:new THREE.Vector2(.65,.65),
  roughnessMap:maps.rough,roughness:.94,metalness:.03
 });
 const steel=new THREE.MeshStandardMaterial({
  name:'Bunker ballistic gunmetal plate',color:'#4a5354',
  map:maps.color,normalMap:maps.normal,
  normalScale:new THREE.Vector2(.24,.24),roughness:.55,metalness:.69
 });
 const trim=new THREE.MeshStandardMaterial({
  name:'Bunker weathered olive steel',color:'#6b6c5b',
  map:maps.color,roughness:.64,metalness:.53
 });
 const interior=new THREE.MeshStandardMaterial({
  name:'Bunker recessed pitch-black firing well',color:'#111818',
  roughness:.97,metalness:.07,side:THREE.DoubleSide
 });
 const doorway=new THREE.MeshStandardMaterial({
  name:'Bunker protected armored entrance',color:'#343b3c',
  map:maps.color,normalMap:maps.normal,roughness:.65,metalness:.68
 });
 const faction=new THREE.MeshStandardMaterial({
  name:'Bunker faction enamel plate',color:FACTION_PAINT[owner],
  roughness:.43,metalness:.39
 });
 const boltMat=new THREE.MeshStandardMaterial({
  name:'Bunker blasted rivet heads',color:'#777b73',
  roughness:.54,metalness:.78
 });
 // Keep authored 512px normal/ORM and correct team cloth intact; generic
 // world-space khaki repainting must never flatten these PBR surfaces.
 for(const mat of [concrete,plaster,steel,trim,interior,doorway,faction,boltMat])
  mat.userData.sandforgeAuthoredBunker=true;
 const staticMeshes=[];
 const add=(name,geometry,material,x,y,z,ry=0)=>{
  const m=new THREE.Mesh(geometry,material);
  m.name=name;m.position.set(x,y,z);m.rotation.y=ry;
  m.castShadow=true;m.receiveShadow=true;m.raycast=()=>{};
  root.add(m);staticMeshes.push(m);return m;
 };
 const box=(name,w,h,d,material,x,y,z,ry=0)=>
  add(name,new THREE.BoxGeometry(w,h,d),material,x,y,z,ry);
 const polygon=(name,top,bottom,h,material,y)=>
  add(name,new THREE.CylinderGeometry(top,bottom,h,8,1),material,0,y,0,Math.PI/8);
 // All dimensions stay inside the 155-unit authored bunker footprint.
 polygon('Bunker_PBR_SteppedConcreteFoot',69,72,6,concrete,3);
 polygon('Bunker_ReinforcedLowerPlinth',62,66,8,plaster,9);
 const radius=49.5;
 const faces=Array.from({length:8},(_,i)=>i*Math.PI/4);
 // Eight load-bearing facades. On FIVE faces the embrasure is physically
 // OPEN between concrete sill, upper lintel and two narrow armoured jambs.
 // The sunken dark interior is intentionally BEHIND the opening, not a sticker.
 for(let i=0;i<8;i++){
  const a=faces[i],sn=Math.sin(a),cs=Math.cos(a),x=radius*sn,z=radius*cs;
  const wall=(suffix,w,h,d,mat,dy,off=0)=>
   box('BunkerWall_'+i+'_'+suffix,w,h,d,mat,
    x+sn*off,dy,z+cs*off,a);
  const firing=[0,1,2,6,7].includes(i);
  const rear=i===4;
  if(firing){
   wall('concrete-foundation',42,16,11,concrete,18,0);
   wall('concrete-brow',42,11,11,concrete,40.5,0);
   // The jambs need local horizontal offsets; the centre remains open:
   for(const side of [-1,1])box('Bunker_Window_ReinforcedPost_'+i+'_'+side,
    9,14,13,steel,x+Math.cos(a)*side*16,31.3,z-Math.sin(a)*side*16,a);
   // Five preserved, separately identifiable recessed firing windows.
   const recess=new THREE.Mesh(new THREE.PlaneGeometry(23,10),interior);
   recess.name='Bunker_Embrasure_'+(i+1);
   recess.position.set(x-sn*6.7,31,z-cs*6.7);
   recess.rotation.y=a;recess.raycast=()=>{};
   recess.castShadow=false;recess.receiveShadow=true;root.add(recess);
   wall('WindowSteelHood',26,2.5,14,steel,38,2.4);
   wall('WindowSteelSill',27,2.6,15,steel,24.2,2.9);
   for(const side of [-1,1])
    box('Bunker_WindowSideArmor_'+i+'_'+side,2.3,13,15,trim,
     x+Math.cos(a)*side*12.4+sn*2.7,30.8,
     z-Math.sin(a)*side*12.4+cs*2.7,a);
   // Inner black louvres and sight-deflecting angled inner baffles.
   for(const v of [-5,0,5])
    box('Bunker_InteriorBallisticLouver_'+i,4,1.15,4,steel,
     x+Math.cos(a)*v-sn*4,31.3,z-Math.sin(a)*v-cs*4,a);
  }else if(rear){
   wall('BackLowSill',43,9,12,concrete,12.5,0);
   wall('BackRoof',43,8,12,concrete,44,0);
   for(const side of [-1,1])
    box('Bunker_ProtectedRearDoorJamb_'+side,10,29,15,plaster,
     x+Math.cos(a)*side*16,29,z-Math.sin(a)*side*16,a);
   wall('ArmoredBlastDoor',25,32,2.6,doorway,27.5,-4);
   wall('BlastDoorLockingRail',3,31,5,steel,27.5,1.9);
   wall('HeavyEntranceLintel',36,4,15,steel,40.7,2);
   for(const y of [17,27,36])
    wall('DoorCrossBrace',24,1.8,4,trim,y,1.0);
  }else wall('SolidReinforcedConcrete',43,34,11,concrete,30,0);
  // Chipped exterior protection and real exposed reinforcing buttresses.
  for(const side of [-1,1])
   box('Bunker_Buttress_'+i+'_'+side,6.2,30,15,trim,
    x+Math.cos(a)*side*20+sn*3,30,
    z-Math.sin(a)*side*20+cs*3,a);
  wall('HorizontalWeatheredArmorBelt',44,3,13,steel,16.5,3);
 }
 // Low, angular bunker roof: substantial overhang, layered reinforced
 // concrete, armor sheets, rain-scarred blast coping and vent assemblies.
 polygon('Bunker_RoofLowerConcrete',66,59,8,plaster,51);
 polygon('Bunker_RoofBallisticSteel',58,61,5,steel,57);
 polygon('Bunker_RoofUpperConcrete',45,50,4,concrete,61.5);
 for(const i of [0,2,4,6]){
  const a=faces[i],x=Math.sin(a)*48,z=Math.cos(a)*48;
  box('Bunker_RoofCoping_'+i,26,3,7,trim,x,61.5,z,a);
 }
 // Distinct roof ventilation shafts and protected maintenance hatches.
 for(const x of [-20,18]){
  box('Bunker_RoofLowVent',19,6,12,steel,x,64,-11);
  for(let i=0;i<5;i++)
   box('Bunker_Louver',16,1.0,1.6,interior,x,66,-16+i*2.6);
  box('Bunker_VentTop',21,2.5,15,trim,x,68,-11);
 }
 box('Bunker_RoofMaintenanceAccess',23,2.7,25,steel,0,64.8,27);
 for(const x of [-7,0,7])
  box('Bunker_RoofHatchBrace',2.5,2,23,boltMat,x,66.2,27);
 // Tank-style small fastener heads on retaining walls (batched later).
 const rivet=new THREE.CylinderGeometry(.78,.78,1.6,6);
 for(let i=0;i<8;i++){
  const a=faces[i],cx=Math.sin(a)*57,cz=Math.cos(a)*57;
  for(const lateral of [-16,-6,6,16])for(const y of [14,44]){
   const x=cx+Math.cos(a)*lateral,z=cz-Math.sin(a)*lateral;
   const m=add('Bunker_SteelRivet',rivet.clone(),boltMat,x,y,z);
   m.rotation.x=Math.PI/2;m.rotation.z=a;
  }
 }
 rivet.dispose();
 // Two shallow steps outside the rear door, no walkway or new collision.
 box('Bunker_DoorExternalThreshold',31,3,15,steel,0,7,-65);
 box('Bunker_DoorStep',36,2.5,18,plaster,0,3.8,-73);
 box('Bunker_FactionCoatOfArms',29,3,8,faction,0,60,46);
 // Flagpole is behind the parapet, inside the actual physical footprint.
 add('Bunker_FlagMast',new THREE.CylinderGeometry(.85,1.45,34,8),
  boltMat,-29,81,-14);
 add('Bunker_FlagCap',new THREE.SphereGeometry(2.7,8,6),
  trim,-29,100,-14);
 const fabric=new THREE.PlaneGeometry(23,13,12,6);
 const uv=fabric.getAttribute('position');
 for(let i=0;i<uv.count;i++){
  const x=uv.getX(i),y=uv.getY(i);
  uv.setZ(i,(x/11.5+.4)*Math.sin(x*.30+y*.14)*.65);
 }
 fabric.computeVertexNormals();
 const flag=new THREE.Mesh(fabric,flagMaterial(owner));
 flag.name=owner===1?'Bunker_RedFactionFlag':'Bunker_BlueFactionFlag';
 flag.position.set(-17.5,87,-14);
 flag.castShadow=false;flag.receiveShadow=true;flag.raycast=()=>{};
 flag.userData={visualOnly:true,nonPlayable:true,bunkerFlag:true,owner};
 root.add(flag);
 // The bunker used to consume a separate draw for every simple box / bolt.
 // Batch every static mesh by material; preserve five named firing openings
 // and the separate physically waving flag for testing and RTS readability.
 const buckets=new Map();
 for(const mesh of staticMeshes){
  mesh.updateMatrix();
  const item=mesh.geometry.clone();item.applyMatrix4(mesh.matrix);
  const list=buckets.get(mesh.material)??[];
  list.push(item);buckets.set(mesh.material,list);
  root.remove(mesh);mesh.geometry.dispose();
 }
 let idx=0;
 for(const [material,items] of buckets){
  const joined=mergeGeometries(items,false);
  items.forEach(item=>item.dispose());
  if(!joined)throw new Error('Bunker geometry PBR batching failed');
  const combined=new THREE.Mesh(joined,material);
  combined.name='Bunker_PBR_StaticBatch_'+idx++;
  combined.castShadow=true;combined.receiveShadow=true;combined.raycast=()=>{};
  root.add(combined);
 }
 root.userData.bunkerDrawCalls=root.children.filter(x=>x.isMesh).length;
 root.userData.bunkerPbrTextureResolution=512;
 return root;
}
