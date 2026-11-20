import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
for(const mapId of ['desert-strike','broken-empire'])
 test('True WebGL PBR animated water: '+mapId,async({page})=>{
  test.setTimeout(240000);
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',m=>{
   if(m.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS/i.test(m.text()))
    errors.push(m.text());
  });
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-desert-map').selectOption(mapId);
  await page.locator('#sf3d-new-confirm').click();
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,null,{timeout:160000});
  const report=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,w=a.desertWater;
   return {id:a.desertMapId,hasWater:Boolean(w),lakes:w?.layout.lakes.length??0,
    rivers:w?.layout.rivers.length??0,meshes:w?.meshes.length??0,shores:w?.shores.length??0,
    drawCalls:w?.drawCalls??0,
    goodPBR:w?.meshes.every(m=>m.material.isMeshPhysicalMaterial&&m.material.transparent)??false,
    safe:w?.meshes.every(m=>m.userData.visualOnly&&m.userData.nonBlocking&&m.userData.shallowPassable)??false,
    blackEdge:a.scene.background?.getHexString()==='000000',
    valid:a.game.world.validation?.valid,
    waterClock:w?.materials[0]?.userData.waterTime.value??null};
  });
  console.log('SANDFORGE_LAKES_RIVERS '+JSON.stringify(report));
  expect(report.id).toBe(mapId);
  expect(report.lakes).toBeGreaterThan(0);
  expect(report.rivers).toBe(0);
  expect(report.drawCalls).toBe(report.meshes+report.shores);
  expect(report.shores).toBe(report.meshes);
  expect(report.goodPBR&&report.safe&&report.blackEdge&&report.valid).toBe(true);
  await page.waitForTimeout(400);
  const clock=await page.evaluate(()=>window.__sandforgeWebGL.desertWater.materials[0].userData.waterTime.value);
  expect(clock).toBeGreaterThan(report.waterClock);
  // The QA viewer reveals the water and aims at the actual planned lagoon.
  // Never toggle FoW or camera settings in normal Sandforge gameplay.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL;
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   const lake=a.desertWater.layout.lakes[0],half=a.game.world.size/2;
   const y=a.heightAt(lake.x,lake.y);
   a.controls.target.set(lake.x-half,y,lake.y-half);
   a.camera.position.set(lake.x-half+330,y+400,lake.y-half+360);
   a.camera.zoom=1.6;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(700);
  mkdirSync('artifacts/screenshots',{recursive:true});
  await page.screenshot({path:'artifacts/screenshots/'+mapId+'-cinematic-water.png'});
  expect(errors).toEqual([]);
 });
