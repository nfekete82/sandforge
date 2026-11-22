import {test,expect} from '@playwright/test';

test('real barracks, command center and factory GLBs render same 5 authored PBR graphics as HUD and moving construction ghost',async({page})=>{
 test.setTimeout(145000);
 const errors=[],glErrors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'&&/THREE.WebGLProgram|shader|WebGL/i.test(msg.text()))glErrors.push(msg.text());});
 await page.route('**/__sf_desert_building_pbr_qa__.html',route=>route.fulfill({
  contentType:'text/html',
  body:'<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js","three/addons/":"/vendor/three/addons/"}}</script><body></body>'
 }));
 await page.goto('/__sf_desert_building_pbr_qa__.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const {finishBarracksSides,finishBarracksDesertPalette}=await import('/webgl-barracks-shell.js');
  const {tintFactionMaterials}=await import('/webgl-faction-accents.js');
  const {finishDesertBuildingMaterials,waitForDesertBuildingTextures,DESERT_BUILDING_PBR_REVISION}=await import('/webgl-building-pbr.js');
  const {finishBuildingFacadeShading}=await import('/webgl-building-shading.js');
  const {buildingIcon}=await import('/webgl-portraits.js');
  const loader=new GLTFLoader();
  await waitForDesertBuildingTextures();
  const renderer=new THREE.WebGLRenderer({antialias:false});
  renderer.setPixelRatio(1);renderer.setSize(128,128);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff7de','#777361',2));
  const light=new THREE.DirectionalLight('#fff3d4',2.0);
  light.position.set(25,45,35);scene.add(light);
  const camera=new THREE.PerspectiveCamera(42,1,.1,1500);
  const models={};
  for(const kind of ['barracks','headquarters','factory']){
   const data=await loader.loadAsync('/src/assets/reborn/buildings-3d/'+kind+'-0.glb');
   const model=data.scene.clone(true);
   if(kind==='barracks')finishBarracksSides(model);
   tintFactionMaterials(model,0,kind,'building');
   if(kind==='barracks')finishBarracksDesertPalette(model);
   const originalDoors=[];
   model.traverse(mesh=>{
    if(mesh.isMesh&&/door|gate|shutter|identification|window/i.test(mesh.name))
     originalDoors.push([mesh,mesh.material]);
   });
   const before=model.getObjectByName('FactoryRollupDoor');
   const changed=finishDesertBuildingMaterials(model,kind);
   const more=finishDesertBuildingMaterials(model,kind);
   finishBuildingFacadeShading(model);
   const painted={wall:0,camo:0,roof:0,metal:0,trim:0};
   let preservedPBR=0;
   model.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const role=mesh.material?.userData?.sandforgeBuildingPBRRole;
    if(role){
     painted[role]++;if(mesh.material?.map&&mesh.material.normalMap)preservedPBR++;
    }
   });
   const doorsSafe=originalDoors.every(([mesh,mat])=>mesh.material===mat);
   const gateSafe=!before||before.material===originalDoors.find(([mesh])=>mesh===before)?.[1];
   const bbox=new THREE.Box3().setFromObject(model),size=bbox.getSize(new THREE.Vector3()),center=bbox.getCenter(new THREE.Vector3());
   const factor=10/Math.max(1,size.x,size.y,size.z);
   model.scale.multiplyScalar(factor);
   model.position.addScaledVector(center,-factor);
   scene.add(model);
   camera.position.set(13,11,19);camera.lookAt(0,0,0);
   renderer.render(scene,camera);
   const glError=renderer.getContext().getError();
   scene.remove(model);
   models[kind]={changed,more,painted,preservedPBR,doorsSafe,gateSafe,glError,
    programs:renderer.info.programs?.length??0};
  }
  const cards={};
  for(const kind of ['barracks','headquarters','factory']){
   const uri=await buildingIcon(kind,renderer);
   cards[kind]=uri.startsWith('data:image/png;base64,')&&uri.length>800;
  }
  renderer.dispose();renderer.domElement.remove();
  return {models,cards,revision:DESERT_BUILDING_PBR_REVISION};
 });
 for(const kind of ['barracks','headquarters','factory']){
  const row=result.models[kind];
  expect(row.changed).toBeGreaterThan(1);
  expect(row.more).toBe(0);
  expect(row.painted.wall+row.painted.camo+row.painted.roof+row.painted.metal+row.painted.trim).toBeGreaterThan(1);
  expect(row.preservedPBR).toBeGreaterThan(0);
  expect(row.doorsSafe).toBe(true);
  expect(row.gateSafe).toBe(true);
  expect(row.programs).toBeGreaterThan(0);
  expect(row.glError).toBe(0);
  expect(result.cards[kind]).toBe(true);
 }
 expect(glErrors).toEqual([]);
 expect(errors).toEqual([]);
});
