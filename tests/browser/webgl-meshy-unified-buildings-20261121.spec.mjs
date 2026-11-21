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
