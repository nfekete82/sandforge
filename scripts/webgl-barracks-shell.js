import * as THREE from 'three';

// Cosmetic side cladding for the original 11 November barracks GLB.
// Authored model coordinates are Y-up and front-facing +Z. The existing
// armoured hull, portal, clips, textures and all interaction stay intact.
// Apply the same finish to game actors, construction ghosts and HUD portrait.
export function finishBarracksSides(model){
 if(!model)return null;
 const root=model.getObjectByName('Atlas_barracks')??model;
 const found=root.getObjectByName('SandforgeBarracksSideCladding');
 if(found)return found;
 let sand=null,steel=null;
 root.traverse(node=>{
  if(!node.isMesh)return;
  if(!sand&&/Atlas_CeramicHull_/.test(node.name))sand=Array.isArray(node.material)?node.material[0]:node.material;
  if(!steel&&/Atlas_ArmouredHull_/.test(node.name))steel=Array.isArray(node.material)?node.material[0]:node.material;
 });
 const group=new THREE.Group();
 group.name='SandforgeBarracksSideCladding';
 group.userData={visualOnly:true,nonPlayable:true,barracksSideFinish:true};
 const geometry=new THREE.BoxGeometry(1,1,1);
 const material=(source,color,roughness,metalness)=>{
  const m=source?.isMeshStandardMaterial?source.clone():new THREE.MeshStandardMaterial();
  m.color.set(color);m.roughness=roughness;m.metalness=metalness;
  m.userData={...m.userData,sandforgeBarracksSideMaterial:true};
  return m;
 };
 const paints=[
  material(sand,'#d6c49c',.86,.08),
  material(sand,'#b5ae8a',.9,.06),
  material(sand,'#bcb08d',.88,.07)
 ];
 const edge=material(steel,'#736b58',.67,.37);
 const vent=material(steel,'#3f4540',.78,.33);
 function box(name,scale,position,mat){
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name=name;mesh.scale.set(...scale);mesh.position.set(...position);
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,nonPlayable:true};
  group.add(mesh);return mesh;
 }
 for(const side of [-1,1]){
  // An uninterrupted sand-coloured structural wall behind the individually
  // fitted cladding cassettes; no blue gaps at oblique camera angles.
  box('BarracksSolidSideWall_'+side,[.09,1.07,1.94],
   [side*1.395,.78,0],paints[0]);
  for(let i=0;i<3;i++){
   const z=-.64+i*.64;
   box('BarracksCamoSidePanel_'+side+'_'+i,[.065,.88,.595],
    [side*1.462,.83,z],paints[(i+(side===1?0:1))%3]);
  }
  for(const z of [-.319,.319]){
   box('BarracksPanelJoint_'+side+'_'+z,[.029,.89,.026],
    [side*1.504,.83,z],edge);
  }
  // One recessed service vent per flank; the airlock at +Z stays untouched.
  box('BarracksSideVent_'+side,[.032,.23,.37],
   [side*1.506,.98,-.48],vent);
  for(let i=0;i<3;i++)box('BarracksVentLouvre_'+side+'_'+i,
   [.038,.023,.33],[side*1.529,.91+i*.068,-.48],edge);
 }
 root.add(group);
 return group;
}


/** Regrade the orange/bronze albedo of the original 11-November Kasernen GLB.
 * Existing PBR maps, scratches, normal maps, geometry and doors stay intact.
 * Install AFTER faction/ghost material cloning so the final shader survives.
 * Local geometry coordinates keep camouflage fixed while moving the ghost.
 */
export const BARRACKS_PALETTE_REVISION='barracks-sand-khaki-v1-20261115';
const paletteSkip=/airlock|blastdoor|door|fan|vent|grille|window|glass|beacon|flag|signal|identification|hinge|antenna|radio|ladder|safety|pipe|bolt|interior|recess|grate|equipment|engine|service|track|wheel|tube|louvre/i;
const palettePaint=/ceramic|armoured|armor|armour|hull|roof|facade|wall|cladding|panel|camo|camouflage|sandstone|plaster|concrete|atlasupgrade_barracks_/i;
export function finishBarracksDesertPalette(model){
 if(!model)return 0;
 const root=model.getObjectByName('Atlas_barracks')??model;
 const owned=new Map();let painted=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.userData?.sandforgeBarracksPropPolish)return;
  const convert=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   const role=(mesh.name+' '+source.name).toLowerCase();
   if(paletteSkip.test(role)||!palettePaint.test(role))return source;
   if(source.userData?.sandforgeBarracksPalette===BARRACKS_PALETTE_REVISION)return source;
   if(owned.has(source))return owned.get(source);
   // Preserve the live ghost material reference: validity updates keep
   // tinting this exact object red/green as the placement cursor moves.
   // GLB template materials are unowned and still require their own clone.
   const instanceOwned=source.userData?.sandforgePreviewMaterial||
    source.userData?.sandforgeFactionTint||
    source.userData?.sandforgeBarracksSideMaterial||
    source.userData?.sandforgeBuildingFill;
   const material=instanceOwned?source:source.clone();
   const steel=/atlasupgrade_barracks_steel|armoured|armour/.test(role);
   const coverage=steel?.68:.94;
   // Prevent the old warm emissive texture from tinting the neutral paint.
   material.emissiveMap=null;
   material.emissive.set('#665f4f');
   material.emissiveIntensity=.10;
   material.roughness=Math.max(material.roughness,.78);
   material.userData={...material.userData,
    sandforgeBarracksPalette:BARRACKS_PALETTE_REVISION,
    sandforgeColorMapCamo:true};
   // Override the generic world-coordinate camouflage shader for this GLB.
   // The original texture's dark seams are retained in sfLum and sfMask.
   material.onBeforeCompile=function(shader){
    const varying='varying vec3 sfBarracksLocal;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\n'+varying);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfBarracksLocal=transformed;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\n'+varying);
    const paint=[
     '#include <color_fragment>',
     'float sfLum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));',
     'float sfWarm=smoothstep(.015,.11,diffuseColor.r-diffuseColor.b);',
     'float sfPatch=sin(sfBarracksLocal.x*5.8+sin(sfBarracksLocal.z*3.6)*.7)',
     ' +cos(sfBarracksLocal.z*5.1-sfBarracksLocal.y*3.2);',
     'float sfKhaki=smoothstep(-.5,.9,sfPatch);',
     'vec3 sfSand=mix(vec3(.83,.77,.63),vec3(.66,.67,.54),sfKhaki*.42);',
     'float sfGrain=clamp(.37+sqrt(max(sfLum,0.0))*1.04,.36,1.12);',
     'float sfMask=smoothstep(.075,.19,sfLum)*mix(.28,1.0,sfWarm);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,sfSand*sfGrain,sfMask*'+coverage.toFixed(2)+');'
    ].join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',paint);
   };
   material.customProgramCacheKey=()=>BARRACKS_PALETTE_REVISION+(steel?'-steel':'-paint');
   material.needsUpdate=true;
   owned.set(source,material);painted++;
   return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(convert):convert(mesh.material);
 });
 return painted;
}

export function disposeBarracksSides(model){
 const group=model?.getObjectByName('SandforgeBarracksSideCladding');
 if(!group)return;
 const geometries=new Set(),materials=new Set();
 group.traverse(node=>{
  if(!node.isMesh)return;
  geometries.add(node.geometry);
  for(const m of Array.isArray(node.material)?node.material:[node.material])
   if(m)materials.add(m);
 });
 group.removeFromParent();group.clear();
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
}
