import * as THREE from 'three';

/** Defensive cleanup for legacy black skid-stripe geometry from older
 * airfield asset variants. The modern airstrip is an otherwise clear matte
 * runway with WHITE thresholds, WHITE centerline and small yellow edge lights.
 *
 * Geometric check, not a fragile mesh-name blacklist: old merged/renamed
 * objects can still leave 3 short pitch-black slabs sitting on the asphalt.
 * Restrict detection to shallow, compact almost-black ground rectangles that
 * project physically INSIDE the actual runway (not its apron or fence).
 * No plane, vehicle, building, collision or game-state mutation.
 */
const center=new THREE.Vector3(),geoSize=new THREE.Vector3();
const worldScale=new THREE.Vector3(),relative=new THREE.Vector3();
function darkSurface(material){
 if(!material?.isMaterial||!material.color)return false;
 const c=material.color;
 const light=.2126*c.r+.7152*c.g+.0722*c.b;
 if(light>.105)return false;
 // Never touch albedo-mapped parts, even if their baseColor is dark.
 if(material.map||material.userData?.sandforgeBuildingPBRRole)return false;
 return true;
}
export function removeRunwaySkidArtifacts(entry){
 const yard=entry?.airfieldServiceYard;
 const runway=yard?.getObjectByName('AirfieldExtendedRunway');
 const root=entry?.node;
 if(!root||!runway?.isMesh||!runway.geometry?.parameters)return 0;
 root.updateWorldMatrix(true,true);
 const w=runway.geometry.parameters.width,d=runway.geometry.parameters.depth;
 if(!Number.isFinite(w)||!Number.isFinite(d))return 0;
 let removed=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh===runway||!mesh.visible||
    mesh.userData?.airfieldRunwayStripeRemoved)return;
  if(mesh.name.startsWith('AirfieldRunway')||
   mesh.name.startsWith('AirfieldAircraft')||
   mesh.name.startsWith('AirfieldTaxi')||
   mesh.name.startsWith('AirfieldSecurity'))return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!mats.length||!mats.every(darkSurface))return;
  // Never inspect invisible old GLBs / construction meshes.
  for(let p=mesh.parent;p;p=p.parent)if(!p.visible)return;
  const geom=mesh.geometry;
  if(!geom?.isBufferGeometry)return;
  if(!geom.boundingBox)geom.computeBoundingBox();
  if(!geom.boundingBox)return;
  geom.boundingBox.getSize(geoSize);
  mesh.getWorldScale(worldScale);
  const x=geoSize.x*worldScale.x,z=geoSize.z*worldScale.z,
   height=geoSize.y*worldScale.y;
  // Guard against deleting a full asphalt slab, engine/lamp mast or gate.
  const long=Math.max(x,z),short=Math.min(x,z);
  if(long<6||long>68||short<.7||short>16||height>9.5||
   x*z>720)return;
  geom.boundingBox.getCenter(center);
  mesh.localToWorld(center);
  relative.copy(center);
  runway.worldToLocal(relative);
  if(Math.abs(relative.x)>w/2-3||Math.abs(relative.z)>d/2-6||
   Math.abs(relative.y)>11)return;
  mesh.visible=false;
  mesh.userData.airfieldRunwayStripeRemoved=true;
  removed++;
 });
 return removed;
}
