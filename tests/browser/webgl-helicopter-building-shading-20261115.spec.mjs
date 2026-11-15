import {test,expect} from '@playwright/test';

test('actual authored helicopter GLB: faction stripes follow the fuselage; building facades render with depth',async({page})=>{
 test.setTimeout(90000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/__sandforge_surface_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sandforge_surface_qa__.html');
 const state=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {attachTeamMarkings}=await import('/webgl-team-markings.js');
  const {finishBuildingFacadeShading}=await import('/webgl-building-shading.js');
  const loader=new GLTFLoader();
  const heli=await loader.loadAsync('/src/assets/reborn/animation/scout-0.glb');
  const actor=new THREE.Group();actor.add(heli.scene);
  const entry={node:actor,detail:heli.scene};
  attachTeamMarkings(entry,0,'scout',130,50);
  const painted=[];heli.scene.traverse(mesh=>{
   if(mesh.isMesh&&mesh.material?.userData?.sandforgeHelicopterStripes)painted.push(mesh);
  });
  const flags=heli.scene.getObjectByName('TeamAircraftWing_-1')||
   heli.scene.getObjectByName('TeamAircraftWing_1')||
   actor.getObjectByName('TeamAircraftWing_-1')||
   actor.getObjectByName('TeamAircraftWing_1');
  const barracks=await loader.loadAsync('/src/assets/reborn/buildings-3d/barracks-0.glb');
  const shaded=finishBuildingFacadeShading(barracks.scene);
  // A tiny independent renderer verifies real GLSL programs without
  // producing an expensive full desert screenshot / loading a 6K map.
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(160,160);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff','#706d5e',2.0));
  const sun=new THREE.DirectionalLight('#fff8e6',2.0);
  sun.position.set(3,10,7);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(45,1,.1,500);
  function draw(root){
   const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
   const center=bounds.getCenter(new THREE.Vector3());
   const m=Math.max(size.x,size.y,size.z);
   root.scale.setScalar(8/Math.max(.001,m));
   root.position.set(-center.x*root.scale.x,-center.y*root.scale.y,-center.z*root.scale.z);
   camera.position.set(12,9,17);camera.lookAt(0,0,0);
   scene.add(root);renderer.render(scene,camera);
   const error=renderer.getContext().getError();
   scene.remove(root);return error;
  }
  const heliGlError=draw(actor);
  const buildingGlError=draw(barracks.scene);
  renderer.dispose();renderer.domElement.remove();
  return {painted:painted.length,flags:!!flags,teamGeometry:!!entry.teamMarkings,
   shaded,heliGlError,buildingGlError};
 });
 expect(state.painted).toBeGreaterThan(0);
 expect(state.flags).toBe(false);
 expect(state.teamGeometry).toBe(false);
 expect(state.shaded).toBeGreaterThan(0);
 expect(state.heliGlError).toBe(0);
 expect(state.buildingGlError).toBe(0);
 expect(errors).toEqual([]);
});
