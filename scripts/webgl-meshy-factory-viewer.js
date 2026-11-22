import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {paintMeshyFactoryTeam} from './webgl-meshy-factory-team.js';
const canvasRoot=document.getElementById('render');
const metadata=document.getElementById('metadata');
const status=document.getElementById('status');
const scene=new THREE.Scene();scene.background=new THREE.Color('#b4a187');
scene.fog=new THREE.Fog('#b4a187',600,1550);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.5,3000);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.33;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
canvasRoot.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
controls.minDistance=145;controls.maxDistance=1200;
const hemi=new THREE.HemisphereLight('#fff6e8','#525b65',2.15);
scene.add(hemi);const sun=new THREE.DirectionalLight('#fff0d2',2.7);
sun.position.set(-250,370,390);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-450;sun.shadow.camera.right=450;
sun.shadow.camera.top=450;sun.shadow.camera.bottom=-450;
scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1750,1750),
 new THREE.MeshStandardMaterial({color:'#bca583',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader();
let root=null;let bounds=null;let generation=0;
let door=null,doorClosedY=0,doorBaseScale=1,doorTarget=0,doorOpen=0;
const clock=new THREE.Clock();
const paths={
 meshy:'/src/assets/reborn/buildings-3d/factory-0.glb',
 'meshy-red':'/src/assets/reborn/buildings-3d/factory-1.glb',
 authored:'/src/assets/reborn/buildings-3d/factory-procedural-0.glb'
};
function resetCamera(){
 const height=bounds?bounds.getSize(new THREE.Vector3()).y:160;
 controls.target.set(0,height*.39,0);
 const meshy=document.getElementById('model').value!=='authored';
 camera.position.set(meshy?330:330,255,meshy?395:395);
 camera.lookAt(controls.target);
 controls.update();
}
function geometryInfo(group){
 let triangles=0,draws=0,mapped=0,normal=0,metal=0;
 group.traverse(node=>{
  if(!node.isMesh)return;draws++;
  const geom=node.geometry;
  triangles+=(geom.index?geom.index.count:geom.attributes.position?.count??0)/3;
  const mat=Array.isArray(node.material)?node.material:[node.material];
  mapped+=mat.filter(m=>m?.map).length;
  normal+=mat.filter(m=>m?.normalMap).length;
  metal+=mat.filter(m=>m?.metalnessMap||m?.roughnessMap).length;
 });
 return {triangles:Math.round(triangles),draws,albedo:mapped,normal,orm:metal};
}
async function openModel(kind){
 const current=++generation;
 metadata.textContent='Lade '+kind+'…';status.textContent='3D-Modell wird geprüft …';
 try{
  const data=await loader.loadAsync(paths[kind]);
  if(current!==generation)return;
  if(root){root.removeFromParent();root.traverse(n=>{if(n.isMesh)n.geometry?.dispose();});}
  root=data.scene;
  if(kind==='meshy-red')paintMeshyFactoryTeam(root,1);
  door=root.getObjectByName('FactoryRollupDoor');
  doorClosedY=door?.position.y??0;doorBaseScale=door?.scale.y??1;
  doorTarget=0;doorOpen=0;
  document.getElementById('door').disabled=!door;
  document.getElementById('door').textContent='Rolltor öffnen';
  const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
  const scale=220/Math.max(size.x,size.z);
  const c=box.getCenter(new THREE.Vector3());
  root.scale.setScalar(scale);
  root.position.set(-c.x*scale,-box.min.y*scale,-c.z*scale);
  root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  scene.add(root);bounds=new THREE.Box3().setFromObject(root);
  resetCamera();
  const info=geometryInfo(root);
  metadata.textContent=info.triangles.toLocaleString('de-DE')+
   ' Dreiecke · '+info.draws+' Meshes · Albedo '+info.albedo+
   ' / Normal '+info.normal+' / ORM '+info.orm;
  status.textContent=kind==='authored'?
   'Bisherige offene Fabrik – nur Vergleich':
   'Echte Meshy-PBR-Fabrik · '+(kind==='meshy'?'Blau':'Rot')+
   ' · Rolltor aus originalen Meshy-Dreiecken';
  window.__sandforgeMeshyFactoryReady={kind,info,model:root,renderer,camera};
 }catch(error){
  console.error('Sandforge candidate GLB:',error);
  metadata.textContent='GLB konnte nicht geladen werden';
  status.textContent='Das optimierte Meshy-Modell ist noch nicht eingebunden';
 }
}
document.getElementById('model').addEventListener('change',e=>openModel(e.target.value));
document.getElementById('door').addEventListener('click',()=>{
 if(!door)return;
 doorTarget=1-doorTarget;
 document.getElementById('door').textContent=doorTarget?'Rolltor schließen':'Rolltor öffnen';
});
document.getElementById('reset').addEventListener('click',resetCamera);
addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
function draw(){
 requestAnimationFrame(draw);
 const dt=Math.min(.08,clock.getDelta());
 if(door){
  doorOpen+=(doorTarget-doorOpen)*Math.min(1,dt*4.2);
  door.position.y=doorClosedY+.330*doorOpen;
  door.scale.y=doorBaseScale*(1-.94*doorOpen);
 }
 controls.update();renderer.render(scene,camera);
 if(window.__sandforgeMeshyFactoryReady)
  window.__sandforgeMeshyFactoryReady.doorOpen=doorOpen;
}
draw();openModel('meshy');
