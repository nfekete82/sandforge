import * as THREE from 'three';

/** Procedural, mipmapped *desert-camouflage albedo* for the two small
 * launchers. Unlike a flat olive MeshStandardMaterial, this has the same
 * sand/khaki/dark-olive visual family as the authored helicopter GLB.
 * One texture per helicopter, shared by both pods, never placed on the
 * cached GLB or on gameplay meshes. No network asset or canvas required.
 */
export function scoutPodCamouflageTexture(owner=0){
 const size=128,pixels=new Uint8Array(size*size*4);
 const hash=(x,y,seed)=>{
  let n=Math.imul(x+13,374761393)^Math.imul(y+29,668265263)^seed;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
 };
 const field=(x,y,scale,seed)=>{
  const fx=x/scale,fy=y/scale,ix=Math.floor(fx),iy=Math.floor(fy);
  const tx=fx-ix,ty=fy-iy;
  const u=tx*tx*(3-2*tx),v=ty*ty*(3-2*ty);
  const a=hash(ix,iy,seed),b=hash(ix+1,iy,seed),
   c=hash(ix,iy+1,seed),d=hash(ix+1,iy+1,seed);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
 };
 const palette=owner===1?
  [[156,137,96],[191,168,113],[99,102,66],[117,94,63]]:
  [[172,151,102],[200,177,122],[100,107,67],[126,102,67]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const warpedX=x+(field(x,y,28,0x9133)-.5)*22;
  const warpedY=y+(field(x,y,31,0x377a)-.5)*22;
  const broad=field(warpedX,warpedY,22,0x56ef);
  const fine=field(warpedX,warpedY,8,0x18ca);
  const pattern=.72*broad+.28*fine;
  const paletteIndex=pattern<.33?2:pattern<.45?3:
   pattern<.67?0:1;
  const base=palette[paletteIndex];
  const grain=(hash(x,y,0x719b)-.5)*15;
  const wear=(field(x,y,4,0xac43)-.5)*8;
  const i=(y*size+x)*4;
  for(let ch=0;ch<3;ch++)
   pixels[i+ch]=Math.max(0,Math.min(255,Math.round(base[ch]+grain+wear)));
  pixels[i+3]=255;
 }
 const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
 texture.name='Scout_RocketPod_DesertCamouflage_PBR';
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.needsUpdate=true;
 return texture;
}

/** Front-view correction (viewer right is local starboard / +X):
 * the right pod was visually too far out, the left pod too close in.
 * Move starboard inward by 3 units and port outward by 3 units.
 * Neither launcher bore, muzzle, model scale nor gameplay aim is altered.
 */
export function scoutRocketPodMount(side){
 return side===1
  ?{x:14,y:18,z:-5}  // right in front view: inward
  :{x:-25,y:18,z:-5}; // left in front view: outward
}

/** Visual-only twin pods flush with the side of the real heli cabin.
 * The model contains ONLY two visible round launcher openings per side.
 * Magazine, fire timing and six real missiles stay with Simulation.
 */
export function attachScoutRocketPods(entry){
 if(!entry?.node||entry.kind!=='scout'||entry.scoutRocketPods)return;
 const root=new THREE.Group();
 root.name='Scout_LightRocketPods';
 root.userData={visualOnly:true,nonPlayable:true,scoutRocketPods:true};
 const camouflage=scoutPodCamouflageTexture(entry.owner);
 const casing=new THREE.MeshStandardMaterial({
  map:camouflage,color:'#ffffff',metalness:.22,roughness:.73
 });
 const barrel=new THREE.MeshStandardMaterial({
  color:'#1d2420',metalness:.55,roughness:.49
 });
 const ring=new THREE.MeshStandardMaterial({
  color:'#8e876b',metalness:.44,roughness:.62
 });
 const muzzles=[];
 for(const [index,side] of [-1,1].entries()){
  const pod=new THREE.Group();
  pod.name='Scout_RocketPod_'+index;
  // Same pod geometry, but asymmetric hardpoints match the actual
  // cabin seen from the FRONT. Do not symmetrize these coordinates again.
  const mount=scoutRocketPodMount(side);
  pod.position.set(mount.x,mount.y,mount.z);
  pod.scale.x=side;
  const fairing=new THREE.Mesh(
   new THREE.CylinderGeometry(4.25,4.45,14,16),casing);
  fairing.rotation.x=Math.PI/2;
  fairing.castShadow=true;pod.add(fairing);
  // Real short stub pylon rather than a huge black rectangular wing box.
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(8,2.8,5),casing);
  shoulder.position.set(-5.4,1,-.5);
  shoulder.castShadow=true;pod.add(shoulder);
  const brace=new THREE.Mesh(new THREE.BoxGeometry(3,3,4),ring);
  brace.position.set(-9.2,1,-.5);
  pod.add(brace);
  // Two recessed, aligned launch bores, inside the camouflage fairing.
  for(const n of [-1,1]){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.55,12,12),barrel);
   tube.rotation.x=Math.PI/2;
   tube.position.set(n*2.15,0,.25);
   pod.add(tube);
   const lip=new THREE.Mesh(new THREE.TorusGeometry(1.58,.28,6,14),ring);
   lip.position.set(n*2.15,0,7.18);
   pod.add(lip);
  }
  const muzzle=new THREE.Object3D();
  muzzle.name='ScoutRocketMuzzle_'+index;
  muzzle.position.set(0,0,8.3);
  pod.add(muzzle);
  muzzles.push(muzzle);
  root.add(pod);
 }
 root.traverse(o=>{
  if(o.isMesh){o.raycast=()=>{};o.receiveShadow=true;}
 });
 entry.node.add(root);
 entry.scoutRocketPods=root;
 entry.scoutRocketMuzzles=muzzles;
}

export function detachScoutRocketPods(entry){
 const root=entry?.scoutRocketPods;
 if(!root)return;
 root.removeFromParent();
 const geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  geometries.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   materials.add(m);
   if(m.map)textures.add(m.map);
  }
 });
 // Only owned pod resources. NEVER release cached/shared helicopter GLB
 // textures, other actors or the existing gameplay projectile materials.
 for(const g of geometries)g.dispose();
 for(const m of materials)m.dispose();
 for(const t of textures)t.dispose();
 delete entry.scoutRocketPods;
 delete entry.scoutRocketMuzzles;
}
