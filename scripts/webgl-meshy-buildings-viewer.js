import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {meshyStructurePath,prepareMeshyStructure} from './webgl-meshy-structure.js';
import {paintMeshyFactoryTeam} from './webgl-meshy-factory-team.js';
const body=document.getElementById('render'),status=document.getElementById('status');
const metadata=document.getElementById('metadata');
const choose=document.getElementById('building'),team=document.getElementById('faction');
const scene=new THREE.Scene();scene.background=new THREE.Color('#b4a184');
scene.fog=new THREE.Fog('#b4a184',550,1750);
const camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.3,3200);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
body.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.485;
const hemi=new THREE.HemisphereLight('#fff1d8','#657074',2.05);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1d2',2.8);sun.position.set(-270,370,340);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-450;sun.shadow.camera.right=450;
sun.shadow.camera.top=450;sun.shadow.camera.bottom=-450;
scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),
 new THREE.MeshStandardMaterial({color:'#bda47f',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const loader=new GLTFLoader(),cached=new Map();
const width={headquarters:225,factory:212,barracks:158,airfield:218,
 bunker:112,bastion:116,generator:112};
let active=null,activeSize=new THREE.Vector3(200,95,200),loadVersion=0;
function location(kind,owner){
 if(kind==='factory')return '/src/assets/reborn/buildings-3d/factory-'+owner+'.glb';
 return meshyStructurePath(kind);
}
function reset(){
 const w=Math.max(190,activeSize.x,activeSize.z),h=Math.max(35,activeSize.y);
 controls.target.set(0,h*.37,0);
 camera.position.set(w*1.75,h*1.8+w*.37,w*1.8);
 controls.minDistance=w*.6;controls.maxDistance=w*5;
 camera.lookAt(controls.target);controls.update();
}
function info(root){
 let tris=0,maps=0,normals=0,orm=0,meshes=0;
 root.traverse(node=>{
  if(!node.isMesh)return;meshes++;
  const geom=node.geometry;
  tris+=(geom.index?.count??geom.attributes.position?.count??0)/3;
  for(const m of Array.isArray(node.material)?node.material:[node.material]){
   if(m?.map)maps++;if(m?.normalMap)normals++;
   if(m?.roughnessMap||m?.metalnessMap)orm++;
  }
 });
 return {tris:Math.round(tris),meshes,maps,normals,orm};
}
async function open(){
 const version=++loadVersion,kind=choose.value,owner=Number(team.value),url=location(kind,owner);
 status.textContent='Lade '+choose.selectedOptions[0].text+' …';
 window.__sandforgeBuildingViewerError=null;
 if(!url){
  status.textContent='GLB noch nicht installiert · npm run assets:meshy:import';
  window.__sandforgeBuildingViewerError='missing-asset-'+kind;return;
 }
 try{
  if(!cached.has(url))cached.set(url,loader.loadAsync(url).catch(e=>{cached.delete(url);throw e;}));
  const data=await cached.get(url);
  if(version!==loadVersion)return;
  if(active){active.removeFromParent();active.traverse(obj=>{
   for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
    if(mat?.userData?.sandforgeMeshyTeamOwned||mat?.userData?.sandforgeMeshyFactionOwned)
     mat.dispose();
   }
  });}
  const model=data.scene.clone(true);
  if(kind==='factory'&&owner===1)paintMeshyFactoryTeam(model,owner);
  // Use the same PBR colour treatment as the actual Sandforge game.
  prepareMeshyStructure(model,kind,owner);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const w=Math.max(.001,size.x,size.z),factor=width[kind]/w;
  const center=bounds.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(factor);
  model.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
  scene.add(model);active=model;
  activeSize=size.multiplyScalar(factor);reset();
  const stats=info(model);
  metadata.textContent=stats.tris.toLocaleString('de-DE')+' Dreiecke · '+stats.meshes+
   ' Meshes · Albedo '+stats.maps+' / Normal '+stats.normals+' / ORM '+stats.orm;
  status.textContent='Echtes Meshy PBR · '+(owner===0?'Blau':'Rot')+' · '+kind;
  window.__sandforgeBuildingViewerReady={kind,owner,model,renderer,camera,stats};
 }catch(error){
  console.error('Sandforge building PBR viewer',error);
  window.__sandforgeBuildingViewerError=String(error);
  status.textContent='3D-Modell konnte nicht geladen werden';
 }
}
choose.addEventListener('change',open);team.addEventListener('change',open);
document.getElementById('reset').addEventListener('click',reset);
addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
function draw(){requestAnimationFrame(draw);controls.update();renderer.render(scene,camera);}
draw();open();
