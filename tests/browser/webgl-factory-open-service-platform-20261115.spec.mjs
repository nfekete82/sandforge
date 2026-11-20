import {test,expect} from '@playwright/test';

test('authored OPEN vehicle factory plus independent drive-on service lift render without repair-garage roof/walls',async({page})=>{
 test.setTimeout(95000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const webglErrors=[];page.on('console',msg=>{
  if(msg.type()==='error'&&/THREE\.WebGLProgram|WebGL shader|GL_/i.test(msg.text()))
   webglErrors.push(msg.text());
 });
 await page.route('**/__sf_open_factory_lift_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_open_factory_lift_qa__.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {createFactoryServiceYard,updateFactoryServiceYard,disposeFactoryServiceYard}
   =await import('/webgl-factory-service.js');
  const data=await new GLTFLoader().loadAsync('/src/assets/reborn/buildings-3d/factory-0.glb');
  const factory=data.scene.clone(true);
  const originalGate=factory.getObjectByName('FactoryRollupDoor');
  const openExit=factory.getObjectByName('SF_Factory_PBR_OpenBay');
  const bbox=new THREE.Box3().setFromObject(factory);
  const size=bbox.getSize(new THREE.Vector3());
  const center=bbox.getCenter(new THREE.Vector3());
  const factor=230/Math.max(size.x,size.z);
  factory.scale.setScalar(factor);
  factory.position.set(-center.x*factor,-bbox.min.y*factor,-center.z*factor);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d9c5a6');
  scene.add(factory);
  const yard=createFactoryServiceYard();scene.add(yard);
  const deck=yard.getObjectByName('VehicleLiftPlatform_0');
  const ramp=yard.getObjectByName('VehicleDriveOnRamp_0');
  const entry={factoryServiceYard:yard};
  const vehicle={id:2,hp:200,factoryService:{baseId:1,bay:0,phase:'repair'}};
  updateFactoryServiceYard(entry,{id:1},[vehicle],2);
  scene.add(new THREE.HemisphereLight('#fff5df','#77756d',1.9));
  const sun=new THREE.DirectionalLight('#fff2d5',1.3);
  sun.position.set(150,260,200);scene.add(sun);
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(160,160);
  const camera=new THREE.PerspectiveCamera(52,1,.1,2000);
  camera.position.set(300,270,390);
  camera.lookAt(100,12,40);
  renderer.render(scene,camera);
  const glError=renderer.getContext().getError();
  const output={
   modelGate:!!originalGate,openExit:!!openExit,
   openAir:yard.userData.openAirPlatform,
   hasDeck:!!deck,hasRamp:!!ramp,
   deckTop:deck.position.y+deck.geometry.parameters.height/2,
   deckLocation:[deck.position.x,deck.position.z],
   unwanted:yard.children.filter(c=>/garage|roof|wall|shutter|door|workshop/i.test(c.name)).map(c=>c.name),
   sparks:yard.userData.bay0.sparks.visible,
   repairs:yard.userData.bay0.icon.visible,
   draws:renderer.info.render.calls,
   glError
  };
  disposeFactoryServiceYard(entry);
  renderer.dispose();
  return output;
 });
 expect(result.modelGate).toBe(false);
 expect(result.openExit).toBe(true);
 expect(result.openAir).toBe(true);
 expect(result.hasDeck).toBe(true);
 expect(result.hasRamp).toBe(true);
 expect(result.deckLocation).toEqual([192,45]);
 expect(result.deckTop).toBe(9.5);
 expect(result.unwanted).toEqual([]);
 expect(result.sparks).toBe(true);
 expect(result.repairs).toBe(true);
 expect(result.draws).toBeGreaterThan(0);
 expect(result.glError).toBe(0);
 expect(errors).toEqual([]);
 expect(webglErrors).toEqual([]);
});
