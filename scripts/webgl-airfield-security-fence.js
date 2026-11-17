import * as THREE from 'three';

/** Render-only perimeter fencing for the hangar, radar tower and fuel depot.
 * Intentionally does NOT encircle the active runway or close the bomber
 * approach: all taxi/pad/playable lines remain navigable and unobstructed.
 */
export const AIRFIELD_FENCE_VERSION='airfield-chainlink-barbed-fence-v1';
export const AIRFIELD_FENCE_PATHS=Object.freeze([
 // Rear and right service-yard boundary. Ends BEFORE the open taxi turn.
 Object.freeze([[-342,183],[-342,-211],[-73,-211],[-73,9]]),
 // Short western apron return: wide open hangar entrance to the east.
 Object.freeze([[-342,183],[-238,183]])
]);
export const AIRFIELD_FENCE_MAX_X=-73;
export const AIRFIELD_FENCE_TAXI_GAP=Object.freeze({
 westEnd:-238,eastEnd:-73,frontZ:183,rightEndZ:9
});
const UP=new THREE.Vector3(0,1,0);
const groundY=3.15;
const pos=(x,y,z)=>[x,y,z];

function cylinderBatch(group,name,edges,radius,material){
 if(!edges.length)return;
 const mesh=new THREE.InstancedMesh(
  new THREE.CylinderGeometry(1,1,1,5),material,edges.length);
 mesh.name=name;
 mesh.userData={visualOnly:true,nonPlayable:true,airfieldFence:true,
  airfieldFenceEdges:edges,airfieldFenceRadius:radius};
 mesh.raycast=()=>{};
 mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 group.add(mesh);
 return mesh;
}
function applyEdges(mesh,convert=point=>point){
 const edges=mesh.userData.airfieldFenceEdges;
 const radius=mesh.userData.airfieldFenceRadius;
 const helper=new THREE.Object3D();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
 for(let i=0;i<edges.length;i++){
  const edge=edges[i];
  a.fromArray(convert(edge[0]));b.fromArray(convert(edge[1]));
  d.subVectors(b,a);
  const length=d.length();
  if(length<.0001)continue;
  helper.position.copy(a).add(b).multiplyScalar(.5);
  helper.quaternion.setFromUnitVectors(UP,d.multiplyScalar(1/length));
  helper.scale.set(radius,length,radius);helper.updateMatrix();
  mesh.setMatrixAt(i,helper.matrix);
 }
 mesh.instanceMatrix.needsUpdate=true;
 mesh.computeBoundingSphere();
}
export function createAirfieldSecurityFence(){
 // These materials belong to this yard and are safely disposed on removal;
 // never share an already-disposed PBR material between active airfields.
 const postPaint=new THREE.MeshStandardMaterial({
  color:'#404943',roughness:.65,metalness:.62
 });
 const meshPaint=new THREE.MeshStandardMaterial({
  color:'#8e9689',roughness:.81,metalness:.42
 });
 const barbedPaint=new THREE.MeshStandardMaterial({
  color:'#746e5f',roughness:.85,metalness:.42
 });
 const group=new THREE.Group();
 group.name='AirfieldSecurityPerimeter';
 group.userData={visualOnly:true,nonPlayable:true,
  airfieldSecurityFence:true,version:AIRFIELD_FENCE_VERSION,
  gap:AIRFIELD_FENCE_TAXI_GAP};
 const posts=[],wire=[],barbed=[],seenPosts=new Set();
 for(const path of AIRFIELD_FENCE_PATHS){
  for(let j=1;j<path.length;j++){
   const [ax,az]=path[j-1],[bx,bz]=path[j];
   const length=Math.hypot(bx-ax,bz-az);
   const count=Math.max(1,Math.ceil(length/22));
   const sideX=(bz-az)/length,sideZ=-(bx-ax)/length;
   for(let i=0;i<count;i++){
    const q0=i/count,q1=(i+1)/count;
    const x0=ax+(bx-ax)*q0,z0=az+(bz-az)*q0;
    const x1=ax+(bx-ax)*q1,z1=az+(bz-az)*q1;
    for(const [x,z] of [[x0,z0],[x1,z1]]){
     const key=x.toFixed(3)+':'+z.toFixed(3);
     if(seenPosts.has(key))continue;
     seenPosts.add(key);
     posts.push([pos(x,groundY,z),pos(x,groundY+27,z)]);
     // Steel angled top arm and two short strands of real barbed wire.
     barbed.push([pos(x,groundY+26,z),
       pos(x+sideX*4.5,groundY+33,z+sideZ*4.5)]);
    }
    // Fine parallel mesh wires and diagonal crossed chainlink frame,
    // batched across all panels: no giant opaque cloth wall.
    for(const h of [5.2,11.8,18.4,24.9])
     wire.push([pos(x0,groundY+h,z0),pos(x1,groundY+h,z1)]);
    wire.push([pos(x0,groundY+5.2,z0),pos(x1,groundY+24.9,z1)]);
    wire.push([pos(x0,groundY+24.9,z0),pos(x1,groundY+5.2,z1)]);
    for(const h of [30.4,32.5])
     barbed.push([pos(x0+sideX*2.4,groundY+h,z0+sideZ*2.4),
      pos(x1+sideX*2.4,groundY+h,z1+sideZ*2.4)]);
    // Sparse wire barbs, not repeating decorative black dashes on concrete.
    const middleX=(x0+x1)/2,middleZ=(z0+z1)/2;
    barbed.push([pos(middleX+sideX*.6,groundY+30,middleZ+sideZ*.6),
     pos(middleX-sideX*.6,groundY+34,middleZ-sideZ*.6)]);
   }
  }
 }
 const batches=[
  cylinderBatch(group,'AirfieldFenceSteelPosts',posts,.88,postPaint),
  cylinderBatch(group,'AirfieldFenceDiamondMesh',wire,.19,meshPaint),
  cylinderBatch(group,'AirfieldFenceTopBarbedWire',barbed,.20,barbedPaint)
 ];
 for(const mesh of batches)if(mesh)applyEdges(mesh);
 group.userData.postCount=posts.length;
 group.userData.wireCount=wire.length;
 group.userData.barbedCount=barbed.length;
 return group;
}
export function conformAirfieldSecurityFence(yard,base,heightAt,origin){
 const fence=yard?.getObjectByName('AirfieldSecurityPerimeter');
 if(!fence||!Number.isFinite(origin)||typeof heightAt!=='function')return 0;
 // Match the exact world-to-heightfield transform already used by the
 // terrain-draped runway. Instanced endpoints follow dunes independently
 // and never hover over or cut through neighboring crests.
 const yaw=[0,Math.PI,Math.PI/2,Math.PI*1.5][base.facing??0]??0;
 const cs=Math.cos(yaw),sn=Math.sin(yaw),cache=new Map();
 function groundPoint(point){
  const [x,y,z]=point,key=x.toFixed(3)+':'+z.toFixed(3);
  let rise=cache.get(key);
  if(rise===undefined){
   const localX=yard.position.x+x*yard.scale.x;
   const localZ=yard.position.z+z*yard.scale.z;
   const wx=base.x+localX*cs+localZ*sn;
   const wz=base.y-localX*sn+localZ*cs;
   const sampled=heightAt(wx,wz);
   rise=Number.isFinite(sampled)?(sampled-origin+1.2)/yard.scale.y:0;
   cache.set(key,rise);
  }
  return [x,y+rise,z];
 }
 let changed=0;
 for(const mesh of fence.children)if(mesh.isInstancedMesh){
  applyEdges(mesh,groundPoint);
  changed++;
 }
 return changed;
}
