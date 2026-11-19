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
  color:entry.owner===0?'#5b6250':'#645d4b',metalness:.36,roughness:.68
 });
 const barrel=new THREE.MeshStandardMaterial({
  color:'#1d2420',metalness:.58,roughness:.53
 });
 const ring=new THREE.MeshStandardMaterial({
  color:'#828576',metalness:.48,roughness:.53
 });
 const muzzles=[];
 for(const [index,side] of [-1,1].entries()){
  // Small pods carried OUTSIDE the cabin on a short fixed pylon, farther
  // aft than the bulky original crates. Exactly two visible tubes per side.
  // The six-round magazine stays a simulation rule, not six giant 3D holes.
  const pod=new THREE.Group();
  pod.name='Scout_RocketPod_'+index;
  pod.position.set(side*37,6,-11);
  const fairing=new THREE.Mesh(new THREE.CylinderGeometry(5.5,5.5,16,14),casing);
  fairing.rotation.x=Math.PI/2;
  fairing.castShadow=true;pod.add(fairing);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(14,2.6,6.5),casing);
  shoulder.position.set(-side*10,1.5,-1);
  shoulder.castShadow=true;pod.add(shoulder);
  const brace=new THREE.Mesh(new THREE.BoxGeometry(5,3.5,5.5),ring);
  brace.position.set(-side*17,2,-1);
  pod.add(brace);
  // Two small recessed nozzle circles, instead of three exposed black pipes
  // or an oversized rectangular launcher box on each side.
  for(const n of [-1,1]){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(1.75,1.75,12,10),barrel);
   tube.rotation.x=Math.PI/2;
   tube.position.set(n*2.55,0,.5);
   pod.add(tube);
   const lip=new THREE.Mesh(new THREE.TorusGeometry(1.8,.36,5,12),ring);
   lip.position.set(n*2.55,0,8.25);
   pod.add(lip);
  }
  const muzzle=new THREE.Object3D();
  muzzle.name='ScoutRocketMuzzle_'+index;
  muzzle.position.set(0,0,10);
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
