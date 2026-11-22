import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installDesertSandPBR, SANDFORGE_SAND_PBR} from './webgl-sand-pbr.js';
import {stoneMaterial, weatheredStoneGeometry} from './webgl-rock-materials.js';

// Isolated visual comparison. Nothing here imports or mutates game simulation,
// collision, pathfinding, user settings, map generation, or save-game state.
const stage=document.getElementById('scene');
const status=document.getElementById('status');
const stats=document.getElementById('stats');
const before=document.getElementById('before');
const after=document.getElementById('after');
const props=document.getElementById('props');
let renderer;
try {
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
} catch (error) {
 status.textContent='WebGL konnte nicht gestartet werden: '+String(error);
 throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.14;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color('#cbbca3');
scene.fog=new THREE.FogExp2('#cbbca3',.00108);
const camera=new THREE.PerspectiveCamera(46,window.innerWidth/window.innerHeight,.5,2500);
camera.position.set(335,260,380);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,4,0);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.minDistance=95;
controls.maxDistance=930;
controls.maxPolarAngle=Math.PI*.47;
controls.update();

const ambient=new THREE.HemisphereLight('#fff0d3','#685b4b',1.13);
const sun=new THREE.DirectionalLight('#fff1d0',2.25);
sun.position.set(-250,410,135);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-480;
sun.shadow.camera.right=480;
sun.shadow.camera.top=480;
sun.shadow.camera.bottom=-480;
sun.shadow.camera.near=1;
sun.shadow.camera.far=1200;
sun.shadow.bias=-.00012;
sun.shadow.normalBias=.045;
sun.target.position.set(0,0,0);
scene.add(ambient,sun,sun.target);

// The terrain is a single XZ mesh. The real Sandforge detail shader reads
// local geometry position.xz; rotating an XY mesh at object level would break
// that shader and produce stretched bands.
function heightAt(x,z) {
 const d=Math.hypot(x+38,z-12);
 const transition=Math.max(0,Math.min(1,(d-94)/145));
 const fade=transition*transition*(3-2*transition);
 const ridges=8.5*Math.sin(x*.009+Math.sin(z*.008)*1.5);
 const dunes=5.5*Math.sin(z*.013-x*.0035)+3*Math.sin(x*.027+z*.018);
 return Math.max(-9,(ridges+dunes)*fade);
}
const groundGeometry=new THREE.PlaneGeometry(920,920,132,132);
groundGeometry.rotateX(-Math.PI/2);
const position=groundGeometry.attributes.position;
const uv=groundGeometry.attributes.uv;
const colors=new Float32Array(position.count*3);
for(let i=0;i<position.count;i++){
 const x=position.getX(i),z=position.getZ(i);
 position.setY(i,heightAt(x,z));
 uv.setXY(i,x/900,z/900);
 const variation=.936+.040*Math.sin(x*.009+z*.012)+.016*Math.sin(x*.047-z*.035);
 colors[i*3]=variation;
 colors[i*3+1]=variation*.995;
 colors[i*3+2]=variation*.982;
}
groundGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
groundGeometry.computeVertexNormals();
const originalGround=new THREE.MeshStandardMaterial({
 color:'#d4b68b',roughness:1,metalness:0,vertexColors:true
});
const enhancedGround=new THREE.MeshStandardMaterial({
 color:'#ffffff',roughness:1,metalness:0,vertexColors:true
});
const ground=new THREE.Mesh(groundGeometry,originalGround);
ground.receiveShadow=true;
ground.name='sandforge-visual-lab-ground';
scene.add(ground);

// The EXACT sandstone generator that Sandforge uses for its landscape.
const rockGeometry=weatheredStoneGeometry(false);
const basicRock=new THREE.MeshStandardMaterial({
 color:'#b7a18b',roughness:1,metalness:0,flatShading:true
});
const pbrRock=stoneMaterial('#cdb59a',{normalScale:.56});
const rockCount=39;
const rocks=new THREE.InstancedMesh(rockGeometry,basicRock,rockCount);
rocks.name='sandforge-visual-lab-weathered-rocks';
rocks.castShadow=true;
rocks.receiveShadow=true;
const dummy=new THREE.Object3D();
let seed=0x5a6f2026;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const clusters=[[-310,-205],[-210,260],[300,-150],[245,260],[-330,145]];
for(let i=0;i<rockCount;i++){
 const center=clusters[i%clusters.length];
 const x=center[0]+(random()-.5)*124;
 const z=center[1]+(random()-.5)*110;
 const scale=3.0+random()*7.5;
 dummy.position.set(x,heightAt(x,z)+scale*.27,z);
 dummy.rotation.set((random()-.5)*.16,random()*Math.PI*2,(random()-.5)*.14);
 dummy.scale.set(scale*(.86+random()*.8),scale*(.25+random()*.23),scale*(.95+random()*.85));
 dummy.updateMatrix();
 rocks.setMatrixAt(i,dummy.matrix);
 rocks.setColorAt(i,new THREE.Color().setHSL(.091+random()*.025,.18+random()*.10,.83+random()*.12));
}
rocks.instanceMatrix.needsUpdate=true;
if(rocks.instanceColor)rocks.instanceColor.needsUpdate=true;
scene.add(rocks);

const modelLoader=new GLTFLoader();
function groundModel(object,x,z,targetSize,isPalm=false){
 const box=new THREE.Box3().setFromObject(object);
 const dimensions=box.getSize(new THREE.Vector3());
 const dimension=isPalm?dimensions.y:Math.max(dimensions.x,dimensions.z);
 if(!(dimension>0))throw Error('Invalid GLB model bounds');
 object.scale.multiplyScalar(targetSize/dimension);
 const scaled=new THREE.Box3().setFromObject(object);
 const center=scaled.getCenter(new THREE.Vector3());
 object.position.set(x-center.x,heightAt(x,z)-scaled.min.y+.2,z-center.z);
 object.traverse(child=>{
  if(child.isMesh){
   child.castShadow=true;
   child.receiveShadow=true;
  }
 });
 scene.add(object);
 return object;
}
async function loadModels(){
 const entries=await Promise.allSettled([
  modelLoader.loadAsync('/src/assets/reborn/buildings-3d/headquarters-0.glb'),
  modelLoader.loadAsync('/src/assets/reborn/props-3d/palm-tree.glb')
 ]);
 let count=0;
 if(entries[0].status==='fulfilled'){
  groundModel(entries[0].value.scene,-38,12,106);
  count++;
 }else console.warn('Sandforge HQ GLB not available',entries[0].reason);
 if(entries[1].status==='fulfilled'){
  const locations=[[-255,-270,35],[-287,-248,39],[-223,-280,30],
   [214,270,32],[255,247,39],[284,298,27],
   [-330,205,33],[344,-222,36]];
  const source=entries[1].value.scene;
  for(const [x,z,size] of locations){
   groundModel(source.clone(true),x,z,size,true);
   count++;
  }
 }else console.warn('Sandforge palm GLB not available',entries[1].reason);
 return count;
}

let mode='after';
let materialReady=false;
function applyMode(){
 const enhanced=mode==='after'&&materialReady;
 ground.material=enhanced?enhancedGround:originalGround;
 rocks.material=enhanced?pbrRock:basicRock;
 ambient.intensity=enhanced?1.13:1.45;
 sun.intensity=enhanced?2.25:1.45;
 renderer.toneMappingExposure=enhanced?1.14:1.22;
 before.setAttribute('aria-pressed',String(mode==='before'));
 after.setAttribute('aria-pressed',String(mode==='after'));
 if(mode==='after'&&!materialReady){
  status.textContent='Sand-PBR wird geladen. Bis dahin bleibt die einfache Variante sichtbar.';
 }else{
  status.textContent=enhanced
   ?'NEU: Sand-Texturen, feinere Bodenstruktur, warme Fels-PBR-Materialien und gerichtetes Licht.'
   :'VORHER: Einfarbiger Boden, einfache Felsmaterialien, flachere Beleuchtung.';
 }
}
before.addEventListener('click',()=>{mode='before';applyMode();});
after.addEventListener('click',()=>{mode='after';applyMode();});
props.addEventListener('change',()=>{
 rocks.visible=props.value==='normal';
});
applyMode();

async function initialize(){
 try{
  // The actual authored Sandforge tile + its normal/roughness and
  // procedural surface detail, not a mock-up or remotely hosted material.
  materialReady=await installDesertSandPBR(enhancedGround,renderer,{
   url:SANDFORGE_SAND_PBR.albedo
  });
  applyMode();
  const count=await loadModels();
  if(!materialReady){
   status.textContent='Sand-Textur nicht verfügbar: Test fällt auf einfache Materialien zurück.';
  } else if(count===0) {
   status.textContent='Sand-PBR aktiv. Gebäude/Palmen konnten nicht geladen werden.';
  } else {
   applyMode();
   status.textContent+=' · '+count+' Original-GLB-Objekte geladen.';
  }
 }catch(error){
  console.error('Desert look lab initialization failed',error);
  status.textContent='Fehler bei Grafikressourcen: '+String(error);
 }
}
void initialize();

let frames=0,measureStart=performance.now();
function render(now){
 requestAnimationFrame(render);
 controls.update();
 renderer.render(scene,camera);
 frames++;
 if(now-measureStart>=750){
  const fps=Math.round(frames*1000/(now-measureStart));
  stats.textContent='FPS: '+fps+' · Draw Calls: '+renderer.info.render.calls+
   ' · Geometrien: '+renderer.info.memory.geometries;
  frames=0;measureStart=now;
 }
}
requestAnimationFrame(render);
window.addEventListener('resize',()=>{
 camera.aspect=window.innerWidth/window.innerHeight;
 camera.updateProjectionMatrix();
 renderer.setSize(window.innerWidth,window.innerHeight);
});
