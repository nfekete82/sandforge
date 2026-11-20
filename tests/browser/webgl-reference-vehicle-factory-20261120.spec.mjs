import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('full 3D reference-like industrial hangar: GLB normals, sloped roof, twin stacks and open road exit',async({page})=>{
 test.setTimeout(240000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',m=>{
  if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|INVALID_OPERATION|GL_INVALID/i.test(m.text()))
   errors.push(m.text());
 });
 await page.setViewportSize({width:1440,height:950});
 await page.route('**/__sandforge_reference_factory_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<style>html,body{margin:0;background:#b9a17d;overflow:hidden}</style>'+
   '<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js",'+
   '"three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sandforge_reference_factory_qa__.html');
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const imported=await new GLTFLoader().loadAsync('/src/assets/reborn/buildings-3d/factory-0.glb');
  const factory=imported.scene,box=new T.Box3().setFromObject(factory);
  const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const scale=235/Math.max(size.x,size.z);
  factory.scale.setScalar(scale);
  factory.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
  factory.rotation.y=0;
  const scene=new T.Scene();scene.background=new T.Color('#ad9274');
  const ground=new T.Mesh(new T.PlaneGeometry(1750,1750),
   new T.MeshStandardMaterial({color:'#b2a58a',roughness:.99}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // Neutral outdoor environment: no fake decals or reference bitmap under
  // the 3D building. All roof, compressors, grilles and paint are real meshes.
  scene.add(factory);
  scene.add(new T.HemisphereLight('#f6f4ec','#586c75',2.35));
  const sun=new T.DirectionalLight('#fff0cf',2.4);
  sun.position.set(-290,460,350);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-450;sun.shadow.camera.right=450;
  sun.shadow.camera.top=450;sun.shadow.camera.bottom=-450;
  sun.shadow.normalBias=.018;scene.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(1440,950,false);
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(45,1440/950,.5,2500);
  camera.position.set(370,310,490);camera.lookAt(0,60,0);
  renderer.render(scene,camera);
  const sample=kind=>{
   const mesh=factory.getObjectByName('SF_Factory_PBR_'+kind);
   return {
    exists:!!mesh,map:!!mesh?.material.map,
    normalMap:!!mesh?.material.normalMap,
    roughnessMap:!!mesh?.material.roughnessMap,
    mapWidth:mesh?.material.map?.image?.width,
    triangles:mesh?.geometry?.index?.count/3??0
   };
  };
  const output={
   reference:!!factory.getObjectByName('SF_Factory_PBR_ReferenceHangar_v3'),
   openBay:!!factory.getObjectByName('SF_Factory_PBR_OpenBay'),
   noShutter:!factory.getObjectByName('FactoryRollupDoor'),
   pitchedRoof:sample('roof'),
   roofSkylights:sample('roof_glazing'),
   exhaustStacks:sample('stack'),
   annex:sample('wall_weather'),
   wall:sample('camo'),
   ramp:sample('hazard_white'),
   drawCalls:renderer.info.render.calls,
   glError:renderer.getContext().getError()
  };
  window.__sfRefQA={renderer,scene,camera,factory};
  return output;
 });
 console.log('SANDFORGE_REFERENCE_FACTORY_REAL_GLTF '+JSON.stringify(report));
 expect(report.reference&&report.openBay&&report.noShutter).toBe(true);
 for(const key of ['pitchedRoof','roofSkylights','exhaustStacks','annex','wall','ramp'])
  expect(report[key].exists&&report[key].map).toBe(true);
 for(const key of ['pitchedRoof','annex','wall']){
  expect(report[key].normalMap&&report[key].roughnessMap).toBe(true);
 }
 expect(report.pitchedRoof.mapWidth).toBe(1024);
 expect(report.drawCalls).toBeLessThan(55);
 expect(report.glError).toBe(0);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/reference-factory-front-isometric.png'});
 await page.evaluate(()=>{
  const a=window.__sfRefQA;
  a.camera.position.set(-420,330,-440);
  a.camera.lookAt(0,65,0);a.renderer.render(a.scene,a.camera);
 });
 await page.screenshot({path:'artifacts/screenshots/reference-factory-rear-machinery.png'});
 expect(errors).toEqual([]);
});
