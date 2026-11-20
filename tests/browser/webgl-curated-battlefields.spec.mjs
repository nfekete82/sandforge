import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';

for(const id of ['staubkrone','frostpforte','schlangenfeste']){
 test('Actual WebGL render: '+id+' has authored 3D materials, safe set pieces and screenshots',async({page})=>{
  test.setTimeout(165000);
  await page.setViewportSize({width:1600,height:900});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#main-dialog')).toBeVisible();
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-map-preset').selectOption(id);
  await expect(page.locator('#sf3d-map-description')).not.toBeEmpty();
  await page.locator('#sf3d-new-confirm').click();
  await expect(page).toHaveURL(new RegExp('preset='+id));
  await page.waitForFunction(()=>window.__sandforgeWebGL?.loaded===true,
   {timeout:110000});
  const state=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,art=a.curatedMapArt;
   return {preset:a.mapPresetId,name:art?.plan?.name,
    landmarkCount:art?.plan?.landmarks?.length??0,
    groundAccents:art?.plan?.groundAccents?.length??0,
    drawCalls:art?.drawCalls??999,
    sceneCount:art?.root?.children?.length??0,
    allCosmetic:art?.root?.children?.every(x=>
      x.isInstancedMesh&&x.userData.visualOnly&&x.userData.nonPlayable),
    blackVoid:a.scene.background.getHexString()==='000000',
    valid:a.game.world.validation?.valid,
    terrain:a.scene.children.filter(x=>x.userData.terrain).length,
    generators:[a.game.world.generatorVersion,a.game.seed],
    biome:a.biome,
    fps:document.getElementById('fps')?.textContent
   };
  });
  expect(state.preset).toBe(id);
  expect(state.landmarkCount).toBeGreaterThan(0);
  expect(state.groundAccents).toBeGreaterThan(60);
  expect(state.drawCalls).toBeGreaterThan(1);
  expect(state.drawCalls).toBeLessThanOrEqual(14);
  expect(state.allCosmetic).toBe(true);
  expect(state.valid).toBe(true);
  expect(state.blackVoid).toBe(true);
  expect(state.terrain).toBe(16);
  expect(state.generators[0]).toBe(5);
  expect(errors).toEqual([]);
  mkdirSync('artifacts/screenshots',{recursive:true});
  // First record the REAL gameplay view with native HUD/fog and lighting.
  await page.screenshot({path:'artifacts/screenshots/'+id+'-playfield.png'});
  // Then frame an authored landmark for a close-up geometry/material audit.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,p=a.curatedMapArt.plan.landmarks[0];
   if(!p)return;
   const target=a.controls.target;
   const x=p.x-a.game.world.size/2,z=p.y-a.game.world.size/2;
   const y=a.heightAt(p.x,p.y);
   target.set(x,y+55,z);
   a.camera.position.set(x+420,y+390,z+550);
   a.camera.zoom=1.15;
   a.camera.updateProjectionMatrix();
   a.controls.update();
  });
  await page.waitForTimeout(900);
  await page.screenshot({path:'artifacts/screenshots/'+id+'-landmark.png'});
  console.log('CURATED_WEBGL_VISUAL '+JSON.stringify(state));
 });
}
