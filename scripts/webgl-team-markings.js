import * as THREE from 'three';
import {FACTION_PAINT,factionRgb8} from './sandforge-faction-palette.js';

/** Strong blue/red unit identification without replacing desert camouflage.
 * One shared procedural emblem texture per team. Render-only; no save changes.
 */
export const TEAM_MARKING_COLORS=FACTION_PAINT;
const infantryKinds=new Set(['infantry','medic','engineer','heavy','rocket']);
const kinds=new Set([...infantryKinds,'tank','rover','artillery','scout','bomber']);
const materials=new Map();
const quad=new THREE.PlaneGeometry(1,1);
function mat(owner){
 if(materials.has(owner))return materials.get(owner);
 const n=64,rgba=new Uint8Array(n*n*4),rgb8=factionRgb8(owner);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const at=(y*n+x)*4,border=x<3||y<3||x>60||y>60;
  const emblem=Math.abs(x-32)<4&&y>13&&y<49||y>27&&y<34&&Math.abs(x-32)<17;
  // The DataTexture is sRGB. Write sRGB bytes directly, NOT THREE.Color's
  // linear-light components (which make patches look much darker).
  const rgb=border?[204,184,133]:emblem?[245,242,222]:rgb8;
  for(let k=0;k<3;k++)rgba[at+k]=rgb[k];
  rgba[at+3]=255;
 }
 const texture=new THREE.DataTexture(rgba,n,n,THREE.RGBAFormat);
 texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
 texture.needsUpdate=true;
 const m=new THREE.MeshBasicMaterial({map:texture,depthTest:true,depthWrite:false,
  side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1});
 materials.set(owner,m);return m;
}
function patch(group,name,owner,x,y,z,w,h,rx=0,ry=0){
 const mesh=new THREE.Mesh(quad,mat(owner));
 mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,0);
 mesh.scale.set(w,h,1);mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.raycast=()=>{};mesh.userData={visualOnly:true,teamMarking:true,nonPlayable:true};
 group.add(mesh);
}
// Paint identification *inside the PBR armour material*, rather than
// attaching mast/cloth planes that hover over scaled or rotating tank GLBs.
// The shader samples each chosen armour mesh's original local geometry and
// normal. No new geometry, physics target, shadow, or transform offset.
export const ARMOUR_IDENTIFICATION_REVISION='flush-armour-paint-v2-20261116';
const nonArmour=/track|roadwheel|sprocket|wheel|gun|barrel|cannon|muzzle|antenna|flag|pole|glass|window|smoke|exhaust/i;
function armourPaintTarget(root){
 if(!root)return null;
 let winner=null,area=-1;
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry||mesh.userData?.teamMarking||
      nonArmour.test(mesh.name)||mesh.isSkinnedMesh)return;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  const b=mesh.geometry.boundingBox;
  if(!b)return;
  const size=b.getSize(new THREE.Vector3());
  const candidate=size.x*size.z;
  if(candidate>area&&size.x>0&&size.z>0&&size.y>=0){
   winner=mesh;area=candidate;
  }
 });
 return winner;
}
function paintArmourIdentification(entry,owner,kind){
 const model=entry.detail??entry.placeholder;
 if(!model)return 0;
 const turret=model.getObjectByName('Tank_Turret');
 const candidate=armourPaintTarget(turret)||armourPaintTarget(model);
 if(!candidate)return 0;
 const geom=candidate.geometry;
 if(!geom.boundingBox)geom.computeBoundingBox();
 const b=geom.boundingBox;
 if(!b)return 0;
 const span=b.getSize(new THREE.Vector3());
 const x0=b.min.x+span.x*.34,x1=b.min.x+span.x*.47;
 const z0=b.min.z+span.z*.20,z1=b.min.z+span.z*.72;
 const minY=b.max.y-Math.max(span.y*.20,.003);
 // Shader-local constants describe exactly the physical triangles.
 // With normals pointing outward, the marking only appears on upper
 // armour; it cannot drift when the turret yaws or the whole actor scales.
 const region=[x0,x1,z0,z1,minY].map(x=>x.toFixed(6)).join(',');
 let count=0;
 const apply=source=>{
  if(!source?.isMeshStandardMaterial)return source;
  if(source.userData?.sandforgeArmourPaint===ARMOUR_IDENTIFICATION_REVISION){
   if(source.userData.sandforgeArmourPaintOwner!==owner){
    source.userData.sandforgeArmourPaintOwner=owner;
    source.needsUpdate=true;
   }
   return source;
  }
  const material=source.clone();
  material.userData={...source.userData,sandforgeArmourOwnedPaint:true,
   sandforgeArmourPaint:ARMOUR_IDENTIFICATION_REVISION,
   sandforgeArmourPaintOwner:owner};
  const priorCompile=source.onBeforeCompile;
  const priorKey=source.customProgramCacheKey.bind(source);
  material.onBeforeCompile=function(shader,renderer){
   priorCompile?.call(this,shader,renderer);
   const decl='varying vec3 sfArmourPosition; varying vec3 sfArmourNormal;';
   shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\n'+decl);
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nsfArmourPosition=position;sfArmourNormal=normal;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
    '#include <common>\n'+decl);
   const rgb=new THREE.Color(TEAM_MARKING_COLORS[this.userData.sandforgeArmourPaintOwner]);
   const paint=[
    '#include <color_fragment>',
    'float sfArmourTop=smoothstep(.64,.86,sfArmourNormal.y);',
    'float sfArmourHeight=smoothstep('+(minY-span.y*.06).toFixed(6)+','+
      minY.toFixed(6)+',sfArmourPosition.y);',
    // 2 neat narrow painted stripes with a gap; no emblem panel or
    // freestanding flags above a tank turret.
    'float sfLeft=smoothstep('+x0.toFixed(6)+','+
       (x0+span.x*.015).toFixed(6)+',sfArmourPosition.x);',
    'float sfRight=1.0-smoothstep('+(x1-span.x*.015).toFixed(6)+','+
       x1.toFixed(6)+',sfArmourPosition.x);',
    'float sfNear=smoothstep('+z0.toFixed(6)+','+
      (z0+span.z*.023).toFixed(6)+',sfArmourPosition.z);',
    'float sfFar=1.0-smoothstep('+(z1-span.z*.023).toFixed(6)+','+
      z1.toFixed(6)+',sfArmourPosition.z);',
    'float sfMiddle=1.0-smoothstep('+(x0+span.x*.050).toFixed(6)+','+
      (x0+span.x*.064).toFixed(6)+',sfArmourPosition.x);',
    'float sfGap=smoothstep('+(x0+span.x*.072).toFixed(6)+','+
      (x0+span.x*.089).toFixed(6)+',sfArmourPosition.x);',
    'float sfInk=sfArmourTop*sfArmourHeight*sfLeft*sfRight*sfNear*sfFar*max(sfMiddle,sfGap);',
    'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+
      rgb.r.toFixed(6)+','+rgb.g.toFixed(6)+','+rgb.b.toFixed(6)+'),sfInk*.94);'
   ].join('\n');
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',paint);
  };
  material.customProgramCacheKey=()=>priorKey()+'|'+ARMOUR_IDENTIFICATION_REVISION+
   '|'+region+'|'+material.userData.sandforgeArmourPaintOwner;
  material.needsUpdate=true;
  count++;
  return material;
 };
 candidate.material=Array.isArray(candidate.material)?
  candidate.material.map(apply):apply(candidate.material);
 return count;
}

/** The authored Mi-8/17-style transport has real cargo-shell geometry
 * (Airframe_Weathered desert camouflage PBR) with baked PBR textures.
 * Put narrow team stripes IN that surface using the model's local vertices.
 * A billboard placed beside the helicopter drifts visibly away from its
 * curved fuselage, especially while yawing or when the GLB is normalized.
 *
 * This adds no planes, poles, colliders, ray targets or draw calls. It also
 * leaves the 3D-authored roundels, door glass and both rotor pivots untouched.
 * Model-local coordinates are the authored meters, before actor scaling.
 */
export const HELICOPTER_STRIPES_REVISION='heli-flush-stripes-v1-20261115';
export function paintHelicopterSideStripes(model,owner){
 if(!model||(owner!==0&&owner!==1))return 0;
 const upgraded=new Map();
 let count=0;
 model.traverse(mesh=>{
  if(!mesh.isMesh||!/^Airframe_.*desert[ _-]+camouflage/i.test(mesh.name))return;
  const decorate=source=>{
   if(!source?.isMeshStandardMaterial)return source;
   if(source.userData?.sandforgeHelicopterStripes===HELICOPTER_STRIPES_REVISION){
    if(source.userData.sandforgeHelicopterStripeOwner!==owner){
     source.userData.sandforgeHelicopterStripeOwner=owner;
     source.needsUpdate=true;
    }
    return source;
   }
   if(upgraded.has(source))return upgraded.get(source);
   // The faction tint already owns its material. Never change cached GLB
   // textures; stand-alone models receive their own material clone.
   const material=source.userData?.sandforgeFactionTint?source:source.clone();
   if(material!==source)
    material.userData={...material.userData,sandforgeHelicopterOwnedPaint:true};
   material.userData={...material.userData,
    sandforgeHelicopterStripes:HELICOPTER_STRIPES_REVISION,
    sandforgeHelicopterStripeOwner:owner};
   const priorCompile=material.onBeforeCompile;
   const priorProgramKey=material.customProgramCacheKey.bind(material);
   material.onBeforeCompile=function(shader,renderer){
    priorCompile?.call(this,shader,renderer);
    const mark='varying vec3 sfHeliLocal;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
     '#include <common>\n'+mark);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
     '#include <begin_vertex>\nsfHeliLocal=transformed;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
     '#include <common>\n'+mark);
    const color=new THREE.Color(TEAM_MARKING_COLORS[this.userData.sandforgeHelicopterStripeOwner]);
    const lines=[
     '#include <color_fragment>',
     // Fuselage surfaces x=±1.25...1.4, y≈1.4...2.5, nose toward +Z.
     // Lower side band intentionally sits BELOW the window/roundel row.
     'float sfSide=smoothstep(1.18,1.31,abs(sfHeliLocal.x));',
     'float sfCargo=smoothstep(-2.45,-2.08,sfHeliLocal.z)',
     ' *(1.0-smoothstep(1.02,1.43,sfHeliLocal.z));',
     'float sfBlueBand=1.0-smoothstep(.045,.088,abs(sfHeliLocal.y-1.58));',
     'float sfFineBand=1.0-smoothstep(.027,.058,abs(sfHeliLocal.y-1.79));',
     'float sfStripe=clamp(sfSide*sfCargo*max(sfBlueBand,sfFineBand*.75),0.0,1.0);',
     'diffuseColor.rgb=mix(diffuseColor.rgb,vec3('+
      color.r.toFixed(5)+','+color.g.toFixed(5)+','+color.b.toFixed(5)+'),sfStripe*.94);'
    ].join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',lines);
   };
   material.customProgramCacheKey=()=>priorProgramKey()+'|'+HELICOPTER_STRIPES_REVISION+
    '|'+material.userData.sandforgeHelicopterStripeOwner;
   material.needsUpdate=true;
   upgraded.set(source,material);
   count++;
   return material;
  };
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(decorate):decorate(mesh.material);
 });
 return count;
}

/** Attach once when created/model size changes; never allocate each RAF. */
export function attachTeamMarkings(entry,owner,kind,footprint=90,height=44){
 if(!entry?.node||!kinds.has(kind)||(owner!==0&&owner!==1))return null;
 if(infantryKinds.has(kind)){
  // The Atlas soldier GLB already has genuine blue/red armor, shoulder and
  // helmet paint following its skinned skeleton. The additional world-space
  // arm/chest planes looked like tiny floating flags while soldiers moved.
  // Remove these visual-only patches on all five infantry roles, including
  // legacy actors when their GLB finishes streaming; keep original PBR.
  detachTeamMarkings(entry);
  return null;
 }
 if(kind==='scout'){
  // The helicopter already has real blue/red roundels in its original GLB.
  // Remove its old free-standing wing/flag planes even on a reloaded actor.
  detachTeamMarkings(entry);
  paintHelicopterSideStripes(entry.detail,owner);
  return null;
 }
 if(kind==='tank'||kind==='artillery'){
  // No freestanding flags, poles, decals, hoverplanes or geometry.
  // Existing old markers are cleared when a rig/model is swapped.
  detachTeamMarkings(entry);
  paintArmourIdentification(entry,owner,kind);
  return null;
 }
 const h=Math.max(16,Number.isFinite(height)?height:44);
 const w=Math.max(20,Number.isFinite(footprint)?footprint:90);
 const parent=entry.node;
 const signature=[owner,kind,Math.round(h),Math.round(w)].join(':');
 if(entry.teamMarkings?.userData.signature===signature&&
    entry.teamMarkings.parent===parent)return entry.teamMarkings;
 detachTeamMarkings(entry);
 const group=new THREE.Group();
 group.name='SandforgeTeamUniformAndFlags';
 group.userData={signature,owner,kind,visualOnly:true,nonPlayable:true,teamMarkings:true};
 if(kind==='rover'){
  patch(group,'TeamHumveeRoof',owner,0,h*.77,-w*.09,w*.34,w*.24,-Math.PI/2);
  for(const side of [-1,1])
   patch(group,'TeamDoor_'+side,owner,side*w*.30,h*.46,0,w*.21,Math.max(8,h*.24),0,side*Math.PI/2);
 }else{
  for(const side of [-1,1])
   patch(group,'TeamAircraftWing_'+side,owner,side*w*.27,h*.40,0,
    Math.max(14,w*.23),Math.max(11,w*.15),-Math.PI/2);
  patch(group,'TeamAircraftTail',owner,0,h*.6,-w*.23,w*.16,Math.max(9,h*.23),-Math.PI/2);
 }
 parent.add(group);entry.teamMarkings=group;return group;
}
export function detachTeamMarkings(entry){
 if(!entry?.teamMarkings)return;
 entry.teamMarkings.removeFromParent();entry.teamMarkings.clear();entry.teamMarkings=null;
}
