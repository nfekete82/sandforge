import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
for(const id of ['desert-strike','broken-empire','burning-horizon','last-stronghold']){
 test('Chromium WebGL: four smoothly blended real ground textures on '+id,async({page})=>{
  test.setTimeout(240000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
   if(m.type()==='error'&&/WebGLProgram|Shader Error|VALIDATE_STATUS/i.test(m.text()))
    errors.push(m.text());
  });
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/webgl-preview.html',{waitUntil:'domcontentloaded'});
  await page.locator('#sf3d-new').click();
  await page.locator('#sf3d-desert-map').selectOption(id);
  await page.locator('#sf3d-new-confirm').click();
  await expect(page).toHaveURL(new RegExp('map='+id));
  await page.waitForFunction(()=>{
   const a=window.__sandforgeWebGL;
   return a?.loaded===true&&a?.groundBlendReady===true;
  },null,{timeout:165000});
  const report=await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,terrain=a.scene.children.filter(x=>x.userData?.terrain),
    m=terrain[0]?.material,d=m?.userData?.sandforgeGroundBlending;
   return {
    id:a.desertMapId,
    terrainChunks:terrain.length,
    commonMaterial:terrain.every(x=>x.material===m),
    sourcePBR:Boolean(m?.map?.isTexture&&m?.normalMap?.isTexture&&m?.roughnessMap?.isTexture),
    groundBlend:Boolean(d&&d.channels===4&&d.textures?.length===3&&d.mask?.isDataTexture),
    correctMap:d?.mapId===id,
    sources:d?.layers?.length??0,
    fourTrueImages:d?.textures?.every(t=>t.isTexture&&t.image?.width>128)??false,
    builtInPBR:Boolean(m?.userData?.sandforgeGroundPBR||m?.userData?.sandforgeSandPBR),
    hardBlackEdge:a.scene.background?.getHexString()==='000000',
    valid:a.game.world.validation?.valid,
    clock:a.game.time
   };
  });
  console.log('AUTHENTIC_GROUND_BLEND '+JSON.stringify(report));
  expect(report.id).toBe(id);
  expect(report.terrainChunks).toBe(16);
  expect(report.commonMaterial&&report.sourcePBR).toBe(true);
  expect(report.groundBlend&&report.correctMap&&report.fourTrueImages).toBe(true);
  expect(report.sources).toBe(4);
  expect(report.builtInPBR&&report.hardBlackEdge&&report.valid).toBe(true);
  // Screenshot only: show all land and focus on actual playable terrain.
  await page.evaluate(()=>{
   const a=window.__sandforgeWebGL,site=a.terrain.sites[0],h=a.game.world.size/2;
   a.battlefield.fogEnabled=false;a.battlefield.updateFog();
   const cx=a.game.world.size*.52,cz=a.game.world.size*.45,y=a.heightAt(cx,cz);
   a.controls.target.set(cx-h,y+10,cz-h);
   a.camera.position.set(cx-h+560,y+760,cz-h+580);
   a.camera.zoom=1.3;a.camera.updateProjectionMatrix();a.controls.update();
  });
  await page.waitForTimeout(1100);
  mkdirSync('artifacts/screenshots',{recursive:true});
  await page.screenshot({path:'artifacts/screenshots/'+id+'-four-ground-blends.png'});
  expect(errors).toEqual([]);
 });
}
