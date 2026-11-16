import * as THREE from 'three';

/** Sandforge building MATERIALS, not another world-space decal layer.
 * Five authored seamless image assets are assigned to only compatible
 * facade/roof/trim meshes. Local-space triplanar UVs are stable when a
 * build ghost moves or rotates, including authored GLBs with packed atlases.
 * Original GLB geometry, UVs, doors, PBR wear/normal maps and animations
 * are preserved. No meshes or draw calls are added.
 */
export const DESERT_BUILDING_PBR_REVISION='sandforge-authored-building-pbr-v3-matched-facades-20261117';
export const DESERT_BUILDING_KINDS=Object.freeze(['barracks','headquarters','factory','airfield']);
const root='/src/assets/reborn/buildings-3d/textures/';
export const DESERT_BUILDING_IMAGES=Object.freeze({
 wall:root+'desert-wall-plaster.svg',
 camo:root+'desert-camo-panel.svg',
 roof:root+'desert-roof-dust.svg',
 metal:root+'desert-worn-metal.svg',
 trim:root+'desert-trim-edge.svg'
});
const settings=Object.freeze({
 wall:Object.freeze({coverage:.70,roughness:.91,metalness:.03,scale:1.4}),
 camo:Object.freeze({coverage:.85,roughness:.92,metalness:.03,scale:1.8}),
 roof:Object.freeze({coverage:.61,roughness:.82,metalness:.15,scale:1.65}),
 metal:Object.freeze({coverage:.34,roughness:.73,metalness:.43,scale:2.3}),
 trim:Object.freeze({coverage:.36,roughness:.79,metalness:.26,scale:2.1})
});
// Preserve moving equipment, active door shutters and ownership insignias.
const exclude=/door|gate|shutter|portal|entrance|airlock|fan|vent|louv|grill|window|glass|beacon|lamp|emiss|flag|identification|faction|radar|antenna|mast|radio|blade|hub|bolt|fastener|ladder|stair|rail|pipe|exhaust|duct|cable|handle|hinge|hydraulic|weapon|gun|screen|display|light|transparent|interior|wheel|piston|rotor|tyre|tire|warning|safety|chevron|hazard|equipment|case|strap|hoist|counterweight/i;
const camouflage=/barrackscamosidepanel|roofcamo|sideReplaceableArmour|servicewallcassette|sidecamo|camopanel|canvas|tarpaulin|camo.*panel|camouflage.*panel/i;
const roofing=/roof|canopy|ceiling|topplate|upperplating|roofarmour|roofarmor/i;
const walls=/ceramichull|sandstone|concrete|plaster|facade|façade|wall|solidSide|outerHull|mainHull|structuralHull|cladding|sidepanel|sideplate|stucco/i;
const steel=/armouredhull|armoredhull|metal|steel|armour|armor|column|strut|support|plating|blastRib/i;
const edging=/trim|edge|joint|skirt|perimeter|jamb|frame|border|cassette/i;

/** Mesh-name priority is deliberate: leave all production gates and
 * moving doors alone even if their material is labelled steel or camouflage. */
export function buildingSurfaceRole(kind,meshName='',materialName=''){
 if(!DESERT_BUILDING_KINDS.includes(kind))return null;
 const mesh=String(meshName).toLowerCase();
 const mat=String(materialName).toLowerCase();
 const name=mesh+' '+mat;
 // Authored factory/hangar GLBs use batched mesh names per material.
 // Repaint the exterior wall ONLY, not the roof, shutters, glass, factory
 // production doors, hangar roof corrugation or mechanical equipment.
 if(kind==='airfield')return mesh==='sf_airfield_pbr_camo'?'wall':null;
 if(kind==='factory'&&mesh.startsWith('sf_factory_pbr_'))
  return mesh==='sf_factory_pbr_camo'?'wall':null;
 if(exclude.test(mesh))return null;
 if(camouflage.test(mesh))return 'camo';
 if(roofing.test(mesh))return 'roof';
 if(walls.test(mesh))return 'wall';
 if(steel.test(mesh))return 'metal';
 if(edging.test(mesh))return 'trim';
 // Generic material labels are only a fallback for genuine exterior meshes.
 if(/hull|outer|side|panel|body|shell|structure/i.test(mesh)){
  if(/camouflage|camo|desert paint/.test(mat))return 'camo';
  if(/plaster|concrete|sandstone|ceramic/.test(mat))return 'wall';
  if(/steel|metal|armour|armor/.test(mat))return 'metal';
 }
 return null;
}
const textures=new Map();
const textureReady=new Map();
const fallbackColor={
 wall:'#cbbc9e',camo:'#c6b695',roof:'#b9ab91',metal:'#555954',trim:'#776f5f'
};
const makeMaps=role=>{
 const n=256,pixels=new Uint8Array(n*n*4),roughness=new Uint8Array(n*n*4);
 // High-resolution tileable stochastic microrelief instead of a 96px
 // repeated sine wave: no straight bands under low golden-hour sunlight.
 // Generated once per material role, shared across EVERY building instance.
 const hash=(x,y)=>{
  const a=(x+n)%n,b=(y+n)%n;
  let h=Math.imul(a+1,73856093)^Math.imul(b+1,19349663);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
 };
 const smooth=(x,y,cell)=>{
  const u=x/cell,v=y/cell,i=Math.floor(u),j=Math.floor(v);
  const fx=(u-i)**2*(3-2*(u-i)),fy=(v-j)**2*(3-2*(v-j));
  const grid=(i,j)=>hash(((i%(n/cell))+(n/cell))%(n/cell),
   ((j%(n/cell))+(n/cell))%(n/cell));
  const a=grid(i,j)*(1-fx)+grid(i+1,j)*fx;
  const b=grid(i,j+1)*(1-fx)+grid(i+1,j+1)*fx;
  return a*(1-fy)+b*fy;
 };
 const height=(x,y)=>(smooth(x,y,32)-.5)*.42+
  (smooth(x,y,8)-.5)*.22+(hash(x,y)-.5)*.07;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const dx=(height(x+1,y)-height(x-1,y))*.28;
  const dy=(height(x,y+1)-height(x,y-1))*.28;
  const nx=-dx,ny=-dy,nz=1;
  const len=Math.hypot(nx,ny,nz),idx=(y*n+x)*4;
  pixels[idx]=Math.round((nx/len*.5+.5)*255);
  pixels[idx+1]=Math.round((ny/len*.5+.5)*255);
  pixels[idx+2]=Math.round((nz/len*.5+.5)*255);
  pixels[idx+3]=255;
  const r=Math.max(166,Math.min(255,Math.round(220+height(x,y)*31)));
  roughness[idx]=r;roughness[idx+1]=r;roughness[idx+2]=r;roughness[idx+3]=255;
 }
 const normal=new THREE.DataTexture(pixels,n,n,THREE.RGBAFormat);
 const rough=new THREE.DataTexture(roughness,n,n,THREE.RGBAFormat);
 for(const tex of [normal,rough]){
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.magFilter=THREE.LinearFilter;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps=true;tex.anisotropy=8;tex.needsUpdate=true;
 }
 normal.name='SandforgeDesertBuildingNormal-'+role;
 rough.name='SandforgeDesertBuildingRoughness-'+role;
 return {normal,roughness:rough};
};
/** Resolves shared image maps once. TextureLoader.load does not require an
 * await for the THREE.Texture object: when the SVG loads Three uploads it. */
function roleMaps(role){
 if(textures.has(role))return textures.get(role);
 let albedo;
 if(typeof document==='undefined'){
  const c=new THREE.Color(fallbackColor[role]);
  const r=new Uint8Array([
   Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255),255
  ]);
  albedo=new THREE.DataTexture(r,1,1,THREE.RGBAFormat);
  albedo.needsUpdate=true;
 }else{
  let resolveReady,rejectReady;
  const loaded=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  albedo=new THREE.TextureLoader().load(DESERT_BUILDING_IMAGES[role],
   ()=>resolveReady(),undefined,error=>rejectReady(error));
  textureReady.set(role,loaded);
 }
 albedo.name='SandforgeDesertBuildingAlbedo-'+role;
 albedo.colorSpace=THREE.SRGBColorSpace;
 albedo.wrapS=albedo.wrapT=THREE.RepeatWrapping;
 albedo.minFilter=THREE.LinearMipmapLinearFilter;
 albedo.magFilter=THREE.LinearFilter;
 albedo.anisotropy=8; // clearer oblique PBR facades at tactical camera angles
 const detail=makeMaps(role);
 const result={albedo,...detail};
 textures.set(role,result);
 return result;
}

/** Wait for the exact textures already shared by the HUD and gameplay.
 * Do not render a dark/unloaded portrait during the first model load. */
export function waitForDesertBuildingTextures(){
 for(const role of Object.keys(DESERT_BUILDING_IMAGES))roleMaps(role);
 return Promise.all([...textureReady.values()]);
}

/** A single pass per material. It incorporates the new authored imagery
 * into the physical PBR color calculation; NOT an overlay plane/geometry.
 * The shader is independent of model world position (the old camo slid as
 * the placement ghost moved). Keep the old GLTF maps as subtle surface wear.
 */
export function finishDesertBuildingMaterials(model,kind){
 if(!model||!DESERT_BUILDING_KINDS.includes(kind))return 0;
 const instances=new Map();let painted=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.sandforgeBarracksPropPolish)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const result=materials.map(source=>{
   if(!source?.isMeshStandardMaterial)return source;
   const role=buildingSurfaceRole(kind,mesh.name,source.name);
   if(!role||source.transparent&&source.opacity<.45)return source;
   if(source.userData?.sandforgeBuildingPBRRevision===DESERT_BUILDING_PBR_REVISION&&
      source.userData?.sandforgeBuildingPBRRole===role)return source;
   const key=source.uuid+'|'+role;
   if(instances.has(key))return instances.get(key);
   // Ghost validity code holds pointers to preview materials; they must not
   // be replaced. Imported GLTF materials are isolated from the template.
   const ghost=source.userData?.sandforgePreviewMaterial===true;
   const material=ghost?source:source.clone();
   const maps=roleMaps(role),config=settings[role];
   // Authored factory/hangar shell must use the exact same "wall" atlas
   // as the barracks/HQ ceramic hull, not the checkerboard camo-panel atlas.
   // The hangar uses full-size GLB coordinates; factory uses small local
   // coordinates similar to barracks. Neither inherits a high-frequency
   // paint pattern underneath the new shared exterior coating.
   const authoredWallShell=role==='wall'&&
    (kind==='airfield'||kind==='factory');
   const uvScale=kind==='airfield'?.027:config.scale;
   const wallCoverage=authoredWallShell?1:config.coverage;
   if(!material.normalMap)material.normalMap=maps.normal;
   if(!material.roughnessMap)material.roughnessMap=maps.roughness;
   material.roughness=Math.max(material.roughness,config.roughness);
   if(role==='metal'||role==='trim')material.metalness=Math.max(material.metalness,config.metalness);
   else material.metalness=Math.min(material.metalness,.20);
   // The old orange emissive atlas reintroduced bronze after recoloring.
   // Only the eligible shell paint receives neutral ambient fill.
   if(!ghost){
    material.emissiveMap=null;
    material.emissive.set('#49473e');
    material.emissiveIntensity=.075;
   }
   material.userData={
    ...material.userData,
    sandforgeBuildingPBRRevision:DESERT_BUILDING_PBR_REVISION,
    sandforgeBuildingPBRRole:role,
    sandforgeBuildingPBROwned:!ghost,
    sandforgeColorMapCamo:true
   };
   // Override the two legacy painted shaders ONLY on eligible shell parts:
   // their arbitrary world coordinates and aggressive 94% repaint no longer
   // compete with the new real PBR images.
   material.onBeforeCompile=function(shader){
    shader.uniforms.sfBuildingAlbedo={value:maps.albedo};
    const varying='varying vec3 sfBuildingLocal;varying vec3 sfBuildingNormal;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\n'+varying);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfBuildingLocal=transformed;');
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
     '#include <beginnormal_vertex>\nsfBuildingNormal=objectNormal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\n'+varying+'\nuniform sampler2D sfBuildingAlbedo;');
    const coating=[
     '#include <color_fragment>',
     'vec3 sfBP=abs(normalize(sfBuildingNormal))+.015;',
     'sfBP=pow(sfBP,vec3(4.));sfBP/=sfBP.x+sfBP.y+sfBP.z;',
     'vec3 sfP=sfBuildingLocal*'+uvScale.toFixed(3)+';',
     'vec3 sfPaint=texture2D(sfBuildingAlbedo,sfP.zy).rgb*sfBP.x',
     ' +texture2D(sfBuildingAlbedo,sfP.xz).rgb*sfBP.y',
     ' +texture2D(sfBuildingAlbedo,sfP.xy).rgb*sfBP.z;',
     // Old GLBs baked a very dark checkerboard into the wall's base-color
     // texture. A 98.5% overlay still multiplied the new paint by that
     // checkerboard via sfWear, so eliminate it ONLY for the authored wall.
     // Other building roles retain their normal weathering and join shading.
     (authoredWallShell?'float sfWear=1.0;':
      'float sfWear=clamp(.60+dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*.66,.36,1.12);'),
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfPaint*sfWear,'+wallCoverage.toFixed(3)+');'
    ].join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',coating);
   };
   material.customProgramCacheKey=()=>DESERT_BUILDING_PBR_REVISION+'|'+kind+'|'+role;
   material.needsUpdate=true;
   instances.set(key,material);painted++;
   return material;
  });
  mesh.material=Array.isArray(mesh.material)?result:result[0];
 });
 return painted;
}
