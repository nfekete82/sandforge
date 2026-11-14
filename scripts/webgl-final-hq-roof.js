import * as THREE from 'three';

/** Optional, source-measured roof details.  The animation tracks, collision,
 * navmesh, source GLB, shader and building transforms remain untouched. */
export function addFinalHeadquartersRoofDetails(root){
 const hq=root?.getObjectByName?.('SF_Feldkommando_Final');
 if(!hq||hq.getObjectByName('SF_Final_Roof_Grilles'))return false;
 const group=new THREE.Group();
 group.name='SF_Final_Roof_Grilles';
 group.userData={visualOnly:true,nonPlayable:true,finalHqOwned:true};
 const metal=new THREE.MeshStandardMaterial({name:'SF_Final_Grille_Graphite',
  color:'#525147',metalness:.35,roughness:.78});
 const slots=new THREE.MeshStandardMaterial({name:'SF_Final_Grille_DeepSlots',
  color:'#242624',metalness:.18,roughness:.92});
 const rib=new THREE.MeshStandardMaterial({name:'SF_Final_Grille_Ribs',
  color:'#807c70',metalness:.4,roughness:.7});
 const body=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),metal,2);
 const inside=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),slots,2);
 const bars=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),rib,10);
 body.name='SF_Final_Roof_Grille_Frames';
 inside.name='SF_Final_Roof_Grille_Slots';
 bars.name='SF_Final_Roof_Grille_Ribs';
 const matrix=new THREE.Object3D();
 const install=(mesh,index,x,y,z,w,h,d)=>{
  matrix.position.set(x,y,z);matrix.rotation.set(0,0,0);matrix.scale.set(w,h,d);
  matrix.updateMatrix();mesh.setMatrixAt(index,matrix.matrix);
 };
 // Flat-roof coordinates are measured from the original source GLB mesh:
 // do not add tall posts or equipment around the moving satellite assembly.
 const pads=[
  {x:.274,y:-.101,z:-.075,w:.088,d:.050},
  {x:-.350,y:-.083,z:-.078,w:.066,d:.048}
 ];
 for(let i=0;i<pads.length;i++){
  const p=pads[i];
  install(body,i,p.x,p.y+.006,p.z,p.w,.006,p.d);
  install(inside,i,p.x,p.y+.010,p.z,p.w-.008,.003,p.d-.009);
  for(let k=0;k<5;k++)
   install(bars,i*5+k,p.x,p.y+.013,p.z+(k-2)*(p.d-.014)/5,
    p.w-.012,.003,.0021);
 }
 for(const mesh of [body,inside,bars]){
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  mesh.userData={visualOnly:true,nonPlayable:true,finalHqOwned:true};
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
  group.add(mesh);
 }
 hq.add(group);
 return true;
}
