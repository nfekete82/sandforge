import * as THREE from 'three';

/** Strong blue/red unit identification without replacing desert camouflage.
 * One shared procedural emblem texture per team. Render-only; no save changes.
 */
export const TEAM_MARKING_COLORS=Object.freeze({0:'#198fe0',1:'#e34e43'});
const kinds=new Set(['infantry','medic','engineer','heavy','rocket','tank','rover','artillery','scout','bomber']);
const materials=new Map();
const quad=new THREE.PlaneGeometry(1,1);
const poleGeo=new THREE.CylinderGeometry(1,1,1,7);
const poleMat=new THREE.MeshBasicMaterial({color:'#7e725f'});
function mat(owner){
 if(materials.has(owner))return materials.get(owner);
 const n=64,rgba=new Uint8Array(n*n*4),color=new THREE.Color(TEAM_MARKING_COLORS[owner]);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const at=(y*n+x)*4,border=x<3||y<3||x>60||y>60;
  const emblem=Math.abs(x-32)<4&&y>13&&y<49||y>27&&y<34&&Math.abs(x-32)<17;
  const rgb=border?[.8,.72,.52]:emblem?[.96,.95,.87]:[color.r,color.g,color.b];
  for(let k=0;k<3;k++)rgba[at+k]=Math.round(rgb[k]*255);
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
// All calculations below happen once when the imported model is attached,
// not inside the frame loop. Geometry bounds are measured in turret-local
// coordinates, including nested mesh transforms, for both original GLBs
// and procedural fallbacks.
function turretLocalBounds(turret){
 if(!turret)return null;
 turret.updateWorldMatrix(true,true);
 const inverse=turret.matrixWorld.clone().invert();
 const bounds=new THREE.Box3(),part=new THREE.Box3(),transform=new THREE.Matrix4();
 turret.traverse(node=>{
  if(!node.isMesh||!node.geometry||node.userData?.teamMarking)return;
  if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
  if(!node.geometry.boundingBox)return;
  transform.multiplyMatrices(inverse,node.matrixWorld);
  part.copy(node.geometry.boundingBox).applyMatrix4(transform);
  bounds.union(part);
 });
 return bounds.isEmpty()?null:bounds;
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
 if(kind==='scout'){
  // The helicopter already has real blue/red roundels in its original GLB.
  // Remove its old free-standing wing/flag planes even on a reloaded actor.
  detachTeamMarkings(entry);
  paintHelicopterSideStripes(entry.detail,owner);
  return null;
 }
 const h=Math.max(16,Number.isFinite(height)?height:44);
 const w=Math.max(20,Number.isFinite(footprint)?footprint:90);
 const turret=['tank','artillery'].includes(kind)?
  (entry.detail??entry.placeholder)?.getObjectByName('Tank_Turret'):null;
 const bounds=turretLocalBounds(turret);
 const parent=turret??entry.node;
 const signature=[owner,kind,Math.round(h),Math.round(w)].join(':');
 if(entry.teamMarkings?.userData.signature===signature&&
    entry.teamMarkings.parent===parent)return entry.teamMarkings;
 detachTeamMarkings(entry);
 const group=new THREE.Group();
 group.name='SandforgeTeamUniformAndFlags';
 group.userData={signature,owner,kind,visualOnly:true,nonPlayable:true,teamMarkings:true};
 if(['infantry','medic','engineer','heavy','rocket'].includes(kind)){
  const shoulder=Math.min(13,h*.23);
  for(const side of [-1,1])
   patch(group,'TeamArmband_'+(side<0?'Left':'Right'),owner,
    side*shoulder,h*.60,0,Math.max(5,h*.16),Math.max(4,h*.11),0,side*Math.PI/2);
  patch(group,'TeamChestPatch',owner,0,h*.66,h*.18,Math.max(6,h*.20),Math.max(5,h*.14));
 }else if(kind==='tank'||kind==='artillery'){
  if(turret&&bounds){
   // Native GLB coordinates, as children of the actual rotating turret.
   // Both the short mast and cloth follow hull translation, Y-up scaling
   // and the independently aimed turret. No guessed actor-height offset.
   const spanX=bounds.max.x-bounds.min.x;
   const spanZ=bounds.max.z-bounds.min.z;
   const mastHeight=Math.max(.22,Math.min(8,spanX*.25));
   const x=bounds.min.x+spanX*.20;
   const z=bounds.min.z+spanZ*.24;
   const baseY=bounds.max.y-Math.max(.025,spanX*.035);
   const pole=new THREE.Mesh(poleGeo,poleMat);
   pole.name='TeamFlagpole';
   pole.position.set(x,baseY+mastHeight*.5,z);
   pole.scale.set(Math.max(.012,spanX*.013),mastHeight,Math.max(.012,spanX*.013));
   pole.castShadow=false;pole.receiveShadow=false;
   pole.raycast=()=>{};
   pole.userData={visualOnly:true,teamMarking:true,nonPlayable:true};
   group.add(pole);
   const flagW=Math.max(.25,Math.min(10,spanX*.31));
   const flagH=mastHeight*.49;
   patch(group,'TeamArmourFlag',owner,x+flagW*.5,baseY+mastHeight*.75,
    z,flagW,flagH);
   // Compact insignia on the moving turret roof; no floating second flag.
   patch(group,'TeamTurretRoofMark',owner,
    bounds.min.x+spanX*.64,bounds.max.y+Math.max(.012,spanX*.012),
    bounds.min.z+spanZ*.60,spanX*.25,Math.max(.16,spanZ*.23),-Math.PI/2);
  }else{
   // Defensive fallback when an unrecognised third-party model has no rig:
   // a small hull badge, never a large flag hanging in mid-air.
   patch(group,'TeamArmourFlag',owner,-w*.24,h*.54,-w*.20,
    Math.min(13,w*.16),Math.min(7,h*.15));
   patch(group,'TeamTurretRoofMark',owner,w*.10,h*.60,0,w*.20,
    Math.max(7,w*.13),-Math.PI/2);
  }
 }else if(kind==='rover'){
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
