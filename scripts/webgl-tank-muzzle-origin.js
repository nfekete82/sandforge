import * as THREE from 'three';

/** One graphical origin for tank shells/anti-armor rockets and their flashes.
 * Use the actual oriented gun mesh, not the hull center or roof MG.
 * Returns world coordinates in the THREE scene, never Simulation coordinates.
 */
export function tankCannonMuzzleWorld(entry,angle){
 if(entry?.kind!=='tank'||!entry.node)return null;
 const root=entry.detail??entry.placeholder;
 if(!root)return null;
 entry.node.updateWorldMatrix(true,true);
 const candidates=[];
 root.traverse(n=>{
  if(!n.isMesh||!n.visible)return;
  if(/^(Tank_MuzzleTip|Tank_MuzzleBrake|Tank_MainCannon|Tank_GunBarrel)(?:_|$)/i.test(n.name))
   candidates.push(n);
 });
 // The authored barrel is tracked by Tank_Gun; the fallback has a muzzle
 // brake explicitly at local +Z. Never use the roof machine gun.
 if(!candidates.length){
  const gun=entry.tankRig?.gun??root.getObjectByName('Tank_Gun');
  gun?.traverse(n=>{
   if(n.isMesh&&n.visible&&/barrel|cannon|muzzle/i.test(n.name)&&
      !/machine.?gun|roof|rocket/i.test(n.name))candidates.push(n);
  });
 }
 if(!candidates.length)return null;
 const forward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
 let best=null,furthest=-Infinity;
 for(const mesh of candidates){
  const geometry=mesh.geometry;
  if(!geometry?.boundingBox)geometry?.computeBoundingBox?.();
  const b=geometry?.boundingBox;
  if(!b)continue;
  // Eight actual transformed corners determine the forward barrel lip even
  // if a GLB cylinder uses its local Y axis and rotates into +Z.
  for(const x of [b.min.x,b.max.x])
   for(const y of [b.min.y,b.max.y])
    for(const z of [b.min.z,b.max.z]){
     const v=new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld);
     const extent=v.dot(forward);
     if(extent>furthest){furthest=extent;best=v;}
    }
 }
 // Use barrel-axis center rather than an outer bounding-box corner. Project
 // the best forward lip onto the world-space gun centerline.
 if(best){
  const pivot=entry.tankRig?.gun??entry.tankRig?.turret??root;
  const center=pivot.getWorldPosition(new THREE.Vector3());
  const front=best.clone().sub(center).dot(forward);
  return center.addScaledVector(forward,Math.max(0,front));
 }
 return null;
}
