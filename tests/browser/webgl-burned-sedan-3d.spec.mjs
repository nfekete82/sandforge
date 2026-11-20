import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const id of ['desert-strike','broken-empire','burning-horizon','last-stronghold']){
 test('Real Chromium WebGL: burnt Sedan 3D props on '+id,async({page})=>{
  test.setTimeout(170000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1600,height:900});
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-desert-map').selectOption(id);
  await page.locator('#sf3d-new-confirm').click();
  await expect(page).toHaveURL(new RegExp('map='+id));
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,
   {timeout:125000});
  const state=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,b=a.burnedSedans;
   const meshes=b?.root?.children??[];
   return {
    preset:a.desertMapId,
    scene3d:Boolean(a.renderer.capabilities.isWebGL2),
    cars:b?.placements.length??0,
    debris:b?.debris.length??0,
    debrisDrawCalls:b?.debrisDrawCalls??0,
    drawCalls:b?.drawCalls??0,
    triangles:b?.triangles??0,
    visualOnly:meshes.every(m=>m.userData.visualOnly&&
     m.userData.nonPlayable&&m.userData.nonBlocking),
    allInstanced:meshes.every(m=>m.isInstancedMesh),
    debrisMeshes:meshes.filter(m=>m.userData.burnedSedanDebris).length,
    debrisParts:[...new Set(meshes.filter(m=>m.userData.burnedSedanDebris).map(m=>m.userData.part))],
    materials:[...new Set(meshes.map(m=>m.userData.material))],
    realPBR:meshes.some(m=>m.userData.material==='shell'&&
     m.material.map?.isTexture&&m.material.normalMap?.isTexture),
    shadow:meshes.some(m=>m.castShadow),
    valid:a.game.world.validation?.valid,
    blackVoid:a.scene.background.getHexString()==='000000',
    sceneTerrain:a.scene.children.filter(m=>m.userData.terrain).length
   };
  });
  expect(state.preset).toBe(id);
  expect(state.scene3d).toBe(true);
  expect(state.cars).toBeGreaterThanOrEqual(2);
  expect(state.drawCalls).toBeGreaterThanOrEqual(5);
  expect(state.drawCalls).toBeLessThanOrEqual(18);
  expect(state.debris).toBeGreaterThanOrEqual(state.cars*2);
  expect(state.debrisDrawCalls).toBeGreaterThanOrEqual(5);
  expect(state.debrisDrawCalls).toBeLessThanOrEqual(8);
  expect(state.debrisMeshes).toBe(state.debrisDrawCalls);
  expect(state.debrisParts).toEqual(expect.arrayContaining([
   'wheelRubber','wheelIron','door']));
  expect(state.triangles).toBeGreaterThan(800);
  expect(state.allInstanced&&state.visualOnly).toBe(true);
  expect(state.materials).toEqual(expect.arrayContaining([
   'shell','char','iron','rubber','glass']));
  expect(state.realPBR).toBe(true);
  expect(state.shadow).toBe(true);
  expect(state.valid).toBe(true);
  expect(state.blackVoid).toBe(true);
  expect(state.sceneTerrain).toBe(16);
  expect(errors).toEqual([]);
  mkdirSync('artifacts/screenshots',{recursive:true});
  await page.screenshot({path:'artifacts/screenshots/'+id+'-gameplay.png'});
  // Gallery ONLY: no extra vision for the AI, and no change to normal play.
  await page.evaluate(()=>{
   for(const el of document.body.children)
    if(el.id!=='stage'&&el.tagName!=='SCRIPT')
     el.style.setProperty('display','none','important');
   const a=window.__sandforgeWebGL,p=a.burnedSedans.placements[0];
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   const size=a.game.world.size,x=p.x-size*.5,z=p.y-size*.5,y=a.heightAt(p.x,p.y);
   a.controls.target.set(x,y+15,z);
   a.camera.position.set(x+155,y+135,z+170);
   a.camera.zoom=3.35;a.camera.updateProjectionMatrix();
   a.controls.update();
  });
  await page.waitForTimeout(700);
  await page.screenshot({path:'artifacts/screenshots/'+id+'-sedan-closeup.png'});
  // Additional angle clearly frames the wreck and its fallen parts together.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,p=a.burnedSedans.placements[0],size=a.game.world.size;
   const x=p.x-size*.5,z=p.y-size*.5,y=a.heightAt(p.x,p.y);
   a.controls.target.set(x,y+8,z);
   a.camera.position.set(x+220,y+208,z+255);
   a.camera.zoom=2.65;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(380);
  await page.screenshot({path:'artifacts/screenshots/'+id+'-sedan-and-scattered-parts.png'});
  await page.setViewportSize({width:640,height:360});
  await page.waitForTimeout(350);
  const jpeg=await page.screenshot({type:'jpeg',quality:36});
  console.log('BURNED_SEDAN_THUMBNAIL '+id+' '+jpeg.toString('base64'));
  console.log('BURNED_SEDAN_WEBGL '+JSON.stringify(state));
 });
}
