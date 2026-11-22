import * as THREE from 'three';
import {planDesertLakeVegetation} from './webgl-desert-lake-vegetation-plan.js';
import {palmGeometry,tuftGeometry,palmWindMaterial} from './webgl-oases.js';

/** Reuses the original sculpted oasis palm and wind-swaying foliage:
 * no cylindrical green placeholders, no per-plant draw calls.
 * Reed / grass / shrub / palm instance matrices are fixed for the battle.
 */
export function createDesertLakeVegetation({
 scene,world,terrain=world?.generated,layout,mapId,heightAt,seed=world?.seed??0,
 lowQuality=false
}={}){
 const placements=planDesertLakeVegetation({world,terrain,layout,mapId,seed,lowQuality});
 const root=new THREE.Group();
 root.name='visual-natural-lake-shore-vegetation';
 root.userData={visualOnly:true,nonPlayable:true,nonBlocking:true};
 const meshes=[],geometries=[],materials=[];
 const wind={time:{value:0},strength:{value:1}};
 const add=(kind,geometry,material,items)=>{
  if(!items.length){geometry.dispose();material.dispose();return;}
  geometries.push(geometry);materials.push(material);
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  mesh.name='oasis-natural-'+kind;
  mesh.castShadow=!lowQuality&&kind.includes('palm');
  mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
   shoreVegetation:true,plantKind:kind};
  const dummy=new THREE.Object3D(),half=world.size*.5;
  for(const [i,p] of items.entries()){
   dummy.position.set(p.x-half,heightAt(p.x,p.y)-.50,p.y-half);
   dummy.rotation.set(p.tilt,p.rotation,0);dummy.scale.setScalar(p.scale);
   dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   mesh.setColorAt(i,new THREE.Color().setRGB(p.tint,p.tint*.98,p.tint*.86));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();
  root.add(mesh);meshes.push(mesh);
 };
 if(placements.length){
  const palms=placements.filter(p=>p.kind==='palm'),
   reeds=placements.filter(p=>p.kind==='reeds'),
   grass=placements.filter(p=>p.kind==='grass'),
   shrubs=placements.filter(p=>p.kind==='shrub');
  const leaf=new THREE.MeshStandardMaterial({
   color:'#617449',roughness:.89,metalness:0,side:THREE.DoubleSide
  });
  const trunk=new THREE.MeshStandardMaterial({
   color:'#80634b',roughness:.98,metalness:0
  });
  for(let v=0;v<2;v++){
   const items=palms.filter((p,i)=>i%2===v),g=palmGeometry(v);
   add('palm-trunk-'+v,g.trunk,palmWindMaterial(trunk,wind,false),items);
   add('palm-fronds-'+v,g.leaves,palmWindMaterial(leaf,wind,true),items);
  }
  trunk.dispose();leaf.dispose();
  const reedGeometry=tuftGeometry(true);
  add('reed-fringe',reedGeometry,
   new THREE.MeshStandardMaterial({color:'#69774d',roughness:1,side:THREE.DoubleSide}),reeds);
  const grassGeometry=tuftGeometry();
  add('riparian-grass',grassGeometry,
   new THREE.MeshStandardMaterial({color:'#858451',roughness:1,side:THREE.DoubleSide}),grass);
  const shrubGeometry=tuftGeometry();shrubGeometry.scale(1.95,.78,1.7);
  add('low-scrub',shrubGeometry,
   new THREE.MeshStandardMaterial({color:'#626f47',roughness:1,side:THREE.DoubleSide}),shrubs);
 }
 scene.add(root);
 let disposed=false;
 return {
  root,placements,meshes,drawCalls:meshes.length,
  update(t){if(disposed)return;wind.time.value=t;wind.strength.value=.70;},
  dispose(){
   if(disposed)return;disposed=true;
   root.removeFromParent();
   for(const mesh of meshes)mesh.dispose();
   for(const g of geometries)g.dispose();
   for(const m of materials)m.dispose();
   root.clear();
  }
 };
}
