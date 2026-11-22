import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('actual 5MB Meshy factory: original blue PBR, enemy red shader, and real rollup from separated authentic GLB mesh',async({page})=>{
 test.setTimeout(240000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{
  if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS|GL_INVALID/i.test(m.text()))
   errors.push(m.text());
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-meshy-factory.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.kind==='meshy',
  null,{timeout:150000});
 const report=()=>page.evaluate(()=>{
  const a=window.__sandforgeMeshyFactoryReady;
  const door=a.model.getObjectByName('FactoryRollupDoor');
  const source=a.model.getObjectByName('SF_Factory_Meshy_ProductionRig');
  const meshes=[];a.model.traverse(m=>{if(m.isMesh)meshes.push(m)});
  const mapped=meshes.filter(m=>m.material?.map&&m.material.normalMap&&
   m.material.roughnessMap&&m.material.metalnessMap);
  const painted=meshes.filter(m=>m.material?.userData.sandforgeMeshyFactionOwned);
  return {kind:a.kind,source:!!source,door:!!door,realDoorTriangles:door?.geometry?.index?.count/3,
   triangles:a.info.triangles,draws:a.info.draws,mapped:mapped.length,
   paintClones:painted.length,rollup:a.doorOpen,
   glError:a.renderer.getContext().getError()};
 });
 const blue=await report();
 console.log('MESHY_REAL_BLUE '+JSON.stringify(blue));
 expect(blue.source&&blue.door).toBe(true);
 expect(blue.realDoorTriangles).toBe(737);
 expect(blue.triangles).toBeGreaterThan(91000);
 expect(blue.triangles).toBeLessThan(93000);
 expect(blue.mapped).toBeGreaterThanOrEqual(2);
 expect(blue.paintClones).toBe(0);
 expect(blue.glError).toBe(0);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-blue-closed-pbr.png'});
 await page.locator('#door').click();
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.doorOpen>.95,
  null,{timeout:10000});
 const open=await report();
 expect(open.rollup).toBeGreaterThan(.95);
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-blue-open-rollup.png'});
 await page.locator('#door').click();
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.doorOpen<.05,
  null,{timeout:10000});
 await page.locator('#model').selectOption('meshy-red');
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.kind==='meshy-red',
  null,{timeout:150000});
 const red=await report();
 console.log('MESHY_REAL_RED '+JSON.stringify(red));
 expect(red.door&&red.source).toBe(true);
 expect(red.paintClones).toBeGreaterThanOrEqual(2);
 expect(red.mapped).toBeGreaterThanOrEqual(2);
 expect(red.glError).toBe(0);
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-red-closed-pbr.png'});
 await page.locator('#door').click();
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.doorOpen>.95,
  null,{timeout:10000});
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-red-open-rollup.png'});
 await page.locator('#model').selectOption('authored');
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.kind==='authored',
  null,{timeout:150000});
 const backup=await report();
 expect(backup.door).toBe(false);
 expect(backup.source).toBe(false);
 await page.screenshot({path:'artifacts/screenshots/old-procedural-factory-only-backup.png'});
 expect(errors).toEqual([]);
});
