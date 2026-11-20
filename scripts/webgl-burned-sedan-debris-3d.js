import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {planBurnedSedanDebris,SEDAN_DEBRIS_VERSION} from './webgl-burned-sedan-debris-plan.js';

/** Discarded car parts rendered in shared GPU batches per material/part type.
 * No sprites, no extra world obstacles, no per-frame animation or allocations.
 * Actual wrecks and their debris share the same charred PBR material instances.
 */
function makeTemplates(){
 const groups=new Map();
 const matrix=new THREE.Matrix4(),rot=new THREE.Euler(),quat=new THREE.Quaternion();
 const collect=(key,geometry,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{
  rot.set(rx,ry,rz);quat.setFromEuler(rot);
  matrix.compose(new THREE.Vector3(x,y,z),quat,new THREE.Vector3(1,1,1));
  geometry.applyMatrix4(matrix);
  const g=geometry.index?geometry.toNonIndexed():geometry;
  if(g!==geometry)geometry.dispose();
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(g);
 };
 const block=(key,w,h,d,x,y,z,rx=0,ry=0,rz=0)=>
  collect(key,new THREE.BoxGeometry(w,h,d),x,y,z,rx,ry,rz);
 const torn=(key,points)=>{
  const verts=[],uvs=[];
  for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]]){
   verts.push(...p);uvs.push(p[0]*.028+p[2]*.008,p[1]*.05+p[2]*.028);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.computeVertexNormals();collect(key,g);
 };
 const bar=(key,a,b,r=.65,sides=5)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),
   axis=end.clone().sub(start),length=axis.length(),center=start.clone().add(end).multiplyScalar(.5);
  const g=new THREE.CylinderGeometry(r*.92,r,length,sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
   new THREE.Vector3(0,1,0),axis.normalize()));
  collect(key,g,center.x,center.y,center.z);
 };
 // Torn detached driver's door and bent window-frame remnants.
 torn('door',[[-12,1.8,-8],[-10,1.6,10],[-4,2.4,12],
  [7.5,1.2,7],[11,3.2,-5],[1,1.1,-12]]);
 torn('door',[[9,2.5,-4],[12.6,3,-7],[11,2,0],[6.5,1.5,7]]);
 block('door',5.8,.55,1,6.1,3.6,3.9,.1,.3,.08);
 bar('door',[-10,2.5,-8],[-10.8,6.6,4.4],.67);
 bar('door',[-10.8,6.6,4.4],[-2,4.3,11],.55);
 bar('door',[-2,4.3,11],[3,2.5,10],.59);
 // Warped and partially torn bonnet lying open in the dust.
 torn('hood',[[-15,1.7,-8],[-12,2.3,9],[-1,5,13],
  [11,1.5,8],[15,1.6,-9],[5,3.2,-11],[-4,1.4,-7]]);
 torn('hood',[[-4,1.3,-7],[5,3.1,-11],[2,1.8,-5],[0,2.4,2]]);
 bar('hood',[-13,1.9,-8],[12,2.1,-9],.65);
 // Bent front bumper, hitch and visibly separated support rails.
 bar('bumper',[-15,2.5,-2],[-5,4.2,0],1.35,6);
 bar('bumper',[-5,4.2,0],[6,2.5,0],1.35,6);
 bar('bumper',[6,2.5,0],[14.5,1.6,-4],1.35,6);
 bar('bumper',[-9,2.2,-2],[-9,2.3,5],.82);
 bar('bumper',[10,2,-2],[10,2.1,4],.82);
 // Detached scorched tire face-down, with rusty hub and visible spokes.
 collect('wheelRubber',new THREE.CylinderGeometry(8.9,8.7,4.2,14),0,2.4,0);
 collect('wheelRubber',new THREE.TorusGeometry(7.1,1.5,5,16),0,4.7,0,-Math.PI/2);
 collect('wheelIron',new THREE.CylinderGeometry(5.4,5.4,.48,12),0,4.85,0);
 collect('wheelIron',new THREE.TorusGeometry(4.9,.63,5,12),0,5.18,0,-Math.PI/2);
 for(let i=0;i<5;i++){
  const a=i*2*Math.PI/5;
  bar('wheelIron',[0,5.15,0],[Math.cos(a)*4.4,5.15,Math.sin(a)*4.4],.48,4);
 }
 collect('wheelIron',new THREE.CylinderGeometry(1.7,1.7,.55,7),0,5.25,0);
 // A twisted exhaust/muffler section fallen behind the car.
 bar('pipe',[-12,2.1,2],[-2,2.2,1],1.05,7);
 bar('pipe',[-2,2.2,1],[4,3.3,7],.89,7);
 bar('pipe',[4,3.3,7],[12,1.2,7],.88,7);
 collect('pipe',new THREE.CylinderGeometry(2.6,2.3,8,9),-1.4,2.9,1,0,0,Math.PI*.5);
 // Asymmetric shards have different silhouettes and stand slightly above
 // the terrain so they do not disappear into the sand.
 torn('shard',[[-9,1.1,-2],[-3,2.4,8],[2,1.2,-3]]);
 torn('shard',[[2,1.3,-6],[10,1.7,-3],[6,2.9,5]]);
 torn('shard',[[-3,1.5,8],[3,2.3,9],[1,1.1,12]]);
 // Broken windshield fragments, sparse and half sunk into the sand.
 torn('glass',[[-8,1.4,-4],[-2.5,2.0,4],[-.4,1.1,-2]]);
 torn('glass',[[3,1.0,-7],[8,1.3,-3],[5,1.8,2]]);
 torn('glass',[[-3,1.0,6],[1.6,2.0,8],[5,1.1,6]]);
 const specs=[
  {key:'door',kind:'door',material:'shell'},
  {key:'hood',kind:'hood',material:'shell'},
  {key:'bumper',kind:'bumper',material:'iron'},
  {key:'wheelRubber',kind:'wheel',material:'rubber'},
  {key:'wheelIron',kind:'wheel',material:'iron'},
  {key:'pipe',kind:'pipe',material:'iron'},
  {key:'shard',kind:'shard',material:'iron'},
  {key:'glass',kind:'glass',material:'glass'}
 ];
 const templates=specs.map(spec=>{
  const pieces=groups.get(spec.key);
  const geometry=mergeGeometries(pieces,false);
  for(const g of pieces)g.dispose();
  if(!geometry)throw new Error('Failed to merge burnt car debris: '+spec.key);
  geometry.computeBoundingSphere();
  return {...spec,geometry};
 });
 return templates;
}
export function addBurnedSedanDebris({
 root,world,terrain=world.generated,seed=world.seed,cars=[],
 lowQuality=false,materials,heightAt
}){
 const placements=planBurnedSedanDebris({world,terrain,seed,cars,lowQuality});
 if(!placements.length)return {
  placements,meshes:[],drawCalls:0,triangles:0,dispose(){}
 };
 const templates=makeTemplates(),meshes=[],dummy=new THREE.Object3D();
 for(const spec of templates){
  const selected=placements.filter(p=>p.kind===spec.kind);
  if(!selected.length)continue;
  const mesh=new THREE.InstancedMesh(spec.geometry,materials[spec.material],selected.length);
  mesh.name='visual-burned-sedan-debris-'+spec.key;
  mesh.userData={visualOnly:true,nonPlayable:true,nonBlocking:true,
   burnedSedanDebris:true,material:spec.material,part:spec.key,
   revision:SEDAN_DEBRIS_VERSION};
  mesh.raycast=()=>{};
  mesh.castShadow=!lowQuality&&['door','hood','wheelRubber'].includes(spec.key);
  mesh.receiveShadow=spec.key!=='glass';
  for(const [index,p] of selected.entries()){
   dummy.position.set(p.x-world.size*.5,heightAt(p.x,p.y)+.25,p.y-world.size*.5);
   dummy.rotation.set(p.tilt,p.angle,p.kind==='door'?.09:-.05);
   dummy.scale.setScalar(p.scale);dummy.updateMatrix();
   mesh.setMatrixAt(index,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();
  root.add(mesh);meshes.push(mesh);
 }
 let released=false;
 return {
  placements,meshes,drawCalls:meshes.length,
  triangles:meshes.reduce((n,m)=>n+m.count*m.geometry.getAttribute('position').count/3,0),
  dispose(){
   if(released)return;released=true;
   for(const mesh of meshes)mesh.removeFromParent();
   for(const spec of templates)spec.geometry.dispose();
  }
 };
}
