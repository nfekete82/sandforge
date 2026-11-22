import * as THREE from 'three';

// Destruction is an intentional action on Simulation's REAL building. This
// short-lived scene is just a visual snapshot: no collision, selection, game
// economy, physical debris, additional actor or save-data mutation.
export const BUILDING_COLLAPSE_VERSION='falling-structure-debris-v1';
export const BUILDING_COLLAPSE_DURATION=1.65;
const clamp=x=>Math.max(0,Math.min(1,x));
const random=(seed,i)=>{
 let h=Math.imul((seed^i)>>>0,2246822519)>>>0;
 h=Math.imul(h^(h>>>13),3266489917)>>>0;
 return ((h^(h>>>16))>>>0)/4294967296;
};

function copySnapshot(source){
 if(!source)return null;
 source.updateWorldMatrix(true,true);
 const copy=source.clone(true);
 copy.position.copy(source.getWorldPosition(new THREE.Vector3()));
 copy.quaternion.copy(source.getWorldQuaternion(new THREE.Quaternion()));
 copy.scale.copy(source.getWorldScale(new THREE.Vector3()));
 copy.visible=true;
 copy.name='DemolitionOriginalBuildingSnapshot';
 copy.userData={visualOnly:true,nonPlayable:true,demolitionSnapshot:true};
 const geometries=[],materials=[];
 copy.traverse(obj=>{
  if(!obj.isMesh)return;
  // The live entry is disposed on the next sync. Do not retain references
  // to its owned GLB/fallback geometry or to original mutable materials.
  obj.geometry=obj.geometry.clone();geometries.push(obj.geometry);
  const cloneMaterial=m=>{const copy=m.clone();materials.push(copy);return copy;};
  obj.material=Array.isArray(obj.material)?
   obj.material.map(cloneMaterial):cloneMaterial(obj.material);
  obj.castShadow=false;obj.receiveShadow=true;obj.raycast=()=>{};
 });
 return {copy,geometries,materials,origin:copy.position.clone(),
  scale:copy.scale.clone()};
}

export class SandforgeBuildingCollapse {
 constructor(scene){this.scene=scene;this.effects=new Set();}
 spawn(entry,building){
  if(!entry||!building)return false;
  // A huge airfield keeps its full PBR hangar/tower instead of copying the
  // entire terrain-draped runway; normal buildings clone just their model.
  const source=building.kind==='airfield'?
   entry.airfieldServiceYard?.userData.airfieldPbrModel??entry.detail:
   entry.detail?.visible?entry.detail:entry.placeholder;
  const snapshot=copySnapshot(source);
  const center=entry.node.getWorldPosition(new THREE.Vector3());
  const radius=Math.max(21,Math.min(93,Number(building.radius)||45));
  const root=new THREE.Group();
  root.name='BuildingDemolitionCollapse_'+building.id;
  root.userData={visualOnly:true,nonPlayable:true,demolition:true,
   version:BUILDING_COLLAPSE_VERSION,sourceId:building.id};
  this.scene.add(root);
  if(snapshot)this.scene.add(snapshot.copy);
  const dustMaterial=new THREE.MeshBasicMaterial({
   color:'#c3ae83',transparent:true,opacity:.23,depthWrite:false,
   side:THREE.DoubleSide
  });
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*.24,radius*.62,40),
   dustMaterial);
  ring.name='DemolitionDustRing';ring.position.copy(center);
  ring.position.y+=2;ring.rotation.x=-Math.PI/2;ring.raycast=()=>{};
  root.add(ring);
  const rubbleGeometry=new THREE.BoxGeometry(1,1,1);
  const rubbleMaterial=new THREE.MeshStandardMaterial({
   color:'#ac9980',roughness:1,metalness:0,flatShading:true
  });
  const chunks=[];
  for(let i=0;i<14;i++){
   const a=random(building.id,5*i)*Math.PI*2;
   const r=radius*(.18+random(building.id,5*i+1)*.43);
   const block=new THREE.Mesh(rubbleGeometry,rubbleMaterial);
   block.name='DemolitionFallingMasonry';
   block.position.set(center.x+Math.cos(a)*r,
    center.y+6+random(building.id,5*i+2)*radius*.35,
    center.z+Math.sin(a)*r);
   const scale=2.8+random(building.id,5*i+3)*radius*.14;
   block.scale.set(scale,scale*(.35+random(building.id,i)*.50),
    scale*(.70+random(building.id,i+19)*.50));
   block.rotation.y=a;
   block.raycast=()=>{};block.castShadow=false;block.receiveShadow=true;
   root.add(block);
   chunks.push({block,initial:block.position.clone(),
    drift:new THREE.Vector3(Math.cos(a),0,Math.sin(a)).multiplyScalar(r*.25),
    spin:(random(building.id,i+201)-.5)*.7});
  }
  const effect={root,snapshot,ring,chunks,rubbleGeometry,rubbleMaterial,
   dustMaterial,center,age:0,duration:BUILDING_COLLAPSE_DURATION};
  this.effects.add(effect);
  // Strict cap for rapid repeated demolition: no accumulation of GPU
  // geometry/materials or thousands of old particle instances.
  if(this.effects.size>3)this.remove(this.effects.values().next().value);
  return true;
 }
 update(dt,active=true){
  if(!active||!Number.isFinite(dt)||dt<=0)return;
  for(const fx of [...this.effects]){
   fx.age+=Math.min(dt,.15);
   const t=clamp(fx.age/fx.duration);
   if(fx.snapshot){
    const {copy,origin,scale}=fx.snapshot;
    const sink=t*t;
    copy.scale.set(scale.x*(1-.35*sink),
     scale.y*Math.max(.025,1-.98*sink),scale.z*(1-.35*sink));
    copy.position.set(origin.x,origin.y-sink*fx.center.distanceTo(origin)*.12,
     origin.z);
    copy.rotation.z=Math.sin(t*Math.PI)*.055;
    copy.visible=t<.93;
   }
   for(const [i,chunk] of fx.chunks.entries()){
    const {block,initial,drift,spin}=chunk;
    const fall=t*t,osc=Math.sin(Math.min(1,t*2)*Math.PI);
    block.position.copy(initial).addScaledVector(drift,t);
    block.position.y=Math.max(fx.center.y+block.scale.y*.3,
     initial.y-(8+fx.center.distanceTo(initial)*.65)*fall+osc*1.8);
    block.rotation.x=spin*t*3;
    block.rotation.z=spin*t*2.4;
    block.scale.multiplyScalar(1-.0008*i*t);
   }
   fx.ring.scale.setScalar(1+t*2.8);
   fx.dustMaterial.opacity=.24*(1-t);
   if(fx.age>=fx.duration)this.remove(fx);
  }
 }
 remove(fx){
  if(!fx||!this.effects.delete(fx))return;
  fx.root.removeFromParent();
  fx.snapshot?.copy.removeFromParent();
  for(const g of fx.snapshot?.geometries??[])g.dispose();
  for(const m of fx.snapshot?.materials??[])m.dispose();
  fx.ring.geometry.dispose();fx.dustMaterial.dispose();
  fx.rubbleGeometry.dispose();fx.rubbleMaterial.dispose();
 }
 dispose(){for(const fx of [...this.effects])this.remove(fx);}
}
