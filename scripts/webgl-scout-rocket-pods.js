import * as THREE from 'three';

/** Lightweight rocket cassettes on both sides of the EXISTING authored
 * transport helicopter. Additive visual only: no unit collision, no new
 * selectable objects, no modifications to cached glTF meshes/materials.
 * Rocket muzzles are child nodes used by the pooled ordnance renderer.
 */
export function attachScoutRocketPods(entry){
 if(!entry?.node||entry.kind!=='scout'||entry.scoutRocketPods)return;
 const root=new THREE.Group();
 root.name='Scout_LightRocketPods';
 root.userData={visualOnly:true,nonPlayable:true,scoutRocketPods:true};
 const casing=new THREE.MeshStandardMaterial({
  color:entry.owner===0?'#505d55':'#605348',metalness:.52,roughness:.57
 });
 const barrel=new THREE.MeshStandardMaterial({
  color:'#202927',metalness:.64,roughness:.43
 });
 const ring=new THREE.MeshStandardMaterial({
  color:'#a9a999',metalness:.58,roughness:.45
 });
 const muzzles=[];
 for(const [index,side] of [-1,1].entries()){
  const pod=new THREE.Group();
  pod.name='Scout_RocketPod_'+index;
  pod.position.set(side*27,12,3);
  const shell=new THREE.Mesh(new THREE.BoxGeometry(13,8,26),casing);
  shell.castShadow=true;pod.add(shell);
  const mount=new THREE.Mesh(new THREE.BoxGeometry(8,5,7),casing);
  mount.position.set(-side*9,2,0);pod.add(mount);
  for(let n=0;n<3;n++){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(2.05,2.05,21,8),barrel);
   tube.rotation.x=Math.PI/2;
   tube.position.set((n-1)*3.7,0,1);
   pod.add(tube);
   const lip=new THREE.Mesh(new THREE.TorusGeometry(2.12,.43,4,8),ring);
   lip.position.set((n-1)*3.7,0,13.3);
   pod.add(lip);
  }
  const muzzle=new THREE.Object3D();
  muzzle.name='ScoutRocketMuzzle_'+index;
  muzzle.position.set(0,0,17);
  pod.add(muzzle);muzzles.push(muzzle);
  root.add(pod);
 }
 root.traverse(o=>{if(o.isMesh){o.raycast=()=>{};o.receiveShadow=true;}});
 entry.node.add(root);
 entry.scoutRocketPods=root;
 entry.scoutRocketMuzzles=muzzles;
}
export function detachScoutRocketPods(entry){
 const root=entry?.scoutRocketPods;
 if(!root)return;
 root.removeFromParent();
 const geometries=new Set(),materials=new Set();
 root.traverse(o=>{
  if(!o.isMesh)return;
  geometries.add(o.geometry);
  for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
 });
 for(const g of geometries)g.dispose();
 for(const m of materials)m.dispose();
 delete entry.scoutRocketPods;delete entry.scoutRocketMuzzles;
}
