import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('real downloaded Meshy 7.1 PBR factory is viable as opt-in 3D candidate with authoring comparison',async({page})=>{
 test.setTimeout(210000);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{
  if(e.type()==='error'&&/WebGLProgram|GL_INVALID|Shader Error/i.test(e.text()))
   errors.push(e.text());
 });
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/webgl-meshy-factory.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.kind==='meshy',null,{timeout:150000});
 const first=await page.evaluate(()=>{
  const q=window.__sandforgeMeshyFactoryReady,gl=q.renderer.getContext().getError();
  return {triangles:q.info.triangles,draws:q.info.draws,
   albedo:q.info.albedo,normal:q.info.normal,orm:q.info.orm,
   glError:gl};
 });
 expect(first.triangles).toBeGreaterThan(35000);
 expect(first.triangles).toBeLessThan(130000);
 expect(first.draws).toBeGreaterThan(0);
 expect(first.albedo).toBeGreaterThan(0);
 expect(first.normal).toBeGreaterThan(0);
 expect(first.orm).toBeGreaterThan(0);
 expect(first.glError).toBe(0);
 mkdirSync('artifacts/screenshots',{recursive:true});
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-71-real-3d-front.png'});
 await page.evaluate(()=>{
  const q=window.__sandforgeMeshyFactoryReady;
  q.camera.position.set(-405,360,-470);q.camera.lookAt(0,60,0);
 });
 await page.waitForTimeout(180);
 await page.screenshot({path:'artifacts/screenshots/meshy-factory-71-real-3d-rear.png'});
 await page.locator('#model').selectOption('authored');
 await page.waitForFunction(()=>window.__sandforgeMeshyFactoryReady?.kind==='authored',null,{timeout:90000});
 await page.screenshot({path:'artifacts/screenshots/sandforge-authored-open-factory-comparison.png'});
 console.log('MESHY_REAL_WEBGL_QA '+JSON.stringify(first));
 expect(errors).toEqual([]);
});
