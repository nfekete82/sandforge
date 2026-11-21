import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('seven unified Sandforge industrial PBR buildings render without missing files or shader failures',async({page})=>{
 test.setTimeout(300000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{
  if(msg.type()==='error'&&/Shader Error|WebGLProgram|GL_INVALID|ReferenceError/i.test(msg.text()))
   errors.push(msg.text());
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-meshy-buildings.html',{waitUntil:'domcontentloaded'});
 mkdirSync('artifacts/screenshots',{recursive:true});
 const kinds=['factory','barracks','headquarters','airfield','bunker','bastion','generator'];
 for(const kind of kinds){
  await page.locator('#building').selectOption(kind);
  await page.waitForFunction(k=>window.__sandforgeBuildingViewerReady?.kind===k,
   kind,{timeout:120000});
  const report=await page.evaluate(()=>{
   const r=window.__sandforgeBuildingViewerReady;
   return {kind:r.kind,owner:r.owner,triangles:r.stats.tris,models:r.stats.meshes,
    albedo:r.stats.maps,normal:r.stats.normals,orm:r.stats.orm,
    error:window.__sandforgeBuildingViewerError};
  });
  console.log('MESHY_BUILDING '+JSON.stringify(report));
  expect(report.triangles).toBeGreaterThan(250);
  expect(report.models).toBeGreaterThan(0);
  expect(report.albedo).toBeGreaterThan(0);
  expect(report.error).toBeFalsy();
  if(kind==='headquarters'){
   const initial=await page.evaluate(()=>{
    const state=window.__sandforgeBuildingViewerReady.model.userData.meshyHQSatellites;
    return {animatedMeshes:state?.animatedMeshes,angles:state?.angles?.slice()};
   });
   expect(initial.animatedMeshes).toBeGreaterThan(0);
   await page.waitForTimeout(850);
   const advanced=await page.evaluate(()=>
    window.__sandforgeBuildingViewerReady.model.userData.meshyHQSatellites.angles.slice());
   expect(Math.abs(advanced[0]-initial.angles[0])).toBeGreaterThan(.001);
   expect(Math.abs(advanced[1]-initial.angles[1])).toBeGreaterThan(.001);
   // The HQ must keep its original mesh intact while BOTH independently
   // animated door leaves open. The Annex star must be covered by projected
   // real geometry, not a fragile custom shader that can hide the whole HQ.
   const details=await page.evaluate(async()=>{
    const {meshHeadquartersDoor,setMeshyHeadquartersDoorOpen,meshyLocalBounds}
     =await import('/webgl-meshy-structure.js');
    const model=window.__sandforgeBuildingViewerReady.model;
    const door=meshHeadquartersDoor(model);
    const crest=model.getObjectByName('SF_HQ_Annex_UnmarkedMetal');
    const visibleOriginal=model.children.filter(x=>x.isMesh||x.type==='Group').length;
    setMeshyHeadquartersDoorOpen(door,.97);
    const THREE=await import('three');
    const dimensions=meshyLocalBounds(model).getSize(new THREE.Vector3());
    return {mode:door?.mode,left:door?.left?.rotation.y,
     right:door?.right?.rotation.y,coverFaces:crest?.userData?.coveredTriangles,
     crestProjections:crest?.userData?.projectionSurfaces,
     doorRatio:door?.width/dimensions.x,
     doorDepthRatio:(door?.rig?.position.z-model.userData?.sandforgeRealHQDoorway?.z)/dimensions.z,
     originalObjects:visibleOriginal,
     missingShader:!model.getObjectByName('SF_Meshy_HQ_OriginalDoor_Interior')};
   });
   console.log('HQ_DOOR_AND_CRESt '+JSON.stringify(details));
   expect(details.mode).toBe('hinged-real-entrance');
   expect(details.left).toBeLessThan(-1);
   expect(details.right).toBeGreaterThan(1);
   expect(details.coverFaces).toBeGreaterThan(0);
   expect(details.crestProjections).toBeGreaterThan(0);
   expect(details.doorRatio).toBeLessThanOrEqual(.117);
   expect(details.doorDepthRatio).toBeLessThan(.004);
   expect(details.originalObjects).toBeGreaterThan(0);
   expect(details.missingShader).toBeTruthy();
   await page.waitForTimeout(150);
   await page.screenshot({path:'artifacts/screenshots/hq-original-door-open-unmarked-hangar.png'});
   await page.evaluate(async()=>{
    const {meshHeadquartersDoor,setMeshyHeadquartersDoorOpen}
     =await import('/webgl-meshy-structure.js');
    setMeshyHeadquartersDoorOpen(
     meshHeadquartersDoor(window.__sandforgeBuildingViewerReady.model),0);
   });
  }
  await page.screenshot({path:'artifacts/screenshots/meshy-industrial-'+kind+'-blue.png'});
 }
 for(const kind of ['headquarters','generator','bastion']){
  await page.locator('#building').selectOption(kind);
  await page.locator('#faction').selectOption('1');
  await page.waitForFunction(k=>window.__sandforgeBuildingViewerReady?.kind===k&&
   window.__sandforgeBuildingViewerReady?.owner===1,kind,{timeout:120000});
  await page.screenshot({path:'artifacts/screenshots/meshy-industrial-'+kind+'-red.png'});
 }
 expect(errors).toEqual([]);
});
