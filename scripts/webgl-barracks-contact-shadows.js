import * as THREE from 'three';

// Low-cost, texture-based ambient contact shadows for the *final* PBR
// barracks only. The sun's real 2048px soft shadow map already casts the
// architectural shadows; these decals restore small-scale occlusion at RTS
// camera zoom without adding another light or changing the authored GLB.
const SHADOW_GROUP='BarracksSoftContactShadows';
const plane=new THREE.PlaneGeometry(1,1);
const materials=new Map();

function softShadowTexture(shape){
 const width=128,height=128,rgba=new Uint8Array(width*height*4);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height;
  let alpha;
  if(shape==='wall'){
   // Shadow peaks just under the eaves and fades smoothly down the wall.
   const horizontal=smooth(Math.min(u,1-u)*9);
   alpha=Math.pow(v,2.15)*horizontal*.68;
  }else{
   const dx=(u-.5)*2,dy=(v-.5)*2;
   const radius=Math.sqrt(dx*dx+dy*dy);
   alpha=Math.pow(1-smooth((radius-.05)/.91),1.24)*.69;
  }
  const i=(y*width+x)*4;
  rgba[i]=47;rgba[i+1]=37;rgba[i+2]=26;
  rgba[i+3]=Math.round(alpha*255);
 }
 const tex=new THREE.DataTexture(rgba,width,height,THREE.RGBAFormat);
 tex.name='Barracks contact AO '+shape;
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.magFilter=THREE.LinearFilter;
 tex.generateMipmaps=true;
 tex.needsUpdate=true;
 return tex;
}
function material(shape){
 if(materials.has(shape))return materials.get(shape);
 const result=new THREE.MeshBasicMaterial({
  map:softShadowTexture(shape),color:'#ffffff',transparent:true,
  opacity:shape==='wall'?.58:.74,side:THREE.DoubleSide,
  depthWrite:false,depthTest:true,toneMapped:false,
  polygonOffset:true,polygonOffsetFactor:-2,
  polygonOffsetUnits:-2
 });
 result.name='BarracksSoftOcclusion_'+shape;
 materials.set(shape,result);return result;
}
function shadow(group,name,shape,at,width,height,yaw=0){
 const mesh=new THREE.Mesh(plane,material(shape));
 mesh.name=name;
 mesh.position.set(...at);
 mesh.rotation.set(shape==='ground'?-Math.PI/2:0,yaw,0);
 mesh.scale.set(width,height,1);
 mesh.renderOrder=7;
 mesh.castShadow=false;mesh.receiveShadow=false;
 mesh.raycast=()=>{};
 mesh.userData={visualOnly:true,nonPlayable:true,barracksContactShadow:true,
  factionAccent:true};
 group.add(mesh);return mesh;
}

/**
 * Mount after glTF scaling/centering, never before calculating GLB bounds.
 * Coordinates are Y-up in the unscaled original PBR asset, facing +Z.
 * All positions remain within the authored foundation/prop silhouette.
 * Only recognized PBR barracks receive this group, legacy assets are no-op.
 */
export function addBarracksContactShadows(root){
 if(!root?.userData?.sandforgeOriginalPBR||root.getObjectByName(SHADOW_GROUP))
  return null;
 const group=new THREE.Group();
 group.name=SHADOW_GROUP;
 group.userData={visualOnly:true,nonPlayable:true,barracksContactShadow:true};
 // Four walls: soft under-eave shadows avoid the "floating roof" look.
 shadow(group,'BarracksFrontEaveAO','wall',[0,3.49,4.205],10.55,.79);
 shadow(group,'BarracksBackEaveAO','wall',[0,3.49,-4.19],10.55,.79,Math.PI);
 shadow(group,'BarracksLeftEaveAO','wall',[-5.78,3.49,0],7.55,.79,-Math.PI/2);
 shadow(group,'BarracksRightEaveAO','wall',[5.78,3.49,0],7.55,.79,Math.PI/2);
 // Gate lintel and bottom sill: faint recess shading, never the door itself.
 shadow(group,'BarracksGateLintelAO','wall',[0,2.93,4.205],3.14,.39);
 // Local ground contacts sit over the already-present building grounding
 // pass; footprint geometry, nav and infantry spawn remain untouched.
 for(const side of [-1,1]){
  shadow(group,'BarracksSandbagGroundAO_'+side,'ground',
   [side*2.50,.078,4.65],2.50,1.24);
 }
 for(const [i,x,z,rx,rz] of [
  [0,-4.62,4.68,1.45,1.12],[1,4.65,4.64,1.45,1.12],
  [2,6.18,2.30,1.50,1.26],[3,6.18,1.23,1.34,1.15]
 ]){
  shadow(group,'BarracksCrateGroundAO_'+i,'ground',
   [x,.075,z],rx,rz);
 }
 // The side awning and two roof machines are the most noticeable remaining
 // "placed on top" objects at isometric zoom.
 shadow(group,'BarracksAwningGroundAO','ground',[6.23,.075,2.10],2.65,3.35);
 shadow(group,'BarracksRoofDishAO','ground',[-3.60,4.025,-2.60],1.30,1.12);
 shadow(group,'BarracksRoofHVACAO','ground',[0,4.025,-.57],2.65,1.78);
 root.add(group);
 return group;
}
