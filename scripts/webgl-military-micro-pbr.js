import * as THREE from 'three';

/** Fine surface detail on UV/PBR assets already shipped in Sandforge.
 * The source albedo, normal, ORM, camouflage, faction paint and geometry
 * remain untouched. A shared seamless 512px albedo/roughness microtexture
 * contributes chipped paint, concrete pores, mineral speckles, fine wear and
 * sparse panel scratches to appropriate armour/structural surfaces.
 *
 * One extra sampler, ZERO new meshes/draw calls, no CPU work per frame.
 * Non-destructive material clones are disposed per actor/model on despawn.
 */
export const MILITARY_MICRO_PBR_REVISION='sandforge-military-micro-pbr-v1-20261120';
const VEHICLES=new Set(['rover','tank','artillery','scout','bomber']);
// Building GLBs have independent, already authored PBR and faction shader
// stacks. Vehicle-only until a separately reviewed building material pass.
const EXCLUDE=/wheel|tire|tyre|track|tread|roadwheel|sprocket|rubber|window|windscreen|windshield|glass|canopy|visor|mirror|optic|sensor|lens|light|lamp|emissive|glow|beacon|flag|team|faction|emblem|badge|roundel|stripe|marking|antenna|mast|rotor|blade|propeller|weapon|gun|cannon|barrel|muzzle|missile|rocket|exhaust|smoke|shadow|invisible|collider|transparent|interior|instrument|screen|radar|ladder|hinge|handle|hydraulic|seat|seatbelt|cable|grill|grille|louver|louvre|door|gate|shutter/i;
const STRUCTURAL=/hull|shell|body|fuselage|armour|armor|plate|camo|camouflage|paint|steel|metal|panel|side|roof|front|rear|frame|chassis|concrete|plaster|sandstone|stone|cement|wall|facade|structure|cladding|building|base|factory|hangar|housing/i;
export function militarySurfaceRole(kind,type,meshName='',materialName='',material=null){
 // Never amend HQ, barracks or other buildings: it caused black facades.
 if(type!=='unit'||!VEHICLES.has(kind))return null;
 if(material&&!material.isMeshStandardMaterial)return null;
 if(material?.transparent&&material.opacity<.96)return null;
 if(material?.emissiveIntensity>.25&&material.emissive?.getHex?.()!==0)return null;
 const name=(meshName+' '+materialName).toLowerCase();
 if(EXCLUDE.test(name)||material?.userData?.teamMarking||material?.userData?.sandforgePreviewMaterial)return null;
 if(!STRUCTURAL.test(name)){
  // Some old vehicle GLBs have anonymous chassis materials. Material only:
  // still use the source PBR, but avoid repainting tiny fittings.
  if(type==='unit'&&!material?.map)return null;
  if(type==='building')return null;
 }

 if(/matte|paint|camo|camouflage|hull|fuselage|armour|armor|panel|body/i.test(name))
  return 'armour';
 return 'metal';
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const maps=new Map();
function makeMicrotexture(role){
 if(maps.has(role))return maps.get(role);
 const n=512,rgba=new Uint8Array(n*n*4),roleSalt=role==='concrete'?17:role==='metal'?93:51;
 const hash=(x,y,salt=0)=>{
  const X=(x+n)%n,Y=(y+n)%n;
  let h=Math.imul(X+23,374761393)^Math.imul(Y+113,668265263)^(roleSalt+salt);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
 };
 const noise=(x,y,cell,salt)=>{
  const u=x/cell,v=y/cell,i=Math.floor(u),j=Math.floor(v),fx=smooth(u-i),fy=smooth(v-j);
  const N=n/cell,q=(x,y)=>hash((x%N+N)%N,(y%N+N)%N,salt);
  return (q(i,j)*(1-fx)+q(i+1,j)*fx)*(1-fy)+
   (q(i,j+1)*(1-fx)+q(i+1,j+1)*fx)*fy;
 };
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const fine=hash(x,y,roleSalt),pore=noise(x,y,8,7),
   middle=noise(x,y,32,11),broad=noise(x,y,128,31),
   scratch=Math.abs(Math.sin(x*.21+y*.037+middle*5))<.011?1:0,
   dimple=hash(x,y,19)>.996?1:0,chip=middle>.78&&fine>.89?1:0,
   dust=smooth((broad-.37)/.42),age=smooth((pore-.53)/.4);
  let pigment=.972+(fine-.5)*.068+(middle-.5)*.078+
    (broad-.5)*.047-.050*chip-.041*dimple;
  if(role==='metal')pigment-=scratch*.060;
  if(role==='concrete')pigment-=age*.036;
  pigment=clamp(pigment,.73,1.02);
  const i=(y*n+x)*4;
  rgba[i]=Math.round(255*pigment);
  rgba[i+1]=Math.round(255*clamp(pigment+(role==='concrete'?.014:-.004),.0,1));
  rgba[i+2]=Math.round(255*clamp(pigment+(role==='concrete'?.024:-.012),.0,1));
  // Roughness is stored in alpha; it shifts an already valid source ORM map.
  rgba[i+3]=Math.round(255*clamp(.59+dust*.29+(fine-.5)*.1-
   (role==='metal'?.14*scratch:0),.35,1));
 }
 const map=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 map.name='SandforgeAuthoredMicroPBR-'+role;
 map.colorSpace=THREE.NoColorSpace; // numeric multipliers + roughness, not color data
 map.wrapS=map.wrapT=THREE.RepeatWrapping;
 map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
 map.generateMipmaps=true;map.anisotropy=8;map.needsUpdate=true;
 maps.set(role,map);return map;
}
export function enhanceMilitaryMicroPBR(root,{kind,type}={}){
 if(!root)return {materials:0,roles:[],revision:MILITARY_MICRO_PBR_REVISION};
 const clones=new Map(),roles=new Set();let updated=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh)return;
  const adapt=source=>{
   const role=militarySurfaceRole(kind,type,mesh.name,source?.name,source);
   if(!role||source.userData?.sandforgeMilitaryMicroPBR===MILITARY_MICRO_PBR_REVISION)
    return source;
   const key=source.uuid+'|'+role;
   if(clones.has(key))return clones.get(key);
   // Faction and armour-paint materials already belong to this actor.
   // Decorate IN PLACE, never orphan a per-actor clone.
   const alreadyOwned=Boolean(source.userData?.sandforgeFactionTint||
    source.userData?.sandforgeArmourOwnedPaint||source.userData?.sandforgeHelicopterOwnedPaint||
    source.userData?.sandforgeBuildingPBROwned||source.userData?.sandforgeBuildingFill||
    source.userData?.sandforgeBuildingFacadeOwned);
   const mat=alreadyOwned?source:source.clone();
   const previous=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey.bind(mat);
   const overlay=makeMicrotexture(role);
   // Original GLB units are meters on vehicles and larger model units on
   // bases. Different tile constants keep scratches sub-centimeter sized.
   const tile=type==='unit'?3.6:18.0;
   const weight=role==='metal'?.54:role==='concrete'?.63:.58;
   mat.onBeforeCompile=function(shader,renderer){
    previous?.call(this,shader,renderer);
    shader.uniforms.sfMicroSurface={value:overlay};
    const nl=String.fromCharCode(10);
    const varying='varying vec3 vSFMicroLocal;varying vec3 vSFMicroNormal;';
    shader.vertexShader=shader.vertexShader
     .replace('#include <common>','#include <common>'+nl+varying)
     .replace('#include <begin_vertex>','#include <begin_vertex>'+nl+'vSFMicroLocal=position;')
     .replace('#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>'+nl+'vSFMicroNormal=objectNormal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>'+nl+varying+'uniform sampler2D sfMicroSurface;');
    const code=[
     'vec3 sfMicroWeights=pow(abs(normalize(vSFMicroNormal))+.008,vec3(3.2));',
     'sfMicroWeights/=sfMicroWeights.x+sfMicroWeights.y+sfMicroWeights.z;',
     'vec3 sfMicroXYZ=vSFMicroLocal/'+tile.toFixed(3)+';',
     'vec4 sfMicroSample=texture2D(sfMicroSurface,sfMicroXYZ.yz)*sfMicroWeights.x',
     ' +texture2D(sfMicroSurface,sfMicroXYZ.xz)*sfMicroWeights.y',
     ' +texture2D(sfMicroSurface,sfMicroXYZ.xy)*sfMicroWeights.z;',
     'diffuseColor.rgb*=mix(vec3(1.0),sfMicroSample.rgb,'+weight.toFixed(3)+');'
    ].join(nl);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
     '#include <color_fragment>'+nl+code);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
     '#include <roughnessmap_fragment>'+nl+
     'roughnessFactor=clamp(roughnessFactor*(.925+.14*sfMicroSample.a),.24,1.0);');
   };
   mat.customProgramCacheKey=()=>oldKey()+'|'+MILITARY_MICRO_PBR_REVISION+'|'+role+'|'+tile;
   mat.userData={...source.userData,
    sandforgeMilitaryMicroPBR:MILITARY_MICRO_PBR_REVISION,
    sandforgeMilitaryMicroPBROwned:!alreadyOwned,role};
   mat.needsUpdate=true;clones.set(key,mat);roles.add(role);updated++;return mat;
  };
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(adapt):adapt(mesh.material);
 });
 return {materials:updated,roles:[...roles],revision:MILITARY_MICRO_PBR_REVISION};
}
