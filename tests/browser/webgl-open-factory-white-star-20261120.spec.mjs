import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('real WebGL2: PBR open factory without shutter and matching blue/red white-star bunker flags',async({page})=>{
 test.setTimeout(210000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{
  if(msg.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID/i.test(msg.text()))
   errors.push(msg.text());
 });
 await page.setViewportSize({width:1440,height:900});
 await page.route('**/__sf_open_factory_white_star_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<style>html,body{margin:0;background:#b79d79}</style><script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_open_factory_white_star_qa__.html');
 const info=await page.evaluate(async()=>{
  const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {createFortifiedBunker}=await import('/webgl-fortified-bunker.js');
  const {factionFlagTexture}=await import('/webgl-faction-flags.js');
  const loader=new GLTFLoader();
  const file=await loader.loadAsync('/src/assets/reborn/buildings-3d/factory-0.glb');
  const factory=file.scene;
  const marker=factory.getObjectByName('SF_Factory_PBR_OpenBay');
  const door=factory.getObjectByName('FactoryRollupDoor');
  const bounds=new T.Box3().setFromObject(factory),size=bounds.getSize(new T.Vector3());
  const factor=210/Math.max(size.x,size.z);
  const center=bounds.getCenter(new T.Vector3());
  factory.scale.setScalar(factor);
  factory.position.set(-center.x*factor,-bounds.min.y*factor,-center.z*factor);
  const blue=createFortifiedBunker(0),red=createFortifiedBunker(1);
  blue.position.set(-174,0,54);red.position.set(174,0,54);
  const scene=new T.Scene();scene.background=new T.Color('#b99c73');
  const ground=new T.Mesh(new T.PlaneGeometry(1000,1000),
   new T.MeshStandardMaterial({color:'#ad8c65',roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  scene.add(factory,blue,red);
  const hemi=new T.HemisphereLight('#f6eddc','#6d594a',2.0);
  scene.add(hemi);
  const sun=new T.DirectionalLight('#fff2d9',2.5);
  sun.position.set(-270,420,350);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-400;
  sun.shadow.camera.right=400;sun.shadow.camera.top=400;sun.shadow.camera.bottom=-400;
  scene.add(sun);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(1440,900,false);
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);
  const camera=new T.PerspectiveCamera(46,1440/900,.1,3000);
  camera.position.set(390,360,540);camera.lookAt(0,35,0);
  renderer.render(scene,camera);
  const contextError=renderer.getContext().getError();
  const files=[blue,red].map((b,i)=>({
   scale:b.scale.x,
   source:b.children.find(x=>x.userData.bunkerFlag)?.material.map===factionFlagTexture(i),
   drawn:b.userData.bunkerDrawCalls
  }));
  const pbr=[];factory.traverse(x=>{
   if(x.isMesh)pbr.push({name:x.name,hasMap:!!x.material.map});
  });
  window.__qaRenderer=renderer;window.__qaScene=scene;
  return {marker:!!marker,shutter:!!door,
   openBayWidthMetres:3.36,openBayHeightMetres:2.14,
   allFactoryMeshesHaveTextures:pbr.every(x=>x.hasMap),
   factoryMeshCount:pbr.length,
   flags:files,glError:contextError,renderCalls:renderer.info.render.calls};
 });
 console.log('SAND_FORGE_FACTORY_BUNKER_STAR_QA '+JSON.stringify(info));
 expect(info.marker).toBe(true);
 expect(info.shutter).toBe(false);
 expect(info.factoryMeshCount).toBeGreaterThan(10);
 expect(info.allFactoryMeshesHaveTextures).toBe(true);
 expect(info.flags.every(x=>x.scale===.72&&x.source)).toBe(true);
 expect(info.glError).toBe(0);
 expect(info.renderCalls).toBeGreaterThan(0);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/open-vehicle-factory-compact-blue-red-bunkers.png'});
 expect(errors).toEqual([]);
});
